'use strict';
const W=854,H=480,FLOOR=400,STEP=1/60;
const canvas=document.getElementById('game');
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
// Screen-space y a rig's topmost point must clear: portraits/hp bars end around y=70 (Task 8.4's
// class-gem badge below each portrait frame reaches a few px further, to y=81 -- see 70_render.js's
// gemCenter), the floor-line text around y=96, so 104 leaves a few px of breathing room. Shared by
// Camera's per-fight zoom cap (65_stage.js/80_game.js) and its own regression test (90_tests.js) so
// all three read one number.
const HUD_LINE=104;
// xorshift32; deterministic per seed. Never use Math.random inside the sim.
// Fix-wave item 4 (final review, Important): xorshift32's first output from a small, low-entropy seed
// (1, 2, 3, ... -- exactly what a fight seed or Save.data.fightSeed++ produces) is badly under-mixed
// (RNG(1).next()===0.0000629..., RNG(2).next() almost exactly double that, and so on for thousands of
// seeds) -- every real fight ran at seed 1 (see G.startFight's own comment below) so the FIRST landed
// hit of every fight was a guaranteed crit, and the whole crit stream repeated fight to fight. 12_meta.
// js's Crystal.rng already discarded one throwaway draw to fix exactly this for crystal pulls; that fix
// is generalized here (8 discarded draws, comfortably past the under-mixed region) so it covers every
// RNG(seed) instance in the codebase at the source -- Fight's own this.rng/this.presRng, AI.make,
// Ctrl.random, and Crystal itself, which no longer needs its own separate warm-up (see its own comment,
// 12_meta.js). `next`/`int`/`pick` are unchanged; only construction now runs 8 throwaway steps first.
function RNG(seed){let s=(seed>>>0)||0x9e3779b9;
  const step=()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296};
  for(let i=0;i<8;i++)step();
  return{next:step,int(n){return Math.floor(this.next()*n)},pick(a){return a[this.int(a.length)]}}}
