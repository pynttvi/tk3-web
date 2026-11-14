// DOM/Canvas adapter checks only. These are not browser screenshot tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {installFakeAudio} from './fake_audio.mjs';

class Element {
  listeners=new Map();children=[];textContent='';value='0';hidden=false;tagName='DIV';
  addEventListener(name,callback){this.listeners.set(name,callback);}
  dispatch(name,event={}){return this.listeners.get(name)?.({target:this,preventDefault(){},...event});}
  append(child){this.children.push(child);}
  focus(){this.focused=true;}
  setAttribute(name,value){this[name]=value;}
  getBoundingClientRect(){return {left:0,top:0,width:320,height:200};}
}
const ids=['game','level','overlay','status','start','overlay-title','overlay-note','mission','health','health-value',
  'ammo','enemies','weapon','timer','pause','restart','sound','map','play-area','fullscreen','audio-status'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const canvas=elements.game;canvas.tagName='CANVAS';canvas.width=320;canvas.height=200;
canvas.getContext=()=>({imageSmoothingEnabled:false,drawImage(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});
const documentEvents=new Element();
globalThis.document={getElementById:id=>elements[id],createElement:()=>new Element(),fullscreenElement:null,
  fullscreenEnabled:true,addEventListener:(name,callback)=>documentEvents.addEventListener(name,callback),
  async exitFullscreen(){this.fullscreenElement=null;documentEvents.dispatch('fullscreenchange');}};
elements['play-area'].requestFullscreen=async()=>{document.fullscreenElement=elements['play-area'];documentEvents.dispatch('fullscreenchange');};
globalThis.window=new Element();
const pendingImages=[];
globalThis.Image=class {
  width=928;height=667;
  decode(){return new Promise(resolve=>pendingImages.push(resolve));}
};
const frames=[];globalThis.requestAnimationFrame=callback=>frames.push(callback);
const level={id:'fixture',comment:'Fixture map',width:24,height:20,starts:[[2,2],[3,3]],enemies:[1,0,0,0,0,0,0],
  normal_crates:{health:0,weapons:[],ammunition:[]},
  cells:Array.from({length:480},(_,i)=>({type:i%24===0||i%24===23||i<24||i>=456?1:0,num:0,shadow:0}))};
const scene={levels:[level],images:Object.fromEntries(['floor1','walls1','rambo2','enemy0','crates'].map(name=>[name,{file:name+'.png'}]))};
fs.writeFileSync(new URL('../.test-build/scene.js',import.meta.url),'export default '+JSON.stringify(scene)+';');
await import('../.test-build/main.js');

test('controls during asynchronous image loading do not access uninitialized state',()=>{
  assert.doesNotThrow(()=>elements.pause.dispatch('click'));
  assert.doesNotThrow(()=>elements.restart.dispatch('click'));
  assert.doesNotThrow(()=>elements.level.dispatch('change'));
  assert.doesNotThrow(()=>canvas.dispatch('pointermove',{clientX:40,clientY:40}));
});
test('load, start, keyboard fire and pause update the actual UI adapter',async()=>{
  for(const resolve of pendingImages)resolve();await setImmediate();
  assert.equal(elements.level.children.length,1);
  assert.equal(elements.ammo.textContent,'160');assert.equal(elements.status.textContent,'Standby');
  elements.start.dispatch('click');frames.shift()(1);frames.shift()(26);
  assert.equal(elements.status.textContent,'Active');
  window.dispatch('keydown',{code:'Space',repeat:false,target:canvas});frames.shift()(51);
  assert.equal(elements.ammo.textContent,'159');
  window.dispatch('keyup',{code:'Space',target:canvas});
  elements.pause.dispatch('click');assert.equal(elements.status.textContent,'Paused');
  assert.equal(elements.overlay.hidden,false);
  elements.pause.dispatch('click');assert.equal(elements.status.textContent,'Active');
  window.dispatch('blur');frames.shift()(76);assert.equal(elements.status.textContent,'Paused');
});

test('fullscreen button toggles the game area and tracks browser-driven exit',async()=>{
  await elements.fullscreen.dispatch('click');
  assert.equal(document.fullscreenElement,elements['play-area']);
  assert.equal(elements.fullscreen.textContent,'Exit fullscreen');
  assert.equal(elements.fullscreen['aria-pressed'],'true');
  await elements.fullscreen.dispatch('click');
  assert.equal(document.fullscreenElement,null);
  assert.equal(elements.fullscreen.textContent,'Fullscreen');
  await elements.fullscreen.dispatch('click');
  await document.exitFullscreen();
  assert.equal(elements.fullscreen.textContent,'Fullscreen');
  assert.equal(elements.fullscreen['aria-pressed'],'false');
});
test('fullscreen rejection is visible without an unhandled promise',async()=>{
  elements['play-area'].requestFullscreen=async()=>{throw new Error('Denied');};
  await elements.fullscreen.dispatch('click');
  assert.equal(elements.fullscreen.textContent,'Fullscreen unavailable');
  assert.match(elements.fullscreen.title,/Denied/);
});

test('sound control unlocks audio and provides confirmation and mute feedback',async()=>{
  const stats=installFakeAudio();
  elements.sound.dispatch('click');
  assert.equal(stats.resumeCalls,1);
  assert.equal(elements.sound.textContent,'Loading sound…');
  await setImmediate();
  assert.equal(elements.sound.textContent,'Sound on');
  assert.equal(elements.sound['aria-pressed'],'true');
  assert.equal(elements['audio-status'].textContent,'Sound ready.');
  assert.equal(stats.sources.filter(source=>source.started).length,1);
  elements.sound.dispatch('click');assert.equal(elements.sound.textContent,'Enable sound');
  assert.equal(elements['audio-status'].textContent,'Sound off.');
});
