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
const touchPointers=new Map<number,string>();
const touchBindings:Record<string,string>={
  'touch-forward':'ArrowUp','touch-backward':'ArrowDown','touch-left':'ArrowLeft','touch-right':'ArrowRight',
  'touch-strafe-left':'KeyQ','touch-strafe-right':'KeyE','touch-fire':'Space',
};
const held=(key:string)=>keys.has(key)||[...touchPointers.values()].includes(key);
function clearTouch() {
  touchPointers.clear();
  for(const id of Object.keys(touchBindings))element(id).setAttribute('data-held','false');
}
let index=0,state:any,ready=false,started=false,showMap=false,fire=false,aim:number|undefined;
let last=0,accumulator=0;
const overlay=element('overlay'),status=element('status'),startButton=element('start');
const soundButton=element('sound');
const effects=new SoundEffects((audioState,message)=>{
  soundButton.textContent=audioState==='ready'?'Sound on':audioState==='loading'?'Loading sound…':audioState==='error'?'Retry sound':'Enable sound';
  soundButton.setAttribute('aria-pressed',String(audioState==='ready'));
  element('audio-status').textContent=message;
});
const controllerButton=element('controller') as HTMLButtonElement;
const controllerStatus=element('controller-status');
let controllerEnabled=false,controllerFocused=true,controllerId='',previousButtons:boolean[]=[];
function pollController() {
  const input={x:0,y:0,fire:false};
  if(!controllerEnabled||!controllerFocused||document.hidden)return input;
  try {
    const pads=Array.from(navigator.getGamepads());
    const pad=pads.find(pad=>pad?.connected&&pad.mapping==='standard');
    if(!pad) {
      controllerId='';previousButtons=[];
      controllerStatus.textContent=pads.some(pad=>pad?.connected)?
        'This controller has no standard mapping. Try an Xbox or PlayStation compatible controller.':
        'Waiting for controller. Connect one and press a controller button.';
      return input;
    }
    controllerStatus.textContent='Connected: '+pad.id;
    const buttons=pad.buttons.map(button=>button.pressed);
    const id=pad.index+':'+pad.id;
    // Ignore held menu buttons when a controller first appears or reconnects.
    if(controllerId!==id){controllerId=id;previousButtons=buttons;}
    const pressed=(index:number)=>buttons[index]&&!previousButtons[index];
    if(pressed(9)){if(!started||state.gameOver||state.complete)begin();else pause();}
    if(pressed(8)){showMap=!showMap;element('map').setAttribute('aria-pressed',String(showMap));}
    if(started&&!state.paused&&!state.gameOver&&!state.complete) {
      if(pressed(4))state.player.weapon=(state.player.weapon+WEAPONS.length-1)%WEAPONS.length;
      if(pressed(5))state.player.weapon=(state.player.weapon+1)%WEAPONS.length;
      const stick=(x:number,y:number)=>{
        const length=Math.hypot(x,y);
        if(length<.2)return [0,0];
        const scale=Math.min(1,(length-.2)/.8)/length;
        return [x*scale,y*scale];
      };
      const [x,y]=stick(pad.axes[0]||0,pad.axes[1]||0);
      input.x=Math.max(-1,Math.min(1,x+(buttons[15]?1:0)-(buttons[14]?1:0)));
      input.y=Math.max(-1,Math.min(1,y+(buttons[13]?1:0)-(buttons[12]?1:0)));
      const [aimX,aimY]=stick(pad.axes[2]||0,pad.axes[3]||0);
      if(aimX||aimY)aim=Math.atan2(aimX,aimY)*180/Math.PI;
      else if(input.x||input.y)aim=Math.atan2(input.x,input.y)*180/Math.PI;
      input.fire=!!(buttons[0]||buttons[7]);
    }
    previousButtons=buttons;
  } catch(error) {
    controllerEnabled=false;controllerId='';previousButtons=[];
    controllerButton.textContent='Enable controller';controllerButton.setAttribute('aria-pressed','false');
    controllerStatus.textContent='Controller unavailable: '+String(error);
  }
  return input;
}
if(typeof navigator.getGamepads!=='function') {
  controllerButton.disabled=true;
  controllerStatus.textContent='Controller API unavailable. Try a browser with Gamepad support over HTTPS or localhost.';
}
controllerButton.addEventListener('click',()=>{
  effects.resumeFromGesture();
  controllerEnabled=!controllerEnabled;controllerId='';previousButtons=[];
  controllerButton.textContent=controllerEnabled?'Disable controller':'Enable controller';
  controllerButton.setAttribute('aria-pressed',String(controllerEnabled));
  controllerStatus.textContent=controllerEnabled?'Waiting for controller. Connect one and press a controller button.':'Controller off.';
  canvas.focus();
});
window.addEventListener('focus',()=>{controllerFocused=true;});
function reset(next=index) {
  if(!ready)return;
  index=next;select.value=String(index);state=createGame(scene.levels[index]);state.paused=true;
  started=false;clearTouch();keys.clear();fire=false;aim=undefined;accumulator=0;
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
  state.paused=!state.paused;clearTouch();keys.clear();fire=false;
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
  const controller=pollController();
  const elapsed=last?Math.min((now-last)/1000,.1):0;last=now;
  if(started&&!state.paused&&!state.gameOver&&!state.complete)accumulator+=elapsed;
  else accumulator=0;
  while(accumulator>=1/TICK_RATE) {
    const weapon=['Digit1','Digit2','Digit3','Digit4'].findIndex(key=>keys.has(key));
    stepGame(state,{forward:held('ArrowUp'),backward:held('ArrowDown'),
      left:held('ArrowLeft'),right:held('ArrowRight'),strafeLeft:held('KeyQ'),strafeRight:held('KeyE'),
      worldX:Math.max(-1,Math.min(1,(held('KeyD')?1:0)-(held('KeyA')?1:0)+controller.x)),
      worldY:Math.max(-1,Math.min(1,(held('KeyS')?1:0)-(held('KeyW')?1:0)+controller.y)),
      fire:controller.fire||fire||held('Space')||held('ControlLeft'),weapon,aim});
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
for(const [id,key] of Object.entries(touchBindings)) {
  const button=element(id);
  button.addEventListener('pointerdown',(event:PointerEvent)=>{
    if(event.button!==0)return;
    event.preventDefault();effects.resumeFromGesture();
    if(!started||state.paused||state.gameOver||state.complete)return;
    button.setPointerCapture(event.pointerId);
    touchPointers.set(event.pointerId,key);button.setAttribute('data-held','true');
    if(key!=='Space')aim=undefined;
  });
  const release=(event:PointerEvent)=>{
    touchPointers.delete(event.pointerId);
    button.setAttribute('data-held',String([...touchPointers.values()].includes(key)));
  };
  button.addEventListener('pointerup',release);
  button.addEventListener('pointercancel',release);
  button.addEventListener('lostpointercapture',release);
  button.addEventListener('contextmenu',event=>event.preventDefault());
}
element('touch-weapon').addEventListener('click',()=>{
  if(ready&&started&&!state.paused)state.player.weapon=(state.player.weapon+1)%WEAPONS.length;
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){clearTouch();keys.clear();fire=false;if(started&&!state.paused)pause();}
});
canvas.addEventListener('pointermove',(event)=>{
  if(event.pointerType==='touch')return;
  if(!ready||!state)return;
  const box=canvas.getBoundingClientRect();
  const x=(event.clientX-box.left)/box.width*canvas.width+renderer.camera.x;
  const y=(event.clientY-box.top)/box.height*canvas.height+renderer.camera.y;
  aim=Math.atan2(x-state.player.x-14,y-state.player.y-14)*180/Math.PI;
});
canvas.addEventListener('pointerdown',(event)=>{if(event.pointerType==='touch'||event.button!==0)return;effects.resumeFromGesture();canvas.focus();fire=true;event.preventDefault();});
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
window.addEventListener('blur',()=>{controllerFocused=false;clearTouch();keys.clear();fire=false;if(started&&!state.paused)pause();});
(async()=>{
  try {await renderer.load();ready=true;reset();requestAnimationFrame(frame);}
  catch(error) {element('overlay-title').textContent='Could not load the game.';element('overlay-note').textContent=String(error);startButton.hidden=true;console.error(error);}
})();
