const Render={ctx:canvas.getContext('2d'),
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
  // not a per-side pair), one cell per 100 power toward the POWER_MAX of 300.
  chevrons(c,power){
    const cellW=90,cellH=14,gap=6,total=cellW*3+gap*2,x0=W/2-total/2,y=H-24,skew=8;
    for(let i=0;i<3;i++){const x=x0+i*(cellW+gap),filled=power>=100*(i+1);
      c.fillStyle=filled?'#f4c542':'#26262c';
      c.beginPath();c.moveTo(x+skew,y);c.lineTo(x+cellW,y);c.lineTo(x+cellW-skew,y+cellH);c.lineTo(x,y+cellH);c.closePath();
      c.fill();c.strokeStyle='#000';c.lineWidth=1.2;c.stroke()}},
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
    c.save();c.translate(W/2,30);c.scale(.82,1.12);c.textAlign='center';c.lineWidth=4;c.strokeStyle='#000';
    c.font='900 24px ui-monospace,monospace';c.strokeText('FIGHTER',0,0);c.fillStyle='#f4c542';c.fillText('FIGHTER',0,0);c.restore();
    this.pauseGlyph(c);
    // Floor line: reads G.encounter (a plain fight without one shows an exhibition label instead).
    c.font='11px ui-monospace,monospace';c.fillStyle='#ccc';c.textAlign='center';c.letterSpacing='1px';
    c.fillText(G.encounter?('FLOOR '+G.encounter.floor+' • '+G.encounter.name):'EXHIBITION • DOORWAY',W/2,88);
    c.letterSpacing='0px';
    if(a.combo>1)this.combo(c,56,190,a.combo+' HITS',-6,'#f4c542','left');
    if(b.combo>1)this.combo(c,W-56,190,b.combo+' HITS',6,'#f66','right');
    this.chevrons(c,a.power);
    if(f.over){c.textAlign='center';c.fillStyle='#fff';c.font='bold 40px ui-monospace,monospace';c.fillText('K.O.',W/2,H/2)}},
  frame(f){const c=this.ctx,cam=G.cam||{x:STAGE_W/2,zoom:1},fr=f?f.frame:0;
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
    if(f)this.hud(c,f)}};
