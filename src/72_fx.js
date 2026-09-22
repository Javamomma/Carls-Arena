// Hit-feel FX: particles, damage popups, camera shake, hit-flash. Pure presentation — it only
// reads the plain event objects Fight.resolve()/finish() queue into fight.fx (which G drains here
// every sim tick via FX.pushAll) and never touches Fight/Fighter state. Spread uses its own seeded
// RNG, keyed off the current fight frame and particle index, never Math.random, so --sim
// screenshots reproduce identically frame for frame.
const FX={list:[],shake:0,flash:0,card:null,
  reset(){this.list.length=0;this.shake=0;this.flash=0;this.card=null},
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
      case'popup':
        this.list.push({kind:'popup',x:ev.x,y:ev.y,text:ev.text,col:ev.col||'#fff',big:!!ev.big,life:0,max:40});
        break;
      case'shake':
        this.shake=Math.min(24,this.shake+(ev.amt||0));
        break;
      case'flash':
        this.flash=Math.max(this.flash,ev.frames||0);
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
      if(p.kind==='spark'||p.kind==='dust'){p.x+=p.vx;p.y+=p.vy;p.vy+=0.15}
      if(p.life>=p.max)this.list.splice(i,1)}
    this.shake*=.85;if(this.shake<.05)this.shake=0;
    if(this.flash>0)this.flash--;
    // Card runs on its own clock (advanced only here, from the wall-clock/screenshot render loop),
    // independent of fight.cinematic (G.tick decrements that once per sim tick); both count down
    // from the same 72-frame duration so they empty out together under normal play.
    if(this.card){this.card.t++;if(this.card.t>=this.card.frames)this.card=null}},
  draw(c,cam,frame){
    for(const p of this.list){
      if(p.kind==='spark'){c.globalAlpha=Math.max(0,1-p.life/p.max);c.fillStyle=p.col;c.beginPath();c.arc(p.x,p.y,2.5,0,Math.PI*2);c.fill()}
      else if(p.kind==='dust'){c.globalAlpha=Math.max(0,(1-p.life/p.max)*.5);c.fillStyle=p.col;c.beginPath();c.arc(p.x,p.y,3+p.life*.12,0,Math.PI*2);c.fill()}
      else if(p.kind==='popup'){const t=p.life/p.max;c.globalAlpha=Math.max(0,1-t);c.fillStyle=p.col;
        c.font=(p.big?'bold 26px ':'bold 16px ')+'ui-monospace,monospace';c.textAlign='center';
        c.fillText(p.text,p.x,p.y-t*30)}}
    c.globalAlpha=1},
  // Screen-space overlay for the S3 cinematic card: darken, a diagonal gold band that sweeps in
  // from the left over the first 12 frames, holds, then sweeps out to the right over the last 12.
  // Called by Render.frame AFTER the camera transform is reset and the HUD is drawn, so it always
  // sits on top and is unaffected by camera zoom/shake. Unskippable: purely a function of card.t,
  // which only Fight.checkCinematic (via the 'card' fx push) can (re)start.
  drawScreen(c,frame){
    if(!this.card)return;
    const cd=this.card,t=cd.t,frames=cd.frames,slide=12;
    c.save();c.setTransform(1,0,0,1,0,0);
    c.globalAlpha=.55;c.fillStyle='#000';c.fillRect(0,0,W,H);
    c.globalAlpha=1;
    const enter=Math.min(1,t/slide),exit=t>frames-slide?Math.min(1,(t-(frames-slide))/slide):0;
    const offsetX=-W*(1-enter)+W*exit;
    c.save();c.translate(offsetX,0);c.rotate(-.12);
    c.fillStyle='#f4c542';c.fillRect(-120,H*.28,W+240,H*.3);
    c.strokeStyle='#8a6a12';c.lineWidth=3;c.strokeRect(-120,H*.28,W+240,H*.3);
    c.restore();
    c.save();c.translate(W/2+offsetX,H/2);c.rotate(-.12);
    c.textAlign='center';c.fillStyle='#1a1208';
    c.font='900 34px ui-monospace,monospace';c.fillText(cd.name,0,-6);
    c.font='bold 16px ui-monospace,monospace';c.fillText('SPECIAL 3',0,22);
    c.restore();
    c.restore()}};
