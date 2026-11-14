// SPDX-License-Identifier: GPL-3.0
import scene from './scene.js';
import {createGame,stepGame,TICK_RATE,WEAPONS} from './simulation.js';
import {Renderer} from './renderer.js';
import {SoundEffects} from './audio.js';

const element=(id:string)=>{const value=document.getElementById(id);if(!value)throw new Error('Missing '+id);return value;};
const canvas=element('game') as HTMLCanvasElement;
const renderer=new Renderer(canvas,scene);
const select=element('level') as HTMLSelectElement;
const keys=new Set<string>();
let index=0,state:any,ready=false,started=false,showMap=false,fire=false,aim:number|undefined;
let last=0,accumulator=0;
const overlay=element('overlay'),status=element('status'),startButton=element('start');
const soundButton=element('sound');
const effects=new SoundEffects((audioState,message)=>{
  soundButton.textContent=audioState==='ready'?'Sound on':audioState==='loading'?'Loading sound…':audioState==='error'?'Retry sound':'Enable sound';
  soundButton.setAttribute('aria-pressed',String(audioState==='ready'));
  element('audio-status').textContent=message;
});
function reset(next=index) {
  if(!ready)return;
  index=next;select.value=String(index);state=createGame(scene.levels[index]);state.paused=true;
  started=false;keys.clear();fire=false;aim=undefined;accumulator=0;
  overlay.hidden=false;element('overlay-title').textContent='Ready when you are.';
  element('overlay-note').textContent=scene.levels[index].comment+' · '+scene.levels[index].width+' × '+scene.levels[index].height+' tiles';
  startButton.textContent='Start mission';element('mission').textContent=scene.levels[index].comment;
  render();
}
function begin() {
  if(!ready)return;
  if(state.gameOver)reset();
  else if(state.complete)reset((index+1)%scene.levels.length);
  effects.resumeFromGesture();
  started=true;state.paused=false;overlay.hidden=true;canvas.focus();
}
function pause() {
  if(!started||state.gameOver||state.complete)return;
  state.paused=!state.paused;keys.clear();fire=false;
  overlay.hidden=!state.paused;
  element('overlay-title').textContent='Mission paused.';
  element('overlay-note').textContent='Take a breath. Your position is saved in this session.';
  startButton.textContent='Resume';
}
function render() {
  if(!ready||!state)return;
  renderer.render(state,showMap);
  (element('health') as HTMLProgressElement).value=state.player.health;
  element('health-value').textContent=String(state.player.health);
  element('ammo').textContent=String(state.player.ammo);
  element('enemies').textContent=String(state.enemies.filter((enemy:any)=>enemy.health>0).length);
  element('weapon').textContent=WEAPONS[state.player.weapon].name;
  element('timer').textContent=(Math.floor(state.tick/TICK_RATE/60)).toString().padStart(2,'0')+':'+
    (Math.floor(state.tick/TICK_RATE)%60).toString().padStart(2,'0');
  status.textContent=state.gameOver?'Down':state.complete?'Clear':!started?'Standby':state.paused?'Paused':'Active';
  (element('pause') as HTMLButtonElement).textContent=state.paused?'Resume':'Pause';
  if(state.gameOver||state.complete) {
    overlay.hidden=false;
    element('overlay-title').textContent=state.complete?'Sector cleared.':'You are down.';
    element('overlay-note').textContent=state.complete?'All hostiles eliminated. Move to the next map.':'Restart the map and choose a different approach.';
    startButton.textContent=state.complete?'Next mission':'Try again';
  }
}
function frame(now:number) {
  const elapsed=last?Math.min((now-last)/1000,.1):0;last=now;
  if(started&&!state.paused&&!state.gameOver&&!state.complete)accumulator+=elapsed;
  else accumulator=0;
  while(accumulator>=1/TICK_RATE) {
    const weapon=['Digit1','Digit2','Digit3','Digit4'].findIndex(key=>keys.has(key));
    stepGame(state,{forward:keys.has('ArrowUp'),backward:keys.has('ArrowDown'),
      left:keys.has('ArrowLeft'),right:keys.has('ArrowRight'),strafeLeft:keys.has('KeyQ'),strafeRight:keys.has('KeyE'),
      worldX:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),
      worldY:(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0),
      fire:fire||keys.has('Space')||keys.has('ControlLeft'),weapon,aim});
    for(const event of state.events)effects.play(event);
    accumulator-=1/TICK_RATE;
  }
  render();requestAnimationFrame(frame);
}
for(let i=0;i<scene.levels.length;i++) {
  const option=document.createElement('option');option.value=String(i);
  option.textContent=`${i+1}. ${scene.levels[i].comment||scene.levels[i].id}`;select.append(option);
}
select.addEventListener('change',()=>reset(Number(select.value)));
startButton.addEventListener('click',begin);
element('pause').addEventListener('click',()=>{if(!started)begin();else pause();render();});
element('restart').addEventListener('click',()=>reset());
soundButton.addEventListener('click',()=>{
  if(effects.enabled)effects.disable();else void effects.enable();
  canvas.focus();
});
const playArea=element('play-area'),fullscreenButton=element('fullscreen') as HTMLButtonElement;
function updateFullscreen() {
  const active=document.fullscreenElement===playArea;
  fullscreenButton.textContent=active?'Exit fullscreen':'Fullscreen';
  fullscreenButton.setAttribute('aria-pressed',String(active));
}
if(!playArea.requestFullscreen||document.fullscreenEnabled===false) {
  fullscreenButton.disabled=true;
  fullscreenButton.title='Fullscreen is unavailable in this browser.';
}
fullscreenButton.addEventListener('click',async()=>{
  try {
    if(document.fullscreenElement===playArea)await document.exitFullscreen();
    else await playArea.requestFullscreen();
    updateFullscreen();canvas.focus();
  } catch(error) {
    fullscreenButton.textContent='Fullscreen unavailable';
    fullscreenButton.title=String(error);
  }
});
document.addEventListener('fullscreenchange',updateFullscreen);
element('map').addEventListener('click',()=>{showMap=!showMap;element('map').setAttribute('aria-pressed',String(showMap));canvas.focus();});
canvas.addEventListener('pointermove',(event)=>{
  if(!ready||!state)return;
  const box=canvas.getBoundingClientRect();
  const x=(event.clientX-box.left)/box.width*canvas.width+renderer.camera.x;
  const y=(event.clientY-box.top)/box.height*canvas.height+renderer.camera.y;
  aim=Math.atan2(x-state.player.x-14,y-state.player.y-14)*180/Math.PI;
});
canvas.addEventListener('pointerdown',(event)=>{if(event.button!==0)return;effects.resumeFromGesture();canvas.focus();fire=true;event.preventDefault();});
window.addEventListener('pointerup',()=>{fire=false;});
window.addEventListener('keydown',(event)=>{
  if(['INPUT','SELECT','BUTTON','TEXTAREA'].includes((event.target as HTMLElement).tagName))return;
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE',
      'Space','ControlLeft','Digit1','Digit2','Digit3','Digit4','KeyP','KeyR','Tab','Escape'].includes(event.code))return;
  event.preventDefault();
  effects.resumeFromGesture();
  if((event.code==='KeyP'||event.code==='Escape')&&!event.repeat){pause();return;}
  if(event.code==='KeyR'&&!event.repeat){reset();return;}
  if(event.code==='Tab'){showMap=true;return;}
  if(event.code.startsWith('Arrow'))aim=undefined;
  keys.add(event.code);
});
window.addEventListener('keyup',(event)=>{keys.delete(event.code);if(event.code==='Tab')showMap=false;});
window.addEventListener('blur',()=>{keys.clear();fire=false;if(started&&!state.paused)pause();});
(async()=>{
  try {await renderer.load();ready=true;reset();requestAnimationFrame(frame);}
  catch(error) {element('overlay-title').textContent='Could not load the local build.';element('overlay-note').textContent=String(error);startButton.hidden=true;console.error(error);}
})();
