"""Reversible, qualitative function illustrations on the approved cover scenes.

Source geometry is retained in place except explicitly identified moving parts.
Added vine and deformed specimen illustrate function, not measured pressure,
strain, fracture load, speed or material response.
"""
import math
import bpy
import numpy as np
from mathutils import Matrix, Vector


def _clamp(p): return min(1., max(0., float(p)))
def _smooth(p):
    p=_clamp(p)
    return p*p*(3-2*p)


def _coords(obj):
    return np.array([obj.matrix_world@v.co for v in obj.data.vertices],dtype=float)


def _set_coords(obj,coords):
    obj.data.vertices.foreach_set('co',np.asarray(coords,dtype=np.float32).ravel())
    obj.data.update()


class _Base:
    def __init__(self,parts,scene):
        self.parts=parts
        self.scene=scene
        self.objects=[p['object'] for p in parts]
        self.original={o.name:o.matrix_world.copy() for o in self.objects}


class Propellers(_Base):
    mode='rotation'
    def __init__(self,parts,scene):
        super().__init__(parts,scene)
        props=[p for p in parts if p['original']=='mat_propeller']
        # The original display source explicitly builds a 48-sided annular hub
        # per motor. Unlike blade AABBs, the hub centre is exactly on the shaft.
        hubs=[p for p in props if p['size'].y<.1 and p['size'].z<.1]
        assert len(hubs)==4,(len(hubs),'Expected four original annular hubs')
        self.rotors=[]
        for rank,hub in enumerate(sorted(hubs,key=lambda p:p['name'])):
            center=Vector(hub['center'])
            members=[p['object'] for p in props if
                     min(hubs,key=lambda h:(p['center']-h['center']).length)==hub]
            assert len(members)==3,'Each original rotor has two blades and one hub'
            # Keep the simplified original shaft/nut CAD finish geometry fixed;
            # only the requested blades and their annular hub are animated.
            axis=Vector((1,0,0))
            radius=max(np.linalg.norm(_coords(o)[:,1:]-np.array(center)[1:],axis=1).max() for o in members)
            self.rotors.append((center,axis,1 if rank in (0,2) else -1,members,float(radius)))
        floor=min(c.z-r for c,a,h,ms,r in self.rotors)
        self.report={
            'mode':self.mode,'source':'Original Javelin motor CAD; existing photo-informed display propellers and bored nuts from mechanical_sources.py.',
            'demonstration':'Four balanced coaxial rotations; direction pairing and angular timing illustrate operation, not measured RPM.',
            'rotorCount':4,'turns':5.375,'floorMinimum':floor,
            'fixedParts':[o.name for o in self.objects if all(o not in r[3] for r in self.rotors)],
            'motionGroups':[{'name':f'rotor_{i+1}','axis':list(a),'center':list(c),
                            'parts':[o.name for o in ms],'radialEnvelope':r,'handedness':h}
                           for i,(c,a,h,ms,r) in enumerate(self.rotors)],
            'sourceMotorBasesFixed':True,'arbitrarySeek':True}
        self.report['sourceMatingContacts']='The rotating annular hubs retain their original coplanar contact with fixed display nuts; their axial solid bounds have zero overlap.'
        self.apply(0)

    def apply(self,progress):
        angle=math.tau*5.375*_clamp(progress)
        for center,axis,handed,objects,radius in self.rotors:
            transform=Matrix.Translation(center)@Matrix.Rotation(handed*angle,4,axis)@Matrix.Translation(-center)
            for obj in objects:obj.matrix_world=transform@self.original[obj.name]
        self.scene.frame_set(self.scene.frame_current)


class VineGrowth(_Base):
    mode='growth'
    def __init__(self,parts,scene):
        super().__init__(parts,scene)
        # White r52mm_coupler is the circular opening of the blue side funnel;
        # its source vertices identify both the exit plane and bore clearance.
        ring=next(p for p in parts if p['original']=='mat_aero' and p['center'].x<-1
                  and .6<p['size'].y<.8 and .6<p['size'].z<.8)
        points=_coords(ring['object']);plane=float(points[:,0].min())
        self.origin=np.array([plane+.008,ring['center'].y,ring['center'].z])
        front=points[points[:,0]<plane+.001]
        bore=float(np.linalg.norm(front[:,1:]-self.origin[1:],axis=1).min())
        self.radius=bore-.024
        self.length=1.72
        self.rings=64;self.segments=64;self.foldrings=16
        n=(self.rings*2+self.foldrings-1)*self.segments
        faces=[]
        for i in range(n//self.segments-1):
            for j in range(self.segments):
                a=i*self.segments+j;b=i*self.segments+(j+1)%self.segments
                faces.append((a,b,b+self.segments,a+self.segments))
        mesh=bpy.data.meshes.new('Qualitative everted thin-film vine')
        mesh.from_pydata([(0,0,0)]*n,[],faces);mesh.update()
        self.vine=bpy.data.objects.new('Functional vine — growing outer wall, rolling tip, inner return',mesh)
        scene.collection.objects.link(self.vine);self.objects.append(self.vine)
        material=bpy.data.materials.new('Translucent pale blue thin polymer film')
        material.use_nodes=True
        bs=material.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value=(.56,.80,.84,1)
        bs.inputs['Transmission Weight'].default_value=.93
        bs.inputs['Roughness'].default_value=.18
        bs.inputs['IOR'].default_value=1.38
        bs.inputs['Specular IOR Level'].default_value=.35
        mesh.materials.append(material)
        for face in mesh.polygons:face.use_smooth=True
        solid=self.vine.modifiers.new('Thin display film wall','SOLIDIFY');solid.thickness=.003;solid.offset=0
        self.report={
            'mode':self.mode,'source':'Existing Bucketbot CAD side funnel and r52mm coupler; assets/vine-outlet-exploded.webp and source material mapping identify the outlet.',
            'demonstration':'Added translucent double-wall tube everts from the actual side outlet. Growth, gentle sag, inner return and film thickness are qualitative display geometry; no pressure or measured travel claimed.',
            'outletSourcePart':ring['name'],'outletCenter':self.origin.tolist(),'axis':[-1,0,0],
            'sourceBoreRadius':bore,'outerRadius':self.radius,'boreRadialClearance':bore-self.radius-.0015,
            'growthRange':[.07,.07+self.length],'thinWallThickness':.003,
            'motionGroups':[{'name':'everted_vine','parts':[self.vine.name],'axis':[-1,0,0]}],
            'sourceHardwareFixed':True,'arbitrarySeek':True}
        self.apply(0)

    def apply(self,progress):
        length=.07+self.length*_smooth(progress)
        outer=self.radius;inner=.092;fold=(outer-inner)*.5
        # Spatially anchored exterior: it emerges at the rolling distal fold;
        # the inner return is visible through the semi-transparent outer wall.
        profile=[]
        for i in range(self.rings):profile.append((length*i/(self.rings-1),outer,0))
        for i in range(1,self.foldrings+1):
            angle=math.pi*i/self.foldrings
            profile.append((length+fold*math.sin(angle),(outer+inner)*.5+fold*math.cos(angle),1))
        for i in range(1,self.rings):profile.append((length*(1-i/(self.rings-1)),inner,2))
        vertices=[]
        for distance,radius,kind in profile:
            for j in range(self.segments):
                angle=math.tau*j/self.segments
                wrinkle=.0035*math.sin(7*angle+distance*2)*math.sin(min(1,distance/.12)*math.pi/2)
                if kind==1:wrinkle*=.3
                radial=radius+wrinkle
                vertices.append((self.origin[0]-distance,self.origin[1]+radial*math.cos(angle),
                                 self.origin[2]+radial*math.sin(angle)-.07*(distance/(.07+self.length))**2))
        _set_coords(self.vine,vertices)


class TensileTest(_Base):
    mode='tensile'
    def __init__(self,parts,scene):
        super().__init__(parts,scene)
        specimen=next(p['object'] for p in parts if 'tensile_specimen' in p['name'])
        self.source_specimen=specimen
        self.base=_coords(specimen)
        lo=self.base.min(0);hi=self.base.max(0)
        self.bottom=float(lo[2]);self.top=float(hi[2]);self.mid=(self.bottom+self.top)*.5
        self.xcenter=float((lo[0]+hi[0])*.5)
        self.gauge=self.top-self.bottom
        # One existing jaw set is fixed at the base; its counterpart, load cell,
        # coupling and crosshead travel together along the actual vertical column.
        names=('grip','jaw','upper_','load_cell_socket','collar_knurl','crosshead')
        self.moving=[p['object'] for p in parts if p['center'].z>self.mid
                     and any(word in p['name'] for word in names)]
        assert len(self.moving)>15
        self.cable=next(p['object'] for p in parts if 'load_cell_signal_cable' in p['name'])
        self.cabledata=_coords(self.cable)
        # Preserve the immutable approved specimen; a display duplicate carries
        # two halves with identical coincident seam vertices until rupture.
        coords=self.base.tolist();faces=[]
        seam=[i for i,v in enumerate(self.base) if abs(v[2]-self.mid)<1e-6]
        assert len(seam) in (5,10),('Unexpected specimen seam topology',len(seam))
        duplicate={i:len(coords)+j for j,i in enumerate(seam)}
        coords.extend(self.base[seam].tolist())
        upper_ids=set()
        for face in specimen.data.polygons:
            ids=list(face.vertices)
            if np.mean(self.base[ids,2])>self.mid:
                ids=[duplicate.get(i,i) for i in ids];upper_ids.update(ids)
            faces.append(ids)
        if len(seam)==10:
            # The builder's conversion has already baked the sheet thickness.
            # Close both new cross sections so the retained halves remain solids.
            ordered=sorted(seam,key=lambda i:(round(self.base[i,0],6),self.base[i,1]))
            for j in range(4):
                a,b=ordered[2*j:2*j+2];c,d=ordered[2*j+2:2*j+4]
                cap=(a,c,d,b)
                faces.append(cap);faces.append(tuple(duplicate[i] for i in reversed(cap)))
        mesh=bpy.data.meshes.new('Qualitative specimen with retained gripped halves')
        mesh.from_pydata(coords,[],faces);mesh.update()
        for mat in specimen.data.materials:mesh.materials.append(mat)
        self.strip=bpy.data.objects.new('Functional tensile specimen — two retained fracture halves',mesh)
        scene.collection.objects.link(self.strip)
        if len(seam)==5:
            solid=self.strip.modifiers.new('Original thin specimen sheet','SOLIDIFY')
            solid.thickness=next((m.thickness for m in specimen.modifiers if m.type=='SOLIDIFY'),.00065)
        self.coords=np.array(coords);self.upper=np.array([i in upper_ids for i in range(len(coords))])
        self.t=(self.coords[:,2]-self.bottom)/self.gauge
        self.objects.remove(specimen);self.objects.append(self.strip)
        specimen.hide_render=True;specimen.hide_set(True)
        # Source cable remains its original mesh at reset; copied data deforms
        # its moving socket end while its rear-shell end remains fixed.
        self.cable.data=self.cable.data.copy()
        cable_y=self.cabledata[:,1]
        self.cableweight=np.clip(((cable_y.max()-cable_y)/(cable_y.max()-cable_y.min())-.12)/.76,0,1)
        self.cableweight=self.cableweight**2*(3-2*self.cableweight)
        self.report={
            'mode':self.mode,'source':'Photo-based single-column instrument reconstruction in material-test/build_material_test.py; actual source strip and coaxial spring grips.',
            'demonstration':'Qualitative extension, local necking and rupture of the displayed fabric strip. Not a measured stress-strain curve or fracture load; machine proportions are photo inferred.',
            'axis':[0,0,1],'fixedLowerFixture':True,'initialSpecimenSpan':self.gauge,
            'upperFixtureTravel':.235,'fractureProgress':.74,'retainedHalves':2,
            'motionGroups':[{'name':'upper_crosshead_and_grip','parts':[o.name for o in self.moving],'axis':[0,0,1]},
                            {'name':'specimen_deformation','parts':[self.strip.name]}],
            'specimenEndPlanes':[self.bottom,self.top],'arbitrarySeek':True}
        self.report['sourceMatingContacts']='The source crosshead remains at its existing bellows/column guide interface while sliding vertically; gripped specimen ends remain within the source jaws.'
        self.apply(0)

    def apply(self,progress):
        p=_clamp(progress);loading=_smooth(p/.74);broken=_smooth((p-.74)/.26)
        extension=.17*loading;extra=.065*broken;recoil=.018*broken
        for obj in self.moving:obj.matrix_world=Matrix.Translation((0,0,extension+extra))@self.original[obj.name]
        cable=self.cabledata.copy();cable[:,2]+=(extension+extra)*self.cableweight
        _set_coords(self.cable,cable)
        v=self.coords.copy();t=self.t
        neck=np.exp(-((t-.5)/.17)**2)*np.sin(np.pi*t)**2
        v[:,0]=self.xcenter+(v[:,0]-self.xcenter)*(1-.58*loading*neck)
        v[:,2]+=extension*t
        # The shared, slightly irregular fracture line forms continuously, then
        # parts; both terminal rows stay exactly within their respective jaws.
        transverse=(self.coords[:,0]-self.xcenter)/(self.base[:,0].max()-self.base[:,0].min())
        v[:,2]+=.0035*np.sin(transverse*15)*neck*_smooth((p-.48)/.26)
        v[~self.upper,2]-=recoil*2*t[~self.upper]
        v[self.upper,2]+=extra+recoil*2*(1-t[self.upper])
        _set_coords(self.strip,v)


def build_functional(key,parts,scene):
    cls={'vineRobot':VineGrowth,'javelin':Propellers,'materialTest':TensileTest}.get(key)
    if cls is None:raise ValueError(f'No functional process for {key}')
    return cls(parts,scene)
