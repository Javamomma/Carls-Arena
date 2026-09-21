class Fighter{
  constructor(def,side,ctrl){this.def=def;this.side=side;this.face=side;this.ctrl=ctrl;
    this.x=side===1?STAGE_W/2-160:STAGE_W/2+160;this.width=48;this.hp=def.hp;this.maxHp=def.hp;this.power=0;
    this.state='IDLE';this.f=0;this.move=null;this.moveName=null;this.hits=null;this.landed=false;
    this.combo=0;this.stun=0;this.inv=0;this.blockAge=0}
  get front(){return this.x+this.face*this.width/2}
  busy(){return this.state!=='IDLE'&&this.state!=='BLOCK'}
  setState(s,f=0){this.state=s;this.f=f}
  startMove(name){this.move=MOVES[name];this.moveName=name;this.hits=new Set();this.landed=false;
    if(this.move.cost)this.power-=this.move.cost;this.setState(this.move.charge?'CHARGE':'ATTACK')}
  activeSpan(){const m=this.move,n=m.hits||1;return n*m.active+(n-1)*(m.gap||0)}
  phase(){const m=this.move;if(!m||this.state!=='ATTACK')return null;const su=m.startup,act=this.activeSpan();
    return this.f<su?'startup':this.f<su+act?'active':this.f<su+act+m.recovery?'recovery':'done'}
  hitIndex(){const m=this.move,k=this.f-m.startup,span=m.active+(m.gap||0);if(k<0)return-1;const i=Math.floor(k/span);return(k%span)<m.active&&i<(m.hits||1)?i:-1}
  hitbox(){if(this.phase()!=='active')return null;const a=this.front,b=this.front+this.face*this.move.range;return{x0:Math.min(a,b),x1:Math.max(a,b)}}
  hurtbox(){return{x0:this.x-this.width/2,x1:this.x+this.width/2}}
  // Consume one frame of intent. Called before tick().
  act(intent){this.blockAge=intent.block?this.blockAge+1:0;const S=this.state;
    if(S==='IDLE'||S==='BLOCK'){
      if(intent.special&&this.power>=MOVES['s'+intent.special].cost)return this.startMove('s'+intent.special);
      if(intent.dashBack){this.inv=DASH_BACK.inv;return this.setState('DASH')}
      if(intent.medium)return this.startMove('medium');
      if(intent.light)return this.startMove('light1');
      if(intent.heavy)return this.startMove('heavy');
      const want=intent.block?'BLOCK':'IDLE';if(want!==S)this.setState(want)}
    else if(S==='ATTACK'&&this.phase()==='recovery'&&this.move.chain&&this.landed){
      if(intent.light)return this.startMove(this.move.chain);
      if(intent.medium&&this.moveName!=='medium')return this.startMove('medium')}
    else if(S==='CHARGE'&&!intent.heavy){this.move=null;this.moveName=null;this.setState('IDLE')}}
  // Advance one frame of the state machine.
  tick(){this.f++;if(this.inv>0)this.inv--;
    switch(this.state){
      case'CHARGE':if(this.f>=this.move.charge)this.setState('ATTACK');break;
      case'ATTACK':{const m=this.move;if(m.dash&&this.f<=m.startup)this.x+=this.face*m.dash/m.startup;
        if(this.phase()==='done'){this.move=null;this.moveName=null;this.landed=false;this.setState('IDLE')}break}
      case'DASH':this.x-=this.face*DASH_BACK.dist/DASH_BACK.frames;if(this.f>=DASH_BACK.frames)this.setState('IDLE');break;
      case'HITSTUN':case'BLOCKSTUN':case'STUNNED':if(this.f>=this.stun)this.setState('IDLE');break;
      case'KNOCKDOWN':if(this.f>=KNOCKDOWN.frames){this.inv=KNOCKDOWN.inv;this.setState('IDLE')}break}
    this.x=clamp(this.x,this.width/2+8,STAGE_W-this.width/2-8)}}
