"""Render the education assembly with continuous graphite studio staging.

The established renderer computes all poses and the exact 640x427 camera frame.
This wrapper changes photographic staging only, renders 1280x854 animation PNGs,
and optionally produces the same p0 scene at 1800x1200 / 192 samples.
"""
import argparse
import ast
import hashlib
import json
import random
import sys
import time
from pathlib import Path

import bpy
import numpy as np

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
RENDERER=HERE/'render_exploded.py'
sys.path.insert(0,str(HERE))
from education_studio import apply_studio
from render_initial_covers import camera_state,camera_frame,serial

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def geometry_material_digest(objects):
    digest=hashlib.sha256()
    counts=[]
    for obj in sorted(objects,key=lambda item:item.name):
        if obj.type!='MESH':continue
        mesh=obj.data
        digest.update(obj.name.encode())
        for collection,attribute,width,dtype in ((mesh.vertices,'co',3,np.float32),(mesh.loops,'vertex_index',1,np.int32),(mesh.polygons,'material_index',1,np.int32)):
            values=np.empty(len(collection)*width,dtype=dtype)
            collection.foreach_get(attribute,values)
            digest.update(values.tobytes())
        for mat in mesh.materials:
            if mat is None:continue
            record={'name':mat.name,'diffuse':list(mat.diffuse_color),'nodes':[],'links':[]}
            if mat.use_nodes:
                record['nodes']=[[node.name,node.bl_idname,[[socket.name,serial(socket.default_value)] for socket in node.inputs if hasattr(socket,'default_value')],getattr(node,'operation',None)] for node in mat.node_tree.nodes]
                record['links']=[[link.from_node.name,link.from_socket.name,link.to_node.name,link.to_socket.name] for link in mat.node_tree.links]
            digest.update(json.dumps(record,sort_keys=True).encode())
        counts.append({'name':obj.name,'vertices':len(mesh.vertices),'faces':len(mesh.polygons)})
    return {'sha256':digest.hexdigest(),'objects':counts,'faces':sum(o['faces'] for o in counts)}

def matrices(objects):
    return np.asarray([np.asarray(o.matrix_world,dtype=np.float64) for o in objects])

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--evidence',type=Path,required=True)
    parser.add_argument('--samples',type=int,default=48)
    parser.add_argument('--only',nargs='*',type=int)
    parser.add_argument('--cover',action='store_true',help='Also render the exact p0 scene at 1800x1200 / 192 samples.')
    parser.add_argument('--cover-only',action='store_true',help='Render the current p0 cover and its 1280x854 verification frame only.')
    opts=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    opts.output=opts.output.resolve();opts.evidence=opts.evidence.resolve()
    opts.evidence.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((ROOT/'assets/exploded/manifest.json').read_text())
    source=manifest['projects']['education']
    # The original controller/camera reference remains immutable even after
    # the runtime manifest is updated to this new staging revision.
    original_provenance=ROOT/'assets/exploded/functional-20260913/education/provenance.json'
    previous=json.loads(original_provenance.read_text())
    audit={'status':'pending','originalAnimationProvenance':str(original_provenance.relative_to(ROOT)).replace('\\','/'),'originalAnimationProvenanceSha256':sha(original_provenance),'sourceGLBSha256':sha(ROOT/'tools/editorial-render/sources/education.glb'),'sourceCamera':{k:previous[k] for k in ('cameraLocation','cameraRotation','cameraOrthoScale')},'frameCount':121,'samples':opts.samples,'stagingRevision':'detail-resolution-20260914'}
    initialized=False
    initial_camera=None
    initial_frame=None
    maximum_projection_error=0.
    before_geometry=None

    def capture(key,motion,ground,scene,out,index,progress):
        nonlocal initialized,initial_camera,initial_frame,maximum_projection_error,before_geometry
        assert key=='education'
        scene.render.resolution_x,scene.render.resolution_y=640,427
        scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
        bpy.context.view_layer.update()
        if not initialized:
            assert len(motion.report['stages'])==23
            assert motion.report==previous['motion'], 'Source assembly controller changed'
            camera=scene.camera
            assert list(camera.location)==previous['cameraLocation']
            assert list(camera.rotation_euler)==previous['cameraRotation']
            assert float(camera.data.ortho_scale)==previous['cameraOrthoScale']
            initial_camera=camera_state(scene);initial_frame=camera_frame(scene)
            before_geometry=geometry_material_digest(motion.objects)
            baseline=[]
            for p in range(121):
                motion.apply(p/120)
                baseline.append(matrices(motion.objects))
            motion.apply(progress)
            before_pose=matrices(motion.objects)
            staging=apply_studio(scene,ground,'aligned-sweep')
            bpy.context.view_layer.update()
            assert np.array_equal(before_pose,matrices(motion.objects))
            assert before_geometry==geometry_material_digest(motion.objects)
            sequence=list(range(121))+list(reversed(range(121)))
            rng=random.Random(20260914)
            sequence += [rng.randrange(121) for _ in range(60)]
            errors=[]
            for p in sequence:
                motion.apply(p/120)
                errors.append(float(np.max(np.abs(baseline[p]-matrices(motion.objects)))))
            assert max(errors)==0.,max(errors)
            motion.apply(progress)
            audit.update(studio=staging,motionReportUnchanged=True,stageCount=23,sourceGeometryAndMaterials=before_geometry,sourceGeometryAndMaterialsUnchanged=True,sourcePoseMaximumMatrixError=0.,seekChecks=len(sequence),seekMaximumMatrixError=max(errors),sourceCameraUnchanged=True,camera=initial_camera)
            initialized=True
        assert camera_state(scene)==initial_camera
        scene.render.resolution_x,scene.render.resolution_y=1280,854
        scene.cycles.samples=opts.samples
        scene.cycles.adaptive_threshold=.03
        scene.render.image_settings.color_mode='RGB'
        scene.render.image_settings.color_depth='8'
        bpy.context.view_layer.update()
        error=float(np.max(np.abs(camera_frame(scene)-initial_frame)))
        maximum_projection_error=max(maximum_projection_error,error)
        assert error<2e-6,error
        bpy.ops.render.render(write_still=True)
        if index==0 and (opts.cover or opts.cover_only):
            frame_path=Path(scene.render.filepath)
            master=opts.evidence/'cover.png'
            before_cover_pose=matrices(motion.objects)
            scene.render.resolution_x,scene.render.resolution_y=1800,1200
            scene.render.pixel_aspect_x=1
            scene.render.pixel_aspect_y=(1800/1200)/(640/427)
            scene.cycles.samples=192
            scene.cycles.adaptive_threshold=.008
            scene.render.filepath=str(master)
            bpy.context.view_layer.update()
            cover_error=float(np.max(np.abs(camera_frame(scene)-initial_frame)))
            assert cover_error<2e-6,cover_error
            assert np.array_equal(before_cover_pose,matrices(motion.objects))
            assert camera_state(scene)==initial_camera
            start=time.monotonic()
            bpy.ops.render.render(write_still=True)
            cover={'project':'education','coverProgress':0.,'dimensions':[1800,1200],'samples':192,'pixelAspect':[scene.render.pixel_aspect_x,scene.render.pixel_aspect_y],'masterPNG':str(master),'masterSha256':sha(master),'sourceHDFramePNG':str(frame_path),'sourceHDFramePNGSha256':sha(frame_path),'camera':initial_camera,'cameraFrameMaximumError':cover_error,'geometryAndMaterialsSha256':before_geometry['sha256'],'sourceGeometryAndMaterialsUnchanged':True,'motionReportUnchanged':True,'stageCount':23,'studio':audit['studio'],'renderer':'tools/exploded-render/render_education_studio.py','rendererSha256':sha(__file__),'studioHelper':'tools/exploded-render/education_studio.py','studioHelperSha256':sha(HERE/'education_studio.py'),'animationRenderer':'tools/exploded-render/render_exploded.py','animationRendererSha256':sha(RENDERER),'renderSeconds':time.monotonic()-start}
            (opts.evidence/'cover-provenance.json').write_text(json.dumps(cover,indent=2)+'\n')
            scene.render.resolution_x,scene.render.resolution_y=1280,854
            scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
            scene.cycles.samples=opts.samples
            scene.cycles.adaptive_threshold=.03
            scene.render.filepath=str(frame_path)

    tree=ast.parse(RENDERER.read_text(encoding='utf-8'))
    tree.body=[n for n in tree.body if not isinstance(n,ast.For)]
    fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='render')
    class Intercept(ast.NodeTransformer):
        def visit_Call(self,node):
            if ast.unparse(node.func)=='bpy.ops.render.render':
                return ast.copy_location(ast.parse('capture(key,motion,ground,scene,out,index,progress)').body[0].value,node)
            return self.generic_visit(node)
    Intercept().visit(fn);ast.fix_missing_locations(tree)
    namespace={'__file__':str(RENDERER),'__name__':'education_studio_scene','capture':capture}
    sys.argv=['blender','--','--projects','education','--frames','121','--width','640','--samples',str(opts.samples),'--output',str(opts.output)]
    if opts.cover_only:sys.argv+=['--only','0']
    elif opts.only is not None:sys.argv+=['--only',*[str(i) for i in opts.only]]
    exec(compile(tree,str(RENDERER),'exec'),namespace)
    namespace['render']('education')
    report_path=opts.output/'education/provenance.json'
    report=json.loads(report_path.read_text())
    report.update(motionRevision='detail-resolution-20260914',sourceAnimationProvenance=audit['originalAnimationProvenance'],sourceAnimationProvenanceSha256=audit['originalAnimationProvenanceSha256'],projectionPolicy='Compute all framing at the original 640x427 resolution, then render at exactly 1280x854 with identical camera frame.',cameraFrameMaximumError=maximum_projection_error,sourcePreservation=audit,renderer='tools/exploded-render/render_education_studio.py',rendererSha256=sha(__file__),studioHelper='tools/exploded-render/education_studio.py',studioHelperSha256=sha(HERE/'education_studio.py'),animationRenderer='tools/exploded-render/render_exploded.py',animationRendererSha256=sha(RENDERER))
    report['sourcePreservation']['status']='passed'
    assert (report['width'],report['height'])==(1280,854)
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    audit.update(status='passed',cameraFrameMaximumError=maximum_projection_error,generatedFrames=len(report['timings']),rendererSha256=sha(__file__),studioHelperSha256=sha(HERE/'education_studio.py'))
    (opts.evidence/'source-preservation.json').write_text(json.dumps(audit,indent=2)+'\n')
    print('EDUCATION_STUDIO_COMPLETE',len(report['timings']),'frames',flush=True)

if __name__=='__main__':main()
