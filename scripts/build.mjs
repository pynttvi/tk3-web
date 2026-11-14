// Dependency-free static build. Only dist/ is generated; src/ and public/ are inputs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {gzipSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist');
if(fs.existsSync(output)&&fs.lstatSync(output).isSymbolicLink())throw new Error('dist must not be a symlink');
fs.mkdirSync(output,{recursive:true});
function copyDirectory(source,destination) {
  fs.mkdirSync(destination,{recursive:true});
  for(const entry of fs.readdirSync(source,{withFileTypes:true})) {
    const input=path.join(source,entry.name),target=path.join(destination,entry.name);
    if(entry.isSymbolicLink()||(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink()))throw new Error('Build paths must not be symlinks');
    if(entry.isDirectory())copyDirectory(input,target);
    else fs.copyFileSync(input,target);
  }
}
copyDirectory(path.join(root,'public'),output);
for(const name of ['index.html','canvas.css','COPYING','THIRD_PARTY_NOTICES.md'])fs.copyFileSync(path.join(root,name),path.join(output,name));
for(const name of fs.readdirSync(path.join(root,'src'))) {
  if(!name.endsWith('.ts')||name.endsWith('.d.ts'))continue;
  const text=fs.readFileSync(path.join(root,'src',name),'utf8');
  fs.writeFileSync(path.join(output,name.replace(/\.ts$/,'.js')),stripTypeScriptTypes(text,{mode:'strip'}));
}
fs.writeFileSync(path.join(output,'.nojekyll'),'');
// Ship the editable source and build inputs beside the compiled JavaScript.
const archive=[];
function addSource(name) {
  const input=path.join(root,name),stat=fs.lstatSync(input);
  if(stat.isSymbolicLink())throw new Error('Source archive paths must not be symlinks');
  if(stat.isDirectory()) {
    for(const child of fs.readdirSync(input).sort())addSource(`${name}/${child}`);
    return;
  }
  if(!stat.isFile()||Buffer.byteLength(name)>100)throw new Error(`Unsupported source archive path: ${name}`);
  const data=fs.readFileSync(input),header=Buffer.alloc(512);
  const octal=(offset,length,value)=>header.write(value.toString(8).padStart(length-1,'0')+'\0',offset,length,'ascii');
  header.write(name);octal(100,8,0o644);octal(108,8,0);octal(116,8,0);
  octal(124,12,data.length);octal(136,12,0);header.fill(32,148,156);
  header.write('0',156);header.write('ustar\0',257);header.write('00',263);
  const checksum=header.reduce((sum,byte)=>sum+byte,0);
  header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
  archive.push(header,data,Buffer.alloc((512-data.length%512)%512));
}
for(const name of ['src','public','scripts','tests','docs','vendor','index.html','canvas.css',
  'package.json','tsconfig.json','README.md','COPYING','THIRD_PARTY_NOTICES.md',
  'AGENTS.md','.github','.gitignore','.gitattributes'])addSource(name);
archive.push(Buffer.alloc(1024));
fs.writeFileSync(path.join(output,'tk3-source.tar.gz'),gzipSync(Buffer.concat(archive)));
console.log('Built standalone TK3 in dist/');
