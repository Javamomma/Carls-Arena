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
    return Meta.defaults()}};
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
// Reserved for later Task 4.3; kept as empty objects now so 12_meta.js is the single place Meta's
// namespace is declared and Task 4.3 only ever adds to these, never redeclares them.
const Quest={},Rewards={},Roster={},Arena={};
