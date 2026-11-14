import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,direction,tileSource,moveActor,stepGame,fire} from '../.test-build/simulation.js';
import {Renderer} from '../.test-build/renderer.js';

function map(width=24,height=20) {
  return {width,height,starts:[[2,2],[3,3]],enemies:[0,0,0,0,0,0,0],
    normal_crates:{weapons:[],ammunition:[],health:0},
    cells:Array.from({length:width*height},(_,i)=>({type:i%width===0||i%width===width-1||i<width||i>=width*(height-1)?1:0,num:0,shadow:0}))};
}
function enemy(x=300,y=200) {
  return {x,y,type:0,health:1000,speed:0,weapon:-1,angle:0,cooldown:0,walk:0,flash:0};
}
function game(level=map()) {const state=createGame(level);state.enemies=[enemy()];return state;}

test('source coordinate convention: zero down, 90 right; 20px tile atlas',()=>{
  assert.deepEqual(direction(0),[0,1]);
  assert.ok(Math.abs(direction(90)[0]-1)<1e-12);
  assert.ok(Math.abs(direction(180)[1]+1)<1e-12);
  assert.deepEqual(tileSource(19),[60,20]);
  assert.deepEqual(tileSource(159),[300,180]);
});
test('reference forward/backward distances and axis-separated wall collision',()=>{
  const state=game();state.player.angle=0;
  stepGame(state,{forward:true});assert.equal(state.player.y,42);
  stepGame(state,{backward:true});assert.equal(state.player.y,40.5);
  const level=map();for(let y=1;y<level.height-1;y++)level.cells[y*level.width+5].type=1;
  const actor={x:77.9,y:80};
  moveActor(level,actor,45,2);
  assert.equal(actor.x,77.9);assert.equal(actor.y,Math.fround(80+Math.sqrt(2)));
});
test('stored spawn may overlap neighboring wall without moving the spawn',()=>{
  const level=map();level.starts[0]=[2,2];level.cells[2*level.width+3].type=1;
  const state=createGame(level);assert.equal(state.player.x,40);
  moveActor(level,state.player,270,2);assert.equal(state.player.x,38);
});
test('pistol cooldown is ten ticks, with one ammo per shot',()=>{
  const state=game();state.player.ammo=20;
  for(let tick=0;tick<25;tick++)stepGame(state,{fire:true});
  assert.equal(state.player.ammo,17);
});
test('bullets hit a target in range and stop at intervening walls',()=>{
  const open=game();open.enemies=[enemy(90,40)];open.player.angle=90;
  fire(open,open.player,0);assert.equal(open.enemies[0].health,995);
  const blocked=game();blocked.enemies=[enemy(90,40)];blocked.player.angle=90;
  blocked.level.cells[2*blocked.level.width+4].type=1;
  fire(blocked,blocked.player,0);assert.equal(blocked.enemies[0].health,1000);
});
test('completion freezes simulation, and pause does not consume time',()=>{
  const state=game();state.paused=true;stepGame(state,{forward:true});assert.equal(state.tick,0);
  state.paused=false;state.enemies=[{...enemy(90,40),health:5}];state.player.angle=90;
  stepGame(state,{fire:true});assert.equal(state.kills,1);assert.equal(state.complete,true);
  const x=state.player.x;stepGame(state,{worldX:1});assert.equal(state.tick,1);assert.equal(state.player.x,x);
});
test('seeded replays are deterministic',()=>{
  const replay=()=>{const state=game();for(let i=0;i<180;i++)stepGame(state,{worldX:i%2?1:-1,aim:i*7,fire:i%3===0});return JSON.stringify(state);};
  assert.equal(replay(),replay());
});
for(const columns of [32,40])test(`renderer handles ${columns}-column sheets without reading past source image`,()=>{
  const calls=[];const context={imageSmoothingEnabled:true,drawImage:(...args)=>calls.push(args),
    fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  const renderer=new Renderer({width:320,height:200,getContext:()=>context},{});
  const image={width:columns*29,height:667};renderer.sheets.rambo2=image;
  renderer.sprite('rambo2',{x:40,y:40,angle:359,health:100,walk:0,flash:0});
  assert.equal(calls.length,1);const [,sx,sy,width,height]=calls[0];
  assert.equal(sx,(columns-1)*29+1);assert.ok(sx+width<=image.width);assert.ok(sy+height<=image.height);
  assert.equal(context.imageSmoothingEnabled,false);
});


test('4x renderer scales source rectangles while preserving sprite and world coordinates',()=>{
  const calls=[];const context={drawImage:(...args)=>calls.push(args),fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  const renderer=new Renderer({width:1280,height:800,getContext:()=>context},{});
  renderer.graphicsScale=4;
  const image={width:928*4,height:667*4};renderer.sheets.rambo2=image;
  renderer.sprite('rambo2',{x:40,y:40,angle:359,health:100,walk:0,flash:0});
  assert.deepEqual(calls[0].slice(1),[(31*29+1)*4,(4*29+1)*4,112,112,40,40,28,28]);
  assert.equal(renderer.width,320);assert.equal(renderer.height,200);
});
