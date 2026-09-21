const G={state:'TITLE',fight:null,encounter:null,acc:0,last:0,sim:false,debug:false,seed:1,cam:{x:STAGE_W/2,zoom:1},_tickN:0,
  frameNow:0,_sayAt:-999, // mirrors fight.frame (updated in tick()); gates G.say to one line per 90 frames
  fit(){const s=Math.min(innerWidth/W,innerHeight/H);canvas.style.width=Math.floor(W*s)+'px';canvas.style.height=Math.floor(H*s)+'px'},
  show(id,on){document.getElementById(id).classList.toggle('show',on)},
  // Canvas hit-test for the HUD's pause glyph (drawn by Render.hud at Render.pauseRect), consulted
  // by Input's pointerdown handler before it does any zone/gesture handling.
  hitPause(x,y){const r=Render.pauseRect;return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h},
  // {encounter:'f1_goblin'|{...}} resolves via Encounter.resolve, stores the result on G.encounter
  // (the HUD's floor line reads it), and clones the enemy def here (never inside Fight) so p2's
  // hp/atk carry the encounter's multipliers without mutating the shared DEFS entry.
  startFight(o={}){const seed=o.seed||this.seed;
    let p2def=DEFS[o.p2||'donut'],ai=o.ai||'basic';
    this.encounter=null;
    if(o.encounter){
      const enc=Encounter.resolve(o.encounter);this.encounter=enc;
      p2def=Object.assign({},enc.enemy,{hp:Math.round(enc.enemy.hp*enc.hpMul),atk:Math.round(enc.enemy.atk*enc.atkMul)});
      ai=enc.tier}
    this.fight=new Fight({seed,p1:DEFS[o.p1||'carl'],p2:p2def,clock:o.clock,
      ctrl1:o.ctrl1||Ctrl.player(),ctrl2:o.ctrl2||AI.make(ai,seed^0xa5a5),onEvent:(t,a,b,v)=>this.onEvent(t,a,b,v)});
    this.cam={x:STAGE_W/2,zoom:1};FX.reset();
    Input.q.length=0;Input.held.block=false;Input.held.heavy=false;
    // Fresh throttle window per fight so the opening announcer line always fires immediately,
    // regardless of how recently the previous fight's last toast landed.
    this.frameNow=0;this._sayAt=-999;
    this.state='FIGHT';this.show('title',false);this.show('result',false);this.show('pauseMenu',false);this.show('btns',true);Audio.announce('start',this.fight.rng)},
  // Throttled announcer display: only updates the toast if at least 90 frames (1.5s) have passed
  // since the last line, so a burst of events can't stomp on each other mid-read. Audio.say remains
  // the unthrottled display primitive this calls into.
  say(text){if(this.frameNow-this._sayAt>=90){this._sayAt=this.frameNow;Audio.say(text)}},
  // Per-move sound recipe dispatch + announcer hookup. `a`/`b`/`val` mirror Fight.emit's args.
  onEvent(t,a,b,val){
    if(t==='hit'){(Audio.recipes[a.moveName]||Audio.recipes.lights)();
      if(a.combo===3||a.combo===5||a.combo===10)Audio.announce('streak'+a.combo,this.fight.rng)}
    else if(t==='block')Audio.recipes.block();
    else if(t==='parry'){Audio.recipes.parry();Audio.announce('parry',this.fight.rng)}
    else if(t==='miss'){if(b&&b.state==='DASH')Audio.recipes.dash()}
    else if(t==='ko'){Audio.recipes.ko();Audio.announce(a.side===1?'win':'loss',this.fight.rng)}
    if(t!=='ko')return;
    this.state='RESULT';document.getElementById('resultTitle').textContent=a.side===1?'VICTORY':'DEFEATED';
    document.getElementById('resultLine').textContent=a.def.name+' wins with '+Math.round(100*a.hp/a.maxHp)+'% health.';
    this.show('result',true);this.show('btns',false)},
  // Freeze p1 into a named pose for screenshotting (tests/harness.py --pose). Maps a pose key to the
  // Fighter state/moveName/f (and, where poseFor divides by it, stun) that Rig.poseFor resolves back
  // to that same key. G.sim=true stops the wall-clock loop from stepping the sim, so the frame holds.
  debugPose(key){
    if(!this.fight)this.startFight();
    const map={
      idle:{state:'IDLE',f:0},
      walk:{state:'IDLE',f:0}, // no dedicated sim state for locomotion yet; idle stands in
      dash:{state:'DASH',f:6},
      light1:{state:'ATTACK',moveName:'light1',f:6},
      light2:{state:'ATTACK',moveName:'light2',f:6},
      light3:{state:'ATTACK',moveName:'light3',f:7},
      light4:{state:'ATTACK',moveName:'light4',f:7},
      light5:{state:'ATTACK',moveName:'light5',f:9},
      medium:{state:'ATTACK',moveName:'medium',f:12},
      heavyCharge:{state:'CHARGE',moveName:'heavy',f:12},
      heavy:{state:'ATTACK',moveName:'heavy',f:4}, // still high in the overhead arc, well before medium's peak-lunge silhouette
      block:{state:'BLOCK',f:10},
      blockstun:{state:'BLOCKSTUN',f:5,stun:MOVES.medium.blockstun},
      hit:{state:'HITSTUN',f:8,stun:MOVES.medium.hitstun},
      knockdown:{state:'KNOCKDOWN',f:10},
      getup:{state:'KNOCKDOWN',f:35},
      stunned:{state:'STUNNED',f:20,stun:PARRY_STUN},
      s1:{state:'ATTACK',moveName:'s1',f:11},
      s2:{state:'ATTACK',moveName:'s2',f:14},
      s3:{state:'ATTACK',moveName:'s3',f:60},
      win:{state:'WIN',f:15},
      ko:{state:'KO',f:10}};
    const m=map[key];if(!m)throw new Error('unknown pose: '+key);
    const p=this.fight.p1;
    if(m.moveName){p.move=MOVES[m.moveName];p.moveName=m.moveName}
    p.state=m.state;p.f=m.f;
    if(m.stun!==undefined)p.stun=m.stun;
    this.sim=true},
  togglePause(){if(this.state==='FIGHT'){this.state='PAUSED';this.show('pauseMenu',true)}else if(this.state==='PAUSED'){this.state='FIGHT';this.show('pauseMenu',false);this.acc=0}},
  toTitle(){this.state='TITLE';this.fight=null;this.encounter=null;this.show('pauseMenu',false);this.show('result',false);this.show('btns',false);this.show('title',true)},
  // Steps the sim one tick, handling KO slow-mo (step every 4th tick while fight.slowmo>0) and
  // draining fight.fx into FX after any step. No rAF/wall-clock dependency, so tests can call it
  // directly. G.loop drives this once per accumulated STEP; simFrames/stepFrame delegate to it too.
  tick(){if(this.state!=='FIGHT')return;const f=this.fight;
    const pm1=f.p1.moveName,pm2=f.p2.moveName;
    if(f.slowmo>0){if(++this._tickN%4===0){f.step();f.slowmo--}}
    else f.step();
    this.frameNow=f.frame;
    this.checkSpecial(f.p1,pm1);this.checkSpecial(f.p2,pm2);
    FX.pushAll(f.fx);f.fx.length=0;
    this.syncSpecials()},
  // Detects a fighter's moveName transitioning into s1/s2/s3 this tick (the sim itself never
  // references Audio/G, so this has to be watched from outside) and plays that special's recipe
  // plus an announcer line.
  checkSpecial(fighter,prevMoveName){const mn=fighter.moveName;
    if(mn&&mn!==prevMoveName&&(mn==='s1'||mn==='s2'||mn==='s3')){
      (Audio.recipes[mn]||Audio.recipes.lights)();
      Audio.announce('special',this.fight.rng)}},
  stepFrame(){this.tick()},
  simFrames(n){for(let i=0;i<n;i++)this.stepFrame()},
  syncSpecials(){const p=this.fight.p1.power;
    document.getElementById('btnPower').classList.toggle('ready',p>=100);
    for(const n of[1,2,3])document.getElementById('pk'+n).disabled=p<100*n},
  loop(t){if(!this.sim){const dt=Math.min(.1,(t-this.last)/1000||0);this.last=t;this.acc+=dt;while(this.acc>=STEP){this.tick();this.acc-=STEP}}
    if(this.fight)Camera.update(this.cam,this.fight);
    FX.update();
    Render.frame(this.fight);requestAnimationFrame(t=>this.loop(t))},
  init(){this.fit();addEventListener('resize',()=>this.fit());Input.init(canvas);
    document.getElementById('fightBtn').onclick=()=>{Audio.init();this.startFight()};
    document.getElementById('again').onclick=()=>this.startFight({seed:this.fight?this.fight.rng.int(1e9)+1:this.seed,encounter:this.encounter});
    document.getElementById('resultTitleBtn').onclick=()=>this.toTitle();
    document.getElementById('resume').onclick=()=>this.togglePause();
    document.getElementById('quit').onclick=()=>this.toTitle();
    document.getElementById('titleMute').onclick=e=>{Audio.muted=!Audio.muted;Save.data.mute=Audio.muted;Save.put();e.target.textContent='SOUND: '+(Audio.muted?'OFF':'ON')};
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='FIGHT')this.togglePause()});
    requestAnimationFrame(t=>{this.last=t;this.loop(t)})}};
G.init();
