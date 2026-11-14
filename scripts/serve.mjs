import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const {values}=parseArgs({options:{host:{type:'string',default:'0.0.0.0'},port:{type:'string',default:'8080'}}});
const port=Number(values.port);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');
await fs.access(path.join(root,'index.html'));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png',
  '.wav':'audio/wav','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try {
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    const actual=await fs.realpath(target),relative=path.relative(root,actual);
    if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)){
      res.writeHead(403);res.end('Forbidden');return;
    }
    const body=await fs.readFile(actual);
    res.writeHead(200,{'Content-Type':mime[path.extname(actual)]||'application/octet-stream',
      'Content-Length':body.length,'Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:body);
  } catch(error) {
    const status=error.code==='ENOENT'||error.code==='EISDIR'?404:400;
    res.writeHead(status);res.end(status===404?'Not found':'Bad request');
  }
});
server.listen(port,values.host,()=>console.log(`TK3: http://localhost:${server.address().port} (bind ${values.host})`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());
