'use strict';
const W=854,H=480,FLOOR=400,STEP=1/60;
const canvas=document.getElementById('game');
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
// Screen-space y a rig's topmost point must clear: portraits/hp bars end around y=70, the floor-line
// text around y=96, so 104 leaves a few px of breathing room. Shared by Camera's per-fight zoom cap
// (65_stage.js/80_game.js) and its own regression test (90_tests.js) so all three read one number.
const HUD_LINE=104;
// xorshift32; deterministic per seed. Never use Math.random inside the sim.
function RNG(seed){let s=(seed>>>0)||0x9e3779b9;return{
  next(){s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296},
  int(n){return Math.floor(this.next()*n)},
  pick(a){return a[this.int(a.length)]}}}
