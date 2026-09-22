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
  reset(){
    this.state.viewers=0;this.state.peak=0;this.state.combo=0;this.state.mult=1;this.state.lastPop=null;
    this._multVal=1;this._multFrames=0;
    // "First blood" (ruling #1's +250) is the PLAYER's own first landed hit of the fight, not
    // literally whichever side strikes first — an enemy hit landing on the player first doesn't
    // consume or block it; it just waits for the player's first landed hit, whenever that comes.
    this._firstBlood=false},
  // Every viewer delta funnels through here: floors at 0 (decay or a taken hit can never push the
  // count negative) and keeps peak as the running max across both event gains and tick()'s decay.
  _gain(n){
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
