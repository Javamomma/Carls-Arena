const G={state:'TITLE',fight:null,encounter:null,acc:0,last:0,sim:false,debug:false,seed:1,cam:{x:STAGE_W/2,zoom:1},_tickN:0,
  frameNow:0,_sayAt:-999, // mirrors fight.frame (updated in tick()); gates G.say to one line per 90 frames
  cinemFocus:null, // the attacking Fighter to punch the camera in on, set from the 'card' fx while fight.cinematic>0
  fit(){const s=Math.min(innerWidth/W,innerHeight/H);canvas.style.width=Math.floor(W*s)+'px';canvas.style.height=Math.floor(H*s)+'px';this.positionToast()},
  // Positions #toast off the canvas's own box (canvas.getBoundingClientRect()), not #wrap, so it
  // tracks the actual displayed game area exactly even when #wrap letterboxes the canvas at an
  // aspect ratio other than W/H. Fix round 2: moved from just under the HUD's floor-line text to
  // the bottom band — with the rescaled rig (see 65_stage.js's Camera anchor comment) the toast up
  // top was landing squarely across the now-much-taller fighters' heads in nearly every shot.
  // TOAST_BOTTOM_GAP is canvas-local (854x480) px from the bottom of the canvas up to the toast's
  // bottom edge: the chevron power bar sits at canvas y=H-24, so H-(H-24)+8 = 32 clears it by 8px.
  // Fix round 3: round 2's 62%-of-canvas width still ran the pill's right edge over the PUNCH
  // button's label. BLOCK_RIGHT/PUNCH_LEFT are canvas-local x's for the BLOCK button's right edge
  // and the PUNCH button's left edge, computed from the same numbers 00_head.html's CSS positions
  // them with (#btnBlock left:22/width:76, #btnPunch right:198/width:76) rather than read off their
  // DOM rects — #btns (and everything under it) collapses to a zero getBoundingClientRect() while
  // hidden pre-fight (TITLE/RESULT), and positionToast runs then too (from G.fit at init/resize).
  // The toast is centered in that gap, capped at 88% of its width, so it can never reach either
  // button's label regardless of content.
  TOAST_BOTTOM_GAP:32,BLOCK_RIGHT:22+76,PUNCH_LEFT:W-(198+76),
  positionToast(){const r=canvas.getBoundingClientRect(),el=document.getElementById('toast'),sx=r.width/W;
    const gapL=r.left+this.BLOCK_RIGHT*sx,gapR=r.left+this.PUNCH_LEFT*sx;
    el.style.left=((gapL+gapR)/2)+'px';
    el.style.bottom=(innerHeight-r.bottom+this.TOAST_BOTTOM_GAP/H*r.height)+'px';
    el.style.maxWidth=Math.round((gapR-gapL)*.88)+'px'},
  // Caps the toast at 2 lines by dropping from 13px to 12px if the current text would wrap to 3+ at
  // 13px (measuring via the laid-out scrollHeight against the computed line-height, so it accounts
  // for the actual maxWidth positionToast() set, not an estimate). Called after every text change
  // (Audio.say), not just on resize, since it depends on the string, not just the layout.
  fitToastText(){const el=document.getElementById('toast');
    el.style.fontSize='13px';
    const lh=parseFloat(getComputedStyle(el).lineHeight)||1;
    if(Math.round(el.scrollHeight/lh)>2)el.style.fontSize='12px'},
  show(id,on){document.getElementById(id).classList.toggle('show',on)},
  // Canvas hit-test for the HUD's pause glyph (drawn by Render.hud at Render.pauseRect), consulted
  // by Input's pointerdown handler before it does any zone/gesture handling.
  hitPause(x,y){const r=Render.pauseRect;return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h},
  // {encounter:'f1_goblin'|{...}} resolves via Encounter.resolve, stores the result on G.encounter
  // (the HUD's floor line reads it), and clones the enemy def here (never inside Fight) so p2's
  // hp/atk carry the encounter's multipliers without mutating the shared DEFS entry.
  startFight(o={}){const seed=o.seed||this.seed;
    this.lastFightOpts=o; // FIGHT AGAIN replays these (minus seed) so a custom p2/ai isn't lost
    let p2def=DEFS[o.p2||'donut'],ai=o.ai||'basic';
    this.encounter=null;
    if(o.encounter){
      const enc=Encounter.resolve(o.encounter);this.encounter=enc;
      p2def=Object.assign({},enc.enemy,{hp:Math.round(enc.enemy.hp*enc.hpMul),atk:Math.round(enc.enemy.atk*enc.atkMul)});
      ai=enc.tier}
    this.fight=new Fight({seed,p1:DEFS[o.p1||'carl'],p2:p2def,clock:o.clock,
      ctrl1:o.ctrl1||Ctrl.player(),ctrl2:o.ctrl2||AI.make(ai,seed^0xa5a5),onEvent:(t,a,b,v)=>this.onEvent(t,a,b,v)});
    this.cam={x:STAGE_W/2,zoom:1};this.cinemFocus=null;FX.reset();
    Input.q.length=0;Input.held.block=false;Input.held.heavy=false;
    // Fresh throttle window per fight so the opening announcer line always fires immediately,
    // regardless of how recently the previous fight's last toast landed.
    this.frameNow=0;this._sayAt=-999;
    this.state='FIGHT';this.show('title',false);this.show('result',false);this.show('pauseMenu',false);this.show('btns',true);Audio.announce('start',this.fight.presRng)},
  // Throttled announcer display: only updates the toast if at least 90 frames (1.5s) have passed
  // since the last line, so a burst of events can't stomp on each other mid-read. Audio.say remains
  // the unthrottled display primitive this calls into. A no-op while the S3 cinematic is up — the
  // card already reads SPECIAL 3 on-canvas, and the toast element is hidden for the duration anyway
  // (see hideToast/showToast), so there is nothing useful for a line to update.
  say(text){if(this.fight&&this.fight.cinematic>0)return;if(this.frameNow-this._sayAt>=90){this._sayAt=this.frameNow;Audio.say(text)}},
  // Hides the DOM #toast announcer (an absolutely-positioned element outside the canvas, so nothing
  // drawn on-canvas can cover it) for the duration of the S3 cinematic, and cancels Audio.say's
  // pending fade-out timeout so a stale line already on screen (e.g. the opening announcer, whose
  // 2.2s fade can easily still be running by the time an early s3 lands) can't keep showing through,
  // or flash back in, mid-card. showToast restores it once the cinematic ends (G.tick, cinematic hits 0).
  hideToast(){const el=document.getElementById('toast');clearTimeout(Audio._t);el.textContent='';el.classList.add('hidden')},
  showToast(){document.getElementById('toast').classList.remove('hidden')},
  // Per-move sound recipe dispatch + announcer hookup. `a`/`b`/`val` mirror Fight.emit's args.
  onEvent(t,a,b,val){
    if(t==='hit'){const mv=MOVES[a.moveName];
      // Multi-hit specials (s1/s2/s3) already got their one full recipe burst from checkSpecial on
      // the moveName transition; each of their landed sub-hits here just gets a light impact thud,
      // not the whole recipe again (that would replay a 3-14 tone burst per sub-hit, overlapping).
      (mv&&mv.hits>1?Audio.recipes.light1:(Audio.recipes[a.moveName]||Audio.recipes.lights))();
      // Streak lines are in the player's own voice ("Carl's fan club just doubled in size"), so they
      // only fire for p1's combos, not a mob/AI p2's.
      if(this.fight&&a===this.fight.p1&&(a.combo===3||a.combo===5||a.combo===10))Audio.announce('streak'+a.combo,this.fight.presRng)}
    else if(t==='block')Audio.recipes.block();
    else if(t==='parry'){Audio.recipes.parry();Audio.announce('parry',this.fight.presRng)}
    else if(t==='miss'){if(b&&b.state==='DASH')Audio.recipes.dash()}
    else if(t==='ko'){Audio.recipes.ko();Audio.announce(a.side===1?'win':'loss',this.fight.presRng)}},
  // Called from tick() once the KO slow-mo has fully counted down (fight.slowmo hits 0). Split out
  // of onEvent('ko',...) because the KO event fires synchronously inside the same f.step() that ends
  // the fight, well before slow-mo has had a chance to play; flipping state here on the frame it
  // actually happens (RESULT is set from tick(), not from Fight's own onEvent callback).
  showResult(winner){
    this.state='RESULT';document.getElementById('resultTitle').textContent=winner.side===1?'VICTORY':'DEFEATED';
    document.getElementById('resultLine').textContent=winner.def.name+' wins with '+Math.round(100*winner.hp/winner.maxHp)+'% health.';
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
  toTitle(){this.state='TITLE';this.fight=null;this.encounter=null;this.cinemFocus=null;this.show('pauseMenu',false);this.show('result',false);this.show('btns',false);this.show('title',true)},
  // Steps the sim one tick, handling KO slow-mo (step every 4th tick while fight.slowmo>0) and
  // draining fight.fx into FX after any step. No rAF/wall-clock dependency, so tests can call it
  // directly. G.loop drives this once per accumulated STEP; simFrames/stepFrame delegate to it too.
  // FX and the camera both advance exactly once per call here (never from loop()'s rAF cadence):
  // on a >60Hz display the old rAF-driven update ran FX/camera at double speed and could desync
  // the S3 card's own clock from fight.cinematic. This also means both freeze whenever tick() isn't
  // being called, i.e. while PAUSED (desired) or between --sim harness round trips.
  tick(){if(this.state!=='FIGHT')return;const f=this.fight;
    if(f.cinematic>0){
      // Sim frozen (Fight.step() itself no-ops while cinematic>0); G is the one counting the 72
      // frames down, one per tick, so FX/Render keep animating around a frozen sim. Input is
      // drained and discarded so nothing queued during the card fires the instant it clears.
      f.cinematic--;this.frameNow=f.frame;Input.drain();
      if(f.cinematic===0){this.cinemFocus=null;this.showToast()}
    }else{
      const pm1=f.p1.moveName,pm2=f.p2.moveName;
      if(f.slowmo>0){if(++this._tickN%4===0){f.step();f.slowmo--}}
      else f.step();
      this.frameNow=f.frame;
      this.checkSpecial(f.p1,pm1);this.checkSpecial(f.p2,pm2);
      this.checkCinematicFx(f);
      this.syncSpecials()}
    FX.pushAll(f.fx);f.fx.length=0;
    const punchIn=f.cinematic>0&&this.cinemFocus?{x:this.cinemFocus.x,zoom:1.28}:null; // fix round 2: 1.6->1.28
    Camera.update(this.cam,f,punchIn);
    FX.update();
    // f.over flips true inside f.step() the instant a KO/timeout resolves, well before slow-mo has
    // played; f.slowmo (armed to 90 by Fight.finish) is what keeps this branch re-entering FIGHT and
    // counting down every 4th tick above (f.step() itself is a no-op once over, per Fight.step's own
    // guard) instead of bailing out on the very next tick's `if(this.state!=='FIGHT')return`. Only
    // once it hits 0 do we actually leave FIGHT for RESULT.
    if(f.over&&f.slowmo<=0)this.showResult(f.winner)},
  // Detects a fighter's moveName transitioning into s1/s2/s3 this tick (the sim itself never
  // references Audio/G, so this has to be watched from outside) and plays that special's recipe
  // plus an announcer line. s3 is excluded here: it gets its recipe + announcer line once from
  // checkCinematicFx below, off the 'card' fx event, instead of here off the moveName transition —
  // both fire on the exact same tick, so doing it in both places would double-play the sound.
  checkSpecial(fighter,prevMoveName){const mn=fighter.moveName;
    if(mn&&mn!==prevMoveName&&(mn==='s1'||mn==='s2')){
      (Audio.recipes[mn]||Audio.recipes.lights)();
      // Recipe plays for either side (game feel); the announcer line is reserved for the human's
      // own specials only, so it doesn't caption every mob/AI special too.
      if(fighter===this.fight.p1)Audio.announce('special',this.fight.presRng)}},
  // Watches the fx this tick's f.step() (if any) just queued for a 'card' event — the S3 cinematic
  // trigger — and, off that, plays the s3 recipe once, sets G.cinemFocus (read by loop() to punch
  // the camera in on the attacker while fight.cinematic>0), and hides the toast so nothing already
  // on screen (or queued) can show through/behind the card. The announce('special') call below is
  // now a no-op in practice (G.say bails while fight.cinematic>0, which is already true here) — kept
  // for symmetry with s1/s2 and in case that guard ever moves to fire after the card instead.
  checkCinematicFx(f){
    if(!f.fx.some(e=>e.kind==='card'))return;
    const att=(f.p1.state==='ATTACK'&&f.p1.moveName==='s3')?f.p1:f.p2;
    this.cinemFocus=att;
    this.hideToast();
    Audio.recipes.s3();
    if(att===f.p1)Audio.announce('special',f.presRng)},
  // Test/debug helper (also used by tests/harness.py --cinematic): starts a fight, arms p1 with a
  // scripted s3, sim-steps until the cinematic is up, then advances FX so a screenshot shows the
  // card fully in (past its 12-frame slide-in) rather than mid-slide.
  debugCinematic(){
    this.sim=true;
    this.startFight({ctrl1:Ctrl.script([{f:0,intent:{special:3}}])});
    this.fight.p1.power=300;
    // Step until the card is up and settled past its 12-frame slide-in. tick() ages FX (and so
    // FX.card.t) exactly once per call now, so this no longer needs a second FX.update() loop
    // layered on top (that used to double-age the card once tick() itself started aging FX in sim
    // mode, per the 2.9 review) — just keep calling the one true per-tick step until the card says
    // it's ready, with a generous cap in case something upstream never arms it.
    for(let i=0;i<200&&!(FX.card&&FX.card.t>=20);i++)this.tick()},
  stepFrame(){this.tick()},
  simFrames(n){for(let i=0;i<n;i++)this.stepFrame()},
  syncSpecials(){const p=this.fight.p1.power;
    document.getElementById('btnPower').classList.toggle('ready',p>=100);
    for(const n of[1,2,3])document.getElementById('pk'+n).disabled=p<100*n},
  // FX/camera no longer advance here: tick() ages both exactly once per sim tick (see its comment),
  // so loop() is purely the wall-clock -> tick() driver plus the render call.
  loop(t){if(!this.sim){const dt=Math.min(.1,(t-this.last)/1000||0);this.last=t;this.acc+=dt;while(this.acc>=STEP){this.tick();this.acc-=STEP}}
    Render.frame(this.fight);requestAnimationFrame(t=>this.loop(t))},
  init(){this.fit();addEventListener('resize',()=>this.fit());Input.init(canvas);
    document.getElementById('fightBtn').onclick=()=>{Audio.init();this.startFight()};
    // Reuses the previous fight's full options (p1/p2/ai/ctrl1/ctrl2/encounter/clock), overriding only
    // the seed — previously this passed just {seed,encounter}, silently dropping a custom p2/ai back
    // to the startFight defaults (donut/basic) on every rematch.
    document.getElementById('again').onclick=()=>this.startFight(Object.assign({},this.lastFightOpts,
      {seed:this.fight?this.fight.rng.int(1e9)+1:this.seed}));
    document.getElementById('resultTitleBtn').onclick=()=>this.toTitle();
    document.getElementById('resume').onclick=()=>this.togglePause();
    document.getElementById('quit').onclick=()=>this.toTitle();
    document.getElementById('titleMute').onclick=e=>{Audio.muted=!Audio.muted;Save.data.mute=Audio.muted;Save.put();e.target.textContent='SOUND: '+(Audio.muted?'OFF':'ON')};
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='FIGHT')this.togglePause()});
    requestAnimationFrame(t=>{this.last=t;this.loop(t)})}};
G.init();
