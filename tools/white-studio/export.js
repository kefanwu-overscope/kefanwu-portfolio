import {createStudioInspector} from '/studio-inspector.js';
import {projectMotionLabels} from '/project-motion-labels.js';
import {projectMotionNotes} from '/project-motion-notes.js';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),report=document.querySelector('#report');
// White must participate in the transmission pass so acrylic refracts the
// same studio surface as the opaque output; no pixel-color removal is used.
const inspector=createStudioInspector({canvas,transparentBackground:false,backgroundColor:0xffffff,quality:'high'});
const output=document.createElement('canvas'),ctx=output.getContext('2d',{alpha:false});
const params=new URLSearchParams(location.search),only=params.get('only')?.split(',');
const save=async(name,data)=>{const r=await fetch('/__qa/export/'+name,{method:'POST',body:data});if(!r.ok)throw new Error('Export write failed '+name);};
async function capture(width,height){
 canvas.style.width=`${width/Math.min(devicePixelRatio||1,2)}px`;
 canvas.style.height=`${height/Math.min(devicePixelRatio||1,2)}px`;
 output.width=width;output.height=height;inspector.resize();
 await new Promise((resolve,reject)=>requestAnimationFrame(()=>{try{
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(canvas,0,0,width,height);resolve();
 }catch(error){reject(error);}}));
 const blob=await new Promise(resolve=>output.toBlob(resolve,'image/webp',width>1280?.94:.87));
 if(!blob)throw new Error('WebP encoding failed');return blob;
}
async function run(proof){
 document.querySelectorAll('button').forEach(button=>button.disabled=true);
 const results={},errors=[],started=new Date().toISOString(),start=performance.now();
 const proofKeys=['steering','formlabs','vineRobot','telecaster','carbonSeat','ansysCfd','brakeSim'];
 try{
  const manifest=await(await fetch('/assets/exploded/manifest.json')).json();
  for(const [key,config] of Object.entries(manifest.projects)){
   if(only&&!only.includes(key)||proof&&!proofKeys.includes(key))continue;
   const projectStart=performance.now();status.textContent='Loading '+key;
   canvas.style.width='900px';canvas.style.height='600px';
   const loaded=await inspector.selectProject(key);if(!loaded)throw new Error('Model missing '+key);
   await loaded.whenMotionReady;if(!inspector.getState().motionReady)throw new Error('Motion missing '+key);
   inspector.reset({camera:true});inspector.setProgress(0);
   const prefix=proof?'proof/':'',covers={};
   for(const width of proof?[960]:[480,960,1800]){
    const blob=await capture(width,width*2/3);await save(`${prefix}${key}/cover-${width}.webp`,blob);covers[width]=blob.size;
   }
   const coverState=inspector.getState(),count=config.frames.length,points=[],sizes=[];
   const steps=projectMotionNotes[key].steps,masks=steps.map(()=>Array(24).fill(0));
   const indices=proof?[0,Math.floor((count-1)/2),count-1]:Array.from({length:count},(_,i)=>i);
   canvas.style.width='640px';canvas.style.height='427px';inspector.resize();
   for(const i of indices){
    const p=i/(count-1);inspector.setProgress(p);const blob=await capture(640,427);
    let stage=0;for(let j=1;j<steps.length;j++)if(p+.00001>=steps[j].at)stage=j;
    for(const rect of inspector.projectRegions()){
     const x0=Math.max(0,Math.floor(rect.x*32)),x1=Math.min(31,Math.floor((rect.x+rect.width)*32));
     const y0=Math.max(0,Math.floor(rect.y*24)),y1=Math.min(23,Math.floor((rect.y+rect.height)*24));
     for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)masks[stage][y]=(masks[stage][y]|(1<<x))>>>0;
    }
    const point=inspector.projectAnchor(projectMotionLabels[key][stage].target);
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))errors.push({key,i,stage,error:'Missing anchor'});
    points.push(point&&{x:+point.x.toFixed(6),y:+point.y.toFixed(6)});sizes.push(blob.size);
    await save(`${prefix}${key}/${String(i).padStart(2,'0')}.webp`,blob);
    await save(`${prefix}${key}/detail/${String(i).padStart(2,'0')}.webp`,await capture(1280,854));
    if(i%10===0)status.textContent=`Rendering ${key}: ${i+1}/${count}`;
   }
   results[key]={aspect:640/427,points,masks,bytes:sizes.reduce((a,b)=>a+b,0),covers,count,indices,coverState,state:inspector.getState(),elapsedMilliseconds:performance.now()-projectStart};
   await save(`${prefix}${key}/report.json`,JSON.stringify(results[key],null,2));
   report.textContent=JSON.stringify({done:Object.keys(results),errors,elapsedSeconds:(performance.now()-start)/1000},null,2);
  }
  const result={proof,started,finished:new Date().toISOString(),elapsedMilliseconds:performance.now()-start,background:'#ffffff',renderer:'Three.js r185',sourceManifest:'/assets/studio-motion/index.json',results,errors};
  await save(proof?'proof/result.json':'result.json',JSON.stringify(result,null,2));
  status.textContent=errors.length?'Finished with annotation errors':`Passed: ${Object.keys(results).length} projects on white; ${Math.round(result.elapsedMilliseconds/1000)} seconds`;
 }catch(error){status.textContent='Failed: '+error.stack;}
 finally{document.querySelectorAll('button').forEach(button=>button.disabled=false);}
}
document.querySelector('#proof').onclick=()=>run(true);
document.querySelector('#start').onclick=()=>run(false);
window.addEventListener('pagehide',()=>inspector.dispose(),{once:true});
