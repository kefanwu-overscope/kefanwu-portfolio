const rows=[],canvas=document.querySelector('canvas'),status=document.querySelector('#status'),report=document.querySelector('#report');
try{
 for(const version of ['baseline','current']){
  const {createStudioInspector}=await import(version==='baseline'?'/baseline/studio-inspector.js':'/studio-inspector.js');
  const viewer=createStudioInspector({canvas,transparentBackground:true,quality:'high'});
  for(const key of ['steering','scanner','telecaster','carbonSeat']){
   status.textContent=`Testing ${version}: ${key}`;
   const loaded=await viewer.selectProject(key);if(!loaded)throw new Error(key+' load');await loaded.whenMotionReady;
   const times=[];let previous=0;
   for(let i=0;i<155;i++){
    viewer.setProgress(.1+(i%121)/151);
    await new Promise(resolve=>requestAnimationFrame(time=>{if(i>30)times.push(time-previous);previous=time;resolve()}));
   }
   times.sort((a,b)=>a-b);const state=viewer.getState();
   rows.push({version,key,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],cpuSubmissionMs:state.renderMilliseconds,shadow:state.shadows,triangles:state.triangles,canvas:[canvas.width,canvas.height],state:state.state});
   report.textContent=JSON.stringify(rows,null,2);
  }
  viewer.dispose();
 }
 status.textContent='Completed steady motion comparison';
}catch(e){status.textContent='Failed: '+e.stack}
await fetch('/__qa/export/performance.json',{method:'POST',body:JSON.stringify({status:status.textContent,rows},null,2)});
