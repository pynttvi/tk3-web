// SPDX-License-Identifier: GPL-3.0
// EFP layout follows SRC/EFP/EFP.CPP at the pinned upstream commit.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {deflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const source=path.resolve(process.argv[2]||path.join(root,'vendor/tk-upstream'));
const pinned=JSON.parse(fs.readFileSync(path.join(root,'docs/upstream-files.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function read(name) {
  const b=fs.readFileSync(path.join(source,name));
  const blob=crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
  assert.equal(blob,pinned.files[name],`Upstream blob mismatch: ${name}`);
  const target=path.join(root,'vendor/tk-upstream',name);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);
  return b;
}
function crc32(b) {
  let crc=0xffffffff;
  for(const byte of b){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data) {
  const typeBytes=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);
  length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([typeBytes,data])));
  return Buffer.concat([length,typeBytes,data,crc]);
}
function decodeEfp(b,transparent) {
  assert.equal(b.toString('ascii',0,6),'EF pic');
  const width=b.readUInt16LE(6),height=b.readUInt16LE(8),pixels=Buffer.alloc(width*height);
  const paletteOffset=b.length-768,palette=b.subarray(paletteOffset);
  assert.ok(width>0&&height>0&&palette.every(v=>v<=63));
  let offset=10,count=0;
  while(count<pixels.length){
    assert.ok(offset<paletteOffset,'Truncated EFP');const value=b[offset++];
    const run=value>192?value-192:1;
    assert.ok(count+run<=pixels.length,'EFP run overflow');
    assert.ok(value<=192||offset<paletteOffset,'Truncated EFP run');
    pixels.fill(value>192?b[offset++]:value,count,count+run);count+=run;
  }
  assert.equal(offset,paletteOffset,'Unexpected EFP trailing bytes');
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=3;
  const scanlines=Buffer.alloc((width+1)*height);
  for(let y=0;y<height;y++)pixels.copy(scanlines,y*(width+1)+1,y*width,(y+1)*width);
  const chunks=[chunk('IHDR',header),chunk('PLTE',Buffer.from([...palette].map(v=>v*4)))];
  if(transparent!==null){const alpha=Buffer.alloc(transparent+1,255);alpha[transparent]=0;chunks.push(chunk('tRNS',alpha));}
  chunks.push(chunk('IDAT',deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0)));
  return {png:Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),...chunks]),width,height,paletteOffset,palette};
}
const previous=JSON.parse(fs.readFileSync(path.join(root,'docs/asset-provenance.json')));
const images={},assets=[];
for(const [id,old] of Object.entries(previous.images)) {
  const name=`EFPS/${id.toUpperCase()}.EFP`,b=read(name);
  const {png,width,height,paletteOffset,palette}=decodeEfp(b,old.transparency_index);
  fs.writeFileSync(path.join(root,'public/assets',old.file),png);
  images[id]={file:old.file,source:name,source_sha256:sha(b),width,height,palette_offset:paletteOffset,
    palette_sha256:sha(palette),png_sha256:sha(png),decoder:'tk-efp-v2-indexed',transparency_index:old.transparency_index};
  assets.push({kind:'image-source',id,upstream_path:name,sha256:sha(b),git_blob_sha1:pinned.files[name],status:'exact-byte-match'});
}
// The ten campaign maps already match upstream byte-for-byte. Preserve decoded
// cells and stored starts, including level 6, and verify their original inputs.
const {default:scene}=await import(path.join(root,'public/scene.js'));
const levels=scene.levels.filter(l=>l.id!=='dm');
for(const level of levels){
  const name=`LEVS/DEFAULT/${level.id.toUpperCase()}.LEV`,b=read(name);
  assert.equal(sha(b),level.source_sha256,'Campaign map differs from upstream');
  level.source=name;
  assets.push({kind:'map-source',id:level.id,upstream_path:name,sha256:sha(b),git_blob_sha1:pinned.files[name],status:'exact-byte-match'});
}
for(const id of ['death','explo','hit','pistol','rifle']){
  const name=`WAVS/${id.toUpperCase()}.WAV`,b=read(name);
  fs.writeFileSync(path.join(root,`public/assets/${id}.wav`),b);
  assets.push({kind:'sound',id:`${id}.wav`,upstream_path:name,sha256:sha(b),git_blob_sha1:pinned.files[name],status:'exact-byte-match'});
}
read('LICENSE');read('README.TXT');
const provenance={schema_version:2,decoder_version:'tk-efp-v2-indexed',upstream:pinned.repository,
  reference_commit:pinned.commit,images,levels,format_evidence:previous.format_evidence,
  limits:['Assets now come exclusively from the pinned public GPL release.','Prototype gameplay is not verified DOS runtime parity.','The differing supplied DM map is omitted.']};
fs.writeFileSync(path.join(root,'docs/asset-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
fs.writeFileSync(path.join(root,'public/scene.js'),'export default '+JSON.stringify({images,levels,reference_commit:pinned.commit,fidelity:'Source-assisted prototype using public GPL release assets; DOS runtime parity unverified.'})+';\n');
fs.writeFileSync(path.join(root,'docs/license-audit.json'),JSON.stringify({checked_on:'2026-11-14',upstream:pinned.repository,commit:pinned.commit,
  method:'Original inputs verified against pinned Git blob IDs; PNGs retain indexed palettes, dimensions and transparency.',
  license:'GPL-3.0',unresolved_assets:0,omitted:['The supplied v3.0 DM map has no exact upstream match and is excluded.'],assets},null,2)+'\n');
fs.writeFileSync(path.join(root,'public/build-report.json'),JSON.stringify({status:'built',images:25,levels:10,
  asset_source:`${pinned.repository}/tree/${pinned.commit}`,unverified:['DOS runtime parity','Exact tick/AI/RNG behavior','Shop, all weapons, lighting, multiplayer and music']},null,2)+'\n');
console.log(`Imported ${assets.length} assets from pinned GPL upstream; omitted supplied DM map.`);
