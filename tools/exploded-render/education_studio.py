"""Education-only photographic staging; source parts and assembly stay intact."""
import math
import bpy
from mathutils import Vector

def apply_studio(scene, ground, variant='aligned-sweep'):
    camera=scene.camera
    right=camera.rotation_euler.to_quaternion()@Vector((1,0,0))
    up=camera.rotation_euler.to_quaternion()@Vector((0,1,0))
    direction=camera.rotation_euler.to_quaternion()@Vector((0,0,1))
    target=Vector((0,0,.8573147058486938))
    records=[]
    for name,location in [
        ('Large silver key',target+direction*3.5-right*3+up*3),
        ('Long overhead reflection',target+up*4-direction*.5),
        ('Neutral front fill',target+direction*4+right*3),
        ('Restrained cold rim',target-direction*2+right*2.4+up*1.6),
    ]:
        lamp=bpy.data.objects[name]
        before={'location':list(lamp.location),'rotation':list(lamp.rotation_euler)}
        lamp.location=location
        lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
        records.append({'name':name,'before':before,'after':{'location':list(lamp.location),'rotation':list(lamp.rotation_euler)},'energy':lamp.data.energy,'color':list(lamp.data.color),'size':lamp.data.size,'sizeY':lamp.data.size_y})
    sweep=None
    if variant=='aligned-sweep':
        # Replace only the existing staging plane with a smooth cyclorama.
        # The front floor keeps the same Z, material and source-model clearance.
        back=Vector((-direction.x,-direction.y,0)).normalized()
        horizontal=Vector((right.x,right.y,0)).normalized()
        profile=[(-80.,0.),(2.5,0.)]
        radius=2.
        for i in range(1,49):
            angle=math.pi*.5*i/48
            profile.append((2.5+radius*math.sin(angle),radius*(1-math.cos(angle))))
        profile.append((4.5,20.))
        vertices=[tuple(horizontal*x+back*depth+Vector((0,0,z))) for depth,z in profile for x in (-80.,80.)]
        faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(profile)-1)]
        mesh=bpy.data.meshes.new('Education photographic cyclorama — staging only')
        mesh.from_pydata(vertices,[],faces)
        for mat in ground.data.materials:mesh.materials.append(mat)
        for face in mesh.polygons:face.use_smooth=True
        mesh.update()
        ground.data=mesh
        sweep={'profile':profile,'radius':radius,'width':160.,'groundZ':ground.location.z,'material':ground.data.materials[0].name}
    return {'revision':'detail-resolution-20260914','variant':variant,'policy':'Reposition the unchanged four-light recipe relative to the actual education camera; photographic staging only. Source CAD meshes/materials, camera and assembly path remain unchanged.','lights':records,'sweep':sweep}
