'use strict';
const W=854,H=480,FLOOR=400,STEP=1/60;
const canvas=document.getElementById('game');
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
// xorshift32; deterministic per seed. Never use Math.random inside the sim.
function RNG(seed){let s=(seed>>>0)||0x9e3779b9;return{
  next(){s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296},
  int(n){return Math.floor(this.next()*n)},
  pick(a){return a[this.int(a.length)]}}}
