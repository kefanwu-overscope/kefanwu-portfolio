const output=document.createElement('pre');output.id='entrance-proof';output.style.cssText='position:fixed;right:12px;top:85px;background:#202020;color:white;padding:12px;z-index:100;max-width:360px;white-space:pre-wrap;font:11px monospace';document.body.append(output);output.textContent='Checking annotation entrance…';
const pause=ms=>new Promise(r=>setTimeout(r,ms));const rows=[];
try{
 for(let i=0;i<600&&!document.querySelector('.case-animation-host[data-motion-ready="true"]');i++)await pause(50);
 await document.fonts.ready;await pause(120);
 const story=document.querySelector('.case-motion-story'),note=document.querySelector('.motion-notes'),line=document.querySelector('.motion-leader-line'),dot=document.querySelector('.motion-leader-target');
 document.querySelectorAll('.motion-step-buttons button')[2].click();
 const start=performance.now();
 while(performance.now()-start<1800){await new Promise(r=>requestAnimationFrame(r));rows.push({time:performance.now()-start,title:document.querySelector('#preview-title').textContent,progress:story.dataset.shownProgress,opacity:getComputedStyle(note).opacity,dash:getComputedStyle(line).strokeDashoffset,dot:getComputedStyle(dot).opacity,animations:note.getAnimations().map(a=>({state:a.playState,progress:a.effect.getComputedTiming().progress})),length:story.dataset.leaderLength});}
 const faded=rows.some(r=>Number(r.opacity)>0&&Number(r.opacity)<1),drawn=rows.some(r=>Number.parseFloat(r.dash)>-1&&Number.parseFloat(r.dash)<0),finished=rows.at(-1).title==='Angled column'&&Number(rows.at(-1).opacity)===1;
 if(!faded||!drawn||!finished)throw new Error(JSON.stringify({faded,drawn,finished}));
 document.querySelectorAll('.motion-step-buttons button')[5].click();await pause(80);document.querySelectorAll('.motion-step-buttons button')[1].click();for(let i=0;i<300&&document.querySelector('#preview-title').textContent!=='Upper shaft';i++)await pause(50);
 if(document.querySelector('#preview-title').textContent!=='Upper shaft')throw new Error('Fast reversal retained a stale label');
 output.textContent='Passed: line draw + delayed text fade; rapid reversal settles on the correct component.';
}catch(e){output.textContent='Failed: '+e.stack}
await fetch('/__qa/export/entrance-proof.json',{method:'POST',body:JSON.stringify({result:output.textContent,rows},null,2)});
