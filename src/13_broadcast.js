// Broadcast: Phase 5 ruling #1 ("viewers are the score; gold is the economy") — pure math derived
// from fight events, kept strictly on the same side of the sim boundary as Fight/Fighter/AI: no
// DOM, no Audio/FX/Render calls, no Math.random, no Date.now()/performance.now() (see the
// source-scan test in 90_tests.js, same pattern as "sim files contain no DOM or presentation
// identifiers"). G/Screens/Render are the only things that ever act on Broadcast.state.
//
// Wiring (all in 80_game.js): G.startFight calls Broadcast.reset(); G.onEvent forwards every
// Fight.emit'd event here via Broadcast.onEvent(type,a,b,val,fight) (fight is G.fight, the live
// instance the event came from — Fight.onEvent itself only ever passes (type,a,b,val)); G.tick
// calls Broadcast.tick(fight) once per sim frame for the hitstun decay and the multiplier-window
// countdown, since Broadcast has no frame counter of its own and must never read a wall clock.
const Broadcast={
  state:{viewers:0,peak:0,combo:0,mult:1,lastPop:null},
  // Flat bonus for a player special's first landed hit, keyed by moveName — this REPLACES (not
  // adds to) the normal dmg*2*mult hit gain for that one event, so a 4-hit S3 doesn't also collect
  // the ordinary per-hit formula on top of its own cinematic bonus. "First hit" is read off the
  // Fighter itself: Fighter.startMove sets `this.hits=new Set()` fresh for every new move, and
  // Fight.resolve does `att.hits.add(idx)` before it ever calls onEvent, so `a.hits.size===1` on a
  // 'hit' event where a.moveName is s1/s2/s3 means idx 0 (the move's first landed hit) just resolved.
  SPECIAL_BONUS:{s1:400,s2:800,s3:1500},
  // Task 5.2: `o.viewersMul` (from Sponsors.apply's 'crowd' perk, threaded in by G.startFight) is
  // stashed once per fight, not read live off Save.data/Sponsors on every _gain call -- keeps
  // Broadcast itself from reaching into Sponsors/Save.data mid-fight (same presentation-free
  // boundary its own header claims), and matches the frozen interface's "stored on Broadcast at
  // reset". Optional and defaults to 1 so every pre-5.2 caller (a bare `Broadcast.reset()`) is
  // unaffected.
  reset(o){
    this.state.viewers=0;this.state.peak=0;this.state.combo=0;this.state.mult=1;this.state.lastPop=null;
    this._multVal=1;this._multFrames=0;
    // "First blood" (ruling #1's +250) is the PLAYER's own first landed hit of the fight, not
    // literally whichever side strikes first — an enemy hit landing on the player first doesn't
    // consume or block it; it just waits for the player's first landed hit, whenever that comes.
    this._firstBlood=false;
    this._viewersMul=(o&&o.viewersMul)||1},
  // Every viewer delta funnels through here: floors at 0 (decay or a taken hit can never push the
  // count negative) and keeps peak as the running max across both event gains and tick()'s decay.
  // Task 5.2: only a POSITIVE gain is scaled by the crowd perk's viewersMul -- a taken-hit loss or
  // tick()'s hitstun decay (both negative n) pass through unscaled, so "crowd" makes the good stuff
  // bigger without also shrinking the bad stuff.
  _gain(n){
    if(n>0)n*=this._viewersMul;
    this.state.viewers=Math.max(0,this.state.viewers+n);
    if(this.state.viewers>this.state.peak)this.state.peak=this.state.viewers},
  // Ratings multiplier windows are frame-countdown and never stack: a new trigger only takes over
  // when its value is >= whatever's currently active, so a parry landing mid-S3-window can't
  // downgrade ×3 back down to ×1.5 (a tie refreshes the window's duration instead of no-op'ing).
  // lastPop is a one-shot flag for whoever reads Broadcast.state next (G.onEvent) to pop a gold FX
  // popup off of and clear — Broadcast itself never pushes into fight.fx.
  _setMult(val,frames){
    if(val>=this._multVal){
      this._multVal=val;this._multFrames=frames;this.state.mult=val;
      this.state.lastPop={mult:val,text:'RATINGS ×'+val+'!'}}},
  onEvent(type,a,b,val,fight){
    if(!fight)return;
    const p1=fight.p1;
    if(type==='hit'){
      if(a===p1){
        const mv=a.moveName,firstSpecialHit=(mv==='s1'||mv==='s2'||mv==='s3')&&a.hits&&a.hits.size===1;
        let gain=firstSpecialHit?this.SPECIAL_BONUS[mv]:val*2*this.state.mult;
        const fiveHit=a.combo===5;
        if(fiveHit)gain+=500;
        if(!this._firstBlood){this._firstBlood=true;gain+=250}
        this._gain(gain);
        // Highest-wins ordering: an S3's first hit always tries for ×3 even if it also happens to be
        // the 5th combo hit (a 5-hit ×2 attempt right after would just no-op against _setMult's >=
        // guard, which is exactly the "not stacked" rule doing its job).
        if(mv==='s3'&&firstSpecialHit)this._setMult(3,240);
        else if(fiveHit)this._setMult(2,180)
      }else if(b===p1){
        this._gain(-val)}
      // Live mirror of the player's own combo counter (Fight.resolve is what actually increments/
      // resets fight.p1.combo) — not itself a scoring input, just carried on state for any HUD/combo
      // tie-in that wants it without reaching into fight.p1 directly.
      this.state.combo=p1.combo
    }else if(type==='parry'&&a===p1){
      this._gain(300);this._setMult(1.5,180)}
  },
  tick(fight){
    if(fight&&fight.p1&&fight.p1.state==='HITSTUN')this._gain(-0.5);
    if(this._multFrames>0){
      this._multFrames--;
      if(this._multFrames<=0){this._multVal=1;this.state.mult=1}}
  }
};
// Sponsors: Phase 5 ruling #2 ("sponsor perks are permanent buffs bought with gold"). Lives next to
// Broadcast (not in 12_meta.js's Meta.SHOP_ITEMS) because it hands opts.viewersMul straight to
// Broadcast.reset above and its other three effects (playerBuffs/statMul.atk/parryWindow) are all
// consumed by G.startFight in the same one place SHOP_ITEMS' own consumers (Screens) never need to
// touch. Unlike Meta.SHOP_ITEMS (consumable currency spends), a perk is bought once and owned
// forever -- Sponsors.buy refuses a second purchase of the same id rather than double-charging or
// double-applying it. Not folded into the sim-purity scan two tests above (unlike Broadcast.*): it
// reads/writes Save.data directly (gold, Save.data.perks), which is a Meta-shaped concern, not a
// sim one -- it still never touches document/canvas/Audio/FX/Render, same boundary, just not asserted
// by name.
const Sponsors={
  PERKS:{
    dashers:{cost:800,atkMul:1.05},
    insurance:{cost:1200,parryWindow:2},
    secondWind:{cost:1500,buff:'secondWind'},
    crowd:{cost:1000,viewersMul:1.2}},
  // Display labels for the kiosk's PERKS section (85_screens.js) -- kept separate from PERKS itself
  // so PERKS stays exactly the frozen {cost,effect} shape with nothing extra riding along on it.
  LABELS:{dashers:'SPONSOR: DOORWAY DASHERS',insurance:'PARRY INSURANCE',
    secondWind:'SECOND WIND',crowd:'CROWD FAVORITE'},
  // Save.data.perks isn't part of Meta.defaults()'s explicit shape (frozen before this task) --
  // lazily created here the first time anything actually buys or queries a perk, same pattern as
  // Save.data.pity being lazily created by Crystal.open (12_meta.js): a pre-5.2 v2 save picks it up
  // for free through migrate()'s generic top-level "fill anything missing" loop the moment it's set.
  owned(){
    const p=Save.data.perks;
    return p?Object.keys(Sponsors.PERKS).filter(id=>p[id]):[]},
  // Refuses (returns false, no partial mutation) when the perk is unknown-would-throw... no: unknown
  // ids throw (same as Buffs.apply/Crystal.open on an unknown id -- a programmer error, not a normal
  // refusal); already-owned or short-on-gold both just return false, same as Meta.buy.
  buy(id){
    const perk=Sponsors.PERKS[id];
    if(!perk)throw new Error('unknown perk: '+id);
    if(!Save.data.perks)Save.data.perks={};
    if(Save.data.perks[id])return false; // already owned -- no duplicate purchase, no double-charge
    if((Save.data.gold||0)<perk.cost)return false;
    Save.data.gold-=perk.cost;
    Save.data.perks[id]=true;
    Save.put();
    return true},
  // Extends `opts` (a G.startFight-shaped options object, or {} for a bare query) with every owned
  // perk's effect, folded together: playerBuffs gets each perk's `buff` id appended (consumed by the
  // exact same Buffs.apply path the encounter/enemy side already uses -- see G.startFight), atkMul
  // multiplies together into statMul.atk (G.startFight applies it to Stats.derive's own atk output),
  // parryWindow sums (G.startFight sets it as the live p1 Fighter's parryBonus), viewersMul
  // multiplies together (G.startFight hands it straight to Broadcast.reset). Returns the same opts
  // object it was given (mutated in place) so a caller that already has one can just keep using it.
  apply(opts){
    opts=opts||{};
    const playerBuffs=(opts.playerBuffs||[]).slice();
    let atkMul=1,parryWindow=0,viewersMul=1;
    for(const id of Sponsors.owned()){
      const perk=Sponsors.PERKS[id];
      if(perk.buff)playerBuffs.push(perk.buff);
      if(perk.atkMul)atkMul*=perk.atkMul;
      if(perk.parryWindow)parryWindow+=perk.parryWindow;
      if(perk.viewersMul)viewersMul*=perk.viewersMul}
    opts.playerBuffs=playerBuffs;
    opts.statMul={atk:atkMul};
    opts.parryWindow=parryWindow;
    opts.viewersMul=viewersMul;
    return opts}};
