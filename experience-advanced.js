import * as THREE from 'three';
import { getGpuDevice, getGpuDeviceStats } from './experience-gpu-device.js?v=advanced-render-20260930';
import { createTemporalUpscaler } from './experience-temporal.js?v=advanced-render-20260930';
import { createStationaryRayTracer } from './experience-raytrace.js?v=advanced-render-20260930';
import { createRaytraceGBufferCapture } from './experience-raytrace-capture.js?v=advanced-render-20260930';
import { createRaytraceMaterialBridge } from './experience-ray-material.js?v=advanced-render-20260930';
import { createClusterRenderer } from './experience-clusters.js?v=advanced-render-20260930';
import { FrameBudgetScheduler, scheduleShaderPrewarm } from './experience-frame-budget.js?v=advanced-render-20260930';

// WebGL keeps the verified source/baked materials; optional compute runs beside
// it. Expensive refinement starts after interaction, never on the startup path.
export function createAdvancedRenderer({renderer,scene,camera,composer,gtao,key,resumeSpot,lowTier=false,exclude=[]}){
 const computeEnabled=!lowTier && new URL(location.href).searchParams.get('compute')!=='off';
 const temporal=createTemporalUpscaler(renderer,{samples:lowTier?8:16});
 const bridge=createRaytraceMaterialBridge({aoStrength:.18,shadowStrength:1});
 const capture=createRaytraceGBufferCapture(renderer,{maxPixels:65536});
 // Narrow devices reuse depth resolved by the existing scene pass. A second
 // normal/depth render would erase much of the temporal upscaler's saving.
 const sceneDepthTargets=lowTier?[composer.renderTarget1,composer.renderTarget2]:[];
 for(const target of sceneDepthTargets){target.depthTexture=new THREE.DepthTexture(target.width,target.height,THREE.UnsignedIntType);target.depthBuffer=true;target.dispose();}
 const scheduler=new FrameBudgetScheduler({movingBudgetMs:.4,idleBudgetMs:3,maxInFlight:2});
 const clusters=createClusterRenderer({gpu:computeEnabled,getDevice:()=>getGpuDevice({disabled:!computeEnabled}),maxBytes:lowTier?8*1024*1024:24*1024*1024});
 let width=1,height=1,dpr=1,inputScale=1,started=false,disposed=false,moving=true,previousMoving=true,dirty=true;
 let idleSince=0,revision=0,captureToken=0,geometryGeneration=0,geometryDirty=true,geometryBuilding=false;
 let snapshot=null,rayCaptured=false,capturing=false,lastLight='',lastAttention='',lastClusterUploads=-1,rayQueued=false;
 let frameRenders=0,cachedFrames=0,registrations=0,lastError=null,rayFailed=false,ambientFrames=0,lastReactiveRects=0;
 const previousRects=new WeakMap();
 const reactiveMeshes=[],bbox=new THREE.Box3(),point=new THREE.Vector3();
 const tracer=createStationaryRayTracer({deviceProvider:()=>getGpuDevice({disabled:!computeEnabled}),maxPixels:65536,targetSamples:24,tilePixels:8192,
   onUpdate(update){if(disposed||moving||!snapshot)return;bridge.publish(update,snapshot);dirty=true;temporal.invalidate('ray-refinement');},
   onState(state){if(['fallback','unsupported'].includes(state.state)){
     lastError=state.reason;rayFailed=true;rayCaptured=false;snapshot=null;bridge.invalidate('compute-fallback');temporal.invalidate('compute-fallback');dirty=true;
   }}});
 function invalidate(reason='scene',{geometry=false,history=true}={}){
   revision++;captureToken++;dirty=true;rayCaptured=false;snapshot=null;
   tracer.invalidate(reason);bridge.invalidate(reason);if(history)temporal.invalidate(reason);
   if(geometry){geometryDirty=true;geometryGeneration++;rayFailed=false;}
 }
 function scanReactive(){reactiveMeshes.length=0;scene.traverse(o=>{
   if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];
   if(materials.some(m=>m?.transparent||m?.transmission))reactiveMeshes.push(o);
 });}
 function install(){bridge.install(scene);scanReactive();}
 function register(){registrations++;void clusters.registerRoot(scene,{exclude}).then(()=>{if(!disposed){dirty=true;temporal.invalidate('cluster-ready');}}).catch(e=>{lastError=e.message;});}
 function resize(w,h,baseDpr){
   const changed=width!==w||height!==h||dpr!==baseDpr;width=w;height=h;dpr=baseDpr;
   temporal.resize(w*dpr,h*dpr);if(changed){inputScale=-1;invalidate('viewport');}
 }
 function setScale(scale){
   const desired=moving?Math.max(.55,Math.min(.82,.8*scale)):Math.min(lowTier?1:1.2,Math.sqrt((lowTier?3e6:10e6)/Math.max(1,width*height*dpr*dpr)));
   if(Math.abs(desired-inputScale)<.001)return;
   inputScale=desired;composer.setPixelRatio(dpr*desired);composer.setSize(width,height);dirty=true;
 }
 function update({now,moving:isMoving,scale=1,geometryChanged=false,lightStamp='',attentionKey='',attentionPosition=null,reactive=false,ambientChanged=false}){
   moving=!!isMoving;previousMoving!==moving && temporal.invalidate(moving?'motion':'settled');
   if(moving){idleSince=now;if(rayCaptured||snapshot||capturing)invalidate('motion',{history:false});}
   if(previousMoving&&!moving)idleSince=now;previousMoving=moving;
   if(geometryChanged){install();invalidate('geometry',{geometry:true});if(started)register();}
   if(lightStamp!==lastLight){lastLight=lightStamp;invalidate('lighting');}
   if(attentionKey!==lastAttention){lastAttention=attentionKey;dirty=true;rayCaptured=false;temporal.invalidate('attention');}
   setScale(scale);
   if(!started&&!moving&&now-idleSince>450){started=true;register();if(computeEnabled)void tracer.initialize();}
   if(started&&(moving||dirty||!temporal.converged)){
     const gaze=attentionPosition?point.copy(attentionPosition).project(camera):null;
     clusters.update(camera,{viewportHeight:height*dpr,attentionKey,pixelError:moving?1.4:.65,gaze:gaze?{x:gaze.x,y:gaze.y}:undefined});
     const uploads=clusters.getStats().indexUploads;if(uploads!==lastClusterUploads){lastClusterUploads=uploads;dirty=true;}
   }
   if(started&&computeEnabled&&!rayFailed&&!moving&&now-idleSince>450){
     if(geometryDirty&&!geometryBuilding&&tracer.stats.available){
       geometryBuilding=true;const gen=geometryGeneration;
       scheduler.schedule(async()=>{try{const ok=await tracer.setGeometry(scene,{exclude,generation:gen});if(ok&&gen===geometryGeneration)geometryDirty=false;}
         finally{geometryBuilding=false;}},{key:'ray-geometry',priority:2,estimateMs:.5,idleOnly:true}).catch(e=>{geometryBuilding=false;lastError=e.message;});
     }else if(!geometryDirty&&!geometryBuilding&&!capturing&&!rayCaptured&&tracer.stats.hasGeometry){
       capturing=true;const token=captureToken;const gen=geometryGeneration;
       scheduler.schedule(async()=>{
         try{const frame=await capture.capture({scene,camera,width:width*dpr,height:height*dpr,exclude});
           if(disposed||moving||token!==captureToken||gen!==geometryGeneration)return;
           if(!frame){rayFailed=true;lastError='Float G-buffer readback unavailable';return;}
           const day=lastLight.startsWith('true:');
           const source=day?key:resumeSpot;source.updateMatrixWorld();source.target.updateMatrixWorld();
           const position=source.getWorldPosition(new THREE.Vector3()),target=source.target.getWorldPosition(new THREE.Vector3());
           const direction=position.clone().sub(target).normalize();
           const lights=day?[{type:'directional',direction:direction.toArray(),angularRadius:.035,weight:1}]:
             [{position:position.toArray(),edgeU:[.065,0,0],edgeV:[0,0,.065],direction:direction.negate().toArray(),coneCos:Math.cos(source.angle),weight:1}];
           snapshot={...frame,lightType:day?'directional':'spot',lightIndex:0};
           let attention;if(attentionPosition){point.copy(attentionPosition).project(camera);attention={x:point.x*.5+.5,y:point.y*.5+.5,radius:.2};}
           rayCaptured=tracer.begin({...frame,lights,attention,generation:gen,aoRadius:.11,bias:.001});
         }catch(e){lastError=e.message;}finally{capturing=false;}
       },{key:'ray-capture',priority:1,estimateMs:1,idleOnly:true}).catch(e=>{capturing=false;lastError=e.message;});
     }
     if(rayCaptured&&tracer.stats.state==='accumulating'&&!rayQueued){rayQueued=true;
       scheduler.schedule(()=>tracer.step().finally(()=>{rayQueued=false;}),{key:'ray-step',priority:4,estimateMs:.15,idleOnly:true}).catch(e=>{rayQueued=false;lastError=e.message;});}
   }
   if(gtao)gtao.blendIntensity=snapshot&&tracer.stats.samples>0 ? .25 : .42;
   // A changing scope texture/toolhead needs raster work, but neither the
   // camera resolution nor stationary BVH/capture/history revision changes.
   const render=moving||dirty||!temporal.converged||reactive||ambientChanged;
   if(ambientChanged)ambientFrames++;
   if(!render)cachedFrames++;
   return render;
 }
 function reactiveRects(dynamicObjects=[]){
   const rects=[];
   // Visible instrument rectangles take priority over transparent room props.
   // Include them at rest too; otherwise a live trace smears into old history.
   for(const o of new Set([...dynamicObjects,...(moving?[...exclude,...reactiveMeshes]:[])])){
     if(!o?.isObject3D||o.isSprite||o.material?.opacity===0||rects.length>=12)continue;
     let visible=true;for(let p=o;p;p=p.parent)visible&&=p.visible;
     const prior=previousRects.get(o);
     if(!visible){if(prior)rects.push(prior);previousRects.delete(o);continue;}
     bbox.setFromObject(o);if(bbox.isEmpty())continue;
     let minX=1,minY=1,maxX=0,maxY=0,front=false;
     for(let i=0;i<8;i++){point.set(i&1?bbox.max.x:bbox.min.x,i&2?bbox.max.y:bbox.min.y,i&4?bbox.max.z:bbox.min.z).project(camera);
       if(point.z>=-1&&point.z<1)front=true;minX=Math.min(minX,point.x*.5+.5);maxX=Math.max(maxX,point.x*.5+.5);minY=Math.min(minY,point.y*.5+.5);maxY=Math.max(maxY,point.y*.5+.5);}
     if(front&&maxX>0&&maxY>0&&minX<1&&minY<1){
       const current=[Math.max(0,minX-.015),Math.max(0,minY-.015),Math.min(1,maxX+.015),Math.min(1,maxY+.015)];
       previousRects.set(o,current);
       rects.push(prior?[Math.min(current[0],prior[0]),Math.min(current[1],prior[1]),Math.max(current[2],prior[2]),Math.max(current[3],prior[3])]:current);
     }else {if(prior)rects.push(prior);previousRects.delete(o);}
   }return rects;
 }
 function render({reactive=false,dynamicObjects=[]}={}){
   const w=composer.readBuffer.width,h=composer.readBuffer.height;
   temporal.begin(camera,w,h);
   try{
     composer.render();
     temporal.restore(camera);
     const rects=reactiveRects(dynamicObjects);lastReactiveRects=rects.length;
     temporal.resolve({color:composer.readBuffer.texture,depth:gtao?.depthTexture||composer.readBuffer.depthTexture,camera,moving,reactive,rects});
     dirty=false;frameRenders++;
   }finally{temporal.restore(camera);}
 }
 return {install,resize,update,render,invalidate,warmup:()=>temporal.warmup(),
   refresh(reason='raster-update'){dirty=true;temporal.invalidate(reason);},
   prewarm(root,identity){if(!root)return;bridge.install(root);return scheduleShaderPrewarm(scheduler,{renderer,root,scene,camera,renderTarget:composer.readBuffer,key:`shader:${identity}`}).catch(e=>{lastError=e.message;});},
   schedule:measure=>scheduler.tick(measure),
   getStats:()=>({moving,inputScale,frameRenders,cachedFrames,ambientFrames,lastReactiveRects,registrations,revision,geometryDirty,geometryBuilding,capturing,lastError,
     temporal:temporal.getStats(),compute:getGpuDeviceStats(),raytrace:tracer.stats,materials:bridge.stats,clusters:clusters.getStats(),scheduler:scheduler.getStats()}),
   dispose(){disposed=true;captureToken++;scheduler.dispose();tracer.dispose();clusters.dispose();temporal.dispose();capture.dispose();for(const target of sceneDepthTargets){target.depthTexture?.dispose();target.depthTexture=null;}bridge.dispose();}};
}
