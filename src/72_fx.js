// Hit-feel FX: particles, damage popups, camera shake, hit-flash. Pure presentation — it only
// reads the plain event objects Fight.resolve()/finish() queue into fight.fx (which G drains here
// every sim tick via FX.pushAll) and never touches Fight/Fighter state. Spread uses its own seeded
// RNG, keyed off the current fight frame and particle index, never Math.random, so --sim
// screenshots reproduce identically frame for frame.
const FX={list:[],shake:0,flash:0,card:null,shieldDown:null,
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
  reset(){this.list.length=0;this.shake=0;this.flash=0;this.card=null;this.shieldDown=null},
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
      // call sites.
      case'shake':
        if(!Save.data.settings.reduceMotion)this.shake=Math.min(24,this.shake+(ev.amt||0));
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
  pushAll(evs){for(const e of evs)this.push(e)},
  update(){
    for(let i=this.list.length-1;i>=0;i--){const p=this.list[i];p.life++;
      // Task 6.5: dustArc gets the same gravity-arc physics as spark/dust (a low forward sweep that
      // settles back toward the floor, not a straight line) -- see the push() case above.
      if(p.kind==='spark'||p.kind==='dust'||p.kind==='dustArc'){p.x+=p.vx;p.y+=p.vy;p.vy+=0.15}
      if(p.life>=p.max)this.list.splice(i,1)}
    this.shake*=.85;if(this.shake<.05)this.shake=0;
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
