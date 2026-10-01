import {createStudioInspector} from '/studio-inspector.js';
const canvas=document.querySelector('canvas'),report=document.querySelector('#report'),status=document.querySelector('#status'),rows=[];
const inspector=createStudioInspector({canvas,transparentBackground:true,quality:'high'});
const assert=(p,m)=>{if(!p)throw new Error(m)};
const draw=()=>new Promise(resolve=>{inspector.resize();requestAnimationFrame(()=>resolve(inspector.getState()))});
try{
 const load=await inspector.selectProject('steering');await load.whenMotionReady;
 let a=await draw();rows.push({step:'initial',state:a});assert(a.state==='ready','Steering shader failed');
 const b=await draw();rows.push({step:'same-pose resize',state:b});assert(b.shadows.updates===a.shadows.updates,'Same pose should reuse shadow map');
 inspector.setProgress(.27);const c=await draw();rows.push({step:'negative90',state:c});assert(c.shadows.updates===b.shadows.updates+1,'Actual motion needs exactly one shadow update');
 inspector.setProgress(.27);const d=await draw();assert(d.shadows.updates===c.shadows.updates,'Repeated same pose must reuse shadows');
 inspector.setQuality('low');const e=await draw();rows.push({step:'mobile512',state:e});assert(e.shadows.size===512,'Mobile shadow budget');
 inspector.setProgress(.73);const f=await draw();rows.push({step:'positive90',state:f});assert(f.motionPose.wheelRadians>1.5,'Positive steering retained');
 for(const key of ['scanner','telecaster','education','carbonSeat','brakeSim','ansysCfd']){
  const selected=await inspector.selectProject(key);assert(selected,key+' select');await selected.whenMotionReady;
  inspector.setProgress(.5);const state=await draw();rows.push({key,state});assert(state.state==='ready',key+' source shader failed');assert(state.triangles>0,key+' drew no geometry');
 }
 status.textContent='Passed: source shaders, bilateral motion,512px shadow budget and cached shadow-map reuse';
}catch(error){status.textContent='Failed: '+error.stack}
report.textContent=JSON.stringify({status:status.textContent,rows},null,2);
await fetch('/__qa/export/quality-proof.json',{method:'POST',body:report.textContent});
window.addEventListener('pagehide',()=>inspector.dispose(),{once:true});
