const Render={ctx:canvas.getContext('2d'),
  fighter(c,F){const w=F.width,down=F.state==='KNOCKDOWN'||F.state==='KO',h=down?30:(F.state==='BLOCK'||F.state==='BLOCKSTUN')?110:120,x=F.x-w/2,y=FLOOR-h;
    c.fillStyle=(F.state==='HITSTUN'||F.state==='STUNNED')?'#fff':F.def.color;c.fillRect(x,y,w,h);
    c.fillStyle='#000';c.fillRect(F.x+F.face*10-3,y+18,6,6);
    const hb=F.hitbox();if(hb){c.fillStyle=F.move.cost?'#7ff':'#f66';c.fillRect(hb.x0,FLOOR-90,hb.x1-hb.x0,14)}
    if(F.state==='CHARGE'){c.fillStyle='#fa4';c.fillRect(x,y-10,w*Math.min(1,F.f/F.move.charge),6)}
    if(F.state==='BLOCK'||F.state==='BLOCKSTUN'){c.fillStyle='#8cf';c.fillRect(F.front-(F.face===1?0:4),y,4,h)}
    if(F.inv>0){c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(x-2,y-2,w+4,h+4)}
    if(G.debug){c.strokeStyle='#0f0';c.strokeRect(x,y,w,h)}},
  bar(c,x,y,w,h,pct,col,right){c.fillStyle='#222';c.fillRect(x,y,w,h);c.fillStyle=col;const fw=w*clamp(pct,0,1);c.fillRect(right?x+w-fw:x,y,fw,h)},
  hud(c,f){const a=f.p1,b=f.p2;this.bar(c,20,16,340,18,a.hp/a.maxHp,'#4d4',false);this.bar(c,W-360,16,340,18,b.hp/b.maxHp,'#4d4',true);
    for(let i=0;i<3;i++){this.bar(c,20+i*116,40,108,8,clamp(a.power-100*i,0,100)/100,'#fc3',false);this.bar(c,W-360+i*116,40,108,8,clamp(b.power-100*i,0,100)/100,'#fc3',true)}
    c.fillStyle='#fff';c.font='bold 22px ui-monospace,monospace';c.textAlign='center';c.fillText(String(Math.ceil(Math.max(0,f.clock))),W/2,34);
    c.font='11px ui-monospace,monospace';c.textAlign='left';c.fillText(a.def.name,20,62);c.textAlign='right';c.fillText(b.def.name,W-20,62);
    c.font='bold 20px ui-monospace,monospace';if(a.combo>1){c.textAlign='left';c.fillStyle='#f4c542';c.fillText(a.combo+' HITS',20,110)}
    if(b.combo>1){c.textAlign='right';c.fillStyle='#f66';c.fillText(b.combo+' HITS',W-20,110)}
    if(f.over){c.textAlign='center';c.fillStyle='#fff';c.font='bold 40px ui-monospace,monospace';c.fillText('K.O.',W/2,H/2)}},
  frame(f){const c=this.ctx;c.clearRect(0,0,W,H);c.fillStyle='#1a1f33';c.fillRect(0,0,W,FLOOR);c.fillStyle='#2b2f45';c.fillRect(0,FLOOR,W,H-FLOOR);
    c.fillStyle='#3a2a1a';c.fillRect(W/2-40,FLOOR-200,80,200);c.fillStyle='#090b12';c.fillRect(W/2-30,FLOOR-190,60,190); // the doorway
    if(!f)return;this.fighter(c,f.p1);this.fighter(c,f.p2);this.hud(c,f)}};
