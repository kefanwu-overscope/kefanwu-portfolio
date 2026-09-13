"""CPU-only, lossless material separation for the portfolio cover models.

Uses numpy and the supplied binary STL/GLB geometry. No Blender, GPU, browser,
mesh simplification, pose changes, or writes to models/real. Coordinates remain
in the source export frame. See material-audit-robotics.json for photo evidence.
Run: python robotics_sources.py [telecaster education lineFollower formlabs aura]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STL = Path('C:/Users/oc/Desktop/STL')

# sRGB colors; conversion to linear happens only when writing glTF factors.
MATERIALS = {
    'paint_white': dict(color='E9E8DE', metallic=0, roughness=.30, coat=.30),
    'pickguard_red': dict(color='B71932', metallic=0, roughness=.27, coat=.45),
    'pickguard_white': dict(color='ECEBE5', metallic=0, roughness=.35),
    'maple': dict(color='BC9766', metallic=0, roughness=.46, texture='wood'),
    'fretboard': dict(color='503B32', metallic=0, roughness=.48, texture='wood'),
    'chrome': dict(color='D2D5D7', metallic=1, roughness=.20),
    'steel': dict(color='ABB2BA', metallic=1, roughness=.35),
    'solder': dict(color='BAC1C4', metallic=1, roughness=.34),
    'plastic_black': dict(color='202329', metallic=0, roughness=.48),
    'printed_black': dict(color='292D34', metallic=0, roughness=.56, texture='printed'),
    'printed_white': dict(color='E6E4DD', metallic=0, roughness=.51, texture='printed'),
    'printed_navy': dict(color='28334D', metallic=0, roughness=.51, texture='printed'),
    'pcb_teal': dict(color='17616B', metallic=0, roughness=.46),
    'pcb_green': dict(color='237153', metallic=0, roughness=.47),
    'rubber_orange': dict(color='E78B32', metallic=0, roughness=.62),
    'rubber_black': dict(color='24272B', metallic=0, roughness=.70),
    'battery_wrap': dict(color='D4D7D6', metallic=0, roughness=.38),
    'paint_gray': dict(color='8A9195', metallic=0, roughness=.52),
    'clear_acrylic': dict(color='F1F4F4', metallic=0, roughness=.09, transmission=1, ior=1.49),
    'amber_resin': dict(color='C8A754', metallic=0, roughness=.34, transmission=.38, ior=1.48),
}


def stl_triangles(path):
    data = path.read_bytes()
    count = struct.unpack_from('<I', data, 80)[0]
    if len(data) != 84 + count * 50:
        raise ValueError(f'Not a binary STL: {path}')
    dtype = np.dtype([('normal', '<f4', 3), ('tri', '<f4', (3, 3)), ('attribute', '<u2')])
    return np.ndarray(count, dtype=dtype, buffer=data, offset=84)['tri'].copy()


def connected_labels(triangles):
    """Index components without moving/welding output vertices."""
    points, indices = np.unique(triangles.reshape(-1, 3), axis=0, return_inverse=True)
    faces = indices.reshape(-1, 3)
    parents = list(range(len(points)))

    def find(vertex):
        while parents[vertex] != vertex:
            parents[vertex] = parents[parents[vertex]]
            vertex = parents[vertex]
        return vertex

    for a, b, c in faces:
        parents[find(b)] = find(a)
        parents[find(c)] = find(a)
    roots = np.array([find(i) for i in range(len(points))])
    return roots[faces[:, 0]]


def glb_triangles(path):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length])
    binary_start = 28 + length
    for node in doc['nodes']:
        if 'mesh' in node:
            assert not any(k in node for k in ('matrix', 'translation', 'rotation', 'scale'))

    def accessor(index):
        item = doc['accessors'][index]
        view = doc['bufferViews'][item['bufferView']]
        assert not view.get('byteStride')
        dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[item['componentType']]
        dimensions = 3 if item['type'] == 'VEC3' else 1
        return np.frombuffer(data, dtype=dtype, count=item['count'] * dimensions,
                             offset=binary_start + view.get('byteOffset', 0) + item.get('byteOffset', 0))

    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            vertices = accessor(primitive['attributes']['POSITION']).reshape(-1, 3)
            indices = accessor(primitive['indices']).reshape(-1, 3)
            yield mesh['name'], vertices[indices].copy()


def telecaster_labels(name, triangles):
    count = len(triangles)
    center = triangles.mean(axis=1)
    if '_neck' in name:
        labels = np.full(count, 'chrome', dtype=object)
        parts = connected_labels(triangles)
        for part in np.unique(parts):
            selection = parts == part
            lo = triangles[selection].min(axis=(0, 1))
            hi = triangles[selection].max(axis=(0, 1))
            if hi[1] - lo[1] > 400:
                labels[selection] = 'fretboard' if lo[2] > 60 else 'maple'
        return labels
    if 'body-' not in name:
        return np.full(count, 'paint_white' if 'nut-' in name else 'chrome', dtype=object)

    labels = np.full(count, 'paint_white', dtype=object)
    # Fused body contains the guard, controls, pickups and two separate knobs.
    # Find the guard/control top surfaces at raw Z=64.36, then grow only over
    # their two-millimetre edge bands. Excluding the Z=62.36 body deck prevents
    # flooding into the white finish. The two top polygons were measured from
    # the original STL: 23,106.62 and 3,990.87 square millimetres respectively.
    band = ((triangles[:, :, 2].min(1) >= 62.359) &
            (triangles[:, :, 2].max(1) <= 64.361) & (center[:, 2] > 62.361))
    band_indices = np.where(band)[0]
    parts = connected_labels(triangles[band])
    for part in np.unique(parts):
        indices = band_indices[parts == part]
        pc = center[indices]
        top = np.abs(pc[:, 2] - 64.36) < .002
        if np.any(top & (pc[:, 1] > 330)):
            labels[indices] = 'pickguard_red'
        elif np.any(top & (pc[:, 0] > 257) & (pc[:, 1] < 280)):
            labels[indices] = 'chrome'
    # Existing raised hardware only; these masks add no geometry.
    labels[(center[:, 0] > 257) & (center[:, 0] < 287) &
           (center[:, 1] < 312) & (center[:, 1] > 163) & (center[:, 2] > 64.36)] = 'chrome'
    labels[(center[:, 0] > 257) & (center[:, 0] < 287) &
           (center[:, 1] > 270) & (center[:, 1] < 298) & (center[:, 2] > 68.36)] = 'plastic_black'
    labels[(center[:, 0] > 152) & (center[:, 0] < 214) &
           (center[:, 1] > 390) & (center[:, 1] < 405) & (center[:, 2] > 64.36)] = 'chrome'
    bridge_pickup = ((center[:, 0] > 151) & (center[:, 0] < 216) &
                     (center[:, 1] > 266) & (center[:, 1] < 299) & (center[:, 2] > 62.36))
    labels[bridge_pickup] = 'plastic_black'
    labels[bridge_pickup & (center[:, 2] >= 68.35)] = 'chrome'
    return labels


def education_labels(name, triangles):
    center = triangles.mean(axis=1)
    if 'finger_board' in name:
        # Misnamed CAD file: a 216 x 148 x 3.175 mm pickguard, NOT a fretboard.
        return np.full(len(triangles), 'pickguard_white', dtype=object)
    if 'tele_neck' in name:
        labels = np.full(len(triangles), 'maple', dtype=object)
        labels[(center[:, 1] > 185.62) & (center[:, 2] > 51.17)] = 'fretboard'
        return labels
    if 'body' in name:
        return np.full(len(triangles), 'printed_navy', dtype=object)
    if 'single-coil_neck_pickup' in name:
        # Must precede a generic 'neck' rule: this chrome pickup was wood.
        return np.full(len(triangles), 'chrome', dtype=object)
    if 'bridge_pick_up' in name:
        return np.full(len(triangles), 'plastic_black', dtype=object)
    return np.full(len(triangles), 'chrome', dtype=object)


def line_follower_labels(name, triangles):
    center = triangles.mean(axis=1)
    if 'arduinomega' in name:
        labels = np.full(len(triangles), 'plastic_black', dtype=object)
        # Measured board slab. Headers/ICs remain dielectric black, not teal.
        board = ((center[:, 1] >= 45.72) & (center[:, 1] <= 47.38) & (center[:, 2] >= 8.84))
        labels[board] = 'pcb_teal'
        # USB-B can is separate from the barrel-power jack at X=86..97.
        labels[(center[:, 0] >= 56.7) & (center[:, 0] <= 70.3) &
               (center[:, 2] <= 20) & (center[:, 1] > 47.38)] = 'steel'
        # Two visible electrolytic cans and underside pins/solder relief.
        labels[(center[:, 0] > 58) & (center[:, 0] < 65) &
               (center[:, 2] > 23) & (center[:, 2] < 38) & (center[:, 1] > 48)] = 'solder'
        labels[center[:, 1] < 45.72] = 'solder'
        return labels
    if 'motor_driver' in name:
        labels = np.full(len(triangles), 'plastic_black', dtype=object)
        # The carrier boards are tilted in the assembly. Find the dominant
        # parallel board faces by measured source face area, rather than using
        # an axis-aligned box which would also color components green.
        cross = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        areas = np.linalg.norm(cross, axis=1)
        normal = cross[np.argmax(areas)] / areas.max()
        if normal[0] < 0:
            normal *= -1
        face_normals = cross / np.maximum(areas[:, None], 1e-20)
        aligned = np.abs(face_normals @ normal) > .9999
        distances = center @ normal
        planes, inverse = np.unique(np.round(distances[aligned], 2), return_inverse=True)
        plane_areas = np.bincount(inverse, weights=areas[aligned])
        candidates = planes[np.argsort(plane_areas)[-2:]]
        lo, hi = sorted(candidates)
        assert 1.4 < hi - lo < 1.75, (name, lo, hi)
        labels[(distances >= lo - .025) & (distances <= hi + .025)] = 'pcb_green'
        return labels
    if 'pitch_sensor' in name:
        return np.full(len(triangles), 'plastic_black', dtype=object)
    if 'battery' in name:
        return np.full(len(triangles), 'battery_wrap', dtype=object)
    if 'wheel' in name:
        return np.full(len(triangles), 'rubber_orange', dtype=object)
    if 'dc_motor' in name or 'standoff' in name or 'coupler' in name:
        return np.full(len(triangles), 'steel', dtype=object)
    if 'ball caster-' in name:
        return np.full(len(triangles), 'steel', dtype=object)
    return np.full(len(triangles), 'printed_black', dtype=object)


def smelly_labels(name, triangles):
    if 'base-plate' in name or 'side_frame_2023' in name:
        bucket = 'clear_acrylic'
    elif 'reservior' in name:
        bucket = 'amber_resin'
    elif re.search(r'nema17|stepper.*housing|servo-\d|pinion', name):
        bucket = 'plastic_black'
    elif re.search(r'lead screw|guiding_rod|rod_|coupler|coupling|bearing|idler|pulley|shaft|screw', name):
        bucket = 'steel'
    else:
        bucket = 'printed_white'
    return np.full(len(triangles), bucket, dtype=object)


def aura_labels(bucket, triangles):
    center = triangles.mean(axis=1)
    default = {'mat_steel': 'steel', 'mat_printed': 'paint_gray',
               'mat_dark': 'plastic_black', 'mat_rubber': 'rubber_black'}[bucket]
    labels = np.full(len(triangles), default, dtype=object)
    if bucket == 'mat_dark':
        # Correct the filename rule 'motor' which swallowed steel mount parts.
        for filename in ['Drive_System - Motor_Mount-2.STL',
                         'Drive_System - Motor_Mount_Reinforcement-2.STL']:
            source = stl_triangles(STL / filename)
            lo, hi = source.min((0, 1)) - .01, source.max((0, 1)) + .01
            labels[np.all((center >= lo) & (center <= hi), axis=1)] = 'paint_gray'
        motor = stl_triangles(STL / 'Drive_System - Motor MY1016Z3-4.STL')
        lo, hi = motor.min((0, 1)), motor.max((0, 1))
        inside = np.all((center >= lo - .01) & (center <= hi + .01), axis=1)
        # Silver end covers / black center can: approximate end-zone boundary,
        # photo-supported colors; physical casting boundary needs draft review.
        labels[inside & ((center[:, 1] < lo[1] + 20) | (center[:, 1] > hi[1] - 20))] = 'steel'
    return labels


def linear_color(value):
    srgb = np.array([int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return np.where(srgb <= .04045, srgb / 12.92, ((srgb + .055) / 1.055) ** 2.4).tolist()


def write_glb(path, buckets, sources):
    doc = {'asset': {'version': '2.0', 'generator': 'robotics_sources.py: lossless CPU material split'},
           'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'materials': [],
           'accessors': [], 'bufferViews': [], 'buffers': [], 'extras': {'sources': sources}}
    binary = bytearray()
    extensions = set()

    def access(array, component_type, kind, target, bounds=False):
        while len(binary) % 4:
            binary.append(0)
        view = len(doc['bufferViews'])
        raw = array.tobytes()
        doc['bufferViews'].append(dict(buffer=0, byteOffset=len(binary), byteLength=len(raw), target=target))
        binary.extend(raw)
        entry = dict(bufferView=view, componentType=component_type, count=len(array), type=kind)
        if bounds:
            entry.update(min=array.min(0).astype(float).tolist(), max=array.max(0).astype(float).tolist())
        doc['accessors'].append(entry)
        return len(doc['accessors']) - 1

    report = {}
    for bucket, pieces in sorted(buckets.items()):
        triangles = np.concatenate(pieces)
        assert np.isfinite(triangles).all()
        vertices, indices = np.unique(triangles.reshape(-1, 3), axis=0, return_inverse=True)
        setting = MATERIALS[bucket]
        mat = {'name': 'mat_' + bucket, 'pbrMetallicRoughness': {
            'baseColorFactor': linear_color(setting['color']) + [1],
            'metallicFactor': setting['metallic'], 'roughnessFactor': setting['roughness']}}
        if setting.get('transmission'):
            mat['extensions'] = {'KHR_materials_transmission': {'transmissionFactor': setting['transmission']},
                                 'KHR_materials_ior': {'ior': setting.get('ior', 1.49)}}
            extensions.update(mat['extensions'])
        if setting.get('coat'):
            mat.setdefault('extensions', {})['KHR_materials_clearcoat'] = {
                'clearcoatFactor': setting['coat'], 'clearcoatRoughnessFactor': .23}
            extensions.add('KHR_materials_clearcoat')
        doc['materials'].append(mat)
        primitive = {'attributes': {'POSITION': access(vertices.astype('<f4'), 5126, 'VEC3', 34962, True)},
                     'indices': access(indices.astype('<u4'), 5125, 'SCALAR', 34963),
                     'material': len(doc['materials']) - 1, 'mode': 4}
        index = len(doc['nodes'])
        doc['meshes'].append({'name': 'mat_' + bucket, 'primitives': [primitive]})
        doc['nodes'].append({'name': 'mat_' + bucket, 'mesh': index})
        doc['scenes'][0]['nodes'].append(index)
        report['mat_' + bucket] = {'triangles': len(triangles), 'vertices': len(vertices)}
    while len(binary) % 4:
        binary.append(0)
    doc['buffers'].append({'byteLength': len(binary)})
    if extensions:
        doc['extensionsUsed'] = sorted(extensions)
    encoded = json.dumps(doc, separators=(',', ':')).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    glb = (struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)) +
           struct.pack('<II', len(encoded), 0x4E4F534A) + encoded +
           struct.pack('<II', len(binary), 0x004E4942) + binary)
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(glb)
    # Read back from the actual file and check geometry count/bounds.
    readback = list(glb_triangles(path))
    assert sum(len(t) for _, t in readback) == sum(r['triangles'] for r in report.values())
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(glb).hexdigest(),
            'bytes': len(glb), 'buckets': report, 'materials': {k: MATERIALS[k] for k in sorted(buckets)}}


def build(key):
    buckets, sources = defaultdict(list), []
    source_triangles = 0
    original_lo = np.full(3, np.inf)
    original_hi = np.full(3, -np.inf)

    def add(name, triangles, labels, path):
        nonlocal source_triangles, original_lo, original_hi
        if len(triangles) == 0:
            return
        assert len(triangles) == len(labels)
        source_triangles += len(triangles)
        original_lo = np.minimum(original_lo, triangles.min((0, 1)))
        original_hi = np.maximum(original_hi, triangles.max((0, 1)))
        for bucket in np.unique(labels):
            buckets[bucket].append(triangles[labels == bucket])
        sources.append({'path': str(path), 'part': name, 'triangles': len(triangles),
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

    if key == 'aura':
        path = ROOT / 'models/real/aura.glb'
        for name, triangles in glb_triangles(path):
            add(name, triangles, aura_labels(name, triangles), path)
    else:
        sub, pattern, labeler = {
            'telecaster': ('Telecaster', 'telecaster - *.STL', telecaster_labels),
            'education': ('Guitar Education', 'exploded - *.STL', education_labels),
            'lineFollower': ('Line_Follower', '*.STL', line_follower_labels),
            'formlabs': ('Smelly', '*.STL', smelly_labels),
        }[key]
        for path in sorted((STL / sub).glob(pattern)):
            name = path.name.lower()
            if any(skip in name for skip in ['socket head cap screw', 'socket button head cap screw',
                                             'hex nut style', 'saddle height screws']):
                continue
            if key == 'formlabs':
                if 'nema17' in name and 'housing' not in name:
                    continue
                if any(skip in name for skip in ['m3x25-screw', 'm3x40-screw', 'copper-', 'cable-',
                                                 'connenctor', 'bearing dummy', 'reference cylinder',
                                                 ' core.step', 'core_1.step', 'micro_switch']):
                    continue
            triangles = stl_triangles(path)
            if len(triangles):
                add(path.name, triangles, labeler(name, triangles), path)
    output = HERE / 'sources' / f'{key}.glb'
    report = write_glb(output, buckets, sources)
    readback = list(glb_triangles(output))
    lo = np.min([t.min((0, 1)) for _, t in readback], axis=0)
    hi = np.max([t.max((0, 1)) for _, t in readback], axis=0)
    assert np.array_equal(lo, original_lo) and np.array_equal(hi, original_hi)
    assert source_triangles == sum(len(t) for _, t in readback)
    report.update(sourceTriangles=source_triangles, bounds=[lo.tolist(), hi.tolist()],
                  geometryPolicy='Original included part faces and coordinates retained; material labels only. Common threaded fasteners and motor internals omitted per documented source policy.',
                  sourcePartCount=len(sources), preserveMaterialsSupported=True)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('projects', nargs='*', default=['telecaster', 'education', 'lineFollower', 'formlabs', 'aura'])
    args = parser.parse_args()
    audit_path = HERE / 'material-audit-robotics.json'
    audit = json.loads(audit_path.read_text(encoding='utf-8')) if audit_path.exists() else {}
    audit.setdefault('generatedSources', {})
    for project in args.projects:
        report = build(project)
        if project in audit.get('projects', {}):
            entry = audit['projects'][project]
            entry['sourceGLB'] = report['path']
            entry.setdefault('catalogPatch', {}).update(source=report['path'], preserveMaterials=False,
                                                        materials=report['materials'])
        audit['generatedSources'][project] = report
        audit_path.write_text(json.dumps(audit, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(project, report['sourceTriangles'], 'triangles', report['bytes'], 'bytes', flush=True)
