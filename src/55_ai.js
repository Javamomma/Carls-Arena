// AI.TIERS: the five difficulty tiers (t1..t5) — see the Phase 3 plan's frozen interfaces.
// `attack` was retuned for Task 3.6's balance pass (see docs/ARENA.md's "AI numbers changed" table):
// t3 .09->.25, t4 .12->.35, t5 .15->.5, t1/t2 left at their frozen values. Everything else in this
// table is unchanged from the frozen interfaces. Before this pass, t3-t5 rolled an attack so rarely
// (once every ~7-30 idle frames even at cd===0) that tests/batch.py's scripted --bot auto opponent —
// which reacts to every visible medium/heavy and chains every light it lands — beat every tier at a
// nearly flat 77-100% win rate with no real difficulty curve; see 55_ai.js's `comboFollow` for the
// paired behavior change (a landed attack now chases its own chain) that makes the higher attack
// rate actually punishing instead of just spammier.
const AI_TIERS={
  t1:{react:24,attack:.03,block:.25,parry:.02,dash:.01,special:.3, heavy:0,  intercept:0,  bait:0,  punish:0},
  t2:{react:14,attack:.04,block:.5, parry:.1, dash:.02,special:.6, heavy:0,  intercept:.1, bait:0,  punish:.2},
  t3:{react:8, attack:.25,block:.65,parry:.3, dash:.04,special:.9, heavy:.2, intercept:.3, bait:.1, punish:.5},
  t4:{react:5, attack:.35,block:.75,parry:.45,dash:.06,special:1,  heavy:.3, intercept:.5, bait:.25,punish:.8},
  t5:{react:2, attack:.65,block:.85,parry:.6, dash:.08,special:1,  heavy:.35,intercept:.7, bait:.4, punish:1}};
const AI={
  TIERS:AI_TIERS,
  // profiles IS the alias table (not a copy of it) so old direct reads like AI.profiles.brute and
  // AI.profiles.brawl keep resolving to the right objects. basic->t2 and brawl->t3 reuse the exact
  // tier objects (not clones) so AI.resolveProfile('basic')===AI.TIERS.t2.
  profiles:{
    dummy:{react:0,attack:0,block:0,parry:0,dash:0,special:0,heavy:0,intercept:0,bait:0,punish:0},
    basic:AI_TIERS.t2,
    brawl:AI_TIERS.t3,
    // brute keeps its Task 2.8 identity (a heavy-happy brawler) as a t3 clone with a higher heavy
    // bias (.6, same value as before) layered over t3's other numbers.
    brute:Object.assign({},AI_TIERS.t3,{heavy:.6})},
  resolveProfile(name){
    if(AI_TIERS[name])return AI_TIERS[name];
    if(AI.profiles[name])return AI.profiles[name];
    throw new Error('unknown AI profile: '+name)},
  make(profile,seed){
    const p=AI.resolveProfile(profile),r=RNG(seed);
    let hold=0,cd=0,plan=null,hHold=0;
    // Bait feint state: baitHold counts the remaining held-heavy frames (the trigger below sets it
    // to 5 and also sends the first true frame itself, for 6 total). baitDashPending survives the
    // one busy() frame the charge-cancel needs (Fighter.act only cancels CHARGE on a frame it reads
    // intent.heavy===false, and that same frame can't also start a DASH — the CHARGE branch never
    // looks at intent.dashBack) and fires the feint's dashBack the next time this fighter isn't busy.
    let baitHold=0,baitDashPending=false;
    // Combo follow-through state (Task 3.6 balance pass): comboFollow counts remaining chain-cancel
    // presses after ANY of this fighter's own landed moves opens a chain window — a punish medium
    // (as in Phase 3.1) or, new here, an ordinary spontaneous attack. Deliberately a blind countdown
    // (no rng draw), the same shape as hHold/baitHold above, so arming it at a new site never shifts
    // the rng sequence a tier already drew at that site — only the busy-frame timing around it
    // changes. Checked ahead of busy() (a chain-cancel window is still state==='ATTACK', i.e. busy)
    // but cleared the moment the fighter goes non-busy without ever seeing that window again (the
    // move whiffed, or the chain simply ended) so a mid-combo hit/knockdown can't leave this AI stuck
    // waiting on a chain window that will never come. Without this, a scripted opponent that
    // blocks/dodges everything except a bare light1 ate the rest of any chain for free once that
    // first light landed (see tests/batch.py's win-rate gate).
    let comboFollow=0;
    // Tracks the foe's invulnerability frames across calls (cheap, no rng) so 'punish' can catch the
    // single decision frame the KNOCKDOWN get-up i-frames end on, not just the frames still inv>0.
    let prevFoeInv=0;
    return{next(fight,me,foe){
      const it=Ctrl.EMPTY();
      const justGotUp=foe.state==='IDLE'&&foe.inv===0&&prevFoeInv>0;
      prevFoeInv=foe.inv;
      // Heavy charge-hold has to run before the busy() gate below: once startMove('heavy') has put
      // `me` into CHARGE, Fighter.busy() reports true (it only excludes IDLE/BLOCK), so if this
      // returned an empty intent while charging, Fighter.act's CHARGE branch would read intent.heavy
      // as false on the next frame and cancel the charge. Mirrors the block `hold` pattern below,
      // just ahead of the short-circuit that pattern relies on BLOCK not being "busy".
      // This countdown is blind to interruption: once armed it decrements and keeps pressing heavy
      // for its full charge+1 span even if `me` gets hit, parried, or knocked down mid-charge and
      // never actually reaches CHARGE/ATTACK. That's fine today because Fighter.act only reads
      // intent.heavy while in IDLE/BLOCK (to start the charge) or CHARGE (to sustain it); in every
      // other state (HITSTUN, KNOCKDOWN, STUNNED, ...) the intent bit is simply ignored, so a stale
      // hHold countdown wastes a few frames of "would-be" input rather than corrupting behavior. It
      // would need to actually reset on interruption before an AI tier that reacts mid-swing (Phase 3)
      // could rely on hHold reflecting "still trying to land this heavy".
      if(hHold>0){hHold--;it.heavy=true;return it}
      // Same blind-countdown shape as hHold, for the bait feint's short 6-frame hold.
      if(baitHold>0){baitHold--;it.heavy=true;if(baitHold===0)baitDashPending=true;return it}
      if(comboFollow>0){
        if(me.state==='ATTACK'&&me.phase()==='recovery'&&me.move.chain&&me.landed){comboFollow--;it.light=true;return it}
        if(me.busy())return it; // still mid-move (startup/active, or a recovery that isn't a chain window yet) — keep waiting
        comboFollow=0} // fully back to IDLE/BLOCK without ever seeing a chain window: the combo is over
      if(me.busy())return it;
      // An established block hold takes priority over firing a pending bait dash.
      if(hold>0){hold--;it.block=true;return it}
      if(baitDashPending){baitDashPending=false;it.dashBack=true;return it}
      const dist=Math.abs(foe.x-me.x)-me.width;
      // Derived from move data instead of hard-coded: light1.range(70)+20=90 and heavy.range(130)+10
      // =140 reproduce the old flat thresholds for the stock movesets while tracking per-move/per-
      // character overrides (none currently touch .range, but moveDef merges them if one ever does).
      const lightRange=me.moveDef('light1').range+20,heavyRange=me.moveDef('heavy').range+10;
      if(cd>0)cd--;
      // A timed parry: wait until the foe's hit is 2 frames out, then press block.
      if(plan==='parry'){if(foe.state!=='ATTACK'){plan=null}else if(foe.f>=foe.move.startup-2){plan=null;hold=8+r.int(8);it.block=true;return it}else return it}
      // Intercept: read the dash-in medium's startup and punish it with a light before it lands,
      // checked ahead of the slower reactive-block check below so it gets first crack at the same
      // frame's rng roll instead of that check eating it and holding block. Gated on p.intercept>0
      // so dummy/t1 (both 0) draw the exact same rng sequence as before this behavior existed.
      if(p.intercept>0&&foe.state==='ATTACK'&&foe.moveName==='medium'&&foe.f<=2&&r.next()<p.intercept){it.light=true;cd=p.react;return it}
      // React to a visible startup: normally only moves slow enough that an immediate hold is a
      // block, not an accidental parry. Punish-capable tiers (p.punish>0 — t2 and up) also react to
      // fast moves (lights included), since catching one of those in the parry window is exactly
      // what their punish behavior exists to capitalize on; profiles with punish===0 (dummy, t1) see
      // the exact same condition as before this behavior existed.
      if(foe.state==='ATTACK'&&foe.f===1&&(foe.move.startup>PARRY_WINDOW+2||p.punish>0)&&r.next()<p.block){
        if(r.next()<p.parry){plan='parry';return it}hold=p.react+r.int(10);it.block=true;return it}
      // Punish: the foe is stunned (parried), just cleared its KNOCKDOWN get-up i-frames, or is still
      // locked out from a missed parry (parryLock>0) — capitalize with a medium, then chain a couple
      // of lights via comboFollow above. Gated on p.punish>0 so dummy never draws this roll.
      if(p.punish>0&&cd===0&&(foe.state==='STUNNED'||justGotUp||foe.parryLock>0)&&r.next()<p.punish){it.medium=true;cd=p.react;comboFollow=3;return it}
      if(cd===0&&me.power>=100&&r.next()<p.special*STEP){it.special=me.power>=300?3:me.power>=200?2:1;cd=20;return it}
      // Heavy: brute-style profiles favor a slow, telegraphed swing at close-but-not-point-blank
      // range. Held for moveDef('heavy').charge+2 frames total (this frame plus hHold's decrements
      // below) so the sim's CHARGE->ATTACK transition always sees intent.heavy through the whole
      // charge window. p.heavy>0 short-circuits before touching the rng for profiles that don't use
      // it (heavy:0), so dummy/basic draw the exact same rng sequence as before this behavior
      // existed. The dist>=lightRange floor (new in Phase 3, alongside intercept/bait/punish) keeps
      // a punish-capable tier from blindly committing a slow charge point-blank against an
      // already-swinging foe, where it can't help but eat a faster hit first; brute (heavy>0 but
      // punish inherited from its t3 base) and brawl/t3 (heavy newly nonzero) both fall under this,
      // which is fine since neither's heavy-triggered behavior is required to match pre-Phase-3 brute.
      if(p.heavy>0&&cd===0&&dist>=lightRange&&dist<heavyRange&&r.next()<p.heavy){hHold=me.moveDef('heavy').charge+1;it.heavy=true;cd=p.react;return it}
      // Bait: hold heavy (the telegraphed swing) at mid-range just long enough to look committed,
      // then cancel and dash back — a feint. Gated on p.bait>0 so dummy/basic (both 0) draw the
      // exact same rng sequence as before this behavior existed.
      if(p.bait>0&&me.state==='IDLE'&&cd===0&&dist>=140&&dist<=220&&r.next()<p.bait){baitHold=5;it.heavy=true;cd=p.react;return it}
      // A spontaneous attack that lands also gets to chase the combo (Task 3.6 balance pass), gated
      // on p.punish>0 (the tiers' "capitalizes on an opening" knob, already monotonic: t1's 0 keeps
      // it a pushover, t5's 1 always chases) so this new site arms the exact same blind countdown as
      // the punish branch above, with zero extra rng draws of its own.
      if(cd===0&&r.next()<p.attack){if(dist<lightRange)it.light=true;else it.medium=true;cd=p.react;if(p.punish>0)comboFollow=3;return it}
      if(dist<lightRange&&r.next()<p.dash){it.dashBack=true;return it}
      return it}}}};
