'use strict';
// Meta: the pure data layer for Phase 4 (roster, crystals, quests, rewards, arena, energy). No
// DOM references live here — screens (85_screens.js, later tasks) read/write through these
// functions only. Meta randomness (crystals, later tasks) draws from RNG(Save.data.seed++); wall
// clock only ever enters through Energy.now, which is injectable for deterministic tests.
const Meta={
  defaults(){
    return{v:2,seed:1,
      // Fix-wave item 4 (final review, Important): the persisted, ever-incrementing seed a REAL (non-
      // harness) fight starts at -- see G.startFight's own comment (80_game.js) for why this exists
      // separately from `seed` above (Meta's own crystal-pull stream, untouched by this). A plain
      // top-level default key, so a pre-fix-wave v2 save picks it up for free through migrate()'s
      // generic "fill anything missing" loop below -- no dedicated migrate branch needed, same story
      // as leaderboard/pity/tutorialDone.
      fightSeed:1,gold:0,units:0,iso:0,
      cats:{brawler:0,rogue:0,caster:0,tank:0,beast:0,trickster:0},
      roster:{carl:{stars:1,rank:1,level:1,xp:0,shards:0}},
      active:'carl',
      floors:{1:{nodes:['open','locked','locked','locked','locked'],boss:'locked'}},
      energy:{n:Energy.max,max:Energy.max,ts:0},
      arena:{best:0,streak:0},
      // Task 5.1: local top-10 viewers leaderboard ({viewers,champ,floor|streak,date}, insert/sort-
      // desc/cap-at-10 via Meta.recordScore below). A plain top-level default key, so a pre-5.1 v2
      // save picks it up for free through migrate()'s generic "fill anything missing" loop below --
      // no dedicated migrate branch needed, same as pity (see its own comment just above).
      leaderboard:[],
      // pity[kind]: opens of that crystal kind since its last pity-floor trigger (Task 4.2's
      // Crystal.open); not part of the Phase 4 plan's original defaults() shape (frozen before
      // pity was designed), added here so migrate()'s generic top-level fill loop below covers
      // pre-4.2 v2 saves for free.
      pity:{},
      // Task 5.4: the frozen settings shape. A plain top-level default key (same free-ride-through-
      // migrate() story as leaderboard/pity above for a pre-5.4 v2 save that already has a `settings`
      // key of some shape) -- see migrate()'s own v2 branch below for the explicit per-key backfill
      // this one DOES need (unlike leaderboard/pity, `settings` already existed as `{}` before this
      // task, so the generic "fill anything TOP-LEVEL missing" loop below would never touch it).
      // Task 6.3: showButtons (BLOCK/PUNCH/KICK on-screen, default off now that the whole canvas is
      // a gesture surface -- POWER stays shown regardless) backfills for free through migrate()'s
      // existing per-key settings loop below, same story as every other key in this object.
      settings:{reduceMotion:false,haptics:true,leftHanded:false,useAtlas:false,sfx:true,announcer:true,showButtons:false},
      // Task 5.3: a plain top-level boolean, same free-ride-through-migrate() story as leaderboard/
      // pity above -- a pre-5.3 v2 save picks it up for free via migrate()'s generic "fill anything
      // top-level missing" loop below, no dedicated migrate branch needed. false until G.onFightEnd
      // grants a tutorial win (once); read by Screens.renderTitle's CAMPAIGN handler (first-run
      // routing) and the result screen's tutorial line.
      tutorialDone:false,
      mute:false,stats:{fights:0,wins:0}}},
  // v1 -> v2: keep gold/units/mute/settings, everything else starts fresh (including roster, which
  // v1 saves never meaningfully populated). v2 -> v2: fill in any keys/sub-keys a save from an
  // earlier Phase 4 build is missing, in place, without discarding what's already there. Anything
  // else (null, a non-object, or an unrecognized v) resets to defaults().
  migrate(data){
    if(!data||typeof data!=='object')return Meta.defaults();
    if(data.v===1){
      const d=Meta.defaults();
      d.gold=data.gold||0;d.units=data.units||0;d.mute=!!data.mute;
      // Task 5.4: merge (not replace) onto d.settings' fresh defaults -- a plain replace here used to
      // mean a v1 save with its own (pre-5.4, necessarily settings-shape-less) settings object would
      // completely discard the new reduceMotion/haptics/leftHanded/useAtlas/sfx/announcer defaults,
      // leaving e.g. haptics undefined (falsy) instead of its intended default true.
      d.settings=Object.assign({},d.settings,data.settings&&typeof data.settings==='object'?data.settings:{});
      return d}
    if(data.v===2){
      const d=Meta.defaults();
      for(const k in d)if(!(k in data))data[k]=d[k];
      for(const k in d.cats)if(!(k in data.cats))data.cats[k]=d.cats[k];
      for(const k in d.energy)if(!(k in data.energy))data.energy[k]=d.energy[k];
      for(const k in d.arena)if(!(k in data.arena))data.arena[k]=d.arena[k];
      for(const k in d.stats)if(!(k in data.stats))data.stats[k]=d.stats[k];
      // Task 5.4: `settings` already existed (as `{}`) before this task, so the generic top-level
      // loop above never repopulates it for an old save -- explicit per-key backfill, same pattern as
      // cats/energy/arena/stats just above.
      if(!data.settings||typeof data.settings!=='object')data.settings=d.settings;
      else for(const k in d.settings)if(!(k in data.settings))data.settings[k]=d.settings[k];
      if(!data.roster||typeof data.roster!=='object'||!Object.keys(data.roster).length)data.roster=d.roster;
      // Fix-wave item 10 (minor): migrate could reset `roster` (right above) without repointing a
      // stale `active` that named a champion the reset just dropped -- Rewards.grant's xp path reads
      // Save.data.roster[Save.data.active], so an unowned active silently ate every xp grant with no
      // error. Repoints to the roster's own first key whenever active isn't (or no longer is) owned.
      if(!data.roster[data.active])data.active=Object.keys(data.roster)[0];
      return data}
    return Meta.defaults()},
  // Fix-wave item 9 (Phase 5 seam, ruled): the SPONSOR PERK KIOSK used to be three hand-copied
  // Screens-side blocks (basic crystal, premium crystal, the old bespoke buyIso), each with its own
  // cost/afford check -- adding a fourth sponsor perk meant copying a fourth block. SHOP_ITEMS is now
  // the one table Screens.renderShop reads (cost/label per item) and Meta.buy(itemId) purchases from:
  // a `run` item (a crystal) just defers its whole cost+effect to Crystal.open, which already does
  // its own cost check/deduction; a plain item (isoPack) is refuse-when-short/deduct/`grant`, the
  // same shape Roster.levelUp/rankUp below already use. Referenced here as CHAMPS/Crystal.open are —
  // Crystal is defined later in this same file, but SHOP_ITEMS.basicCrystal.run is a closure only
  // ever called well after the whole script has parsed.
  SHOP_ITEMS:{
    basicCrystal:{label:'BASIC CRYSTAL',cost:{gold:500},run:()=>Crystal.open('basic')},
    premiumCrystal:{label:'PREMIUM CRYSTAL',cost:{units:100},run:()=>Crystal.open('premium')},
    isoPack:{label:'ISO PACK',cost:{gold:200},grant:{iso:60}}},
  buy(itemId){
    const item=Meta.SHOP_ITEMS[itemId];
    if(!item)throw new Error('unknown shop item: '+itemId);
    if(item.run)return item.run(); // crystal items: Crystal.open does its own cost check/deduction
    for(const c in item.cost)if((Save.data[c]||0)<item.cost[c])return false;
    for(const c in item.cost)Save.data[c]-=item.cost[c];
    if(item.grant)for(const c in item.grant)Save.data[c]=(Save.data[c]||0)+item.grant[c];
    Save.put();
    return true},
  buyIso(){return Meta.buy('isoPack')},
  // Fix round 1 (Important): the leaderboard date must route through the same injectable clock
  // Energy already uses (Energy.now, real Date.now() by default but swappable in tests) instead of
  // calling Date.now()/new Date() directly -- a raw wall-clock read makes the leaderboard date
  // untestable and inconsistent with the one other place a wall clock already enters this codebase.
  today(){return new Date(Energy.now()).toISOString().slice(0,10)},
  // Task 5.1: the one place Save.data.leaderboard is ever inserted into -- push, sort desc by
  // viewers, cap at 10. G.onFightEnd is the only caller today (a quest/arena win, entry shaped
  // {viewers,champ,floor|streak,date}), kept generic here so nothing else has to re-implement the
  // insert/sort/cap rule.
  recordScore(entry){
    const lb=Save.data.leaderboard=Save.data.leaderboard||[];
    lb.push(entry);
    lb.sort((a,b)=>b.viewers-a.viewers);
    lb.length=Math.min(10,lb.length);
    Save.put();
    return lb}};
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
  // Fix-wave item 1 (Critical): e.ts defaulted to 0 (Meta.defaults) and was only ever advanced by
  // regen*360000 -- never anchored to a real Energy.now() timestamp -- so now-ts was always ~57
  // real years and tick() refilled to max on the very first call, making the energy gate inert.
  // tick() now re-anchors e.ts=Energy.now() whenever n is already at/over max (both "never spent
  // yet" and "just regenerated back to max"), so the NEXT spend-from-full has an honest starting
  // point; spend() (below) anchors it directly at the moment of the transition out of full, which
  // is the actual event regen should be measured from.
  tick(){
    const e=Save.data.energy;
    const regen=Math.min(Math.floor((Energy.now()-e.ts)/360000),Energy.max-e.n);
    if(regen>0){e.n+=regen;e.ts+=regen*360000}
    if(e.n>=Energy.max)e.ts=Energy.now();
    return e.n},
  spend(n){
    const e=Save.data.energy;
    if(e.n<n)return false;
    if(e.n===Energy.max)e.ts=Energy.now();
    e.n-=n;return true}};
// Crystal.KINDS/open reference CHAMPS (40_movedata.js), which the build concatenates AFTER this
// file — safe because these are only read inside a function body, called well after the whole
// script has loaded (the same later-file-from-earlier-file pattern 45_encounter.js already uses
// for BUFFS, defined in 47_buffs.js).
const Crystal={
  KINDS:{
    basic:  {cost:{units:0,  gold:500},odds:[[1,.70],[2,.25],[3,.05]]},
    premium:{cost:{units:100          },odds:[[2,.60],[3,.32],[4,.08]]}},
  // Fix-wave item 5 (ruled): a duplicate pull's shard grant now scales with the rolled tier instead
  // of a flat 1 -- once the roster is full (4 champions, uniform picking), a flat grant made every
  // crystal worth identically little regardless of cost/odds (final-review-verdict.md issue 5).
  SHARDS_PER_TIER:{1:1,2:2,3:3,4:5},
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
  // matching them). Fix-wave item 4 (final review, Important): this used to be fixed locally here
  // with a one-draw Crystal.rng(seed) wrapper around the plain RNG(seed) constructor; RNG itself
  // (10_util.js) now discards 8 throwaway draws at construction — the same fix, generalized to every
  // RNG(seed) instance in the codebase (Fight, AI.make, Ctrl.random too, not just crystals) — so the
  // wrapper is gone and every call below just uses RNG(seed) directly.
  // One RNG instance per open (both the tier roll and the champion pick draw from it), seeded from
  // Save.data.seed++ so every open — including a pity-forced one — advances the save's random stream
  // exactly once. Refusing for cost never touches the seed or pity counter: nothing about the save
  // changes on a refusal.
  // Task 6.4: opts.free (default falsy) skips the cost check/deduction entirely -- used by the
  // tutorial's own free completion crystal (G.onFightEnd, 80_game.js: Crystal.open('basic',{free:true}))
  // so a fresh save with 0 gold still gets it. Every other line (the RNG draw, pity, roster/dup
  // handling, Save.put()) runs exactly as a paid open would -- a free pull still advances
  // Save.data.seed and the pity counter like any other, it just never touches gold/units.
  open(kind,opts){
    const free=!!(opts&&opts.free);
    const k=Crystal.KINDS[kind];
    if(!k)throw new Error('unknown crystal kind: '+kind);
    if(!free){
      for(const c in k.cost)if((Save.data[c]||0)<k.cost[c])return null;
      for(const c in k.cost)Save.data[c]-=k.cost[c]}
    const rng=RNG(Save.data.seed++);
    let stars=Crystal.rollTier(k.odds,rng);
    if(!Save.data.pity)Save.data.pity={};
    // Fix-wave item 4 (plan defect, ruled): the frozen interface line said "the kind's top-1 tier"
    // but Task 4.2's own checklist said "the 10th open is >=3-star even after nine 1-star" -- those
    // two readings disagreed and no ruling resolved it before implementation (basic's top-1 is
    // 2-star, which the raw odds table already hits ~30% of the time on its own, making the
    // guarantee nearly meaningless). Ruled here: pity guarantees the kind's TOP tier outright, not
    // one below it — basic's 10th open is always exactly 3-star, premium's always exactly 4-star.
    const topTier=k.odds[k.odds.length-1][0];
    const pity=(Save.data.pity[kind]||0)+1;
    if(pity>=10){
      if(stars<topTier)stars=topTier;
      Save.data.pity[kind]=0}
    // Ruled alongside item 4: a NATURAL top-tier roll (the raw table landing on the top tier on its
    // own, independent of the forced 10th) also resets the counter, same as a forced one — a lucky
    // pull's luck isn't wasted against a counter that only ever reset on a forced pity trigger.
    else if(stars>=topTier)Save.data.pity[kind]=0;
    else Save.data.pity[kind]=pity;
    const champId=rng.pick(Object.keys(CHAMPS));
    const roster=Save.data.roster;
    let result;
    if(roster[champId]){
      const entry=roster[champId];
      // `stars` here is the rolled (pity-adjusted) tier from this pull, not the owned champion's
      // display stars below -- that's exactly what SHARDS_PER_TIER is keyed on.
      entry.shards=(entry.shards||0)+(Crystal.SHARDS_PER_TIER[stars]||1);
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
  // Fix-wave item 9 (Phase 5 seam, ruled): looks a floor up by its own `.floor` field instead of
  // array index (FLOORS[n-1]) -- the one place that indexing lived before this, now shared by
  // Quest.floor, Rewards.forNode, and G.startFight's {floor,node} sugar, all of which used to do
  // their own FLOORS[n-1]/FLOORS[n]. A future tutorial floor (floor:0) can be inserted at FLOORS[0]
  // without renumbering any of them.
  floorDef(n){return FLOORS.find(f=>f.floor===n)||null},
  // Read floor n's current playable state: Phase 3's static FLOORS def merged with Save.data's
  // per-node progress. null when either side is missing — an as-yet-uncreated floor (Save.data),
  // or a floor number FLOORS itself never defined (only 1-2 exist today).
  floor(n){
    const def=Quest.floorDef(n);
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
      const nextDef=Quest.floorDef(n+1);
      if(nextDef&&!Save.data.floors[n+1]){
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
  // Fix-wave item 9 (Phase 5 seam, ruled): forNode had no multiplier hook, which is exactly where a
  // future ratings/viewers system needs to land -- without one, that multiplier would have to thread
  // through onFightEnd or every call site individually instead of applying once, here. Phase 4 keeps
  // this at 1/1/1; Phase 5 sets it from ratings.
  mult:{gold:1,iso:1,xp:1},
  // gold/iso/xp scale with the floor number; gold also nudges up with node position within the
  // floor (0-3 for the four early nodes) so later nodes pay a bit more than earlier ones. A boss
  // uses the position just past the last regular node (def.nodes.length, 5 today) for that same
  // gold term, so its base gold continues the node ramp before the boss-only units/catalyst bonus
  // is layered on top.
  forNode(n,k){
    const def=Quest.floorDef(n);
    if(!def)throw new Error('unknown floor: '+n);
    const isBoss=k==='boss';
    const idx=isBoss?def.nodes.length:k;
    // Fix-wave item 8 (ruled): gold raised from 100*n+40*k to 160*n+60*k -- floor 1 only paid out
    // ~1200 gold total under the old numbers, while a single roster star costs roughly 5 dupes
    // (~10000 gold at 500g/basic), gating floor-2 progression almost entirely behind a currency wall
    // unrelated to play (final-review-verdict.md UX/balance note 3). iso/xp unchanged.
    const r={gold:Math.round((160*n+60*idx)*Rewards.mult.gold),
             iso:Math.round(20*n*Rewards.mult.iso),
             xp:Math.round(30*n*Rewards.mult.xp)};
    if(isBoss){
      r.units=50*n; // not multiplied: Rewards.mult only covers gold/iso/xp, per the frozen shape
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
