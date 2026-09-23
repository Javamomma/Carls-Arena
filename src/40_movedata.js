// All frame counts at 60 Hz. dash = px the attacker advances during startup. push = px the defender is shoved on hit.
// Task 7.2: the fixed light1->light5 ladder collapses into one MOVES.light entry (every node plays
// the exact same startup/active/recovery/range/hitstun/blockstun/push/pow/dash timing -- only the
// landed hit's effective damage varies by chain node, via CHAIN.chainDmg below) plus base MOVES.medium
// keeping its own single entry the same way. MOVES.light's non-dmg fields are light1's own old values
// verbatim (dmg:1 too -- node-1 numbers must stay unchanged), so a fresh opener light thrown from
// neutral is bit-identical to the old light1. The old per-move `chain` pointers (light1->light2->...,
// medium->light1) and every move's dead chain:null are deleted -- Fighter.chainNode/CHAIN (below) now
// own the grammar; see 50_fighter.js's startMove/act for how chainNode replaces this.move.chain.
const MOVES={
  light: {startup:5,active:3,recovery:8, dmg:1,   range:70, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,dash:18,stepIn:110,hitstop:3,
    chainDmg:[1,1,1.05,1.1,1.4]},
  medium:{startup:10,active:4,recovery:14,dmg:1.6,range:120,hitstun:18,blockstun:11,push:24,powHit:12,powTaken:6,track:300,hitstop:5,
    chainDmg:[1.6,1.6,1.7,1.8,2.0]},
  heavy: {charge:22,startup:8,active:5,recovery:26,dmg:2.6,range:130,hitstun:26,blockstun:14,push:70,powHit:18,powTaken:9,knockdown:true,hitstop:9},
  s1:{startup:8, active:4,recovery:22,dmg:1.5,hits:3,gap:6,range:130,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:100,knockdown:true,hitstop:6},
  s2:{startup:10,active:4,recovery:28,dmg:1.6,hits:5,gap:6,range:150,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:200,knockdown:true,hitstop:8},
  s3:{startup:20,active:6,recovery:40,dmg:3,  hits:4,gap:8,range:220,hitstun:20,blockstun:0, push:90,powHit:0,powTaken:0,cost:300,knockdown:true,unblockable:true,hitstop:14}};
// Task 8.0 (pre-art seam): the old per-class shake/punch magnitude table moved verbatim to
// src/72_fx.js -- this sim file no longer carries any shake/punch numbers at all. Fight.resolve
// (60_fight.js) reports only the bare fact of what class of hit just landed
// ({kind:'hitfeel',cls,dir,last}); the presentation-side resolver in 72_fx.js is the only place that
// turns that fact into an actual camera-shake/punch-in magnitude. MOVES.*.hitstop (above) stays the
// sim's own hitstop source, unchanged and untouched by this move -- see 72_fx.js's own header
// comment on that table for the full "stop is documentation-only" cross-check note that used to
// live here.
// Task 7.2 (frozen interface, exact values): the five-node combo grammar. openers are the two moves
// that can start a chain from IDLE/BLOCK; nodes is the chain's max length (Fighter.chainNode runs
// 1..5); enders describes what the FINAL blow of the chain does, keyed by which move type actually
// lands it -- light: nothing extra (no push/knockdown bonus: a light-ended chain plays exactly like a
// plain light hit); medium: shoves the defender out to `push` and knocks them down; heavy: a
// "shortened ender" only offered at chainNode===4 (skips a would-be node 5 light/medium and swings a
// heavy instead) that charges for just `charge` frames (not the normal MOVES.heavy.charge) and, once
// it lands, fires the attacker's own def.sigEffect (see CHAMPS/MOBS below) via `sig:true` -- see
// Fight.resolve's own comment (60_fight.js) for exactly where each of these three is read.
// chainDmg lives on MOVES.light/medium themselves (not here) since Fight.resolve already has the
// landed move's own merged data (m) in hand; CHAIN.enders is the only per-node data resolve() has to
// look up separately, since a chain's own base move data never carries push/knockdown for the light/
// medium case (those come only from the enders table, at node 5, or from heavy's own base data at the
// node-4 shortened ender -- heavy already carries knockdown/push, so its ender never needs an override
// for either).
const CHAIN={openers:['light','medium'],nodes:5,
  enders:{light:{},medium:{push:90,knockdown:true},heavy:{charge:14,sig:true}}};
// Task 6.2 (movement inside moves): per-frame rates Fighter.setupDash uses for medium's track and
// light1's stepIn. DASH_TRACK_SPEED preserves medium's old flat dash(140)/startup(10) rate exactly
// (140/10=14) so an already-in-range medium (dashLeft 0, see setupDash) and a near one that only needs
// a few frames both move at the same speed a player already learned. DASH_STEPIN_SPEED is chosen so
// stepIn(110)/DASH_STEPIN_SPEED always equals light1's own unchanged 5-frame startup (110/22=5) --
// a step-in light never needs to run longer than the swing already does; it either closes the gap
// within its own 5 frames or it doesn't connect, same as a real whiffed jab.
// Task 7.3 (frozen interface, exact ruling): DASH_TRACK_SPEED is now only the FLOOR speed for a
// medium's tracked dash-in, not a fixed rate for every gap -- Fighter.setupDash scales the per-frame
// speed up to max(DASH_TRACK_SPEED, dashLeft/14) so the far end of MOVES.medium.track (up to 300px)
// never needs more than 14 effective startup frames to close, capping the dash-in telegraph a defender
// can be caught napping in (a longer, uncapped startup is exactly what made intercepting a far dash-in
// nearly free before this task -- see Fight.resolve's own intercept comment). A close medium (small or
// zero dashLeft) still travels at the same flat 14px/frame rate as always.
const DASH_TRACK_SPEED=14,DASH_STEPIN_SPEED=22;
// Task 7.2 (frozen interface): def.sigEffect={id,stacks,target?} -- fired only by the in-combo heavy
// ender (CHAIN.enders.heavy, m.sig:true) once it lands, via Effects.apply (48_effects.js). `target`
// is 'self'|'foe', default 'foe' (Fight.resolve's own ruling) -- Carl's fury (an attacker-side buff)
// is the one champion whose signature targets itself; every mob/boss below has no sigEffect at all
// (undefined), so the in-combo heavy ender is a plain hit for them, no bonus effect.
// Task 7.4 (frozen ruling): def.impact ('blunt'|'blade'|'energy') -- read on the ATTACKER by
// Fight.resolve's landed-hit branch (60_fight.js) to push a per-class impact fx (FX.push's
// 'impactBlunt'/'impactBlade'/'impactEnergy' cases, 72_fx.js) alongside the existing spark/dustArc
// hit fx. Exact per-id values are the controller's own ruling, verbatim.
// Task 9.1 (kit flags, controller ruling): per the docs/design/mcoc-comparison-notes.md §3 kit table,
// a champion's own moves override below gets a new flag/applies entry ONLY where the move already
// exists in MOVES (or the champion's own prior override) with the exact hit count the kit table
// calls for -- landing a flag on a move whose hit count doesn't match yet would be changing that
// count, which is Task 9.3's job, not this one's. Where the kit table's own duration for an applied
// effect (e.g. carl S3's "stun 120f", grull S3's "weakness 600f") doesn't match that effect's own
// frozen EFFECTS[id].dur (stun:60, weakness:480 -- Phase 7/9.1 frozen, no per-call duration override
// exists in the frozen interfaces), the flag still lands using the effect's real frozen duration; see
// the task report's Deviations section. Champions/bosses whose kit line needs a move's own hit count
// changed (donut S1 5-hit/S3 6-hit) or a bespoke mechanic outside this task's flag set (katia's heavy
// "refresh bleed duration", grull's heavy reach/dash bump) carry nothing here -- Task 9.2/9.3 own those.
const CHAMPS={
  carl: {id:'carl', name:'CARL',           cls:'brawler',  hp:1000,atk:60,color:'#f4c542',armor:0,  crit:.10,critMul:1.6,blockProf:0,  scale:1,   rig:'human',impact:'blunt',
    sigEffect:{id:'fury',stacks:1,target:'self'},
    // heavy 2 armorBreak stacks (single-hit, matches base MOVES.heavy's implicit 1-hit shape); s2 Boot
    // Party (base MOVES.s2 hits:5, matches) refunds 20 power when blocked; s3 Doorway Drop (base
    // MOVES.s3 hits:4, matches) last hit stuns -- the kit table's own "120f" duration is EFFECTS.
    // stun's frozen 60f here (see the header comment above and the task report).
    // s1 Two-Fisted (base MOVES.s1 hits:3, matches) last hit bleeds 1 -- fix round 1: previously
    // withheld (see the task report's original Deviations section) because a bleed DOT tick bypassed
    // BUFFS.tutorialGuard's onHit cap and could bleed the tutorial's guarded dummy past hp-1;
    // tutorialGuard now also caps DOT ticks (47_buffs.js's new onDot hook, read generically through
    // Effects.tick's dotDamage helper, 48_effects.js), so this lands on real data now.
    moves:{heavy:{applies:[{id:'armorBreak',stacks:2,on:'hit'}]},
      s1:{applies:[{id:'bleed',stacks:1,on:'last'}]},
      s2:{refundOnBlock:20},
      s3:{applies:[{id:'stun',stacks:1,on:'last'}]}},
    // Task 9.2: Spite -- see PASSIVES.spite (49_passives.js) for the actual numbers; this def only
    // ever carries the bare id, same split every other champion/boss passive below keeps.
    passive:{id:'spite'},
    // Task 9.3: def.kitText = {sig,heavy,s1,s2,s3} -- short roster-card strings (85_screens.js), one
    // per signature/heavy/special, sourced verbatim from the kit table's own move names above. Never
    // read by the sim; presentation-only, same boundary CLS_GEM/sigEffect's own comments already draw.
    kitText:{sig:'SPITE — below 40% HP, an uncapped Fury stack builds up every 3s',
      heavy:'2 stacks of Armor Break',
      s1:'TWO-FISTED (3 hits) — last hit Bleeds',
      s2:'BOOT PARTY (5 hits) — a blocked hit refunds 20 power',
      s3:'DOORWAY DROP (4 hits) — last hit guarantees a Stun'}},
  // rig:'quad' — Donut is a real cat (Task 3.4's RigQuad, a four-legged bone set; see LOOKS.donut
  // and Rig.solve's 'quad' branch in 68_rig.js).
  donut:{id:'donut',name:'PRINCESS DONUT', cls:'caster',   hp:820, atk:70,color:'#e8a0d8',armor:0,  crit:.18,critMul:1.6,blockProf:0,  scale:1,   rig:'quad',impact:'energy',
    sigEffect:{id:'weakness',stacks:1},
    // heavy burns 30 power (single-hit, matches); s2 Regal Pounce (base MOVES.s2 hits:5, matches) is
    // unblockable.
    // Fix round 1 (controller ruling): the kit line reads "5 hits, LAST unblockable" -- s2 now sets
    // move.unblockable:'last' (only the move's own final sub-hit skips the block branch; sub-hits 1-4
    // still block normally, chip+blockstun) instead of the whole-move `true` every other unblockable
    // move (base MOVES.s3) keeps. See Fight.detect's own comment (60_fight.js) for the two-value flag.
    // Task 9.3: S1 Hairball (kit: 5 hits, each hit poisons) and S3 Sponsor Meltdown (kit: 6 hits, each
    // hit weakens) resize base MOVES.s1/s3 (3/4 hits) up to the kit table's own hit counts -- per the
    // controller's ruling, total move damage stays within +-10% of the pre-resize total by adjusting
    // per-hit dmg down to match: s1 3*1.5=4.5 -> 5*0.9=4.5 (0%); s3 4*3=12 -> 6*2.0=12 (0%). gap is
    // trimmed alongside the extra hits (same "more hits, shorter gap" shape katia's own pre-Phase-9
    // 5-hit s1 override and mother_rat's own 6-hit s3 override already use) so the move's own total
    // active span doesn't balloon out of proportion to the added hit count. 68_rig.js needs no pose
    // change: every pose is keyed by moveName alone (s1/s2/s3/heavy), never by hit count.
    moves:{heavy:{applies:[{id:'powerBurn',stacks:1,potency:30,on:'hit'}]},
      s1:{hits:5,gap:4,dmg:0.9,applies:[{id:'poison',stacks:1,on:'hit'}]},
      s2:{unblockable:'last'},
      s3:{hits:6,gap:5,dmg:2.0,applies:[{id:'weakness',stacks:1,on:'hit'}]}},
    // Task 9.2: Royal Disdain -- see PASSIVES.royalDisdain (49_passives.js).
    passive:{id:'royalDisdain'},
    kitText:{sig:'ROYAL DISDAIN — every special she throws Weakens the foe (x2 if already debuffed)',
      heavy:'Burns 30 power',
      s1:'HAIRBALL (5 hits) — every hit Poisons',
      s2:'REGAL POUNCE (5 hits) — last hit is Unblockable',
      s3:'SPONSOR MELTDOWN (6 hits) — every hit Weakens'}},
  katia:{id:'katia',name:'KATIA',          cls:'trickster',hp:900, atk:64,color:'#7fb0a8',armor:0,  crit:.22,critMul:1.6,blockProf:0,  scale:1,   rig:'human',impact:'blade',
    // s1 Knife Work already overridden to 5 hits (pre-Phase-9) -- matches the kit table verbatim, so
    // each landed hit now also bleeds 1. s2 Misdirection (base MOVES.s2 hits:5, matches) crits every
    // sub-hit. s3 Curtain Call (base MOVES.s3 hits:4, matches) last hit bleeds 3 and armor-breaks 1.
    // Task 9.3: heavy's "refreshes every bleed stack's duration" isn't covered by the frozen applies/
    // flag set (no move flag refreshes another effect's clock) -- move.refreshEffect is this task's
    // own small addition (Effects.refresh, 48_effects.js; read in Fight.resolve's hit branch,
    // 60_fight.js), a silent no-op if the foe isn't already bleeding.
    moves:{heavy:{refreshEffect:'bleed'},
      s1:{hits:5,gap:4,dmg:1.2,applies:[{id:'bleed',stacks:1,on:'hit'}]},
      s2:{critChance:1.0},
      s3:{applies:[{id:'bleed',stacks:3,on:'last'},{id:'armorBreak',stacks:1,on:'last'}]}},
    sigEffect:{id:'bleed',stacks:1},
    // Task 9.2: Understudy -- see PASSIVES.understudy (49_passives.js).
    passive:{id:'understudy'},
    kitText:{sig:'UNDERSTUDY — a successful parry grants +1 Crit Damage stack',
      heavy:'Refreshes the duration of every Bleed stack already on the foe',
      s1:'KNIFE WORK (5 hits) — every hit Bleeds',
      s2:'MISDIRECTION (5 hits) — every hit is a guaranteed Crit',
      s3:'CURTAIN CALL (4 hits) — last hit Bleeds x3 and Armor Breaks'}},
  // rig:'big' — Mongo is Task 3.5's brute bone set (Rig.solveBig/drawBig; see LOOKS.mongo, 68_rig.js).
  mongo:{id:'mongo',name:'MONGO',          cls:'tank',     hp:1300,atk:66, color:'#a3742f',armor:.15,crit:.08,critMul:1.6,blockProf:.15,scale:1.25,rig:'big',impact:'blunt',
    sigEffect:{id:'armorBreak',stacks:1},
    // heavy Ground Slam (single-hit, matches) still knocks a blocker down. s1 Backhand (base MOVES.s1
    // hits:3, matches) last hit stuns (kit's own "60f" is EFFECTS.stun's actual frozen dur -- an exact
    // match, unlike carl/grull's own duration mismatches noted above). s2 Bear Hug (base MOVES.s2
    // hits:5, matches) heals 30% of each landed sub-hit. s3 Doorway Denial (base MOVES.s3 hits:4,
    // matches) last hit grants the attacker (target:'self') armorUp.
    moves:{heavy:{ignoreBlock:'knockdown'},
      s1:{applies:[{id:'stun',stacks:1,on:'last'}]},
      s2:{healPct:0.30},
      s3:{applies:[{id:'armorUp',stacks:1,on:'last',target:'self'}]}},
    // Task 9.2: Immovable -- see PASSIVES.immovable (49_passives.js).
    passive:{id:'immovable'},
    kitText:{sig:'IMMOVABLE — +1 Fury stack per 120 straight frames spent blocking, capped at 5',
      heavy:'GROUND SLAM — knocks down even through a raised guard',
      s1:'BACKHAND (3 hits) — last hit Stuns',
      s2:'BEAR HUG (5 hits) — heals 30% of the damage each hit deals',
      s3:'DOORWAY DENIAL (4 hits) — last hit grants himself Armor Up'}}};
// Task 6.1, ruling 3 (playtest note: "Hobgoblin Brute is impossible to defeat" at floor 1 door 3,
// level 1): goblin/skeleton hp raised and atk lowered exactly to the plan's given numbers (360/30,
// 320/28) -- longer, safer early fights instead of fast trades a level-1 player can lose to a bad
// opening. hobgoblin's hp/atk raised within ±15% of the plan's 640/46 (to 700->736/-5.5%->52), plus
// ENCOUNTERS.f1_hob's AI tier (45_encounter.js) moved from 'brute' (a t3 clone) to 't4' -- both
// together land it at 70% (n=20 seed 1, tests/batch.py --encounter f1_hob) against Ctrl.competent.
//
// Fix round 0 (controller ruling, post-review): shaman was first tuned to 820hp/36atk/.15 armor/.25
// blockProf/tier t5 to force it under 70% against Ctrl.competent (the batch tool's scripted bot) --
// reverted. That combination changes the character's own identity (a squishy caster becoming a tanky
// blocker) just to satisfy a bot yardstick, which the controller ruled out of scope for this task.
// shaman is back to the plan's own ±15%-ceiling numbers (hp 345, atk 36, armor/blockProf/tier
// untouched at their originals) and stays there regardless of what tests/batch.py's Ctrl.competent
// prints for it -- door 4's actual target is "a level-3 human (this door's recLevel) should find it
// fair," not a 40-70% bot win rate; the batch table below is recorded as information, not a gate, for
// this one encounter. See docs/ARENA.md's Task 6.1 entry, "Fix round 0" section, for the full context.
//
// Task 7.5: hobgoblin.atk 52->39 (hp untouched). Ctrl.competent's own new dash-back read (30_input.js)
// and mixed M-L-L-L-M chain, plus the t4 AI_TIERS retune that followed (55_ai.js's own comment),
// still left f1_hob under the frozen 40-70% band at seed-base 101 (36.7% at n=30 even after the t4
// retune); an atk-only cut (same lever every other over/under-band mob or boss in this table gets)
// brings both seed bases back into band (63.3%/46.7% at n=30, 66.7%/50.0% at n=60) — see the task
// report for the full measured sweep.
const MOBS={
  goblin:   {id:'goblin',   name:'GOBLIN SCAVENGER',cls:'rogue',hp:360,atk:30,color:'#6b9a45',armor:0,  crit:.15,critMul:1.6,blockProf:0,  scale:.85,rig:'human',impact:'blade',
    moves:{heavy:{charge:14,dmg:2.0}}},
  hobgoblin:{id:'hobgoblin',name:'HOBGOBLIN BRUTE',  cls:'tank', hp:736,atk:39,color:'#5c6b52',armor:.15,crit:.05,critMul:1.6,blockProf:.1, scale:1.1,rig:'human',impact:'blunt', // Phase 2 fix round 2: 1.2->1.1, see LOOKS.hobgoblin
    moves:{heavy:{charge:30,dmg:3.4,hitstop:12}}},
  skeleton: {id:'skeleton',name:'SKELETON',cls:'rogue', hp:320,atk:28,color:'#d8d0c0',armor:0,  crit:.15,critMul:1.6,blockProf:0,  scale:.95,rig:'human',impact:'blade'},
  // s1 override: a longer 6-hit flurry (base s1 is 3 hits) — the shaman's signature multi-hit special.
  shaman:   {id:'shaman',  name:'SHAMAN',  cls:'caster',hp:345,atk:36,color:'#6a4c93',armor:0,  crit:.1, critMul:1.6,blockProf:0,  scale:.95,rig:'human',impact:'energy',
    moves:{s1:{hits:6,gap:4,dmg:1.1}}},
  // rig:'quad' — Task 3.4's four-legged bone set, same as Donut above (LOOKS.grub, 68_rig.js) but
  // drawn as a segmented larva with stubby leg nubs instead of a cat.
  grub:     {id:'grub',    name:'GRUB',    cls:'beast', hp:380,atk:40,color:'#8a9a4f',armor:.05,crit:.05,critMul:1.6,blockProf:0,  scale:.8, rig:'quad',impact:'blunt'}};
const BOSSES={
  // rig:'big' — Task 3.5's brute bone set (see LOOKS.grull, 68_rig.js). scale is .94, trimmed down
  // from the Task 3.4-era placeholder's 1.3 during Task 3.5 (a real --sim screenshot showed his head/
  // horns going off the top of the canvas at both 1.3 and an intermediate 1.1 — see
  // docs/shots/p3-floor1-boss.png). At the time, the only HUD safety net was a fixed test against
  // heavyCharge/s3, which happen to be Grull's *shortest* poses (a deep crouch by design), so scale
  // was the only lever available and got tuned down until the visible clipping stopped.
  // Task 3.5 fix round 1 (controller review): that fixed-pose test was replaced with a per-fight camera zoom
  // cap computed from Rig.extent's true worst case across every pose and prop (G.startFight,
  // 68_rig.js/65_stage.js) — the camera itself now stays out of any look's way at whatever scale it's
  // set to, which is the real fix for this class of bug. Left at .94 rather than re-tuned back up,
  // since nothing in this task required changing it further.
  // s3 override + buffs are his boss-signature mechanics per Phase 3 ruling #4 (a mob def with
  // boss:true, a bigger rig, a unique S3, and one signature buff — no boss-only engine).
  // Fix-wave item 2: hp 1600->1300, atk 70->60 (armorUp kept) — both bosses were a hard 0/20 vs
  // Ctrl.competent before this pass. Not enough on its own: item 1's special fix and item 8's
  // closing-distance/heavy-mixup fix both landed and Grull was STILL a near-wall (10% at n=20, mostly
  // 0-10% at n=30) — Carl's own competent-bot offense turned out weak against a react:5/punish:.8
  // tank even once it could reach him, landing only ~4 hits total in an 8s loss while Grull landed
  // ~11 (see docs/ARENA.md's fix-wave boss notes for the log breakdown). atk retuned further, 60->42,
  // once items 1/8 were in (per item 2's own deferred plan) — lands 16.7-25% (n=30/n=20) in the
  // 10-35% target band.
  // Task 4.6 re-check: `python3 tests/batch.py --n 30 --p1 carl --encounter f1_grull` still lands at
  // 13.3% (n=30) against the current Ctrl.competent/AI_TIERS — inside the 10-35% band, no retune
  // triggered (see docs/ARENA.md's Phase 4 exit table for the full command output).
  // Task 7.2: atk 42->50. The combo grammar's own CHAIN.enders.light={} (no knockdown, frozen ruling)
  // removes the old ladder's forced ~50-frame knockdown+getup pause every 5 light hits, so Ctrl.
  // competent's own sustained DPS roughly doubled (see 55_ai.js's own tier-gate retune comment for the
  // measured before/after) — the t4 AI_TIERS retune alone still left this boss at 40% (n=30), over the
  // 10-35% band; the atk bump alone (hp untouched) brings it back to 26.7% (n=30).
  // Task 9.1: heavy Pillar Swing (single-hit, matches) armor-breaks the foe.
  // s3 Floor Wipe already overridden to 3 hits (pre-Phase-9) -- matches the kit table verbatim, so its
  // last hit now also weakens (kit's own "600f" duration is EFFECTS.weakness's frozen 480f here, same
  // "no per-call duration override" note as carl/mongo's own comments above). buffs:['armorUp'] is the
  // separate, pre-existing flat Buffs.apply system (47_buffs.js) -- a different id namespace from the
  // new EFFECTS.armorUp this task adds (mongo's own S3 grants that one to himself); unrelated, and this
  // boss's own long-standing buff is untouched.
  // Task 9.3: the kit line's own "longer reach: dash 40" for Pillar Swing -- a move-shape change, not
  // one of Task 9.1's flags -- is a plain m.dash:40 on grull's own heavy override. setupDash's own
  // `else if(m.dash)` branch (50_fighter.js) already handles this generically for any move (every
  // light/medium already uses it): startMove computes dashLeft/dashRate once at CHARGE-press time,
  // but the dash movement itself is only ever consumed during the ATTACK phase's own tick() case (the
  // CHARGE->ATTACK transition resets f to 0 first) -- so the 40px lunge plays out over the swing's own
  // 8-frame startup right after release, not during the hold. No engine change needed.
  grull:{id:'grull',name:'GRULL',cls:'tank',hp:1300,atk:50,color:'#5c2f2f',armor:.2,crit:.05,critMul:1.6,blockProf:.15,scale:.94,rig:'big',impact:'blunt',
    boss:true,buffs:['armorUp'],
    moves:{heavy:{dash:40,applies:[{id:'armorBreak',stacks:1,on:'hit'}]},
      s3:{dmg:3.6,hits:3,gap:10,applies:[{id:'weakness',stacks:1,on:'last'}]}},
    // Task 9.2: Champion of the Floor -- see PASSIVES.championOfTheFloor (49_passives.js).
    passive:{id:'championOfTheFloor'},
    kitText:{sig:'CHAMPION OF THE FLOOR — purifies every debuff and gains +3 Fury every 20s',
      heavy:'PILLAR SWING — long reach, Armor Breaks',
      s1:'3-hit flurry',
      s2:'5-hit flurry',
      s3:'FLOOR WIPE (3 hits) — last hit Weakens'}},
  // rig:'quad' — Task 3.4's four-legged bone set at boss scale (LOOKS.mother_rat, 68_rig.js).
  // Fix-wave item 2: atk 62->50 (see grull's comment above; regen itself was also retuned, in
  // 47_buffs.js, since disabling it entirely still left her a 20/20 wall — her offense, not the
  // heal, was the problem). Same story as Grull above: atk 50 alone was still a 0/20 wall even with
  // items 1/8 in. Retuned to atk 35 + hp 1400->1100 (close to the final review's own alternate, "rat
  // atk 46 + hp 1100") once items 1/8 landed — 16.7-25% (n=30/n=20), ending well below full hp.
  // Fix-wave item 9: scale 1.3->1.15 (paired with a LOOKS.mother_rat bodyLen trim — see that look's
  // own comment) to close the quad-rig reach gap past EDGE_PAD; a presentation-side number, doesn't
  // touch the balance numbers above.
  // Task 4.6 re-check (the progress ledger flagged a quick n=10 run coming back 0/10, against the
  // wave table's own 5/30, as variance worth re-checking here): `python3 tests/batch.py --n 30 --p1
  // carl --encounter f2_mother` lands at 16.7% (n=30) — the retune trigger was "under 10% at n=30",
  // not hit, so no further change; see docs/ARENA.md's Phase 4 exit table for the full command output.
  // Phase 6 fix-wave close-out: the RNG warm-up (10_util.js) shifted every AI stream and this boss
  // drifted to 46.7% (band 10-35%); hp 1100->1350, atk 35->36 measured at 23.3% (seed-base 1) and
  // 13.3% (seed-base 101), n=30 — chosen over atk-only bumps that fell under 10% on base 101.
  // Task 7.2: atk 36->46, same driver as grull's own comment above (Ctrl.competent's sustained DPS
  // roughly doubled once CHAIN.enders.light stopped forcing a knockdown pause every 5 lights) — the t5
  // AI_TIERS retune alone still left this boss at 53.3% (n=30), well over the 10-35% band; hp left
  // untouched, atk-only brings it back to 23.3% (n=30).
  // Task 7.5: atk 46->50. t5 wasn't itself retuned this task (unlike t4 -- see AI_TIERS' own comment
  // -- t5's tier-sweep number barely moved, 23.3->21.7 at n=30/n=60, so a blanket t5 nerf/buff wasn't
  // warranted), but Ctrl.competent's own dash-back read still raised this specific boss's win rate
  // past the 35% ceiling at seed-base 101 (20.0%/36.7% at seed-base 1/101, n=30) -- a boss-specific
  // atk bump (same lever as every prior retune here, hp left alone) restores both seeds into band
  // (20.0%/23.3%) without touching the shared t5 tier the general sweep already passes.
  // Task 9.1: heavy Tail Sweep (single-hit, matches) bleeds the foe 3 stacks. s3 Swarm already
  // overridden to 6 hits (pre-Phase-9) -- matches the kit table verbatim, so it now heals the attacker
  // 2% of each landed sub-hit too. buffs:['regen'] is the pre-existing flat Buffs.apply system, kept
  // exactly as-is.
  mother_rat:{id:'mother_rat',name:'MOTHER RAT',cls:'beast',hp:1350,atk:50,color:'#4a3040',armor:.1,crit:.1,critMul:1.6,blockProf:.05,scale:1.15,rig:'quad',impact:'blunt',
    boss:true,buffs:['regen'],
    moves:{heavy:{applies:[{id:'bleed',stacks:3,on:'hit'}]},
      s3:{dmg:2.4,hits:6,gap:5,healPct:0.02}},
    // Task 9.2: Brood -- see PASSIVES.brood (49_passives.js). The regen-tripling half lives in
    // BUFFS.regen's own onFrame (47_buffs.js), which checks this same passive id live.
    passive:{id:'brood'},
    kitText:{sig:'BROOD — below 50% HP, gains a power stack and regen triples',
      heavy:'TAIL SWEEP — Bleeds x3',
      s1:'3-hit flurry',
      s2:'5-hit flurry',
      s3:'SWARM (6 hits) — every hit heals 2% of the damage it deals'}}};
const DEFS=Object.assign({},CHAMPS,MOBS,BOSSES);
const CLASS_BEATS={brawler:'rogue',rogue:'caster',caster:'brawler',tank:'beast',beast:'trickster',trickster:'tank'};
// Task 8.4 ruling: CLS_GEM maps a def's own cls (CHAMPS/MOBS/BOSSES above) to the portrait-frame
// gem / enemy combo-counter color the HUD draws (70_render.js's portraitFrame/hud) -- presentation
// reads this table, the sim never does, same boundary CLASS_BEATS above already draws for the
// pre-fight matchup arrow (that one the sim DOES read; this one only ever reaches a canvas draw).
// Fix round 1: the first cut of this table (brawler/beast/caster/undead/brute) used class names the
// task 8.4 brief invented rather than the six def.cls values CHAMPS/MOBS/BOSSES above actually use
// (brawler/rogue/caster/tank/beast/trickster) -- flagged in the task 8.4 report's Deviations/Concerns
// and fixed here with the controller's own corrected ruling: all six real classes now have their own
// entry (no more `undead`/`brute`, which labeled nothing), so no current def falls back to
// `default` -- see the "every def's cls has a non-default CLS_GEM entry" test (90_tests.js) that
// pins this. `default` stays, as a defined fallback for any future class this table hasn't caught up
// to yet, but nothing in CHAMPS/MOBS/BOSSES should ever actually hit it.
const CLS_GEM={brawler:'#f4c542',caster:'#9b6bd6',trickster:'#3fbfb0',tank:'#c0623a',rogue:'#5fbf6a',
  beast:'#e07a3f',default:'#9aa0a6'};
// Fix-wave item 5 (final review, Important): the minimum CHARGE frames a released heavy still swings
// at, instead of cancelling outright -- see Fighter.act's own CHARGE branch comment (50_fighter.js).
// A flat frame count, independent of any per-champion moves.heavy.charge override (goblin 14, hobgoblin
// 30) -- it's well under every one of those (a full charge is still what auto-fires the swing; this
// only decides what an EARLY release does).
const HEAVY_MIN_CHARGE=8;
const CLASS_BONUS=1.15,PARRY_WINDOW=6,PARRY_STUN=50,CHIP=.08,POWER_MAX=300,PARRY_LOCKOUT=20,CRIT_MUL_DEFAULT=1.6;
const DASH_BACK={frames:12,dist:90,inv:8},KNOCKDOWN={frames:40,inv:10};
const STAGE_W=1400;
// Wall clamp half-width for Fighter.tick's x clamp. Wide enough that a fighter pinned at the wall
// stays fully on screen: the rig can reach (shoulderW/2 + armLen + limb) * def.scale past the
// fighter's x. Fix round 1 set this to 110 against the Phase-2-era rig; fix round 2's rescaled
// LOOKS push that reach to ~162px for Carl and ~212px for the hobgoblin (its def.scale=1.1 on top
// of already-larger proportions), so 110 was no longer enough — see the "every look's reach fits
// inside EDGE_PAD" test. A camera margin can't fix this alone because the parallax-1.0 floor layer
// is drawn exactly STAGE_W wide, so letting the camera past its own limit would expose blank canvas
// past the stage edge; this has to be a sim-side constant (Fighter stays independent of Rig) instead.
// Fix-wave item 3: bumped 220->260 (pulled forward from item 9's own EDGE_PAD work) — folding the
// drawn head into Rig.extent (see that function's own comment) pushed Mongo's reach to 234.3, past
// the old 220 margin. 260 is item 9's own number (it fixes Donut/Mother Rat's much larger quad-rig
// gap the same pass), so bumping it here rather than re-deriving a smaller one just for Mongo avoids
// moving this constant twice across two commits for the same underlying (headR/reach) reason.
// Fix-wave item 9: Donut/Mother Rat (LOOKS.donut/mother_rat, 68_rig.js) trimmed until Rig.extent's
// reach — props and head both included — clears this 260 value for every look with real margin
// (Mongo 234.3, Grull 191.2, Donut 257.2, Mother Rat 254.7, everyone else already well under); the
// "every look's reach fits inside EDGE_PAD" test's quad carve-out is deleted, no longer needed.
const EDGE_PAD=260;
