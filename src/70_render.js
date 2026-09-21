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
  bar(c,x,y,w,h,pct,col,right){c.fillStyle='#222';c.fillRect(x,y,w,h);c.fillStyle=col;const fw=w*clamp(pct,0,1);c.fillRect(right?x+w-fw:x,y,fw,h)},
  hud(c,f){const a=f.p1,b=f.p2;this.bar(c,20,16,340,18,a.hp/a.maxHp,'#4d4',false);this.bar(c,W-360,16,340,18,b.hp/b.maxHp,'#4d4',true);
    for(let i=0;i<3;i++){this.bar(c,20+i*116,40,108,8,clamp(a.power-100*i,0,100)/100,'#fc3',false);this.bar(c,W-360+i*116,40,108,8,clamp(b.power-100*i,0,100)/100,'#fc3',true)}
    c.fillStyle='#fff';c.font='bold 22px ui-monospace,monospace';c.textAlign='center';c.fillText(String(Math.ceil(Math.max(0,f.clock))),W/2,34);
    c.font='11px ui-monospace,monospace';c.textAlign='left';c.fillText(a.def.name,20,62);c.textAlign='right';c.fillText(b.def.name,W-20,62);
    c.font='bold 20px ui-monospace,monospace';if(a.combo>1){c.textAlign='left';c.fillStyle='#f4c542';c.fillText(a.combo+' HITS',20,110)}
    if(b.combo>1){c.textAlign='right';c.fillStyle='#f66';c.fillText(b.combo+' HITS',W-20,110)}
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
