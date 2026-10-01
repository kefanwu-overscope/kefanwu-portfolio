import {projectMotionLabels} from '/project-motion-labels.js';
import {projectMotionNotes} from '/project-motion-notes.js';
const frame=document.querySelector('iframe'),status=document.querySelector('#status'),report=document.querySelector('#report'),checks=[],errors=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){let elapsed=0,previous=performance.now();while(elapsed<45000){const now=performance.now();if(!document.hidden&&!frame.contentDocument?.hidden)elapsed+=now-previous;previous=now;if(fn())return;await pause(80)}throw new Error('Timeout '+label)}
try{
 for(const route of ['case-study','project-3d'])for(const width of (new URLSearchParams(location.search).has('mobile')?[390]:[1200,390]))for(const key of Object.keys(projectMotionLabels)){
  frame.style.width=width+'px';frame.src=`/${route}.html?project=${key}#motion`;
  await new Promise(r=>frame.onload=r);
  const doc=frame.contentDocument,win=frame.contentWindow;
  await until(()=>doc.querySelector('.case-motion-story[data-story-mounted]'),key+' markup');
  const story=doc.querySelector('.case-motion-story'),media=doc.querySelector('.case-preview-figure');
  const buttons=[...doc.querySelectorAll('.motion-step-buttons button')];
  buttons[0].click();await until(()=>{const host=doc.querySelector('.case-animation-host');return host.dataset.motionReady==='true'&&(host.dataset.motionLive==='true'?host.querySelector('.card-media').dataset.status==='ready':host.classList.contains('is-explode-ready'))},key+' first rendered frame');await doc.fonts.ready;
  let fixed=null;
  for(let i=0;i<buttons.length;i++){
   status.textContent=`${route} ${width}px · ${key} · ${i+1}/${buttons.length}`;buttons[i].click();
   await until(()=>Math.abs(Number(story.dataset.shownProgress)-projectMotionNotes[key].steps[i].at)<.014&&doc.querySelector('#preview-title').textContent===projectMotionLabels[key][i].title,key+' stage '+i);
   await pause(390);
   const box=media.getBoundingClientRect(),label=doc.querySelector('.motion-notes').getBoundingClientRect(),pin=doc.querySelector('.case-motion-pin').getBoundingClientRect();
   const headerHeight=doc.querySelector('.site-header').getBoundingClientRect().height;
   fixed ||= {left:box.left,width:box.width,height:box.height,headerHeight};
   const item={frame:{left:box.left,width:box.width,height:box.height,headerHeight},initialFrame:fixed,length:Number(story.dataset.leaderLength),overlap:Number(story.dataset.labelOverlap),route,width,key,stage:i,title:doc.querySelector('#preview-title').textContent,anchor:story.dataset.anchorVisible,transform:win.getComputedStyle(media).transform,font:win.getComputedStyle(doc.querySelector('#preview-title')).fontSize,path:doc.querySelector('.motion-leader-line').getAttribute('d'),stable:Math.abs(box.left-fixed.left)<.5&&Math.abs(box.width-fixed.width)<.5&&Math.abs(box.height-fixed.height+headerHeight-fixed.headerHeight)<.5,labelInside:label.left>=0&&label.right<=width&&label.bottom<doc.querySelector('.motion-story-timeline').getBoundingClientRect().top-10};
   checks.push(item);
   if(!item.stable||item.transform!=='none'||item.anchor!=='true'||!item.path||parseFloat(item.font)>12||!item.labelInside)errors.push(item);
  }
 }
 status.textContent=errors.length?`Failed ${errors.length} of ${checks.length}`:`Passed ${checks.length} route / viewport / stage checks`;
}catch(e){const d=frame.contentDocument;errors.push({error:e.stack,story:{...d?.querySelector('.case-motion-story')?.dataset},host:{...d?.querySelector('.case-animation-host')?.dataset},classes:d?.querySelector('.case-animation-host')?.className,viewport:d?.querySelector('.card-media')?.getBoundingClientRect()?.toJSON(),title:d?.querySelector('#preview-title')?.textContent,slider:d?.querySelector('#motion-story-progress')?.value});status.textContent='Failed: '+e.message}
report.textContent=JSON.stringify({checks:checks.length,errors},null,2);
await fetch('/__qa/export/layout-result.json',{method:'POST',body:JSON.stringify({checks,errors},null,2)});
