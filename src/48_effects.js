// Task 7.1: timed, stacking status effects. Parallel to 47_buffs.js's flat per-fight BUFFS/Buffs
// (a plain hook list, no per-instance state) but keyed by id + its own live instance state
// (stacks/duration/potency) on fighter.effects, so the same effect id can be re-applied, refreshed,
// stacked up to a cap, and expire on its own clock -- BUFFS has no notion of any of that. Pure
// sim-side, same boundary as Fight/Fighter/AI/Buffs (see the purity + "consumes no RNG" test in
// 90_tests.js): no Math.random/performance.now/DOM, and never reads fight.rng/presRng. tools/build.py
// concatenates src/NN_* in name order, so this file lands after 47_buffs.js and before 50_fighter.js
// -- nothing here may reference the Fighter class at definition time (only at call time, once a real
// Fighter/Fight exists, exactly like BUFFS.thorns already calls fight.emit/fight.fx.push from a file
// that also loads before 60_fight.js defines Fight).
//
// EFFECTS[id] = {id, dur, maxStacks, tick?(fight,holder,e), onApply?(fight,holder,e), mod?(e,m)}.
// `e` is the live holder.effects entry {id,left,stacks,potency,source} Effects.apply/tick manage;
// `m` (mod only) is the running {atkMul,armorDelta,critDelta} accumulator Effects.mods folds every
// active effect into. Every per-stack magnitude below also scales by e.potency (default 1 -- see
// Effects.apply) so a future move's applies:[{id,potency}] can hand out a stronger/weaker copy of the
// same effect without a second EFFECTS entry; every number in the frozen Phase 7 interfaces list is
// exactly what potency 1 (the only potency any test or existing move data ever passes) produces.
const EFFECTS={
  bleed:{id:'bleed',dur:180,maxStacks:5,
    tick(fight,holder,e){holder.hp=Math.max(0,holder.hp-holder.maxHp*0.004*e.stacks*e.potency/60)}},
  // Reuses the existing STUNNED state handling in Fighter (50_fighter.js's act()/tick()) instead of a
  // second stun path, per the controller ruling: onApply just arms holder.stun/holder.state exactly
  // like Fight.resolve's own parry branch already does for PARRY_STUN (60_fight.js). No `tick` hook of
  // its own -- Fighter's own f>=this.stun check is what actually clears STUNNED; this effect's `left`
  // countdown (Effects.tick, below) only governs the HUD badge/expiry bookkeeping, and is kept equal
  // to dur so both clocks empty out together for an unpotency-scaled stun.
  // Fix-wave item 6 (final review M3): onApply used to just set holder.stun/setState('STUNNED') and
  // stop there, which left two things stale: a mid-move holder's own move/moveName (setState alone
  // never clears those -- clearMove() is a separate, deliberate call every other STATE transition
  // that leaves ATTACK/CHARGE already makes), and, when this displaces a live KNOCKDOWN specifically,
  // wasKnockedDown/_kdCounter (setState('KNOCKDOWN')'s own arming has no matching disarm when a LATER
  // setState call moves the fighter on -- every other KNOCKDOWN exit is Fighter.tick's own
  // _kdCounter-driven self-clear, which a STUNNED fighter no longer reaches). Left stale, AI.make's
  // decidePunish 'just got up' read (55_ai.js) would credit a punish window against a fighter that is
  // actually STUNNED, not mid-get-up. clearMove() always runs (a stun from any source interrupts
  // whatever this fighter was doing); the wasKnockedDown/_kdCounter reset is scoped to the KNOCKDOWN
  // case specifically, since a plain ATTACK/CHARGE interrupt never armed them in the first place.
  stun:{id:'stun',dur:60,maxStacks:1,
    onApply(fight,holder,e){
      if(holder.state==='KNOCKDOWN'){holder.wasKnockedDown=false;holder._kdCounter=0}
      holder.clearMove();holder.stun=EFFECTS.stun.dur;holder.setState('STUNNED')}},
  armorBreak:{id:'armorBreak',dur:480,maxStacks:3,
    mod(e,m){m.armorDelta-=0.15*e.stacks*e.potency}},
  fury:{id:'fury',dur:420,maxStacks:5,
    mod(e,m){m.atkMul*=1+0.12*e.stacks*e.potency}},
  powerGain:{id:'powerGain',dur:300,maxStacks:1,
    tick(fight,holder,e){holder.power=Math.min(POWER_MAX,holder.power+0.5*e.potency)}},
  // Instant, per the controller ruling: the moment this is applied (onApply, not tick -- dur:1 exists
  // only so it still rides the same holder.effects/Effects.apply pipeline every other id uses, one
  // frame of bookkeeping then gone) it drains N=e.potency power from the holder (Effects itself has no
  // attacker/defender notion -- whichever Fight.resolve applies:[] entry called Effects.apply already
  // resolved holder to "the foe") and deals damage equal to whatever was actually burned, clamped to
  // what the holder had banked. potency (not stacks) carries N here -- maxStacks:1 means stacks can
  // never scale this one, so a caller wanting a bigger burn passes {potency:N} to Effects.apply, same
  // as {stacks:1,potency:1} (burn 1 power) is what a bare Effects.apply(fight,holder,'powerBurn') with
  // no options at all does, since potency defaults to 1.
  powerBurn:{id:'powerBurn',dur:1,maxStacks:1,
    onApply(fight,holder,e){
      const burn=Math.min(holder.power,e.potency);
      holder.power-=burn;holder.hp=Math.max(0,holder.hp-burn)}},
  regen:{id:'regen',dur:300,maxStacks:3,
    tick(fight,holder,e){holder.hp=Math.min(holder.maxHp,holder.hp+holder.maxHp*0.0015*e.stacks*e.potency/60)}},
  weakness:{id:'weakness',dur:480,maxStacks:3,
    mod(e,m){m.atkMul*=1-0.12*e.stacks*e.potency}},
  // Task 7.3 (frozen interface, exact values): earned by dashing back through a foe's own active
  // hitbox with i-frames still up (Fight.resolve's own miss branch, 60_fight.js, is the only call
  // site -- see its comment for the def.state==='DASH'&&def.inv>0 gate that tells a real dodge apart
  // from KNOCKDOWN get-up i-frames, which never award this). maxStacks:1 (a flat +0.2, not a
  // stackable bonus -- dodging twice inside the 3s window just refreshes the clock, same "latest
  // apply wins" semantics every other EFFECTS id gets from Effects.apply) so the *e.stacks factor
  // below is always 1 at potency 1, the only combination any move/dodge ever passes; kept in the
  // formula anyway for the same reason armorBreak/fury/weakness keep theirs -- a future potency-
  // scaled variant (a bigger single-dodge reward) needs no second EFFECTS entry.
  dexterity:{id:'dexterity',dur:180,maxStacks:1,
    mod(e,m){m.critDelta+=0.2*e.stacks*e.potency}}};

const Effects={
  // Refreshes duration to EFFECTS[id].dur and adds stacks up to maxStacks (the newest call's potency/
  // source replace whatever was there -- same "latest apply wins" shape Buffs.apply's flat holder.buffs
  // replace already uses). Emits a fight 'effect' event with applied:true and queues an HUD popup fx
  // descriptor (see fight.fx below) on every call, refresh or fresh alike -- the frozen interface only
  // distinguishes applied/expired, not new-vs-refreshed.
  apply(fight,holder,id,o){
    o=o||{};
    const def=EFFECTS[id];if(!def)throw new Error('unknown effect: '+id);
    const stacks=o.stacks===undefined?1:o.stacks,potency=o.potency===undefined?1:o.potency;
    let e=holder.effects.find(x=>x.id===id);
    if(e){e.left=def.dur;e.stacks=Math.min(def.maxStacks,e.stacks+stacks);e.potency=potency;e.source=o.source}
    else{e={id,left:def.dur,stacks:Math.min(def.maxStacks,stacks),potency,source:o.source};holder.effects.push(e)}
    if(def.onApply)def.onApply(fight,holder,e);
    fight.emitEffect(holder,id,e.stacks,'applied');
    fight.fx.push({kind:'effectPopup',x:holder.x,y:FLOOR-160,id,stacks:e.stacks});
    return e},
  has(holder,id){return holder.effects.some(e=>e.id===id)},
  stacks(holder,id){const e=holder.effects.find(x=>x.id===id);return e?e.stacks:0},
  // Called once per step per fighter (Fight.step, in the same slot buffFrame already runs, before
  // detect/resolve). Ticks every active entry's own `tick` hook (if any), THEN counts its `left` down
  // by one frame -- an effect applied with dur:180 therefore gets exactly 180 subsequent Effects.tick
  // calls (frames 1..180) before it's removed on the 180th, matching "5 stacks over 180 frames" read
  // literally as 180 tick calls at that potency/stack count.
  tick(fight,holder){
    if(!holder.effects.length)return;
    for(let i=holder.effects.length-1;i>=0;i--){
      const e=holder.effects[i],def=EFFECTS[e.id];
      if(def.tick)def.tick(fight,holder,e);
      if(--e.left<=0){
        holder.effects.splice(i,1);
        fight.emitEffect(holder,e.id,e.stacks,'expired')}}},
  // {atkMul,armorDelta,critDelta} folded across every active effect on holder with a `mod` hook;
  // neutral ({atkMul:1,armorDelta:0,critDelta:0}) whenever holder has none, so Fight.resolve's damage
  // formula stays bit-identical to its pre-Phase-7 shape as long as nothing is actually applied (no
  // move applies anything yet -- see the "bit-identical" test in 90_tests.js and the --matrix/tier
  // gates run alongside it). critDelta has no producer yet in this task -- Task 7.3's dexterity is the
  // first effect to set it -- but the field exists now so Fight.resolve can read it unconditionally.
  // Task 8.0 (pre-art seam): pools into holder._mods (Fighter's own field, 50_fighter.js) instead of
  // allocating a fresh object every call -- Fight.resolve calls this once per side, every landed hit,
  // for the life of the fight, so a fresh {..} literal per call was a steady per-frame allocation.
  // Overwritten in place on every call; safe here specifically because attacker and defender are
  // always two DIFFERENT Fighter instances with their own separate _mods (Fight.resolve's own
  // attMods/defMods never collide), and because every caller reads the returned fields immediately
  // and never retains the object across frames -- the ruling this task's brief calls out explicitly.
  mods(holder){
    const m=holder._mods||(holder._mods={atkMul:1,armorDelta:0,critDelta:0});
    m.atkMul=1;m.armorDelta=0;m.critDelta=0;
    for(const e of holder.effects){const def=EFFECTS[e.id];if(def.mod)def.mod(e,m)}
    return m},
  // No id: drops every effect. With an id: drops just that one (a no-op if the holder doesn't hold
  // it). Never emits an event -- unlike a natural tick expiry, a manual clear has no frozen event shape
  // asked for anywhere in the Phase 7 interfaces list, and Buffs.apply's own holder.buffs=[] replace
  // (47_buffs.js) is silent the same way.
  clear(holder,id){
    if(id===undefined)holder.effects.length=0;
    else{const i=holder.effects.findIndex(e=>e.id===id);if(i>=0)holder.effects.splice(i,1)}}};
