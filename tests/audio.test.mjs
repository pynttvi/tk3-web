import test from 'node:test';
import assert from 'node:assert/strict';
import {SoundEffects} from '../.test-build/audio.js';
import {installFakeAudio} from './fake_audio.mjs';

function setup(){const stats=installFakeAudio(),statuses=[];const sound=new SoundEffects((state,message)=>statuses.push({state,message}));return {stats,statuses,sound};}

test('context is resumed synchronously in the enabling gesture, then buffers are reused',async()=>{
  const {stats,statuses,sound}=setup();
  const enabling=sound.enable();
  assert.equal(stats.contexts.length,1);assert.equal(stats.resumeCalls,1);
  assert.equal(stats.fetches.length,0);
  assert.equal(await enabling,true);
  assert.equal(stats.fetches.length,4);assert.equal(stats.decodes,4);
  assert.equal(stats.sources.filter(source=>source.started).length,1,'one confirmation shot');
  assert.equal(statuses.at(-1).state,'ready');
  sound.play('pistol');sound.play('rifle');
  assert.equal(stats.fetches.length,4);assert.equal(stats.contexts.length,1);
  assert.equal(stats.sources.filter(source=>source.started).length,3);
});
test('muting immediately stops active voices and prevents later playback',async()=>{
  const {stats,statuses,sound}=setup();await sound.enable();sound.play('rifle');
  sound.disable();
  assert.ok(stats.sources.every(source=>source.stopped));
  const count=stats.sources.length;sound.play('pistol');assert.equal(stats.sources.length,count);
  assert.equal(statuses.at(-1).state,'off');assert.equal(sound.enabled,false);
});
test('decode failures are visible and a retry reloads failed buffers',async t=>{
  t.mock.method(console,'error',()=>{});
  const {stats,statuses,sound}=setup();stats.decodeFails=true;
  assert.equal(await sound.enable(),false);assert.equal(sound.enabled,false);
  assert.equal(statuses.at(-1).state,'error');assert.match(statuses.at(-1).message,/Could not decode/);
  stats.decodeFails=false;assert.equal(await sound.enable(),true);
  assert.equal(statuses.at(-1).state,'ready');
});
test('browser suspension can resume from a new user gesture without refetching',async()=>{
  const {stats,statuses,sound}=setup();await sound.enable();
  stats.contexts[0].state='suspended';sound.resumeFromGesture();
  assert.equal(stats.resumeCalls,2);assert.equal(stats.contexts[0].state,'running');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stats.fetches.length,4);assert.equal(statuses.at(-1).state,'ready');
  const before=stats.sources.length;sound.play('rifle');assert.equal(stats.sources.length,before+1);
});
test('turning sound off while files load cannot turn it back on later',async()=>{
  const {statuses,sound}=setup();let complete;
  const pending=new Promise(resolve=>{complete=resolve;});
  globalThis.fetch=()=>pending;
  const enabled=sound.enable();await Promise.resolve();sound.disable();
  complete({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  assert.equal(await enabled,false);assert.equal(sound.enabled,false);assert.equal(statuses.at(-1).state,'off');
});
test('playback errors and interrupted contexts are surfaced instead of swallowed',async t=>{
  t.mock.method(console,'error',()=>{});
  const {stats,statuses,sound}=setup();await sound.enable();
  stats.startFails=true;sound.play('rifle');
  assert.equal(sound.enabled,false);assert.equal(statuses.at(-1).state,'error');
  assert.match(statuses.at(-1).message,/device unavailable/);
  stats.startFails=false;await sound.enable(false);stats.contexts[0].state='suspended';sound.play('pistol');
  assert.equal(sound.enabled,false);assert.match(statuses.at(-1).message,/Click Retry sound to resume/);
});
