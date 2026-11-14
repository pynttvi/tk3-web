// SPDX-License-Identifier: GPL-3.0
// Source-assisted adaptation: upstream commit a3398b6..., SRC/CLASSES.CPP,
// DRAW.CPP, GAME.CPP, MISCFUNC.CPP and GLOBVAR.CPP. See THIRD_PARTY_NOTICES.md.
// Tick rate, RNG, AI and loadout are prototype choices, NOT measured v3.0 parity.
export const TICK_RATE = 40;
export const TILE = 20;
export const WEAPONS = [
  {name:'Pistol', delay:10, pellets:1, spread:10, power:5, range:108, sound:'pistol'},
  {name:'Shotgun', delay:17, pellets:6, spread:20, power:3, range:108, sound:'rifle'},
  {name:'Uzi', delay:4, pellets:1, spread:10, power:5, range:108, sound:'rifle'},
  {name:'Rifle', delay:5, pellets:1, spread:10, power:8, range:126, sound:'rifle'},
];
const ENEMIES = [
  {health:18,speed:2,weapon:0}, {health:28,speed:2,weapon:1},
  {health:40,speed:2,weapon:2}, {health:50,speed:3,weapon:3},
  {health:40,speed:2,weapon:1}, {health:10,speed:2,weapon:-1},
  {health:150,speed:1,weapon:1},
];
export function wrapAngle(value:number) {return ((value%360)+360)%360;}
export function direction(angle:number) {
  const radians=angle*Math.PI/180;
  return [Math.sin(radians),Math.cos(radians)];
}
export function tileSource(number:number) {
  // SRC/DRAW.CPP:37. 16 columns, 20x20 pixels, without cell padding.
  return [(number&15)*20,Math.trunc(number/16)*20];
}
export function cell(level:any,x:number,y:number) {
  const cx=Math.floor(x/TILE),cy=Math.floor(y/TILE);
  return cx<0||cy<0||cx>=level.width||cy>=level.height ? 1 : level.cells[cy*level.width+cx].type;
}
export function random(state:any) {
  let value=state.seed|0;value^=value<<13;value^=value>>>17;value^=value<<5;
  state.seed=value>>>0;
  return state.seed/4294967296;
}
export function moveActor(level:any, actor:any, angle:number, speed:number) {
  // Eight-point, axis-separated floor checks: SRC/CLASSES.CPP:433-462, 463-541.
  const [dx,dy]=direction(angle);
  const nx=Math.fround(actor.x+speed*dx),ny=Math.fround(actor.y+speed*dy);
  const x=Math.trunc(nx),y=Math.trunc(ny);
  let moved=false;
  if(ny<actor.y&&cell(level,x+10,y+6)===0&&cell(level,x+18,y+6)===0) {actor.y=ny;moved=true;}
  if(ny>actor.y&&cell(level,x+10,y+22)===0&&cell(level,x+18,y+22)===0) {actor.y=ny;moved=true;}
  if(nx<actor.x&&cell(level,x+6,y+10)===0&&cell(level,x+6,y+18)===0) {actor.x=nx;moved=true;}
  if(nx>actor.x&&cell(level,x+22,y+10)===0&&cell(level,x+22,y+18)===0) {actor.x=nx;moved=true;}
  return moved;
}
export function lineOfSight(level:any, x:number,y:number,tx:number,ty:number) {
  const distance=Math.hypot(tx-x,ty-y), steps=Math.max(1,Math.ceil(distance/2));
  for(let i=0;i<=steps;i++) if(cell(level,x+(tx-x)*i/steps,y+(ty-y)*i/steps)!==0) return false;
  return true;
}
function canStand(level:any,x:number,y:number) {
  return [[6,6],[22,6],[6,22],[22,22]].every(([dx,dy])=>cell(level,x+dx,y+dy)===0);
}
function place(state:any, minimumDistance:number) {
  for(let attempts=0;attempts<12000;attempts++) {
    const tx=1+Math.floor(random(state)*(state.level.width-2));
    const ty=1+Math.floor(random(state)*(state.level.height-2));
    const x=tx*20-5,y=ty*20-5;
    if(!canStand(state.level,x,y)||Math.hypot(x-state.player.x,y-state.player.y)<minimumDistance) continue;
    if(state.enemies.some((e:any)=>Math.hypot(e.x-x,e.y-y)<28))continue;
    return {x,y};
  }
  return null;
}
export function createGame(level:any, seed=0x544b3301) {
  const state:any={level,seed:seed>>>0,tick:0,player:{x:level.starts[0][0]*20,y:level.starts[0][1]*20,
    angle:180,health:100,weapon:0,ammo:160,cooldown:0,walk:0,flash:0},enemies:[],pickups:[],tracers:[],
    events:[],kills:0,paused:false,complete:false,gameOver:false};
  // Original starts are tile origins, and can overlap an adjacent wall (local LEVEL6).
  // Match the stored spawn; directional collision checks let the player move away.
  if(cell(level,state.player.x+14,state.player.y+14)!==0)throw new Error('Player start is not on a floor tile');
  for(let type=0;type<level.enemies.length;type++)for(let n=0;n<level.enemies[type];n++) {
    const location=place(state,160);if(!location)throw new Error('Cannot place all level enemies');
    state.enemies.push({...location,...ENEMIES[type],type,angle:random(state)*360,cooldown:15+Math.floor(random(state)*40),walk:0,flash:0});
  }
  // Prototype placement uses the recovered counts; RNG is not the DOS rand() implementation.
  const crateInfo=level.normal_crates||{health:0,ammunition:[],weapons:[]};
  for(const [kind,count] of [[2,crateInfo.health],[1,crateInfo.ammunition.reduce((a:number,b:number)=>a+b,0)],
      [0,crateInfo.weapons.reduce((a:number,b:number)=>a+b,0)]] as [number,number][]) {
    for(let i=0;i<Math.min(count,100);i++) {const loc=place(state,60);if(loc)state.pickups.push({...loc,kind});}
  }
  return state;
}
export function fire(state:any, actor:any, weapon:number, hostile=false) {
  const spec=WEAPONS[weapon];
  if(!spec)return;
  actor.cooldown=spec.delay;actor.flash=3;
  state.events.push(spec.sound);
  for(let pellet=0;pellet<spec.pellets;pellet++) {
    const angle=wrapAngle(actor.angle+Math.trunc(spec.spread/2)-Math.floor(random(state)*spec.spread));
    const [dx,dy]=direction(angle);
    const sx=actor.x+14+10*dx,sy=actor.y+14+10*dy;
    let x=sx,y=sy;
    // SRC/CLASSES.CPP:1022-1055: ~4px bullet substeps and inner 5..22 hit bounds.
    const steps=Math.max(1,Math.trunc(spec.range/4));
    for(let step=0;step<steps;step++) {
      x+=spec.range/steps*dx;y+=spec.range/steps*dy;
      if(cell(state.level,x,y)!==0) break;
      const targets=hostile?[state.player]:state.enemies;
      const hit=targets.find((other:any)=>other.health>0&&x>other.x+5&&x<other.x+22&&y>other.y+5&&y<other.y+22);
      if(hit) {
        hit.health=Math.max(0,hit.health-spec.power);
        state.events.push('hit');
        if(hit.health===0&&!hostile){state.kills++;state.events.push('death');}
        break;
      }
    }
    state.tracers.push({sx,sy,x,y,ttl:2,hostile});
  }
}
export function stepGame(state:any, input:any={}) {
  state.events=[];
  if(state.paused||state.gameOver||state.complete)return;
  state.tick++;
  const player=state.player;
  player.cooldown=Math.max(0,player.cooldown-1);player.flash=Math.max(0,player.flash-1);
  if(Number.isInteger(input.weapon)&&input.weapon>=0&&input.weapon<WEAPONS.length)player.weapon=input.weapon;
  if(Number.isFinite(input.aim))player.angle=wrapAngle(input.aim);
  else player.angle=wrapAngle(player.angle+(input.left?9:0)-(input.right?9:0));
  let moved=false;
  if(input.forward)moved=moveActor(state.level,player,player.angle,2)||moved;
  if(input.backward)moved=moveActor(state.level,player,player.angle+180,1.5)||moved;
  if(input.strafeLeft)moved=moveActor(state.level,player,player.angle+90,1.8)||moved;
  if(input.strafeRight)moved=moveActor(state.level,player,player.angle+270,1.8)||moved;
  // Optional world-relative WASD controls are a browser adaptation, not original input logic.
  if(input.worldX||input.worldY) {
    const degrees=Math.atan2(input.worldX,input.worldY)*180/Math.PI;
    moved=moveActor(state.level,player,degrees,2)||moved;
  }
  player.walk=moved?(player.walk+1)%20:0;
  state.tracers=state.tracers.filter((t:any)=>--t.ttl>0);
  if(input.fire&&player.cooldown===0&&player.ammo>0) {fire(state,player,player.weapon);player.ammo--;}
  for(const enemy of state.enemies) {
    if(enemy.health<=0)continue;
    enemy.cooldown=Math.max(0,enemy.cooldown-1);enemy.flash=Math.max(0,enemy.flash-1);
    const dx=player.x-enemy.x,dy=player.y-enemy.y,distance=Math.hypot(dx,dy);
    const sees=distance<260&&lineOfSight(state.level,enemy.x+14,enemy.y+14,player.x+14,player.y+14);
    if(sees&&enemy.weapon>=0) {
      const target=wrapAngle(Math.atan2(dx,dy)*180/Math.PI);
      const delta=((target-enemy.angle+540)%360)-180;
      enemy.angle=wrapAngle(enemy.angle+Math.max(-9,Math.min(9,delta)));
      if(distance>85&&distance>28)enemy.walk=moveActor(state.level,enemy,enemy.angle,enemy.speed)?(enemy.walk+1)%20:0;
      if(distance<WEAPONS[enemy.weapon].range&&Math.abs(delta)<12&&enemy.cooldown===0)fire(state,enemy,enemy.weapon,true);
    } else {
      if(state.tick%90===0)enemy.angle=wrapAngle(enemy.angle+(random(state)-.5)*180);
      if(moveActor(state.level,enemy,enemy.angle,enemy.speed*.5))enemy.walk=(enemy.walk+1)%20;
      else enemy.angle=wrapAngle(enemy.angle+90);
    }
  }
  state.pickups=state.pickups.filter((pickup:any)=>{
    if(Math.hypot(pickup.x-player.x,pickup.y-player.y)>20)return true;
    if(pickup.kind===2)player.health=Math.min(100,player.health+25);
    else player.ammo+=40;
    state.events.push('pickup');return false;
  });
  state.gameOver=player.health<=0;
  state.complete=state.enemies.every((enemy:any)=>enemy.health<=0);
}
