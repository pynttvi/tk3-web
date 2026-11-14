// SPDX-License-Identifier: GPL-3.0
// Tile addressing and sprite cell/padding are source-assisted; lighting is unimplemented.
import {tileSource} from './simulation.js';

export class Renderer {
  canvas:HTMLCanvasElement;
  context:CanvasRenderingContext2D;
  sheets:Record<string,HTMLImageElement>={};
  scene:any;
  camera={x:0,y:0};
  constructor(canvas:HTMLCanvasElement,scene:any) {
    this.canvas=canvas;this.scene=scene;
    const context=canvas.getContext('2d');if(!context)throw new Error('Canvas 2D unavailable');
    this.context=context;context.imageSmoothingEnabled=false;
  }
  async load() {
    await Promise.all(Object.entries(this.scene.images).map(async([name,entry]:[string,any])=>{
      const image=new Image();image.src='assets/'+entry.file;await image.decode();this.sheets[name]=image;
    }));
  }
  sprite(name:string,actor:any,enemy=false) {
    const image=this.sheets[name];if(!image)return;
    const columns=Math.trunc(image.width/29),rows=Math.trunc(image.height/29);
    const column=Math.floor((((actor.angle%360)+360)%360)/360*columns)%columns;
    let row=enemy?(actor.flash?3:(actor.walk?Math.min(2,Math.floor(actor.walk/5)):1)):
      (actor.flash?6:(actor.walk?3+Math.min(2,Math.floor(actor.walk/5)):4));
    if(actor.health<=0)row=enemy?Math.min(rows-1,4):Math.min(rows-1,9);
    row=Math.min(row,rows-1);
    this.context.drawImage(image,column*29+1,row*29+1,28,28,
      Math.round(actor.x-this.camera.x),Math.round(actor.y-this.camera.y),28,28);
  }
  render(state:any,map=false) {
    const c=this.context,{width,height}=this.canvas,level=state.level;
    this.camera.x=Math.floor(Math.max(0,Math.min(level.width*20-width,state.player.x+14-width/2)));
    this.camera.y=Math.floor(Math.max(0,Math.min(level.height*20-height,state.player.y+14-height/2)));
    const cx=Math.floor(this.camera.x),cy=Math.floor(this.camera.y);
    c.fillStyle='#06090b';c.fillRect(0,0,width,height);
    for(let y=Math.floor(cy/20);y<Math.min(level.height,Math.ceil((cy+height)/20));y++)
      for(let x=Math.floor(cx/20);x<Math.min(level.width,Math.ceil((cx+width)/20));x++) {
        const tile=level.cells[y*level.width+x];const [sx,sy]=tileSource(tile.num);
        c.drawImage(this.sheets[tile.type===0?'floor1':'walls1'],sx,sy,20,20,x*20-cx,y*20-cy,20,20);
      }
    for(const crate of state.pickups)c.drawImage(this.sheets.crates,crate.kind*14,0,14,14,
      Math.round(crate.x-cx),Math.round(crate.y-cy),14,14);
    for(const enemy of state.enemies)if(enemy.health<=0)this.sprite('enemy'+enemy.type,enemy,true);
    const actors=[...state.enemies.filter((enemy:any)=>enemy.health>0).map((actor:any)=>({name:'enemy'+actor.type,actor,enemy:true})),
      {name:'rambo2',actor:state.player,enemy:false}].sort((a:any,b:any)=>a.actor.y-b.actor.y);
    for(const item of actors)this.sprite(item.name,item.actor,item.enemy);
    c.lineWidth=1;
    for(const tracer of state.tracers) {
      c.strokeStyle=tracer.hostile?'#ff8866':'#fff7b0';c.beginPath();
      c.moveTo(tracer.sx-cx,tracer.sy-cy);c.lineTo(tracer.x-cx,tracer.y-cy);c.stroke();
    }
    if(map)this.drawMap(state);
  }
  drawMap(state:any) {
    const c=this.context,level=state.level,scale=Math.min(3,280/level.width,160/level.height);
    const left=(320-level.width*scale)/2,top=(200-level.height*scale)/2;
    c.fillStyle='#030507e8';c.fillRect(0,0,320,200);
    for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++) {
      c.fillStyle=level.cells[y*level.width+x].type?'#555c59':'#171c1d';
      c.fillRect(left+x*scale,top+y*scale,Math.ceil(scale),Math.ceil(scale));
    }
    c.fillStyle='#ff6e4a';for(const enemy of state.enemies)if(enemy.health>0)c.fillRect(left+(enemy.x+14)/20*scale,top+(enemy.y+14)/20*scale,2,2);
    c.fillStyle='#8be8c9';c.fillRect(left+(state.player.x+14)/20*scale,top+(state.player.y+14)/20*scale,3,3);
  }
}
