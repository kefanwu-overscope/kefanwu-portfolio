"""Concatenate existing WebP bytes to reduce animation requests without re-encoding.

The normal run writes chunks and a candidate manifest, leaving the input manifest
untouched. Use --output-root to stage chunks outside the site. After final frame
assets are ready, --write-manifest verifies all chunks before atomically replacing
the input manifest. Original frame URLs, dimensions, timing and provenance remain
unchanged; --projects can pack a subset, and omission packs every current project.

Each .bin is headerless concatenated WebP files. ``chunks[].frames`` contains
zero-based indexes into the original ``frames`` list, with byte offsets/lengths.
The first chunk defaults to four frames for an earlier usable pose; later chunks
default to sixteen frames. Both respect the same byte limit.
Only the Python standard library is required.
"""

import argparse
import copy
import gzip
import hashlib
import json
import os
import re
import tempfile
import time
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT.parent / '.codex/motion-loading-20260913/transport'
CHUNK_DIRECTORY = 'assets/exploded/chunks-20260913'
CHUNK_VERSION = 1
TRANSPORT_SCHEMA = 'webp-byte-ranges-v1'
TRANSPORT_FIELDS = {'chunks', 'chunkBytes', 'chunkVersion'}
LOADER_MAX_CHUNK_FRAMES = 32
LOADER_MAX_CHUNK_BYTES = 16 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode('utf-8')


def bounded_path(root, relative):
    """Reject traversal, Windows alternate streams and symlink escapes."""
    root = root.resolve()
    require(isinstance(relative, str) and relative, 'Empty asset path')
    require(not any(character in relative for character in ('\\', ':', '\x00')),
            f'Unsafe asset path: {relative!r}')
    parts = relative.split('/')
    require(all(part and part not in ('.', '..') for part in parts),
            f'Unsafe asset path: {relative!r}')
    destination = (root / relative).resolve()
    require(destination.is_relative_to(root), f'Asset path escapes {root}: {relative}')
    return destination


def local_asset(url, site_root, manifest_path, suffix):
    """Resolve supported same-origin URL forms within assets/exploded only."""
    require(isinstance(url, str) and url, 'Asset URL must be a nonempty string')
    require(url == url.strip() and not any(ord(c) < 32 for c in url),
            f'Invalid whitespace in asset URL: {url!r}')
    parsed = urlsplit(url)
    require(not parsed.scheme and not parsed.netloc and not parsed.fragment,
            f'Only same-origin local asset URLs are allowed: {url}')
    path = unquote(parsed.path, errors='strict')
    require('%' not in path, f'Nested URL encoding is not supported: {url}')
    if path.startswith('/assets/'):
        path = path[1:]
    if path.startswith('assets/'):
        source = bounded_path(site_root, path)
    else:
        source = bounded_path(manifest_path.parent, path)
    allowed = (site_root / 'assets/exploded').resolve()
    require(source.is_relative_to(allowed), f'Asset is outside assets/exploded: {url}')
    require(source.suffix == suffix, f'Expected {suffix} asset: {url}')
    return source


def verify_cache_key(url, data):
    versions = parse_qs(urlsplit(url).query).get('v', [])
    require(len(versions) == 1 and re.fullmatch(r'[0-9a-f]{12,64}', versions[0]),
            f'Expected a SHA-256 cache key: {url}')
    require(digest(data).startswith(versions[0]), f'Cache hash does not match bytes: {url}')


def webp_size(data):
    """Read static WebP container dimensions without decoding or transforming it."""
    require(len(data) >= 30 and data[:4] == b'RIFF' and data[8:12] == b'WEBP',
            'Frame is not a WebP RIFF container')
    require(int.from_bytes(data[4:8], 'little') + 8 == len(data),
            'WebP RIFF byte count is invalid')
    cursor, dimensions, image_count = 12, None, 0
    while cursor < len(data):
        require(cursor + 8 <= len(data), 'Truncated WebP chunk header')
        kind = data[cursor:cursor + 4]
        length = int.from_bytes(data[cursor + 4:cursor + 8], 'little')
        start, end = cursor + 8, cursor + 8 + length
        require(end <= len(data), 'Truncated WebP chunk payload')
        body = data[start:end]
        require(kind not in (b'ANIM', b'ANMF'), 'Animated WebP source is unsupported')
        if kind == b'VP8X':
            require(length == 10 and not (body[0] & 2), 'Invalid/static-only VP8X header')
            dimensions = (1 + int.from_bytes(body[4:7], 'little'),
                          1 + int.from_bytes(body[7:10], 'little'))
        elif kind == b'VP8 ':
            require(length >= 10 and body[3:6] == b'\x9d\x01\x2a', 'Invalid VP8 header')
            coded_size = (int.from_bytes(body[6:8], 'little') & 0x3fff,
                          int.from_bytes(body[8:10], 'little') & 0x3fff)
            require(dimensions in (None, coded_size), 'VP8 canvas dimensions differ')
            dimensions = coded_size
            image_count += 1
        elif kind == b'VP8L':
            require(length >= 5 and body[0] == 0x2f, 'Invalid VP8L header')
            packed = int.from_bytes(body[1:5], 'little')
            coded_size = ((packed & 0x3fff) + 1, ((packed >> 14) & 0x3fff) + 1)
            require(dimensions in (None, coded_size), 'VP8L canvas dimensions differ')
            dimensions = coded_size
            image_count += 1
        cursor = end + (length & 1)
    require(cursor == len(data) and dimensions and image_count == 1,
            'Expected one complete static WebP image')
    return dimensions


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.' + path.name + '-', suffix='.tmp',
                                         dir=path.parent, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def read_frame(project, key, index, site_root, manifest_path):
    url = project['frames'][index]
    source = local_asset(url, site_root, manifest_path, '.webp')
    require(source.name == f'{index:02d}.webp',
            f'{key}: frame {index} has noncanonical filename {source.name}')
    data = source.read_bytes()
    verify_cache_key(url, data)
    require(webp_size(data) == (project['width'], project['height']),
            f'{key}: frame {index} dimensions differ from manifest')
    return data


def pack_project(key, project, site_root, manifest_path, output_root, group_size, byte_limit,
                 bootstrap_size=4):
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', key), f'Unsafe project key: {key}')
    require(isinstance(project.get('frames'), list) and project['frames'],
            f'{key}: expected a nonempty frame list')
    chunks, records, payload = [], [], bytearray()

    def flush():
        if not records:
            return
        relative = f'{CHUNK_DIRECTORY}/{key}/{len(chunks):03d}.bin'
        data = bytes(payload)
        destination = bounded_path(output_root, relative)
        if not destination.exists() or destination.read_bytes() != data:
            atomic_write(destination, data)
        chunks.append({'url': f'{relative}?v={digest(data)[:12]}',
                       'bytes': len(data), 'frames': list(records)})
        records.clear()
        payload.clear()

    for index in range(len(project['frames'])):
        data = read_frame(project, key, index, site_root, manifest_path)
        require(len(data) <= byte_limit,
                f'{key}: frame {index} alone exceeds --max-chunk-bytes ({len(data)})')
        frame_limit = min(bootstrap_size, group_size) if not chunks else group_size
        if records and (len(records) >= frame_limit or len(payload) + len(data) > byte_limit):
            flush()
        records.append({'index': index, 'offset': len(payload), 'length': len(data)})
        payload.extend(data)
    flush()
    chunk_bytes = sum(chunk['bytes'] for chunk in chunks)
    require(chunk_bytes == project['bytes'], f'{key}: source byte count differs from manifest')
    project.update(chunks=chunks, chunkBytes=chunk_bytes, chunkVersion=CHUNK_VERSION)


def verify_project(key, before, after, site_root, manifest_path, output_root):
    """Independently reread written chunks and compare every slice with its source."""
    original_fields = lambda value: {k: v for k, v in value.items() if k not in TRANSPORT_FIELDS}
    require(original_fields(before) == original_fields(after), f'{key}: original metadata changed')
    expected_index, source_bytes, records, chunks = 0, 0, [], []
    for number, chunk in enumerate(after['chunks']):
        source = local_asset(chunk['url'], output_root,
                             output_root / 'assets/exploded/manifest.json', '.bin')
        require(source.name == f'{number:03d}.bin', f'{key}: noncanonical chunk numbering')
        require(source.parent == bounded_path(output_root, f'{CHUNK_DIRECTORY}/{key}'),
                f'{key}: unexpected chunk directory')
        data = source.read_bytes()
        verify_cache_key(chunk['url'], data)
        require(type(chunk['bytes']) is int and len(data) == chunk['bytes'] > 0,
                f'{key}: wrong chunk byte count')
        require(isinstance(chunk['frames'], list) and chunk['frames'], f'{key}: empty chunk')
        require(len(data) <= LOADER_MAX_CHUNK_BYTES and len(chunk['frames']) <= LOADER_MAX_CHUNK_FRAMES,
                f'{key}: chunk exceeds browser loader limits')
        offset = 0
        for frame in chunk['frames']:
            require(all(type(frame[field]) is int for field in ('index', 'offset', 'length')),
                    f'{key}: noninteger frame range')
            require(frame['index'] == expected_index and frame['offset'] == offset,
                    f'{key}: frame ordering, overlap or byte gap at index {expected_index}')
            require(frame['length'] > 0 and offset + frame['length'] <= len(data),
                    f'{key}: invalid byte range at index {expected_index}')
            require(expected_index < len(before['frames']), f'{key}: extra frame in chunks')
            original = read_frame(before, key, expected_index, site_root, manifest_path)
            sliced = data[offset:offset + frame['length']]
            require(sliced == original and digest(sliced) == digest(original),
                    f'{key}: source and chunk slice differ at index {expected_index}')
            records.append({'index': expected_index, 'chunk': number, 'offset': offset,
                            'bytes': len(original), 'sourceSha256': digest(original),
                            'sliceSha256': digest(sliced)})
            offset += frame['length']
            source_bytes += len(original)
            expected_index += 1
        require(offset == len(data), f'{key}: trailing bytes in chunk')
        chunks.append({'url': chunk['url'], 'bytes': len(data), 'sha256': digest(data),
                       'frameCount': len(chunk['frames'])})
    require(expected_index == len(before['frames']), f'{key}: incomplete frame coverage')
    chunk_bytes = sum(chunk['bytes'] for chunk in chunks)
    require(source_bytes == chunk_bytes == after['chunkBytes'] == before['bytes'],
            f'{key}: chunking introduced byte overhead')
    require(after['chunkVersion'] == CHUNK_VERSION, f'{key}: unsupported chunk version')
    return {'frameCount': expected_index, 'chunkCount': len(chunks), 'sourceBytes': source_bytes,
            'chunkBytes': chunk_bytes, 'contentByteOverhead': 0,
            'firstChunkFrameCount': chunks[0]['frameCount'], 'firstChunkBytes': chunks[0]['bytes'],
            'maxChunkBytes': max(chunk['bytes'] for chunk in chunks),
            'preservedOriginalMetadata': True, 'allSlicesEqualOriginalBytes': True,
            'chunks': chunks, 'frames': records}


def transport_metadata(manifest):
    projects = [project for project in manifest['projects'].values() if project.get('chunks')]
    return {'version': CHUNK_VERSION, 'schema': TRANSPORT_SCHEMA,
            'encoding': 'concatenated-original-webp', 'frameIndexBase': 0,
            'projectCount': len(projects),
            'frameCount': sum(len(project['frames']) for project in projects),
            'chunkCount': sum(len(project['chunks']) for project in projects),
            'bytes': sum(project['chunkBytes'] for project in projects),
            'contentByteOverhead': 0}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--site-root', type=Path, default=ROOT)
    parser.add_argument('--manifest', type=Path, help='Input manifest (defaults to site assets/exploded/manifest.json)')
    parser.add_argument('--projects', nargs='+', help='Project keys; omitted means all current projects')
    parser.add_argument('--output-root', type=Path, help='Staging site root for .bin files (defaults to site root)')
    parser.add_argument('--frames-per-chunk', type=int, default=16)
    parser.add_argument('--bootstrap-frames', type=int, default=4,
                        help='First chunk frame limit (also capped by --frames-per-chunk)')
    parser.add_argument('--max-chunk-bytes', type=int, default=256 * 1024)
    destination = parser.add_mutually_exclusive_group()
    destination.add_argument('--output-manifest', type=Path, help='Candidate manifest path')
    destination.add_argument('--write-manifest', action='store_true', help='Replace input manifest after successful verification')
    parser.add_argument('--report', type=Path, default=EVIDENCE / 'chunk-validation.json')
    args = parser.parse_args(argv)
    started = time.perf_counter()
    try:
        site_root = args.site_root.resolve()
        manifest_path = (args.manifest or site_root / 'assets/exploded/manifest.json').resolve()
        output_root = (args.output_root or site_root).resolve()
        output_manifest = (manifest_path if args.write_manifest else
                           (args.output_manifest or EVIDENCE / 'candidate-manifest.json').resolve())
        require(1 <= args.frames_per_chunk <= LOADER_MAX_CHUNK_FRAMES,
                f'--frames-per-chunk must be 1..{LOADER_MAX_CHUNK_FRAMES} for the browser loader')
        require(1 <= args.bootstrap_frames <= LOADER_MAX_CHUNK_FRAMES,
                f'--bootstrap-frames must be 1..{LOADER_MAX_CHUNK_FRAMES} for the browser loader')
        require(1 <= args.max_chunk_bytes <= LOADER_MAX_CHUNK_BYTES,
                f'--max-chunk-bytes must be 1..{LOADER_MAX_CHUNK_BYTES} for the browser loader')
        require(manifest_path.is_relative_to(site_root), 'Input manifest must be within --site-root')
        require(args.write_manifest or output_manifest != manifest_path,
                'Use --write-manifest explicitly to replace the input manifest')
        require(not args.write_manifest or output_root == site_root,
                '--write-manifest requires chunks in the real --site-root')
        original_bytes = manifest_path.read_bytes()
        original = json.loads(original_bytes)
        require(isinstance(original.get('projects'), dict) and original['projects'],
                'Manifest has no projects')
        selected = args.projects or list(original['projects'])
        require(len(selected) == len(set(selected)), 'Duplicate --projects key')
        require(all(key in original['projects'] for key in selected), 'Unknown --projects key')
        candidate = copy.deepcopy(original)
        for key in selected:
            pack_project(key, candidate['projects'][key], site_root, manifest_path,
                         output_root, args.frames_per_chunk, args.max_chunk_bytes, args.bootstrap_frames)
        packed_at = time.perf_counter()
        reports = {}
        # Previously packed projects must also remain valid in a partial update.
        for key, project in candidate['projects'].items():
            if project.get('chunks'):
                chunk_root = output_root if key in selected else site_root
                reports[key] = verify_project(key, original['projects'][key], project,
                                              site_root, manifest_path, chunk_root)
        candidate['chunkTransport'] = transport_metadata(candidate)
        output_bytes = json_bytes(candidate)
        baseline_bytes = copy.deepcopy(original)
        baseline_bytes.pop('chunkTransport', None)
        for project in baseline_bytes['projects'].values():
            for field in TRANSPORT_FIELDS:
                project.pop(field, None)
        baseline_bytes = json_bytes(baseline_bytes)
        source_total = sum(report['sourceBytes'] for report in reports.values())
        frame_count = sum(report['frameCount'] for report in reports.values())
        chunk_count = sum(report['chunkCount'] for report in reports.values())
        report = {'passed': True, 'schema': TRANSPORT_SCHEMA, 'selectedProjects': selected,
                  'sourceManifestSha256': digest(original_bytes),
                  'candidateManifestSha256': digest(output_bytes),
                  'projectCount': len(reports), 'frameCount': frame_count,
                  'individualFrameRequests': frame_count, 'chunkRequests': chunk_count,
                  'requestReductionPercent': round(100 * (1 - chunk_count / frame_count), 4),
                  'sourceFrameBytes': source_total, 'chunkBytes': source_total,
                  'contentByteOverhead': 0, 'framesPerChunkLimit': args.frames_per_chunk,
                  'bootstrapFrameLimit': min(args.bootstrap_frames, args.frames_per_chunk),
                  'chunkByteLimit': args.max_chunk_bytes,
                  'manifest': {'inputBytes': len(original_bytes), 'candidateBytes': len(output_bytes),
                               'inputGzipBytes': len(gzip.compress(original_bytes, mtime=0)),
                               'baselineWithoutChunksBytes': len(baseline_bytes),
                               'baselineGzipBytes': len(gzip.compress(baseline_bytes, mtime=0)),
                               'candidateGzipBytes': len(gzip.compress(output_bytes, mtime=0))},
                  'timingSeconds': {'pack': round(packed_at - started, 4),
                                    'rereadVerification': round(time.perf_counter() - packed_at, 4)},
                  'projects': reports}
        report['manifest']['gzipMetadataOverheadBytes'] = (
            report['manifest']['candidateGzipBytes'] - report['manifest']['baselineGzipBytes'])
        report['transferContentBytes'] = {
            'originalImagesWithGzipManifest': source_total + report['manifest']['baselineGzipBytes'],
            'chunkedImagesWithGzipManifest': source_total + report['manifest']['candidateGzipBytes'],
            'note': 'HTTP header/framing overhead is not included; gzip is a reproducible estimate.'}
        # Do not publish a stale candidate if another render/pack process changed the input.
        require(manifest_path.read_bytes() == original_bytes,
                'Input manifest changed during packing; rerun against final frame assets')
        atomic_write(args.report.resolve(), json_bytes(report))
        atomic_write(output_manifest, output_bytes)
        print(json.dumps({'passed': True, 'projects': len(reports), 'frames': frame_count,
                          'chunks': chunk_count, 'bytes': source_total, 'contentByteOverhead': 0,
                          'requestReductionPercent': report['requestReductionPercent'],
                          'manifest': str(output_manifest), 'report': str(args.report.resolve()),
                          'updatedInputManifest': args.write_manifest}))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f'Chunk packing failed: {error}\n')


if __name__ == '__main__':
    raise SystemExit(main())
