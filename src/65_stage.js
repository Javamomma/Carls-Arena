// Parallax dungeon stage + follow camera. Pure presentation: reads Fight/Fighter state, never writes it.
// Task 8.3: two stage themes (floor 1's DOORWAY, floor 2's THE SEWERS) share every shape this file
// draws -- the arch, banners, chains, barrels, torches -- and differ only in a handful of base
// colors pulled from PALETTES below. 'doorway' keeps the exact stops the Phase 8 art pass already
// tuned; 'sewers' shifts the same stops toward a damp green-grey so floor 2 reads as a different
// place without a second geometry pass.
const PALETTES={
  doorway:{wallTop:'#3a4258',wallBottom:'#181d2c',blockBase:[58,66,86],
    floorTop:'#232838',floorBottom:'#0c0e16',haze:'rgba(70,80,110,.5)'},
  sewers:{wallTop:'#2e3a30',wallBottom:'#12190f',blockBase:[46,64,48],
    floorTop:'#1c2a20',floorBottom:'#08120a',haze:'rgba(60,90,70,.5)'}};
const Stage={cache:{},
  // Torch key light, warm; blended with this cool ambient the further a point sits from every torch
  // (see lightAt/_mix below) -- matching the rendition's warm-key/cool-ambient torchlit read.
  TORCH_TINT:'#ffb060',AMBIENT_TINT:'#232c42',
  _mix(a,b,t){
    t=clamp(t,0,1);
    const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);
    const ar=(pa>>16)&255,ag=(pa>>8)&255,ab=pa&255,br=(pb>>16)&255,bg=(pb>>8)&255,bb=pb&255;
    const m=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
    return'#'+m(ar+(br-ar)*t)+m(ag+(bg-ag)*t)+m(ab+(bb-ab)*t)},
  build(themeId){
    if(this.cache[themeId])return this.cache[themeId];
    const pal=PALETTES[themeId]||PALETTES.doorway;
    const r=RNG(0xd00d),H0=FLOOR+80,cx=STAGE_W/2;
    const mk=()=>{const cv=document.createElement('canvas');cv.width=STAGE_W;cv.height=H0;return cv};
    // torches kept close to center so they stay on screen across the camera's zoom range (1.0-1.28,
    // fix round 2: gameplay caps at 1.12, the S3 cinematic punch-in at 1.28). Each carries its own
    // build-time flicker seed (Task 8.3) -- a fresh RNG(seed^frame) per torch per frame is a pure,
    // side-effect-free function of (seed,frame), so lightAt can reproduce any frame's flicker
    // exactly without consuming a shared mutable RNG stream (which would make the result depend on
    // how many times/what order lightAt happened to be called that frame).
    const torches=[{x:cx-150,y:225,flicker:r.int(0x7fffffff)},{x:cx+150,y:225,flicker:r.int(0x7fffffff)},
      {x:cx-255,y:235,flicker:r.int(0x7fffffff)},{x:cx+255,y:235,flicker:r.int(0x7fffffff)}];

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
    g=wc.createLinearGradient(0,0,0,H0);g.addColorStop(0,pal.wallTop);g.addColorStop(1,pal.wallBottom);
    wc.fillStyle=g;wc.fillRect(0,0,STAGE_W,H0);
    // stone block coursing with mortar lines and slight per-block jitter
    const bw=58,bh=34,[bb0,bb1,bb2]=pal.blockBase;
    for(let y=0;y<H0;y+=bh){const rowOff=(Math.floor(y/bh)%2)*(bw/2);
      for(let x=-bw;x<STAGE_W+bw;x+=bw){const bx=x+rowOff;
        const j=r.int(14)-7;wc.fillStyle=`rgb(${bb0+j},${bb1+j},${bb2+j})`;
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
    // hanging chains: start below the camera's visible-top edge at every zoom (worst case ~180 at zoom 1.28)
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

    // ---- layer 2.5: hazy far arches/pillars (Task 8.3, parallax .4) -- a soft extra depth cue that
    // sits between the wall (.45) and the fog (.2), a step closer than the wall so it reads as
    // "one more thing back there" rather than doubling the fog. Baked once at build time (a blur
    // filter cost paid here, never per frame) into its own canvas rather than into `far`'s, so its
    // parallax factor can differ from the fog's.
    const haze=mk(),hz=haze.getContext('2d');
    hz.save();if('filter'in hz)hz.filter='blur(7px)';
    hz.fillStyle=pal.haze;
    for(const dx of[-300,-110,110,300]){hz.beginPath();hz.ellipse(cx+dx,FLOOR-150,26,175,0,0,Math.PI*2);hz.fill()}
    hz.beginPath();hz.moveTo(cx-190,FLOOR+10);hz.quadraticCurveTo(cx-190,FLOOR-260,cx,FLOOR-300);
    hz.quadraticCurveTo(cx+190,FLOOR-260,cx+190,FLOOR+10);hz.lineTo(cx+170,FLOOR+10);
    hz.quadraticCurveTo(cx+170,FLOOR-250,cx,FLOOR-278);hz.quadraticCurveTo(cx-170,FLOOR-250,cx-170,FLOOR+10);hz.closePath();hz.fill();
    hz.restore();

    // ---- layer 3: floor tiles + wet reflective sheen (parallax 1) ----
    const floor=mk(),flc=floor.getContext('2d');
    g=flc.createLinearGradient(0,FLOOR,0,H0);g.addColorStop(0,pal.floorTop);g.addColorStop(1,pal.floorBottom);
    flc.fillStyle=g;flc.fillRect(0,FLOOR,STAGE_W,H0-FLOOR);
    flc.strokeStyle='rgba(8,10,16,.6)';flc.lineWidth=2;
    for(let x=0;x<STAGE_W;x+=70){flc.beginPath();flc.moveTo(x,FLOOR);flc.lineTo(x,H0);flc.stroke()}
    for(let y=FLOOR;y<H0;y+=26){flc.beginPath();flc.moveTo(0,y+.5);flc.lineTo(STAGE_W,y+.5);flc.stroke()}
    g=flc.createLinearGradient(0,FLOOR,0,FLOOR+30);g.addColorStop(0,'rgba(150,175,210,.28)');g.addColorStop(1,'rgba(150,175,210,0)');
    flc.fillStyle=g;flc.fillRect(0,FLOOR,STAGE_W,30);
    for(let i=0;i<40;i++){flc.fillStyle=`rgba(0,0,0,${.15+r.next()*.15})`;flc.beginPath();
      flc.arc(r.next()*STAGE_W,FLOOR+8+r.next()*(H0-FLOOR-8),2+r.next()*4,0,Math.PI*2);flc.fill()}

    const st={layers:[{canvas:far,parallax:.2},{canvas:haze,parallax:.4},{canvas:wall,parallax:.45},
        {canvas:props,parallax:.75},{canvas:floor,parallax:1}],
      torches,floorY:FLOOR};
    return this.cache[themeId]=st},
  // ---- Task 8.3: per-frame torch flicker + Stage.lightAt --------------------------------------
  // `_active` remembers the theme/frame this draw() call last ran for, so lightAt(x) (called once
  // per fighter, right after draw(), by Render.fighter) reads the SAME frame's flicker without
  // recomputing it -- "recomputed only when torch flicker changes the frame's k" from the ruling.
  _active:null,_activeFrame:-1,_litCol:{},
  // A fresh RNG(seed) per (torch,frame) rather than a consumed shared stream: RNG(seed).next() is a
  // pure function of its seed, so this is trivially deterministic and reproducible for a given
  // frame no matter how many times or in what order it's asked for that frame -- exactly what
  // "Stage.lightAt is deterministic for a given frame" needs, without smuggling a stateful presRng
  // cursor through Stage.draw's frozen (c,cam,frame,st) signature. reduceMotion collapses this to
  // the static midpoint (no per-frame variation at all), same gate every other camera-motion fx in
  // 72_fx.js already uses.
  _torchFlicker(t){
    if(Save.data&&Save.data.settings&&Save.data.settings.reduceMotion)return .5;
    return RNG((t.flicker^Math.imul(this._activeFrame,2654435761))>>>0).next()},
  lightAt(x){
    const st=this._active;
    if(!st)return{tint:this.TORCH_TINT,k:.5,rimSide:1};
    // Keyed on column alone: _litCol is reset every draw() call (see below), so within one frame
    // this is a pure memoization of the column->light lookup, and across frames it never accumulates
    // stale entries (a frame-number-keyed cache here would grow without bound over a long session).
    const col=Math.round(x/8)*8,key=col;
    const hit=this._litCol[key];
    if(hit)return hit;
    let best=null,best2=null,bd=Infinity,bd2=Infinity;
    for(const t of st.torches){const d=Math.abs(t.x-col);
      if(d<bd){best2=best;bd2=bd;best=t;bd=d}
      else if(d<bd2){best2=t;bd2=d}}
    if(!best2){best2=best}
    const prox=d=>Math.max(0,1-d/260);
    const k0=prox(bd)*(.78+.30*this._torchFlicker(best)),k1=prox(bd2)*(.78+.30*this._torchFlicker(best2));
    const k=clamp(Math.max(k0,k1),0,1);
    const tint=this._mix(this.AMBIENT_TINT,this.TORCH_TINT,k);
    const rimSide=best.x>=col?1:-1;
    return this._litCol[key]={tint,k,rimSide}},
  // Pure (no canvas access) so "floor falloff never brightens above the base" is directly
  // assertable: for every k in [0,1] this returns an alpha in [0,.35], monotonically non-increasing
  // in k, and is only ever used as a BLACK overlay (draw() above) -- there is no code path that
  // paints a positive-brightness color onto the floor from this function.
  falloffAlpha(k){return Math.max(0,(1-clamp(k,0,1))*.35)},
  draw(c,cam,frame,st){
    // The column cache is only ever valid for the frame it was built for (torch flicker moves k
    // every frame) -- cleared unconditionally here, once per draw() call, rather than left to
    // accumulate a stale entry per (column,frame) pair across a whole session.
    this._litCol={};
    this._active=st;this._activeFrame=frame;
    for(const L of st.layers){const off=(cam.x-STAGE_W/2)*(1-L.parallax);c.drawImage(L.canvas,off,0)}
    // Release pass (art item 4): "one notch warmer" -- every stop pulled toward red/orange and away
    // from the paler yellow-white the fix-wave art pass originally tuned (each channel nudged down,
    // green more than blue so the hue itself shifts warm, not just dims), plus a touch more glow
    // alpha so the warmth actually reads at a glance. Radius/flicker timing unchanged.
    for(let i=0;i<st.torches.length;i++){const t=st.torches[i],flick=((frame*7+i*13)%17)/17,rad=52+12*flick;
      const g=c.createRadialGradient(t.x,t.y,0,t.x,t.y,rad);
      g.addColorStop(0,`rgba(255,185,105,${.66+.25*flick})`);g.addColorStop(.45,`rgba(255,120,45,${.4+.16*flick})`);g.addColorStop(1,'rgba(255,95,25,0)');
      c.fillStyle=g;c.beginPath();c.arc(t.x,t.y,rad,0,Math.PI*2);c.fill();
      c.fillStyle=`rgba(255,${192+Math.floor(20*flick)},130,.95)`;c.beginPath();c.ellipse(t.x,t.y-8-flick*3,4,9+flick*3,0,0,Math.PI*2);c.fill()}
    // Task 8.3: floor falloff -- the strip darkens with distance from the nearest torch (never
    // brightens above the floor's own baked tiles), sampled in coarse columns via the same lightAt
    // this frame will hand the fighters, so the floor and whatever stands on it agree. Fix round 1
    // (reviewer Minor #3): step widened 16px -> 32px; each `lightAt` call here is a real (cached-per-
    // column, but the cache is reset every draw()) nearest-torch search plus two RNG(seed) flicker
    // draws, and at 16px this loop alone was worth ~0.1ms/frame of the perf budget.
    c.save();c.beginPath();c.rect(0,st.floorY,STAGE_W,80);c.clip();
    // Controller ruling (8.3 re-review): 32px, not 96 -- the re-reviewer pixel-sampled a periodic
    // brightness step every 96px on an unobstructed floor row; 32px sits under the floor art's own
    // 26-70px tile granularity and costs ~0.03ms.
    for(let x=-16;x<STAGE_W+16;x+=32){const dark=this.falloffAlpha(this.lightAt(x).k);
      if(dark>0){c.fillStyle=`rgba(0,0,0,${dark})`;c.fillRect(x-16,st.floorY,32,80)}}
    c.restore()}};
const Camera={
  // Anchor moved .62 -> .74 (round 1) -> .90 (fix round 2): at zoom 1.0 a character's SCREEN size
  // is anchor-independent (world px == screen px at zoom 1), so this doesn't cost any of round 1's
  // frame-height win — fighters still fill >55% of frame height at zoom 1.0 (measured; see
  // docs/ARENA.md). What the anchor buys is headroom for zoomed-in poses, where a raised-arm/leaning
  // pose's topmost joint can otherwise land above the HUD bars. Exposed as Camera.anchorY (not just
  // inlined in apply/toScreen) so G's per-fight zoom-cap calc (80_game.js) and its regression test
  // (90_tests.js) read the exact same anchor apply()/toScreen() actually use, instead of a copy that
  // could drift. The floor strip this leaves is thin (~48px at zoom 1) but still reads as a real
  // floor, not a sliver — verified in docs/shots/p2-idle.png.
  anchorY:H*.90,
  // override, when given, replaces fight.camTarget for the lerp (G passes {x:attacker.x,zoom:1.28}
  // while fight.cinematic>0 for the S3 punch-in; Fight itself never knows about this, it only ever
  // exposes camTarget). zoomCap, when given, additionally clamps the target zoom this call lerps
  // toward (not cam.zoom itself, so the lerp still eases smoothly into the capped value) — computed
  // by G per-fight from Rig.extent (see G.startFight) so a tall rig's own topmost joint, across every
  // pose and prop it can strike, never gets zoomed in past where it clears HUD_LINE. Fight/camTarget
  // stay scale-of-the-fighters-agnostic; this is purely a presentation-side clamp, passed in rather
  // than read off a global here so Camera itself stays a pure function of its arguments.
  // Task 7.4 (frozen ruling, exact formula): cam.zoom = min(base*(1+punch), capNow) -- base is the
  // plain camTarget/override zoom (t.zoom) exactly as before this task, `punch` is FX.punch (the
  // presentation-side camera-motion term Fight.resolve's own intercept fx arms, see 72_fx.js), and
  // capNow is the same per-frame zoom cap this function already clamped the plain base target to.
  // Composed BEFORE the .12 lerp below (not applied to cam.zoom directly), so the punch-in still
  // eases in/out smoothly through the same glide every other camera move here already uses, instead
  // of snapping.
  update(cam,f,override,zoomCap){const t=override||f.camTarget;
    const punched=t.zoom*(1+FX.punch);
    const z=zoomCap!==undefined?Math.min(punched,zoomCap):punched;
    cam.x+=(t.x-cam.x)*.12;cam.zoom+=(z-cam.zoom)*.12;
    const half=W/2/cam.zoom;cam.x=clamp(cam.x,half,STAGE_W-half)},
  apply(c,cam){c.setTransform(1,0,0,1,0,0);c.translate(W/2,this.anchorY);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-FLOOR)},
  toScreen(cam,x,y){return{sx:W/2+(x-cam.x)*cam.zoom,sy:this.anchorY+(y-FLOOR)*cam.zoom}}};
