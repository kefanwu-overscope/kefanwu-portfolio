"""Share the catalogue carbon shader with a deforming, source-mapped layup.

The source scene has already normalized the supplied shell before this API is
called. Its Generated coordinates are captured once in mesh-local texspace.
Point attributes then carry those exact source coordinates through deformation;
neither a ply's bounds nor its changing pose can resize or rotate the weave.
"""
import bpy
import numpy as np


ATTRIBUTE = 'Carbon cover source Generated coordinates'


def assign_source_coordinates(mesh, coordinates):
    """Assign immutable source coordinates, in the mesh's vertex order."""
    coordinates = np.asarray(coordinates, dtype=np.float32)
    if coordinates.shape != (len(mesh.vertices), 3):
        raise ValueError('Carbon source coordinates must match every mesh vertex')
    attribute = mesh.attributes.get(ATTRIBUTE)
    if attribute is None:
        attribute = mesh.attributes.new(ATTRIBUTE, 'FLOAT_VECTOR', 'POINT')
    attribute.data.foreach_set('vector', coordinates.ravel())
    mesh.update()


def bind_carbon_cover_material(objects):
    """Return the shared cover material, source vertex coordinates and audit.

    Both the retained original shell and every ply must use the returned
    material. Coordinates are concatenated in objects/vertices order, matching
    material_processes._world_geometry. No original asset file is changed.
    """
    objects = [obj for obj in objects if obj.type == 'MESH']
    bpy.context.view_layer.update()
    materials = {slot.material.as_pointer(): slot.material
                 for obj in objects for slot in obj.material_slots if slot.material}
    if len(materials) != 1:
        raise ValueError('Expected the supplied shell to share one catalogue carbon material')
    source = next(iter(materials.values()))
    material = source.copy()
    material.name = 'Catalogue carbon weave — fixed source coordinates'
    nodes, links = material.node_tree.nodes, material.node_tree.links
    generated_links = [link for link in links
                       if link.from_node.bl_idname == 'ShaderNodeTexCoord'
                       and link.from_socket.name == 'Generated']
    if not generated_links:
        raise ValueError('Catalogue carbon shader no longer exposes its Generated mapping')
    coordinate = nodes.new('ShaderNodeAttribute')
    coordinate.name = 'Immutable original-shell Generated coordinates'
    coordinate.attribute_name = ATTRIBUTE
    for link in generated_links:
        destination = link.to_socket
        links.remove(link)
        links.new(coordinate.outputs['Vector'], destination)

    all_coordinates, spaces = [], []
    for obj in objects:
        mesh = obj.data
        location = np.asarray(mesh.texspace_location, dtype=np.float64)
        size = np.asarray(mesh.texspace_size, dtype=np.float64)
        if np.any(size <= 0):
            raise ValueError('The original carbon shell must have nonzero texture-space size')
        vertices = np.asarray([vertex.co[:] for vertex in mesh.vertices], dtype=np.float64)
        generated = (vertices - location) / (2 * size) + .5
        assign_source_coordinates(mesh, generated)
        all_coordinates.append(generated.astype(np.float32))
        for slot in obj.material_slots:
            slot.material = material
        spaces.append({'object': obj.name, 'location': location.tolist(), 'size': size.tolist(),
                       'vertexCount': len(vertices)})

    shader = nodes.get('Principled BSDF')
    checker = next(node for node in nodes if node.bl_idname == 'ShaderNodeTexChecker')
    bump = next(node for node in nodes if node.bl_idname == 'ShaderNodeBump')
    report = {
        'sourceMaterial': source.name,
        'sharedMaterial': material.name,
        'shaderPolicy': 'Copy the original catalogue material nodes and all their values. Replace only Generated input with an equivalent immutable source-coordinate point attribute; original shell and every ply share this same material datablock.',
        'coordinateAttribute': ATTRIBUTE,
        'coordinateFormula': '(source mesh-local vertex - source texspace_location) / (2 * source texspace_size) + 0.5',
        'coordinateInterpolation': 'POINT FLOAT_VECTOR, barycentrically interpolated on the same retained source triangles; never recomputed by apply(progress).',
        'sourceTextureSpaces': spaces,
        'checkerScale': float(checker.inputs['Scale'].default_value),
        'checkerColorsLinear': [list(checker.inputs[name].default_value) for name in ('Color1', 'Color2')],
        'roughness': float(shader.inputs['Roughness'].default_value),
        'metallic': float(shader.inputs['Metallic'].default_value),
        'specular': float(shader.inputs['Specular IOR Level'].default_value),
        'coat': float(shader.inputs['Coat Weight'].default_value),
        'bumpStrength': float(bump.inputs['Strength'].default_value),
        'bumpDistance': float(bump.inputs['Distance'].default_value),
        'additionalWeaveRotation': 0,
    }
    return material, np.concatenate(all_coordinates), report
