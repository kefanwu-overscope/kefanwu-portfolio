import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../..');
const evidence=path.resolve(root,'../.codex/white-studio-20261011');
const port=4196,origin=`http://127.0.0.1:${port}`;
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.gz':'application/gzip'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin);
 if(req.method==='POST'&&url.pathname.startsWith('/__qa/export/')){
  if(req.headers.origin!==origin){res.writeHead(403).end();return;}
  const name=url.pathname.slice('/__qa/export/'.length);
  if(!/^[a-zA-Z0-9_/-]+\.(webp|json)$/.test(name)||name.includes('..')){res.writeHead(400).end();return;}
  const chunks=[];let bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>10*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}
  const file=path.resolve(evidence,'exports',name);
  await fs.promises.mkdir(path.dirname(file),{recursive:true});
  await fs.promises.writeFile(file,Buffer.concat(chunks));res.writeHead(200).end('Saved');return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 const qa=url.pathname.startsWith('/__qa/');
 const base=qa?dir:root;
 const relative=decodeURIComponent(url.pathname.replace(qa?/^\/__qa\//:/^\//,''))||'index.html';
 const file=path.resolve(base,relative);
 if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
 const data=await fs.promises.readFile(file);
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store'});
 res.end(req.method==='HEAD'?undefined:data);
}catch(error){res.writeHead(404).end('Preview file not found');}}).listen(port,'127.0.0.1',()=>console.log(`White studio renderer ${origin}/__qa/export.html`));
