// Touch layout (landscape): left third = defense (hold: block, swipe left: dash back);
// right two thirds = offense (tap: light, swipe right: medium, hold >=180ms: heavy until released).
const Input={q:[],held:{block:false,heavy:false},_ptrs:new Map(),DEF_ZONE:W/3,SWIPE:40,HOLD_MS:180,POWER_HOLD_MS:400,
  _powerT0:0,_powerShown:false,
  init(canvas){
    const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}};
    canvas.addEventListener('pointerdown',e=>{Audio.init();const p=pos(e);
      // Pause glyph hit-test: a tap there toggles pause and must not also register as a light.
      if(G.state==='FIGHT'&&G.hitPause(p.x,p.y)){G.togglePause();return}
      if(G.state==='TITLE')return G.startFight();if(G.state!=='FIGHT')return;
      const zone=p.x<this.DEF_ZONE?'def':'off';
      for(const rec of this._ptrs.values())if(rec.zone===zone)return; // one active pointer per zone
      this._ptrs.set(e.pointerId,{x0:p.x,t0:performance.now(),zone,moved:false,holdFired:false});
      if(zone==='def')this.held.block=true});
    canvas.addEventListener('pointermove',e=>{const P=this._ptrs.get(e.pointerId);if(!P||P.moved)return;const dx=pos(e).x-P.x0;
      if(Math.abs(dx)>=this.SWIPE){P.moved=true;if(P.zone==='def')this.held.block=false;else this.held.heavy=false;this.q.push(dx>0?'medium':'dashBack')}});
    const up=e=>{const P=this._ptrs.get(e.pointerId);if(!P)return;this._ptrs.delete(e.pointerId);
      if(P.zone==='def')this.held.block=false;
      else{if(!P.moved&&!P.holdFired)this.q.push('light');this.held.heavy=false}};
    canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    this.bindButtons();
    addEventListener('keydown',e=>{if(e.repeat)return;const k=e.key.toLowerCase();
      if(e.code==='Space'&&G.state==='TITLE'){e.preventDefault();return G.startFight()}
      if(k==='p')return G.togglePause();
      if(G.state!=='FIGHT')return;
      if(k==='j')this.q.push('light');if(k==='k')this.q.push('medium');if(k==='a')this.q.push('dashBack');
      if(k==='l')this.held.heavy=true;if(k==='s')this.held.block=true;if(k==='1'||k==='2'||k==='3')this.q.push('special'+k)});
    addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='s')this.held.block=false;if(k==='l')this.held.heavy=false})},
  // On-screen buttons: BLOCK is a hold (mirrors the field def-zone hold); PUNCH/KICK fire on press.
  // POWER taps 'powerAuto' (drain() resolves it to the highest affordable special); held past
  // POWER_HOLD_MS it shows the S1-S3 picker instead, and releasing over a chip fires that special.
  // Release point is read with elementFromPoint (not e.target) because touch pointers implicitly
  // capture to their pointerdown target, so e.target would still be #btnPower on release.
  bindButtons(){
    const id=x=>document.getElementById(x);
    const block=id('btnBlock');
    block.addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this.held.block=true});
    const blockOff=()=>{this.held.block=false};
    block.addEventListener('pointerup',blockOff);block.addEventListener('pointercancel',blockOff);
    id('btnPunch').addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this.q.push('light')});
    id('btnKick').addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this.q.push('medium')});
    const power=id('btnPower'),picker=id('powerPicker');
    power.addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this._powerT0=performance.now();this._powerShown=false});
    const powerEnd=e=>{e.stopPropagation();
      if(this._powerShown){
        const el=document.elementFromPoint(e.clientX,e.clientY),m=el&&el.id&&el.id.match(/^pk([123])$/);
        if(m&&!el.disabled)this.q.push('special'+m[1]);
        picker.classList.remove('show')}
      else if(this._powerT0)this.q.push('powerAuto');
      this._powerT0=0;this._powerShown=false};
    power.addEventListener('pointerup',powerEnd);power.addEventListener('pointercancel',powerEnd)},
  // Called once per sim frame by Ctrl.player: promotes a long press in the offense zone to a heavy
  // hold, and a long press on POWER to the S1-S3 picker (both use the same wall-clock pattern).
  tick(){for(const P of this._ptrs.values())if(!P.moved&&P.zone==='off'&&!P.holdFired&&performance.now()-P.t0>=this.HOLD_MS){P.holdFired=true;this.held.heavy=true}
    if(this._powerT0&&!this._powerShown&&performance.now()-this._powerT0>=this.POWER_HOLD_MS){this._powerShown=true;document.getElementById('powerPicker').classList.add('show')}},
  drain(){const it={light:false,medium:false,heavy:this.held.heavy,block:this.held.block,dashBack:false,special:0};
    for(const a of this.q){
      if(a==='powerAuto'){const p=G.fight?G.fight.p1.power:0;let n=0;for(let k=3;k>=1;k--)if(p>=100*k){n=k;break}it.special=n}
      else if(a.startsWith('special'))it.special=+a[7];
      else it[a]=true}
    this.q.length=0;return it}};

const Ctrl={
  EMPTY:()=>({light:false,medium:false,heavy:false,block:false,dashBack:false,special:0}),
  idle:()=>({next:()=>Ctrl.EMPTY()}),
  player:()=>({next(){Input.tick();return Input.drain()}}),
  hold:intent=>({next:()=>Object.assign(Ctrl.EMPTY(),intent)}),
  // steps: [{f, until?, intent}] in controller frames (frames where next() was called)
  script:steps=>({f:0,next(){const it=Ctrl.EMPTY();for(const s of steps)if(this.f>=s.f&&this.f<=(s.until===undefined?s.f:s.until))Object.assign(it,s.intent);this.f++;return it}}),
  // seeded chaos monkey: picks a plan, holds block/heavy plans for a while, taps others once
  random:seed=>{const r=RNG(seed);let plan='',left=0;return{next(){
    if(left--<=0){plan=r.pick(['','','light','light','medium','dashBack','block','block','heavy','special']);left=plan==='block'?10+r.int(30):plan==='heavy'?30:1}
    const it=Ctrl.EMPTY();if(plan==='block')it.block=true;else if(plan==='heavy')it.heavy=true;else if(plan==='special')it.special=1;else if(plan)it[plan]=true;return it}}},
  // Ctrl.competent(seed): a scripted, fully deterministic "skilled human" bot for tests/batch.py's
  // win-rate table (--bot auto). Unlike Ctrl.random it never rolls dice — `seed` is accepted only for
  // signature symmetry with the other seeded controllers (Ctrl.random, AI.make); the exact same
  // (fight, me, foe) state always yields the exact same intent, for any seed, which is what the
  // batch tool's "Ctrl.competent is deterministic" test checks. Priority order per call:
  //   1. continue holding a heavy already armed by step 8 below (charge moves need intent.heavy held
  //      every frame — see Fighter.act's CHARGE branch — checked ahead of the busy() gate the same
  //      way AI.make's decideHeavy 'hold' phase does, since CHARGE itself counts as busy)
  //   2. finish a light chain already open (Fighter.act's own recovery+chain+landed window)
  //   3. otherwise, if busy, do nothing (can't act)
  //   4. react to a visible medium/heavy: block once its startup clock has run REACT frames (leaves
  //      the move's last couple of startup frames as a buffer, mirroring the AI tiers' 'react' field)
  //   5. bail out of a telegraphed heavy charge while low on hp
  //   6. fire the strongest special affordable
  //   7. chain lights whenever in light range
  //   8. Fix-wave item 8: every 5th time the foe enters blockstun (a mix-up, not spam — counted on
  //      the rising edge of BLOCKSTUN so one long blockstun window only counts once), arm a heavy
  //      instead of continuing the light chain
  //   9. Fix-wave item 8: close distance with a medium (its own startup dash covers real ground) when
  //      out of light range and the foe isn't mid-attack, on a 40-frame cooldown — the bot used to
  //      just stand there outside light range forever, which is why intercept/medium-punish never
  //      fired in the run that certified the tiers (final review, Important) and the monotone curve
  //      was driven almost entirely by `attack`.
  competent:seed=>{const REACT=6,LOW_HP=0.3,CLOSE_CD=40,MIXUP_EVERY=5;
    let closeCd=0,openings=0,wasBlockstun=false,heavyHold=0;
    return{next(fight,me,foe){
    const it=Ctrl.EMPTY();
    if(heavyHold>0){heavyHold--;it.heavy=true;return it}
    if(me.state==='ATTACK'&&me.phase()==='recovery'&&me.move.chain&&me.landed){it.light=true;return it}
    if(me.busy())return it;
    if(foe.state==='ATTACK'&&(foe.moveName==='medium'||foe.moveName==='heavy')&&foe.f>=REACT){it.block=true;return it}
    if(foe.state==='CHARGE'&&foe.moveName==='heavy'&&me.hp/me.maxHp<LOW_HP){it.dashBack=true;return it}
    if(me.power>=100){it.special=me.power>=300?3:me.power>=200?2:1;return it}
    if(closeCd>0)closeCd--;
    const foeBlockstun=foe.state==='BLOCKSTUN';
    if(foeBlockstun&&!wasBlockstun){
      wasBlockstun=true;openings++;
      if(openings%MIXUP_EVERY===0){heavyHold=me.moveDef('heavy').charge+1;it.heavy=true;return it}}
    else if(!foeBlockstun)wasBlockstun=false;
    const dist=Math.abs(foe.x-me.x)-me.width,lightRange=me.moveDef('light1').range+20;
    if(dist<lightRange){it.light=true;return it}
    if(foe.state!=='ATTACK'&&closeCd===0){it.medium=true;closeCd=CLOSE_CD;return it}
    return it}}}};
