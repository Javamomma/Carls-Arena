// Touch layout (landscape): left third = defense (hold: block, swipe left: dash back);
// right two thirds = offense (tap: light, swipe right: medium, hold >=180ms: heavy until released).
const Input={q:[],held:{block:false,heavy:false},_ptrs:new Map(),DEF_ZONE:W/3,SWIPE:40,HOLD_MS:180,
  init(canvas){
    const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}};
    canvas.addEventListener('pointerdown',e=>{Audio.init();if(G.state==='TITLE')return G.startFight();if(G.state!=='FIGHT')return;
      const p=pos(e),zone=p.x<this.DEF_ZONE?'def':'off';
      for(const rec of this._ptrs.values())if(rec.zone===zone)return; // one active pointer per zone
      this._ptrs.set(e.pointerId,{x0:p.x,t0:performance.now(),zone,moved:false,holdFired:false});
      if(zone==='def')this.held.block=true});
    canvas.addEventListener('pointermove',e=>{const P=this._ptrs.get(e.pointerId);if(!P||P.moved)return;const dx=pos(e).x-P.x0;
      if(Math.abs(dx)>=this.SWIPE){P.moved=true;if(P.zone==='def')this.held.block=false;else this.held.heavy=false;this.q.push(dx>0?'medium':'dashBack')}});
    const up=e=>{const P=this._ptrs.get(e.pointerId);if(!P)return;this._ptrs.delete(e.pointerId);
      if(P.zone==='def')this.held.block=false;
      else{if(!P.moved&&!P.holdFired)this.q.push('light');this.held.heavy=false}};
    canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    for(const n of[1,2,3])document.getElementById('s'+n).addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this.q.push('special'+n)});
    addEventListener('keydown',e=>{if(e.repeat)return;const k=e.key.toLowerCase();
      if(e.code==='Space'&&G.state==='TITLE'){e.preventDefault();return G.startFight()}
      if(k==='p')return G.togglePause();
      if(k==='j')this.q.push('light');if(k==='k')this.q.push('medium');if(k==='a')this.q.push('dashBack');
      if(k==='l')this.held.heavy=true;if(k==='s')this.held.block=true;if(k==='1'||k==='2'||k==='3')this.q.push('special'+k)});
    addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='s')this.held.block=false;if(k==='l')this.held.heavy=false})},
  // Called once per sim frame by Ctrl.player: promotes a long press in the offense zone to a heavy hold.
  tick(){for(const P of this._ptrs.values())if(!P.moved&&P.zone==='off'&&!P.holdFired&&performance.now()-P.t0>=this.HOLD_MS){P.holdFired=true;this.held.heavy=true}},
  drain(){const it={light:false,medium:false,heavy:this.held.heavy,block:this.held.block,dashBack:false,special:0};
    for(const a of this.q){if(a.startsWith('special'))it.special=+a[7];else it[a]=true}this.q.length=0;return it}};

const Ctrl={
  EMPTY:()=>({light:false,medium:false,heavy:false,block:false,dashBack:false,special:0}),
  idle:()=>({next:()=>Ctrl.EMPTY()}),
  player:()=>({next(){Input.tick();return Input.drain()}}),
  hold:intent=>({next:()=>Object.assign(Ctrl.EMPTY(),intent)}),
  // steps: [{f, until?, intent}] in controller frames (frames where next() was called)
  script:steps=>({f:0,next(){const it=Ctrl.EMPTY();for(const s of steps)if(this.f>=s.f&&this.f<=(s.until===undefined?s.f:s.until))Object.assign(it,s.intent);this.f++;return it}}),
  // seeded chaos monkey: picks a plan, holds block/heavy plans for a while, taps others once
  random:seed=>{const r=RNG(seed);let plan='',left=0;return{next(){
    if(left--<=0){plan=r.pick(['','','light','light','medium','dashBack','block','block','heavy','special']);left=plan==='block'?10+r.int(30):plan==='heavy'?30:1}
    const it=Ctrl.EMPTY();if(plan==='block')it.block=true;else if(plan==='heavy')it.heavy=true;else if(plan==='special')it.special=1;else if(plan)it[plan]=true;return it}}}};
