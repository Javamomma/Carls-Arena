const G={state:'TITLE',fight:null,acc:0,last:0,sim:false,debug:false,seed:1,cam:{x:STAGE_W/2,zoom:1},
  fit(){const s=Math.min(innerWidth/W,innerHeight/H);canvas.style.width=Math.floor(W*s)+'px';canvas.style.height=Math.floor(H*s)+'px'},
  show(id,on){document.getElementById(id).classList.toggle('show',on)},
  startFight(o={}){const seed=o.seed||this.seed;
    this.fight=new Fight({seed,p1:CHAMPS[o.p1||'carl'],p2:CHAMPS[o.p2||'donut'],clock:o.clock,
      ctrl1:o.ctrl1||Ctrl.player(),ctrl2:o.ctrl2||AI.make(o.ai||'basic',seed^0xa5a5),onEvent:(t,a,b,v)=>this.onEvent(t,a,b,v)});
    this.cam={x:STAGE_W/2,zoom:1};
    Input.q.length=0;Input.held.block=false;Input.held.heavy=false;
    this.state='FIGHT';this.show('title',false);this.show('result',false);this.show('pauseMenu',false);this.show('specials',true);Audio.say('FIGHT!')},
  onEvent(t,a){if(t==='hit')Audio.hit();if(t==='block')Audio.block();if(t==='parry'){Audio.parry();Audio.say('PARRY!')}if(t==='ko')Audio.ko();
    if(t!=='ko')return;
    this.state='RESULT';document.getElementById('resultTitle').textContent=a.side===1?'VICTORY':'DEFEATED';
    document.getElementById('resultLine').textContent=a.def.name+' wins with '+Math.round(100*a.hp/a.maxHp)+'% health.';
    this.show('result',true);this.show('specials',false)},
  togglePause(){if(this.state==='FIGHT'){this.state='PAUSED';this.show('pauseMenu',true)}else if(this.state==='PAUSED'){this.state='FIGHT';this.show('pauseMenu',false);this.acc=0}},
  toTitle(){this.state='TITLE';this.fight=null;this.show('pauseMenu',false);this.show('result',false);this.show('specials',false);this.show('title',true)},
  stepFrame(){if(this.state!=='FIGHT')return;this.fight.step();this.syncSpecials()},
  simFrames(n){for(let i=0;i<n;i++)this.stepFrame()},
  syncSpecials(){const p=this.fight.p1.power;for(const n of[1,2,3])document.getElementById('s'+n).classList.toggle('ready',p>=100*n)},
  loop(t){if(!this.sim){const dt=Math.min(.1,(t-this.last)/1000||0);this.last=t;this.acc+=dt;while(this.acc>=STEP){this.stepFrame();this.acc-=STEP}}
    if(this.fight)Camera.update(this.cam,this.fight);
    Render.frame(this.fight);requestAnimationFrame(t=>this.loop(t))},
  init(){this.fit();addEventListener('resize',()=>this.fit());Input.init(canvas);
    document.getElementById('fightBtn').onclick=()=>{Audio.init();this.startFight()};
    document.getElementById('again').onclick=()=>this.startFight({seed:this.fight?this.fight.rng.int(1e9)+1:this.seed});
    document.getElementById('resultTitleBtn').onclick=()=>this.toTitle();
    document.getElementById('resume').onclick=()=>this.togglePause();
    document.getElementById('quit').onclick=()=>this.toTitle();
    document.getElementById('titleMute').onclick=e=>{Audio.muted=!Audio.muted;Save.data.mute=Audio.muted;Save.put();e.target.textContent='SOUND: '+(Audio.muted?'OFF':'ON')};
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='FIGHT')this.togglePause()});
    requestAnimationFrame(t=>{this.last=t;this.loop(t)})}};
G.init();
