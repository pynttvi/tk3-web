// Verify generated game modules, map startup and finite deterministic state without a browser.
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {inflateSync} from 'node:zlib';
const root=pathToFileURL(path.resolve(process.argv[2])+'/');
const {default:scene}=await import(new URL('scene.js',root));
const {createGame,stepGame}=await import(new URL('simulation.js',root));
const provenance=JSON.parse(fs.readFileSync(new URL('../docs/asset-provenance.json',import.meta.url)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const entry of Object.values(scene.images)) {
  const png=fs.readFileSync(new URL('assets/'+entry.file,root));
  assert.equal(sha(png),entry.png_sha256);
  assert.equal(png.readUInt32BE(16),entry.width);assert.equal(png.readUInt32BE(20),entry.height);
  assert.equal(png[24],8);assert.equal(png[25],3,'PNG must remain indexed');
  const efp=fs.readFileSync(new URL('../vendor/tk-upstream/'+entry.source,import.meta.url));
  assert.equal(sha(efp),entry.source_sha256);
  const idat=[];let palette,alpha;
  for(let offset=8;offset<png.length;){
    const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8);
    const data=png.subarray(offset+8,offset+8+length);
    if(type==='IDAT')idat.push(data);if(type==='PLTE')palette=data;if(type==='tRNS')alpha=data;
    offset+=12+length;
  }
  assert.deepEqual(palette,Buffer.from([...efp.subarray(-768)].map(v=>v*4)));
  if(entry.transparency_index===null)assert.equal(alpha,undefined);
  else assert.equal(alpha[entry.transparency_index],0);
  const pixels=[];
  for(let offset=10;pixels.length<entry.width*entry.height;){
    const value=efp[offset++],run=value>192?value-192:1,color=value>192?efp[offset++]:value;
    for(let n=0;n<run;n++)pixels.push(color);
  }
  const rows=inflateSync(Buffer.concat(idat));
  assert.equal(rows.length,(entry.width+1)*entry.height);
  for(let y=0;y<entry.height;y++){
    const offset=y*(entry.width+1);assert.equal(rows[offset],0);
    assert.deepEqual(rows.subarray(offset+1,offset+1+entry.width),Buffer.from(pixels.slice(y*entry.width,(y+1)*entry.width)));
  }
}
assert.deepEqual(scene.levels,provenance.levels);
for(const level of scene.levels) {
  const original=fs.readFileSync(new URL('../vendor/tk-upstream/'+level.source,import.meta.url));
  assert.equal(sha(original),level.source_sha256);
  assert.equal(original.readInt32LE(4),level.width);assert.equal(original.readInt32LE(8),level.height);
  for(let i=0;i<level.cells.length;i++){
    const offset=12+i*12;
    assert.deepEqual(level.cells[i],{type:original.readInt32LE(offset),num:original.readInt32LE(offset+4),shadow:original.readInt32LE(offset+8)});
  }
  const offset=12+level.cells.length*12;
  assert.deepEqual(level.starts,[[original.readInt32LE(offset),original.readInt32LE(offset+4)],[original.readInt32LE(offset+8),original.readInt32LE(offset+12)]]);
}
const results=[];
for(const level of scene.levels) {
  const replay=()=>{
    const state=createGame(level);
    assert.equal(state.enemies.length,level.enemies.reduce((a,b)=>a+b,0));
    assert.equal(state.player.x,level.starts[0][0]*20);
    assert.equal(state.player.y,level.starts[0][1]*20);
    for(let i=0;i<400;i++) {
      stepGame(state,{worldX:i%80<40?-1:1,fire:true,aim:i%360});
      for(const actor of [state.player,...state.enemies]) {
        assert.ok(Number.isFinite(actor.x)&&Number.isFinite(actor.y));
        assert.ok(actor.health>=0);
      }
    }
    return state;
  };
  const state=replay();assert.equal(JSON.stringify(state),JSON.stringify(replay()));
  results.push({id:level.id,enemies:state.enemies.length,ticks:state.tick,deterministic:true});
}
console.log(JSON.stringify({maps:results,browserRendered:false,runtimeParity:'not_measured'}));
