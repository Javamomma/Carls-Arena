// Task 9.2: champion/boss passive abilities -- deterministic, RNG-free, sim-side hooks that trigger
// off fight/frame, hp, block-state and special/parry events, laid out parallel to Effects (48_effects.js)
// but driven by these hooks instead of a move's own applies:[] list. tools/build.py concatenates
// src/NN_* in filename order, so this file lands after 48_effects.js and before 50_fighter.js --
// it may reference EFFECTS/Effects (already defined) at definition time, but never the Fighter class
// (which loads after this file); every function below only ever touches a live Fighter INSTANCE
// handed in as `fighter`/`holder` by Fight.step/Fight.resolve/Fighter.startMove at CALL time (once a
// real fight exists), the same "load-order-safe forward touch" BUFFS.thorns already relies on from a
// file that loads before 60_fight.js defines Fight.
//
// PASSIVES[id] holds the frozen params for one champion/boss's def.passive={id} (40_movedata.js just
// carries the bare id; every actual number lives here, in one place, same "table separate from the
// def" split CHAMPS/MOBS/BOSSES already keep for EFFECTS/BUFFS ids). Six entries, one per Phase 9
// champion/boss signature -- see the task brief's own frozen table for the exact source of every
// number below (nothing here was invented independent of that ruling).
const PASSIVES={
  spite:{hpBelow:.40,every:180,apply:{id:'fury',stacks:1,uncapped:true},ceiling:10},
  royalDisdain:{onSpecial:{id:'weakness',stacks:1,doubleIfDebuffed:true}},
  understudy:{onParry:{id:'critDmg',stacks:1}},
  immovable:{whileBlocking:{every:120,apply:{id:'fury',stacks:1},max:5}},
  championOfTheFloor:{every:1200,purify:true,apply:{id:'fury',stacks:3}},
  brood:{hpBelow:.50,apply:{id:'powerGain',stacks:1}}};

const Passives={
  // Task 9.2 (controller ruling): a bare 1 until Phase 10 wires real sig levels -- every apply below
  // routes through this so a later potency-scaled passive needs no new plumbing, exactly like a
  // move's own applies:[{id,potency}] already does via Effects.apply's own `potency` option.
  potency(champ){return 1},
  // Shared apply path every trigger below uses: Effects.apply the real effect, then the plumbing a
  // real passive trigger needs that a plain Effects.apply call doesn't already give it -- a
  // {type:'passive',who,id} log/onEvent entry (Fight.emitPassive, 60_fight.js, mirrors Effects.apply's
  // own emitEffect) and a bare {kind:'passiveBanner'} fx descriptor (presentation-only; 72_fx.js is
  // the only place that turns it into the actual 22px gold-italic/class-gem banner -- same "sim
  // pushes plain data, FX styles it" split Effects.apply's own effectPopup push already uses).
  _fire(fight,holder,pid,id,stacks,uncapped){
    Effects.apply(fight,holder,id,{stacks,potency:this.potency(holder.def),uncapped});
    fight.emitPassive(holder,pid);
    fight.fx.push({kind:'passiveBanner',x:holder.x,y:FLOOR-200,id:pid,cls:holder.def.cls})},
  // Once per step per fighter, called from Fight.step right after Effects.tick (same slot). RNG-free;
  // reads only hp/maxHp/state/power off `fighter` and fight.frame -- never fight.rng/presRng.
  // Task 9.2 (controller ruling): fight.spar (set only for a tutorial-mode fight, G.startFight,
  // 80_game.js) short-circuits every passive here before any condition is even read -- the ruling's
  // own "Spite/Brood never fire in spar" ask, applied centrally so every future passive gets the same
  // guard with no per-id opt-in (the tutorial's own dummy goblin never holds a def.passive anyway, so
  // this is a no-op cost for every fight that isn't a tutorial).
  tick(fight,fighter){
    if(fight.spar)return;
    const pd=fighter.def.passive;if(!pd)return;
    const t=fighter._passiveT||(fighter._passiveT={});
    switch(pd.id){
      // Carl's Spite: below 40% hp, +1 uncapped fury stack every 180 frames spent below that
      // threshold (the timer resets the instant hp climbs back to/above 40%, so it only ever counts
      // continuous time spent low, never banks progress made on an earlier dip). Task 9.1 review
      // ruling: a passive-level ceiling stops it from actually applying once the holder already holds
      // >=10 fury stacks -- the timer itself keeps running (still resets every 180 frames) so a later
      // purify/clear that drops the holder back under 10 lets it resume on its own next tick, with no
      // extra bookkeeping needed here.
      case'spite':{
        const cfg=PASSIVES.spite;
        if(fighter.hp/fighter.maxHp<cfg.hpBelow){
          t.spite=(t.spite||0)+1;
          if(t.spite>=cfg.every){
            t.spite=0;
            if(Effects.stacks(fighter,cfg.apply.id)<cfg.ceiling)
              this._fire(fight,fighter,'spite',cfg.apply.id,cfg.apply.stacks,cfg.apply.uncapped)}}
        else t.spite=0;
        break}
      // Mongo's Immovable: +1 fury stack every 120 frames spent in BLOCK or BLOCKSTUN (controller
      // ruling: both states count -- a mid-block hit landing on him still counts those frames, a
      // held guard doesn't have to go totally unhit to build stacks), capped at 5. fury's own
      // EFFECTS.maxStacks is already 5, so the cap is enforced twice over (belt and suspenders, not a
      // second real ceiling) -- the explicit `<cfg.max` guard still skips the apply call (and its
      // event/banner) once capped, rather than firing a no-op Effects.apply every 120 frames forever.
      case'immovable':{
        const cfg=PASSIVES.immovable.whileBlocking;
        if(fighter.state==='BLOCK'||fighter.state==='BLOCKSTUN'){
          t.immovable=(t.immovable||0)+1;
          if(t.immovable>=cfg.every){
            t.immovable=0;
            if(Effects.stacks(fighter,cfg.apply.id)<cfg.max)
              this._fire(fight,fighter,'immovable',cfg.apply.id,cfg.apply.stacks,false)}}
        break}
      // Grull's Champion of the Floor: every 1200 frames (fight.frame%1200===0, controller ruling --
      // a stateless clock, no per-fighter timer needed), purify every debuff he's currently holding
      // then grant +3 fury. Purify runs unconditionally on the beat (not gated by whether he actually
      // holds any debuff) -- Effects.purify is already a silent no-op when there's nothing to strip.
      case'championOfTheFloor':{
        const cfg=PASSIVES.championOfTheFloor;
        if(fight.frame>0&&fight.frame%cfg.every===0){
          Effects.purify(fighter);
          this._fire(fight,fighter,'championOfTheFloor',cfg.apply.id,cfg.apply.stacks,false)}
        break}
      // Mother Rat's Brood: the instant hp crosses below 50% (edge-triggered -- fires once per
      // crossing, not once per frame spent under it; re-arms the moment hp climbs back to/above 50%
      // so a later dip fires again), grants one powerGain stack. The regen-tripling half of Brood
      // lives in BUFFS.regen's own onFrame (47_buffs.js) -- it checks holder.def.passive.id itself,
      // live, rather than reading anything off this module (see that buff's own comment for why it
      // needs no reference to PASSIVES/Passives at all).
      case'brood':{
        const cfg=PASSIVES.brood;
        const below=fighter.hp/fighter.maxHp<cfg.hpBelow;
        if(below&&!t.broodCrossed){
          t.broodCrossed=true;
          this._fire(fight,fighter,'brood',cfg.apply.id,cfg.apply.stacks,false)}
        else if(!below)t.broodCrossed=false;
        break}}},
  // Hook from Fight.resolve's parry branch (60_fight.js), called with the fighter who just landed the
  // parry (the exchange's `def` -- the one who was holding block and caught the attack inside the
  // parry window). Katia's Understudy: +1 critDmg stack (EFFECTS.critDmg's own frozen dur:180,
  // maxStacks:1 -- no per-call override exists, same "no per-call duration override" pattern every
  // other Phase 9 effect apply already follows).
  onParry(fight,fighter){
    if(fight.spar)return;
    const pd=fighter.def.passive;if(!pd||pd.id!=='understudy')return;
    const cfg=PASSIVES.understudy.onParry;
    this._fire(fight,fighter,'understudy',cfg.id,cfg.stacks,false)},
  // Hook from Fighter.startMove (50_fighter.js), called for every s1/s2/s3 activation (any fighter's,
  // not just Donut's -- gated internally here, same as onParry). Donut's Royal Disdain: +1 weakness
  // stack on the foe every time she throws a special, doubled to +2 when the foe already holds any
  // other debuff (checked against PURIFIABLE, 48_effects.js's own frozen debuff set -- already defined,
  // this file loads after it).
  onSpecial(fight,fighter,move){
    if(fight.spar)return;
    const pd=fighter.def.passive;if(!pd||pd.id!=='royalDisdain')return;
    const cfg=PASSIVES.royalDisdain.onSpecial;
    const foe=fighter.side===1?fight.p2:fight.p1;
    const debuffed=PURIFIABLE.some(id=>Effects.has(foe,id));
    const stacks=cfg.stacks*(debuffed&&cfg.doubleIfDebuffed?2:1);
    Effects.apply(fight,foe,cfg.id,{stacks,potency:this.potency(fighter.def)});
    fight.emitPassive(fighter,'royalDisdain');
    fight.fx.push({kind:'passiveBanner',x:fighter.x,y:FLOOR-200,id:'royalDisdain',cls:fighter.def.cls})}};
