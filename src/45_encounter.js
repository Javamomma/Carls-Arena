// Dungeon encounters: a floor + name + enemy id/tier the HUD reads for the "FLOOR n • NAME" line
// and G.startFight uses to build p2. Pure data lookup; scaling (hpMul/atkMul) is applied by G, not
// here, so Encounter.resolve never mutates a DEFS entry.
const ENCOUNTERS={
  f1_goblin:{floor:1,name:'THE DEPTHS',enemy:'goblin',tier:'basic',hpMul:1,atkMul:1},
  f1_hob:   {floor:1,name:'THE DEPTHS',enemy:'hobgoblin',tier:'brute',hpMul:1,atkMul:1}};
const Encounter={
  resolve(x){
    const o=typeof x==='string'?ENCOUNTERS[x]:x;
    if(!o)throw new Error('unknown encounter: '+x);
    const enemy=typeof o.enemy==='string'?DEFS[o.enemy]:o.enemy;
    if(!enemy)throw new Error('unknown encounter enemy: '+o.enemy);
    return{floor:o.floor,name:o.name,enemy,tier:o.tier,
      hpMul:o.hpMul===undefined?1:o.hpMul,atkMul:o.atkMul===undefined?1:o.atkMul}}};
