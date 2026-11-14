// Test doubles exercise lifecycle and errors, not real browser audio output.
export function installFakeAudio() {
  const stats={contexts:[],fetches:[],decodes:0,sources:[],resumeCalls:0,decodeFails:false,startFails:false};
  class Context {
    state='suspended';destination={};
    constructor(){stats.contexts.push(this);}
    resume(){stats.resumeCalls++;this.state='running';return Promise.resolve();}
    decodeAudioData(){stats.decodes++;return stats.decodeFails?Promise.reject(new Error('bad WAV')):Promise.resolve({sampleRate:16000});}
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
    createBufferSource(){
      const source={started:false,stopped:false,connect(){},disconnect(){},
        start(){if(stats.startFails)throw new Error('device unavailable');this.started=true;},
        stop(){this.stopped=true;this.onended?.();}};
      stats.sources.push(source);return source;
    }
  }
  globalThis.AudioContext=Context;
  globalThis.fetch=async url=>{stats.fetches.push(url);return {ok:true,status:200,arrayBuffer:async()=>new ArrayBuffer(8)};};
  return stats;
}
