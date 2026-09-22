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
    const buffIds=o.buffs||[];
    // enc.buffs is resolved BUFFS objects, for the HUD to read (badge codes come off b.id); enc.buffIds
    // is the raw id list, kept alongside so G.startFight can hand ids (not encounter/presentation-side
    // objects) to Buffs.apply, which does its own independent resolution.
    const buffs=buffIds.map(id=>{if(!BUFFS[id])throw new Error('unknown buff: '+id);return BUFFS[id]});
    return{floor:o.floor,name:o.name,enemy,tier:o.tier,
      hpMul:o.hpMul===undefined?1:o.hpMul,atkMul:o.atkMul===undefined?1:o.atkMul,
      buffIds,buffs}}};
