import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../..'),dataDir=path.resolve(root,'../.codex/photo-fidelity-20260930');
const cache=new Map();
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.css':'text/css','.glb':'model/gltf-binary','.hdr':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.gz':'application/gzip'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:4193');
 if(url.pathname.startsWith('/__qa/export/')&&req.method==='POST'){
  if(req.headers.origin!=='http://127.0.0.1:4193'){res.writeHead(403).end();return;}
  const name=url.pathname.slice('/__qa/export/'.length);
  if(!/^[a-zA-Z0-9_/-]+\.(webp|json)$/.test(name)||name.includes('..')){res.writeHead(400).end();return;}
  let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>10*1024*1024){res.writeHead(413).end();return;}chunks.push(c);}
  const target=path.resolve(dataDir,'exports',name);await fs.promises.mkdir(path.dirname(target),{recursive:true});
  await fs.promises.writeFile(target,Buffer.concat(chunks));res.writeHead(200).end('Saved');return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 const qa=url.pathname.startsWith('/__qa/');const baseline=url.pathname.startsWith('/baseline/');
 const relative=decodeURIComponent(url.pathname.replace(qa?/^\/__qa\//:baseline?/^\/baseline\//:/^\//,''))||'index.html';
 const basedir=qa?dir:root;const file=path.resolve(basedir,relative);
 if(!file.startsWith(basedir+path.sep)){res.writeHead(403).end();return;}
 let bytes;
 if(baseline){if(!cache.has(relative))cache.set(relative,execFileSync('git',['-C',root,'show','d97015c:'+relative],{windowsHide:true,maxBuffer:100*1024*1024,stdio:['ignore','pipe','pipe']}));bytes=cache.get(relative);}
 else bytes=await fs.promises.readFile(file);
 if(relative==='experience.html'&&url.searchParams.has('qa'))bytes=Buffer.from(bytes.toString().replace('</body>','<script type="module" src="/__qa/render-proof.js"></script></body>'));
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
}catch{res.writeHead(404).end('Preview file not found');}}).listen(4193,'127.0.0.1',()=>console.log('Room detail preview http://127.0.0.1:4193/'));
