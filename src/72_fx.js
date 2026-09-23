// Hit-feel FX: particles, damage popups, camera shake, hit-flash. Pure presentation — it only
// reads the plain event objects Fight.resolve()/finish() queue into fight.fx (which G drains here
// every sim tick via FX.pushAll) and never touches Fight/Fighter state. Spread uses its own seeded
// RNG, keyed off the current fight frame and particle index, never Math.random, so --sim
// screenshots reproduce identically frame for frame.
// Task 8.0 (pre-art seam, moved verbatim from 40_movedata.js): per-class hit-feel magnitudes, read
// only by FX.hitfeel below. Fight.resolve (60_fight.js) no longer knows any of these numbers -- it
// only reports the bare fact of what class of hit just landed
// ({kind:'hitfeel',cls,dir,last}); FX.hitfeel is the only place that turns that fact into an actual
// shake/punch push. `stop` is NOT read by resolve() for hitstop itself -- MOVES.*.hitstop
// (40_movedata.js) and the intercept's own hardcoded 10 (60_fight.js) stay the sim's only source for
// that; `stop` is carried here purely so this table documents/cross-checks against those same
// numbers in one place (every value below equals its matching MOVES.*.hitstop, and 10 equals the
// intercept hitstop) -- a future hitstop retune that forgets to update this table alongside MOVES
// would be a visible mismatch, not a silent drift (see the pinning test in 90_tests.js). `shake`/
// `punch` are the actual px/pct magnitudes FX.hitfeel pushes; `hold` is the punch envelope's own
// hold-frame count (FX.push's 'punch' case below falls back to its own PUNCH_HOLD when a push
// carries none); `creep` (s1/s2 only) means the punch eases IN over `hold` instead of snapping
// straight to its target. light's shake:0/punch:0 means neither fx is ever pushed for a plain light
// (see FX.hitfeel's own `if(hf.shake>0)`/`if(hf.punch>0)` guards); s3's punch:0 means s3 never gets a
// punch-in fx of its own (the existing S3 cinematic dolly/card already owns that beat).
const HITFEEL={
  light:{stop:3, shake:0, punch:0,   hold:0},
  medium:{stop:5, shake:4, punch:.02,hold:6},
  heavy:{stop:9, shake:8, punch:.04, hold:10},
  s1:{stop:6, shake:6, punch:.03,    hold:6, creep:true},
  s2:{stop:8, shake:6, punch:.03,    hold:6, creep:true},
  s3:{stop:14,shake:6, punch:0,      hold:0},
  intercept:{stop:10,shake:10,punch:.05,hold:6}};
// Task 8.0 (pre-art seam): per-impact-class fx registry, keyed by att.def.impact's own raw id string
// (blunt/blade/energy). Fight.resolve (60_fight.js) passes only that id straight through the fx
// descriptor -- no lookup, no drawn-kind name -- so the registry itself, including the fallback to
// blunt for an id it doesn't recognize, lives entirely here in presentation. Each entry's spawn()
// builds the list particle (same shape/lifetimes as the old direct impactBlunt/impactBlade/
// impactEnergy push cases this replaces); draw() renders it (same visuals, moved verbatim from
// FX.draw's old per-kind branches) -- both push() and draw() below dispatch through this one table.
const IMPACTS={
  blunt:{
    spawn(ev){return{kind:'impact',id:'blunt',x:ev.x,y:ev.y,face:ev.face||1,life:0,max:16}},
    draw(c,p){const t=p.life/p.max;c.globalAlpha=Math.max(0,1-t);
      c.strokeStyle='#cbb89a';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,6+t*22,0,Math.PI*2);c.stroke()}},
  blade:{
    spawn(ev){return{kind:'impact',id:'blade',x:ev.x,y:ev.y,face:ev.face||1,life:0,max:14}},
    draw(c,p){const t=p.life/p.max;c.globalAlpha=Math.max(0,1-t);
      c.strokeStyle='#e8f0ff';c.lineWidth=4;c.beginPath();
      c.arc(p.x,p.y,14+t*10,-0.7*p.face,0.7*p.face,p.face<0);c.stroke()}},
  energy:{
    spawn(ev){return{kind:'impact',id:'energy',x:ev.x,y:ev.y,face:ev.face||1,life:0,max:20}},
    draw(c,p){const t=p.life/p.max;
      c.globalAlpha=Math.max(0,(1-t)*.85);c.strokeStyle='#b388ff';c.lineWidth=3;
      c.beginPath();c.arc(p.x,p.y,8+t*18,0,Math.PI*2);c.stroke();
      c.globalAlpha=Math.max(0,(1-t)*.4);c.fillStyle='#b388ff';
      c.beginPath();c.arc(p.x,p.y,4+t*6,0,Math.PI*2);c.fill()}}};
const FX={list:[],
  // Task 7.4: FX.shake is now a decaying {x,y} vector (was a bare scalar) -- x kicks in the
  // attacker's own facing (ev.dir), y is a fixed small upward kick, both decaying together so the
  // camera "punches" in the hit's own direction and eases back, rather than the old omnidirectional
  // per-frame jitter (see push()'s 'shake' case and update()/70_render.js's own comments below).
  shake:{x:0,y:0},
  // Task 7.4: FX.punch is the camera's own additive zoom term -- Camera.update (65_stage.js)
  // composes cam.zoom = min(base*(1+FX.punch), capNow), the frozen interface. Envelope shape is
  // "jump to target, hold `hold` frames, then ease (decay) back to 0" -- see push()'s 'punch' case
  // and update() below. PUNCH_HOLD/PUNCH_EASE are named constants (not just inlined numbers) so a
  // test can assert the envelope's own shape without hardcoding a magic frame count; PUNCH_HOLD is
  // now only the FALLBACK hold length (fix round 1) -- Fight.resolve's own HITFEEL table
  // (40_movedata.js) passes an explicit `hold` per push (heavy's own 10-frame hold vs. medium's 6),
  // read here via ev.hold, with PUNCH_HOLD covering any push that omits one.
  // Fix round 1: punchCreep/punchStart/punchHoldTotal back the 'creep' envelope (S1/S2's own "final
  // hit... creep" ruling) -- a creep push eases the punch term IN, from wherever it currently sits
  // toward its target, over its own `hold` window, instead of snapping to target immediately the
  // way every other push (plain shake-only hits, medium, heavy, intercept) still does.
  punch:0,punchTarget:0,punchHold:0,punchCreep:false,punchStart:0,punchHoldTotal:0,
  PUNCH_HOLD:6,PUNCH_EASE:.82,
  flash:0,card:null,shieldDown:null,
  // Task 7.1: label + color per timed effect id, read only here (presentation) -- Effects.apply
  // (48_effects.js, sim-side) pushes a bare {kind:'effectPopup',x,y,id,stacks} descriptor with no
  // color/text choice of its own, same "sim pushes plain data, FX turns it into a styled particle"
  // split every other fx kind here already keeps (compare 'dustArc'/'popup' above, both fed by plain
  // descriptors Fight.resolve builds).
  EFFECT_STYLE:{bleed:{text:'BLEED',col:'#c62828'},stun:{text:'STUN',col:'#8cd8ff'},
    armorBreak:{text:'ARMOR BREAK',col:'#9a9a9a'},fury:{text:'FURY',col:'#ff5a4a'},
    powerGain:{text:'POWER+',col:'#f4c542'},powerBurn:{text:'POWER BURN',col:'#ff8c00'},
    regen:{text:'REGEN',col:'#4caf50'},weakness:{text:'WEAKNESS',col:'#7e57c2'},
    // Task 7.3: blue, per the plan's own "popup, blue afterimage" description of the dodge read --
    // the 'effectPopup' case below already turns this into the same styled popup every other EFFECTS
    // id gets, so this one line is the only wiring this file needs for the dexterity POPUP; the
    // afterimage streak itself is its own fx kind, pushed separately by Fight.resolve (see 'afterimage'
    // below), since Effects.apply has no notion of a facing-direction streak.
    dexterity:{text:'DEXTERITY',col:'#4fc3f7'}},
  // Task 9.2: label per champion/boss passive id, read only by the 'passiveBanner' push case below --
  // Passives (49_passives.js, sim-side) pushes a bare {kind:'passiveBanner',x,y,id,cls} descriptor
  // with no text/color choice of its own, same "sim pushes plain data, FX styles it" split
  // EFFECT_STYLE/'effectPopup' above already use for Effects.apply's own popups.
  PASSIVE_STYLE:{spite:{text:'SPITE'},royalDisdain:{text:'ROYAL DISDAIN'},understudy:{text:'UNDERSTUDY'},
    immovable:{text:'IMMOVABLE'},championOfTheFloor:{text:'CHAMPION OF THE FLOOR'},brood:{text:'BROOD'}},
  reset(){this.list.length=0;this.shake={x:0,y:0};this.punch=0;this.punchTarget=0;this.punchHold=0;
    this.punchCreep=false;this.punchStart=0;this.punchHoldTotal=0;
    this.flash=0;this.card=null;this.shieldDown=null},
  _seed(i){const fr=(G.fight&&G.fight.frame)||0;return((fr*97+i*131+1)>>>0)||1},
  push(ev){
    switch(ev.kind){
      case'spark':
        for(let i=0;i<ev.n;i++){const rng=RNG(this._seed(i));const ang=rng.next()*Math.PI*2,spd=1.2+rng.next()*3.2;
          this.list.push({kind:'spark',x:ev.x,y:ev.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2.4,life:0,max:18,col:ev.col||'#fff'})}
        break;
      case'dust':
        for(let i=0;i<5;i++){const rng=RNG(this._seed(i+50));const ang=Math.PI+(rng.next()-.5)*1.3,spd=.4+rng.next()*.9;
          this.list.push({kind:'dust',x:ev.x,y:ev.y,vx:Math.cos(ang)*spd,vy:-Math.abs(Math.sin(ang))*spd-.2,life:0,max:24,col:'#cbb89a'})}
        break;
      // Task 6.5 (kick poses and impact art): the kick's own hit-impact fx, pushed by Fight.resolve
      // INSTEAD OF the usual gold 'spark' burst whenever the landing move is 'medium' (KICK is a leg
      // strike in every rig -- Phase 6 ruling 4) -- hitstop/shake are unaffected, only this one fx
      // push differs, per the frozen interface. Six grey-brown particles low to the floor, swept
      // forward in ev.face's direction (not a symmetric circular burst like 'spark') so it reads as
      // dust kicked up along the ground by a leg strike, not an arm impact -- the same seeded-per-
      // frame RNG pattern every other fx kind here uses (never Math.random), so --sim screenshots
      // stay reproducible frame for frame.
      case'dustArc':
        for(let i=0;i<6;i++){const rng=RNG(this._seed(i+90));
          const spd=1.6+rng.next()*2.2,rise=.25+rng.next()*.85;
          this.list.push({kind:'dustArc',x:ev.x,y:ev.y,vx:(ev.face||1)*spd,vy:-rise,life:0,max:22,col:'#8a7358'})}
        break;
      // Task 7.4 (frozen interface, exact values): per-class impact fx, pushed by Fight.resolve
      // ALONGSIDE (never instead of) the existing spark/dustArc hit fx above, keyed off the
      // ATTACKER's own def.impact ('blunt'|'blade'|'energy', 40_movedata.js) -- a static-position
      // expanding ring/arc rather than a moving particle burst, so it needs no vx/vy physics in
      // update() (p.life++ there already runs unconditionally for every kind). carl/mongo/
      // hobgoblin/grub/grull/mother_rat are blunt (a dust ring); katia/goblin/skeleton are blade
      // (an arc slash); donut/shaman are energy (a caster ring) -- see draw()'s own per-kind
      // rendering below.
      // Task 8.0 (pre-art seam): the sim pushes only {kind:'impact',id,x,y,face} -- id is whatever
      // raw string att.def.impact carried (or undefined, for a def that forgets to set one); the
      // IMPACTS registry lookup and its own fallback to blunt live entirely here, never in the sim.
      case'impact':
        this.list.push((IMPACTS[ev.id]||IMPACTS.blunt).spawn(ev));
        break;
      // Task 7.1: turns a bare {id,stacks} effect descriptor into the same rendered 'popup' particle
      // kind hit/parry/thorns damage already uses (draw()'s 'popup' case below needs no change) --
      // text/color looked up from EFFECT_STYLE above rather than chosen by the sim, and a stack count
      // >1 appended (e.g. 'BLEED x3') so a re-applied/stacked effect reads differently from a fresh one.
      // Task 7.3: dexterity's own "blue afterimage" read (the plan's own words) -- a minimal
      // placeholder streak at the dodging fighter's position, faded over its own short life. Task 7.4
      // owns the full hit-feel pass (per this task's brief, "keep fx here minimal") so this is
      // deliberately plain: no rig silhouette, just a translucent trailing band leaning the direction
      // the dodger was facing (ev.face), consistent with every other fx kind here reading a plain
      // sim-pushed descriptor and choosing its own presentation.
      case'afterimage':
        this.list.push({kind:'afterimage',x:ev.x,y:ev.y,face:ev.face||1,life:0,max:20});
        break;
      case'effectPopup':{
        const st=this.EFFECT_STYLE[ev.id]||{text:String(ev.id||'?').toUpperCase(),col:'#fff'};
        const text=ev.stacks>1?st.text+' x'+ev.stacks:st.text;
        this.list.push({kind:'popup',x:ev.x,y:ev.y,text,col:st.col,big:false,muted:false,life:0,max:40});
        break}
      // Task 9.2 (controller ruling, exact ask): 22px gold-italic-styled, 40 frames, colored by the
      // triggering fighter's own class gem (CLS_GEM[ev.cls], 40_movedata.js -- already loaded by the
      // time this ever runs) rather than a fixed gold fill -- draw() below is the only place that
      // actually paints it (italic/stroke styling lives there, alongside 'popup's own font choice).
      case'passiveBanner':{
        const st=this.PASSIVE_STYLE[ev.id]||{text:String(ev.id||'?').toUpperCase()};
        const col=CLS_GEM[ev.cls]||CLS_GEM.default;
        this.list.push({kind:'passiveBanner',x:ev.x,y:ev.y,text:st.text,col,life:0,max:40});
        break}
      case'popup':
        // Task 6.4: `muted` (Fight.resolve, forwarding BUFFS.tutorialGuard's ref.capped) draws grey
        // instead of the pushed col -- see draw() below. Stored alongside col (never overwriting it)
        // so a test can still see what color a hit WOULD have been.
        this.list.push({kind:'popup',x:ev.x,y:ev.y,text:ev.text,col:ev.col||'#fff',big:!!ev.big,muted:!!ev.muted,life:0,max:40});
        break;
      // Task 6.4: the tutorial dummy's own wind-up tell (Ctrl.tutorialDummy, 30_input.js) -- a brief
      // red glow at the dummy's own position, pushed exactly 30 frames before its scripted medium
      // fires (lesson 3's "release just before the hit lands to PARRY" cue). Never gated by
      // reduceMotion (it's the one signal a first-time player needs to react to, not a flourish).
      case'windup':
        this.list.push({kind:'windup',x:ev.x,y:ev.y,life:0,max:ev.frames||30});
        break;
      // Task 6.4: the tutorial's own "SHIELD DOWN" moment -- Tutorial.tick pushes this the instant
      // every lesson is done and clears p2.guardActive, so the HP bar's return and the dummy actually
      // becoming killable are marked by one unmistakable beat instead of a silent state flip. The
      // white flash still respects reduceMotion (same as every other 'flash'); the text itself is a
      // dedicated screen-space overlay (drawScreen below, like the S3 card) rather than a world-space
      // list particle -- Render.frame draws the flash rectangle AFTER FX.draw()'s particles but
      // BEFORE drawScreen(), so a world-space 'SHIELD DOWN' text would sit UNDER the flash and go
      // briefly invisible at exactly the moment it fires (the flash starts at full opacity); this
      // stays legible (stroked, drawn after the flash) through the whole beat, reduceMotion or not.
      case'shieldDown':
        if(!Save.data.settings.reduceMotion)this.flash=Math.max(this.flash,ev.frames||10);
        this.shieldDown={t:0,frames:50};
        break;
      // Task 5.4: Save.data.settings.reduceMotion zeroes camera shake and screen flash (the two
      // motion-heavy FX) while leaving every other kind — sparks, dust, damage popups, the S3 card —
      // untouched, per the frozen interface ("shake/flash amounts 0, popups stay"). Checked here, at
      // the single place both ever accumulate, rather than at each of Fight.resolve's several push
      // call sites. Task 7.4 extends the same gate to FX.punch (also a camera-motion fx, see its own
      // case below) and upgrades shake from a scalar to a directional {x,y} vector: ev.dir (the
      // attacker's own facing, always ±1, defaulted to 1 for any older/hand-built push that omits
      // it) kicks x; y is a fixed small upward component so a shake always reads as a real hit-punch,
      // not just a sideways nudge. Magnitude is clamped to 24 total (was: the old scalar's own cap)
      // so a burst of same-frame hits (a multi-hit special) can't runaway the camera.
      case'shake':
        if(!Save.data.settings.reduceMotion){
          const dir=ev.dir||1,amt=ev.amt||0;
          this.shake.x+=dir*amt;this.shake.y+=-amt*.4;
          const mag=Math.hypot(this.shake.x,this.shake.y);
          if(mag>24){const s=24/mag;this.shake.x*=s;this.shake.y*=s}}
        break;
      // Task 7.4 (frozen interface): the camera's own additive zoom term -- pushed by FX.hitfeel
      // (below) per HITFEEL[cls] on any hit whose class carries a nonzero punch (medium/heavy/S1/
      // S2's final hit/intercept; light and S3 never push one at all). ev.hold overrides
      // PUNCH_HOLD (fix round 1: heavy's own 10-frame hold vs. medium's 6 vs. the fallback 6), and
      // ev.creep (S1/S2 only) switches the envelope from "jump straight to pct" to "ease IN toward
      // pct over the hold window" -- see update()'s own comment for the two envelope shapes.
      // Non-creep envelope: jump straight to the pushed pct (never below it -- a re-push while one
      // is already easing re-holds at the higher of the two, same "louder wins" rule popups/flash
      // already follow elsewhere in this file), hold for `hold` frames, then ease() decays to 0.
      // Creep envelope: capture the CURRENT punch value as punchStart, then ramp from punchStart to
      // pct over `hold` frames (update() does the interpolation); once the hold window ends, the
      // same ease()-back-to-0 takes over, same as the non-creep case.
      // Gated by reduceMotion, same as shake/flash -- it's a camera-motion fx too.
      case'punch':
        if(!Save.data.settings.reduceMotion){
          const hold=ev.hold!==undefined?ev.hold:this.PUNCH_HOLD,pct=ev.pct||0;
          if(ev.creep){
            this.punchStart=this.punch;this.punchTarget=pct;this.punchHoldTotal=hold;this.punchHold=hold;this.punchCreep=true}
          else{
            this.punchTarget=Math.max(this.punch,pct);this.punch=this.punchTarget;this.punchHold=hold;this.punchCreep=false}}
        break;
      // Task 8.0 (pre-art seam): the sim's own bare {cls,dir,last} report of what just landed --
      // hitfeel() below is the only place that turns it into the actual shake/punch pushes above.
      case'hitfeel':
        this.hitfeel(ev.cls,ev.dir,{last:ev.last});
        break;
      case'flash':
        if(!Save.data.settings.reduceMotion)this.flash=Math.max(this.flash,ev.frames||0);
        break;
      // 'slowmo' is driven directly through fight.slowmo/G.tick, still a no-op here.
      case'card':
        this.card={name:ev.name,frames:ev.frames,t:0};
        break;
      default:break}
    if(this.list.length>200)this.list.splice(0,this.list.length-200)},
  // Task 8.0 (pre-art seam): resolves a bare hitfeel descriptor (Fight.resolve, 60_fight.js) into the
  // real shake/punch pushes, via HITFEEL[cls] above -- the only place any of those magnitudes are
  // read. opts.last mirrors the old `!m.hits||last` gate that used to live in Fight.resolve itself:
  // a multi-hit special's own early sub-hit (last:false) is a full no-op here, exactly as it used to
  // be a no-op at the push site -- only the final landed sub-hit (or any single-hit move, whose own
  // `last` is always true) ever reaches the two pushes below. An unrecognized cls (defensive only --
  // every real moveName has a HITFEEL entry) is also a no-op.
  hitfeel(cls,dir,opts){
    if(!(opts&&opts.last))return;
    const hf=HITFEEL[cls];if(!hf)return;
    if(hf.shake>0)this.push({kind:'shake',amt:hf.shake,dir});
    if(hf.punch>0)this.push({kind:'punch',pct:hf.punch,hold:hf.hold,creep:!!hf.creep})},
  pushAll(evs){for(const e of evs)this.push(e)},
  update(){
    for(let i=this.list.length-1;i>=0;i--){const p=this.list[i];p.life++;
      // Task 6.5: dustArc gets the same gravity-arc physics as spark/dust (a low forward sweep that
      // settles back toward the floor, not a straight line) -- see the push() case above.
      if(p.kind==='spark'||p.kind==='dust'||p.kind==='dustArc'){p.x+=p.vx;p.y+=p.vy;p.vy+=0.15}
      if(p.life>=p.max)this.list.splice(i,1)}
    // Task 7.4: shake decays as a vector now (both components together), snapping fully to {0,0}
    // once its magnitude is negligible -- same "decay then snap to exact 0" shape the old scalar had.
    this.shake.x*=.85;this.shake.y*=.85;
    if(Math.hypot(this.shake.x,this.shake.y)<.05){this.shake.x=0;this.shake.y=0}
    // Task 7.4: punch's own hold-then-ease envelope -- for punchHold frames (armed by push()'s
    // 'punch' case) it either holds flat at its pushed target (the plain case) or, for a creep push
    // (fix round 1: S1/S2's own ruling), ramps LINEARLY from punchStart toward punchTarget across
    // punchHoldTotal frames, reaching punchTarget exactly on the hold window's last frame -- either
    // way, once the hold frames run out, the same ease() (multiplicative decay, same shape as shake)
    // takes it back to exactly 0.
    if(this.punchHold>0){
      if(this.punchCreep){
        const elapsed=this.punchHoldTotal-this.punchHold,t=Math.min(1,(elapsed+1)/this.punchHoldTotal);
        this.punch=this.punchStart+(this.punchTarget-this.punchStart)*t}
      else this.punch=this.punchTarget;
      this.punchHold--}
    else{this.punch*=this.PUNCH_EASE;if(this.punch<.001){this.punch=0;this.punchCreep=false}}
    if(this.flash>0)this.flash--;
    // Card runs on its own clock (advanced only here, from the wall-clock/screenshot render loop),
    // independent of fight.cinematic (G.tick decrements that once per sim tick); both count down
    // from the same 72-frame duration so they empty out together under normal play.
    if(this.card){this.card.t++;if(this.card.t>=this.card.frames)this.card=null}
    if(this.shieldDown){this.shieldDown.t++;if(this.shieldDown.t>=this.shieldDown.frames)this.shieldDown=null}},
  draw(c,cam,frame){
    for(const p of this.list){
      if(p.kind==='spark'){c.globalAlpha=Math.max(0,1-p.life/p.max);c.fillStyle=p.col;c.beginPath();c.arc(p.x,p.y,2.5,0,Math.PI*2);c.fill()}
      else if(p.kind==='dust'){c.globalAlpha=Math.max(0,(1-p.life/p.max)*.5);c.fillStyle=p.col;c.beginPath();c.arc(p.x,p.y,3+p.life*.12,0,Math.PI*2);c.fill()}
      // Task 6.5: same fading-circle treatment as 'dust' (a low, grounded impact reads better as a
      // soft puff than a hard-edged spark), just its own grey-brown color and a touch more opaque so
      // a low sweep of 6 still reads clearly against the floor art next to a landed light's gold spark.
      else if(p.kind==='dustArc'){c.globalAlpha=Math.max(0,(1-p.life/p.max)*.6);c.fillStyle=p.col;c.beginPath();c.arc(p.x,p.y,2.6+p.life*.13,0,Math.PI*2);c.fill()}
      // Task 7.4: per-class impact fx -- a static-position expanding ring/arc (no vx/vy physics,
      // see update()'s own comment) layered on top of the existing spark/dustArc burst at the same
      // impact point, so a landed hit reads as its own champion class on top of the generic hit fx.
      // Task 8.0 (pre-art seam): dispatches through the IMPACTS registry by the particle's own id
      // (blunt/blade/energy, set by push()'s 'impact' case above), same fallback-to-blunt as push().
      else if(p.kind==='impact'){(IMPACTS[p.id]||IMPACTS.blunt).draw(c,p)}
      // Task 7.3: a fading blue band trailing behind the dodge's own facing, a minimal placeholder
      // for the dexterity read -- see push()'s own comment on why this stays plain.
      else if(p.kind==='afterimage'){const t=p.life/p.max;c.globalAlpha=Math.max(0,(1-t)*.5);
        c.fillStyle='#4fc3f7';c.fillRect(p.x-p.face*28-14,p.y-40,28,80)}
      else if(p.kind==='popup'){const t=p.life/p.max;c.globalAlpha=Math.max(0,1-t);
        // Task 6.4: a capped (muted) hit always reads grey, regardless of what col it was pushed
        // with (crit/normal) -- the frozen "capped popups drawn grey" interface.
        c.fillStyle=p.muted?'#888':p.col;
        c.font=(p.big?'bold 26px ':'bold 16px ')+'ui-monospace,monospace';c.textAlign='center';
        c.fillText(p.text,p.x,p.y-t*30)}
      // Task 9.2 (controller ruling, exact ask): 22px, italic 900-weight (same font-weight/black-
      // stroke treatment Render.combo already uses for the combo counter's own italic gold text,
      // 70_render.js -- just a smaller size and this file's own particle-life-driven fade, not a
      // live per-frame count), filled in the triggering fighter's own class-gem color (set by push()
      // above), floating and fading over its full 40-frame life like 'popup' already does.
      else if(p.kind==='passiveBanner'){const t=p.life/p.max;c.globalAlpha=Math.max(0,1-t);
        c.font='italic 900 22px ui-monospace,monospace';c.textAlign='center';
        c.lineWidth=3;c.strokeStyle='#000';c.strokeText(p.text,p.x,p.y-t*20);
        c.fillStyle=p.col;c.fillText(p.text,p.x,p.y-t*20)}
      else if(p.kind==='windup'){const t=p.life/p.max;c.globalAlpha=Math.max(0,1-t*.6);
        c.strokeStyle='#ff3b3b';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,16+16*t,0,Math.PI*2);c.stroke()}}
    c.globalAlpha=1},
  // Screen-space overlay for the S3 cinematic card: darken, a diagonal gold band that sweeps in
  // from the left over the first 12 frames, holds, then sweeps out to the right over the last 12.
  // Called by Render.frame AFTER the camera transform is reset and the HUD is drawn, so it always
  // sits on top and is unaffected by camera zoom/shake. Unskippable: purely a function of card.t,
  // which only Fight.checkCinematic (via the 'card' fx push) can (re)start.
  // Band is a ~150px-tall (measured perpendicular to the band, i.e. in the rotated frame) name
  // card centered on 52% of screen height, rotated about its own center (not the canvas origin) so
  // its footprint stays roughly symmetric around that center line instead of growing off the top —
  // this keeps the portraits/hp bars/floor line above it and the chevrons below it clear, per fix
  // round 1. The DOM on-screen buttons sit in their own stacking context above the canvas either
  // way, but the band is kept clear of that row too for a clean read.
  drawScreen(c,frame){
    if(this.card){
      const cd=this.card,t=cd.t,frames=cd.frames,slide=12,bandH=150,centerY=H*.52,angle=-8*Math.PI/180;
      c.save();c.setTransform(1,0,0,1,0,0);
      c.globalAlpha=.55;c.fillStyle='#000';c.fillRect(0,0,W,H);
      c.globalAlpha=1;
      const enter=Math.min(1,t/slide),exit=t>frames-slide?Math.min(1,(t-(frames-slide))/slide):0;
      const offsetX=-W*(1-enter)+W*exit,cx=W/2+offsetX;
      c.save();c.translate(cx,centerY);c.rotate(angle);
      c.fillStyle='#f4c542';c.fillRect(-(W/2+120),-bandH/2,W+240,bandH);
      c.strokeStyle='#8a6a12';c.lineWidth=3;c.strokeRect(-(W/2+120),-bandH/2,W+240,bandH);
      c.textAlign='center';c.fillStyle='#1a1208';
      c.font='900 44px ui-monospace,monospace';c.fillText(cd.name,0,-8);
      c.font='bold 18px ui-monospace,monospace';c.fillText('SPECIAL 3',0,26);
      c.restore();
      c.restore()}
    // Task 6.4: the tutorial's "SHIELD DOWN" text -- screen-space, drawn here (after Render.frame's
    // own flash rectangle and HUD) specifically so the accompanying white flash (pushed alongside
    // this, see push() above) can never wash it out: stroked white-on-black for contrast against
    // either a bright flash or the dark dungeon scene, fading out over its own 50-frame lifetime.
    if(this.shieldDown){
      const sd=this.shieldDown,t=Math.max(0,1-sd.t/sd.frames);
      c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=t;
      c.textAlign='center';c.font='900 40px ui-monospace,monospace';c.lineWidth=5;
      c.strokeStyle='#000';c.strokeText('SHIELD DOWN',W/2,H*.42);
      c.fillStyle='#fff';c.fillText('SHIELD DOWN',W/2,H*.42);
      c.restore()}}};
