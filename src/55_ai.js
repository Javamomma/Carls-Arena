const AI={profiles:{
    dummy:{react:0, attack:0,  block:0,  parry:0, dash:0,  special:0, heavy:0},
    basic:{react:14,attack:.04,block:.5, parry:.1,dash:.02,special:.6, heavy:0},
    brawl:{react:8, attack:.09,block:.65,parry:.3,dash:.04,special:.9, heavy:0},
    brute:{react:18,attack:.06,block:.35,parry:.05,dash:.01,special:.5,heavy:.6}},
  make(profile,seed){if(!AI.profiles[profile])throw new Error('unknown AI profile: '+profile);
    const p=AI.profiles[profile],r=RNG(seed);let hold=0,cd=0,plan=null,hHold=0;
    return{next(fight,me,foe){const it=Ctrl.EMPTY();
      // Heavy charge-hold has to run before the busy() gate below: once startMove('heavy') has put
      // `me` into CHARGE, Fighter.busy() reports true (it only excludes IDLE/BLOCK), so if this
      // returned an empty intent while charging, Fighter.act's CHARGE branch would read intent.heavy
      // as false on the next frame and cancel the charge. Mirrors the block `hold` pattern below,
      // just ahead of the short-circuit that pattern relies on BLOCK not being "busy".
      if(hHold>0){hHold--;it.heavy=true;return it}
      if(me.busy())return it;
      const dist=Math.abs(foe.x-me.x)-me.width;
      // Derived from move data instead of hard-coded: light1.range(70)+20=90 and heavy.range(130)+10
      // =140 reproduce the old flat thresholds for the stock movesets while tracking per-move/per-
      // character overrides (none currently touch .range, but moveDef merges them if one ever does).
      const lightRange=me.moveDef('light1').range+20,heavyRange=me.moveDef('heavy').range+10;
      if(hold>0){hold--;it.block=true;return it}
      if(cd>0)cd--;
      // A timed parry: wait until the foe's hit is 2 frames out, then press block.
      if(plan==='parry'){if(foe.state!=='ATTACK'){plan=null}else if(foe.f>=foe.move.startup-2){plan=null;hold=8+r.int(8);it.block=true;return it}else return it}
      // React to a visible startup (only moves slow enough that an immediate hold is a block, not an accidental parry).
      if(foe.state==='ATTACK'&&foe.f===1&&foe.move.startup>PARRY_WINDOW+2&&r.next()<p.block){
        if(r.next()<p.parry){plan='parry';return it}hold=p.react+r.int(10);it.block=true;return it}
      if(cd===0&&me.power>=100&&r.next()<p.special*STEP){it.special=me.power>=300?3:me.power>=200?2:1;cd=20;return it}
      // Heavy: brute-style profiles favor a slow, telegraphed swing at close range. Held for
      // moveDef('heavy').charge+2 frames total (this frame plus hHold's decrements below) so the
      // sim's CHARGE->ATTACK transition always sees intent.heavy through the whole charge window.
      // p.heavy>0 short-circuits before touching the rng for profiles that don't use it (heavy:0),
      // so dummy/basic/brawl draw the exact same rng sequence as before this behavior existed.
      if(p.heavy>0&&cd===0&&dist<heavyRange&&r.next()<p.heavy){hHold=me.moveDef('heavy').charge+1;it.heavy=true;cd=p.react;return it}
      if(cd===0&&r.next()<p.attack){if(dist<lightRange)it.light=true;else it.medium=true;cd=p.react;return it}
      if(dist<lightRange&&r.next()<p.dash){it.dashBack=true;return it}
      return it}}}};
