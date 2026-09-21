const Audio={ac:null,muted:Save.data.mute,_t:0,
  init(){if(!this.ac){try{this.ac=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(this.ac&&this.ac.state==='suspended')this.ac.resume()},
  tone(f,d=.08,type='square',v=.035,when=0){if(this.muted||!this.ac)return;const t=this.ac.currentTime+when,o=this.ac.createOscillator(),g=this.ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(this.ac.destination);o.start(t);o.stop(t+d+.02)},
  say(line){const el=document.getElementById('toast');el.textContent=line;clearTimeout(this._t);this._t=setTimeout(()=>{el.textContent=''},2200)},
  hit(){this.tone(180,.06,'square',.05);this.tone(90,.1,'sawtooth',.04,.02)},
  block(){this.tone(420,.04,'triangle',.03)},
  parry(){this.tone(880,.08,'square',.05);this.tone(1320,.12,'square',.04,.06)},
  ko(){for(let i=0;i<6;i++)this.tone(300-40*i,.15,'sawtooth',.05,i*.07)}};
