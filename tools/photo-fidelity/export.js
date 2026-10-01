import {createStudioInspector} from '/studio-inspector.js';
import {projectMotionLabels} from '/project-motion-labels.js';
import {projectMotionNotes} from '/project-motion-notes.js';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),report=document.querySelector('#report');
const inspector=createStudioInspector({canvas,transparentBackground:true,quality:'high'});
const output=document.createElement('canvas'),ctx=output.getContext('2d',{alpha:false});
const results={},errors=[]; const hdOnly=new URLSearchParams(location.search).has('hd');
const save=async(name,data)=>{const r=await fetch('/__qa/export/'+name,{method:'POST',body:data});if(!r.ok)throw new Error('Export write failed '+name)};
async function capture(width,height){
 canvas.style.width=`${width/Math.min(devicePixelRatio||1,2)}px`;canvas.style.height=`${height/Math.min(devicePixelRatio||1,2)}px`;
 output.width=width;output.height=height;
 inspector.resize();
 await new Promise((resolve,reject)=>requestAnimationFrame(()=>{try{ctx.fillStyle='#181818';ctx.fillRect(0,0,width,height);ctx.drawImage(canvas,0,0,width,height);resolve()}catch(e){reject(e)}}));
 return new Promise(resolve=>output.toBlob(resolve,'image/webp',width>1280?.94:.87));
}
document.querySelector('#start').onclick=async()=>{
 document.querySelector('#start').disabled=true;
 try{
  const manifest=await(await fetch('/assets/exploded/manifest.json')).json();
  const only=new URLSearchParams(location.search).get('only');
  for(const [key,config] of Object.entries(manifest.projects)){
   if(only&&!only.split(',').includes(key))continue;
   status.textContent='Loading '+key;
   canvas.style.width='900px';canvas.style.height='600px';
   const loaded=await inspector.selectProject(key);if(!loaded)throw new Error('Model missing '+key);
   await loaded.whenMotionReady;if(!inspector.getState().motionReady)throw new Error('Motion missing '+key);
   inspector.reset({camera:true});inspector.setProgress(0);
   const covers={};
   for(const width of (hdOnly?[]:[480,960,1800])){const blob=await capture(width,width*2/3);await save(`${key}/cover-${width}.webp`,blob);covers[width]=blob.size;}
   const count=config.frames.length,points=[],sizes=[];const steps=projectMotionNotes[key].steps;
   canvas.style.width='640px';canvas.style.height='427px';inspector.resize();
   for(let i=0;i<count;i++){
    const p=i/(count-1);inspector.setProgress(p);const blob=await capture(640,427);
    let stage=0;for(let j=1;j<steps.length;j++)if(p+.00001>=steps[j].at)stage=j;
    const point=inspector.projectAnchor(projectMotionLabels[key][stage].target);
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))errors.push({key,i,stage,error:'Missing anchor'});
    points.push(point&&{x:+point.x.toFixed(6),y:+point.y.toFixed(6)});sizes.push(blob.size);
    if(!hdOnly)await save(`${key}/${String(i).padStart(2,'0')}.webp`,blob);
    await save(`${key}/detail/${String(i).padStart(2,'0')}.webp`,await capture(1280,854));
    if(i%10===0)status.textContent=`Rendering ${key}: ${i+1}/${count}`;
   }
   results[key]={aspect:640/427,points,bytes:sizes.reduce((a,b)=>a+b,0),covers,count,state:inspector.getState()};
   if(!hdOnly)await save(key+'/report.json',JSON.stringify(results[key],null,2));
   report.textContent=JSON.stringify({done:Object.keys(results),errors},null,2);
  }
  await save(hdOnly?'hd-result.json':'result.json',JSON.stringify({results,errors},null,2));status.textContent=errors.length?'Finished with annotation errors':'Passed: all covers, frames and component anchors rendered';
 }catch(error){status.textContent='Failed: '+error.stack;}
};
window.addEventListener('pagehide',()=>inspector.dispose(),{once:true});
