const Audio={ac:null,muted:Save.data.mute,_t:0,
  init(){if(!this.ac){try{this.ac=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(this.ac&&this.ac.state==='suspended')this.ac.resume()},
  tone(f,d=.08,type='square',v=.035,when=0){if(this.muted||!this.ac)return;const t=this.ac.currentTime+when,o=this.ac.createOscillator(),g=this.ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(this.ac.destination);o.start(t);o.stop(t+d+.02)},
  say(line){const el=document.getElementById('toast');el.textContent=line;clearTimeout(this._t);this._t=setTimeout(()=>{el.textContent=''},2200)},
  // Per-move sound recipes: short sequences of Audio.tone calls. Every entry is a plain function
  // that only calls this.tone (which itself no-ops when muted or before an AudioContext exists via
  // user gesture), so every recipe is safe to call from the headless test harness with no gesture.
  recipes:{
    lights(){Audio.tone(210,.05,'square',.045)},                                   // generic short thud (fallback)
    light1(){Audio.tone(200,.05,'square',.045)},
    light2(){Audio.tone(215,.05,'square',.045)},
    light3(){Audio.tone(230,.05,'square',.045)},
    light4(){Audio.tone(245,.05,'square',.048)},
    light5(){Audio.tone(260,.06,'square',.05);Audio.tone(120,.08,'sawtooth',.04,.02)}, // chain-ender: thud + low tail
    medium(){Audio.tone(620,.06,'sine',.02);Audio.tone(160,.1,'sawtooth',.05,.06)},     // whoosh then thud
    heavy(){Audio.tone(70,.08,'sawtooth',.03);Audio.tone(100,.08,'sawtooth',.03,.08);Audio.tone(140,.08,'sawtooth',.035,.16); // wind-up (rising)
      Audio.tone(65,.2,'square',.09,.26)},                                              // ...then crunch
    s1(){for(let i=0;i<3;i++)Audio.tone(280-i*25,.05,'square',.05,i*.07)},               // rapid hits
    s2(){for(let i=0;i<5;i++)Audio.tone(320-i*18,.05,'square',.05,i*.05)},               // rapid hits
    s3(){for(let i=0;i<5;i++)Audio.tone(140+i*55,.06,'sawtooth',.03,i*.05);              // rising sweep
      Audio.tone(50,.35,'square',.09,.34);Audio.tone(40,.3,'sawtooth',.08,.36)},         // ...then boom
    block(){Audio.tone(420,.04,'triangle',.03)},                                        // clack
    parry(){Audio.tone(880,.08,'square',.05);Audio.tone(1320,.12,'square',.04,.06)},     // chime
    dash(){Audio.tone(520,.1,'sine',.02);Audio.tone(300,.08,'sine',.015,.05)},           // whoosh
    ko(){for(let i=0;i<6;i++)Audio.tone(300-40*i,.15,'sawtooth',.05,i*.07)}},            // descending
  // rng.pick is deterministic given a seeded RNG (see 10_util.js), so the same fight rng state
  // always reads the same line for the same kind.
  pickLine(kind,rng){const arr=Lines[kind];return arr&&arr.length?rng.pick(arr):''},
  // Routes through G.say (defined in 80_game.js), which throttles how often the toast updates so a
  // burst of events (e.g. a streak landing right before a KO) doesn't overwrite itself mid-read.
  announce(kind,rng){G.say(this.pickLine(kind,rng))}};
// Snarky dungeon-game-show-host lines, Dungeon Crawler Carl flavored (Carl, Donut, the dungeon,
// sponsors, viewers). No profanity. Picked deterministically via Audio.pickLine(kind, fight.rng).
const Lines={
  start:[
    "Ladies, gentlemen, and things with too many eyes: welcome back to the dungeon!",
    "Tonight's doorway brawl is brought to you by our sponsors, who remain legally distinct from the dungeon.",
    "Carl steps up. Donut watches from the rafters, unimpressed as usual.",
    "The crowd holds its breath. The crowd does not have insurance.",
    "Let's give a warm, damp welcome to tonight's combatants!",
    "Somewhere, a goblin is polishing its resume. Let's see if it needs an update.",
    "This doorway has seen things. Tonight it sees one more.",
    "Sponsors, viewers, and one extremely judgmental cat: the fight begins!",
    "The dungeon dims the torches. Showtime."],
  streak3:[
    "Three in a row! Someone's been practicing between commercials.",
    "A three-hit combo! The sponsors are thrilled. The other fighter is not.",
    "Three! The crowd is starting to believe in something.",
    "Three straight hits. The dungeon takes notes.",
    "Triple combo! Donut raises an eyebrow, which is a big deal for a cat.",
    "Three hits landed. Someone's getting a highlight reel.",
    "That's three! The viewers at home are refreshing their bets.",
    "A three-piece combo, no sauce required.",
    "Three consecutive! The dungeon's insurance premiums just went up."],
  streak5:[
    "Five hits! This is starting to look less like a fight and more like a lesson.",
    "Five in a row! Someone forgot to bring their own combo.",
    "A five-hit streak! Carl's fan club just doubled in size.",
    "Five straight! The sponsors are printing extra merchandise as we speak.",
    "Five! The dungeon walls are practically applauding.",
    "That's a five-piece! Someone owes the vending machine an apology.",
    "Five hits landed clean. The other combatant is reconsidering career options.",
    "Five in a row! Even the torches are flickering with excitement.",
    "A five-hit streak, and the crowd has never been louder or wetter."],
  streak10:[
    "TEN HITS! Somebody call the record books, or at least the janitor.",
    "A perfect ten! The sponsors have officially run out of confetti.",
    "Ten in a row! This is no longer a fight, it's a demonstration.",
    "TEN! Donut has stopped pretending not to care.",
    "Ten consecutive hits! The dungeon itself seems nervous.",
    "A ten-hit combo! Somewhere, a scoreboard just caught fire.",
    "TEN STRAIGHT! The viewers have officially lost their minds, in a good way.",
    "Ten hits landed! We may need a new doorway after this.",
    "A perfect ten-combo! Even the sponsors are speechless, and they never shut up."],
  parry:[
    "PARRIED! The crowd gasps, then immediately asks for a replay.",
    "A clean parry! Someone's been reading the dungeon's fine print.",
    "Parry! That attack is going to need a moment to recover its dignity.",
    "Reversal! The sponsors did not see that coming, and neither did the attacker.",
    "PARRY! Donut nods approvingly from the rafters.",
    "A textbook parry! Someone deserves a raise, or at least a snack.",
    "Parried clean! The dungeon briefly considers a career change.",
    "That parry was so crisp, the viewers can hear it from home.",
    "PARRY! The attacker is now questioning several life choices."],
  special:[
    "SPECIAL MOVE INCOMING! Sponsors, please look away from the screen.",
    "Now THAT'S a power move! The dungeon's lighting budget just spiked.",
    "A special attack! Someone's been saving up their allowance.",
    "Big flashy move! The viewers demand a slow-motion replay, and they shall have one.",
    "Power unleashed! Donut is filming this for the highlight reel.",
    "SPECIAL! The sponsors are already drafting the merchandise.",
    "That's the good stuff! The dungeon lights dim in respect.",
    "A special move, executed with the subtlety of a falling piano.",
    "Power move! Somewhere, a producer just yelled 'get the good camera'."],
  win:[
    "VICTORY! The crowd erupts, mostly out of relief.",
    "And there it is! Our winner stands, somehow still standing.",
    "That's the fight! Sponsors, roll the confetti, we earned it.",
    "WINNER! Donut gives a single, dignified clap.",
    "Victory secured! Somebody get this contestant a towel and a contract.",
    "The doorway has chosen its champion. The dungeon approves.",
    "That's a win for the ages, or at least for tonight's ratings.",
    "Our champion stands tall! The sponsors are already planning a sequel.",
    "VICTORY! The crowd is on its feet, and so, remarkably, is the winner."],
  loss:[
    "And down they go. The dungeon claims another contestant.",
    "That's a loss, folks. The floor remains undefeated.",
    "DEFEAT! Someone update the scoreboard, gently.",
    "The dungeon wins this round. It usually does.",
    "Down for the count. Donut looks away, tactfully.",
    "That's a loss. The sponsors are already drafting the condolence merch.",
    "The challenger falls. The dungeon, as ever, remains smug.",
    "Defeat! Somewhere, a producer sighs and reaches for the replay button.",
    "The dungeon closes the door. Softly. Permanently, for now."]};
