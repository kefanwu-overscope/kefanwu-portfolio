"""One achromatic studio for every source scene; source parts are untouched.

The camera sees the same neutral emission on the floor and the world. Lighting
therefore cannot paint hotspots on the background. Optional short-range ambient
occlusion darkens the floor only at contact, without material color bleeding.
"""
import bpy
import numpy as np
from mathutils import Vector

REVISION = 'neutral-20260915'
BACKGROUND_LINEAR = .019  # AgX / Medium High Contrast / +0.2 EV -> sRGB #191919.
WORLD_LINEAR = .105
WORLD_STRENGTH = .35
LIGHT_RECIPE = (
    ('Neutral broad key', (3.5, -3., 3.), 650., 4., 3.),
    ('Neutral overhead reflection', (-.5, 0., 4.), 700., 4.5, .8),
    ('Neutral front fill', (4., 3., 0.), 280., 3., 4.),
    ('Neutral edge reflection', (-2., 2.4, 1.6), 180., .5, 4.),
)


def apply_studio(scene, ground, objects, variant='flat'):
    assert variant in ('flat', 'contact')
    camera = scene.camera
    rotation = camera.rotation_euler.to_quaternion()
    right, up, direction = [rotation @ Vector(axis) for axis in ((1, 0, 0), (0, 1, 0), (0, 0, 1))]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in objects:
        if obj.hide_render:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    values = np.asarray(points)
    target = Vector((values.min(0) + values.max(0)) * .5)
    for obj in list(scene.objects):
        if obj.type == 'LIGHT':
            bpy.data.objects.remove(obj, do_unlink=True)
    lights = []
    for name, (d, r, u), energy, width, height in LIGHT_RECIPE:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.color, data.shape = energy, (1., 1., 1.), 'RECTANGLE'
        data.size, data.size_y = width, height
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = target + direction * d + right * r + up * u
        obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
        lights.append({'name': name, 'energy': energy, 'color': list(data.color),
                       'size': width, 'sizeY': height, 'location': list(obj.location),
                       'rotation': list(obj.rotation_euler)})

    # The world provides neutral ambient lighting for non-camera rays and the
    # identical visible background for rays that miss the photographic floor.
    world = bpy.data.worlds.new('Shared neutral studio world')
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputWorld')
    ray = nodes.new('ShaderNodeLightPath')
    light = nodes.new('ShaderNodeBackground')
    light.inputs['Color'].default_value = (WORLD_LINEAR,) * 3 + (1.,)
    light.inputs['Strength'].default_value = WORLD_STRENGTH
    background = nodes.new('ShaderNodeBackground')
    background.inputs['Color'].default_value = (BACKGROUND_LINEAR,) * 3 + (1.,)
    background.inputs['Strength'].default_value = 1.
    mix = nodes.new('ShaderNodeMixShader')
    links.new(ray.outputs['Is Camera Ray'], mix.inputs[0])
    links.new(light.outputs[0], mix.inputs[1])
    links.new(background.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    scene.world = world

    floor = bpy.data.materials.new('Shared neutral camera background')
    floor.use_nodes = True
    floor.diffuse_color = (BACKGROUND_LINEAR,) * 3 + (1.,)
    nodes, links = floor.node_tree.nodes, floor.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    ray = nodes.new('ShaderNodeLightPath')
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Color'].default_value = (.014,) * 3 + (1.,)
    diffuse.inputs['Roughness'].default_value = 1.
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = (BACKGROUND_LINEAR,) * 3 + (1.,)
    emission.inputs['Strength'].default_value = 1.
    if variant == 'contact':
        ao = nodes.new('ShaderNodeAmbientOcclusion')
        ao.samples = 16
        ao.inputs['Distance'].default_value = .18
        scale = nodes.new('ShaderNodeMath')
        scale.operation = 'MULTIPLY_ADD'
        scale.inputs[1].default_value = .3
        scale.inputs[2].default_value = .7
        links.new(ao.outputs['AO'], scale.inputs[0])
        links.new(scale.outputs[0], emission.inputs['Strength'])
    mix = nodes.new('ShaderNodeMixShader')
    links.new(ray.outputs['Is Camera Ray'], mix.inputs[0])
    links.new(diffuse.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    ground.data.materials.clear()
    ground.data.materials.append(floor)
    scene.render.film_transparent = variant == 'flat'
    if variant == 'flat':
        # Composite after denoising, using the native antialiased object alpha.
        # Otherwise OIDN introduces small project-dependent color errors even
        # into a physically constant camera-only emission shader. The floor
        # remains available to shadow/reflection rays, preserving part shading.
        ground.visible_camera = False
        scene.use_nodes = True
        nodes, links = scene.node_tree.nodes, scene.node_tree.links
        nodes.clear()
        render = nodes.new('CompositorNodeRLayers')
        background = nodes.new('CompositorNodeRGB')
        background.outputs[0].default_value = (BACKGROUND_LINEAR,) * 3 + (1.,)
        over = nodes.new('CompositorNodeAlphaOver')
        over.inputs[0].default_value = 1.
        links.new(background.outputs[0], over.inputs[1])
        links.new(render.outputs['Image'], over.inputs[2])
        output = nodes.new('CompositorNodeComposite')
        links.new(over.outputs[0], output.inputs['Image'])
    scene.render.dither_intensity = 0.
    assert scene.view_settings.view_transform == 'AgX'
    assert scene.view_settings.look == 'AgX - Medium High Contrast'
    assert abs(scene.view_settings.exposure - .2) < 1e-6
    return {'revision': REVISION, 'variant': variant,
            'backgroundLinearRGB': [BACKGROUND_LINEAR] * 3,
            'backgroundDisplayRGB': [25, 25, 25],
            'backgroundMethod': 'native-transparent-film-alpha-over' if variant == 'flat' else 'camera-ray-emission',
            'worldLightingLinearRGB': [WORLD_LINEAR] * 3, 'worldStrength': WORLD_STRENGTH,
            'cameraBackgroundPolicy': ('Native antialiased object alpha over constant scene-linear neutral color after denoising.' if variant == 'flat' else 'Same camera-ray emission on floor and world; no light-dependent gradients or colored bounce.'),
            'contactDistance': .18 if variant == 'contact' else 0.,
            'contactMaximumDarkening': .3 if variant == 'contact' else 0.,
            'lightingTarget': list(target), 'lights': lights,
            'colorManagement': {'view': scene.view_settings.view_transform,
                                'look': scene.view_settings.look, 'exposure': scene.view_settings.exposure}}
