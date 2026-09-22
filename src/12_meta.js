'use strict';
// Meta: the pure data layer for Phase 4 (roster, crystals, quests, rewards, arena, energy). No
// DOM references live here — screens (85_screens.js, later tasks) read/write through these
// functions only. Meta randomness (crystals, later tasks) draws from RNG(Save.data.seed++); wall
// clock only ever enters through Energy.now, which is injectable for deterministic tests.
const Meta={
  defaults(){
    return{v:2,seed:1,gold:0,units:0,iso:0,
      cats:{brawler:0,rogue:0,caster:0,tank:0,beast:0,trickster:0},
      roster:{carl:{stars:1,rank:1,level:1,xp:0,shards:0}},
      active:'carl',
      floors:{1:{nodes:['open','locked','locked','locked','locked'],boss:'locked'}},
      energy:{n:Energy.max,max:Energy.max,ts:0},
      arena:{best:0,streak:0},
      // pity[kind]: opens of that crystal kind since its last pity-floor trigger (Task 4.2's
      // Crystal.open); not part of the Phase 4 plan's original defaults() shape (frozen before
      // pity was designed), added here so migrate()'s generic top-level fill loop below covers
      // pre-4.2 v2 saves for free.
      pity:{},
      mute:false,settings:{},stats:{fights:0,wins:0}}},
  // v1 -> v2: keep gold/units/mute/settings, everything else starts fresh (including roster, which
  // v1 saves never meaningfully populated). v2 -> v2: fill in any keys/sub-keys a save from an
  // earlier Phase 4 build is missing, in place, without discarding what's already there. Anything
  // else (null, a non-object, or an unrecognized v) resets to defaults().
  migrate(data){
    if(!data||typeof data!=='object')return Meta.defaults();
    if(data.v===1){
      const d=Meta.defaults();
      d.gold=data.gold||0;d.units=data.units||0;d.mute=!!data.mute;
      d.settings=data.settings&&typeof data.settings==='object'?data.settings:{};
      return d}
    if(data.v===2){
      const d=Meta.defaults();
      for(const k in d)if(!(k in data))data[k]=d[k];
      for(const k in d.cats)if(!(k in data.cats))data.cats[k]=d.cats[k];
      for(const k in d.energy)if(!(k in data.energy))data.energy[k]=d.energy[k];
      for(const k in d.arena)if(!(k in data.arena))data.arena[k]=d.arena[k];
      for(const k in d.stats)if(!(k in data.stats))data.stats[k]=d.stats[k];
      if(!data.roster||typeof data.roster!=='object'||!Object.keys(data.roster).length)data.roster=d.roster;
      return data}
    return Meta.defaults()},
  // Fix round 1 (Task 4.5 controller review, Minor): the SPONSOR PERK KIOSK's ISO PACK (200 gold ->
  // 60 iso) has no dedicated Meta function of its own yet -- added here rather than left as a
  // Screens-side Rewards.grant({gold:-200,...}) reuse, same refuse-when-short/deduct-then-Save.put
  // shape as Roster.levelUp/rankUp right below.
  buyIso(){
    const cost=200,gain=60;
    if((Save.data.gold||0)<cost)return false;
    Save.data.gold-=cost;
    Save.data.iso=(Save.data.iso||0)+gain;
    Save.put();
    return true}};
const Stats={
  caps:{stars:[1,5],rank:stars=>stars,level:rank=>10*rank},
  xpToLevel(level){return 40*level},
  clampEntry(entry){
    entry.stars=clamp(entry.stars,Stats.caps.stars[0],Stats.caps.stars[1]);
    entry.rank=clamp(entry.rank,1,Stats.caps.rank(entry.stars));
    entry.level=clamp(entry.level,1,Stats.caps.level(entry.rank));
    return entry},
  derive(def,entry){
    const mul=(1+.25*(entry.stars-1))*(1+.10*(entry.rank-1))*(1+.01*(entry.level-1));
    return{hp:Math.round(def.hp*mul),atk:Math.round(def.atk*mul)}}};
// Energy.max is the single source of truth for the energy cap (Save.data.energy.max is only a
// mirror of it, set from here in Meta.defaults, kept in the save shape for Screens to read later —
// tick/spend never read e.max so there is exactly one place this constant can drift from).
const Energy={
  now:()=>Date.now(),
  max:10,
  tick(){
    const e=Save.data.energy;
    const regen=Math.min(Math.floor((Energy.now()-e.ts)/360000),Energy.max-e.n);
    if(regen>0){e.n+=regen;e.ts+=regen*360000}
    return e.n},
  spend(n){
    const e=Save.data.energy;
    if(e.n<n)return false;
    e.n-=n;return true}};
// Crystal.KINDS/open reference CHAMPS (40_movedata.js), which the build concatenates AFTER this
// file — safe because these are only read inside a function body, called well after the whole
// script has loaded (the same later-file-from-earlier-file pattern 45_encounter.js already uses
// for BUFFS, defined in 47_buffs.js).
const Crystal={
  KINDS:{
    basic:  {cost:{units:0,  gold:500},odds:[[1,.70],[2,.25],[3,.05]]},
    premium:{cost:{units:100          },odds:[[2,.60],[3,.32],[4,.08]]}},
  // Pure weighted draw off an odds table [[tier,prob],...] (probs sum to 1); the single random
  // decision in a crystal open. Kept separate from open() so tests can measure the raw table's
  // distribution directly, without pity or roster/dup effects mixed in.
  rollTier(odds,rng){
    const r=rng.next();let acc=0;
    for(const[tier,p]of odds){acc+=p;if(r<acc)return tier}
    return odds[odds.length-1][0]},
  // xorshift32's first output from a small, low-entropy seed (1, 2, 3, ... — exactly what
  // Save.data.seed++ produces) is badly under-mixed: RNG(1).next()===0.0000629..., RNG(2).next()
  // is almost exactly double that, and so on for thousands of seeds, which skews any single draw
  // taken immediately off a freshly-seeded RNG toward the low end (verified: raw first-draw tier
  // frequencies over seeds 1..10000 came out 100/0/0 against basic's 70/25/5 odds instead of
  // matching them). One throwaway warm-up call fixes it (same seeds then measure 70.06/24.88/5.06)
  // — this is the standard fix for a freshly-seeded PRNG's under-mixed first output, not a
  // workaround for a test; every real RNG(Save.data.seed++) instance in open() needs it too.
  rng(seed){const r=RNG(seed);r.next();return r},
  // One RNG instance per open (both the tier roll and the champion pick draw from it, after the
  // warm-up draw above), seeded from Save.data.seed++ so every open — including a pity-forced one
  // — advances the save's random stream exactly once. Refusing for cost never touches the seed or
  // pity counter: nothing about the save changes on a refusal.
  open(kind){
    const k=Crystal.KINDS[kind];
    if(!k)throw new Error('unknown crystal kind: '+kind);
    for(const c in k.cost)if((Save.data[c]||0)<k.cost[c])return null;
    for(const c in k.cost)Save.data[c]-=k.cost[c];
    const rng=Crystal.rng(Save.data.seed++);
    let stars=Crystal.rollTier(k.odds,rng);
    if(!Save.data.pity)Save.data.pity={};
    const pity=(Save.data.pity[kind]||0)+1;
    // "the kind's second-highest tier" (Phase 4 ruling): one below the top of that kind's odds
    // table — basic's top is 3-star so its pity floor is 2-star, premium's top is 4-star so 3-star.
    const pityFloor=k.odds[k.odds.length-1][0]-1;
    if(pity>=10){
      if(stars<pityFloor)stars=pityFloor;
      Save.data.pity[kind]=0}
    else Save.data.pity[kind]=pity;
    const champId=rng.pick(Object.keys(CHAMPS));
    const roster=Save.data.roster;
    let result;
    if(roster[champId]){
      const entry=roster[champId];
      entry.shards=(entry.shards||0)+1;
      while(entry.shards>=5&&entry.stars<5){entry.shards-=5;entry.stars++}
      result={champId,stars:entry.stars,dup:true,shards:entry.shards}}
    else{
      roster[champId]={stars,rank:1,level:1,xp:0,shards:0};
      result={champId,stars,dup:false}}
    Save.put();
    return result}};
// Quest/Rewards/Roster/Arena reference FLOORS/ENCOUNTERS/DEFS/BUFFS (45_encounter.js/47_buffs.js,
// concatenated after this file) and G is never touched here — same later-file-from-earlier-file,
// no-DOM pattern as Crystal above.
const Quest={
  // Read floor n's current playable state: Phase 3's static FLOORS def merged with Save.data's
  // per-node progress. null when either side is missing — an as-yet-uncreated floor (Save.data),
  // or a floor number FLOORS itself never defined (only 1-2 exist today).
  floor(n){
    const def=FLOORS[n-1];
    const save=Save.data.floors[n];
    if(!def||!save)return null;
    return{floor:n,name:def.name,
      nodes:def.nodes.map((id,i)=>({id,state:save.nodes[i],enc:id})),
      boss:{id:def.boss,state:save.boss,enc:def.boss}}},
  canStart(n,k){
    const f=Quest.floor(n);
    if(!f)return false;
    const node=k==='boss'?f.boss:f.nodes[k];
    if(!node||node.state!=='open')return false;
    return Save.data.energy.n>=1},
  start(n,k){
    if(!Quest.canStart(n,k))return null;
    const f=Quest.floor(n);
    const node=k==='boss'?f.boss:f.nodes[k];
    if(!Energy.spend(1))return null;
    Save.put();
    return node.id},
  // A win flips the node/boss just fought to 'done' and unlocks what's next: the following node,
  // or — off the last node — the boss. A boss win additionally creates floor n+1 (node 0 open,
  // everything else locked) the first time, but only when FLOORS actually defines that next floor
  // (Phase 3 ships floors 1-2 today; finishing floor 2's boss is a dead end until a future floor
  // lands). A loss changes nothing here — Quest.start already spent the energy on the attempt.
  complete(n,k,won){
    if(!won)return false;
    const save=Save.data.floors[n];
    if(!save)return false;
    if(k==='boss'){
      save.boss='done';
      if(FLOORS[n]&&!Save.data.floors[n+1]){
        const nextDef=FLOORS[n];
        Save.data.floors[n+1]={nodes:nextDef.nodes.map((_,i)=>i===0?'open':'locked'),boss:'locked'}}}
    else{
      if(!save.nodes||save.nodes[k]===undefined)return false;
      save.nodes[k]='done';
      if(k+1<save.nodes.length){
        if(save.nodes[k+1]==='locked')save.nodes[k+1]='open'}
      else if(save.boss==='locked')save.boss='open'}
    Save.put();
    return true}};
const Rewards={
  // gold/iso/xp scale with the floor number; gold also nudges up with node position within the
  // floor (0-3 for the four early nodes) so later nodes pay a bit more than earlier ones. A boss
  // uses the position just past the last regular node (def.nodes.length, 5 today) for that same
  // gold term, so its base gold continues the node ramp before the boss-only units/catalyst bonus
  // is layered on top.
  forNode(n,k){
    const def=FLOORS[n-1];
    if(!def)throw new Error('unknown floor: '+n);
    const isBoss=k==='boss';
    const idx=isBoss?def.nodes.length:k;
    const r={gold:100*n+40*idx,iso:20*n,xp:30*n};
    if(isBoss){
      r.units=50*n;
      const enemyId=ENCOUNTERS[def.boss].enemy;
      r.cats={};
      r.cats[DEFS[enemyId].cls]=1}
    return r},
  // Currencies/catalysts apply unconditionally; xp applies to the active champion, levelling it up
  // (Stats.xpToLevel per level, consumed on each level-up) while level stays under its rank's cap —
  // any xp left over once the cap is hit (mid-grant or already-capped) is kept on the entry, not
  // discarded, so a later rank-up can spend straight into it.
  grant(r){
    Save.data.gold=(Save.data.gold||0)+(r.gold||0);
    Save.data.iso=(Save.data.iso||0)+(r.iso||0);
    Save.data.units=(Save.data.units||0)+(r.units||0);
    if(r.cats)for(const c in r.cats)Save.data.cats[c]=(Save.data.cats[c]||0)+r.cats[c];
    const entry=Save.data.roster[Save.data.active];
    if(entry&&r.xp){
      entry.xp+=r.xp;
      const cap=Stats.caps.level(entry.rank);
      while(entry.level<cap&&entry.xp>=Stats.xpToLevel(entry.level+1)){
        entry.xp-=Stats.xpToLevel(entry.level+1);
        entry.level++}}
    Save.put()}};
const Roster={
  levelUp(id){
    const entry=Save.data.roster[id];
    if(!entry)return false;
    if(entry.level>=Stats.caps.level(entry.rank))return false;
    const cost=10*entry.level;
    if((Save.data.iso||0)<cost)return false;
    Save.data.iso-=cost;
    entry.level++;
    Save.put();
    return true},
  rankUp(id){
    const entry=Save.data.roster[id];
    if(!entry)return false;
    if(entry.rank>=entry.stars)return false;
    const cls=CHAMPS[id].cls;
    const cost=entry.rank;
    if((Save.data.cats[cls]||0)<cost)return false;
    Save.data.cats[cls]-=cost;
    entry.rank++;
    Save.put();
    return true},
  setActive(id){
    if(!Save.data.roster[id])return false;
    Save.data.active=id;
    Save.put();
    return true}};
const Arena={
  // Endless mode: no energy cost, streak (Save.data.arena.streak) drives everything. Enemy cycles
  // through this fixed 7-mob list (mobs and both floor bosses, reused as arena opponents); tier
  // climbs one AI_TIERS step every 2 streak wins, capped at t5; hp scales linearly with streak.
  // atk is left at the def's own value (atkMul 1) — only hp is specified to scale here.
  ENEMIES:['goblin','skeleton','hobgoblin','shaman','grub','grull','mother_rat'],
  start(){
    const s=Save.data.arena.streak;
    const enemy=DEFS[Arena.ENEMIES[s%Arena.ENEMIES.length]];
    const tiers=['t1','t2','t3','t4','t5'];
    const tier=tiers[Math.min(4,Math.floor(s/2))];
    const buffIds=enemy.buffs||[];
    return{floor:null,name:'ARENA',enemy,tier,hpMul:1+.08*s,atkMul:1,
      buffIds,buffs:buffIds.map(id=>BUFFS[id]),boss:!!enemy.boss}},
  record(won){
    const a=Save.data.arena;
    if(won){
      a.streak+=1;
      if(a.streak>a.best)a.best=a.streak;
      Save.data.gold=(Save.data.gold||0)+60*a.streak}
    else a.streak=0;
    Save.put()}};
