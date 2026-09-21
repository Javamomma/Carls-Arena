// Parallax dungeon stage + follow camera. Pure presentation: reads Fight/Fighter state, never writes it.
const Stage={cache:{},
  build(themeId){
    if(this.cache[themeId])return this.cache[themeId];
    const r=RNG(0xd00d),H0=FLOOR+80,cx=STAGE_W/2;
    const mk=()=>{const cv=document.createElement('canvas');cv.width=STAGE_W;cv.height=H0;return cv};
    // torches kept close to center so they stay on screen across the camera's zoom range (1.0-1.35)
    const torches=[{x:cx-150,y:225},{x:cx+150,y:225},{x:cx-255,y:235},{x:cx+255,y:235}];

    // ---- layer 0: far fog + lit archway + distant stairs (parallax .2); shows through the wall's arch cutout ----
    const far=mk(),fc=far.getContext('2d');
    let g=fc.createLinearGradient(0,0,0,H0);g.addColorStop(0,'#04050a');g.addColorStop(.55,'#0b0f1c');g.addColorStop(1,'#141a2c');
    fc.fillStyle=g;fc.fillRect(0,0,STAGE_W,H0);
    g=fc.createRadialGradient(cx,FLOOR-60,10,cx,FLOOR-60,260);
    g.addColorStop(0,'rgba(205,218,245,.75)');g.addColorStop(.4,'rgba(140,160,205,.4)');g.addColorStop(1,'rgba(140,160,205,0)');
    fc.fillStyle=g;fc.fillRect(cx-260,FLOOR-320,520,340);
    // distant stairs receding into the fog, alternating tread shade for readability
    for(let i=0;i<8;i++){const w=150-i*15,y=FLOOR-10-i*13,shade=185+i*8;
      fc.fillStyle=`rgba(${shade},${shade+6},${shade+20},${.6-i*.05})`;fc.fillRect(cx-w/2,y,w,9);
      fc.fillStyle=`rgba(${shade-30},${shade-24},${shade-10},${.5-i*.05})`;fc.fillRect(cx-w/2,y+9,w,3)}
    // faint distant pillars flanking the gate
    for(const dx of[-180,180]){fc.fillStyle='rgba(15,18,30,.7)';fc.fillRect(cx+dx-12,FLOOR-220,24,220)}

    // ---- layer 1: back wall, arches, chains, banners, torch sconces (parallax .45) ----
    const wall=mk(),wc=wall.getContext('2d');
    g=wc.createLinearGradient(0,0,0,H0);g.addColorStop(0,'#3a4258');g.addColorStop(1,'#181d2c');
    wc.fillStyle=g;wc.fillRect(0,0,STAGE_W,H0);
    // stone block coursing with mortar lines and slight per-block jitter
    const bw=58,bh=34;
    for(let y=0;y<H0;y+=bh){const rowOff=(Math.floor(y/bh)%2)*(bw/2);
      for(let x=-bw;x<STAGE_W+bw;x+=bw){const bx=x+rowOff;
        const j=r.int(14)-7;wc.fillStyle=`rgb(${58+j},${66+j},${86+j})`;
        wc.fillRect(bx+1,y+1,bw-2,bh-2)}}
    wc.strokeStyle='rgba(10,12,20,.45)';wc.lineWidth=2;
    for(let y=0;y<=H0;y+=bh){wc.beginPath();wc.moveTo(0,y+.5);wc.lineTo(STAGE_W,y+.5);wc.stroke()}
    // central lit archway: a real cutout so the fog+stairs layer behind shows through with true parallax depth
    const aw=280,ah=220,ax=cx-aw/2,ay=FLOOR-ah+40;
    const archPath=()=>{wc.beginPath();wc.moveTo(ax,FLOOR+20);wc.lineTo(ax,ay+70);wc.quadraticCurveTo(ax,ay,cx,ay);
      wc.quadraticCurveTo(ax+aw,ay,ax+aw,ay+70);wc.lineTo(ax+aw,FLOOR+20);wc.closePath()};
    wc.save();archPath();wc.clip();wc.clearRect(ax-4,ay-4,aw+8,FLOOR+24-ay+4);wc.restore();
    wc.save();archPath();wc.strokeStyle='#0e1119';wc.lineWidth=12;wc.stroke();
    wc.strokeStyle='#4a5470';wc.lineWidth=3;wc.stroke();wc.restore();
    // flanking blind arches (recessed niches), tucked close to the main arch so they stay in frame
    for(const dx of[-255,255]){const nx=cx+dx;
      g=wc.createLinearGradient(nx-55,0,nx+55,0);g.addColorStop(0,'#0f121c');g.addColorStop(.5,'#1e2536');g.addColorStop(1,'#0f121c');
      wc.fillStyle=g;wc.beginPath();wc.moveTo(nx-55,FLOOR+10);wc.lineTo(nx-55,FLOOR-130);wc.quadraticCurveTo(nx,FLOOR-180,nx+55,FLOOR-130);
      wc.lineTo(nx+55,FLOOR+10);wc.closePath();wc.fill();
      wc.strokeStyle='#0c0e16';wc.lineWidth=5;wc.stroke()}
    // hanging chains: start below the camera's visible-top edge at every zoom (worst case ~180 at zoom 1.35)
    // so the links are always on screen, with a wall bracket marking the mount point.
    const chainXs=[cx-330,cx-190,cx+190,cx+330,cx-70,cx+70],chainY0=200;
    for(let ci=0;ci<chainXs.length;ci++){const cxs=chainXs[ci],len=90+r.int(60);
      wc.fillStyle='#2a2d38';wc.fillRect(cxs-7,chainY0-9,14,9);
      wc.strokeStyle='#12141c';wc.lineWidth=3;
      for(let y=0;y<len;y+=14){wc.beginPath();wc.ellipse(cxs+((y/14)%2?3:-3),chainY0+y,5,7,0,0,Math.PI*2);wc.stroke()}
      wc.fillStyle='#1c2030';wc.beginPath();wc.arc(cxs,chainY0+len,7,0,Math.PI*2);wc.fill()}
    // banners with pale lettering, hung low enough on the wall to stay in frame across zoom levels
    const banner=(bx,lines)=>{wc.save();wc.translate(bx,175);
      g=wc.createLinearGradient(0,0,0,175);g.addColorStop(0,'#2a1420');g.addColorStop(1,'#170a12');
      wc.fillStyle=g;wc.beginPath();wc.moveTo(-48,0);wc.lineTo(48,0);wc.lineTo(48,150);wc.lineTo(0,175);wc.lineTo(-48,150);wc.closePath();wc.fill();
      wc.strokeStyle='rgba(0,0,0,.5)';wc.lineWidth=2;wc.stroke();
      wc.fillStyle='rgba(216,201,163,.85)';wc.font='bold 13px ui-monospace,monospace';wc.textAlign='center';
      lines.forEach((t,i)=>wc.fillText(t,0,26+i*24));
      wc.restore()};
    banner(cx-330,['DEEPER','STRONGER','SURVIVE']);
    banner(cx+330,['ANOTHER','DAY','ANOTHER','FLOOR']);
    // torch wall sconces (flames are drawn live in draw())
    for(const t of torches){wc.fillStyle='#191b22';wc.fillRect(t.x-4,t.y-6,8,26);wc.fillStyle='#2a2d38';wc.fillRect(t.x-9,t.y+16,18,6)}

    // ---- layer 2: mid props — barrels, crates, skull pile (parallax .75) ----
    const props=mk(),pc=props.getContext('2d');
    const barrel=(x,y,w,h)=>{const g2=pc.createLinearGradient(x-w/2,0,x+w/2,0);g2.addColorStop(0,'#3a2717');g2.addColorStop(.5,'#5c3d22');g2.addColorStop(1,'#2c1c0f');
      pc.fillStyle=g2;pc.beginPath();pc.ellipse(x,y-h,w/2,w*.22,0,0,Math.PI*2);pc.fill();
      pc.fillStyle=g2;pc.fillRect(x-w/2,y-h,w,h);
      pc.beginPath();pc.ellipse(x,y,w/2,w*.22,0,0,Math.PI*2);pc.fill();
      pc.strokeStyle='#171008';pc.lineWidth=3;
      [h*.2,h*.5,h*.8].forEach(oy=>{pc.beginPath();pc.moveTo(x-w/2,y-oy);pc.lineTo(x+w/2,y-oy);pc.stroke()})};
    const crate=(x,y,w,h)=>{const g2=pc.createLinearGradient(x-w/2,y-h,x+w/2,y);g2.addColorStop(0,'#4a3520');g2.addColorStop(1,'#2a1c10');
      pc.fillStyle=g2;pc.fillRect(x-w/2,y-h,w,h);pc.strokeStyle='#18100a';pc.lineWidth=2;pc.strokeRect(x-w/2,y-h,w,h);
      pc.beginPath();pc.moveTo(x-w/2,y-h);pc.lineTo(x+w/2,y);pc.moveTo(x+w/2,y-h);pc.lineTo(x-w/2,y);pc.stroke()};
    const skull=(x,y,s)=>{pc.fillStyle='#d8cdb0';pc.beginPath();pc.ellipse(x,y,s,s*.8,0,0,Math.PI*2);pc.fill();
      pc.fillStyle='#20140f';pc.beginPath();pc.ellipse(x-s*.35,y-s*.05,s*.22,s*.28,0,0,Math.PI*2);pc.ellipse(x+s*.35,y-s*.05,s*.22,s*.28,0,0,Math.PI*2);pc.fill()};
    barrel(cx-430,FLOOR,52,70);barrel(cx-375,FLOOR,46,54);crate(cx-320,FLOOR,60,60);
    barrel(cx+430,FLOOR,52,70);crate(cx+375,FLOOR,58,58);crate(cx+320,FLOOR-2,44,44);
    const skullX=cx-445;for(let i=0;i<5;i++)skull(skullX+r.int(60)-30,FLOOR-4-r.int(10),9+r.int(6));

    // ---- layer 3: floor tiles + wet reflective sheen (parallax 1) ----
    const floor=mk(),flc=floor.getContext('2d');
    g=flc.createLinearGradient(0,FLOOR,0,H0);g.addColorStop(0,'#232838');g.addColorStop(1,'#0c0e16');
    flc.fillStyle=g;flc.fillRect(0,FLOOR,STAGE_W,H0-FLOOR);
    flc.strokeStyle='rgba(8,10,16,.6)';flc.lineWidth=2;
    for(let x=0;x<STAGE_W;x+=70){flc.beginPath();flc.moveTo(x,FLOOR);flc.lineTo(x,H0);flc.stroke()}
    for(let y=FLOOR;y<H0;y+=26){flc.beginPath();flc.moveTo(0,y+.5);flc.lineTo(STAGE_W,y+.5);flc.stroke()}
    g=flc.createLinearGradient(0,FLOOR,0,FLOOR+30);g.addColorStop(0,'rgba(150,175,210,.28)');g.addColorStop(1,'rgba(150,175,210,0)');
    flc.fillStyle=g;flc.fillRect(0,FLOOR,STAGE_W,30);
    for(let i=0;i<40;i++){flc.fillStyle=`rgba(0,0,0,${.15+r.next()*.15})`;flc.beginPath();
      flc.arc(r.next()*STAGE_W,FLOOR+8+r.next()*(H0-FLOOR-8),2+r.next()*4,0,Math.PI*2);flc.fill()}

    const st={layers:[{canvas:far,parallax:.2},{canvas:wall,parallax:.45},{canvas:props,parallax:.75},{canvas:floor,parallax:1}],
      torches,floorY:FLOOR};
    return this.cache[themeId]=st},
  draw(c,cam,frame,st){
    for(const L of st.layers){const off=(cam.x-STAGE_W/2)*(1-L.parallax);c.drawImage(L.canvas,off,0)}
    for(let i=0;i<st.torches.length;i++){const t=st.torches[i],flick=((frame*7+i*13)%17)/17,rad=52+12*flick;
      const g=c.createRadialGradient(t.x,t.y,0,t.x,t.y,rad);
      g.addColorStop(0,`rgba(255,205,130,${.6+.25*flick})`);g.addColorStop(.45,`rgba(255,140,60,${.35+.15*flick})`);g.addColorStop(1,'rgba(255,120,40,0)');
      c.fillStyle=g;c.beginPath();c.arc(t.x,t.y,rad,0,Math.PI*2);c.fill();
      c.fillStyle=`rgba(255,${210+Math.floor(20*flick)},150,.95)`;c.beginPath();c.ellipse(t.x,t.y-8-flick*3,4,9+flick*3,0,0,Math.PI*2);c.fill()}}};
const Camera={
  update(cam,f){const t=f.camTarget;cam.x+=(t.x-cam.x)*.12;cam.zoom+=(t.zoom-cam.zoom)*.12;
    const half=W/2/cam.zoom;cam.x=clamp(cam.x,half,STAGE_W-half)},
  apply(c,cam){c.setTransform(1,0,0,1,0,0);c.translate(W/2,H*.62);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-FLOOR)},
  toScreen(cam,x,y){return{sx:W/2+(x-cam.x)*cam.zoom,sy:H*.62+(y-FLOOR)*cam.zoom}}};
