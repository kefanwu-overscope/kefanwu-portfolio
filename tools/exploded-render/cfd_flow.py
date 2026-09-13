"""Render ONLY exported Fluent wall pressure and numerical velocity pathlines.

There is deliberately no synthetic flow fallback. Missing, malformed or stale
solve data stops rendering. Animation advects markers by actual path travel
time; pressure is the steady solved surface field, not an invented transient.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
DEFAULT_DATA=ROOT.parent/'.codex/functional-motion-20260913/cfd'


PRESSURE_SCALE_PA=750.0
PRESSURE_COLOR_POSITIONS=np.array([0,.30,.5,.72,1.])
PRESSURE_COLOR_ANCHORS=np.array([[.004,.018,.32],[.005,.19,.60],[.065,.105,.14],[1.,.14,.002],[.62,.002,.001]])


def _pressure_coordinate(values,minimum,maximum):
    """Monotonic full-range, zero-centered asinh display; never modify Pa data."""
    if not minimum<0<maximum:raise ValueError('Diverging pressure display requires a field spanning zero gauge pressure')
    pressure=np.asarray(values,dtype=float)
    denominator=np.where(pressure<0,np.arcsinh(-minimum/PRESSURE_SCALE_PA),np.arcsinh(maximum/PRESSURE_SCALE_PA))
    return .5+.5*np.arcsinh(pressure/PRESSURE_SCALE_PA)/denominator


def _pressure_value(coordinate,minimum,maximum):
    signed=np.asarray(coordinate,dtype=float)*2-1
    denominator=np.where(signed<0,np.arcsinh(-minimum/PRESSURE_SCALE_PA),np.arcsinh(maximum/PRESSURE_SCALE_PA))
    return PRESSURE_SCALE_PA*np.sinh(signed*denominator)


def _colors(values,minimum,maximum):
    t=_pressure_coordinate(values,minimum,maximum)
    if np.any(t < -1e-10) or np.any(t > 1+1e-10):raise ValueError('Pressure color input outside recorded full range')
    low=np.minimum(np.maximum(np.searchsorted(PRESSURE_COLOR_POSITIONS,t,side='right')-1,0),3)
    mix=((t-PRESSURE_COLOR_POSITIONS[low])/(PRESSURE_COLOR_POSITIONS[low+1]-PRESSURE_COLOR_POSITIONS[low]))[...,None]
    anchors=PRESSURE_COLOR_ANCHORS
    rgb=anchors[low]*(1-mix)+anchors[low+1]*mix
    return np.c_[rgb,np.ones(len(rgb))]


def _colored_mesh(name,vertices,faces,values,limits):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    attr=mesh.color_attributes.new(name='Solved pressure colors',type='FLOAT_COLOR',domain='CORNER')
    colors=_colors(values,*limits)
    loopcolors=np.concatenate([np.tile(colors[p.index],(len(p.loop_indices),1)) for p in mesh.polygons])
    attr.data.foreach_set('color',loopcolors.astype(np.float32).ravel())
    material=bpy.data.materials.new(name+' material');material.use_nodes=True
    nodes=material.node_tree.nodes;nodes.clear()
    color=nodes.new('ShaderNodeVertexColor');color.layer_name=attr.name
    emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=.85
    output=nodes.new('ShaderNodeOutputMaterial')
    # A scientific false-color surface must remain readable under the strong
    # inherited product lights. The same unlit transfer is used on its legend.
    material.node_tree.links.new(color.outputs['Color'],emission.inputs['Color'])
    material.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
    mesh.materials.append(material)
    obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
    return obj


def _emission_material(name,color,strength):
    material=bpy.data.materials.new(name);material.use_nodes=True
    nodes=material.node_tree.nodes;bsdf=nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=.45
    bsdf.inputs['Emission Color'].default_value=(*color,1)
    bsdf.inputs['Emission Strength'].default_value=strength
    return material


def _curve(name,points,radius,material):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D'
    data.resolution_u=1;data.bevel_depth=radius;data.bevel_resolution=1
    spline=data.splines.new('POLY');spline.points.add(len(points)-1)
    spline.points.foreach_set('co',np.c_[points,np.ones(len(points))].astype(np.float32).ravel())
    data.materials.append(material)
    obj=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(obj)
    return obj


def _text(name,text,position,rotation,size,material):
    data=bpy.data.curves.new(name,'FONT');data.body=text;data.size=size
    data.align_x='LEFT';data.extrude=0;data.materials.append(material)
    obj=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(obj)
    obj.location=position;obj.rotation_euler=rotation
    return obj


class FluentFlow:
    mode='flow'
    def __init__(self,objects,scene):
        directory=Path(os.environ.get('CFD_FLOW_DATA_DIR',str(DEFAULT_DATA)))
        path=directory/'flow-data.npz';metadata_path=directory/'flow-provenance.json'
        if not path.exists() or not metadata_path.exists():raise FileNotFoundError('Actual solved Fluent flow-data.npz and flow-provenance.json are required')
        provenance=json.loads(metadata_path.read_text())
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        if digest!=provenance.get('dataSha256'):raise ValueError('CFD data/provenance hash mismatch')
        with np.load(path,allow_pickle=False) as archive:
            data={name:archive[name] for name in archive.files}
        vertices=np.asarray(data['surface_vertices'],dtype=float)
        triangles=np.asarray(data['surface_triangles'],dtype=int)
        pressure=np.asarray(data['pressure_pa'],dtype=float)
        pv=np.asarray(data['path_vertices'],dtype=float)
        pt=np.asarray(data['path_time_s'],dtype=float)
        speed=np.asarray(data['path_velocity_m_s'],dtype=float)
        offsets=np.asarray(data['path_offsets'],dtype=int)
        if vertices.ndim!=2 or vertices.shape[1]!=3 or triangles.ndim!=2 or triangles.shape[1]!=3:raise ValueError('Malformed solved wall mesh')
        if pressure.ndim!=1 or len(pressure)!=len(triangles) or not len(pressure):raise ValueError('Pressure must match every numerical wall triangle')
        if triangles.min()<0 or triangles.max()>=len(vertices):raise ValueError('Wall topology indices out of bounds')
        if pv.ndim!=2 or pv.shape[1]!=3 or pt.ndim!=1 or speed.ndim!=1 or offsets.ndim!=1 or len(offsets)<3:raise ValueError('Malformed numerical pathline arrays')
        if len(pv)!=len(pt) or len(pv)!=len(speed) or offsets[0]!=0 or offsets[-1]!=len(pv):raise ValueError('Pathline array size mismatch')
        if np.any(np.diff(offsets)<2) or np.any(offsets<0):raise ValueError('Empty/short numerical pathline')
        for arr in [vertices,pressure,pv,pt,speed]:
            if not np.isfinite(arr).all():raise ValueError('Nonfinite CFD data')
        if np.any(speed<0):raise ValueError('Negative exported speed magnitude')
        centered=vertices-vertices.mean(0)
        corners=centered[triangles]
        signed_volume=np.einsum('ij,ij->i',corners[:,0],np.cross(corners[:,1],corners[:,2])).sum()/6
        winding_reversed=bool(signed_volume<0)
        if winding_reversed:triangles=triangles[:,[0,2,1]]
        self.scene=scene;self.objects=[];self.data_path=path
        for obj in objects:obj.hide_render=True;obj.hide_set(True)
        # Same handed coordinate mapping used for the supplied Javelin CAD.
        conversion=np.array([[1,0,0],[0,0,-1],[0,1,0]],dtype=float)
        source=vertices@conversion.T
        low=source.min(0);high=source.max(0);center=(low+high)*.5
        factor=2.8/max(high-low)
        shift=np.array([0,0,(high[2]-low[2])*factor*.5+.48])
        def normalized(points):return (points@conversion.T-center)*factor+shift
        surface=normalized(vertices)
        self.pressure_limits=(float(pressure.min()),float(pressure.max()))
        if self.pressure_limits[1]-self.pressure_limits[0]<=1e-8:raise ValueError('Constant pressure field; no resolved pressure difference to visualize')
        body=_colored_mesh('Actual Fluent wall static pressure',surface.tolist(),triangles.tolist(),pressure,self.pressure_limits)
        for face in body.data.polygons:face.use_smooth=True
        self.objects.append(body)
        self.wall_tree=BVHTree.FromPolygons(surface.tolist(),triangles.tolist(),all_triangles=True)
        # Crop only by retaining contiguous original solver vertices. No spline
        # smoothing, interpolation outside a solver segment or fabricated wake.
        vlo=vertices.min(0);vhi=vertices.max(0);length=float(max(vhi-vlo))
        boxlo=vlo-np.array([.24,.16,.16])*length
        boxhi=vhi+np.array([.55,.16,.16])*length
        candidates=[];rejected_crossings=[]
        for i,(start,end) in enumerate(zip(offsets[:-1],offsets[1:])):
            points=pv[start:end];times=pt[start:end];vel=speed[start:end]
            if not np.all(np.diff(times)>0):raise ValueError(f'Nonmonotonic physical path time {i}')
            inside=np.all((points>=boxlo)&(points<=boxhi),axis=1)
            runs=np.split(np.flatnonzero(inside),np.flatnonzero(np.diff(np.flatnonzero(inside))>1)+1)
            run=max(runs,key=len) if runs else np.array([],dtype=int)
            if len(run)<5:continue
            points=points[run];times=times[run];vel=vel[run]
            if np.ptp(points[:,0])<.55*(vhi[0]-vlo[0]):continue
            display_points=normalized(points)
            crosses=False;clearance=float('inf')
            for a,b in zip(display_points[:-1],display_points[1:]):
                delta=b-a;distance=float(np.linalg.norm(delta))
                if distance<=1e-12:raise ValueError(f'Duplicate consecutive numerical path vertices {i}')
                hit=self.wall_tree.ray_cast(Vector(a),Vector(delta/distance),distance)
                if hit[0] is not None and 1e-6<hit[3]<distance-1e-6:
                    crosses=True;break
                for point in [a,(a+b)*.5,b]:
                    nearest=self.wall_tree.find_nearest(Vector(point))
                    if nearest[0] is not None:clearance=min(clearance,float(nearest[3]))
            if crosses:
                rejected_crossings.append(i);continue
            candidates.append({'id':i,'points':display_points,'times':times-times[0],'speed':vel,'clearance':clearance,
                               'originalVertexRange':[int(start+run[0]),int(start+run[-1]+1)]})
        if len(candidates)<2:raise ValueError('Too few real traces traverse the airframe; adjust Fluent seed surfaces or integration step count')
        # Deterministic farthest-origin sampling gives spatial coverage without
        # multiplying curves or presenting repetitions as additional CFD traces.
        starts=np.array([item['points'][0] for item in candidates])
        chosen=[int(np.argmin(np.linalg.norm(starts-np.mean(surface,axis=0),axis=1)))]
        while len(chosen)<min(20,len(candidates)):
            distances=np.min(np.linalg.norm(starts[:,None,:]-starts[chosen][None,:,:],axis=2),axis=1)
            distances[chosen]=-1;chosen.append(int(np.argmax(distances)))
        self.paths=[candidates[i] for i in chosen]
        durations=[item['times'][-1] for item in self.paths]
        self.physical_duration=float(np.median(durations)*1.4)
        line_material=_emission_material('Numerical streamline quiet cyan',(.035,.22,.28),.35)
        head_material=_emission_material('Advected solver particle pale cyan',(.36,.92,1),2)
        self.particles=[]
        for i,item in enumerate(self.paths):
            line=_curve(f'Fluent path {item["id"]}',item['points'],min(.0028,item['clearance']*.4),line_material)
            self.objects.append(line)
            for marker in range(2):
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.014)
                obj=bpy.context.object;obj.name=f'Numerical tracer {i:02} {marker}'
                obj.data.materials.append(head_material);self.objects.append(obj)
                self.particles.append((obj,item,(i*.137+marker*.5)%1))
        # Compose a genuine 3D scene with readable Pa legend in its camera plane.
        allpoints=np.concatenate([surface]+[item['points'] for item in self.paths])
        target=Vector((allpoints.min(0)+allpoints.max(0))*.5)
        camera=scene.camera
        camera.location=target+Vector((-1.3,-2.6,1.45)).normalized()*9
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.type='ORTHO';camera.data.ortho_scale=5.1
        rotation=camera.rotation_euler.copy();quat=rotation.to_quaternion()
        right=quat@Vector((1,0,0));up=quat@Vector((0,1,0));front=quat@Vector((0,0,1))
        rel=allpoints-np.array(target);xs=rel@np.array(right);ys=rel@np.array(up)
        anchor=target+right*float(xs.min()+.10)+up*float(ys.min()-.22)+front*.4
        label_material=_emission_material('CFD legend white',(.7,.76,.8),.8)
        self.objects.append(_text('Pressure legend label','Gauge pressure (Pa) / asinh scale',anchor+up*.14,rotation,.09,label_material))
        barverts=[];barfaces=[];barvalues=[]
        bar_width=1.9;bar_steps=128
        for i in range(bar_steps):
            left=anchor+right*(i/bar_steps*bar_width);rightpt=anchor+right*((i+1)/bar_steps*bar_width)
            off=len(barverts);barverts.extend([list(left),list(rightpt),list(rightpt+up*.055),list(left+up*.055)])
            barfaces.append((off,off+1,off+2,off+3));barvalues.append(float(_pressure_value((i+.5)/bar_steps,*self.pressure_limits)))
        self.objects.append(_colored_mesh('Actual pressure range color scale',barverts,barfaces,barvalues,self.pressure_limits))
        legend_ticks=[self.pressure_limits[0],-2000.,0.,2000.,self.pressure_limits[1]]
        for value in legend_ticks:
            position=anchor+right*(float(_pressure_coordinate(value,*self.pressure_limits))*bar_width)
            label=('0' if value==0 else f'{value/1000:+.1f}k').replace('.0k','k')
            text=_text(f'Pressure tick {value:g} Pa',label,position-up*.12,rotation,.078,label_material)
            text.data.align_x='CENTER';self.objects.append(text)
            self.objects.append(_curve(f'Pressure tick mark {value:g}',[position,position-up*.035],.003,label_material))
        self.apply(0)
        bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
        minimum=float(allpoints[:,2].min()-.014)
        for obj in self.objects:
            evaluated=obj.evaluated_get(deps)
            mesh=evaluated.to_mesh() if evaluated.type!='MESH' else evaluated.data
            if len(mesh.vertices):minimum=min(minimum,min((evaluated.matrix_world@vertex.co).z for vertex in mesh.vertices))
            if evaluated.type!='MESH':evaluated.to_mesh_clear()
        floor=minimum-.04
        self.report={'mode':'flow','source':'Actual newly solved Fluent wall pressure and Fluent numerical pathline vertices.',
            'scope':provenance.get('scope'),'solver':provenance.get('solver'),'dataSha256':digest,
            'dataPath':str(path),'provenancePath':str(metadata_path),'pressureRangePa':list(self.pressure_limits),
            'pressureColorLimitsPa':list(self.pressure_limits),'pressureClipping':False,
            'pressureColorDisplay':'Zero-centered blue-to-orange/red diverging colors with full-range asinh normalization. The wall and labeled nonlinear legend use the same unlit transfer; no pressure interpolation or clipping.',
            'pressureColorNormalization':{'method':'zero-centered asinh','scalePa':PRESSURE_SCALE_PA,'separateNegativePositiveExtents':True,'legendTicksPa':legend_ticks,'positions':PRESSURE_COLOR_POSITIONS.tolist(),'linearRgbAnchors':PRESSURE_COLOR_ANCHORS.tolist()},
            'surfaceTriangles':len(triangles),'sourcePaths':len(offsets)-1,'displayedPaths':len(self.paths),
            'surfaceWindingReversedForOutwardDisplay':winding_reversed,
            'displayedPathRanges':[{'id':item['id'],'vertexRange':item['originalVertexRange']} for item in self.paths],
            'excludedPathsWithSegmentWallCrossing':rejected_crossings,
            'displayedPolylineSegmentWallCrossings':0,
            'markerRadiusPolicy':'Marker centers remain on numerical paths; marker radius shrinks near the actual wall to avoid visual penetration.',
            'pathTimeMethods':provenance.get('pathTimeMethods'),'physicalPlaybackSeconds':self.physical_duration,
            'particleInterpolation':'Piecewise linear between consecutive exported numerical path vertices, parameterized by actual exported/integrated physical travel time.',
            'pressureAnimation':'Steady solved field held constant; only marker advection is animated.',
            'floorMinimum':floor,'normalizationScale':factor,'arbitrarySeek':True,'originalMonitorHidden':True}
        self.apply(0)

    def apply(self,progress):
        clock=min(1,max(0,float(progress)))*self.physical_duration
        for obj,path,phase in self.particles:
            times=path['times'];duration=float(times[-1])
            time=(clock+phase*duration)%duration
            index=min(len(times)-2,max(0,int(np.searchsorted(times,time,side='right')-1)))
            amount=(time-times[index])/(times[index+1]-times[index])
            obj.location=path['points'][index]*(1-amount)+path['points'][index+1]*amount
            edge=min(time/duration,(duration-time)/duration)
            fade=min(1,max(0,edge/.045));fade=fade*fade*(3-2*fade)
            nearest=self.wall_tree.find_nearest(obj.location)
            if nearest[0] is not None:fade*=min(1,max(0,float(nearest[3])/.014*.65))
            obj.scale=(fade,fade,fade)


def build_flow(objects,scene):return FluentFlow(objects,scene)
