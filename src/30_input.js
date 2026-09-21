const Ctrl={
  EMPTY:()=>({light:false,medium:false,heavy:false,block:false,dashBack:false,special:0}),
  idle:()=>({next:()=>Ctrl.EMPTY()}),
  hold:intent=>({next:()=>Object.assign(Ctrl.EMPTY(),intent)}),
  // steps: [{f, until?, intent}] in controller frames (frames where next() was called)
  script:steps=>({f:0,next(){const it=Ctrl.EMPTY();for(const s of steps)if(this.f>=s.f&&this.f<=(s.until===undefined?s.f:s.until))Object.assign(it,s.intent);this.f++;return it}}),
  // seeded chaos monkey: picks a plan, holds block/heavy plans for a while, taps others once
  random:seed=>{const r=RNG(seed);let plan='',left=0;return{next(){
    if(left--<=0){plan=r.pick(['','','light','light','medium','dashBack','block','block','heavy','special']);left=plan==='block'?10+r.int(30):plan==='heavy'?30:1}
    const it=Ctrl.EMPTY();if(plan==='block')it.block=true;else if(plan==='heavy')it.heavy=true;else if(plan==='special')it.special=1;else if(plan)it[plan]=true;return it}}}};
