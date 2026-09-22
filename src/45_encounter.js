// Dungeon encounters: a floor + name + enemy id/tier the HUD reads for the "FLOOR n • NAME" line
// and G.startFight uses to build p2. Pure data lookup; scaling (hpMul/atkMul) is applied by
// floorMul below, so Encounter.resolve never mutates a DEFS entry.
// hpMul/atkMul scale +15% per floor past the first (floor 1 -> 1.0, floor 2 -> 1.15, ...), computed
// from the floor number here rather than hard-coded per encounter so a future floor 3+ just plugs in.
function floorMul(floor){return 1+0.15*(floor-1)}
// FLOORS[i] = {floor, name, nodes:[encounterId,...], boss:encounterId}. G.startFight({floor,node})
// resolves node (an index into .nodes, or the string 'boss') to one of these ids.
const FLOORS=[
  {floor:1,name:'THE DEPTHS',nodes:['f1_goblin','f1_skel','f1_hob','f1_shaman','f1_goblin2'],boss:'f1_grull'},
  {floor:2,name:'THE SEWERS',nodes:['f2_grub','f2_skel2','f2_shaman2','f2_hob2','f2_grub2'],boss:'f2_mother'}];
const ENCOUNTERS={
  f1_goblin:{floor:1,name:'THE DEPTHS',enemy:'goblin',tier:'basic',hpMul:1,atkMul:1},
  f1_hob:   {floor:1,name:'THE DEPTHS',enemy:'hobgoblin',tier:'brute',hpMul:1,atkMul:1},
  f1_skel:    {floor:1,name:'THE DEPTHS',enemy:'skeleton', tier:'t2',hpMul:floorMul(1),atkMul:floorMul(1)},
  f1_shaman:  {floor:1,name:'THE DEPTHS',enemy:'shaman',   tier:'t3',hpMul:floorMul(1),atkMul:floorMul(1)},
  f1_goblin2: {floor:1,name:'THE DEPTHS',enemy:'goblin',   tier:'t3',hpMul:floorMul(1),atkMul:floorMul(1)},
  f1_grull:   {floor:1,name:'THE DEPTHS',enemy:'grull',    tier:'t4',hpMul:floorMul(1),atkMul:floorMul(1),boss:true},
  f2_grub:    {floor:2,name:'THE SEWERS',enemy:'grub',     tier:'t3',hpMul:floorMul(2),atkMul:floorMul(2)},
  f2_skel2:   {floor:2,name:'THE SEWERS',enemy:'skeleton', tier:'t3',hpMul:floorMul(2),atkMul:floorMul(2)},
  f2_shaman2: {floor:2,name:'THE SEWERS',enemy:'shaman',   tier:'t4',hpMul:floorMul(2),atkMul:floorMul(2)},
  f2_hob2:    {floor:2,name:'THE SEWERS',enemy:'hobgoblin',tier:'t4',hpMul:floorMul(2),atkMul:floorMul(2)},
  f2_grub2:   {floor:2,name:'THE SEWERS',enemy:'grub',     tier:'t4',hpMul:floorMul(2),atkMul:floorMul(2)},
  f2_mother:  {floor:2,name:'THE SEWERS',enemy:'mother_rat',tier:'t5',hpMul:floorMul(2),atkMul:floorMul(2),boss:true}};
const Encounter={
  resolve(x){
    const o=typeof x==='string'?ENCOUNTERS[x]:x;
    if(!o)throw new Error('unknown encounter: '+x);
    const enemy=typeof o.enemy==='string'?DEFS[o.enemy]:o.enemy;
    if(!enemy)throw new Error('unknown encounter enemy: '+o.enemy);
    const boss=!!o.boss;
    // enc.buffs is resolved BUFFS objects, for the HUD to read (badge codes come off b.id); enc.buffIds
    // is the raw id list, kept alongside so G.startFight can hand ids (not encounter/presentation-side
    // objects) to Buffs.apply, which does its own independent resolution. A boss encounter's buffIds
    // are its def's signature buff(s) (Phase 3 ruling #4) plus whatever the node itself adds via
    // o.buffs (no boss node uses this today, but it's kept general rather than assuming empty).
    const nodeBuffIds=o.buffs||[];
    const buffIds=boss?(enemy.buffs||[]).concat(nodeBuffIds):nodeBuffIds;
    const buffs=buffIds.map(id=>{if(!BUFFS[id])throw new Error('unknown buff: '+id);return BUFFS[id]});
    return{floor:o.floor,name:o.name,enemy,tier:o.tier,
      hpMul:o.hpMul===undefined?1:o.hpMul,atkMul:o.atkMul===undefined?1:o.atkMul,
      buffIds,buffs,boss}}};
