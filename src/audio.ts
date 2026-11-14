// SPDX-License-Identifier: GPL-3.0
// One context unlocked from a user gesture, with decoded buffers for game effects.
export class SoundEffects {
  enabled=false;
  private context:AudioContext|null=null;
  private buffers=new Map<string,AudioBuffer>();
  private voices=new Set<AudioBufferSourceNode>();
  private loading:Promise<void>|null=null;
  private enabling=false;
  private generation=0;
  private onStatus:(state:string,message:string)=>void;
  constructor(onStatus:(state:string,message:string)=>void) {this.onStatus=onStatus;}

  async enable(testShot=true) {
    const generation=++this.generation;
    this.enabled=true;this.enabling=true;
    this.onStatus('loading','Loading sound effects…');
    try {
      if(!this.context||this.context.state==='closed') {
        const Context=globalThis.AudioContext||(globalThis as any).webkitAudioContext;
        if(!Context)throw new Error('This browser does not support game audio.');
        this.context=new Context();
      }
      const context=this.context!;
      // Called before the first await, inside the Sound button / input gesture.
      await context.resume();
      if(context.state!=='running')throw new Error('Browser blocked audio. Click Retry sound to try again.');
      if(!this.loading) {
        this.loading=Promise.all(['pistol','rifle','hit','death'].map(async name=>{
          if(this.buffers.has(name))return;
          const response=await fetch('assets/'+name+'.wav');
          if(!response.ok)throw new Error(`Could not load ${name}.wav (HTTP ${response.status}).`);
          const bytes=await response.arrayBuffer();
          try {this.buffers.set(name,await context.decodeAudioData(bytes));}
          catch(error) {throw new Error(`Could not decode ${name}.wav: ${String(error)}`);}
        })).then(()=>{}).catch(error=>{this.loading=null;throw error;});
      }
      await this.loading;
      if(generation!==this.generation||!this.enabled)return false;
      this.enabling=false;
      this.onStatus('ready','Sound ready.');
      if(testShot)this.play('pistol');
      return this.enabled;
    } catch(error) {
      if(generation===this.generation) {
        this.enabling=false;this.fail(error);
      }
      return false;
    }
  }

  disable() {
    this.generation++;this.enabled=false;this.enabling=false;
    this.stopVoices();
    this.onStatus('off','Sound off.');
  }

  resumeFromGesture() {
    if(this.enabled&&!this.enabling&&this.context?.state!=='running')void this.enable(false);
  }

  play(name:string) {
    if(!this.enabled||this.enabling||!this.buffers.has(name))return;
    if(this.context?.state!=='running') {
      this.fail(new Error('Audio paused by your browser. Click Retry sound to resume.'));
      return;
    }
    try {
      if(this.voices.size>=24) {
        const oldest=this.voices.values().next().value!;
        this.voices.delete(oldest);oldest.stop();
      }
      const context=this.context;
      const source=context.createBufferSource(),gain=context.createGain();
      source.buffer=this.buffers.get(name)!;
      gain.gain.value=name==='hit'?.3:.5;
      source.connect(gain);gain.connect(context.destination);
      source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};
      this.voices.add(source);
      try {source.start();}
      catch(error){this.voices.delete(source);source.disconnect();gain.disconnect();throw error;}
    } catch(error) {this.fail(error);}
  }

  private stopVoices() {
    for(const voice of this.voices)voice.stop();
    this.voices.clear();
  }

  private fail(error:unknown) {
    this.enabled=false;this.stopVoices();
    const message=error instanceof Error?error.message:String(error);
    this.onStatus('error',message);
    console.error('Game audio:',error);
  }
}
