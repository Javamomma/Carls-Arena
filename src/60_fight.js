class Fight{
  constructor(o){this.rng=RNG(o.seed||1);this.p1=new Fighter(o.p1,1,o.ctrl1);this.p2=new Fighter(o.p2,-1,o.ctrl2);
    this.frame=0;this.clock=o.clock===undefined?120:o.clock;this.hitstop=0;this.over=false;this.winner=null;this.log=[];this.onEvent=o.onEvent||(()=>{})}
  step(){if(this.over)return;if(this.hitstop>0){this.hitstop--;return}
    this.frame++;this.clock-=STEP;
    const i1=this.p1.ctrl.next(this,this.p1,this.p2),i2=this.p2.ctrl.next(this,this.p2,this.p1);
    this.p1.act(i1);this.p2.act(i2);this.p1.tick();this.p2.tick();this.separate();
    // Detect both sides' hits against the pre-resolve state before applying either, so a true
    // mutual trade lands both instead of the first resolve knocking out the second's hitbox.
    const c1=this.detect(this.p1,this.p2),c2=this.detect(this.p2,this.p1);
    if(c1)this.resolve(c1);if(c2)this.resolve(c2);
    if(this.p2.state==='IDLE'&&this.p2.f>20)this.p1.combo=0;if(this.p1.state==='IDLE'&&this.p1.f>20)this.p2.combo=0;
    if(this.p1.hp<=0||this.p2.hp<=0||this.clock<=0)this.finish()}
  separate(){const a=this.p1,b=this.p2,min=a.width/2+b.width/2+4,d=b.x-a.x;if(d<min){const p=(min-d)/2;a.x-=p;b.x+=p}}
  detect(att,def){const hb=att.hitbox();if(!hb)return null;const idx=att.hitIndex();if(idx<0||att.hits.has(idx))return null;
    const hu=def.hurtbox();if(hb.x1<hu.x0||hb.x0>hu.x1)return null;const m=att.move,last=idx===(m.hits||1)-1;
    if(def.inv>0||def.state==='KNOCKDOWN'||def.state==='KO'||def.state==='WIN')return{type:'miss',att,def,idx};
    const blocking=def.state==='BLOCK'||def.state==='BLOCKSTUN';
    if(blocking&&!m.unblockable){
      if(def.blockAge<=PARRY_WINDOW&&!m.cost)return{type:'parry',att,def,idx};
      return{type:'block',att,def,idx,m}}
    return{type:'hit',att,def,idx,m,last}}
  resolve(r){const{type,att,def,idx}=r;att.hits.add(idx);
    if(type==='miss')return this.emit('miss',att,def,0);
    if(type==='parry'){att.move=null;att.moveName=null;att.stun=PARRY_STUN;att.setState('STUNNED');att.combo=0;def.setState('IDLE');Audio.parry();return this.emit('parry',def,att,0)}
    if(type==='block'){const m=r.m;const chip=Math.round(att.def.atk*m.dmg*CHIP);def.hp=Math.max(0,def.hp-chip);def.stun=m.blockstun;def.setState('BLOCKSTUN');
      def.power=Math.min(POWER_MAX,def.power+m.powTaken);att.landed=true;att.combo=0;def.x+=att.face*m.push*.5;Audio.block();return this.emit('block',att,def,chip)}
    const m=r.m,last=r.last;
    const cls=CLASS_BEATS[att.def.cls]===def.def.cls?CLASS_BONUS:1;
    const dmg=Math.round(att.def.atk*m.dmg*cls*(1-def.def.armor));
    def.hp=Math.max(0,def.hp-dmg);att.landed=true;att.combo++;def.combo=0;
    att.power=Math.min(POWER_MAX,att.power+m.powHit);def.power=Math.min(POWER_MAX,def.power+m.powTaken);
    def.move=null;def.moveName=null;if(m.knockdown&&last)def.setState('KNOCKDOWN');else{def.stun=m.hitstun;def.setState('HITSTUN')}
    if(!m.hits||last)def.x+=att.face*m.push;this.hitstop=HITSTOP;Audio.hit();this.emit('hit',att,def,dmg)}
  finish(){this.over=true;const a=this.p1,b=this.p2;
    this.winner=a.hp<=0?b:b.hp<=0?a:(a.hp/a.maxHp>=b.hp/b.maxHp?a:b);
    a.setState(a===this.winner?'WIN':'KO');b.setState(b===this.winner?'WIN':'KO');Audio.ko();this.emit('ko',this.winner,null,0)}
  emit(type,a,b,val){this.log.push({f:this.frame,type,who:a?a.side:0,val});this.onEvent(type,a,b,val)}}
