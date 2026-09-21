const AI={profiles:{
    dummy:{react:0, attack:0,  block:0,  parry:0, dash:0,  special:0},
    basic:{react:14,attack:.04,block:.5, parry:.1,dash:.02,special:.6},
    brawl:{react:8, attack:.09,block:.65,parry:.3,dash:.04,special:.9}},
  make(profile,seed){const p=AI.profiles[profile]||AI.profiles.basic,r=RNG(seed);let hold=0,cd=0,plan=null;
    return{next(fight,me,foe){const it=Ctrl.EMPTY();if(me.busy())return it;
      const dist=Math.abs(foe.x-me.x)-me.width;
      if(hold>0){hold--;it.block=true;return it}
      if(cd>0)cd--;
      // A timed parry: wait until the foe's hit is 2 frames out, then press block.
      if(plan==='parry'){if(foe.state!=='ATTACK'){plan=null}else if(foe.f>=foe.move.startup-2){plan=null;hold=8+r.int(8);it.block=true;return it}else return it}
      // React to a visible startup (only moves slow enough that an immediate hold is a block, not an accidental parry).
      if(foe.state==='ATTACK'&&foe.f===1&&foe.move.startup>PARRY_WINDOW+2&&r.next()<p.block){
        if(r.next()<p.parry){plan='parry';return it}hold=p.react+r.int(10);it.block=true;return it}
      if(cd===0&&me.power>=100&&r.next()<p.special*STEP){it.special=me.power>=300?3:me.power>=200?2:1;cd=20;return it}
      if(cd===0&&r.next()<p.attack){if(dist<90)it.light=true;else it.medium=true;cd=p.react;return it}
      if(dist<90&&r.next()<p.dash){it.dashBack=true;return it}
      return it}}}};
