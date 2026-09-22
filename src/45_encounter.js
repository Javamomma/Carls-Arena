// Dungeon encounters: a floor + name + enemy id/tier the HUD reads for the "FLOOR n • NAME" line
// and G.startFight uses to build p2. Pure data lookup; scaling (hpMul/atkMul) is applied by
// floorMul below, so Encounter.resolve never mutates a DEFS entry.
// hpMul/atkMul scale +15% per floor past the first (floor 1 -> 1.0, floor 2 -> 1.15, ...), computed
// from the floor number here rather than hard-coded per encounter so a future floor 3+ just plugs in.
function floorMul(floor){return 1+0.15*(floor-1)}
// FLOORS[i] = {floor, id, name, nodes:[encounterId,...], boss:encounterId}. G.startFight({floor,node})
// resolves node (an index into .nodes, or the string 'boss') to one of these ids.
// Fix-wave item 9 (Phase 5 seam, ruled): each floor now carries its own `id` ('f1','f2') so
// Quest.floorDef(n) (12_meta.js) can look a floor up by its `.floor` field instead of array index --
// a future tutorial floor (floor:0) can then be inserted at FLOORS[0] without renumbering every
// existing FLOORS[n-1] lookup across Quest.floor/Rewards.forNode/G.startFight's {floor,node} sugar.
const FLOORS=[
  {floor:1,id:'f1',name:'THE DEPTHS',nodes:['f1_goblin','f1_skel','f1_hob','f1_shaman','f1_goblin2'],boss:'f1_grull'},
  {floor:2,id:'f2',name:'THE SEWERS',nodes:['f2_grub','f2_skel2','f2_shaman2','f2_hob2','f2_grub2'],boss:'f2_mother'}];
// Fix-wave item 5: node buffs were dead content — no ENCOUNTERS entry carried a `buffs` list, so
// degen/powerGain/unblockableSpecials/thorns never ran in a real fight despite being fully wired
// (Buffs.apply, Fight.buffHook/buffFrame, HUD badges) since Task 3.2. Every FLOORS node except two
// (f1_goblin and f2_grub2, each floor's plain "opening"/"repeat" fight, kept buff-free on purpose —
// see the "every FLOORS node except two has a buff" test) now carries at least one. Assignments spread
// the buff catalog across both floors rather than clustering it (thorns/powerGain introduced on floor
// 1, armorUp/degen repeated with unblockableSpecials added on floor 2) so a player meets every buff at
// least once before the bosses, which already carry their own signature buff off their def
// (armorUp/regen, Phase 3 ruling #4 — unaffected by this change).
const ENCOUNTERS={
  // Task 5.3: Floor 0, the frozen tutorial encounter (Phase 5 ruling #3) -- a goblin at half hp and
  // 30% atk (`tier:'dummy'` is kept as the frozen descriptive shape even though G.startTutorial
  // never actually routes it through AI.make('dummy',...): it hands the live fight a deterministic
  // Ctrl.tutorialDummy() controller directly as ctrl2 instead, so the one scripted medium step 3's
  // parry prompt needs never depends on rng). `buffs:[]` is explicit (not omitted) per the frozen
  // interface line -- the dummy carries no encounter buffs, same empty-array meaning every other
  // ENCOUNTERS entry gets from Encounter.resolve's own `o.buffs||[]` default.
  tutorial:{floor:0,name:'THE WAITING ROOM',enemy:'goblin',tier:'dummy',hpMul:.5,atkMul:.3,buffs:[]},
  f1_goblin:{floor:1,name:'THE DEPTHS',enemy:'goblin',tier:'basic',hpMul:floorMul(1),atkMul:floorMul(1)},
  f1_hob:   {floor:1,name:'THE DEPTHS',enemy:'hobgoblin',tier:'brute',hpMul:floorMul(1),atkMul:floorMul(1),buffs:['armorUp']},
  f1_skel:    {floor:1,name:'THE DEPTHS',enemy:'skeleton', tier:'t2',hpMul:floorMul(1),atkMul:floorMul(1),buffs:['thorns']},
  f1_shaman:  {floor:1,name:'THE DEPTHS',enemy:'shaman',   tier:'t3',hpMul:floorMul(1),atkMul:floorMul(1),buffs:['powerGain']},
  f1_goblin2: {floor:1,name:'THE DEPTHS',enemy:'goblin',   tier:'t3',hpMul:floorMul(1),atkMul:floorMul(1),buffs:['degen']},
  f1_grull:   {floor:1,name:'THE DEPTHS',enemy:'grull',    tier:'t4',hpMul:floorMul(1),atkMul:floorMul(1),boss:true},
  f2_grub:    {floor:2,name:'THE SEWERS',enemy:'grub',     tier:'t3',hpMul:floorMul(2),atkMul:floorMul(2),buffs:['degen']},
  f2_skel2:   {floor:2,name:'THE SEWERS',enemy:'skeleton', tier:'t3',hpMul:floorMul(2),atkMul:floorMul(2),buffs:['armorUp']},
  f2_shaman2: {floor:2,name:'THE SEWERS',enemy:'shaman',   tier:'t4',hpMul:floorMul(2),atkMul:floorMul(2),buffs:['powerGain','degen']},
  f2_hob2:    {floor:2,name:'THE SEWERS',enemy:'hobgoblin',tier:'t4',hpMul:floorMul(2),atkMul:floorMul(2),buffs:['unblockableSpecials']},
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
