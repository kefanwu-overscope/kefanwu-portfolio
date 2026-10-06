"""Build the DR Mk.8 rotor from its verified STEP tessellation, without editing CAD.

Run with Blender --background --python tools/brake-dr/build_studio_motion.py.
The retained warming controller is a visual illustration, not a thermal field.
"""
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
EVIDENCE = ROOT.parent / '.codex/brake-dr-20261005'
SOURCE = HERE / 'source/rotor-geometry.npz'
STEP_SHA = '358fcb7bae7686556526e9ffc241932f02924fac6bca8c15c7f3db527f1034a3'
sys.path.insert(0, str(ROOT / 'tools/exploded-render'))
sys.path.insert(0, str(ROOT / 'tools/studio-export'))
from material_processes import BrakeHeating


def render(key):
    assert key == 'brakeSim'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    data = np.load(SOURCE)
    vertices = data['positions_mm'].astype(np.float64)
    faces = data['indices'].reshape(-1, 3)
    assert len(faces) == 56404
    size = vertices.max(0) - vertices.min(0)
    assert abs(size[0] - 5.08) < .001 and abs(size[1] - 190.5) < .001
    center = (vertices.max(0) + vertices.min(0)) / 2
    vertices = (vertices - center) * (2.8 / max(size))
    # Rotate within the unchanged plate plane to the DR's front-view orientation.
    angle = math.radians(30)
    yz = vertices[:, 1:].copy()
    vertices[:, 1] = math.cos(angle) * yz[:, 0] - math.sin(angle) * yz[:, 1]
    vertices[:, 2] = math.sin(angle) * yz[:, 0] + math.cos(angle) * yz[:, 1]
    vertices[:, 2] -= vertices[:, 2].min() - .025
    mesh = bpy.data.meshes.new('DR Mk.8 rotor — original STEP tessellation')
    mesh.from_pydata(vertices.tolist(), [], faces.tolist()); mesh.update()
    mesh.set_sharp_from_angle(angle=math.radians(35))
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    rotor = bpy.data.objects.new('mat_steel', mesh)
    scene.collection.objects.link(rotor)
    material = bpy.data.materials.new('ASTM A48 Class 40 cast iron — DR display')
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    color = (.28, .30, .32, 1)
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Metallic'].default_value = .92
    shader.inputs['Roughness'].default_value = .42
    material.diffuse_color = color
    mesh.materials.append(material)
    camera_data = bpy.data.cameras.new('Source-compatible camera')
    camera = bpy.data.objects.new('Source-compatible camera', camera_data)
    scene.collection.objects.link(camera); scene.camera = camera
    camera.location = (11.0204124451, -3.1486892700, 4.9669761658)
    target = Vector((0, 0, (vertices[:, 2].max() + vertices[:, 2].min()) / 2))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'; camera_data.ortho_scale = 4.944589138
    camera_data.sensor_fit = 'HORIZONTAL'
    scene.render.resolution_x = 1280; scene.render.resolution_y = 854
    motion = BrakeHeating([rotor], scene)
    motion.report.update(
        sourceGeometry='DR Mk.8 scalloped 72-hole rotor; R5.08 / 0.200-inch CAD display',
        sourceStepSha256=STEP_SHA, nominalDiameterMm=190.5, thicknessMm=5.08,
        throughHoles=72, holeDiameterMm=10.16, outerWaves=24, mountingSeats=6,
        studyScope='DR-reported thermal/design outcomes are preserved separately; the historical temperature study used 4.7498 mm thickness.',
        geometryPolicy='Source triangles preserved; only unit conversion, rigid orientation and display normalization applied.',
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(EVIDENCE / 'geometry/dr-rotor-display.blend'))
    return motion, [{'object': rotor, 'group': 'mat_steel'}], [rotor], None


spec = importlib.util.spec_from_file_location('studio_export', ROOT / 'tools/studio-export/export_studio_motion.py')
exporter = importlib.util.module_from_spec(spec); spec.loader.exec_module(exporter)
exporter.EVIDENCE = EVIDENCE / 'source-export'
folder = exporter.EVIDENCE / 'package'
manifest = exporter.export('brakeSim', {'render': render}, 121, output_folder=folder)
manifest['source']['pipeline'] = 'tools/brake-dr/build_studio_motion.py'
manifest['source']['sourceContractSha256'] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
manifest['source']['review'] = {'date': '2026-10-05', 'slides': [27, 32, 33, 34],
    'presentationId': '1orhUsJPe5ssAuhbjYn1FMEqdGCs8-4Xmxa8L9I7TWK0'}
(folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
audit_path = exporter.EVIDENCE / 'brakeSim-audit.json'
audit = json.loads(audit_path.read_text(encoding='utf-8'))
audit['sourceInputs'] = {'tools/brake-dr/source/rotor-geometry.npz': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'STEP': STEP_SHA}
audit['sourcePipeline'] = 'tools/brake-dr/build_studio_motion.py'
audit['manifestSha256'] = hashlib.sha256((folder / 'manifest.json').read_bytes()).hexdigest()
audit_path.write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')
