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
// Reserved for later Phase 4 tasks (4.2+); kept as empty objects now so 12_meta.js is the single
// place Meta's namespace is declared and later tasks only ever add to these, never redeclare them.
const Crystal={},Quest={},Rewards={},Roster={},Arena={};
