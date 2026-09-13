"""Build cover-only mechanical sources on the CPU; never alter models/real.

Run with Blender's bundled Python (numpy/trimesh installed), not Blender's
renderer. Javelin retains the supplied CAD surfaces with corrected material
groups and explicitly reconstructed propellers. Material-test reconstruction
is owned by the separate material-test/build_material_test.py task.
"""
import argparse
import ast
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STL = Path('C:/Users/oc/Desktop/STL')
OUT = HERE / 'sources'
PALETTE = {
    'aero': ('242629', 0, .58),
    'printed': ('292C30', 0, .58),
    'dark': ('222528', 0, .54),
    'steel': ('B7BDC1', 1, .32),
    'motor_black': ('171B1F', .65, .36),
    'motor_silver': ('C4C9CE', 1, .3),
    'propeller': ('1D2023', 0, .52),
    'column': ('DFDED5', 0, .5),
    'base': ('626461', 0, .63),
    'bellows': ('191B1A', 0, .7),
    'grips': ('B4B4AA', 1, .42),
    'stop_red': ('C84846', 0, .46),
    'stop_yellow': ('E2CB32', 0, .48),
    'fabric': ('282A2D', 0, .58),
}


def pbr(bucket):
    color, metal, rough = PALETTE[bucket]
    rgb = np.array([int(color[i:i+2], 16)/255 for i in (0, 2, 4)])
    linear = np.where(rgb <= .04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)
    return PBRMaterial(name=bucket, baseColorFactor=np.r_[linear, 1.0],
                       metallicFactor=metal, roughnessFactor=rough, doubleSided=True)


def add(bucket, mesh, groups):
    groups.setdefault(bucket, []).append(mesh)


def cylinder_between(start, end, radius, sections=40):
    return trimesh.creation.cylinder(radius=radius, segment=np.array([start, end]), sections=sections)


def box(center, size):
    mesh = trimesh.creation.box(extents=size)
    mesh.apply_translation(center)
    return mesh


def blade(center, angle, handedness):
    """Display-only 5.2-inch two-blade prop half; approximate chord/twist.

    No aerodynamic performance or exact APC section is claimed. Root-to-tip
    chord and sweep visually follow the supplied build photos. X is shaft axis.
    """
    radii = [5.5, 10, 20, 35, 50, 61, 65.4, 66.04]
    chords = [10, 13, 15, 14, 10, 5.5, 2.2, .2]
    sweep = [0, 0, .7, 2.3, 3.8, 4.4, 4.5, 4.5]
    points, faces = [], []
    radial = np.array([0, math.cos(angle), math.sin(angle)])
    tangent = np.array([0, -math.sin(angle), math.cos(angle)])
    count = 16
    for i, (r, chord) in enumerate(zip(radii, chords)):
        pitch = handedness * math.radians(27 - 17*r/66.04)
        thickness = max(.18, 1.9*(1-r/80))
        for j in range(count):
            t = 2*math.pi*j/count
            c, h = .5*chord*math.cos(t), .5*thickness*math.sin(t)
            axial = c*math.sin(pitch) + h*math.cos(pitch)
            lateral = c*math.cos(pitch) - h*math.sin(pitch)
            points.append(center + r*radial + (lateral+handedness*sweep[i])*tangent + [axial, 0, 0])
    for i in range(len(radii)-1):
        for j in range(count):
            a, b = i*count+j, i*count+(j+1)%count
            faces.extend([[a, b, b+count], [a, b+count, a+count]])
    for j in range(1, count-1):
        faces.append([0, j+1, j])
        a = (len(radii)-1)*count
        faces.append([a, a+j, a+j+1])
    mesh = trimesh.Trimesh(vertices=points, faces=faces, process=True)
    mesh.fix_normals()
    return mesh


def javelin():
    groups, inputs, additions = {}, [], []
    tree = ast.parse((ROOT/'tools/stl2glb.py').read_text(encoding='utf-8'))
    skips = next(ast.literal_eval(n.value) for n in tree.body
                 if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name)
                 and n.targets[0].id == 'SKIP')
    motor_rank = 0
    source_faces = 0
    for path in sorted(STL.glob('Javelin_V1 - *.STL')):
        name = path.name.lower()
        if any(word in name for word in skips):
            continue
        mesh = trimesh.load(path, force='mesh')
        inputs.append({'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        source_faces += len(mesh.faces)
        if 't motor f90' in name:
            lo, hi = mesh.bounds
            center = (lo+hi)/2
            face = mesh.triangles_center
            radius = np.linalg.norm(face[:, 1:]-center[1:], axis=1)
            # Original motor is one connected shell. Appearance masks preserve
            # every CAD triangle. Front shaft and narrow exposed bell lip only;
            # no invented winding geometry is added to this simplified motor.
            silver = (face[:, 0] < lo[0]+15.1) | ((face[:, 0] < lo[0]+18.6) & (radius > 15.6))
            for bucket, mask in [('motor_silver', silver), ('motor_black', ~silver)]:
                add(bucket, mesh.submesh([np.flatnonzero(mask)], append=True), groups)
            prop_center = np.array([lo[0]+11.4, center[1], center[2]])
            phase = math.radians(35 if motor_rank % 2 else -35)
            handed = 1 if motor_rank in (0, 2) else -1
            for angle in [phase, phase+math.pi]:
                add('propeller', blade(prop_center, angle, handed), groups)
            # Annular hub leaves the original 5 mm shaft intact.
            hub = trimesh.creation.annulus(r_min=2.55, r_max=7.2, height=5.2, sections=48)
            hub.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 1, 0]))
            hub.apply_translation(prop_center)
            add('propeller', hub, groups)
            # Display reconstruction of visible silver hex prop nut, with bore.
            nut = trimesh.creation.annulus(r_min=2.55, r_max=4.8, height=4.8, sections=6)
            nut.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 1, 0]))
            nut.apply_translation(prop_center+[-5, 0, 0])
            add('motor_silver', nut, groups)
            additions.append({'motor': path.name, 'propCenterCAD': prop_center.tolist(),
                              'nominalDiameterMm': 132.08, 'bladeCount': 2,
                              'kind': 'photo-informed display propeller and nut; not original APC CAD'})
            motor_rank += 1
        elif any(word in name for word in ('nosecone', 'tailcone', 'naca0008_wing')):
            add('aero', mesh, groups)
        elif 'battery_base' in name or 'battery_retainer' in name:
            add('printed', mesh, groups)
        elif 'pitot' in name:
            add('steel', mesh, groups)
        else:
            add('dark', mesh, groups)
    assert motor_rank == 4
    return groups, {'sourceCADTrianglesPreserved': source_faces, 'inputs': inputs,
                    'additions': additions, 'geometryPolicy': 'Original Javelin STL assembly, material regrouping and face masks only, plus four explicitly reconstructed display propellers/nuts. No CAD triangle simplification. Motor copper windings are not modeled by the supplied simplified part and were not invented.'}


def export(key, groups, provenance):
    scene = trimesh.Scene()
    for bucket, meshes in groups.items():
        mesh = trimesh.util.concatenate(meshes)
        mesh.visual = TextureVisuals(material=pbr(bucket))
        scene.add_geometry(mesh, node_name='mat_'+bucket, geom_name='mat_'+bucket)
    OUT.mkdir(exist_ok=True)
    target = OUT/(key+'.glb')
    scene.export(target)
    # Validate geometry serialization and the embedded PBR without a renderer.
    loaded = trimesh.load(target, force='scene')
    assert len(loaded.geometry) == len(groups)
    assert all(np.isfinite(m.vertices).all() and len(m.faces) for m in loaded.geometry.values())
    provenance.update({'generatedBy': 'tools/editorial-render/mechanical_sources.py',
                       'source': str(target.relative_to(ROOT)).replace('\\','/'),
                       'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                       'triangles': sum(len(m.faces) for m in loaded.geometry.values()),
                       'preserveMaterials': True, 'axes': 'Y up, original CAD coordinates retained for Javelin',
                       'gpuRenderPerformed': False,
                       'catalogMaterials': {name: {'color': PALETTE[name][0], 'metallic': PALETTE[name][1], 'roughness': PALETTE[name][2]} for name in groups}})
    (OUT/(key+'.json')).write_text(json.dumps(provenance, indent=2)+'\n', encoding='utf-8')
    print(key, target, provenance['triangles'], 'triangles', 'PBR preserved')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('projects', nargs='*', default=['javelin'])
    args = parser.parse_args()
    builders = {'javelin': javelin}
    for key in args.projects:
        groups, provenance = builders[key]()
        export(key, groups, provenance)
