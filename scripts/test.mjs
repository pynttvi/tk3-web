// Compile only repository-owned TypeScript with the already-installed Node runtime.
import {stripTypeScriptTypes} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const build=path.join(app,'.test-build');fs.mkdirSync(build,{recursive:true});
for(const name of ['simulation','renderer','audio','main'])fs.writeFileSync(path.join(build,name+'.js'),
  stripTypeScriptTypes(fs.readFileSync(path.join(app,'src',name+'.ts'),'utf8'),{mode:'strip'}));
for(const file of ['simulation.test.mjs','main.test.mjs','audio.test.mjs']) {
  const result=spawnSync(process.execPath,[path.join(app,'tests',file)],{stdio:'inherit'});
  if(result.status!==0){process.exitCode=result.status??1;break;}
}
