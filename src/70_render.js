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
    tc.font='900 24px ui-monospace,monospace';tc.strokeText('FIGHTER',0,0);tc.fillStyle='#f4c542';tc.fillText('FIGHTER',0,0);tc.restore();
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
    return this._hudCache={title,chevrons,cellW,cellH,gap,total,
      // Floor line text is rebuilt only when the label string changes (once per fight/encounter, not
      // per frame): cached on a fixed-size canvas keyed by the last label drawn onto it.
      floorCanvas:mk(400,16),floorLabel:null}},
  floorLine(c,label){
    const hc=this.hudCache();
    if(hc.floorLabel!==label){
      const fc=hc.floorCanvas.getContext('2d');fc.clearRect(0,0,hc.floorCanvas.width,hc.floorCanvas.height);
      fc.font='11px ui-monospace,monospace';fc.fillStyle='#ccc';fc.textAlign='center';fc.letterSpacing='1px';
      fc.fillText(label,hc.floorCanvas.width/2,12);hc.floorLabel=label}
    c.drawImage(hc.floorCanvas,W/2-hc.floorCanvas.width/2,80)},
  overlayY(F){const l=F.def.look;return FLOOR-(l.legLen+l.torsoLen+l.headR*2.4)*(F.def.scale||1)-14},
  reflection(c,F,cam,frame){c.save();c.beginPath();c.rect(0,FLOOR,STAGE_W,90);c.clip();
    c.translate(0,2*FLOOR);c.scale(1,-1);c.globalAlpha=.18;Rig.draw(c,F,cam,frame);c.restore()},
  fighter(c,F,cam,frame){
    const flash=F.state==='HITSTUN'&&F.f<3;
    if(flash&&'filter'in c){c.save();c.filter='brightness(2)';Rig.draw(c,F,cam,frame);c.filter='none';c.restore()}
    else{Rig.draw(c,F,cam,frame);
      if(flash){c.save();c.globalAlpha=.45;c.fillStyle='#fff';
        c.fillRect(F.x-F.width,FLOOR-140*(F.def.scale||1),F.width*2,140*(F.def.scale||1));c.restore()}}
    if(F.state==='CHARGE'&&F.move){const y=this.overlayY(F);
      c.fillStyle='#222';c.fillRect(F.x-20,y,40,6);
      c.fillStyle='#fa4';c.fillRect(F.x-20,y,40*Math.min(1,F.f/F.move.charge),6)}
    if(F.state==='BLOCK'||F.state==='BLOCKSTUN'){const y=this.overlayY(F);
      c.fillStyle='#8cf';c.beginPath();c.arc(F.x,y+3,6,0,Math.PI*2);c.fill()}},
  // Pause glyph rect in canvas space; G.hitPause tests pointerdown against this same rect, and
  // pauseGlyph below draws to it, so hit-test and visual stay in lockstep with a single source.
  pauseRect:{x:W/2-18,y:38,w:36,h:24},
  hpBar(c,x,y,w,h,pct,col){
    c.fillStyle='#1a1a1a';c.fillRect(x,y,w,h);
    c.fillStyle=col;c.fillRect(x,y,w*clamp(pct,0,1),h);
    c.strokeStyle='#000';c.lineWidth=1.5;c.strokeRect(x+.75,y+.75,w-1.5,h-1.5)},
  // p2's fill drains from the bar's right edge (matches "right" in the rendition) and is a
  // red(low)->orange(full) gradient across the filled span, not a flat color like p1's green.
  hpBarGrad(c,x,y,w,h,pct){
    c.fillStyle='#1a1a1a';c.fillRect(x,y,w,h);
    const fw=w*clamp(pct,0,1),fx=x+w-fw;
    if(fw>0){const g=c.createLinearGradient(fx,0,fx+fw,0);g.addColorStop(0,'#c62828');g.addColorStop(1,'#ffa726');
      c.fillStyle=g;c.fillRect(fx,y,fw,h)}
    c.strokeStyle='#000';c.lineWidth=1.5;c.strokeRect(x+.75,y+.75,w-1.5,h-1.5)},
  pauseGlyph(c){const r=this.pauseRect,rr=6;
    c.fillStyle='rgba(0,0,0,.4)';c.strokeStyle='#f4c542';c.lineWidth=1.5;
    c.beginPath();c.moveTo(r.x+rr,r.y);c.lineTo(r.x+r.w-rr,r.y);c.arcTo(r.x+r.w,r.y,r.x+r.w,r.y+rr,rr);
    c.lineTo(r.x+r.w,r.y+r.h-rr);c.arcTo(r.x+r.w,r.y+r.h,r.x+r.w-rr,r.y+r.h,rr);
    c.lineTo(r.x+rr,r.y+r.h);c.arcTo(r.x,r.y+r.h,r.x,r.y+r.h-rr,rr);
    c.lineTo(r.x,r.y+rr);c.arcTo(r.x,r.y,r.x+rr,r.y,rr);c.closePath();c.fill();c.stroke();
    c.fillStyle='#fff';const cx=r.x+r.w/2,cy=r.y+r.h/2,bw=3,bh=12,gap=4;
    c.fillRect(cx-gap-bw,cy-bh/2,bw,bh);c.fillRect(cx+gap,cy-bh/2,bw,bh)},
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
    try{c.drawImage(Rig.portrait(a.def.look),p1x,14,56,56);c.drawImage(Rig.portrait(b.def.look),p2x,14,56,56)}catch(e){}
    c.strokeStyle='#f4c542';c.lineWidth=2;c.strokeRect(p1x+1,15,54,54);c.strokeRect(p2x+1,15,54,54);
    c.textBaseline='alphabetic';
    c.font='bold 14px ui-monospace,monospace';c.textAlign='left';c.fillStyle='#fff';c.fillText(a.def.name,p1barX,25);
    c.font='10px ui-monospace,monospace';c.fillStyle='#bbb';c.fillText('LVL 1',p1barX,39);
    c.font='bold 14px ui-monospace,monospace';c.textAlign='right';c.fillStyle='#fff';c.fillText(b.def.name,p2barX+barW,25);
    c.font='10px ui-monospace,monospace';c.fillStyle='#bbb';c.fillText('LVL 1',p2barX+barW,39);
    this.hpBar(c,p1barX,48,barW,barH,a.hp/a.maxHp,'#4caf22');
    this.hpBarGrad(c,p2barX,48,barW,barH,b.hp/b.maxHp);
    c.font='bold 12px ui-monospace,monospace';c.fillStyle='#fff';c.textAlign='center';
    c.fillText(Math.max(0,Math.round(a.hp))+' / '+a.maxHp,p1barX+barW/2,48+barH-4);
    c.fillText(Math.max(0,Math.round(b.hp))+' / '+b.maxHp,p2barX+barW/2,48+barH-4);
    // Title (a horizontal squeeze approximates a condensed face without loading a web font) + pause.
    // Baked into an offscreen canvas by hudCache(): it never changes, so this is one drawImage.
    c.drawImage(this.hudCache().title,0,0);
    this.pauseGlyph(c);
    // Floor line: reads G.encounter (a plain fight without one shows an exhibition label instead).
    // floorLine() only redraws its offscreen text when the label string itself changes.
    this.floorLine(c,G.encounter?('FLOOR '+G.encounter.floor+' • '+G.encounter.name):'EXHIBITION • DOORWAY');
    if(a.combo>1)this.combo(c,56,190,a.combo+' HITS',-6,'#f4c542','left');
    if(b.combo>1)this.combo(c,W-56,190,b.combo+' HITS',6,'#f66','right');
    this.chevrons(c,a.power);
    if(f.over){c.textAlign='center';c.fillStyle='#fff';c.font='bold 40px ui-monospace,monospace';c.fillText('K.O.',W/2,H/2)}},
  frame(f){const c=this.ctx,cam=G.cam||{x:STAGE_W/2,zoom:1},fr=f?f.frame:0;
    this.hudCache(); // built once, before any HUD draw so it's ready whether or not f/hud runs this call
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
    Camera.apply(c,cam);
    // Shake offsets the already-applied camera transform: translate by (screen px)/zoom so the
    // jitter reads as `FX.shake` screen pixels regardless of zoom level. Direction is seeded off
    // the fight frame (never Math.random) so --sim screenshots stay reproducible.
    if(FX.shake>0.05){const rng=RNG((fr*211+1)>>>0),ang=rng.next()*Math.PI*2;
      c.translate(Math.cos(ang)*FX.shake/cam.zoom,Math.sin(ang)*FX.shake/cam.zoom)}
    Stage.draw(c,cam,fr,Stage.build('depths'));
    if(f){
      this.reflection(c,f.p1,cam,fr);this.reflection(c,f.p2,cam,fr);
      this.fighter(c,f.p1,cam,fr);this.fighter(c,f.p2,cam,fr)}
    FX.draw(c,cam,fr);
    c.setTransform(1,0,0,1,0,0);
    if(FX.flash>0){c.globalAlpha=Math.min(1,FX.flash/6);c.fillStyle='#fff';c.fillRect(0,0,W,H);c.globalAlpha=1}
    if(f)this.hud(c,f);
    // S3 cinematic card: drawn last, in screen space (transform already reset above), so it sits
    // over the HUD and is immune to camera zoom/shake.
    FX.drawScreen(c,fr)}};
