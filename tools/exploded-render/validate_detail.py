"""Validate the published SD/HD animation and initial-cover contract.

Run with Python 3.10+ and Node.js on PATH (or pass --node). Only the checkout
is required; there is no private evidence, Blender, Git baseline or PNG-master
dependency. Nothing is written unless --report is supplied. Public provenance
is checked for internal consistency, not used as proof of an unseen source CAD.

Binary hashes are exact. For UTF-8 JSON provenance only, recorded hashes may
match LF or CRLF serialization because Git converts line endings on checkout.
Every such match is listed in the report; JSON still must parse successfully.
"""

import argparse
import copy
import json
import math
import re
import shutil
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

import pack_frame_chunks as chunks


ROOT = Path(__file__).resolve().parents[2]
REVISION = 'detail-resolution-20260914'
MODES = {
    'steering': 'steering', 'vineRobot': 'extension', 'javelin': 'flight',
    'brakeSim': 'heat', 'aura': 'assembly', 'scanner': 'gantry',
    'carbonSeat': 'layup', 'seat': 'unfold', 'materialTest': 'tensile',
    'ansysCfd': 'flow', 'pool': 'retract_release', 'lineFollower': 'drive_sway',
    'formlabs': 'gantry', 'telecaster': 'turntable', 'education': 'assembling',
    'ftc': 'reconstruction',
}
LONG_SEQUENCES = {'vineRobot', 'materialTest', 'aura', 'pool'}
COVER_SIZES = [(480, 320), (960, 640), (1800, 1200)]
require = chunks.require
digest = chunks.digest


def close_values(left, right, label, tolerance=2e-6):
    """Compare camera records, including nested matrices, without rounding."""
    if isinstance(left, dict) and isinstance(right, dict):
        require(left.keys() == right.keys(), f'{label}: camera fields differ')
        for key in left:
            close_values(left[key], right[key], f'{label}.{key}', tolerance)
    elif isinstance(left, list) and isinstance(right, list):
        require(len(left) == len(right), f'{label}: camera array sizes differ')
        for index, (a, b) in enumerate(zip(left, right)):
            close_values(a, b, f'{label}[{index}]', tolerance)
    elif type(left) in (int, float) and type(right) in (int, float):
        require(math.isfinite(left) and math.isfinite(right)
                and abs(left - right) <= tolerance, f'{label}: camera value differs')
    else:
        require(left == right, f'{label}: camera value differs')


class PageReferences(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.scripts = []
        self.cards = {}
        self.active_card = None
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'script' and attrs.get('src'):
            self.scripts.append(attrs)
        if tag == 'article' and 'project-card' in attrs.get('class', '').split():
            key = attrs.get('data-project')
            require(key and key not in self.cards, f'Duplicate/missing project card: {key}')
            self.active_card = key
            self.cards[key] = []
        if tag == 'img' and self.active_card is not None:
            self.cards[self.active_card].append(attrs)

    def handle_endtag(self, tag):
        if tag == 'article':
            self.active_card = None


class Validator:
    def __init__(self, site_root=ROOT):
        self.root = Path(site_root).resolve()
        self.line_ending_equivalents = set()

    def path(self, url):
        require(isinstance(url, str) and url == url.strip(), f'Invalid URL: {url!r}')
        parsed = urlsplit(url)
        require(not parsed.scheme and not parsed.netloc and not parsed.fragment,
                f'Expected a local asset URL: {url}')
        relative = unquote(parsed.path, errors='strict')
        require(not relative.startswith('/') and '%' not in relative,
                f'Expected a site-relative asset path: {url}')
        return chunks.bounded_path(self.root, relative)

    def verify_hash(self, data, expected, label, json_text=False, prefix=False):
        size = r'{12,64}' if prefix else r'{64}'
        require(isinstance(expected, str) and re.fullmatch(r'[0-9a-f]' + size, expected),
                f'{label}: malformed SHA-256')
        matches = lambda candidate: digest(candidate).startswith(expected)
        if json_text:
            # Parse before accepting any hash, including an exact byte match.
            json.loads(data.decode('utf-8'))
        if matches(data):
            return
        if json_text:
            lf = data.replace(b'\r\n', b'\n')
            if matches(lf) or matches(lf.replace(b'\n', b'\r\n')):
                self.line_ending_equivalents.add(label)
                return
        raise ValueError(f'{label}: SHA-256 does not match content')

    def asset(self, url, hashed=False):
        path = self.path(url)
        data = path.read_bytes()
        versions = parse_qs(urlsplit(url).query, keep_blank_values=True).get('v', [])
        if hashed or versions:
            require(len(versions) == 1, f'{url}: expected one cache hash')
            self.verify_hash(data, versions[0], url,
                             json_text=path.suffix == '.json', prefix=True)
        return data

    def read(self, url, hashed=False):
        return json.loads(self.asset(url, hashed=hashed).decode('utf-8'))

    def sequence(self, key, record, dimensions, detail=False):
        count = 145 if key in LONG_SEQUENCES else 121
        label = f'{key} {dimensions[0]}px'
        require(record['mode'] == MODES[key], f'{label}: wrong controller mode')
        require((record['width'], record['height']) == dimensions, f'{label}: wrong dimensions')
        require(len(record['frames']) == count and record['poster'] == record['frames'][0],
                f'{label}: wrong frame count or initial poster')
        require(isinstance(record.get('chunks'), list) and record['chunks'], f'{label}: no chunks')
        if detail:
            require(record.get('streaming') is True, f'{label}: detail streaming is disabled')
        chunk_path = chunks.local_asset(record['chunks'][0]['url'], self.root,
                                       self.root / 'assets/exploded/manifest.json', '.bin')
        previous_directory = chunks.CHUNK_DIRECTORY
        chunks.CHUNK_DIRECTORY = chunk_path.parent.parent.relative_to(self.root).as_posix()
        before = {field: value for field, value in record.items() if field not in chunks.TRANSPORT_FIELDS}
        try:
            checked = chunks.verify_project(key, before, record, self.root,
                                            self.root / 'assets/exploded/manifest.json', self.root)
        finally:
            chunks.CHUNK_DIRECTORY = previous_directory
        public = self.read(record['provenance'])
        require(public['project'] == key and public['mode'] == record['mode'],
                f'{label}: provenance project/mode mismatch')
        require((public['width'], public['height'], public['frameCount']) == (*dimensions, count),
                f'{label}: provenance dimensions/count mismatch')
        require(len(public['encodedFrames']) == count, f'{label}: incomplete encoded-frame provenance')
        for index, (encoded, verified) in enumerate(zip(public['encodedFrames'], checked['frames'])):
            require(encoded['file'] == f'{index:02d}.webp'
                    and encoded['bytes'] == verified['bytes']
                    and encoded['sha256'] == verified['sourceSha256'],
                    f'{label}: encoded provenance differs at frame {index}')
        if detail:
            require(public['motionRevision'] == REVISION and public['samples'] == 48,
                    f'{label}: wrong native-render revision/samples')
            require(len(public['sourcePNGFrames']) == count, f'{label}: incomplete PNG provenance')
            for index, png in enumerate(public['sourcePNGFrames']):
                require(png['index'] == index and re.fullmatch(r'[0-9a-f]{64}', png['sha256']),
                        f'{label}: malformed source PNG record {index}')
        return public, {'frames': count, 'chunks': checked['chunkCount'],
                        'bytes': checked['sourceBytes'], 'dimensions': list(dimensions),
                        'allChunkSlicesMatchFrames': True}

    def transport(self, manifest, label):
        actual = chunks.transport_metadata(manifest)
        require(manifest['chunkTransport'] == actual, f'{label}: stale aggregate chunk transport metadata')
        require(actual['projectCount'] == 16 and actual['frameCount'] == 2032,
                f'{label}: expected 16 projects and 2,032 frames')
        return actual

    @staticmethod
    def variant_url(variant):
        return variant['src'] + '?v=' + variant['sha256'][:12]

    def cover(self, key, card, catalog, home, source, hd_source):
        label = key + ' cover'
        require(card['coverProgress'] == 0 and (card['width'], card['height']) == (1800, 1200),
                f'{label}: expected full-resolution initial pose')
        require(card['sourceFrame'] == home['frames'][0], f'{label}: wrong source frame')
        self.verify_hash(self.asset(card['sourceFrame'], hashed=True), card['sourceFrameSha256'], label)
        variants = card['variants']
        require([(v['width'], v['height']) for v in variants] == COVER_SIZES,
                f'{label}: wrong responsive dimensions')
        require(variants == catalog['variants'], f'{label}: editorial catalog variants differ')
        require(card['src'] == self.variant_url(variants[-1]), f'{label}: wrong master URL')
        require(card['srcset'] == ', '.join(f'{self.variant_url(v)} {v["width"]}w' for v in variants),
                f'{label}: wrong responsive URLs')
        require(isinstance(card['alt'], str) and card['alt'].strip(), f'{label}: missing alt text')
        for variant in variants:
            data = self.asset(self.variant_url(variant), hashed=True)
            self.verify_hash(data, variant['sha256'], variant['src'])
            require(len(data) == variant['bytes']
                    and chunks.webp_size(data) == (variant['width'], variant['height']),
                    f'{label}: variant dimensions/bytes differ')
        public = self.read(card['provenance'], hashed=True)
        require(public['project'] == key and public['variants'] == variants,
                f'{label}: public provenance differs')
        for field in ('sourceFrame', 'sourceFrameSha256', 'coverProgress'):
            require(public[field] == card[field], f'{label}: provenance {field} differs')
        require(public['dimensions'] == [1800, 1200] and public['samples'] == 192,
                f'{label}: wrong native master dimensions/samples')
        require(public['sourceFrameCount'] == len(home['frames'])
                and public['sourceDimensions'] == [640, 427]
                and public['sourceAnimationProvenance'] == home['provenance'],
                f'{label}: source animation provenance differs')
        self.verify_hash(self.asset(home['provenance']), public['sourceAnimationProvenanceSha256'],
                         label + ' sourceAnimationProvenanceSha256', json_text=True)
        require(public['cameraFrameMaximumError'] == 0,
                f'{label}: failed initial pose/projection evidence')
        source_motion = copy.deepcopy(source['motion'])
        if public['motionReportUnchanged'] is not True:
            # The published Formlabs cover corrected a descriptive calibration
            # sentence. Only that recorded string may differ, never kinematics.
            differences = public.get('documentaryDifferences', [])
            require(key == 'formlabs' and public.get('motionKinematicsUnchanged') is True
                    and len(differences) == 1 and differences[0]['path'] == 'leadscrew.calibration',
                    f'{label}: unexplained motion report change')
            difference = differences[0]
            require(isinstance(difference['previous'], str) and isinstance(difference['current'], str)
                    and source_motion['leadscrew']['calibration'] == difference['previous']
                    and hd_source['motion']['leadscrew']['calibration'] == difference['current'],
                    f'{label}: documentary change differs from the actual source reports')
            source_motion['leadscrew']['calibration'] = difference['current']
        require(source_motion == hd_source['motion'], f'{label}: source/HD controller reports differ')
        render = catalog['renderProvenance']
        for field, expected in [('firstAnimationFrame', card['sourceFrame']),
                                ('firstAnimationFrameSha256', card['sourceFrameSha256']),
                                ('provenance', card['provenance']), ('coverProgress', 0)]:
            require(render[field] == expected, f'{label}: catalog {field} differs')
        for field, camera_field in [('cameraLocation', 'location'), ('cameraRotation', 'rotation'),
                                    ('cameraOrthoScale', 'orthoScale')]:
            if key != 'education':
                # The renderer captures top-level metadata after its final
                # frame. Tracking or scale changes make that different from
                # p0. Verify the endpoint, then use the actual p0 record.
                close_values(source[field], hd_source[field], label + ' final SD/HD ' + field)
                close_values(source[field], hd_source['timings'][-1]['camera'][camera_field],
                             label + ' recorded final ' + field)
                close_values(hd_source['timings'][0]['camera'][camera_field],
                             public['camera'][camera_field], label + ' actual p0 ' + field)
            else:
                close_values(source[field], public['camera'][camera_field], label + ' SD ' + field)
                close_values(hd_source[field], public['camera'][camera_field], label + ' HD ' + field)
            # Education's compact catalog links the hash-checked public
            # provenance above rather than duplicating its camera fields.
            if key != 'education':
                close_values(render[field], public['camera'][camera_field], label + ' catalog ' + field)
        if key != 'education':
            require(public['sceneSha256BeforeResolutionChange'] == public['sceneSha256AfterResolutionChange'],
                    f'{label}: scene changed while rendering cover')
            require(hd_source['nativeRerender'] is True and hd_source['imageUpscaling'] is False,
                    f'{label}: HD provenance must describe a native render')
            require(hd_source['sourceAnimationProvenance'] == home['provenance'],
                    f'{label}: HD refers to a different SD source')
            poses = hd_source['timings']
            require(len(poses) == len(home['frames']), f'{label}: incomplete camera/pose provenance')
            for index, pose in enumerate(poses):
                require(pose['index'] == index and pose['cameraProjectionMaximumError'] == 0,
                        f'{label}: HD projection changed at {index}')
                require(pose['sha256'] == hd_source['sourcePNGFrames'][index]['sha256'],
                        f'{label}: rendered PNG hash differs at {index}')
            p0 = poses[0]
            require(p0['p0CoverCameraMaximumError'] == 0
                    and p0['geometryMaterialsLightsMatchApprovedCover'] is True
                    and p0['currentP0SceneSha256'] == p0['approvedP0SceneSha256']
                    == public['sceneSha256BeforeResolutionChange'],
                    f'{label}: HD p0 scene differs from approved cover')
            close_values(p0['camera'], public['camera'], label + ' complete p0 camera')
        return public

    def education(self, sd, hd, cover):
        require(len(hd['sourcePNGFrames']) == len(sd['sourceMasterPNGs']) == 121,
                'Education: incomplete shared PNG provenance')
        require([p['file'] for p in sd['sourceMasterPNGs']] == [f'{i:02d}.png' for i in range(121)],
                'Education: noncanonical master PNG ordering')
        require([p['sha256'] for p in hd['sourcePNGFrames']] == [p['sha256'] for p in sd['sourceMasterPNGs']],
                'Education: SD and HD do not share all 121 source PNGs')
        require(cover['sourceHDFramePNGSha256'] == hd['sourcePNGFrames'][0]['sha256'],
                'Education: cover does not refer to the shared initial master')
        left, right = sd['sourcePreservation'], hd['sourcePreservation']
        require(cover['studio'] == left['studio'] == right['studio']
                and cover['studio']['variant'] == 'aligned-sweep', 'Education: studio backgrounds differ')
        require(sd['motion'] == hd['motion'] and len(sd['motion']['stages']) == 23,
                'Education: assembly path differs')
        require(cover['geometryAndMaterialsSha256'] == left['sourceGeometryAndMaterials']['sha256']
                == right['sourceGeometryAndMaterials']['sha256'], 'Education: source geometry/material digest differs')
        require(sd['cameraFrameMaximumError'] == hd['cameraFrameMaximumError'] == 0,
                'Education: camera projection changed')
        require(cover['sourceGeometryAndMaterialsUnchanged'] is True and cover['stageCount'] == 23,
                'Education: invalid cover preservation evidence')
        for evidence in (left, right):
            require(evidence['status'] == 'passed' and evidence['stageCount'] == 23
                    and evidence['sourceGeometryAndMaterialsUnchanged'] is True
                    and evidence['sourceCameraUnchanged'] is True
                    and evidence['motionReportUnchanged'] is True
                    and evidence['sourcePoseMaximumMatrixError'] == 0
                    and evidence['seekMaximumMatrixError'] == 0,
                    'Education: failed source/seek preservation evidence')
            original_bytes = self.asset(evidence['originalAnimationProvenance'])
            self.verify_hash(original_bytes, evidence['originalAnimationProvenanceSha256'],
                             'Education originalAnimationProvenanceSha256', json_text=True)
            original = json.loads(original_bytes)
            require(original['motion'] == sd['motion'], 'Education: original 23-stage path differs')
            for field in ('cameraLocation', 'cameraRotation', 'cameraOrthoScale'):
                close_values(original[field], sd[field], 'Education original ' + field, tolerance=0)

    def pages(self, covers, node):
        home = PageReferences((self.root / 'index.html').read_text(encoding='utf-8'))
        detail = PageReferences((self.root / 'case-study.html').read_text(encoding='utf-8'))
        require(home.cards.keys() == covers.keys(), 'Homepage project-card keys differ from cover catalog')
        for key, card in covers.items():
            require(len(home.cards[key]) == 1, f'{key}: expected one homepage cover image')
            image = home.cards[key][0]
            require(image['src'] == self.variant_url(card['variants'][1])
                    and image['srcset'] == card['srcset'], f'{key}: homepage cover URLs differ')
            require((image['width'], image['height']) == ('1800', '1200')
                    and image['alt'] == card['alt'], f'{key}: homepage cover dimensions/alt differ')
        for page, manifest, scripts in [
                (home, 'manifest.json', ['exploded.js']),
                (detail, 'manifest-detail.json', ['exploded.js', 'case-study-data.js', 'case-study.js'])]:
            for script in scripts:
                matches = [s for s in page.scripts if urlsplit(s['src']).path == script]
                require(len(matches) == 1 and matches[0]['src'] == f'{script}?v={REVISION}',
                        f'{script}: missing/duplicate/stale page script URL')
                if script == 'exploded.js':
                    require(matches[0].get('data-manifest') == f'assets/exploded/{manifest}?v={REVISION}',
                            f'{script}: wrong {manifest} selection/cache version')
        case_js = (self.root / 'case-study.js').read_text(encoding='utf-8')
        catalog_urls = re.findall(r'assets/editorial/animation-covers[^\s\x22\x27`]*', case_js)
        require(catalog_urls == [f'assets/editorial/animation-covers.json?v={REVISION}'],
                'Detail page: wrong runtime cover catalog/cache version')
        script = ("const fs=require('fs'),vm=require('vm');const c={window:{}};"
                  "vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),c,{timeout:5000});"
                  "process.stdout.write(JSON.stringify(c.window.caseStudyData));")
        fallback = json.loads(subprocess.check_output(
            [node, '-e', script, str(self.root / 'case-study-data.js')], text=True, encoding='utf-8'))
        require(fallback.keys() == covers.keys(), 'Case-study fallback project keys differ')
        for key, card in covers.items():
            for field in ('src', 'srcset', 'alt', 'width', 'height'):
                require(fallback[key]['cover'][field] == card[field], f'{key}: fallback cover {field} differs')
        for name in ('exploded.js', 'case-study.js', 'case-study-data.js'):
            subprocess.run([node, '--check', str(self.root / name)], check=True, capture_output=True)

    def run(self, node):
        home = self.read('assets/exploded/manifest.json')
        detail = self.read('assets/exploded/manifest-detail.json')
        covers = self.read('assets/editorial/animation-covers.json')
        catalog_rows = self.read('tools/editorial-render/catalog-manifest.json')
        catalog = {row['project']: row for row in catalog_rows}
        require(len(catalog_rows) == len(catalog), 'Duplicate editorial catalog project')
        for label, manifest in [('home', home), ('detail', detail), ('covers', covers)]:
            require(manifest['version'] == 1 and manifest['projects'].keys() == MODES.keys(),
                    f'{label}: expected the sixteen project keys in schema version 1')
        require(catalog.keys() == MODES.keys(), 'Editorial catalog project keys differ')
        require(detail['revision'] == covers['revision'] == REVISION, 'Incorrect detail/cover release revision')
        records = {}
        for key in MODES:
            sd, sd_check = self.sequence(key, home['projects'][key], (640, 427))
            hd, hd_check = self.sequence(key, detail['projects'][key], (1280, 854), detail=True)
            cover = self.cover(key, covers['projects'][key], catalog[key], home['projects'][key], sd, hd)
            if key == 'education':
                self.education(sd, hd, cover)
            records[key] = {'home': sd_check, 'detail': hd_check, 'coverVariants': 3}
        home_transport = self.transport(home, 'home')
        detail_transport = self.transport(detail, 'detail')
        self.pages(covers['projects'], node)
        return {'status': 'passed', 'passed': True, 'revision': REVISION,
                'projectCount': len(records), 'homeFrames': home_transport['frameCount'],
                'detailFrames': detail_transport['frameCount'], 'coverVariants': 48,
                'homeTransport': home_transport, 'detailTransport': detail_transport,
                'educationSharedSourcePNGs': 121, 'educationAssemblyStages': 23,
                'allBinaryCacheHashesAndChunkSlicesMatch': True,
                'allCoverPoseCameraAndPageReferencesMatch': True,
                'jsonLineEndingEquivalentHashes': sorted(self.line_ending_equivalents),
                'scope': 'Current checkout assets and public provenance; historical CAD/media preservation is a separate release check.',
                'projects': records}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--site-root', type=Path, default=ROOT)
    parser.add_argument('--node', default=shutil.which('node'), help='Node.js executable (default: PATH)')
    parser.add_argument('--report', type=Path, help='Optional JSON report; default is stdout only')
    args = parser.parse_args(argv)
    try:
        require(args.node, 'Node.js was not found; install it or pass --node PATH')
        report = Validator(args.site_root).run(args.node)
    except (OSError, ValueError, KeyError, TypeError, IndexError, subprocess.SubprocessError) as error:
        report = {'status': 'failed', 'passed': False, 'error': str(error)}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
