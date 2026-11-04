// The off-by-default switch for the 3D fighters: until it's on, the page requests no 3D file and opens no WebGL context.
const Gate3D={
  state:'off', // off, loading, ready or failed
  lost:false,
  queryOn(search){return /(?:^|[?&])3d=1(?:&|$)/.test(search)},
  wanted(){return !!(Save.data&&Save.data.settings&&Save.data.settings.fighters3d)||this.queryOn(location.search)},
  active(){return this.state==='ready'&&!this.lost&&this.wanted()},
  // Called whenever the setting may have changed, so flipping it never needs a reload.
  sync(){
    if(this.wanted())this.load();
    if(this.state==='ready')Render3D.show(this.active())},
  // three.js logs a console error when it can't get a context, so the context is opened here first and handed over.
  load(){
    if(this.state!=='off')return;
    const cv=document.createElement('canvas');
    let gl=null;
    try{gl=cv.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true,stencil:false,powerPreference:'high-performance'})}catch(e){}
    if(!gl){this.state='failed';return}
    this.state='loading';
    const add=(src,next)=>{
      const s=document.createElement('script');s.src=src;
      s.onload=next;s.onerror=()=>{this.state='failed'};
      document.head.appendChild(s)};
    add('three.min.js',()=>add('render3d.js',()=>{
      try{Render3D.init(cv,gl);this.state='ready';this.sync()}
      catch(e){console.warn('3D fighters off: '+e.message);this.state='failed'}}))},
  handles(F){return this.active()&&Render3D.supports(lookFor(F.def).id)},
  overlay(){return this.active()?Render3D.top:null},
  fit(){if(this.state==='ready')Render3D.fit()},
  // A renderer fault must cost the player the preview, never the fight.
  frame(f,cam){
    if(!this.active())return;
    try{Render3D.frame(f,cam)}
    catch(e){console.warn('3D fighters off: '+e.message);this.state='failed';Render3D.show(false)}}};
