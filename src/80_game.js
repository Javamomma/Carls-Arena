const G={state:'TITLE',fight:null,acc:0,last:0,sim:false,debug:false,seed:1,
  fit(){const s=Math.min(innerWidth/W,innerHeight/H);canvas.style.width=Math.floor(W*s)+'px';canvas.style.height=Math.floor(H*s)+'px'},
  show(id,on){document.getElementById(id).classList.toggle('show',on)},
  loop(t){const c=canvas.getContext('2d');c.fillStyle='#1a1f33';c.fillRect(0,0,W,FLOOR);c.fillStyle='#2b2f45';c.fillRect(0,FLOOR,W,H-FLOOR);requestAnimationFrame(t=>this.loop(t))},
  init(){this.fit();addEventListener('resize',()=>this.fit());
    document.getElementById('titleMute').onclick=e=>{Audio.muted=!Audio.muted;Save.data.mute=Audio.muted;Save.put();e.target.textContent='SOUND: '+(Audio.muted?'OFF':'ON')};
    requestAnimationFrame(t=>{this.last=t;this.loop(t)})}};
G.init();
