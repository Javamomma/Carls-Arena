// Task 5.3: the Floor 0 tutorial's own presentation/meta state machine. Lives here (not a sim file)
// since step 4 reaches directly into the live Fighter (fight.p1.power) the same way G.debugPose/
// G.debugCinematic already reach into fight state from outside the sim boundary -- Fight/Fighter
// themselves are never touched, and BUFFS.noKo (47_buffs.js) is what actually keeps the player alive,
// not this object. Tutorial.steps is the frozen {prompt,done(fight)} shape (four entries);
// Tutorial.state={step,done:[bool*4]} tracks progress; Tutorial.prompt is the live overlay text
// (#tutorialPrompt, synced every tutorial-mode tick by G.syncTutorialPrompt below).
//
// Wiring (all in G, mirroring how Broadcast is wired): G.startTutorial calls Tutorial.reset();
// G.onEvent forwards every Fight.emit'd event here via Tutorial.onEvent(type,a,b,val,fight), gated to
// G.mode==='tutorial'; G.tick calls Tutorial.tick(fight) once per sim frame, same gate, right
// alongside Broadcast.tick(f).
const Tutorial={
  state:{step:0,done:[false,false,false,false]},
  prompt:'',
  _lights:0,_parried:false,_powerSet:false,_flash:0,
  // Fix-wave item 1 (final review, Critical): EVERY step now runs its own stall timer, not just the
  // last one -- a tap-only player used to dead-end at lesson 2 (the dummy is passive until lesson 3,
  // so nothing ever happens) with no hint and no way forward except the fight's own clock, which
  // G.startTutorial now removes entirely (clock:Infinity -- see its own comment). _stepFrames counts
  // sim frames since the CURRENT step became current (reset on every advance, see reset()/tick()
  // below); STALL_FRAMES is how long any step is given before `stalled` flips true and its own
  // fallback hint layers onto the prompt (HINTS below); FORCE_FRAMES is a second, later threshold
  // (lessons 2-3 only) that temporarily forces the attack/block buttons back on for a player who
  // still hasn't found them.
  STALL_FRAMES:600,FORCE_FRAMES:1500,_stepFrames:0,stalled:false,
  // Fix-wave item 1: per-step fallback hints, appended to the step's own prompt once STALL_FRAMES has
  // passed with no progress -- lesson 4 (POWER) keeps its own pre-existing wording (the one hint the
  // final review's first-play walkthrough specifically called out).
  HINTS:['Tap anywhere on the screen','Swipe right anywhere to kick — or tap KICK',
    'Hold anywhere to block, let go as the flash hits','TAP THE GLOWING POWER BUTTON'],
  // Task 6.4 (frozen prompt text): rewritten for the whole-canvas gestures -- lessons 1-2 also point
  // at the real BLOCK/PUNCH/KICK buttons ("(or tap PUNCH)"/"(or tap KICK)"), which G.startTutorial/
  // Tutorial.tick (below) force on (G.forceButtons) for exactly those two lessons, per the plan
  // ruling "Lessons 1-2 force the attack buttons on... so prompts can also say 'or tap PUNCH / KICK'".
  // Fix-wave item 1: lesson 2 ("SWIPE RIGHT to kick") now credits a STARTED medium -- fight.p1.
  // moveName==='medium' observed directly, the instant the move begins -- instead of only a landed
  // hit; a whiffed kick still teaches the gesture/button and must not leave a player stuck rethrowing
  // it at a dummy that's still passive at this step anyway (Ctrl.tutorialDummy never attacks before
  // lesson 3). Mirrors how step 3 (POWER) already reads fight.p1.moveName directly rather than
  // waiting on an onEvent-fed flag.
  steps:[
    {prompt:'TAP to punch — land 3 hits (or tap PUNCH)',done:()=>Tutorial._lights>=3},
    {prompt:'SWIPE RIGHT to kick (or tap KICK)',done:fight=>!!(fight&&fight.p1&&fight.p1.moveName==='medium')},
    {prompt:'HOLD to block, release as the hit lands to PARRY',done:()=>Tutorial._parried},
    {prompt:'POWER — fire a special',
      done:fight=>!!(fight&&fight.p1&&(fight.p1.moveName==='s1'||fight.p1.moveName==='s2'||fight.p1.moveName==='s3'))}],
  reset(){
    this.state={step:0,done:[false,false,false,false]};
    this._lights=0;this._parried=false;this._powerSet=false;this._flash=0;
    this._stepFrames=0;this.stalled=false;
    this.prompt=this.steps[0].prompt},
  // Fed every Fight.emit'd event (mirrors Broadcast.onEvent's own wiring), gated to the CURRENT step
  // only -- each branch sets just its own step's flag, so an event that would match a LATER step
  // (e.g. a medium landed while chasing the finishing blow, well after step 1 is already done) can
  // never retroactively complete a step out of order.
  onEvent(type,a,b,val,fight){
    if(!fight||!fight.p1)return;
    const p1=fight.p1,step=this.state.step;
    if(step===0&&type==='hit'&&a===p1&&a.moveName&&a.moveName.indexOf('light')===0)this._lights++;
    else if(step===2&&type==='parry'&&a===p1)this._parried=true},
  // Called once per sim frame (mirrors Broadcast.tick's own wiring): arms step 4's power-100 grant
  // exactly once (the instant that step becomes current, never re-applied once the player starts
  // spending it), then advances state.step the moment the current step's done(fight) goes true.
  // Completion itself (Save.data.tutorialDone/the one-time gold grant) is NOT decided here -- see
  // G.onFightEnd's tutorial branch: the fight ends on the dummy's own natural KO, independent of
  // whether every step was actually followed, matching the ruling that rejected a forced
  // G.endTutorial()-style finish in favor of the real player-vs-dummy combat path. Fix-wave item 1:
  // G.onFightEnd now ALSO requires state.step to have actually reached steps.length before granting
  // completion -- belt-and-suspenders now that the fight has no clock of its own to time out on, but
  // kept in case some other, non-natural end ever reaches onFightEnd early.
  tick(fight){
    if(!fight)return;
    if(this._flash>0)this._flash--;
    const step=this.state.step;
    if(step>=this.steps.length)return;
    if(step===3&&!this._powerSet&&fight.p1){fight.p1.power=100;this._powerSet=true}
    // Fix-wave item 1 (final review, Critical): every step (not just POWER) gets its own stall timer
    // now -- if it isn't completed within STALL_FRAMES sim frames of becoming current, its own
    // fallback hint (HINTS above) layers onto the prompt and `stalled` flips true (G.syncTutorialPrompt
    // reads it to pulse #btnPower, still meaningful for lesson 4; the earlier lessons just show the
    // extra text). A tap-only player used to dead-end at lesson 2 in total silence -- the dummy stays
    // passive until lesson 3, so nothing ever happened to react to -- this is the fix.
    this._stepFrames++;
    if(!this.stalled&&this._stepFrames>=this.STALL_FRAMES){
      this.stalled=true;
      this.prompt=this.steps[step].prompt+' — '+this.HINTS[step]}
    // Fix-wave item 1: past FORCE_FRAMES on lesson 2 or 3 specifically (steps 1/2 -- the two lessons
    // that normally decide BLOCK/PUNCH/KICK visibility on their own, see G.startTutorial/the step===2
    // transition below), temporarily force the attack buttons back on for a player who's still stuck
    // well past the stall hint -- lesson 2 already shows them by default so this is a no-op there, but
    // lesson 3 (block) normally hides them once lesson 2 ends, and a player who can't find the
    // whole-canvas hold gesture benefits from BLOCK reappearing as a real, visible fallback target.
    if((step===1||step===2)&&this._stepFrames>=this.FORCE_FRAMES&&typeof G!=='undefined'&&!G.forceButtons){
      G.forceButtons=true;G.applySettings()}
    if(this.steps[step].done(fight)){
      this.state.done[step]=true;this._flash=30;this.state.step++;
      this._stepFrames=0;this.stalled=false;
      this.prompt=this.state.step<this.steps.length?this.steps[this.state.step].prompt:'FINISH HIM';
      // Task 6.4 (controller ruling, Task 6.2): lesson 2 ("SWIPE RIGHT to kick") starts with the
      // dummy backed off to ~260px so the kick's own range-tracking dash-in (MOVES.medium.track)
      // actually has ground to cover -- lesson 1 leaves it close (see G.startTutorial's own spawn),
      // so without this the dummy would still be sitting inside light range when lesson 2 begins.
      if(this.state.step===1&&fight.p2)fight.p2.x=fight.p1.x+260;
      // Task 6.4: BLOCK/PUNCH/KICK are only forced on for lessons 1-2 (set true by G.startTutorial,
      // reset here the instant lesson 3 begins) -- from lesson 3 on, the player's own showButtons
      // setting is all that's left deciding it (G.applySettings ORs forceButtons with the setting).
      // Fix-wave item 1: this also clears any FORCE_FRAMES stall-force from lesson 2 above, so lesson
      // 3 starts exactly as before (buttons hidden unless the player's own setting shows them, or its
      // own stall force kicks back in) rather than inheriting lesson 2's forced-on state.
      if(this.state.step===2&&typeof G!=='undefined'){G.forceButtons=false;G.applySettings()}
      // Fix-wave item 1: same reset leaving lesson 3 (entering POWER) -- clears any stall-force lesson
      // 3 itself armed, so POWER's own stall hint (pulsing #btnPower) is the only thing left pointing
      // at anything once every attack button lesson is behind the player.
      if(this.state.step===3&&typeof G!=='undefined'){G.forceButtons=false;G.applySettings()}
      // Release pass: clears the p2 dummy's own guardActive flag (not a Tutorial-side read) the
      // instant every step is done, so BUFFS.tutorialGuard (47_buffs.js) stops capping damage and
      // "FINISH HIM" is a real natural KO -- see that buff's comment for why it reads holder state
      // instead of this object directly. Task 6.4: also pushes the 'shieldDown' fx (72_fx.js: a white
      // flash + 'SHIELD DOWN' text) on the exact same frame, so the shield's release is a visible
      // beat, not a silent flag flip -- the HP bar (Render.hud, gated on this same guardActive read)
      // returns starting the very next frame this draws.
      if(this.state.step>=this.steps.length&&fight.p2){
        fight.p2.guardActive=false;
        fight.fx.push({kind:'shieldDown',x:fight.p2.x,y:FLOOR-160})}}}};
const G={state:'TITLE',fight:null,encounter:null,acc:0,last:0,sim:false,debug:false,seed:1,cam:{x:STAGE_W/2,zoom:1},_tickN:0,
  // Fix-wave item 5 (final review, Minor): the page's own ?atlas=1 URL override, computed once here
  // (location.search doesn't change without a navigation) -- the exact same regex Atlas.load's own
  // `enabled` check already uses (68_rig.js) to decide whether to fetch at all. Rig.draw's atlas
  // short-circuit reads this alongside Save.data.settings.useAtlas so a query-string override still
  // works even with the settings toggle off, matching Atlas.load's own "OR" semantics.
  atlasQuery:/(?:^|[?&])atlas=1(?:&|$)/.test(location.search),
  frameNow:0,_sayAt:-999, // mirrors fight.frame (updated in tick()); gates G.say to one line per 90 frames
  // Task 6.3: forces BLOCK/PUNCH/KICK on regardless of Save.data.settings.showButtons -- read by
  // G.applySettings (which ORs it with the setting to toggle body.show-atk) alongside the setting.
  // Always false here; Task 6.4's tutorial spar mode sets it true for its first two lessons (so the
  // "TAP PUNCH"/"SWIPE RIGHT / KICK" prompts can point at real buttons) and false again after, then
  // calls G.applySettings() itself to re-sync the DOM -- nothing else in this task ever sets it.
  forceButtons:false,
  cinemFocus:null, // the attacking Fighter to punch the camera in on, set from the 'card' fx while fight.cinematic>0
  zoomCap:1.12,cineZoomCap:1.28, // per-fight caps on Camera.update's target zoom; recomputed in startFight from
  // Rig.extent(p1) / Rig.extent(p2) so a tall rig's topmost joint (any pose, any prop) never gets
  // zoomed in past HUD_LINE. Default to the game's own normal ceilings (sim's own camTarget.zoom
  // already caps gameplay at 1.12; 1.28 is the S3 cinematic punch-in) so a Camera.update before any
  // startFight (shouldn't happen, but tests instantiate G without always calling it) behaves exactly
  // as it did before this existed.
  fit(){const s=Math.min(innerWidth/W,innerHeight/H);canvas.style.width=Math.floor(W*s)+'px';canvas.style.height=Math.floor(H*s)+'px';this.positionToast();this.positionTutorialPrompt();this.checkOrientation()},
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
  // Task 6.3: BLOCK/PUNCH/KICK are optional now -- when they're hidden, positionToast below can't use
  // BLOCK_RIGHT/PUNCH_LEFT (those buttons collapse to a zero rect same as pre-fight), so it falls back
  // to POWER_LEFT (POWER's own left edge, right:22/width:76, the one button still always on screen)
  // and EDGE_MARGIN (a flat canvas-edge inset on the side that lost its button entirely, same 22px
  // offset BLOCK/POWER already use on their own side).
  POWER_LEFT:W-(22+76),EDGE_MARGIN:22,
  // Task 5.4 (leftHanded): BLOCK_RIGHT/PUNCH_LEFT above are canvas-local x's for the NORMAL layout's
  // gap (BLOCK's right edge .. PUNCH's left edge) -- see their own original comment for why this is
  // computed off fixed numbers instead of the buttons' own getBoundingClientRect (they collapse to
  // zero pre-fight). document.body's 'left-handed' class (G.applySettings) mirrors the whole #btns
  // layout in CSS (00_head.html: BLOCK moves to the right, PUNCH/KICK/POWER to the left) around the
  // canvas's own horizontal center, so the mirrored gap's local x's are exactly W minus the normal
  // ones, swapped (mirroring PUNCH_LEFT gives the new left edge, mirroring BLOCK_RIGHT gives the new
  // right edge) -- no separate constants needed, and it stays correct if BLOCK_RIGHT/PUNCH_LEFT above
  // are ever retuned.
  positionToast(){const r=canvas.getBoundingClientRect(),el=document.getElementById('toast'),sx=r.width/W;
    const lh=document.body.classList.contains('left-handed');
    // Task 6.3: swap in the button-hidden fallbacks (POWER_LEFT/EDGE_MARGIN) whenever the attack
    // buttons aren't shown (body.show-atk, set by G.applySettings from showButtons||forceButtons) --
    // same mirror-by-W-minus-x trick the leftHanded gapLc/gapRc below already used, just applied to
    // whichever pair (BLOCK_RIGHT/PUNCH_LEFT or EDGE_MARGIN/POWER_LEFT) is actually on screen.
    const showAtk=document.body.classList.contains('show-atk');
    const leftEdge=showAtk?this.BLOCK_RIGHT:this.EDGE_MARGIN,rightEdge=showAtk?this.PUNCH_LEFT:this.POWER_LEFT;
    const gapLc=lh?(W-rightEdge):leftEdge,gapRc=lh?(W-leftEdge):rightEdge;
    const gapL=r.left+gapLc*sx,gapR=r.left+gapRc*sx;
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
  // Task 5.3/6.4: #tutorialPrompt's position, same off-canvas-rect technique positionToast already
  // uses (so it tracks the canvas box exactly through any letterboxing). Task 6.4 moved it from
  // canvas-local y=112 to y=132 to make room for #tutorialLesson (the 'LESSON n / 4' banner) right
  // above it at y=108 -- both still comfortably clear of HUD_LINE (104, the viewers counter's own
  // bottom edge) above them and the fighters themselves below.
  positionTutorialPrompt(){
    const r=canvas.getBoundingClientRect(),el=document.getElementById('tutorialPrompt'),
      lesson=document.getElementById('tutorialLesson');
    const sy=r.height/H;
    if(lesson){lesson.style.left=(r.left+r.width/2)+'px';lesson.style.top=(r.top+108*sy)+'px'}
    if(!el)return;
    el.style.left=(r.left+r.width/2)+'px';
    el.style.top=(r.top+132*sy)+'px'},
  // Called once per tutorial-mode tick (see tick() below): mirrors Tutorial.prompt/._flash onto the
  // DOM overlay every frame -- cheap (a textContent/classList write only, no layout work beyond what
  // positionTutorialPrompt already did once at fit()) and simpler than trying to diff for changes,
  // same tradeoff G.syncSpecials already makes for the power button's ready/disabled state.
  syncTutorialPrompt(){
    const el=document.getElementById('tutorialPrompt');
    if(!el)return;
    el.classList.add('show');
    el.classList.toggle('flash',Tutorial._flash>0);
    el.textContent=Tutorial.prompt;
    // Task 6.4: the 'LESSON n / 4' banner -- n is state.step+1, clamped to steps.length so it still
    // reads 'LESSON 4 / 4' (not 5 / 4) during the "FINISH HIM" window after step 4 completes but
    // before the fight's own natural KO ends it.
    const lesson=document.getElementById('tutorialLesson');
    if(lesson){lesson.classList.add('show');
      lesson.textContent='LESSON '+Math.min(Tutorial.state.step+1,Tutorial.steps.length)+' / '+Tutorial.steps.length}
    // Fix-wave item 6 (final review, Minor): pulses #btnPower once Tutorial.stalled (POWER step idle
    // past STALL_FRAMES) -- see Tutorial.tick's own comment. Toggled every tutorial-mode tick, same
    // as .flash just above, and cleared automatically the instant Tutorial.stalled goes back to false
    // (the step advancing resets it) with no separate call needed.
    const pwr=document.getElementById('btnPower');
    if(pwr)pwr.classList.toggle('pulse',Tutorial.stalled)},
  hideTutorialPrompt(){const el=document.getElementById('tutorialPrompt');if(el)el.classList.remove('show');
    // Task 6.4: #tutorialLesson hides alongside #tutorialPrompt -- same lifetime, same caller.
    const lesson=document.getElementById('tutorialLesson');if(lesson)lesson.classList.remove('show');
    // Fix-wave item 6: also clears any pulse left over from a previous tutorial run -- mirrors the
    // comment on this function's only other caller-relevant state (Tutorial.prompt itself).
    const pwr=document.getElementById('btnPower');if(pwr)pwr.classList.remove('pulse')},
  show(id,on){document.getElementById(id).classList.toggle('show',on)},
  // Task 5.4: settings whose effect is a standing DOM/layout state (not read live each time, unlike
  // reduceMotion/sfx/announcer/haptics, which are checked directly off Save.data.settings at their
  // own call sites) get applied here -- called once at boot (before the first fit(), since
  // positionToast below reads the class it sets) and again from Screens.renderSettings() every time a
  // toggle button is clicked.
  applySettings(){
    document.body.classList.toggle('left-handed',!!Save.data.settings.leftHanded);
    // Fix-wave item 6: mirrors reduceMotion onto a body class (same pattern as left-handed just
    // above) so the POWER-stall pulse's CSS (00_head.html) can go static instead of animated without
    // every future animated element having to read Save.data.settings itself.
    document.body.classList.toggle('reduce-motion',!!Save.data.settings.reduceMotion);
    // Task 6.3: BLOCK/PUNCH/KICK (.atkbtn, 00_head.html) show only when the player opted in via
    // SETTINGS or the tutorial is forcing them on for its early lessons (G.forceButtons, Task 6.4) --
    // POWER (not an .atkbtn) is unaffected and always shows during a fight.
    document.body.classList.toggle('show-atk',!!(Save.data.settings.showButtons||this.forceButtons));
    this.positionToast()},
  // Pure function of (viewport w/h, is-a-touch-device) — no window/navigator read of its own — so
  // tests can drive every truth-table cell directly, per the frozen interface. Portrait AND a touch
  // device both have to hold; a desktop window that happens to be taller than it is wide (an odd but
  // legal browser window shape) must never trip the rotate overlay.
  needsRotate(w,h,touch){return !!touch&&h>w},
  // Real touch-device detection, factored out of checkOrientation/initTapLayer so both share one
  // definition of "touch device" and a test can still force either branch via initTapLayer's own
  // optional `touch` param below.
  tapLayerTouch(){return('ontouchstart' in window)||navigator.maxTouchPoints>0},
  // Called from fit() (so both the initial load and every resize re-check) — toggles #rotate via the
  // same G.show(id,on) every other overlay-ish element uses.
  checkOrientation(){this.show('rotate',this.needsRotate(innerWidth,innerHeight,this.tapLayerTouch()))},
  // First-load "TAP TO START" layer over the title (00_head.html's #tap): on a touch device it stays
  // up until the first pointerdown, which both unlocks audio (the same Audio.init() every other
  // first-gesture call site already uses) and hides the layer; on a non-touch device it hides
  // immediately, no gesture required. `touch` is an optional override (auto-detected via
  // tapLayerTouch() when omitted) purely so a test can drive both branches deterministically without
  // needing real touch-event emulation.
  initTapLayer(touch){
    if(touch===undefined)touch=this.tapLayerTouch();
    const tap=document.getElementById('tap');
    if(!touch){tap.classList.remove('show');return}
    tap.classList.add('show');
    tap.addEventListener('pointerdown',()=>{Audio.init();tap.classList.remove('show')},{once:true})},
  // Canvas hit-test for the HUD's pause glyph (drawn by Render.hud at Render.pauseRect), consulted
  // by Input's pointerdown handler before it does any zone/gesture handling.
  hitPause(x,y){const r=Render.pauseRect;return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h},
  // {encounter:'f1_goblin'|{...}} resolves via Encounter.resolve, stores the result on G.encounter
  // (the HUD's floor line reads it), and clones the enemy def here (never inside Fight) so p2's
  // hp/atk carry the encounter's multipliers without mutating the shared DEFS entry.
  //
  // Task 4.4: roster/quest/arena integration. `champ` (default Save.data.active) picks the roster
  // entry whose Stats.derive(hp,atk) overrides p1's def -- o.p1 (a raw DEFS id, used by tests/debug
  // to put a mob/boss in p1) still wins for WHICH def becomes p1 when given; the derive only ever
  // applies when that resolved id is actually owned in the roster (mobs/bosses aren't), matching the
  // Phase 4 ruling "fall back to base stats for non-roster p1 defs".
  //
  // Fix round 1 (controller review): G.mode is 'quest' ONLY when the fight was started through the
  // {floor,node} sugar and its Quest.start actually succeeded -- never for a bare {encounter:ID}.
  // The earlier version labeled a bare encounter id 'quest' too (without spending energy or
  // checking the lock), which meant onFightEnd's Quest.complete/Rewards.grant ran for it on a win --
  // free, unlimited reward/progression farming for anything that repeatedly starts an encounter id
  // (exactly what tests/batch.py's --encounter win-rate sweeps and docs/ARENA.md's --encounter
  // screenshot recipes already do, dozens of times per run). A bare encounter id is 'exhibition' now
  // (no Quest.complete, no rewards, no energy) but still populates G.encounter so the HUD floor line
  // keeps working -- 'arena' remains the explicit o.mode G.startArena() sugar passes.
  startFight(o={}){const seed=o.seed||this.seed;
    this.lastFightOpts=o; // FIGHT AGAIN replays these (minus seed) so a custom p2/ai isn't lost
    let p2def=DEFS[o.p2||'donut'],ai=o.ai||'basic';
    // {floor,node} sugar: node is an index into that floor's .nodes, or the string 'boss' for that
    // floor's boss encounter. Resolved to an encounter id up front so the block below (which already
    // knows how to turn an encounter id into p2def+ai+G.encounter) handles it exactly like a plain
    // o.encounter id, with no separate code path. Fix-wave item 9 (Phase 5 seam): looks the floor up
    // via Quest.floorDef(o.floor) (12_meta.js, by its own .floor field) instead of FLOORS[o.floor-1],
    // so a future tutorial floor 0 doesn't need this renumbered.
    let encSrc=o.encounter;
    if(o.floor!==undefined){
      const fl=Quest.floorDef(o.floor);
      if(!fl)throw new Error('unknown floor: '+o.floor);
      encSrc=o.node==='boss'?fl.boss:fl.nodes[o.node];
      if(!encSrc)throw new Error('unknown floor node: floor '+o.floor+' node '+o.node)}
    // questTarget = {floor,node}, set ONLY by the {floor,node} sugar succeeding through Quest.start
    // (spends 1 energy, checks the node is open) -- a bare o.encounter id never gets one, so it can
    // never drive Quest.complete/Rewards.grant in onFightEnd. A refusal here leaves every G.* fight
    // property (state, fight, encounter, mode, champ) exactly as it was; nothing below has run yet.
    let questTarget=null;
    if(o.floor!==undefined){
      questTarget={floor:o.floor,node:o.node};
      const id=Quest.start(questTarget.floor,questTarget.node);
      if(!id){this.refuseQuest(questTarget.floor,questTarget.node);return false}}
    const mode=o.mode||(questTarget?'quest':'exhibition');
    this.mode=mode;this.questTarget=questTarget;
    if(encSrc){
      // Arena encounters (o.mode==='arena', built by Arena.start() via G.startArena()) arrive
      // already fully resolved -- same {enemy,tier,hpMul,atkMul,buffIds,buffs,boss} shape
      // Encounter.resolve itself produces -- so they're used as-is; routing them back through
      // Encounter.resolve would misread its already-resolved `buffs` (objects) as raw buff ids.
      const enc=mode==='arena'?encSrc:Encounter.resolve(encSrc);
      this.encounter=enc;
      p2def=Object.assign({},enc.enemy,{hp:Math.round(enc.enemy.hp*enc.hpMul),atk:Math.round(enc.enemy.atk*enc.atkMul)});
      ai=enc.tier
    }else this.encounter=null;
    // champ: the roster entry id whose derived stats override p1's hp/atk. o.p1 wins for identity
    // when given (tests/debug putting a mob/boss in p1); otherwise it defaults through champ to the
    // active roster champion.
    const champ=o.champ||o.p1||Save.data.active;
    this.champ=champ;
    let p1def=DEFS[champ];
    const rosterEntry=Save.data.roster[champ];
    // Task 5.2: Sponsors.apply(opts) is computed from a FRESH {playerBuffs:o.playerBuffs} object,
    // never from o itself -- this.lastFightOpts (captured verbatim as `o` right at the top of this
    // function, for FIGHT AGAIN's replay) must stay perk-free, or replaying it would fold every owned
    // perk's playerBuffs/atkMul/parryWindow/viewersMul in a SECOND time on top of Sponsors.apply
    // running again next call. perkOpts.statMul.atk/parryWindow/viewersMul are consumed below;
    // perkOpts.playerBuffs is consumed alongside the encounter's own buffIds a few lines down.
    const perkOpts=Sponsors.apply({playerBuffs:o.playerBuffs});
    if(rosterEntry){const d=Stats.derive(p1def,rosterEntry);
      p1def=Object.assign({},p1def,{hp:d.hp,atk:Math.round(d.atk*perkOpts.statMul.atk)})}
    this.fight=new Fight({seed,p1:p1def,p2:p2def,clock:o.clock,
      ctrl1:o.ctrl1||Ctrl.player(),ctrl2:o.ctrl2||AI.make(ai,seed^0xa5a5),onEvent:(t,a,b,v)=>this.onEvent(t,a,b,v)});
    // Task 5.5: fire-and-forget atlas preload for both looks. Atlas.load itself is the gate -- a
    // no-op Promise.resolve(null) with no fetch at all unless settings.useAtlas/?atlas=1 -- so this
    // call is safe to make unconditionally on every fight, never awaited (never blocks this call or
    // the fight's first render), and its result is never read here: Rig.draw's own short-circuit
    // reads ATLAS[lookId] fresh every frame, once/if the promise settles.
    Atlas.load(this.fight.p1.def.id);Atlas.load(this.fight.p2.def.id);
    // ids, not enc.buffs' resolved objects, so the sim's Buffs.apply does its own resolution instead
    // of trusting a reference that passed through the encounter/presentation layer.
    if(this.encounter&&this.encounter.buffIds&&this.encounter.buffIds.length)Buffs.apply(this.fight,this.fight.p2,this.encounter.buffIds);
    // Fix-wave item 5: player-side buff path (o.playerBuffs — a plain id list, same shape as
    // enc.buffIds above) applied to p1 via the exact same Buffs.apply the encounter/enemy path
    // already uses. Task 5.2: perkOpts.playerBuffs is o.playerBuffs (if any) plus every owned perk's
    // own buff id (e.g. secondWind), so an owned perk applies even when the caller passed no
    // playerBuffs of its own.
    if(perkOpts.playerBuffs.length)Buffs.apply(this.fight,this.fight.p1,perkOpts.playerBuffs);
    // Task 5.2: 'Parry Insurance' widens the live player Fighter's own parry window -- see
    // Fight.detect/Fighter.act's own parryBonus comments (60_fight.js/50_fighter.js) for how it's
    // consumed. Set directly on the just-constructed Fighter (never threaded through Fighter's
    // constructor options), same as every other post-construction fight setup below.
    this.fight.p1.parryBonus=perkOpts.parryWindow;
    // Per-fight camera zoom cap: the worst-case topmost point (any pose, any prop — see Rig.extent)
    // either fighter can strike, scaled by their own def.scale, determines how far in the camera may
    // zoom before that point crosses HUD_LINE. Two ceilings share the same ratio: 1.12 is the normal
    // gameplay cap (matches Fight.tick's own camTarget.zoom clamp), 1.28 the S3 cinematic punch-in —
    // both get clamped down together if a tall-enough pairing needs it, never independently.
    // Fix-wave item 4: this.zoomCap/this.cineZoomCap are kept as-is (same computation, same API) but
    // are now only the per-fight UPPER BOUNDS — tick()'s own per-frame capNow (sized off whichever
    // pose is actually on screen this frame, via Rig.topAt) is what Camera.update actually receives.
    // capNow can never exceed these bounds (the current pose's top is always <= the worst case across
    // every pose), so keeping this calc unchanged is safe and lets every existing test that reads
    // G.zoomCap/G.cineZoomCap keep working unmodified.
    // Fix round 2 (controller review): 'win'/'ko' excluded from this calc specifically — they only
    // ever play under the RESULT overlay once the fight is already over (see G.tick/toResult), not
    // during ordinary play, so a raised-arm win pose (Carl's own included — see the pinning test in
    // 90_tests.js) shouldn't quietly shave every ordinary fight's normal zoom cap below 1.12/1.28.
    // Any overshoot past HUD_LINE during the result screen itself is accepted; the reach test (which
    // cares about a different, always-active concern — EDGE_PAD/the wall clamp) still checks every
    // pose including these two.
    const CAP_EXCL={excludePoses:['win','ko']};
    {const p1ext=Rig.extent(lookFor(this.fight.p1.def),this.fight.p1.def.scale||1,CAP_EXCL);
     const p2ext=Rig.extent(lookFor(this.fight.p2.def),this.fight.p2.def.scale||1,CAP_EXCL);
     const tallestTop=Math.max(p1ext.top,p2ext.top);
     const ratio=(Camera.anchorY-HUD_LINE)/tallestTop;
     this.zoomCap=Math.min(1.12,ratio);this.cineZoomCap=Math.min(1.28,ratio)}
    // Task 5.2: perkOpts.viewersMul (the 'crowd' perk, 1 when unowned) is handed straight to
    // Broadcast.reset -- see its own comment (13_broadcast.js) for why it's stashed there once per
    // fight instead of read live.
    this.cam={x:STAGE_W/2,zoom:1};this.cinemFocus=null;FX.reset();Broadcast.reset({viewersMul:perkOpts.viewersMul});
    Input.q.length=0;Input.held.block=false;Input.held.heavy=false;
    // Fresh throttle window per fight so the opening announcer line always fires immediately,
    // regardless of how recently the previous fight's last toast landed.
    this.frameNow=0;this._sayAt=-999;
    this.state='FIGHT';this.show('title',false);this.show('result',false);this.show('pauseMenu',false);
    // Task 4.5: a fight can be launched from any browsing screen (a map node, arena's FIGHT,
    // exhibition off the title screen) -- hide whichever one is still up so it doesn't linger over
    // the fight underneath.
    if(typeof Screens!=='undefined')Screens.hideAll();
    // Task 5.3: any fight that ISN'T the tutorial must never show a stale prompt left over from a
    // previous tutorial run; G.startTutorial (below) re-shows it on its own very next syncTutorialPrompt
    // call, once G.tick actually starts stepping the sim it just started.
    this.hideTutorialPrompt();
    this.show('btns',true);Audio.announce('start',this.fight.presRng)},
  // Task 5.3: Floor 0. Routes through the exact same G.startFight a real quest node uses --
  // ENCOUNTERS.tutorial resolves like any other encounter id, and since it's never given through the
  // {floor,node} sugar, no Quest.start ever runs -- the tutorial spends no energy, same as any bare
  // o.encounter id. mode:'tutorial' is what G.onEvent/G.tick gate Tutorial's own wiring on, and what
  // G.onFightEnd reads to grant the one-time completion reward instead of Rewards.forNode/
  // Arena.record. ctrl2 defaults to a deterministic Ctrl.tutorialDummy() (30_input.js) rather than
  // AI.make(enc.tier,...) -- the dummy's one scripted medium (step 3's parry prompt needs a real
  // attack to react to) must never depend on rng. playerBuffs folds in BUFFS.noKo (47_buffs.js)
  // through the exact same path fix-wave item 5 already wired for a node's own player-side buffs, so
  // the player can never actually be KO'd mid-lesson with no special case anywhere in Fight/Fighter.
  startTutorial(o={}){
    Tutorial.reset();
    // Fix-wave item 1 (final review, Critical): the tutorial fight now runs with NO clock at all
    // (Fight.finish's time-up branch is unreachable -- Infinity minus STEP every frame never reaches
    // <=0) instead of the default 120s every other fight uses. Completion is decided purely by
    // Tutorial.state.step reaching steps.length (see onFightEnd's own tutorial branch below), never
    // by a timer running out -- an idle/tap-only player who never advances past lesson 2 used to sit
    // there until the clock expired and then be handed the FULL completion grant (gold, free crystal,
    // tutorialDone) having learned exactly one move. Pairs with the per-step stall timer above
    // (Tutorial.STALL_FRAMES/HINTS/FORCE_FRAMES), which is what actually moves a stuck player forward
    // now that the clock can't do it for them.
    const started=this.startFight(Object.assign({},o,{encounter:'tutorial',mode:'tutorial',clock:Infinity,
      ctrl2:o.ctrl2||Ctrl.tutorialDummy(o.seed||1),
      playerBuffs:(o.playerBuffs||[]).concat('noKo')}));
    // Task 5.3: BUFFS.tutorialGuard (47_buffs.js) layered onto the live p2 Fighter directly, outside
    // ENCOUNTERS.tutorial's own frozen `buffs:[]` -- it keeps the dummy from dying to an early light
    // chain before every step is taught, and stops applying itself the instant guardActive is cleared
    // (Tutorial.tick does that the moment its own step counter reaches all-steps-done), so
    // "FINISH HIM" is a real natural KO. guardActive is set true here (release pass: the buff itself
    // no longer reads the global Tutorial object, see BUFFS.tutorialGuard's comment) rather than
    // defaulted true on the Fighter, since it only ever means something for a tutorial's own dummy.
    if(started!==false&&this.fight){
      this.fight.p2.buffs=(this.fight.p2.buffs||[]).concat(BUFFS.tutorialGuard);
      this.fight.p2.guardActive=true;
      // Task 6.4 (controller ruling, Task 6.2): lesson 1 spawns the dummy WITHIN light range (a tap
      // must connect) -- 150px is comfortably inside light1's stepIn-assisted reach (see
      // Fighter.setupDash), unlike the default 320px neutral spawn every other fight starts at.
      this.fight.p2.x=this.fight.p1.x+150;
      // Task 6.4: forces BLOCK/PUNCH/KICK on for lesson 1 (and lesson 2, until Tutorial.tick's own
      // step===2 transition turns it back off) so the "(or tap PUNCH)"/"(or tap KICK)" prompts point
      // at real, visible buttons regardless of the player's own showButtons setting.
      this.forceButtons=true;this.applySettings()}
    return started},
  // Fix-wave item 4: a fighter's current pose's own top (Rig.topAt), scaled by its def.scale — the
  // per-frame counterpart to the per-fight Rig.extent worst-case calc above, read by tick() every
  // frame to build capNow.
  topNow(fighter){
    const{key,t01}=Rig.poseFor(fighter);
    return Rig.topAt(lookFor(fighter.def),key,t01,fighter.def.scale||1)},
  // Throttled announcer display: only updates the toast if at least 90 frames (1.5s) have passed
  // since the last line, so a burst of events can't stomp on each other mid-read. Audio.say remains
  // the unthrottled display primitive this calls into. A no-op while the S3 cinematic is up — the
  // card already reads SPECIAL 3 on-canvas, and the toast element is hidden for the duration anyway
  // (see hideToast/showToast), so there is nothing useful for a line to update.
  // Task 5.4: settings.announcer===false makes every announcer line a no-op -- gated here, the one
  // place Audio.announce (20_audio.js) and G's own direct #toast fallback both already route through,
  // rather than at each Audio.announce call site.
  say(text){if(this.fight&&this.fight.cinematic>0)return;if(!Save.data.settings.announcer)return;
    if(this.frameNow-this._sayAt>=90){this._sayAt=this.frameNow;Audio.say(text)}},
  // Hides the DOM #toast announcer (an absolutely-positioned element outside the canvas, so nothing
  // drawn on-canvas can cover it) for the duration of the S3 cinematic, and cancels Audio.say's
  // pending fade-out timeout so a stale line already on screen (e.g. the opening announcer, whose
  // 2.2s fade can easily still be running by the time an early s3 lands) can't keep showing through,
  // or flash back in, mid-card. showToast restores it once the cinematic ends (G.tick, cinematic hits 0).
  hideToast(){const el=document.getElementById('toast');clearTimeout(Audio._t);el.textContent='';el.classList.add('hidden')},
  showToast(){document.getElementById('toast').classList.remove('hidden')},
  // Per-move sound recipe dispatch + announcer hookup. `a`/`b`/`val` mirror Fight.emit's args.
  // Task 5.1: Broadcast.onEvent is fed first, on every event, unconditionally -- Broadcast itself
  // never reads Audio/FX/DOM (see its own header), so this is the one seam that turns a ratings
  // multiplier window just starting (Broadcast.state.lastPop) into an actual gold FX popup, pushed
  // into the live fight's own fx queue (drained by G.tick -> FX.pushAll, same pipe every hit/parry/
  // combo popup already uses) and immediately cleared so it never re-pops for the rest of that window.
  // Task 5.4: settings.sfx===false makes every sound-effect recipe a no-op. Gated at the CALL SITE
  // (here, checkSpecial, checkCinematicFx) rather than inside Audio.recipes itself (20_audio.js) so a
  // test can stub an individual Audio.recipes.* function and assert it was never invoked when sfx is
  // off -- gating inside the recipe's own body would still call whatever function Audio.recipes.X
  // currently points to (the stub), defeating that kind of test.
  playRecipe(fn){if(Save.data.settings.sfx&&fn)fn()},
  onEvent(t,a,b,val){
    if(this.fight)Broadcast.onEvent(t,a,b,val,this.fight);
    // Task 5.3: Tutorial gets the exact same every-event feed Broadcast does, gated to tutorial mode
    // only (a stray event from some OTHER fight must never touch Tutorial's counters).
    if(this.fight&&this.mode==='tutorial')Tutorial.onEvent(t,a,b,val,this.fight);
    if(Broadcast.state.lastPop){
      const pop=Broadcast.state.lastPop;Broadcast.state.lastPop=null;
      if(this.fight)this.fight.fx.push({kind:'popup',
        x:(this.fight.p1.x+this.fight.p2.x)/2,y:FLOOR-200,text:pop.text,col:'#f4c542',big:true})}
    if(t==='hit'){const mv=MOVES[a.moveName];
      // Multi-hit specials (s1/s2/s3) already got their one full recipe burst from checkSpecial on
      // the moveName transition; each of their landed sub-hits here just gets a light impact thud,
      // not the whole recipe again (that would replay a 3-14 tone burst per sub-hit, overlapping).
      this.playRecipe(mv&&mv.hits>1?Audio.recipes.light1:(Audio.recipes[a.moveName]||Audio.recipes.lights));
      // Streak lines are in the player's own voice ("Carl's fan club just doubled in size"), so they
      // only fire for p1's combos, not a mob/AI p2's.
      if(this.fight&&a===this.fight.p1&&(a.combo===3||a.combo===5||a.combo===10))Audio.announce('streak'+a.combo,this.fight.presRng);
      // Task 5.4: haptics — a short vibration on the frame the PLAYER (p1) is the one who took the
      // hit (b===p1, not a===p1). Guarded by both the settings toggle and navigator.vibrate actually
      // existing (no Vibration API at all on iOS Safari; an unguarded call would throw and take the
      // rest of this handler down with it).
      if(this.fight&&b===this.fight.p1&&Save.data.settings.haptics&&typeof navigator.vibrate==='function')navigator.vibrate(12)}
    else if(t==='block')this.playRecipe(Audio.recipes.block);
    else if(t==='parry'){this.playRecipe(Audio.recipes.parry);Audio.announce('parry',this.fight.presRng)}
    else if(t==='miss'){if(b&&b.state==='DASH')this.playRecipe(Audio.recipes.dash)}
    else if(t==='ko'){this.playRecipe(Audio.recipes.ko);Audio.announce(a.side===1?'win':'loss',this.fight.presRng)}},
  // Arena sugar: draws the next Arena.start() encounter for the current streak and starts it with
  // mode:'arena' (never gated by Quest.start/energy -- Phase 4 ruling 4, "arena costs no energy").
  startArena(o={}){return this.startFight(Object.assign({},o,{encounter:Arena.start(),mode:'arena'}))},
  // A refused Quest.start (energy empty, or the node isn't 'open') writes why into #mapMsg, inside
  // the map panel itself, instead of the old toast-only message -- #toast sat before every overlay
  // in the DOM (fixed in the same item, see 00_head.html) and G.say's 90-frame throttle never
  // advances while browsing (G.frameNow only moves during an active fight), so a second refusal
  // would have been silently swallowed even with the toast visible. Writing #mapMsg directly
  // bypasses both problems: no throttle, and nothing else paints over the map panel while it's up.
  // Reads Quest.floor directly rather than trusting Quest.canStart's single boolean so the message
  // can tell the two refusal reasons apart, and computes the exact time to the next energy point
  // off Energy.now()/e.ts for the "NOT ENOUGH ENERGY" case.
  refuseQuest(floor,node){
    const f=Quest.floor(floor);
    const n=f&&(node==='boss'?f.boss:f.nodes[node]);
    let msg;
    if(!n||n.state!=='open')msg='LOCKED';
    else{
      const e=Save.data.energy;
      const remainMs=Math.max(0,360000-(Energy.now()-e.ts));
      const mm=Math.floor(remainMs/60000),ss=Math.floor((remainMs%60000)/1000);
      msg='NOT ENOUGH ENERGY — next in '+mm+':'+(ss<10?'0':'')+ss}
    const el=document.getElementById('mapMsg');
    if(el)el.textContent=msg},
  // Debug/test-only energy override (mirrors debugPose/debugCinematic's role): lets a harness soak
  // loop that restarts many quest fights in a row (tests/harness.py --sim --floor/--node) top energy
  // up once instead of hitting Quest.start's refusal mid-run. Never called from real gameplay code.
  debugEnergy(n){Save.data.energy.n=n;Save.put()},
  // Debug/test-only currency grant (Task 4.6, mirrors debugEnergy's role): lets tests/harness.py
  // --e2e fund a couple of Crystal.open('basic') calls (500 gold each) deterministically, without
  // threading a whole Rewards.grant-shaped object through a real fight just to seed starting
  // currency. Never called from real gameplay code.
  debugGrant(o){
    if(o.gold)Save.data.gold=(Save.data.gold||0)+o.gold;
    if(o.units)Save.data.units=(Save.data.units||0)+o.units;
    if(o.iso)Save.data.iso=(Save.data.iso||0)+o.iso;
    if(o.cats)for(const c in o.cats)Save.data.cats[c]=(Save.data.cats[c]||0)+o.cats[c];
    Save.put()},
  // Formats a Rewards.grant-shaped object into the #result overlay's reward line, e.g.
  // "+100 G  +20 ISO  +30 XP" -- only the currencies/xp actually present are shown.
  rewardsText(r){
    const parts=[];
    if(r.gold)parts.push('+'+r.gold+' G');
    if(r.iso)parts.push('+'+r.iso+' ISO');
    if(r.xp)parts.push('+'+r.xp+' XP');
    if(r.units)parts.push('+'+r.units+' UNITS');
    return parts.join('  ')},
  // Fix-wave item 8 (final review, Minor): the play URL, in one place so the share card and any
  // future caller stay in sync with README.md's own "Play it now" link.
  PLAY_URL:'javamomma.github.io/Carls-Arena',
  // Task 5.4 (redesigned per fix-wave item 8): an 854x480 offscreen canvas (never attached to the
  // DOM — a share card renders exactly like a screenshot, with no live #wrap/#btns/overlay chrome in
  // it) summarizing the just-finished (or in-progress; nothing here requires f.over) fight. The final
  // review called the original layout thin (portrait/name/peak-viewers/date on flat #090b12, over
  // half the frame empty) for the only artifact players post publicly -- this pass gives it a gold
  // card frame (the HUD's own hpBar/portrait stroke weight and color, not a new style), a dark stage
  // strip behind the portrait (mirrors the in-fight HUD's own portrait-on-dark-stage read), the
  // game's own title glyph up top, a larger PEAK VIEWERS line, and the play URL in small text at the
  // bottom so a screenshot of this card is itself an invitation. Returns a PNG data URL; G.share()
  // (below) is the one real caller, tests/harness.py's --share calls this directly.
  shareCard(){
    const cv=document.createElement('canvas');cv.width=854;cv.height=480;
    const c=cv.getContext('2d');
    const inset=10;
    c.fillStyle='#090b12';c.fillRect(0,0,cv.width,cv.height);
    // Title glyph: the game's own name, bold/gold/black-stroked -- same "condensed FIGHTER wordmark"
    // treatment the in-fight HUD bakes into Render.hudCache().title, redrawn plain here since a
    // share card is built once per click, not once per frame.
    c.textAlign='center';c.textBaseline='alphabetic';c.font='900 26px ui-monospace,monospace';
    c.lineWidth=4;c.strokeStyle='#000';c.strokeText("CARL'S DOORWAY BRAWL",cv.width/2,42);
    c.fillStyle='#f4c542';c.fillText("CARL'S DOORWAY BRAWL",cv.width/2,42);
    // Dark stage strip behind the portrait -- a band darker than the card's own background, the same
    // read as the in-fight HUD's portrait sitting on the dungeon stage rather than flat black.
    const stageY=58,stageH=178;
    c.fillStyle='#05060c';c.fillRect(inset,stageY,cv.width-inset*2,stageH);
    c.strokeStyle='#f4c542';c.lineWidth=1.5;c.strokeRect(inset+.75,stageY+.75,cv.width-inset*2-1.5,stageH-1.5);
    const champId=this.champ||Save.data.active,def=DEFS[champId];
    if(def){
      const portrait=Rig.portrait(lookFor(def)),pw=140,ph=140,px=cv.width/2-pw/2,py=stageY+(stageH-ph)/2;
      c.drawImage(portrait,px,py,pw,ph);
      c.strokeStyle='#f4c542';c.lineWidth=3;c.strokeRect(px+1.5,py+1.5,pw-3,ph-3)}
    c.textAlign='center';c.fillStyle='#fff';c.font='900 26px ui-monospace,monospace';
    c.fillText(def?def.name:'CHAMPION',cv.width/2,stageY+stageH+30);
    // PEAK VIEWERS: the card's own headline stat, sized up from the original pass so it reads as the
    // one number worth sharing, not one line among several the same size.
    c.fillStyle='#f4c542';c.font='900 36px ui-monospace,monospace';
    c.fillText('PEAK VIEWERS '+Render.fmtViewers(Broadcast.state.peak||0),cv.width/2,stageY+stageH+76);
    // floor/boss for a quest fight, streak for an arena one, nothing for a bare exhibition -- mirrors
    // onFightEnd's own mode/questTarget reads just below.
    let prog='';
    if(this.mode==='quest'&&this.questTarget)prog='FLOOR '+this.questTarget.floor+(this.questTarget.node==='boss'?' — BOSS':'');
    else if(this.mode==='arena')prog='STREAK '+(Save.data.arena.streak||0);
    if(prog){c.font='16px ui-monospace,monospace';c.fillStyle='#ccc';c.fillText(prog,cv.width/2,stageY+stageH+104)}
    c.font='12px ui-monospace,monospace';c.fillStyle='#888';
    c.fillText(Meta.today(),cv.width/2,stageY+stageH+128);
    // Play URL, small text near the bottom -- the card is itself an invitation, not just a trophy.
    c.font='11px ui-monospace,monospace';c.fillStyle='#7fb0a8';
    c.fillText(this.PLAY_URL,cv.width/2,cv.height-inset-10);
    // Gold card frame, drawn last so it sits over the strip/stat text edges cleanly -- same stroke
    // color/weight the HUD's own hpBar/portrait frames already use, just once around the whole card.
    c.strokeStyle='#f4c542';c.lineWidth=3;
    if(c.roundRect){c.beginPath();c.roundRect(inset,inset,cv.width-inset*2,cv.height-inset*2,10);c.stroke()}
    else c.strokeRect(inset+1.5,inset+1.5,cv.width-inset*2-3,cv.height-inset*2-3);
    return cv.toDataURL('image/png')},
  // navigator.share({files:[...]}) when the platform supports sharing an actual file (most mobile
  // browsers); otherwise falls back to downloadShareCard's plain <a download> link, which every
  // browser supports unconditionally. Best-effort: any failure along the navigator.share path
  // (including the user cancelling the native share sheet, which rejects the promise) falls back to
  // the download link rather than leaving the player with nothing.
  share(){
    const dataUrl=this.shareCard();
    if(!navigator.share){this.downloadShareCard(dataUrl);return}
    fetch(dataUrl).then(r=>r.blob()).then(blob=>{
      const file=new File([blob],'carls-doorway-brawl.png',{type:'image/png'});
      const shareData={files:[file],title:"CARL'S DOORWAY BRAWL",text:'My run in the dungeon.'};
      if(navigator.canShare&&!navigator.canShare(shareData))return this.downloadShareCard(dataUrl);
      return navigator.share(shareData)}).catch(()=>this.downloadShareCard(dataUrl))},
  downloadShareCard(dataUrl){
    const a=document.createElement('a');a.href=dataUrl;a.download='carls-doorway-brawl.png';
    document.body.appendChild(a);a.click();a.remove()},
  // Called from tick() once the KO slow-mo has fully counted down (fight.slowmo hits 0). Split out
  // of onEvent('ko',...) because the KO event fires synchronously inside the same f.step() that ends
  // the fight, well before slow-mo has had a chance to play; flipping state here on the frame it
  // actually happens (RESULT is set from tick(), not from Fight's own onEvent callback).
  //
  // Task 4.4: the meta/rewards bookkeeping a fight's result feeds back into Save.data, run exactly
  // once per fight (tick()'s own f.over&&f.slowmo<=0 guard only ever reaches this once -- the next
  // tick() call bails out on `this.state!=='FIGHT'`). 'quest' completes the node/boss fought (a win
  // only) and grants that node's Rewards.forNode; 'arena' records the streak; 'exhibition' does
  // neither. G.lastRewards mirrors whatever was granted (null on a loss, or in 'arena'/'exhibition')
  // for tests. Screens.result (arriving in Task 4.5) takes over rendering the overlay once it
  // exists; until then this fills the existing #result DOM directly.
  onFightEnd(won){
    // Fix-wave item 2 (final review, Critical): hides the tutorial's own prompt pill/lesson banner
    // (z-index above .overlay) FIRST, before anything else below -- they used to only get hidden by
    // startFight/toTitle/backToOrigin, never on the RESULT transition itself, so a tutorial win's own
    // VICTORY headline and reward line rendered underneath a stale "FINISH HIM"/"LESSON 4 / 4" pill on
    // the very first result screen a new player ever sees. Harmless (a no-op) for every non-tutorial
    // fight, since the prompt is already hidden outside tutorial mode.
    this.hideTutorialPrompt();
    const winner=this.fight.winner;
    let rewards=null;
    if(this.mode==='quest'&&this.questTarget){
      const{floor,node}=this.questTarget;
      Quest.complete(floor,node,won);
      if(won)rewards=Rewards.forNode(floor,node)
    }else if(this.mode==='arena')Arena.record(won);
    // Fix-wave item 1 (final review, Critical): completion additionally requires every Tutorial step
    // to have actually been taught (state.step reached steps.length) -- won alone is no longer enough.
    // With the tutorial's own clock now removed (G.startTutorial, clock:Infinity) the fight can only
    // ever end in a natural win once guardActive has already been cleared (which itself only happens
    // at steps.length, see Tutorial.tick), so this is belt-and-suspenders for real play; it matters
    // for anything that could still end the fight early (a debug/test hook) without ever completing
    // the lessons -- that must return to the map with no grant, not a partial one.
    else if(this.mode==='tutorial'&&won&&Tutorial.state.step>=Tutorial.steps.length){
      // Task 5.3: completion = a natural win in tutorial mode -- the fight ends on the dummy's real
      // KO (ruling: rejected a forced G.endTutorial()-style finish in favor of the actual player-vs-
      // dummy combat path). Fix-wave item 1 added the explicit state.step>=steps.length guard above
      // (real play always satisfies it alongside `won` anyway -- see that fix's own comment); this
      // comment's ORIGINAL "independent of whether every step was followed" is no longer the whole
      // story, kept historical rather than rewritten.
      // tutorialDone + the one-time 300 gold only ever grant ONCE: Save.data.tutorialDone starts
      // false (Meta.defaults) and this branch is itself guarded on it, so replaying the map's own
      // permanently-open .node.tutorial row can't re-farm the grant. G.tutorialJustGranted (read by
      // Screens.renderResult) records whether THIS particular win is the one that granted it, so a
      // replay still shows the completion line without falsely claiming another +300 gold.
      this.tutorialJustGranted=!Save.data.tutorialDone;
      // Task 6.4: this.tutorialFreeCrystal mirrors tutorialJustGranted's own "only the run that
      // actually granted it" story -- null on a replay (Screens.renderResult reads it to show the
      // pull's own result line only on the win that earned it, and Screens.renderMap reads
      // tutorialJustGranted, not this, to decide whether to pulse DOOR 1). Crystal.open('basic',
      // {free:true}) skips the cost entirely (12_meta.js) -- a fresh save has 0 gold at this point, and
      // the +300 gold grant just below happens in the same branch, so ordering here doesn't matter for
      // affordability either way; free just makes it explicit and immune to a future cost retune.
      this.tutorialFreeCrystal=null;
      if(!Save.data.tutorialDone){
        Save.data.tutorialDone=true;
        Save.data.gold=(Save.data.gold||0)+300;
        Save.put();
        this.tutorialFreeCrystal=Crystal.open('basic',{free:true})}}
    let leveledUp=false;
    if(rewards){
      // Fix round 1: reads this.champ (the champion who actually fought), not Save.data.active --
      // they're normally the same id, but reading champ is the one that's actually correct if they
      // ever diverge (an explicit o.champ different from the active roster pick).
      const entry=Save.data.roster[this.champ];
      const lvlBefore=entry?entry.level:0;
      Rewards.grant(rewards);
      if(entry&&entry.level>lvlBefore)leveledUp=true}
    this.lastRewards=rewards;
    // Task 5.1: peak viewers this fight ever reached (Broadcast tracks it live off fight events;
    // it's only ever reset again at the NEXT G.startFight, so it's still exactly right here, before
    // the result screen or the leaderboard read it). A quest/arena WIN also banks it into
    // Save.data.leaderboard (top 10 by viewers, insert/sort/cap via Meta.recordScore) -- a loss or
    // an exhibition/arena-loss fight still shows PEAK VIEWERS on the result screen, it just never
    // enters the local leaderboard.
    const peakViewers=Broadcast.state.peak;
    if(won&&(this.mode==='quest'||this.mode==='arena')){
      const scoreCtx=this.mode==='quest'?{floor:this.questTarget.floor}:{streak:Save.data.arena.streak};
      Meta.recordScore(Object.assign({viewers:peakViewers,champ:this.champ,
        date:Meta.today()},scoreCtx))}
    this.state='RESULT';
    if(typeof Screens!=='undefined'&&Screens.result)Screens.result(rewards,won,peakViewers);
    else{
      document.getElementById('resultTitle').textContent=won?'VICTORY':'DEFEATED';
      const hpLine=winner.def.name+' wins with '+Math.round(100*winner.hp/winner.maxHp)+'% health.';
      const rewardLine=rewards?(leveledUp?'LEVEL UP!':this.rewardsText(rewards)):'';
      const peakLine='PEAK VIEWERS '+Render.fmtViewers(peakViewers);
      document.getElementById('resultLine').textContent=(rewardLine?hpLine+'  '+rewardLine:hpLine)+'  '+peakLine;
      this.show('result',true);this.show('btns',false)}},
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
  // Task 4.5: browsing (title/map/roster/crystal/shop/arena) all share G.state='TITLE' -- the same
  // generic "not fighting" value togglePause/Input already gate on -- so no new state value is
  // needed; which overlay is actually on screen is Screens' own concern (Screens._current). toTitle
  // always lands on the title screen specifically (tests call this directly and expect exactly
  // that); backToOrigin (below) is the "go back to wherever this fight was launched from" version,
  // used by the pause menu's QUIT and the result overlay's CONTINUE button.
  toTitle(){this.state='TITLE';this.fight=null;this.encounter=null;this.cinemFocus=null;
    this.hideTutorialPrompt();
    // Task 6.4: an unconditional reset, so leaving the tutorial mid-lesson (before Tutorial.tick's own
    // step===2 transition ever turns it back off) can never leave BLOCK/PUNCH/KICK stuck forced-on
    // over some other, later screen or fight. A no-op (still calls applySettings, cheap) when it was
    // already false.
    this.forceButtons=false;this.applySettings();
    if(typeof Screens!=='undefined')Screens.show('title');
    else{this.show('pauseMenu',false);this.show('result',false);this.show('btns',false);this.show('title',true)}},
  backToOrigin(){this.state='TITLE';this.fight=null;this.encounter=null;this.cinemFocus=null;
    this.hideTutorialPrompt();
    this.forceButtons=false;this.applySettings(); // Task 6.4: see toTitle's own comment
    if(typeof Screens!=='undefined')Screens.toOrigin();else this.toTitle()},
  // Fix round 1 (controller review, Critical): the title screen's own buttons only ever get their
  // onclick bound inside Screens.renderTitle(), which only runs when some Screens.* function
  // actually executes -- on a real page load nothing called one (the initial HTML markup already
  // carries #title's 'show' class, so it LOOKED right, but every CAMPAIGN/ARENA/ROSTER/KIOSK/
  // EXHIBITION/SOUND button was dead: .onclick===null). init() now calls this once at boot, after
  // every other binding, so Screens.show('title') runs exactly once with a real DOM and binds them.
  bootScreens(){if(typeof Screens!=='undefined')Screens.show('title')},
  // Steps the sim one tick, handling KO slow-mo (step every 4th tick while fight.slowmo>0) and
  // draining fight.fx into FX after any step. No rAF/wall-clock dependency, so tests can call it
  // directly. G.loop drives this once per accumulated STEP; simFrames/stepFrame delegate to it too.
  // FX and the camera both advance exactly once per call here (never from loop()'s rAF cadence):
  // on a >60Hz display the old rAF-driven update ran FX/camera at double speed and could desync
  // the S3 card's own clock from fight.cinematic. This also means both freeze whenever tick() isn't
  // being called, i.e. while PAUSED (desired) or between --sim harness round trips.
  // Task 4.5: the crystal reveal's 40-frame counter (Screens._reveal) is advanced here,
  // unconditionally, ahead of the FIGHT-only guard below -- this is the one place already called
  // once per real animation frame (via loop()) AND once per harness --sim/simFrames step, with no
  // wall-clock read of its own (G.loop's rAF timestamp only decides how many times to call tick(),
  // never what tick() itself draws), so it's the natural home for a "frame-counted, no Date.now()"
  // animation that has to run whether or not a fight is in progress (crystal-opening never happens
  // mid-fight, but G.state stays 'TITLE' while browsing every Phase 4 screen, same as an idle title).
  tick(){if(typeof Screens!=='undefined'&&Screens.tickReveal)Screens.tickReveal();
    if(this.state!=='FIGHT')return;const f=this.fight;
    if(f.cinematic>0){
      // Sim frozen (Fight.step() itself no-ops while cinematic>0); G is the one counting the 72
      // frames down, one per tick, so FX/Render keep animating around a frozen sim. Input is
      // drained and discarded so nothing queued during the card fires the instant it clears.
      f.cinematic--;this.frameNow=f.frame;Input.drain();
      if(f.cinematic===0){this.cinemFocus=null;this.showToast()}
    }else{
      const pm1=f.p1.moveName,pm2=f.p2.moveName;
      // Fix round 1 (ruling): Broadcast.tick's decay/multiplier-window countdown counts SIM frames,
      // not G.tick() calls -- called only from inside the branch that actually ran f.step(), so the
      // once-every-4th-call KO slow-mo throttle above doesn't also run Broadcast's windows 4x too
      // fast relative to the fight frames they're meant to track.
      if(f.slowmo>0){if(++this._tickN%4===0){f.step();f.slowmo--;Broadcast.tick(f);if(this.mode==='tutorial')Tutorial.tick(f)}}
      else{f.step();Broadcast.tick(f);if(this.mode==='tutorial')Tutorial.tick(f)}
      this.frameNow=f.frame;
      this.checkSpecial(f.p1,pm1);this.checkSpecial(f.p2,pm2);
      this.checkCinematicFx(f);
      this.syncSpecials();
      // Task 5.3: syncs #tutorialPrompt from Tutorial.prompt/._flash every tutorial-mode tick, same
      // per-sim-frame cadence Broadcast.tick/Tutorial.tick above already run at.
      if(this.mode==='tutorial')this.syncTutorialPrompt()}
    FX.pushAll(f.fx);f.fx.length=0;
    const punchIn=f.cinematic>0&&this.cinemFocus?{x:this.cinemFocus.x,zoom:1.28}:null; // fix round 2: 1.6->1.28
    // Fix-wave item 4: per-frame zoom cap sized off the pose(s) actually on screen this tick
    // (Rig.topAt), not the whole fight's worst case (this.zoomCap/this.cineZoomCap, kept above as
    // upper bounds a per-frame value can never exceed — the current pose's top is always <= the
    // worst case across every pose). Normal gameplay caps off the taller of both fighters' CURRENT
    // poses; the cinematic punch-in caps off just the attacker's (this.cinemFocus's) current pose,
    // since that's the only fighter the camera is centering on during the S3 freeze.
    // Task 6.6: the tutorial's own lesson 1 spawns the dummy only 150px away (deliberately, so a tap
    // connects -- see G.startTutorial) which drives the distance-based camTarget.zoom (60_fight.js)
    // right up near its 1.12 ceiling; at that zoom Carl's own head-top screen point lands only ~29px
    // below HUD_LINE, leaving no room at all for #tutorialLesson+#tutorialPrompt (~50px combined)
    // to sit above his head with real clearance -- exactly the "prompt pill 12px above the head"
    // owner-facing bug. A lower gameplay ceiling during Tutorial mode (0.95, still a readable
    // close-up, just not the max) buys back that headroom without touching the shared zoom formula
    // any other mode relies on.
    const gameplayCeil=this.mode==='tutorial'?0.88:1.12;
    const capNow=punchIn
      ?Math.min(1.28,(Camera.anchorY-HUD_LINE)/this.topNow(this.cinemFocus))
      :Math.min(gameplayCeil,(Camera.anchorY-HUD_LINE)/Math.max(this.topNow(f.p1),this.topNow(f.p2)));
    Camera.update(this.cam,f,punchIn,capNow);
    FX.update();
    // f.over flips true inside f.step() the instant a KO/timeout resolves, well before slow-mo has
    // played; f.slowmo (armed to 90 by Fight.finish) is what keeps this branch re-entering FIGHT and
    // counting down every 4th tick above (f.step() itself is a no-op once over, per Fight.step's own
    // guard) instead of bailing out on the very next tick's `if(this.state!=='FIGHT')return`. Only
    // once it hits 0 do we actually leave FIGHT for RESULT.
    if(f.over&&f.slowmo<=0)this.onFightEnd(f.winner.side===1)},
  // Detects a fighter's moveName transitioning into s1/s2/s3 this tick (the sim itself never
  // references Audio/G, so this has to be watched from outside) and plays that special's recipe
  // plus an announcer line. s3 is excluded here: it gets its recipe + announcer line once from
  // checkCinematicFx below, off the 'card' fx event, instead of here off the moveName transition —
  // both fire on the exact same tick, so doing it in both places would double-play the sound.
  checkSpecial(fighter,prevMoveName){const mn=fighter.moveName;
    if(mn&&mn!==prevMoveName&&(mn==='s1'||mn==='s2')){
      this.playRecipe(Audio.recipes[mn]||Audio.recipes.lights);
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
    this.playRecipe(Audio.recipes.s3);
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
  // Task 4.5: the title screen's own buttons (CAMPAIGN/ARENA/ROSTER/KIOSK/EXHIBITION/SOUND) are
  // bound by Screens.title() (85_screens.js, concatenated after this file) every time that screen
  // renders, not here -- 'fightBtn'/the old single-button title no longer exist. 'again'/'resume'
  // stay G's own concern (replaying a fight / unpausing); 'resultTitleBtn' (now labeled CONTINUE)
  // and 'quit' both route back to whichever screen launched the fight via backToOrigin(), which
  // only Screens (loaded after this file) knows how to resolve -- safe to reference here because
  // these callbacks only run on a later click, well after the whole script (including
  // 85_screens.js) has parsed.
  init(){
    // Task 5.4: applySettings() must run BEFORE the first fit() call below — it sets the
    // 'left-handed' body class fit()'s own positionToast() reads to compute the toast's gap.
    this.applySettings();
    this.fit();addEventListener('resize',()=>this.fit());Input.init(canvas);
    // Task 5.4: the first-load "TAP TO START" audio-unlock layer — synchronous (not deferred to the
    // rAF below) so a touch device shows it immediately, with no first-frame flicker of the layer
    // being absent then popping in.
    this.initTapLayer();
    // Reuses the previous fight's full options (p1/p2/ai/ctrl1/ctrl2/encounter/clock), overriding only
    // the seed — previously this passed just {seed,encounter}, silently dropping a custom p2/ai back
    // to the startFight defaults (donut/basic) on every rematch.
    //
    // Fix-wave item 2 (Critical): for arena, this.lastFightOpts.encounter is the ALREADY-RESOLVED
    // Arena.start() object from the fight that just ended (stale enemy/tier/hpMul for the OLD
    // streak) -- replaying it via startFight re-fought the exact same opponent while Arena.record
    // still banked the new streak, an unlimited farm of the easiest matchup off one button. Routing
    // through startArena() instead draws a fresh Arena.start() for the CURRENT streak: it builds
    // Object.assign({},o,{encounter:Arena.start(),mode:'arena'}) internally, so passing it
    // lastFightOpts (still carrying the stale encounter/mode) is safe -- the trailing
    // {encounter,mode} in that assign always wins over whatever o.encounter/o.mode already were.
    // Quest mode is unaffected: it keeps replaying lastFightOpts's {floor,node} sugar directly through
    // startFight below, which re-spends energy and re-checks the lock via the real Quest.start path.
    // Task 6.1 (frozen Phase 6 interface): FIGHT AGAIN is now only ever SHOWN for an exhibition or
    // arena WIN (Screens.renderResult decides visibility) -- quest and tutorial never show it, and
    // neither does an exhibition/arena LOSS. This handler itself stays mode-generic (not gated on
    // won/mode) since it's only ever reachable through a click when the button is actually visible.
    document.getElementById('again').onclick=()=>{
      const opts=Object.assign({},this.lastFightOpts,{seed:this.fight?this.fight.rng.int(1e9)+1:this.seed});
      if(this.mode==='arena')this.startArena(opts);else this.startFight(opts)};
    document.getElementById('resultTitleBtn').onclick=()=>this.backToOrigin();
    // Task 6.1 (owner playtest note: "No way to exit it seems after a defeat"): TITLE is a second,
    // unconditional exit off the result overlay, always visible (Screens.renderResult never hides
    // it), always going straight to the title screen -- independent of Screens._origin, so it can't
    // be defeated by anything wrong with CONTINUE's own origin routing.
    document.getElementById('titleBtn').onclick=()=>this.toTitle();
    // Task 5.4: SHARE (result overlay, static markup, bound once here — same pattern as 'again'/
    // 'resultTitleBtn'/'titleBtn' above, not re-bound per Screens.renderResult() call).
    document.getElementById('shareBtn').onclick=()=>this.share();
    document.getElementById('resume').onclick=()=>this.togglePause();
    document.getElementById('quit').onclick=()=>this.backToOrigin();
    // Unchanged from before Task 4.5 (still the only place that mutates Audio.muted/Save.data.mute);
    // Screens.renderTitle() only syncs this button's label text from that state, never its handler.
    document.getElementById('titleMute').onclick=e=>{Audio.muted=!Audio.muted;Save.data.mute=Audio.muted;Save.put();
      e.target.textContent='SOUND: '+(Audio.muted?'OFF':'ON')};
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='FIGHT')this.togglePause()});
    // bootScreens() must NOT be called synchronously here: init() (and the `G.init();` call below
    // that runs it) executes mid-parse, at the point the script has only gotten through this file --
    // 85_screens.js's `const Screens=...` hasn't run yet, so even `typeof Screens` would still throw
    // (a TDZ reference, not a plain "undefined") and take the whole script down before 90_tests.js's
    // Test.add calls ever ran (fix round 1, Critical: this exact crash, caught by --unit erroring
    // with "Test is not defined" once bootScreens() was first added here directly). Deferred one
    // frame instead, same as every button's onclick already safely is.
    requestAnimationFrame(t=>{this.last=t;this.bootScreens();this.loop(t)})}};
G.init();
