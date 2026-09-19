"""Export the approved Blender controllers as seekable browser geometry.

Run with Blender --background --python this.py -- --projects steering.
Existing staging/motion files are read and executed without editing them.
"""
import argparse
import ast
import gzip
import hashlib
import json
import math
import os
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from public_provenance import public_value

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tools/exploded-render'
sys.path.insert(0, str(SOURCE))
EVIDENCE = ROOT.parent / '.codex/studio-v2-20260919/exports'
KEYS = ['steering','vineRobot','javelin','scanner','brakeSim','aura','carbonSeat','seat',
        'materialTest','ansysCfd','pool','lineFollower','formlabs','telecaster','education','ftc']


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


class Buffer:
    def __init__(self):
        self.data = bytearray()
        self.cache = {}

    def add(self, values, item_size=1, component='float32'):
        dtype = {'float32':'<f4','uint32':'<u4'}[component]
        arr = np.ascontiguousarray(values, dtype=dtype)
        raw = arr.tobytes()
        digest = hashlib.sha256(raw).hexdigest()
        identity = (digest, component, item_size)
        if identity in self.cache:
            return dict(self.cache[identity])
        offset = len(self.data)
        assert offset % 4 == 0
        self.data.extend(raw)
        result = {'byteOffset':offset,'count':arr.size//item_size,
                  'itemSize':item_size,'componentType':component}
        self.cache[identity] = result
        return dict(result)

    def write(self, path):
        path.write_bytes(gzip.compress(bytes(self.data), compresslevel=6, mtime=0))
        return {'url':path.name,'compression':'gzip','byteLength':len(self.data),
                'compressedBytes':path.stat().st_size,'sha256':sha(path)}


class Frames:
    """Intern identical frame rows before writing (especially hidden carbon cloth)."""
    def __init__(self):
        self.rows = []
        self.map = []
        self.seen = {}

    def add(self, arr):
        arr = np.ascontiguousarray(arr, dtype='<f4')
        raw = arr.tobytes()
        digest = hashlib.sha256(raw).digest()
        if digest not in self.seen:
            self.seen[digest] = len(self.rows)
            self.rows.append(arr.copy())
        self.map.append(self.seen[digest])

    def emit(self, buffer, item_size, intern_elements=False):
        if len(self.rows) == 1:
            return None
        rows = np.stack(self.rows)
        element_map = None
        if intern_elements and rows.ndim == 3:
            # A mesh corner can have its own normal/UV yet share the entire
            # position trajectory with other corners. Deduplicate only when
            # ALL sampled float32 values match, preserving exact source bytes.
            trajectories = np.ascontiguousarray(rows.transpose(1,0,2)).reshape(rows.shape[1],-1)
            _, unique, inverse = np.unique(trajectories,axis=0,return_index=True,return_inverse=True)
            if len(unique) < rows.shape[1]:
                rows = rows[:,unique,:]
                element_map = buffer.add(inverse,1,'uint32')
        desc = buffer.add(rows,item_size)
        desc['valuesPerFrame'] = int(rows[0].size)
        if element_map: desc['elementMap'] = element_map
        desc['frameMap'] = buffer.add(self.map, 1, 'uint32')
        return desc


def load_source():
    path = SOURCE / 'render_exploded.py'
    tree = ast.parse(path.read_text(encoding='utf-8'))
    tree.body = [n for n in tree.body if not isinstance(n, ast.For)]
    function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'render')
    cutoff = next(i for i,n in enumerate(function.body) if isinstance(n, ast.If)
                  and 'motion.report' in ast.unparse(n.test))
    function.body = function.body[:cutoff] + ast.parse('return motion, parts, objects, ground').body
    ast.fix_missing_locations(tree)
    namespace = {'__file__':str(path),'__name__':'studio_motion_source'}
    old = sys.argv[:]
    try:
        sys.argv = ['blender','--','--output',str(EVIDENCE/'staging')]
        exec(compile(tree, str(path), 'exec'), namespace)
    finally:
        sys.argv = old
    return namespace


def material_definition(mat):
    out = {'name':mat.name if mat else 'Default material','baseColor':[.5,.5,.5,1],
           'metalness':0,'roughness':.5,'opacity':1,'doubleSide':True,
           'colorSpace':'linear','emissive':[0,0,0],'emissiveIntensity':0}
    if mat is None:
        return out
    out['baseColor'] = list(mat.diffuse_color)
    nodes = list(mat.node_tree.nodes) if mat.use_nodes else []
    bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        for target, source in [('metalness','Metallic'),('roughness','Roughness'),
                               ('opacity','Alpha'),('transmission','Transmission Weight'),
                               ('ior','IOR'),('clearcoat','Coat Weight'),
                               ('clearcoatRoughness','Coat Roughness'),
                               ('emissiveIntensity','Emission Strength')]:
            out[target] = float(bsdf.inputs[source].default_value)
        out['baseColor'] = list(bsdf.inputs['Base Color'].default_value)
        out['emissive'] = list(bsdf.inputs['Emission Color'].default_value)[:3]
    emission = next((n for n in nodes if n.type == 'EMISSION'), None)
    if emission:
        out['unlit'] = True
        out['baseColor'] = list(emission.inputs['Color'].default_value)
        out['emissiveIntensity'] = float(emission.inputs['Strength'].default_value)
    if any(n.type == 'VERTEX_COLOR' for n in nodes):
        out['vertexColors'] = True
        out['baseColor'] = [1,1,1,1]
    checker = next((n for n in nodes if n.type == 'TEX_CHECKER'), None)
    if checker:
        bump = next((n for n in nodes if n.type == 'BUMP'), None)
        out['procedural'] = {'type':'carbon','scale':float(checker.inputs['Scale'].default_value),
            'color1':list(checker.inputs['Color1'].default_value),
            'color2':list(checker.inputs['Color2'].default_value),
            'bumpStrength':float(bump.inputs['Strength'].default_value) if bump else 0,
            'bumpDistance':float(bump.inputs['Distance'].default_value) if bump else 0,
            'coordinates':'sourceCoordinates'}
    noise = next((n for n in nodes if n.type == 'TEX_NOISE'), None)
    if noise:
        mapping = next((n for n in nodes if n.type == 'VECT_MATH' and n.operation == 'MULTIPLY'), None)
        ramp = next((n for n in nodes if n.type == 'VALTORGB'), None)
        rotate = next((n for n in nodes if n.type == 'VECTOR_ROTATE'), None)
        out['procedural'] = {'type':'noise','scale':float(noise.inputs['Scale'].default_value),
            'mappingScale':list(mapping.inputs[1].default_value) if mapping else [1,1,1],
            'rotation':float(rotate.inputs['Angle'].default_value) if rotate else 0,
            'coordinates':'objectCoordinates' if rotate else 'sourceCoordinates',
            'coordinateSpace':'object' if rotate else 'generated',
            'detail':float(noise.inputs['Detail'].default_value),
            'roughness':float(noise.inputs['Roughness'].default_value),
            'lacunarity':float(noise.inputs['Lacunarity'].default_value),
            'distortion':float(noise.inputs['Distortion'].default_value),
            'normalize':bool(noise.normalize),
            'ramp':[{'position':e.position,'color':list(e.color)} for e in ramp.color_ramp.elements] if ramp else None}
        bump = next((n for n in nodes if n.type == 'BUMP'),None)
        if bump:
            out['procedural'].update(bumpStrength=float(bump.inputs['Strength'].default_value),
                                     bumpDistance=float(bump.inputs['Distance'].default_value))
    if any(n.name == 'Qualitative warming fraction, not temperature' for n in nodes):
        out['heat'] = {'warmColor':[.12,.001,.0005], 'emissiveColor':[.70,.001,.00015],
                       'exposureAttribute':'heatExposure','interpretation':'Qualitative incandescence, not measured temperature'}
    return out


def floats(collection, prop, components):
    result = np.empty(len(collection)*components, dtype=np.float32)
    collection.foreach_get(prop, result)
    return result.reshape(-1, components)


def attribute(mesh, name, vertex_ids, loop_ids):
    attr = mesh.attributes.get(name)
    if attr is None:
        return None
    prop, size = {'FLOAT':('value',1),'FLOAT_VECTOR':('vector',3),
                  'FLOAT_COLOR':('color',4),'BYTE_COLOR':('color',4)}.get(attr.data_type,(None,0))
    if prop is None:
        return None
    values = floats(attr.data, prop, size)
    return values[vertex_ids if attr.domain == 'POINT' else loop_ids]


def geometry_data(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
    try:
        mesh.calc_loop_triangles()
        if not len(mesh.loop_triangles):
            return None
        tri_loops = np.empty(len(mesh.loop_triangles)*3, dtype=np.int32)
        mesh.loop_triangles.foreach_get('loops', tri_loops)
        triangle_material = np.empty(len(mesh.loop_triangles), dtype=np.int32)
        mesh.loop_triangles.foreach_get('material_index', triangle_material)
        order = np.argsort(triangle_material, kind='stable')
        tri_loops = tri_loops.reshape(-1,3)[order].ravel()
        loop_vertex = np.empty(len(mesh.loops), dtype=np.int32)
        mesh.loops.foreach_get('vertex_index', loop_vertex)
        loop_ids = np.unique(tri_loops)
        vertex_ids = loop_vertex[loop_ids]
        pos = floats(mesh.vertices,'co',3)[vertex_ids]
        normals = floats(mesh.corner_normals,'vector',3)[loop_ids]
        uv = floats(mesh.uv_layers.active.data,'uv',2)[loop_ids] if mesh.uv_layers.active else None
        color_attr = mesh.color_attributes.active_color
        color = attribute(mesh, color_attr.name, vertex_ids, loop_ids) if color_attr else None
        coords = attribute(mesh, 'Carbon cover source Generated coordinates', vertex_ids, loop_ids)
        if coords is None:
            # Generated mapping is taken from the ORIGINAL mesh texture space,
            # not the evaluated or animated bounding box.
            loc = np.asarray(getattr(obj.data,'texspace_location',(0,0,0)))
            size = np.maximum(np.asarray(getattr(obj.data,'texspace_size',(1,1,1))),1e-8)
            coords = ((pos-loc)/(2*size)+.5).astype(np.float32)
        # Keep corner identity for deformers so normals can evolve independently.
        dynamic = obj.get('_studio_deformer', False)
        if dynamic:
            packed_ids = np.arange(len(loop_ids))
            inverse = packed_ids
        else:
            rows = [vertex_ids[:,None].astype(np.float32),normals]
            if uv is not None: rows.append(uv)
            if color is not None: rows.append(color)
            _,packed_ids,inverse = np.unique(np.concatenate(rows,axis=1),axis=0,return_index=True,return_inverse=True)
        remap = np.zeros(len(mesh.loops),dtype=np.uint32)
        remap[loop_ids] = inverse
        index = remap[tri_loops]
        sorted_mat = triangle_material[order]
        groups = []
        for mat_id in np.unique(sorted_mat):
            where = np.flatnonzero(sorted_mat == mat_id)
            groups.append({'start':int(where[0])*3,'count':int(len(where))*3,'materialIndex':int(mat_id)})
        attrs = {'position':pos[packed_ids],'normal':normals[packed_ids], 'index':index,
                 'sourceCoordinates':coords[packed_ids]}
        if uv is not None: attrs['uv'] = uv[packed_ids]
        if color is not None: attrs['color'] = color[packed_ids]
        for out, source in [('heatExposure','Qualitative heat exposure'),
                            ('attributeOpacity','Illustrative carbon cloth visibility'),
                            ('attributeRoughness','Illustrative carbon cloth roughness')]:
            value = attribute(mesh, source, vertex_ids, loop_ids)
            if value is not None: attrs[out] = value[packed_ids]
        return {'attributes':attrs,'groups':groups,'loopIds':loop_ids[packed_ids],
                'vertexIds':vertex_ids[packed_ids],'evaluatedVertexCount':len(mesh.vertices),
                'triangles':len(mesh.loop_triangles)}
    finally:
        evaluated.to_mesh_clear()


def deformation_data(obj, depsgraph, spec):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=depsgraph)
    try:
        assert len(mesh.vertices) == spec['evaluatedVertexCount'], (obj.name,'Changing topology')
        vertex_ids, loop_ids = spec['vertexIds'], spec['loopIds']
        data = {'deformationPosition':floats(mesh.vertices,'co',3)[vertex_ids],
                'deformationNormal':floats(mesh.corner_normals,'vector',3)[loop_ids]}
        for out, source in [('attributeOpacity','Illustrative carbon cloth visibility'),
                            ('attributeRoughness','Illustrative carbon cloth roughness')]:
            value = attribute(mesh, source, vertex_ids, loop_ids)
            if value is not None: data[out] = value
        return data
    finally:
        evaluated.to_mesh_clear()


def transform(obj):
    position, quat, scale = obj.matrix_world.decompose()
    return {'position':list(position),'quaternion':[quat.x,quat.y,quat.z,quat.w],'scale':list(scale)}


def bounds_add(bounds, points, matrix):
    world = points@matrix[:3,:3].T+matrix[:3,3]
    bounds[0] = np.minimum(bounds[0],world.min(0))
    bounds[1] = np.maximum(bounds[1],world.max(0))


def bounds_json(bounds):
    return {'min':bounds[0].tolist(),'max':bounds[1].tolist(),
            'center':((bounds[0]+bounds[1])*.5).tolist(),
            'size':(bounds[1]-bounds[0]).tolist()}


def deformer(key, obj):
    return ((key == 'vineRobot' and obj.name.startswith('Functional vine'))
         or (key == 'materialTest' and (obj.name.startswith('Functional tensile specimen')
                                       or 'load_cell_signal_cable' in obj.name))
         or key == 'seat'
         or (key == 'carbonSeat' and obj.name.startswith('Carbon cloth ply')))


def read_descriptor(buffer, desc):
    return np.frombuffer(buffer.data,dtype='<u4' if desc['componentType']=='uint32' else '<f4',
                         count=desc['count']*desc['itemSize'],offset=desc['byteOffset'])


def verify_packed_tracks(buffer, nodes, states):
    checks = 0
    for node, tracks in zip(nodes,states):
        for name, desc in node['tracks'].items():
            source = tracks[name]
            values = read_descriptor(buffer,desc).reshape(-1,desc['valuesPerFrame'])
            frame_map = read_descriptor(buffer,desc['frameMap'])
            element_map = read_descriptor(buffer,desc['elementMap']) if 'elementMap' in desc else None
            for frame,row in enumerate(source.map):
                actual = values[frame_map[frame]]
                if element_map is not None:
                    actual = actual.reshape(-1,desc['itemSize'])[element_map].ravel()
                assert np.array_equal(actual,source.rows[row].ravel()),(node['name'],name,frame)
                checks += 1
    return checks


def export_ftc_room(objects, folder):
    """Room-only derivative; the inspector retains complete original meshes."""
    depsgraph=bpy.context.evaluated_depsgraph_get()
    copies=[]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        if obj.hide_render: continue
        evaluated=obj.evaluated_get(depsgraph)
        data=bpy.data.meshes.new_from_object(evaluated,depsgraph=depsgraph)
        clone=bpy.data.objects.new('Room source '+obj.name,data)
        scene=bpy.context.scene;scene.collection.objects.link(clone)
        clone.matrix_world=obj.matrix_world.copy()
        clone.select_set(True);copies.append(clone)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join()
    joined=bpy.context.object;joined.name='FTC source robot — room overview'
    modifier=joined.modifiers.new('Room overview reduction only','DECIMATE')
    modifier.ratio=.28
    modifier.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Consolidate material slots introduced by joining source components.
    indices={};unique=[];remap=[]
    for mat in joined.data.materials:
        ident=mat.as_pointer() if mat else 0
        if ident not in indices:indices[ident]=len(unique);unique.append(mat)
        remap.append(indices[ident])
    polygon_material=[remap[p.material_index] for p in joined.data.polygons]
    joined.data.materials.clear()
    for mat in unique:joined.data.materials.append(mat)
    for poly,index in zip(joined.data.polygons,polygon_material):poly.material_index=index
    path=folder/'room.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
                              export_yup=True,export_animations=False,export_apply=True,
                              export_cameras=False,export_lights=False)
    result={'path':str(path.relative_to(ROOT)).replace('\\','/'),'bytes':path.stat().st_size,
            'sha256':sha(path),'triangles':len(joined.data.polygons),
            'source':'Same approved reconstructed FTC controller at progress zero',
            'reductionRatio':.28,'inspectorGeometryUnchanged':True}
    bpy.data.objects.remove(joined,do_unlink=True)
    return result


def export(key, namespace, sample_count=None):
    started = time.monotonic()
    folder = ROOT/'assets/studio-motion'/key
    folder.mkdir(parents=True,exist_ok=True)
    print('STUDIO_BUILD',key,flush=True)
    motion, parts, originals, ground = namespace['render'](key)
    scene = bpy.context.scene
    if key == 'education':
        scene.camera.location = (1.9235137701,-10.0798053741,3.3648588657)
        scene.camera.rotation_euler = (1.42475652695,0.,.197395607829)
        scene.camera.data.ortho_scale = 6.382242733661077
    motion.apply(0)
    bpy.context.view_layer.update()
    objects = list(motion.objects)
    count = sample_count or {'vineRobot':49,'materialTest':145,'aura':145,'pool':145}.get(key,121)
    group_lookup = {p['object'].name:p.get('group','') for p in parts}
    geometry_buffer, motion_buffer = Buffer(),Buffer()
    materials, material_objects, material_ids = [],[],{}
    nodes, specs, states, node_objects = [],[],[],[]
    initial_bounds = [np.full(3,np.inf),np.full(3,-np.inf)]
    motion_bounds = [np.full(3,np.inf),np.full(3,-np.inf)]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        obj['_studio_deformer'] = deformer(key,obj)
        spec = geometry_data(obj,depsgraph)
        if not spec: continue
        mat_indices = []
        slots = list(obj.material_slots) or [None]
        for slot in slots:
            mat = slot.material if slot else None
            identity = mat.as_pointer() if mat else 0
            if identity not in material_ids:
                material_ids[identity] = len(materials)
                materials.append(material_definition(mat))
                material_objects.append(mat)
            mat_indices.append(material_ids[identity])
        geometry = {'groups':spec['groups']}
        for name, values in spec['attributes'].items():
            geometry[name] = geometry_buffer.add(values,values.shape[-1] if values.ndim>1 else 1,
                                                'uint32' if name=='index' else 'float32')
        node = {'name':obj.name,'group':group_lookup.get(obj.name,obj.name),
                'geometry':geometry,'materialIndices':mat_indices,
                'transform':transform(obj),'visible':not obj.hide_render,'tracks':{}}
        nodes.append(node);specs.append(spec);node_objects.append(obj)
        states.append({name:Frames() for name in ['position','quaternion','scale','visible']})
        if obj['_studio_deformer']:
            for name in ['deformationPosition','deformationNormal','attributeOpacity','attributeRoughness']:
                states[-1][name] = Frames()
        if not obj.hide_render:
            bounds_add(initial_bounds,spec['attributes']['position'],np.asarray(obj.matrix_world))
    print('STUDIO_GEOMETRY',key,len(nodes),sum(s['triangles'] for s in specs),flush=True)
    material_states = [{} for mat in materials]
    pose_hashes = {}
    geometry_samples = {}
    for sample in range(count):
        progress = sample/(count-1)
        motion.apply(progress)
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        pose_bytes = bytearray()
        geometry_hash = hashlib.sha256()
        for obj,node,spec,tracks in zip(node_objects,nodes,specs,states):
            trs = transform(obj)
            for name,value in trs.items(): tracks[name].add(value)
            visible = not obj.hide_render
            tracks['visible'].add([float(visible)])
            points = spec['attributes']['position']
            if obj['_studio_deformer']:
                # Hidden cloth has no visible geometry contract. Reuse initial
                # bytes, eliminating the controller's last hidden cached pose.
                if not visible:
                    data = {'deformationPosition':points,'deformationNormal':spec['attributes']['normal']}
                    for attr in ['attributeOpacity','attributeRoughness']:
                        if attr in spec['attributes']: data[attr]=spec['attributes'][attr]
                else:
                    data = deformation_data(obj,depsgraph,spec)
                for name, values in data.items(): tracks[name].add(values)
                points = data['deformationPosition']
                if visible: geometry_hash.update(points.tobytes())
            if visible:
                bounds_add(motion_bounds,points,np.asarray(obj.matrix_world))
            pose_bytes.extend(np.asarray([*trs['position'],*trs['quaternion'],*trs['scale'],visible],dtype='<f4').tobytes())
        for mat,state in zip(material_objects,material_states):
            if mat and mat.use_nodes:
                for name,label in [('warming','Qualitative warming fraction, not temperature'),
                                   ('incandescence','Qualitative incandescence')]:
                    value = mat.node_tree.nodes.get(label)
                    if value:
                        state.setdefault(name,Frames()).add([value.outputs[0].default_value])
        pose_hashes[str(sample)] = hashlib.sha256(pose_bytes).hexdigest()
        geometry_samples[str(sample)] = geometry_hash.hexdigest()
        if sample % 30 == 0 or sample == count-1:
            print('STUDIO_SAMPLE',key,sample,count,flush=True)
    for node, tracks in zip(nodes,states):
        for name,values in tracks.items():
            if not values.rows: continue
            size = 4 if name == 'quaternion' else 3 if name in ['position','scale','deformationPosition','deformationNormal'] else 1
            descriptor = values.emit(motion_buffer,size, name.startswith(('deformation','attribute')))
            if descriptor: node['tracks'][name]=descriptor
    for mat,tracks in zip(materials,material_states):
        mat['tracks'] = {name:values.emit(motion_buffer,1) for name,values in tracks.items()}
    packed_checks = verify_packed_tracks(motion_buffer,nodes,states)
    interpolation = None
    if key in ('vineRobot','seat'):
        maximum = 0.; maximum_normal = 0.; worst = None; degenerate_normals = 0
        for interval in range(count-1):
            progress=(interval+.5)/(count-1)
            motion.apply(progress);bpy.context.view_layer.update()
            depsgraph=bpy.context.evaluated_depsgraph_get()
            for obj,spec,tracks in zip(node_objects,specs,states):
                if not obj['_studio_deformer'] or obj.hide_render:continue
                source=deformation_data(obj,depsgraph,spec)
                for field in ('deformationPosition','deformationNormal'):
                    records=tracks[field]
                    predicted=(records.rows[records.map[interval]]+records.rows[records.map[interval+1]])*.5
                    if field=='deformationNormal':
                        norms=np.linalg.norm(predicted,axis=1,keepdims=True)
                        valid=(norms[:,0]>.5)&(np.linalg.norm(source[field],axis=1)>.5)
                        degenerate_normals+=int((~valid).sum())
                        predicted/=np.maximum(norms,1e-15)
                        if np.any(valid):
                            maximum_normal=max(maximum_normal,float(np.linalg.norm(predicted[valid]-source[field][valid],axis=1).max()))
                    else:
                        error=float(np.linalg.norm(predicted-source[field],axis=1).max())
                        if error>maximum:maximum=error;worst=progress
        interpolation={'midpointsChecked':count-1,'maximumPositionErrorSceneUnits':maximum,
                       'relativeToInitialLargestDimension':maximum/max(initial_bounds[1]-initial_bounds[0]),
                       'maximumNormalVectorError':maximum_normal,'worstProgress':worst,
                       'degenerateNormalCornersExcluded':degenerate_normals,
                       'allStoredSamplesBitExact':True}
    camera = scene.camera
    direction = camera.rotation_euler.to_quaternion()@Vector((0,0,-1))
    center = Vector((initial_bounds[0]+initial_bounds[1])*.5)
    distance = (center-camera.location).dot(direction)
    camera_spec = {'type':'orthographic' if camera.data.type=='ORTHO' else 'perspective',
        'position':list(camera.location),'target':list(camera.location+direction*distance),
        'up':list(camera.rotation_euler.to_quaternion()@Vector((0,1,0))),
        'orthoScale':camera.data.ortho_scale,'sensorFit':camera.data.sensor_fit,
        'fov':math.degrees(camera.data.angle),'aspect':640/427}
    buffers = {'geometry':geometry_buffer.write(folder/'geometry.bin.gz'),
               'motion':motion_buffer.write(folder/'motion.bin.gz')}
    source_files = {str(p.relative_to(ROOT)).replace('\\','/'):sha(p)
                    for directory in ['tools/exploded-render','tools/editorial-render']
                    for p in (ROOT/directory).rglob('*.py')}
    source_files['tools/editorial-render/catalog.json'] = sha(ROOT/'tools/editorial-render/catalog.json')
    catalog = json.loads((ROOT/'tools/editorial-render/catalog.json').read_text(encoding='utf-8'))
    source_input = 'models/real/'+key+'.glb' if key in ('steering','vineRobot','scanner') else catalog[key].get('source')
    source_inputs = {source_input:sha(ROOT/source_input)} if source_input else {}
    if key=='ansysCfd':
        source_inputs[str(motion.data_path)] = sha(motion.data_path)
        source_inputs[str(motion.data_path.parent/'flow-provenance.json')] = sha(motion.data_path.parent/'flow-provenance.json')
    if key=='javelin':
        provenance_path=ROOT/'tools/editorial-render/sources/javelin.json'
        source_inputs[str(provenance_path.relative_to(ROOT))] = sha(provenance_path)
        for item in json.loads(provenance_path.read_text(encoding='utf-8'))['inputs']:
            if any(word in Path(item['path']).name.lower() for word in ('nosecone','tailcone','naca0008_wing')):
                assert sha(item['path'])==item['sha256']
                source_inputs[item['path']]=item['sha256']
    manifest = {'schema':'studio-motion-v1','project':key,'coordinates':'blender-z-up',
        'quaternionOrder':'xyzw','colorSpace':'linear','sampleCount':count,'duration':8,
        'buffers':buffers,'materials':materials,'nodes':nodes,
        'bounds':{'initial':bounds_json(initial_bounds),'motion':bounds_json(motion_bounds)},
        'camera':camera_spec,'source':{'pipeline':'tools/exploded-render/render_exploded.py',
            'motionReport':public_value(motion.report),'sourceContractSha256':hashlib.sha256(json.dumps(source_files,sort_keys=True).encode()).hexdigest()},
        'limitations':['Sampled source poses; interpolation does not imply measured engineering time.']}
    # Revisit endpoint and shuffled source samples to prove controller seeking
    # and exported float32 TRS/deformation bytes are independent of history.
    audit_samples = sorted(set([0,count-1,count//2,7, count//4,3*count//4]))
    rng = np.random.default_rng(19092026)
    rng.shuffle(audit_samples)
    errors = []
    for sample in audit_samples:
        motion.apply(sample/(count-1));bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        pose_bytes = bytearray(); geometry_hash = hashlib.sha256()
        for obj,node,spec in zip(node_objects,nodes,specs):
            trs=transform(obj);visible=not obj.hide_render
            pose_bytes.extend(np.asarray([*trs['position'],*trs['quaternion'],*trs['scale'],visible],dtype='<f4').tobytes())
            if obj['_studio_deformer'] and visible:
                geometry_hash.update(deformation_data(obj,depsgraph,spec)['deformationPosition'].tobytes())
        if hashlib.sha256(pose_bytes).hexdigest()!=pose_hashes[str(sample)]:errors.append({'sample':sample,'type':'pose'})
        if geometry_hash.hexdigest()!=geometry_samples[str(sample)]:errors.append({'sample':sample,'type':'deformation'})
    assert not errors,(key,errors)
    motion.apply(0);bpy.context.view_layer.update()
    room = export_ftc_room(node_objects,folder) if key=='ftc' else None
    save(folder/'manifest.json',manifest)
    audit = {'project':key,'status':'passed','sampleCount':count,'nodeCount':len(nodes),
             'triangleCount':sum(s['triangles'] for s in specs),'sourceFiles':source_files,
             'sourceInputs':source_inputs,'exporterSha256':sha(__file__),
             'sourceMotionReport':motion.report,'randomSeekSamples':audit_samples,
             'randomSeekErrors':errors,'poseHashes':pose_hashes,'deformationHashes':geometry_samples,
             'packedFloat32TrackChecks':packed_checks,'packedFloat32TrackMaximumError':0,
             'interpolationAudit':interpolation,'roomDerivative':room,
             'frame0Coordinates':'Exact float32 evaluated source mesh vertices and original corner normals',
             'endpoints':{'initial':pose_hashes['0'],'final':pose_hashes[str(count-1)]},
             'buffers':buffers,'manifestSha256':sha(folder/'manifest.json'),
             'seconds':round(time.monotonic()-started,3)}
    save(EVIDENCE/(key+'-audit.json'),audit)
    print('STUDIO_COMPLETE',key,audit['seconds'],buffers,flush=True)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--projects',nargs='+',default=KEYS)
    parser.add_argument('--samples',type=int)
    opts = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    assert set(opts.projects)<=set(KEYS)
    namespace=load_source()
    for key in opts.projects:
        export(key,namespace,opts.samples)
    available={key:{'manifest':key+'/manifest.json'} for key in KEYS
               if (ROOT/'assets/studio-motion'/key/'manifest.json').exists()}
    save(ROOT/'assets/studio-motion/index.json',{'schema':'studio-motion-index-v1','projects':available})


if __name__ == '__main__':
    main()
