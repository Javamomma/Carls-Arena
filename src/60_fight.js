class Fight{
  constructor(o){const seed=o.seed||1;this.rng=RNG(seed);
    // Presentation-side stream (announcer line picks) kept fully separate from this.rng: nothing in
    // Fight/Fighter/AI ever reads presRng, so whether or how many announcer lines actually get
    // picked during a run (e.g. wired to G.onEvent live vs a bare mkFight in a unit test) can never
    // shift a later crit roll or any other sim outcome. Derived from the fight seed (not shared with
    // it) via a cheap integer hash so distinct seeds still get distinct announcer streams.
    this.presRng=RNG((seed*2654435761>>>0)^0x5eed);
    this.p1=new Fighter(o.p1,1,o.ctrl1);this.p2=new Fighter(o.p2,-1,o.ctrl2);
    this.frame=0;this.clock=o.clock===undefined?120:o.clock;this.hitstop=0;this.over=false;this.winner=null;this.log=[];this.onEvent=o.onEvent||(()=>{});
    this.fx=[];this.slowmo=0;this.cinematic=0; // fx: plain events drained by G into FX each tick; slowmo/cinematic: frame counters G steps around
    this.noCrit=!!o.noCrit; // mkFight defaults this true for deterministic Phase 1/2 tests; G.startFight leaves crits live
    this.updateCam()}
  // Fix round 2: gameplay zoom capped at 1.12 (was 1.35) — same 1.0..cap ramp over the same
  // 120-500 distance range, just a smaller max, since the rescaled rig at 1.35 put a raised-arm
  // pose's hand above the HUD (see 68_rig.js's 'tallest pose stays under the HUD at max zoom' test;
  // the still-higher 1.28 cinematic-only cap is G's, not the sim's — Fight never reaches it itself).
  updateCam(){const dist=Math.abs(this.p2.x-this.p1.x);
    this.camTarget={x:(this.p1.x+this.p2.x)/2,zoom:clamp(1.12-(dist-120)/380*0.12,1,1.12)}}
  step(){if(this.over)return;if(this.cinematic>0)return;if(this.hitstop>0){this.hitstop--;return}
    this.frame++;this.clock-=STEP;
    // Task 6.2: fighter.foeDist is the live hurtbox-edge gap, written before either side's
    // controller/act() runs this frame so Fighter.startMove (called from act(), below) always sees
    // this frame's real distance when a move's track/stepIn fields need it. Symmetric (same value on
    // both sides) and matches AI.make's own long-standing `dist` formula (Math.abs(dx)-width) exactly,
    // since every fighter shares width 48 -- sim-derived only (no wall clock, no rng), so it stays
    // fully deterministic.
    this.p1.foeDist=this.p2.foeDist=Math.abs(this.p2.x-this.p1.x)-(this.p1.width/2+this.p2.width/2);
    const i1=this.p1.ctrl.next(this,this.p1,this.p2),i2=this.p2.ctrl.next(this,this.p2,this.p1);
    this.p1.act(i1);this.p2.act(i2);this.p1.tick();this.p2.tick();
    this.buffFrame(this.p1,this.p2);this.buffFrame(this.p2,this.p1);
    // Task 7.1: Effects.tick runs once per step per fighter, same slot buffFrame already runs in
    // (before detect/resolve) -- ticks every active timed effect's own per-frame hook (bleed/regen/
    // powerGain) and counts its duration down, removing it (and emitting 'effect' expired) the frame
    // its clock reaches 0. See 48_effects.js's own comment for why this yields exactly `dur` tick
    // calls per applied effect.
    Effects.tick(this,this.p1);Effects.tick(this,this.p2);
    this.separate();this.updateCam();
    this.checkCinematic(this.p1);this.checkCinematic(this.p2);
    // Detect both sides' hits against the pre-resolve state before applying either, so a true
    // mutual trade lands both instead of the first resolve knocking out the second's hitbox.
    const c1=this.detect(this.p1,this.p2),c2=this.detect(this.p2,this.p1);
    if(c1)this.resolve(c1);if(c2)this.resolve(c2);
    if(this.p2.state==='IDLE'&&this.p2.f>20)this.p1.combo=0;if(this.p1.state==='IDLE'&&this.p1.f>20)this.p2.combo=0;
    if(this.p1.hp<=0||this.p2.hp<=0||this.clock<=0)this.finish()}
  separate(){const a=this.p1,b=this.p2,min=a.width/2+b.width/2+4,d=b.x-a.x;if(d<min){const p=(min-d)/2;a.x-=p;b.x+=p}}
  // holder.buffs is resolved once by Buffs.apply, never re-resolved here — just iterated.
  buffFrame(holder,foe){if(!holder.buffs)return;for(const b of holder.buffs)if(b.onFrame)b.onFrame(this,holder,foe)}
  // Calls kind ('onHit'|'onBlock') on each of holder's buffs, passing holder as a 5th arg so a buff
  // that only makes sense on one side of an exchange (e.g. armorUp only for the defender) can tell
  // which side it's being resolved for by comparing holder against att/def.
  buffHook(kind,holder,att,def,ref){if(!holder.buffs)return;for(const b of holder.buffs)if(b[kind])b[kind](this,att,def,ref,holder)}
  // Fires exactly once, on the single frame an s3 leaves startup for the first time (att.f lands
  // on att.move.startup right after tick()). Arms the 72-frame cinematic freeze and queues the card
  // FX; guarded by this.cinematic===0 so a same-frame double-trigger (both sides popping s3 at once)
  // can't stack two freezes — first side checked (p1) wins, an accepted arbitrary tie-break.
  checkCinematic(att){
    if(this.cinematic===0&&att.state==='ATTACK'&&att.moveName==='s3'&&att.f===att.move.startup){
      this.cinematic=72;
      this.fx.push({kind:'card',name:att.def.name,frames:72});
      this.fx.push({kind:'flash',frames:4})}}
  detect(att,def){const hb=att.hitbox();if(!hb)return null;const idx=att.hitIndex();if(idx<0||att.hits.has(idx))return null;
    const hu=def.hurtbox();if(hb.x1<hu.x0||hb.x0>hu.x1)return null;const m=att.move,last=idx===(m.hits||1)-1;
    if(def.inv>0||def.state==='KNOCKDOWN'||def.state==='KO'||def.state==='WIN')return{type:'miss',att,def,idx};
    const blocking=def.state==='BLOCK'||def.state==='BLOCKSTUN';
    // unblockableSpecials: the attacker's special (m.cost is only set on s1/s2/s3) ignores block if
    // the attacker holds the buff, same treatment as MOVES.s3's own m.unblockable flag.
    const unblockable=m.unblockable||(m.cost&&att.buffs&&att.buffs.some(b=>b.id==='unblockableSpecials'));
    if(blocking&&!unblockable){
      // Task 5.2: def.parryBonus (Sponsor perk "Parry Insurance", 0 for everyone else) widens the
      // window by that many frames -- see Fighter.act's own parryLock-arming comment (50_fighter.js)
      // for why its two bounds have to widen by the exact same amount, in lockstep with this one.
      if(def.blockAge<=PARRY_WINDOW+def.parryBonus&&def.parryLock===0&&!m.cost)return{type:'parry',att,def,idx};
      return{type:'block',att,def,idx,m}}
    return{type:'hit',att,def,idx,m,last}}
  // Task 7.2: the landed move's own effective per-node damage -- MOVES.light/medium each carry a
  // chainDmg[] indexed by chainNode (1..CHAIN.nodes), the frozen node multiplier table; every other
  // move (heavy, s1-s3) has no chainDmg at all and falls back to its own flat m.dmg, bit-identical to
  // before this task. att.chainNode is always 1..CHAIN.nodes by the time a chain move actually lands
  // (Fighter.startMove sets it before setupDash/setState ever run), so the fallback ||1 only guards a
  // hand-built fixture that skipped startMove entirely (a few unit tests construct hit/block records
  // directly rather than driving a real chain).
  nodeDmg(att,m){return m.chainDmg?m.chainDmg[Math.max(1,Math.min(att.chainNode||1,m.chainDmg.length))-1]:m.dmg}
  resolve(r){const{type,att,def,idx}=r;att.hits.add(idx);
    if(type==='miss'){
      // Task 7.3 (frozen interface, exact ruling): dexterity -- def dodged this hit specifically by
      // dashing back through it with i-frames still up (def.state==='DASH'&&def.inv>0; detect() also
      // returns 'miss' for KNOCKDOWN/KO/WIN and the post-getup i-frame window, none of which are a
      // real dodge, so the state check is what tells them apart -- see Fighter.wasKnockedDown's own
      // comment, 50_fighter.js, for why a bare inv-edge check alone can't). Effects.apply's own
      // Effects.tick/emitEffect plumbing (48_effects.js) already logs a generic type:'effect' entry
      // for this; the dedicated 'dexterity' event below carries the {who,dir} shape Task 7.4 needs to
      // shake directionally, which the generic effect event has no slot for (see emitTell's comment).
      if(def.state==='DASH'&&def.inv>0){
        Effects.apply(this,def,'dexterity',{source:att});
        this.fx.push({kind:'afterimage',x:def.x,y:FLOOR-80,face:def.face});
        this.emitTell('dexterity',def,att.face)}
      return this.emit('miss',att,def,0)}
    if(type==='parry'){def.parryLock=0;def._parried=true;att.clearMove();att.stun=PARRY_STUN;att.setState('STUNNED');att.combo=0;att.chainNode=0;def.setState('IDLE');
      this.fx.push({kind:'flash',frames:6});this.fx.push({kind:'popup',x:def.x,y:FLOOR-120,text:'PARRY!',col:'#8cf',big:false});
      return this.emit('parry',def,att,0)}
    if(type==='block'){const m=r.m;
      // Task 7.2 ruling: chip must scale by the attacker's own Effects.mods.atkMul (fury/weakness),
      // computed here exactly as the hit branch below computes it for its own dmg formula -- a fury
      // stack chips harder through a raised guard too, not just on an unblocked hit. Also reads the
      // same per-node dmg (nodeDmg) the hit branch uses, so a chained light/medium chips proportionally
      // to whichever node it landed on, not a flat m.dmg.
      const attMods=Effects.mods(att);
      const chipRef={chip:Math.round(att.def.atk*attMods.atkMul*this.nodeDmg(att,m)*CHIP*(1-(def.def.blockProf||0)))};
      // thorns lives here: the defender (the blocker) is the only side with an onBlock call.
      this.buffHook('onBlock',def,att,def,chipRef);
      const chip=chipRef.chip;
      def.hp=Math.max(0,def.hp-chip);def.stun=m.blockstun;def.setState('BLOCKSTUN');
      def.power=Math.min(POWER_MAX,def.power+m.powTaken);att.landed=true;att.combo=0;def.x+=att.face*m.push*.5;
      // Task 7.1: m.applies (move data may carry applies:[{id,stacks?,potency?,on:'hit'|'crit'|'block'}])
      // -- the on:'block' entries land here, applied to the defender (the blocker), after chip/state are
      // already set so an applied stun's own onApply (EFFECTS.stun, 48_effects.js) can still override
      // BLOCKSTUN with STUNNED the same way it overrides HITSTUN below. No move carries `applies` yet
      // (Task 7.2 wires the first one), so this loop is a no-op in every fight today.
      if(m.applies)for(let i=0;i<m.applies.length;i++){const ap=m.applies[i];
        if(ap.on==='block')Effects.apply(this,def,ap.id,{stacks:ap.stacks,potency:ap.potency,source:att})}
      this.fx.push({kind:'dust',x:def.x,y:FLOOR});return this.emit('block',att,def,chip,att.moveName)}
    const m=r.m,last=r.last;
    const cls=CLASS_BEATS[att.def.cls]===def.def.cls?CLASS_BONUS:1;
    // Task 7.1: Effects.mods(holder) -> {atkMul,armorDelta,critDelta}, neutral (1,0,0) whenever holder
    // has no active mod-bearing effect (armorBreak/fury/weakness today; Task 7.3's dexterity is the
    // first to set critDelta) -- read on the attacker for their own outgoing atkMul/critDelta (fury,
    // weakness) and on the defender for their own armorDelta (armorBreak), each holder's mod applying
    // to their own side of the exchange, same "holder's own stat" shape BUFFS.armorUp/powerGain already
    // use. Multiplying by an exact 1 / adding an exact 0 (every fight today, since no move applies
    // anything yet) leaves every float bit-identical to the pre-Phase-7 formula below.
    const attMods=Effects.mods(att),defMods=Effects.mods(def);
    // Crit rolls once per landed hit, after the class bonus and before armor.
    const crit=!this.noCrit&&this.rng.next()<(att.def.crit+attMods.critDelta);
    const critMul=crit?(att.def.critMul||CRIT_MUL_DEFAULT):1;
    // Task 7.3 (frozen interface, exact ruling): intercept -- att's hit catches def still in the
    // STARTUP of def's own move, and that move is one that actually advances def toward the foe
    // (def.move.dash||def.move.track -- true for light's own dash/stepIn and every medium's track;
    // false for heavy/specials, which telegraph in place). Read here (before def.clearMove() below
    // ever touches def.state/def.move) since it's def's PRE-this-hit attack that's being punished, the
    // same "read the pre-resolve state" discipline Fight.step's own c1/c2 detect-before-resolve split
    // already keeps for a true mutual trade. def.phase() (50_fighter.js) is Task 7.2's own helper,
    // reused rather than duplicated here per the controller's ruling.
    const intercept=def.state==='ATTACK'&&def.phase()==='startup'&&!!(def.move&&(def.move.dash||def.move.track));
    // ref carries dmg, the two power deltas, and the move itself so armorUp/powerGain can adjust
    // them before either is applied; defender-side hooks run first, then attacker-side, both against
    // the same ref. Fix-wave item 6: ref.move (not att.move) is what powerGain reads — on a true
    // mutual trade, Fight.step resolves both sides' detect() results in the same tick (c1 then c2),
    // and resolve(c1) nulls def.move (a few lines below, def.move=null) where that same fighter is
    // c2's ATTACKER, so by the time resolve(c2) runs, att.move for that call has already gone null
    // and powerGain's old `att.move` read silently no-op'd. ref is a fresh object built fresh for
    // THIS resolve() call, never touched by the other side's resolve, so ref.move is always the
    // move that actually landed this call.
    const ref={dmg:Math.round(att.def.atk*attMods.atkMul*this.nodeDmg(att,m)*cls*critMul*(intercept?1.5:1)*(1-(def.def.armor+defMods.armorDelta))),powHit:m.powHit,powTaken:m.powTaken,move:m};
    this.buffHook('onHit',def,att,def,ref);this.buffHook('onHit',att,att,def,ref);
    const dmg=ref.dmg;
    def.hp=Math.max(0,def.hp-dmg);att.landed=true;att.combo++;def.combo=0;
    att.power=Math.min(POWER_MAX,att.power+ref.powHit+(intercept?15:0));def.power=Math.min(POWER_MAX,def.power+ref.powTaken);
    // Task 7.2: CHAIN.enders (light:{}/medium:{push,knockdown}) only applies to the landed hit that's
    // actually the chain's node-5 finisher (a plain light/medium at nodes 1-4 gets no bonus, so an
    // early cancel into medium can't fish for the push/knockdown a full 5-hit chain earns) -- the
    // 'medium as a combo ender' behavior this replaces used to key off att.combo>=3 (a global hit-
    // streak counter unrelated to THIS chain's own length); att.chainNode===CHAIN.nodes is the real
    // thing to check now. The in-combo heavy ender (moveName==='heavy', chainNode also CHAIN.nodes --
    // see Fighter.act's node-4 branch) needs no override at all here: CHAIN.enders.heavy only carries
    // {charge,sig}, so m (already merged with that override in startMove) still carries base MOVES.
    // heavy's own knockdown/push untouched, same as a plain neutral heavy.
    const isChainEnder=(att.moveName==='light'||att.moveName==='medium')&&att.chainNode===CHAIN.nodes;
    const ender=isChainEnder?CHAIN.enders[att.moveName]:null;
    const knockdown=ender?!!ender.knockdown:!!m.knockdown;
    def.clearMove();if(knockdown&&last)def.setState('KNOCKDOWN');else{def.stun=m.hitstun;def.setState('HITSTUN')}
    def.chainNode=0; // Task 7.2 ruling: taking a hit resets the DEFENDER's own chain (they were interrupted mid-recovery)
    // Task 7.1: m.applies -- on:'hit' entries fire on every landed hit, on:'crit' entries only when
    // this landed hit actually crit; both apply to the defender (the struck fighter), after the
    // HITSTUN/KNOCKDOWN transition above so an applied stun's own onApply (EFFECTS.stun) can still
    // override it with STUNNED, exactly like the block branch's own applies loop. No move carries
    // `applies` yet, so this is a no-op in every fight today -- see the "bit-identical" test.
    if(m.applies)for(let i=0;i<m.applies.length;i++){const ap=m.applies[i];
      if(ap.on==='hit'||(ap.on==='crit'&&crit))Effects.apply(this,def,ap.id,{stacks:ap.stacks,potency:ap.potency,source:att})}
    // Task 7.2: the in-combo heavy ender (m.sig:true, only ever true for CHAIN.enders.heavy's own
    // merged move data) fires the ATTACKER's own def.sigEffect once it lands -- a champion-signature
    // bonus effect (Carl fury targets himself; Donut weakness/Katia bleed/Mongo armorBreak all target
    // the foe -- see CHAMPS' own sigEffect comment, 40_movedata.js). Mobs/bosses have no sigEffect
    // (undefined), so this is a no-op for them; target defaults to 'foe' per the 7.1 review ruling.
    if(m.sig&&att.def.sigEffect){const sig=att.def.sigEffect;
      Effects.apply(this,sig.target==='self'?att:def,sig.id,{stacks:sig.stacks,source:att})}
    // Task 7.2: the chain ender's own push (medium: 90, knockdown; light/heavy: the move's normal
    // push) replaces the old att.combo>=3 special case -- see isChainEnder/ender above.
    const push=ender&&ender.push!==undefined?ender.push:m.push;
    if(!m.hits||last)def.x+=att.face*push;
    // Sim freeze only on a single-hit move or the last blow of a multi-hit special (mirrors the
    // knockback gate above): a 4-hit S3 shouldn't stack four 14-frame freezes back to back. Every
    // landed hit still shakes/sparks/pops for combo feedback; only the freeze itself is gated, and
    // an intermediate multi-hit leaves any hitstop already armed by a same-frame mutual trade alone.
    // Task 7.3 (frozen interface, exact ruling): an intercept's own hitstop (10) replaces whatever
    // the landed move's own m.hitstop would have set, same gating as the plain case above.
    if(!m.hits||last)this.hitstop=intercept?10:m.hitstop;
    // Task 6.5: a landed medium (KICK, a leg strike in every rig -- Phase 6 ruling 4) pushes a low
    // dust arc instead of the usual gold spark burst -- data-only (which fx kind gets pushed), never
    // touching hitstop/shake, so the sim stays exactly as deterministic as it already was. att.face
    // (not def's) is the kick's own forward direction, since the dust sweeps the way the kicking
    // attacker is facing, into the defender.
    if(att.moveName==='medium')this.fx.push({kind:'dustArc',x:def.x,y:FLOOR,face:att.face});
    else this.fx.push({kind:'spark',x:def.x,y:FLOOR-80,n:8,col:crit?'#ff5a4a':'#ffd86b'});
    // Task 7.4 (frozen interface, exact ruling): a per-class impact fx (dust ring/arc slash/caster
    // ring, keyed off the ATTACKER's own def.impact -- 40_movedata.js) layered on top of (never
    // instead of) the spark/dustArc burst just pushed above, same "data-only, never touches hitstop/
    // shake" discipline the kick-fx swap comment above already spells out. att.def.impact is only
    // ever 'blunt'|'blade'|'energy' today (every CHAMPS/MOBS/BOSSES entry carries one), so the
    // ({...}[x]) lookup below is never undefined in practice; the guard is just cheap insurance for
    // a future def that forgets to set one.
    const impactKind={blunt:'impactBlunt',blade:'impactBlade',energy:'impactEnergy'}[att.def.impact];
    if(impactKind)this.fx.push({kind:impactKind,x:def.x,y:FLOOR-80,face:att.face});
    // Task 6.4: BUFFS.tutorialGuard (47_buffs.js) sets ref.capped=true the instant it actually
    // clamped this hit's dmg -- forwarded onto the popup fx as `muted`, which FX/Render draw grey
    // instead of the usual gold/red/crit color, per the frozen "capped popups drawn grey" interface.
    // false for every non-tutorial fight (ref.capped is only ever set by that one buff).
    this.fx.push({kind:'popup',x:def.x,y:FLOOR-120,text:String(dmg),col:crit?'#ff4444':'#ffd86b',big:crit,muted:!!ref.capped});
    // Task 7.4 fix round 1 (frozen ruling, exact table): HITFEEL[hfKey] (40_movedata.js) is the
    // controller's own per-class shake/punch magnitudes -- intercept overrides the landed move's own
    // class entirely (an intercepting hit always feels like an intercept, whatever move actually
    // caught the foe); light carries shake:0/punch:0, so it pushes neither fx, matching the ruling
    // "light: no shake/no punch". Gated by the exact same "single-hit move, or the LAST blow of a
    // multi-hit special" condition (!m.hits||last) hitstop itself already uses just above -- a
    // multi-hit special's own shake/punch fires once, off its final landed sub-hit, never per sub-hit
    // (every sub-hit still gets its own popup/spark/impact fx just above, unaffected).
    if(!m.hits||last){
      const hfKey=intercept?'intercept':(HITFEEL[att.moveName]?att.moveName:null);
      const hf=hfKey&&HITFEEL[hfKey];
      if(hf){
        // dir carries the attacker's own facing (att.face) so FX's own directional shake vector
        // (72_fx.js) always kicks the camera the same way the exchange was actually facing.
        if(hf.shake>0)this.fx.push({kind:'shake',amt:hf.shake,dir:att.face});
        // hold/creep forward straight from the table -- the presentation side's own 'punch' push
        // case (72_fx.js) reads both (hold overrides its own default per-push; creep eases the
        // punch IN over that hold instead of snapping straight to it, the S1/S2 "final hit...
        // creep" ruling).
        if(hf.punch>0)this.fx.push({kind:'punch',pct:hf.punch,hold:hf.hold,creep:!!hf.creep})}}
    // Task 7.3 (frozen interface, exact ruling): the intercept's own read/reward gets its own
    // INTERCEPT! callout, on top of (never instead of) the plain damage popup/spark just pushed
    // above -- and its own event, carrying {who,dir} (dir is att's own facing, per the ruling) so
    // Task 7.4's directional shake can tell which way to kick the camera. Its own shake/punch fx are
    // pushed by the HITFEEL block just above (keyed off 'intercept'), not here.
    if(intercept){
      this.fx.push({kind:'popup',x:def.x,y:FLOOR-150,text:'INTERCEPT!',col:'#ff9d3b',big:true});
      this.emitTell('intercept',att,att.face)}
    this.emit('hit',att,def,dmg,att.moveName)}
  finish(){this.over=true;const a=this.p1,b=this.p2;
    this.winner=a.hp<=0?b:b.hp<=0?a:(a.hp/a.maxHp>=b.hp/b.maxHp?a:b);
    a.setState(a===this.winner?'WIN':'KO');b.setState(b===this.winner?'WIN':'KO');
    this.slowmo=90;this.fx.push({kind:'flash',frames:6});
    this.emit('ko',this.winner,null,0)}
  // move is only meaningful (and only passed) for 'hit'/'block'; other event types leave it
  // undefined, which existing log consumers already ignore.
  emit(type,a,b,val,move){this.log.push({f:this.frame,type,who:a?a.side:0,val,move});this.onEvent(type,a,b,val)}
  // Task 7.1: 'effect' events (Effects.apply/.tick, 48_effects.js) carry id/stacks/applied|expired --
  // a shape emit()'s own (type,a,b,val,move) log entry has no slot for. A small dedicated sibling
  // instead of overloading emit(): logs the exact {type:'effect',who,id,stacks,applied|expired} shape
  // the frozen Phase 7 interface calls for (flag is the string 'applied' or 'expired', stored as a
  // computed boolean key so only one of the two is ever present per entry), then still funnels through
  // the same onEvent(type,a,b,val) 4-arg contract every other event uses, so an 'effect' event reaches
  // Broadcast/Tutorial/G.onEvent exactly the way 'hit'/'block'/'parry' already do, even though none of
  // them special-case it yet.
  emitEffect(holder,id,stacks,flag){
    this.log.push({f:this.frame,type:'effect',who:holder.side,id,stacks,[flag]:true});
    this.onEvent('effect',holder,null,stacks)}
  // Task 7.3 (frozen interface, exact shape): 'intercept'/'dexterity' events carry {type,who,dir} --
  // `who` is the fighter credited for the read (the interceptor for 'intercept', the dodger for
  // 'dexterity'; see each call site's own comment), `dir` is always the CURRENT resolve() call's own
  // attacker facing (att.face) so Task 7.4's directional camera shake always kicks the same way the
  // exchange was actually facing, regardless of which side `who` turns out to be. A dedicated sibling
  // to emitEffect for the same reason that one exists: emit()'s own (type,a,b,val,move) shape has no
  // `dir` slot, and folding a facing sign into `val` would collide with every other event's own use
  // of that field as a magnitude (dmg/chip/stacks).
  emitTell(type,holder,dir){
    this.log.push({f:this.frame,type,who:holder.side,dir});
    this.onEvent(type,holder,null,dir)}}
