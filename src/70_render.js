const Render={ctx:canvas.getContext('2d'),
  // HUD statics (title glyph, chevron cell masks) never change frame to frame, so they're baked into
  // offscreen canvases once and just drawImage'd every frame instead of re-running the path/gradient/
  // text-shaping work behind strokeText/fillText and the chevron polygon fills. Built lazily on the
  // first Render.frame() call (with or without a live fight) rather than at module-eval time, so a
  // fresh page load pays the cost once, off the hot per-frame path, not on script parse.
  _hudCache:null,
  hudCache(){
    if(this._hudCache)return this._hudCache;
    const mk=(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv};
    // Title: baked at its final on-canvas size/position (W/2,30) with the .82/1.12 condensed
    // squeeze already applied, so the frame draw is a single drawImage at (0,0).
    const title=mk(W,60),tc=title.getContext('2d');
    tc.save();tc.translate(W/2,30);tc.scale(.82,1.12);tc.textAlign='center';tc.lineWidth=4;tc.strokeStyle='#000';
    tc.font='900 24px ui-monospace,monospace';
    // Measured (not eyeballed) so bossPlate can keep clear of the title's actual glyph bounds
    // regardless of font/string changes: in this local (pre-scale) space the centered text spans
    // ±width/2, and the .82 x-scale above carries straight into main-canvas pixels since this
    // offscreen canvas is later drawn at (0,0) unscaled — see bossPlate's own comment.
    const titleRightEdge=W/2+(tc.measureText('FIGHTER').width/2)*.82;
    tc.restore();
    // Release pass (art item 4): a subtle dark plate behind the title with a thin gold outline,
    // matching the rendition's heavier title treatment — drawn BEFORE the text (below it, per the
    // brief's own "behind") in this same offscreen canvas's unscaled/final coordinate space, sized
    // off titleRightEdge above (already computed in final on-canvas pixels — see its own comment)
    // so the plate always hugs the actual glyph width regardless of any future font/string change,
    // the same measurement bossPlate's own clamp already relies on.
    {const halfW=titleRightEdge-W/2,padX=16,plateW=(halfW+padX)*2,plateH=34,plateX=W/2-plateW/2,plateY=12;
      tc.save();tc.fillStyle='rgba(8,9,15,.55)';
      if(tc.roundRect){tc.beginPath();tc.roundRect(plateX,plateY,plateW,plateH,6);tc.fill()}
      else tc.fillRect(plateX,plateY,plateW,plateH);
      tc.strokeStyle='rgba(244,197,66,.7)';tc.lineWidth=1.5;
      if(tc.roundRect){tc.beginPath();tc.roundRect(plateX+.75,plateY+.75,plateW-1.5,plateH-1.5,5.5);tc.stroke()}
      else tc.strokeRect(plateX+.75,plateY+.75,plateW-1.5,plateH-1.5);
      tc.restore()}
    tc.save();tc.translate(W/2,30);tc.scale(.82,1.12);tc.textAlign='center';tc.lineWidth=4;tc.strokeStyle='#000';
    tc.font='900 24px ui-monospace,monospace';
    tc.strokeText('FIGHTER',0,0);tc.fillStyle='#f4c542';tc.fillText('FIGHTER',0,0);tc.restore();
    // Chevron cells: the only thing that varies per frame is how many of the 3 cells are "filled"
    // (0..3), so bake all four variants once instead of rebuilding each skewed polygon path per frame.
    const cellW=90,cellH=14,gap=6,total=cellW*3+gap*2;
    const chevrons=[];
    for(let filled=0;filled<=3;filled++){
      const cv=mk(total,cellH),cc=cv.getContext('2d'),skew=8;
      for(let i=0;i<3;i++){const x=i*(cellW+gap);
        cc.fillStyle=i<filled?'#f4c542':'#26262c';
        cc.beginPath();cc.moveTo(x+skew,0);cc.lineTo(x+cellW,0);cc.lineTo(x+cellW-skew,cellH);cc.lineTo(x,cellH);cc.closePath();
        cc.fill();cc.strokeStyle='#000';cc.lineWidth=1.2;cc.stroke()}
      chevrons.push(cv)}
    return this._hudCache={title,titleRightEdge,chevrons,cellW,cellH,gap,total,
      // Floor line text is rebuilt only when the label string changes (once per fight/encounter, not
      // per frame): cached on a fixed-size canvas keyed by the last label drawn onto it.
      floorCanvas:mk(400,16),floorLabel:null,
      // p1's "LVL n ★★★" sub-label, same cached-canvas-keyed-by-string pattern as floorLine just
      // above; p1SubLabel is the composite string tests assert against instead of reading pixels.
      p1SubCanvas:mk(140,14),p1SubLabel:null,
      // Task 5.1: "VIEWERS 12,340" — same cached-canvas pattern, keyed by the formatted label (so a
      // steady viewer count across frames costs nothing beyond the one drawImage every HUD already
      // pays). Sized 12px tall and drawn with its bottom edge pinned exactly at HUD_LINE (104) so it
      // sits directly under the floor line (80..96) without ever entering the zoom-cap region above it.
      viewersCanvas:mk(200,12),viewersLabel:null}},
  floorLine(c,label){
    const hc=this.hudCache();
    if(hc.floorLabel!==label){
      const fc=hc.floorCanvas.getContext('2d');fc.clearRect(0,0,hc.floorCanvas.width,hc.floorCanvas.height);
      fc.font='11px ui-monospace,monospace';fc.fillStyle='#ccc';fc.textAlign='center';fc.letterSpacing='1px';
      fc.fillText(label,hc.floorCanvas.width/2,12);hc.floorLabel=label}
    c.drawImage(hc.floorCanvas,W/2-hc.floorCanvas.width/2,80)},
  // p1's sub-label under their name: "LVL n" in grey plus a gold ★-per-star string, sized to the
  // roster entry's stars. hud() passes the champion's own level/stars (Save.data.roster[G.champ]);
  // p2 has no roster entry to read so it keeps the plain hardcoded 'LVL 1' hud() already drew.
  p1Sub(c,x,y,level,stars){
    const hc=this.hudCache();
    const label='LVL '+level+' '+'★'.repeat(Math.max(0,stars));
    if(hc.p1SubLabel!==label){
      const cv=hc.p1SubCanvas,sc=cv.getContext('2d');sc.clearRect(0,0,cv.width,cv.height);
      sc.textAlign='left';sc.textBaseline='alphabetic';sc.font='10px ui-monospace,monospace';
      const lvlText='LVL '+level;
      sc.fillStyle='#bbb';sc.fillText(lvlText,0,10);
      const w=sc.measureText(lvlText+' ').width;
      sc.fillStyle='#f4c542';sc.fillText('★'.repeat(Math.max(0,stars)),w,10);
      hc.p1SubLabel=label}
    c.drawImage(hc.p1SubCanvas,x,y-10)},
  // Comma-grouped viewer counts ("12,340"); shared by the HUD counter here and the result/arena
  // screens (85_screens.js, loaded after this file, calls Render.fmtViewers directly).
  fmtViewers(n){return Math.round(n).toLocaleString('en-US')},
  // Task 5.1: the ratings/viewers counter, centered directly under the floor line (drawn at y 80-96;
  // this canvas is 12px tall, drawn at y=92 so its bottom edge lands exactly on HUD_LINE=104 -- never
  // reaching into the region the per-fight zoom cap keeps clear for the fighters themselves). Only
  // redraws its offscreen canvas when the ROUNDED value actually changes (Broadcast.state.viewers
  // drifts by fractional amounts every HITSTUN frame via decay; rounding first means a decay that
  // hasn't yet crossed an integer boundary costs nothing beyond the drawImage every HUD frame pays
  // anyway). The small gold "×N" multiplier badge beside it is cheap enough to just draw live.
  viewersHud(c){
    const hc=this.hudCache(),v=Math.round(Broadcast.state.viewers),label='VIEWERS '+this.fmtViewers(v);
    if(hc.viewersLabel!==label){
      const vc=hc.viewersCanvas,vx=vc.getContext('2d');vx.clearRect(0,0,vc.width,vc.height);
      vx.font='10px ui-monospace,monospace';vx.fillStyle='#f4c542';vx.textAlign='center';vx.letterSpacing='1px';
      // Fix-wave item 7 (final review, Minor look-and-feel #3): the label's own measured width, cached
      // alongside it -- the ×N badge below anchors off THIS (the text's real on-screen extent), not
      // the fixed 200px offscreen canvas it happens to be centered in, which is what let the badge
      // "hang unanchored" well past the visible text for any label shorter than the canvas (i.e.
      // always -- "VIEWERS 12,340" is nowhere near 200px wide at 10px monospace).
      hc.viewersLabelWidth=vx.measureText(label).width;
      vx.fillText(label,vc.width/2,10);hc.viewersLabel=label}
    c.drawImage(hc.viewersCanvas,W/2-hc.viewersCanvas.width/2,92);
    if(Broadcast.state.mult>1){
      c.save();c.font='bold 10px ui-monospace,monospace';c.fillStyle='#f4c542';
      c.textAlign='left';c.textBaseline='alphabetic';
      c.fillText('×'+Broadcast.state.mult,W/2+hc.viewersLabelWidth/2+4,102);
      c.restore()}},
  // Quad looks have no legLen/torsoLen (see LOOKS.donut/grub/mother_rat in 68_rig.js) — hipH+neckLen
  // stands in for legLen+torsoLen as "how tall the body's base is off the ground before the head".
  overlayY(F){const l=lookFor(F.def),h=l.rig==='quad'?(l.hipH+l.neckLen):(l.legLen+l.torsoLen);
    return FLOOR-(h+l.headR*2.4)*(F.def.scale||1)-14},
  // Fix-wave item 1: overlayY above is a WORLD-space estimate of "just above this look's standing
  // head height" — fine for framing the charge bar/block ring under ordinary zoom, but the per-frame
  // camera cap (G.tick's capNow, 80_game.js) is sized off whichever POSE is actually on screen this
  // frame, not this fixed standing estimate, and eases toward it rather than snapping — so a tall
  // rig (Grull/rig:'big') caught mid-transition into CHARGE, with cam.zoom still near the 1.12
  // ceiling from the idle pose just before it, puts overlayY's world point at a screen y well above
  // HUD_LINE (reproduced with `--sim --seconds 4 --encounter f1_grull`: the charge bar sat over "DE"
  // in "THE DEPTHS", docs/shots/p3-floor1-boss.png). Converts overlayY(F) to screen space via the
  // same Camera.toScreen the per-frame zoom-cap test (90_tests.js) already uses, then clamps it to
  // never read closer than `height` (the overlay's own drawn size) + 2px above HUD_LINE — the caller
  // draws in screen space at this clamped y instead of trusting the world-space point.
  overlayScreenY(F,cam,height){
    const sy=Camera.toScreen(cam,F.x,this.overlayY(F)).sy;
    return Math.max(sy,HUD_LINE+height+2)},
  reflection(c,F,cam,frame){c.save();c.beginPath();c.rect(0,FLOOR,STAGE_W,90);c.clip();
    c.translate(0,2*FLOOR);c.scale(1,-1);c.globalAlpha=.12;Rig.draw(c,F,cam,frame,Stage.lightAt(F.x));c.restore()},
  // A grounding contact shadow at the fighter's feet — the mirrored reflection alone reads as a
  // detached ghost. A flattened dark ellipse under the floor art, sized off shoulderW (a stand-in
  // for the character's overall footprint) so bigger/scaled-up looks (the hobgoblin) get a bigger
  // shadow than smaller ones (the goblin) without a dedicated per-look radius.
  // Quad looks have no shoulderW; the brief's own "sized off the footprint" rationale still applies,
  // just off bodyLen (the long axis of a horizontal quadruped body) instead of shoulder width.
  shadow(c,F){const look=lookFor(F.def),scale=F.def.scale||1,
      w=(look.rig==='quad'?look.bodyLen*1.15:look.shoulderW*1.6)*scale;
    c.save();c.globalAlpha=.35;c.fillStyle='#000';
    c.beginPath();c.ellipse(F.x,FLOOR,w/2,w*.16,0,0,Math.PI*2);c.fill();c.restore();
    // Task 8.3: a wet-floor specular streak under the fighter's own feet, tinted/brightened by
    // whichever torch is nearest THIS fighter's x (Stage.lightAt) so the floor reads as reflecting
    // the same torchlight the fighter stands in. streakGeom is a pure function of (F,lit) -- no
    // canvas access -- purely so "the streak follows fighter x" is assertable without a canvas mock.
    const g=this.streakGeom(F,Stage.lightAt(F.x));
    c.save();c.globalAlpha=g.alpha;c.fillStyle=g.tint;
    c.beginPath();c.ellipse(g.x,FLOOR+3,g.w/2,g.w*.09,0,0,Math.PI*2);c.fill();c.restore()},
  // Pure geometry for the specular streak above: {x, w, alpha, tint}. x always equals F.x (the
  // ruling's "follows fighter x"); w scales off the same footprint shadow() sizes off; alpha rides
  // the torch proximity k so a fighter standing right under a torch gets a brighter streak than one
  // out at the fringe.
  streakGeom(F,lit){const look=lookFor(F.def),scale=F.def.scale||1,
      w=(look.rig==='quad'?look.bodyLen*1.15:look.shoulderW*1.6)*scale;
    return{x:F.x,w:w*.7,alpha:.16+.26*lit.k,tint:lit.tint}},
  fighter(c,F,cam,frame){
    const flash=F.state==='HITSTUN'&&F.f<3,lit=Stage.lightAt(F.x);
    if(flash&&'filter'in c){c.save();c.filter='brightness(2)';Rig.draw(c,F,cam,frame,lit);c.filter='none';c.restore()}
    else{Rig.draw(c,F,cam,frame,lit);
      if(flash){c.save();c.globalAlpha=.45;c.fillStyle='#fff';
        c.fillRect(F.x-F.width,FLOOR-140*(F.def.scale||1),F.width*2,140*(F.def.scale||1));c.restore()}}
    // Fix-wave item 1: both above-the-head overlays now draw in SCREEN space (this function runs
    // inside Render.frame's still-applied camera transform; c.save/setTransform(identity)/c.restore
    // scopes the reset to just this one draw) at overlayScreenY's clamped y, so neither can ever
    // cross HUD_LINE regardless of the live camera zoom — see overlayScreenY's own comment above.
    if(F.state==='CHARGE'&&F.move){
      const sx=Camera.toScreen(cam,F.x,0).sx,sy=this.overlayScreenY(F,cam,6);
      c.save();c.setTransform(1,0,0,1,0,0);
      c.fillStyle='#222';c.fillRect(sx-20,sy,40,6);
      c.fillStyle='#fa4';c.fillRect(sx-20,sy,40*Math.min(1,F.f/F.move.charge),6);
      c.restore()}
    if(F.state==='BLOCK'||F.state==='BLOCKSTUN'){
      const sx=Camera.toScreen(cam,F.x,0).sx,sy=this.overlayScreenY(F,cam,6);
      c.save();c.setTransform(1,0,0,1,0,0);
      c.fillStyle='#8cf';c.beginPath();c.arc(sx,sy+3,6,0,Math.PI*2);c.fill();
      c.restore()}},
  // Pause glyph rect in canvas space; G.hitPause tests pointerdown against this same rect, and
  // pauseGlyph below draws to it, so hit-test and visual stay in lockstep with a single source.
  pauseRect:{x:W/2-18,y:38,w:36,h:24},
  // Release pass (art item 4): both HP bars used to be a plain rectangle with a flat black stroke.
  // The rendition tapers each bar's INNER edge (the one toward the title/center, away from that
  // side's own portrait) to a point at vertical center, like a ribbon/pennant, framed in gold rather
  // than black. barPath traces that shape (or a plain rect when no bevel side is given, so any other
  // caller that never passes one keeps the old rectangular hit/measure shape exactly); hpBar/
  // hpBarGrad clip their fills to it and stroke it in gold, but never change the (x,y,w,h) box itself
  // — bossPlate/buffBadges/the "n / maxHp" text all still key off the same p1barX/p2barX/barW/barH
  // hud() already computed, so no layout number any test pins moves.
  barPath(c,x,y,w,h,bevel){
    const skew=14;
    c.beginPath();
    if(bevel==='right'){ // p1: tapers toward the title (the bar's right/inner edge)
      c.moveTo(x,y);c.lineTo(x+w-skew,y);c.lineTo(x+w,y+h/2);c.lineTo(x+w-skew,y+h);c.lineTo(x,y+h)}
    else if(bevel==='left'){ // p2: tapers toward the title (the bar's left/inner edge)
      c.moveTo(x+w,y);c.lineTo(x+skew,y);c.lineTo(x,y+h/2);c.lineTo(x+skew,y+h);c.lineTo(x+w,y+h)}
    else c.rect(x,y,w,h);
    c.closePath()},
  hpBar(c,x,y,w,h,pct,col,bevel){
    this.barPath(c,x,y,w,h,bevel);c.save();c.clip();
    c.fillStyle='#1a1a1a';c.fillRect(x,y,w,h);
    c.fillStyle=col;c.fillRect(x,y,w*clamp(pct,0,1),h);
    c.restore();
    this.barPath(c,x,y,w,h,bevel);c.strokeStyle='#f4c542';c.lineWidth=1.75;c.stroke()},
  // p2's fill drains from the bar's right edge (matches "right" in the rendition) and is a
  // red(low)->orange(full) gradient across the filled span, not a flat color like p1's green.
  hpBarGrad(c,x,y,w,h,pct,bevel){
    this.barPath(c,x,y,w,h,bevel);c.save();c.clip();
    c.fillStyle='#1a1a1a';c.fillRect(x,y,w,h);
    const fw=w*clamp(pct,0,1),fx=x+w-fw;
    if(fw>0){const g=c.createLinearGradient(fx,0,fx+fw,0);g.addColorStop(0,'#c62828');g.addColorStop(1,'#ffa726');
      c.fillStyle=g;c.fillRect(fx,y,fw,h)}
    c.restore();
    this.barPath(c,x,y,w,h,bevel);c.strokeStyle='#f4c542';c.lineWidth=1.75;c.stroke()},
  // 1-letter code per buff id, for the small gold badge squares under the enemy hp bar.
  BUFF_CODES:{regen:'R',armorUp:'A',powerGain:'P',unblockableSpecials:'U',degen:'D',thorns:'T'},
  // buffs is an array of resolved BUFFS objects (from G.encounter.buffs — presentation reads the
  // encounter, never the fight/fighter). Right-aligned under the enemy hp bar, one 12px gold square
  // per buff, stacking leftward so it never grows off the bar's left edge.
  buffBadges(c,barX,barY,barW,buffs){
    const size=12,gap=4,y=barY+4;
    c.textAlign='center';c.textBaseline='middle';c.font='bold 8px ui-monospace,monospace';
    buffs.forEach((b,i)=>{
      const bx=barX+barW-size-i*(size+gap);
      c.fillStyle='#f4c542';c.fillRect(bx,y,size,size);
      c.strokeStyle='#000';c.lineWidth=1;c.strokeRect(bx+.5,y+.5,size-1,size-1);
      c.fillStyle='#000';c.fillText(this.BUFF_CODES[b.id]||'?',bx+size/2,y+size/2+1)})},
  // Task 7.1: 1-letter code per timed effect id, for effectBadges below (a separate row from
  // buffBadges above -- buffBadges only ever reads G.encounter.buffs, the static per-encounter list;
  // this reads a live fighter's own fighter.effects, which either fighter can carry and which changes
  // stack/duration frame to frame).
  // Task 7.3: 'D' for dexterity, added the same way every other EFFECTS id got a code here -- the
  // badge draw call below already falls back to '?' for an unmapped id, so this alone is the only
  // wiring the HUD badge needs.
  EFFECT_CODES:{bleed:'B',stun:'S',armorBreak:'A',fury:'F',powerGain:'P',powerBurn:'X',regen:'R',weakness:'W',dexterity:'D'},
  // One 12px badge per active timed effect on the given fighter: a dark square, a shrinking gold ring
  // traced clockwise from noon (e.left/EFFECTS[e.id].dur, so it empties out exactly as the effect's
  // own duration does), the effect's 1-letter code, and a small stack-count digit in the corner when
  // stacks>1. fromLeft stacks the row rightward from barX (p1, whose bar starts at the left edge) or
  // leftward from barX+barW (p2, mirroring buffBadges' own leftward stacking so it never grows off the
  // bar's own edge). Reads fighter.effects only -- never mutates it, same presentation boundary every
  // other HUD piece in this file already respects (see the frozen "presentation reads fighter.effects,
  // never mutates it" ruling).
  effectBadges(c,barX,barY,barW,effects,fromLeft){
    if(!effects||!effects.length)return;
    const size=12,gap=4,y=barY+4;
    c.textAlign='center';c.textBaseline='middle';c.font='bold 8px ui-monospace,monospace';
    effects.forEach((e,i)=>{
      const bx=fromLeft?barX+i*(size+gap):barX+barW-size-i*(size+gap);
      c.fillStyle='#2a2a2a';c.fillRect(bx,y,size,size);
      c.strokeStyle='#000';c.lineWidth=1;c.strokeRect(bx+.5,y+.5,size-1,size-1);
      const def=EFFECTS[e.id],pct=def?clamp(e.left/def.dur,0,1):0,cx=bx+size/2,cy=y+size/2;
      c.strokeStyle='#f4c542';c.lineWidth=2;
      c.beginPath();c.arc(cx,cy,size/2-1,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);c.stroke();
      c.fillStyle='#fff';c.fillText(this.EFFECT_CODES[e.id]||'?',cx,cy+1);
      if(e.stacks>1){
        c.font='bold 7px ui-monospace,monospace';c.fillStyle='#f4c542';c.textAlign='right';
        c.fillText(String(e.stacks),bx+size,y+size);
        c.font='bold 8px ui-monospace,monospace';c.textAlign='center'}})},
  // Boss name plate: a red-bordered field tight around p2's own name (not the whole HP-bar width),
  // plus a small gold crown glyph immediately to its left. Only drawn when G.encounter.boss (see
  // hud()). Presentation-only (reads G.encounter, never mutates it) — the sim has no notion of
  // "boss", per Phase 3 ruling #4.
  // Fix-wave item 10: was a wide box (HP-bar-width plus 16px) stretching most of the way back toward
  // the FIGHTER title, clamped off the title's own measured right edge so the two didn't visually
  // collide (caab728/8e25ec4) — technically not clipping anymore, but still read as "a wide empty
  // red-outlined box" (final review, look-and-feel note 4), since most of that width was blank. Sized
  // off the name's own measured text width instead (same font the name itself renders in, right-
  // aligned at the same p2barX+barW the name uses, so the box and the text share a right edge exactly)
  // — tight enough around "GRULL"/"MOTHER RAT" that the title-collision clamp is no longer reachable
  // at this HUD's own name-column width and was dropped. Crown moved from a fixed spot over the
  // portrait to directly left of the (now name-sized) plate.
  bossPlate(c,p2x,p2barX,barW,name){
    const savedFont=c.font;c.font='bold 14px ui-monospace,monospace';
    const nameW=c.measureText(name).width;c.font=savedFont;
    const pad=10,plateY=11,plateH=18,rightEdge=p2barX+barW,
      plateW=nameW+pad*2,plateX=rightEdge-plateW;
    c.strokeStyle='#c62828';c.lineWidth=2.5;c.strokeRect(plateX+.5,plateY+.5,plateW-1,plateH-1);
    const cx=plateX-11,cy=plateY+plateH/2,w=8,h=7;
    c.fillStyle='#f4c542';c.strokeStyle='#000';c.lineWidth=1;
    c.beginPath();
    c.moveTo(cx-w,cy+h);c.lineTo(cx-w,cy+h*.2);c.lineTo(cx-w*.5,cy+h*.6);
    c.lineTo(cx,cy-h*.4);c.lineTo(cx+w*.5,cy+h*.6);c.lineTo(cx+w,cy+h*.2);c.lineTo(cx+w,cy+h);
    c.closePath();c.fill();c.stroke()},
  // Task 6.4: the tutorial's own SPAR plate -- replaces p2's entire HP bar area (not just a badge)
  // for as long as p2.guardActive is true, so "the shield state is visible at all times" (a shield
  // glyph plus 'SPAR', in the tutorial's own teal-green, matching .node.tutorial's own palette in
  // 00_head.html) -- see hud() below for the guardActive branch that calls this instead of
  // hpBarGrad/the numeric hp text, and skips this (and draws the real bar) the instant guardActive
  // clears on lesson 4's 'SHIELD DOWN'. x/y/w/h mirror hpBar's own box exactly (never a new layout
  // number), so nothing else in the HUD has to move around it.
  sparPlate(c,x,y,w,h){
    c.save();
    c.fillStyle='#0d1a14';c.fillRect(x,y,w,h);
    c.strokeStyle='#7fd18a';c.lineWidth=1.75;c.strokeRect(x+.75,y+.75,w-1.5,h-1.5);
    const cx=x+22,cy=y+h/2,sw=8,sh=8;
    c.fillStyle='#7fd18a';c.strokeStyle='#000';c.lineWidth=1;
    c.beginPath();
    c.moveTo(cx,cy-sh);c.lineTo(cx+sw,cy-sh*.4);c.lineTo(cx+sw,cy+sh*.3);c.lineTo(cx,cy+sh);
    c.lineTo(cx-sw,cy+sh*.3);c.lineTo(cx-sw,cy-sh*.4);c.closePath();c.fill();c.stroke();
    c.fillStyle='#7fd18a';c.font='bold 13px ui-monospace,monospace';c.textAlign='center';c.textBaseline='middle';
    c.fillText('SPAR',x+w/2+sw,cy);
    c.restore()},
  pauseGlyph(c){const r=this.pauseRect,rr=6;
    c.fillStyle='rgba(0,0,0,.4)';c.strokeStyle='#f4c542';c.lineWidth=1.5;
    c.beginPath();c.moveTo(r.x+rr,r.y);c.lineTo(r.x+r.w-rr,r.y);c.arcTo(r.x+r.w,r.y,r.x+r.w,r.y+rr,rr);
    c.lineTo(r.x+r.w,r.y+r.h-rr);c.arcTo(r.x+r.w,r.y+r.h,r.x+r.w-rr,r.y+r.h,rr);
    c.lineTo(r.x+rr,r.y+r.h);c.arcTo(r.x,r.y+r.h,r.x,r.y+r.h-rr,rr);
    c.lineTo(r.x,r.y+rr);c.arcTo(r.x,r.y,r.x+rr,r.y,rr);c.closePath();c.fill();c.stroke();
    c.fillStyle='#fff';const cx=r.x+r.w/2,cy=r.y+r.h/2,bw=3,bh=12,gap=4;
    c.fillRect(cx-gap-bw,cy-bh/2,bw,bh);c.fillRect(cx+gap,cy-bh/2,bw,bh)},
  // Release pass (art item 4): a faint radial darkening toward the corners -- pure screen-space
  // decoration (no world/HUD coordinates read), cheap enough to rebuild every frame (one
  // createRadialGradient + one fillRect, same cost class as the S3 card's own screen-space draws)
  // rather than needing its own hudCache entry. Fully transparent through the inner ~35% of the
  // frame height so it never touches the HUD bars/portraits near the top edge, only deepens toward
  // the far corners, and tops out at .28 alpha -- "faint", not a stylized dark frame.
  vignette(c){
    const g=c.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.78);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.28)');
    c.save();c.fillStyle=g;c.fillRect(0,0,W,H);c.restore()},
  combo(c,x,y,text,deg,col,align){
    c.save();c.translate(x,y);c.rotate(D(deg));c.textAlign=align;c.textBaseline='alphabetic';
    c.font='900 26px ui-monospace,monospace';c.lineWidth=3;c.strokeStyle='#000';c.strokeText(text,0,0);
    c.fillStyle=col;c.fillText(text,0,0);c.restore()},
  // Three chevron cells, filled from p1's power (the rendition shows one power bar for the player,
  // not a per-side pair), one cell per 100 power toward the POWER_MAX of 300. Draws whichever of the
  // 4 baked fill-level variants (0..3) matches, instead of rebuilding the polygon paths every frame.
  chevrons(c,power){
    const hc=this.hudCache(),filled=Math.min(3,Math.floor(power/100));
    c.drawImage(hc.chevrons[filled],W/2-hc.total/2,H-24)},
  hud(c,f){const a=f.p1,b=f.p2;
    // Portraits + numeric hp bars: p1 left (green), p2 right (red->orange, drains from the right).
    const p1x=18,p2x=W-74,barW=300,barH=18,p1barX=84,p2barX=W-74-10-barW;
    c.drawImage(Rig.portrait(a.def.look),p1x,14,56,56);c.drawImage(Rig.portrait(b.def.look),p2x,14,56,56);
    c.strokeStyle='#f4c542';c.lineWidth=2;c.strokeRect(p1x+1,15,54,54);c.strokeRect(p2x+1,15,54,54);
    c.textBaseline='alphabetic';
    c.font='bold 14px ui-monospace,monospace';c.textAlign='left';c.fillStyle='#fff';c.fillText(a.def.name,p1barX,25);
    {const entry=Save.data.roster[G.champ];this.p1Sub(c,p1barX,39,entry?entry.level:1,entry?entry.stars:1)}
    c.font='bold 14px ui-monospace,monospace';c.textAlign='right';c.fillStyle='#fff';c.fillText(b.def.name,p2barX+barW,25);
    // Task 6.4: while p2.guardActive (the tutorial's dummy, every lesson until 'SHIELD DOWN'), the
    // sub-label under the name reads 'TRAINING DUMMY — CANNOT BE KO'D' instead of the plain 'LVL 1' —
    // the shield's own presentation always trumps the level line, never shown together.
    // Fix-wave item 9 (final review, Minor): 9px non-bold at low contrast against the SPAR plate read
    // as near-illegible at phone size -- bumped to 11px bold with a thin dark stroke first (the same
    // stroke-then-fill technique glyphAt above already uses for readability over a busy background),
    // plus a brighter fill so it reads as the important "you can't lose this" cue it is, not filler.
    if(b.guardActive){c.font='bold 11px ui-monospace,monospace';
      c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.7)';c.strokeText('TRAINING DUMMY — CANNOT BE KO\'D',p2barX+barW,39);
      c.fillStyle='#a0f0b0';c.fillText('TRAINING DUMMY — CANNOT BE KO\'D',p2barX+barW,39)}
    else{c.font='10px ui-monospace,monospace';c.fillStyle='#bbb';c.fillText('LVL 1',p2barX+barW,39)}
    if(G.encounter&&G.encounter.boss)this.bossPlate(c,p2x,p2barX,barW,b.def.name);
    this.hpBar(c,p1barX,48,barW,barH,a.hp/a.maxHp,'#4caf22','right');
    // Task 6.4: the SPAR plate REPLACES p2's whole HP bar area (glyph+'SPAR', sparPlate above) while
    // guardActive -- the real numeric bar/text only return once the shield actually clears (lesson 4's
    // 'SHIELD DOWN'), so a first-time player is never shown a fake/frozen enemy hp reading mid-lesson.
    if(b.guardActive)this.sparPlate(c,p2barX,48,barW,barH);
    else this.hpBarGrad(c,p2barX,48,barW,barH,b.hp/b.maxHp,'left');
    if(G.encounter&&G.encounter.buffs&&G.encounter.buffs.length)this.buffBadges(c,p2barX,48+barH,barW,G.encounter.buffs);
    // Task 7.1: per-fighter timed-effect badges. p1 gets its own row right under its bar (it never had
    // a buffBadges row -- that one's always been p2/encounter-only); p2's row sits one badge-height+gap
    // below its buffBadges row so an encounter buff and a landed effect never overlap.
    this.effectBadges(c,p1barX,48+barH,barW,a.effects,true);
    this.effectBadges(c,p2barX,48+barH+16,barW,b.effects,false);
    c.font='bold 12px ui-monospace,monospace';c.fillStyle='#fff';c.textAlign='center';
    c.fillText(Math.max(0,Math.round(a.hp))+' / '+a.maxHp,p1barX+barW/2,48+barH-4);
    if(!b.guardActive)c.fillText(Math.max(0,Math.round(b.hp))+' / '+b.maxHp,p2barX+barW/2,48+barH-4);
    // Title (a horizontal squeeze approximates a condensed face without loading a web font) + pause.
    // Baked into an offscreen canvas by hudCache(): it never changes, so this is one drawImage.
    c.drawImage(this.hudCache().title,0,0);
    this.pauseGlyph(c);
    // Floor line: reads G.encounter (a plain fight without one shows an exhibition label instead).
    // floorLine() only redraws its offscreen text when the label string itself changes.
    this.floorLine(c,G.encounter?(G.encounter.floor!=null?('FLOOR '+G.encounter.floor+' • '+G.encounter.name):G.encounter.name):'EXHIBITION • DOORWAY');
    this.viewersHud(c);
    if(a.combo>1)this.combo(c,56,190,a.combo+' HITS',-6,'#f4c542','left');
    if(b.combo>1)this.combo(c,W-56,190,b.combo+' HITS',6,'#f66','right');
    this.chevrons(c,a.power);
    if(f.over){c.textAlign='center';c.fillStyle='#fff';c.font='bold 40px ui-monospace,monospace';c.fillText('K.O.',W/2,H/2)}},
  frame(f){const c=this.ctx,cam=G.cam||{x:STAGE_W/2,zoom:1},fr=f?f.frame:0;
    this.hudCache(); // built once, before any HUD draw so it's ready whether or not f/hud runs this call
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
    Camera.apply(c,cam);
    // Task 7.4: shake offsets the already-applied camera transform: translate by (screen px)/zoom
    // so the kick reads as `FX.shake` screen pixels regardless of zoom level. FX.shake is now a
    // directional {x,y} vector (the attacker's own facing kicks x, see 72_fx.js's push()/update())
    // rather than a randomly-seeded omnidirectional jitter angle, so this reads straight off it --
    // still fully deterministic (no RNG/Math.random at all now), so --sim screenshots stay
    // reproducible frame for frame.
    if(Math.abs(FX.shake.x)>0.05||Math.abs(FX.shake.y)>0.05)
      c.translate(FX.shake.x/cam.zoom,FX.shake.y/cam.zoom);
    // Task 8.3: floor 2 ("THE SEWERS") gets its own palette; everything else (floor 1's "DOORWAY"
    // and exhibition mode, which has no G.encounter at all) keeps the original dungeon theme.
    Stage.draw(c,cam,fr,Stage.build(G.encounter&&G.encounter.floor===2?'sewers':'doorway'));
    if(f){
      this.reflection(c,f.p1,cam,fr);this.reflection(c,f.p2,cam,fr);
      this.shadow(c,f.p1);this.shadow(c,f.p2);
      this.fighter(c,f.p1,cam,fr);this.fighter(c,f.p2,cam,fr)}
    FX.draw(c,cam,fr);
    c.setTransform(1,0,0,1,0,0);
    if(FX.flash>0){c.globalAlpha=Math.min(1,FX.flash/6);c.fillStyle='#fff';c.fillRect(0,0,W,H);c.globalAlpha=1}
    // Release pass (art item 4): a faint vignette over the game scene, screen-space so it never
    // shifts with camera zoom/shake -- drawn here (after the scene/flash, before the HUD) so it
    // frames the fight itself without ever darkening the HUD text/bars on top of it.
    this.vignette(c);
    if(f)this.hud(c,f);
    // S3 cinematic card: drawn last, in screen space (transform already reset above), so it sits
    // over the HUD and is immune to camera zoom/shake.
    FX.drawScreen(c,fr)}};
