"""Deterministic, qualitative material-process scenes for project previews.

The supplied brake stays intact. Carbon cloth is draped onto an unobstructed
surface of the supplied shell; this does not infer a manufacturing ply schedule.
Public entry point: build_process(key, objects, scene). Controllers expose
apply(progress), objects, report and mode, and support arbitrary seeking.
"""
import math

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _clamp(value):
    return max(0.0, min(1.0, float(value)))


def _smooth(value):
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def _world_geometry(objects):
    points, faces = [], []
    for obj in objects:
        if obj.type != 'MESH':
            continue
        offset = len(points)
        points.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
        faces.extend(tuple(offset + i for i in polygon.vertices) for polygon in obj.data.polygons)
    return points, faces


class BrakeHeating:
    mode = 'heat'

    def __init__(self, objects, scene):
        self.objects = [obj for obj in objects if obj.type == 'MESH']
        self.controls = []
        self.lights = [(obj.data, obj.data.energy) for obj in scene.objects if obj.type == 'LIGHT']
        points, faces = _world_geometry(self.objects)
        coords = np.asarray([tuple(point) for point in points])
        center = (coords.min(0) + coords.max(0)) * .5
        radius = max(np.linalg.norm((coords - center)[:, 1:], axis=1))
        for obj in self.objects:
            # A point attribute shades the friction rim more strongly without
            # moving, cutting, duplicating or replacing any supplied triangle.
            attr = obj.data.attributes.get('Qualitative heat exposure')
            if attr is None:
                attr = obj.data.attributes.new('Qualitative heat exposure', 'FLOAT', 'POINT')
            weights = []
            for vertex in obj.data.vertices:
                position = obj.matrix_world @ vertex.co
                radial = math.hypot(position.y - center[1], position.z - center[2]) / radius
                weights.append(.32 + .68 * float(_smooth((radial - .32) / .55)))
            attr.data.foreach_set('value', weights)
            for slot in obj.material_slots:
                original = slot.material
                material = original.copy() if original else bpy.data.materials.new('Intact heated brake')
                material.name = 'Qualitative warming metal — ' + (original.name if original else obj.name)
                material.use_nodes = True
                slot.material = material
                nodes, links = material.node_tree.nodes, material.node_tree.links
                shader = nodes.get('Principled BSDF')
                if shader is None:
                    continue
                cold = tuple(shader.inputs['Base Color'].default_value)
                exposure = nodes.new('ShaderNodeAttribute')
                exposure.attribute_name = attr.name
                warm = nodes.new('ShaderNodeValue')
                warm.name = 'Qualitative warming fraction, not temperature'
                mix_amount = nodes.new('ShaderNodeMath')
                mix_amount.operation = 'MULTIPLY'
                links.new(exposure.outputs['Fac'], mix_amount.inputs[0])
                links.new(warm.outputs[0], mix_amount.inputs[1])
                color = nodes.new('ShaderNodeMixRGB')
                color.blend_type = 'MIX'
                color.inputs[1].default_value = cold
                color.inputs[2].default_value = (.12, .001, .0005, 1)
                links.new(mix_amount.outputs[0], color.inputs[0])
                links.new(color.outputs[0], shader.inputs['Base Color'])
                emission = nodes.new('ShaderNodeValue')
                emission.name = 'Qualitative incandescence'
                emission_amount = nodes.new('ShaderNodeMath')
                emission_amount.operation = 'MULTIPLY'
                links.new(exposure.outputs['Fac'], emission_amount.inputs[0])
                links.new(emission.outputs[0], emission_amount.inputs[1])
                links.new(emission_amount.outputs[0], shader.inputs['Emission Strength'])
                shader.inputs['Emission Color'].default_value = (.70, .001, .00015, 1)
                self.controls.append((warm, emission))
        self.report = {
            'process': 'intact metal gradually warming to a red glow',
            'mode': self.mode,
            'geometryPolicy': 'All supplied brake vertices, polygons and object transforms remain unchanged.',
            'sourceVertexCount': len(points),
            'sourceFaceCount': len(faces),
            'heatingPolicy': 'Qualitative visual warming and incandescence only; no temperatures, thermal field, time scale or simulation values are asserted.',
            'layerCount': None,
            'recommendedFrameCount': 25,
        }
        self.apply(0)

    def apply(self, progress):
        progress = _clamp(progress)
        warming = float(_smooth(progress))
        for warm, emission in self.controls:
            warm.outputs[0].default_value = warming
            emission.outputs[0].default_value = 1.10 * progress ** 2.25
        for light, energy in self.lights:
            light.energy = energy * (1.0 - .73 * warming)


def _carbon_cloth_material():
    material = bpy.data.materials.new('Visible woven carbon cloth — illustrative plies')
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Metallic'].default_value = 0.0
    shader.inputs['Roughness'].default_value = .57
    shader.inputs['Specular IOR Level'].default_value = .18
    shader.inputs['Coat Weight'].default_value = 0
    shader.inputs['Anisotropic'].default_value = .45
    uv = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Rotation'].default_value[2] = .12
    links.new(uv.outputs['UV'], mapping.inputs['Vector'])
    separate = nodes.new('ShaderNodeSeparateXYZ')
    links.new(mapping.outputs['Vector'], separate.inputs[0])

    def math_node(operation, first, second=None):
        node = nodes.new('ShaderNodeMath')
        node.operation = operation
        if isinstance(first, (int, float)):
            node.inputs[0].default_value = first
        else:
            links.new(first, node.inputs[0])
        if second is not None:
            if isinstance(second, (int, float)):
                node.inputs[1].default_value = second
            else:
                links.new(second, node.inputs[1])
        return node.outputs[0]

    # Two-over/two-under twill: rounded yarn bundles and alternating fiber
    # direction, rather than a checkerboard standing in for woven carbon.
    cell_x = math_node('MULTIPLY', separate.outputs['X'], 62)
    cell_y = math_node('MULTIPLY', separate.outputs['Y'], 62)
    diagonal = math_node('ADD', math_node('FLOOR', cell_x), math_node('FLOOR', cell_y))
    weave = math_node('LESS_THAN', math_node('MODULO', diagonal, 4), 2)
    yarn_x = math_node('SINE', math_node('MULTIPLY', math_node('FRACT', cell_x), math.pi))
    yarn_y = math_node('SINE', math_node('MULTIPLY', math_node('FRACT', cell_y), math.pi))
    bundle = nodes.new('ShaderNodeMixRGB')
    links.new(weave, bundle.inputs[0])
    links.new(yarn_x, bundle.inputs[1])
    links.new(yarn_y, bundle.inputs[2])
    yarn_color = nodes.new('ShaderNodeMixRGB')
    links.new(bundle.outputs[0], yarn_color.inputs[0])
    yarn_color.inputs[1].default_value = (.004, .0055, .008, 1)
    yarn_color.inputs[2].default_value = (.016, .020, .025, 1)
    waves = []
    for axis in ('X', 'Y'):
        wave = nodes.new('ShaderNodeTexWave')
        wave.wave_type = 'BANDS'
        wave.bands_direction = axis
        wave.wave_profile = 'SIN'
        wave.inputs['Scale'].default_value = 210
        wave.inputs['Distortion'].default_value = 0
        links.new(mapping.outputs['Vector'], wave.inputs['Vector'])
        waves.append(wave)
    fibers = nodes.new('ShaderNodeMixRGB')
    links.new(weave, fibers.inputs[0])
    links.new(waves[0].outputs['Fac'], fibers.inputs[1])
    links.new(waves[1].outputs['Fac'], fibers.inputs[2])
    color = nodes.new('ShaderNodeMixRGB')
    color.blend_type = 'MULTIPLY'
    color.inputs[0].default_value = .19
    links.new(yarn_color.outputs[0], color.inputs[1])
    links.new(fibers.outputs['Color'], color.inputs[2])
    links.new(color.outputs[0], shader.inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .28
    bump.inputs['Distance'].default_value = .006
    bump_height = nodes.new('ShaderNodeMixRGB')
    bump_height.blend_type = 'MULTIPLY'
    bump_height.inputs[0].default_value = .16
    links.new(bundle.outputs[0], bump_height.inputs[1])
    links.new(fibers.outputs[0], bump_height.inputs[2])
    links.new(bump_height.outputs[0], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    orientation = nodes.new('ShaderNodeMath')
    orientation.operation = 'MULTIPLY'
    orientation.inputs[1].default_value = .25
    links.new(weave, orientation.inputs[0])
    links.new(orientation.outputs[0], shader.inputs['Anisotropic Rotation'])
    return material


def _unobstructed_skin(objects, pull):
    """Keep original front skin triangles with a clear, common layup direction.

    Every retained triangle is an actual supplied triangle, not a slice through
    the shell. Original surface positions and boundary openings are preserved.
    Visibility checks exclude the reverse skin and overhung geometry.
    """
    points, polygons = _world_geometry(objects)
    triangles = []
    for polygon in polygons:
        triangles.extend((polygon[0], polygon[i], polygon[i + 1]) for i in range(1, len(polygon) - 1))
    source_bvh = BVHTree.FromPolygons(points, triangles, all_triangles=True, epsilon=0)
    kept = []
    tolerance = .00045
    for tri in triangles:
        a, b, c = (points[index] for index in tri)
        normal = (b - a).cross(c - a)
        if normal.length < 1e-10 or normal.normalized().dot(pull) < .025:
            continue
        center = (a + b + c) / 3
        samples = [center] + [point.lerp(center, .03) for point in (a, b, c)]
        samples.extend(((a + b) * .5).lerp(center, .03) for a, b in ((a, b), (b, c), (c, a)))
        for point in samples:
            hit, _, _, distance = source_bvh.ray_cast(point + pull * 8, -pull, 9)
            if hit is None or abs(distance - 8) > tolerance:
                break
        else:
            kept.append(tri)
    used = sorted({index for triangle in kept for index in triangle})
    remap = {old: index for index, old in enumerate(used)}
    coords = np.asarray([tuple(points[index]) for index in used], dtype=np.float64)
    faces = [tuple(remap[index] for index in triangle) for triangle in kept]
    if len(faces) < 100:
        raise ValueError('Unable to derive a usable unobstructed carbon-shell surface')
    return coords, faces, source_bvh, len(triangles)


class CarbonLayup:
    mode = 'layup'
    layer_count = 10

    def __init__(self, objects, scene):
        self.originals = [obj for obj in objects if obj.type == 'MESH']
        self.pull = Vector((0, -1, .6)).normalized()
        self.up = Vector((1, 0, 0)).cross(self.pull).normalized()
        self.base, self.faces, self.source_bvh, source_faces = _unobstructed_skin(self.originals, self.pull)
        self.direction = np.asarray(tuple(self.pull))
        self.depth = self.base @ self.direction
        height = self.base @ np.asarray(tuple(self.up))
        self.along = (height - height.min()) / (height.max() - height.min())
        self.lift = self.depth.max() - self.depth + .58
        # Display-only spacing makes layer edges legible. These are not claimed
        # measured ply thicknesses or a manufacturing laminate specification.
        self.clearance = .046
        self.pitch = .006
        # Near a trimmed lip, an original skin triangle may be only partially
        # occluded between visibility samples. Reject those grazing fragments
        # using twice the output sequence's pose density, rather than letting a
        # sheet cross the original rim. The source shell itself is untouched.
        unsafe = set()
        for sample in range(1, 121):
            count = sample / 120 * self.layer_count
            index = min(self.layer_count - 1, max(0, math.ceil(count - 1e-9) - 1))
            local = count - index
            contact = _smooth((local - self.along * .64) / .36)
            offset = self.clearance + index * self.pitch + self.lift * (1 - contact)
            coords = self.base + offset[:, None] * self.direction
            surface = BVHTree.FromPolygons(coords.tolist(), self.faces, all_triangles=True, epsilon=0)
            unsafe.update(pair[0] for pair in surface.overlap(self.source_bvh))
        if len(unsafe) > len(self.faces) * .01:
            raise ValueError('The chosen carbon-cloth approach is obstructed by the shell')
        if unsafe:
            self.faces = [face for index, face in enumerate(self.faces) if index not in unsafe]
        material = _carbon_cloth_material()
        self.plies = []
        self._states = [None] * self.layer_count
        width = self.base[:, 0].max() - self.base[:, 0].min()
        u = (self.base[:, 0] - self.base[:, 0].min()) / width
        v = (height - height.min()) / width
        for index in range(self.layer_count):
            data = bpy.data.meshes.new(f'Actual-shell carbon cloth ply {index + 1:02d}')
            data.from_pydata(self.base.tolist(), [], self.faces)
            data.materials.append(material)
            uv = data.uv_layers.new(name='Cloth weave coordinates')
            for polygon in data.polygons:
                polygon.use_smooth = True
                for loop_index in polygon.loop_indices:
                    vertex = data.loops[loop_index].vertex_index
                    uv.data[loop_index].uv = (float(u[vertex]), float(v[vertex]))
            data.update()
            obj = bpy.data.objects.new(f'Carbon cloth ply {index + 1:02d} of 10', data)
            bpy.context.collection.objects.link(obj)
            obj['illustrative_ply_index'] = index + 1
            obj['source_surface'] = 'Unobstructed original shell skin'
            self.plies.append(obj)
        self.objects = self.originals + self.plies
        self.report = {
            'process': 'ten carbon cloth plies progressively draped onto the actual shell profile',
            'mode': self.mode,
            'layerCount': self.layer_count,
            'recommendedFrameCount': 61,
            'sourceFaceCount': source_faces,
            'clothFacesPerPly': len(self.faces),
            'clothVerticesPerPly': len(self.base),
            'excludedGrazingSkinTriangles': len(unsafe),
            'skinClearanceValidationPoses': 121,
            'geometryPolicy': 'Intact supplied shell retained. Each ply derives only from unobstructed original skin triangles; no shell slicing or solid-seat duplicates.',
            'layupPolicy': 'One moving cloth ply at a time; a continuous contact front seats it from the pan toward the upper back. Earlier plies remain seated and future plies are hidden.',
            'clearancePolicy': 'All plies share a projection along one unobstructed pull direction. Positive, strictly ordered offsets keep each moving ply above the shell and all already laid plies.',
            'pullDirection': list(self.pull),
            'illustrativeClearance': self.clearance,
            'illustrativePlySpacing': self.pitch,
            'interpretation': 'User-requested ten-layer process illustration. Display spacing and cloth motion are conceptual; no measured laminate thickness, ply orientation schedule, cure cycle or material performance is claimed.',
        }
        self.apply(0)

    def apply(self, progress):
        count = _clamp(progress) * self.layer_count
        for index, obj in enumerate(self.plies):
            local = max(0.0, min(1.0, count - index))
            obj.hide_render = local <= 1e-8
            obj.hide_set(local <= 1e-8)
            if local <= 1e-8 or self._states[index] == local:
                continue
            contact = _smooth((local - self.along * .64) / .36)
            offset = self.clearance + index * self.pitch + self.lift * (1 - contact)
            coords = self.base + offset[:, None] * self.direction
            obj.data.vertices.foreach_set('co', coords.astype(np.float32).ravel())
            obj.data.update()
            self._states[index] = local
        bpy.context.view_layer.update()


def build_process(key, objects, scene):
    """Build one supported scene process; return None for unrelated projects."""
    if key == 'brakeSim':
        return BrakeHeating(objects, scene)
    if key == 'carbonSeat':
        return CarbonLayup(objects, scene)
    return None
