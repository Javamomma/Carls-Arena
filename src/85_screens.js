'use strict';
// Screens: the thin DOM layer for Phase 4's meta (title, map, roster, crystal, shop, arena,
// result). No Save.data mutation happens directly here -- every button either calls a Meta
// function (Quest/Roster/Rewards/Crystal/Arena/Energy) or G.startFight/G.startArena, which is
// itself the one place p1's roster stats and quest/arena bookkeeping are applied (80_game.js).
// Concatenated (tools/build.py, alphabetical) after 80_game.js and before 90_tests.js, so every
// Meta/FLOORS/CHAMPS/DEFS/Rig/G symbol it reads already exists by the time any Screens function
// actually runs (G.init() itself only binds handlers at parse time; nothing calls into Screens
// until a later click or G.loop's first rAF frame, both well after the whole script has parsed).
const Screens={
  _current:null,   // the overlay name Screens.show most recently rendered ('title' at load)
  _floor:1,        // last floor Screens.map() rendered, read back by a bare Screens.show('map')
  _origin:{name:'title'}, // where a launched fight should return to on backToOrigin (CONTINUE/QUIT)
  _reveal:null,    // {kind,result,frame} while a crystal-opening reveal is animating; else null
  REVEAL_FRAMES:40,
  // Fixed table of what each name shows/renders; kept as one object so show()/refresh() share it
  // instead of a chain of if/else per screen name.
  RENDER:{title:'renderTitle',map:'renderMap',roster:'renderRoster',crystal:'renderCrystal',
    shop:'renderShop',arena:'renderArena',result:'renderResult',settings:'renderSettings'},
  // Hides every Phase 4 overlay (plus pauseMenu, so the pause menu's QUIT and the result screen's
  // CONTINUE -- both of which land here through backToOrigin -- never leave it stuck on screen
  // over a browsing screen) and the touch buttons, shows exactly `name`, then renders it. The
  // concrete spec calls `Screens.show('map')` directly and expects it already populated (not just
  // visible) -- so show() both toggles AND renders, and Screens.map/roster/... below are thin
  // wrappers that stash their arg (if any) and call this.
  show(name){
    for(const id of['title','map','roster','crystal','shop','arena','result','pauseMenu','settings'])G.show(id,id===name);
    G.show('btns',false);
    this._current=name;
    const fn=this.RENDER[name];
    if(fn)this[fn]();
  },
  title(){this.show('title')},
  map(n){this._floor=n||this._floor||1;this.show('map')},
  roster(){this.show('roster')},
  // Fix-wave item 10: _reveal used to persist across navigation -- re-entering the crystal screen
  // (without a fresh pull) replayed the PREVIOUS pull's completed reveal text as if it were new.
  // Cleared here so a fresh entry always starts blank; openCrystal sets a new one right after this
  // when it's the one driving navigation, so an in-flight open is unaffected.
  crystal(){this._reveal=null;this.show('crystal')},
  shop(){this.show('shop')},
  arena(){this.show('arena')},
  // Task 5.1: peakViewers (G.onFightEnd's Broadcast.state.peak snapshot) is a third, optional arg --
  // no other caller in the codebase passes it (G's own no-Screens fallback in onFightEnd builds its
  // #resultLine text directly instead), but every real click-through path (Screens.show->this) does.
  result(rewards,won,peakViewers){this._rewards=rewards;this._won=won;this._peakViewers=peakViewers;this.show('result')},
  // Task 5.4: not a fight-launching screen, so BACK just goes straight to the title (same pattern as
  // map/roster/crystal/shop/arena's own BACK -- none of them route through toOrigin()/_origin either).
  settings(){this.show('settings')},
  // Called from G.startFight the instant a fight actually begins (title/result/pauseMenu are
  // already hidden there directly) -- a fight can be launched from any browsing screen (a map
  // node, arena's FIGHT, exhibition off the title screen), so whichever one is still up needs
  // hiding too, or it would linger visually over the fight underneath.
  hideAll(){for(const id of['title','map','roster','crystal','shop','arena','settings'])G.show(id,false);this._current=null},
  // Re-renders whatever screen is currently up (no visibility change) -- called after any Meta
  // mutation a button on that screen just made, so costs/affordability/counts reflect it
  // immediately without a full show() (which would also re-toggle overlay classes for no reason).
  refresh(){const fn=this.RENDER[this._current];if(fn)this[fn]()},
  // Where CONTINUE (result) and QUIT (pause menu) return to: the screen that actually launched the
  // fight, recorded as {name,args} by that screen's own button handler below. Falls back to the
  // title screen for anything started without going through a screen at all (tests calling
  // G.startFight directly, or the very first load).
  toOrigin(){
    const o=this._origin||{name:'title'};
    if(o.name==='map')this.map(o.args&&o.args[0]);
    else if(typeof this[o.name]==='function')this[o.name]();
    else this.title()},
  lastFloor(){const ks=Object.keys(Save.data.floors).map(Number);return ks.length?Math.max.apply(null,ks):1},
  // ---- title -------------------------------------------------------------------------------
  renderTitle(){
    // Task 5.4: the title screen's old bare SOUND toggle became a SETTINGS button -- SOUND itself
    // (#titleMute, still the one place Audio.muted/Save.data.mute actually flip -- see G.init())
    // moved into the new #settings overlay as one more toggle row; renderSettings() below is what
    // syncs its label text now, since that's the screen it actually lives on.
    document.getElementById('btnSettings').onclick=()=>Screens.settings();
    // Task 5.3: a fresh save (!Save.data.tutorialDone) routes CAMPAIGN to the tutorial instead of the
    // map -- checked fresh on every click (not just latched at load), so CAMPAIGN opens the map as
    // usual again the instant tutorialDone flips true, with no separate "first run" flag to track.
    document.getElementById('btnCampaign').onclick=()=>{
      if(!Save.data.tutorialDone){Screens._origin={name:'map',args:[1]};G.startTutorial();return}
      const n=Screens.lastFloor();
      Screens._origin={name:'map',args:[n]};Screens.map(n)};
    document.getElementById('btnArenaMenu').onclick=()=>{Screens._origin={name:'arena'};Screens.arena()};
    document.getElementById('btnRoster').onclick=()=>{Screens._origin={name:'title'};Screens.roster()};
    document.getElementById('btnKiosk').onclick=()=>{Screens._origin={name:'title'};Screens.shop()};
    // EXHIBITION: the old single-button title's FIGHT (carl vs donut, mode 'exhibition' -- no
    // floor/encounter passed) -- Audio.init() unlocks the AudioContext on this first real gesture,
    // same as the old fightBtn did.
    document.getElementById('btnExhibition').onclick=()=>{Screens._origin={name:'title'};
      Audio.init();G.startFight()}},
  // ---- settings ------------------------------------------------------------------------------
  // Task 5.4: one row per Save.data.settings key, 44px-tall toggle buttons (the frozen interface's
  // own wording) rendered from this table instead of six hand-copied blocks -- same "render from a
  // table" pattern Meta.SHOP_ITEMS/Sponsors.PERKS above already use for the kiosk. useAtlas ships
  // here (a real, persisted toggle) even though nothing reads it yet outside this screen -- its
  // consumer (Rig.draw's atlas short-circuit) is a different task; the settings SHAPE is frozen for
  // all of Phase 5, not just this one.
  SETTINGS_ROWS:[
    {key:'reduceMotion',label:'REDUCE MOTION'},
    {key:'haptics',label:'HAPTICS'},
    {key:'leftHanded',label:'LEFT-HANDED CONTROLS'},
    // Task 6.3: BLOCK/PUNCH/KICK are optional now that the whole canvas is a gesture surface --
    // this toggle (off by default) is the only way to bring them back outside the tutorial's forced
    // early lessons (G.forceButtons). The generic onclick handler below already calls
    // G.applySettings() after flipping any row's key, which is what actually shows/hides them
    // (body.show-atk, 00_head.html) and re-runs the toast gap math (G.positionToast) -- no extra
    // wiring needed here.
    {key:'showButtons',label:'SHOW ATTACK BUTTONS'},
    {key:'useAtlas',label:'USE SPRITE ATLAS'},
    {key:'sfx',label:'SOUND EFFECTS'},
    {key:'announcer',label:'ANNOUNCER TEXT'}],
  renderSettings(){
    // SOUND (#titleMute) lives as static markup inside #settings now (00_head.html) -- its click
    // handler stays bound once in G.init() (unchanged since before Task 4.5); this just syncs its
    // label text every time the settings screen renders, same as renderTitle() used to.
    document.getElementById('titleMute').textContent='SOUND: '+(Audio.muted?'OFF':'ON');
    const wrap=document.getElementById('settingsRows');wrap.innerHTML='';
    for(const row of Screens.SETTINGS_ROWS){
      const on=!!Save.data.settings[row.key];
      const btn=document.createElement('button');
      btn.className='setrow';btn.id='set_'+row.key;
      btn.textContent=row.label+': '+(on?'ON':'OFF');
      btn.onclick=()=>{Save.data.settings[row.key]=!Save.data.settings[row.key];Save.put();
        G.applySettings();Screens.refresh()};
      wrap.appendChild(btn)}
    document.getElementById('settingsBack').onclick=()=>Screens.title()},
  // Fix-wave item 10: a gold/units/iso strip, shared by the map and crystal screens (the kiosk
  // already had its own, richer one -- shopCurrency -- with class catalysts too, since rankUp spends
  // those there; map/crystal never spend catalysts, so this stays to the three main currencies).
  renderCurrency(elId){
    const el=document.getElementById(elId);
    if(!el)return;
    el.innerHTML=['GOLD '+(Save.data.gold||0),'UNITS '+(Save.data.units||0),'ISO '+(Save.data.iso||0)]
      .map(s=>'<span>'+s+'</span>').join('')},
  // ---- map (campaign) -----------------------------------------------------------------------
  renderMap(){
    Energy.tick(); // regen before reading/displaying it or gating node clicks below
    Screens.renderCurrency('mapCurrency');
    const n=this._floor;
    const f=Quest.floor(n);
    const heading=document.querySelector('#map h2');
    heading.textContent=f?f.name:'CAMPAIGN';
    const tabs=document.getElementById('mapTabs');tabs.innerHTML='';
    for(const fd of FLOORS){
      const unlocked=!!Save.data.floors[fd.floor];
      const b=document.createElement('button');
      b.className='ftab'+(fd.floor===n?' active':'');
      b.textContent='FLOOR '+fd.floor;
      b.disabled=!unlocked;
      b.onclick=()=>Screens.map(fd.floor);
      tabs.appendChild(b)}
    // Task 5.3: a permanently-open TUTORIAL entry, appended into the floor-tabs row rather than the
    // node path below -- .ftabs' own row height is already pinned to its tallest existing child
    // (44px), so adding one more same-height button costs zero extra vertical space, unlike appending
    // another .node row to #mapPath, which the "no clipping/scroll at 854x480" fix-wave item 3 test
    // already fills to its worst case (every one of floor 1's nodes 'open' at once). Unlike every
    // real node/boss button it never disables and never routes through Quest.start (G.startTutorial
    // spends no energy, same as any bare o.encounter id).
    if(n===1){
      const t=document.createElement('button');
      t.className='node tutorial';
      t.textContent='TUTORIAL';
      t.onclick=()=>{Screens._origin={name:'map',args:[n]};G.startTutorial()};
      tabs.appendChild(t)}
    const path=document.getElementById('mapPath');path.innerHTML='';
    if(f){
      // Fix-wave item 6: a non-'open' node is disabled -- it used to be a live button that looked
      // and clicked exactly like an open one, silently refusing (via a toast an overlay painted
      // over) instead of visibly blocking the click in the first place.
      // Task 6.4 (frozen interface: "CONTINUE → map with DOOR 1 highlighted, .node.next pulsing
      // once"): DOOR 1 (floor 1, node 0) only, only on the very map render right after a first-time
      // tutorial completion (G.tutorialJustGranted -- G.onFightEnd sets it, cleared the instant it's
      // consumed here so it never pulses again on a later map visit or a tutorial replay).
      const highlightDoor1=n===1&&G.tutorialJustGranted;
      f.nodes.forEach((node,i)=>{
        const b=document.createElement('button');
        b.className='node '+node.state+(i===0&&highlightDoor1?' next':'');
        b.appendChild(Screens.doorStack('DOOR '+(i+1),node.enc,node.state));
        b.disabled=node.state!=='open';
        b.onclick=()=>{Screens._origin={name:'map',args:[n]};
          G.startFight({floor:n,node:i,champ:Save.data.active})};
        path.appendChild(b)});
      if(highlightDoor1)G.tutorialJustGranted=false;
      const boss=document.createElement('button');
      boss.className='node boss '+f.boss.state;
      boss.appendChild(Screens.doorStack('BOSS',f.boss.enc,f.boss.state));
      boss.disabled=f.boss.state!=='open';
      boss.onclick=()=>{Screens._origin={name:'map',args:[n]};
        G.startFight({floor:n,node:'boss',champ:Save.data.active})};
      path.appendChild(boss)}
    const erow=document.getElementById('mapEnergy');erow.innerHTML='';
    const e=Save.data.energy;
    for(let i=0;i<e.max;i++){
      const p=document.createElement('div');p.className='pip'+(i<e.n?' full':'');erow.appendChild(p)}
    // Fix-wave item 6: clear any refusal message left over from a previous click every time the map
    // re-renders (floor switch, refresh, or a fresh Screens.map) -- G.refuseQuest is the only other
    // writer, and only ever sets it, never clears it.
    document.getElementById('mapMsg').textContent='';
    document.getElementById('mapBack').onclick=()=>Screens.title()},
  // Task 6.1, ruling 3 (owner playtest note: "recommended LVL 4" hint wanted on the hobgoblin): a
  // door/boss button's label plus a small "REC. LVL n" line under it, red (.under) when the active
  // roster champion's level is below ENCOUNTERS[encId].recLevel -- purely informational, never
  // disables the door (still enterable; state/energy gating is the caller's own .disabled, set right
  // after this in renderMap). Every real FLOORS-referenced encounter carries a recLevel now, but this
  // stays defensive (no hint span at all) for any future node that doesn't.
  // Task 8.5: doorStack now wraps a door-card canvas (the arch/torch/portrait/banner illustration
  // below) alongside its original label + REC. LVL text, in a horizontal row -- the label/hint stay
  // plain DOM text (not baked into the canvas) so Task 6.1's own REC. LVL test keeps working
  // unchanged and the hint stays trivially readable/testable rather than needing pixel inspection.
  doorStack(label,encId,state){
    const stack=document.createElement('span');stack.className='doorstack';
    stack.appendChild(Screens.doorCard(encId,state));
    const text=document.createElement('span');text.className='doortext';
    const l=document.createElement('span');l.className='doorlabel';l.textContent=label;text.appendChild(l);
    const recLevel=ENCOUNTERS[encId]&&ENCOUNTERS[encId].recLevel;
    if(recLevel!=null){
      const entry=Save.data.roster[Save.data.active];
      const level=entry?entry.level:1;
      const hint=document.createElement('span');
      hint.className='reclvl'+(level<recLevel?' under':'');
      hint.textContent='REC. LVL '+recLevel;
      text.appendChild(hint)}
    stack.appendChild(text);
    return stack},
  // ---- Task 8.5: map door cards --------------------------------------------------------------
  // A small procedural illustration per node -- a stone arch, a torch (Stage's own TORCH_TINT, so
  // it reads as the same light source the in-fight stage lighting model uses), the encounter
  // enemy's own 112px HUD bust (Rig.portrait, Task 8.1/8.2), and a floor-number banner -- replacing
  // the old plain-text-only doorstack. Cached per node id + state (Boundaries: "no per-render redraw
  // of every card") keyed on `encId+'|'+state`: a floor switch or a Screens.refresh() with nothing
  // actually changed about that node hands back the exact same canvas instead of repainting it; only
  // a real state flip (a door going open -> done on a win, or unlocking) produces a new cache entry,
  // and the old entry for the state it left behind is simply never touched again.
  _doorCache:{},
  DOOR_W:80,DOOR_H:104,
  doorCard(encId,state){
    const key=encId+'|'+state;
    let cnv=this._doorCache[key];
    if(cnv)return cnv;
    cnv=document.createElement('canvas');cnv.className='doorcard';cnv.dataset.state=state;
    cnv.width=this.DOOR_W;cnv.height=this.DOOR_H;
    Screens._paintDoorCard(cnv.getContext('2d'),encId,state);
    this._doorCache[key]=cnv;
    return cnv},
  _paintDoorCard(c,encId,state){
    const W=Screens.DOOR_W,H=Screens.DOOR_H,enc=ENCOUNTERS[encId],def=DEFS[enc.enemy],look=lookFor(def);
    const locked=state==='locked',done=state==='done';
    c.save();
    // stone jamb + arch mouth: a plain doorway silhouette so the portrait inset reads as "standing
    // in a doorway", not a floating headshot; a locked door's stone reads darker/flatter even before
    // the full dim overlay below, so a quick glance (not just the lock glyph) reads "not open yet".
    c.fillStyle='#1c1f2c';c.fillRect(0,0,W,H);
    c.fillStyle=locked?'#14161f':'#262b40';
    c.beginPath();c.moveTo(6,H-6);c.lineTo(6,28);c.quadraticCurveTo(6,6,W/2,6);
    c.quadraticCurveTo(W-6,6,W-6,28);c.lineTo(W-6,H-6);c.closePath();c.fill();
    c.strokeStyle=locked?'#000':'#3a3f56';c.lineWidth=2;c.stroke();
    // torch: a small flame glyph on the left jamb -- skipped on a locked door (nothing's lit yet).
    if(!locked){
      const tx=12,ty=H-24;
      c.fillStyle=Stage.TORCH_TINT;
      c.beginPath();c.moveTo(tx,ty+8);c.quadraticCurveTo(tx-4,ty,tx,ty-8);
      c.quadraticCurveTo(tx+4,ty,tx,ty+8);c.fill();
      c.fillStyle='#6a4a2a';c.fillRect(tx-1.5,ty+6,3,10)}
    // portrait: the encounter enemy's own 112px HUD bust, scaled down into the arch mouth -- the
    // same bitmap Rig.portrait already builds and caches for the in-fight HUD/roster, so the door
    // card, the roster card and the fight sprite are demonstrably the same character.
    const port=Rig.portrait(look,112),pw=48,ph=48,px=W/2-pw/2,py=20;
    c.drawImage(port,px,py,pw,ph);
    // floor banner: a small ribbon across the bottom third, state-colored, showing the floor number.
    c.fillStyle=done?'#2c4a2c':locked?'#1a1a22':'#3a2f1a';
    c.fillRect(6,H-20,W-12,14);
    c.strokeStyle='#000';c.lineWidth=1;c.strokeRect(6.5,H-19.5,W-13,13);
    c.fillStyle=done?'#8fd18a':locked?'#555':'#f4c542';
    c.font='bold 9px ui-monospace,monospace';c.textAlign='center';c.textBaseline='middle';
    c.fillText('F'+enc.floor,W/2,H-13);
    // locked/done overlay, drawn last so it covers the whole card (including the corner the
    // brightness-comparison test above samples) -- a locked door dims hard and shows a lock glyph;
    // a cleared one tints faintly green and shows a check, without hiding the art underneath.
    if(locked){
      c.fillStyle='rgba(0,0,0,.55)';c.fillRect(0,0,W,H);
      c.fillStyle='#999';c.font='16px ui-monospace,monospace';c.textAlign='center';c.textBaseline='middle';
      c.fillText('\u{1F512}',W/2,H/2)}
    else if(done){
      c.fillStyle='rgba(20,40,20,.35)';c.fillRect(0,0,W,H);
      c.strokeStyle='#7fd18a';c.lineWidth=3;c.lineCap='round';c.lineJoin='round';
      c.beginPath();c.moveTo(W*.28,H*.5);c.lineTo(W*.44,H*.64);c.lineTo(W*.74,H*.32);c.stroke()}
    c.restore()},
  // Task 8.5: the roster card's own portrait+frame, one canvas combining the 112px HUD bust
  // (Rig.portrait, Tasks 8.1/8.2) with the in-fight HUD's own class-gem ring (Render.portraitFrame/
  // CLS_GEM, Task 8.4) so a roster champion reads with the same class identity the fight HUD gives
  // them. PCARD_PAD leaves room for portraitFrame's own ring (which draws slightly outside the
  // portrait's x/y/size box) and PCARD_GEM_H leaves room below that for its gem badge
  // (Render.gemCenter sits at y+size+6, gem radius 5 -- see that function's own comment, 70_render.js).
  PCARD_PAD:4,PCARD_GEM_H:14,
  portraitCard(look,size,cls){
    const PAD=Screens.PCARD_PAD,GEM_H=Screens.PCARD_GEM_H;
    const cnv=document.createElement('canvas');cnv.className='pcard';
    cnv.width=size+PAD*2;cnv.height=size+PAD*2+GEM_H;
    const c=cnv.getContext('2d');
    c.drawImage(Rig.portrait(look,size),PAD,PAD,size,size);
    Render.portraitFrame(c,PAD,PAD,size,cls);
    return cnv},
  // ---- roster --------------------------------------------------------------------------------
  // Fix round 1 (controller review, Important): cards are a single-column, full-width row --
  // portrait | info | a horizontal action row -- so LEVEL UP/RANK UP/SELECT can be real 44px+
  // touch targets side by side, instead of the old 2-column grid's 3 stacked 26px buttons.
  renderRoster(){
    const wrap=document.getElementById('rosterCards');wrap.innerHTML='';
    for(const id of Object.keys(Save.data.roster)){
      const entry=Save.data.roster[id],def=CHAMPS[id];
      const card=document.createElement('div');card.className='card'+(id===Save.data.active?' active':'');
      const portrait=Screens.portraitCard(lookFor(def),112,def.cls);
      const info=document.createElement('div');info.className='info';
      const capLvl=Stats.caps.level(entry.rank),atCap=entry.level>=capLvl;
      const xpNeed=Stats.xpToLevel(entry.level+1);
      const pct=atCap?100:Math.max(0,Math.min(100,Math.round(100*entry.xp/xpNeed)));
      info.innerHTML=
        // Fix-wave item 5: shard count shown as N/5 next to the stars -- after shards became the
        // only thing crystals actually produce once the roster is full, the roster screen showed
        // stars/level but never the one number that says how close a champion is to its next star.
        '<div class="name">'+def.name+'<span class="stars">'+
          '★'.repeat(entry.stars)+'☆'.repeat(5-entry.stars)+
          '</span><span class="shards">'+(entry.shards||0)+'/5</span></div>'+
        '<div class="rankline"><span class="pips">'+Array.from({length:entry.stars},(_,i)=>
          '<span class="rp'+(i<entry.rank?' on':'')+'"></span>').join('')+
          '</span><span class="lvl">LVL '+entry.level+(atCap?' (MAX)':'')+'</span></div>'+
        '<div class="xpbar"><i style="width:'+pct+'%"></i></div>';
      const actions=document.createElement('div');actions.className='actions';
      const lvlCost=10*entry.level;
      const lvlBtn=document.createElement('button');
      lvlBtn.textContent='LEVEL UP ('+lvlCost+' ISO)';
      lvlBtn.disabled=atCap||(Save.data.iso||0)<lvlCost;
      lvlBtn.onclick=()=>{Roster.levelUp(id);Screens.refresh()};
      const rankCap=entry.stars,atRankCap=entry.rank>=rankCap;
      const rankCost=entry.rank,cls=def.cls;
      const rankBtn=document.createElement('button');
      rankBtn.textContent='RANK UP ('+rankCost+' '+cls.toUpperCase()+')';
      rankBtn.disabled=atRankCap||(Save.data.cats[cls]||0)<rankCost;
      rankBtn.onclick=()=>{Roster.rankUp(id);Screens.refresh()};
      const selBtn=document.createElement('button');selBtn.className='select';
      const isActive=id===Save.data.active;
      selBtn.textContent=isActive?'ACTIVE':'SELECT';
      selBtn.disabled=isActive;
      selBtn.onclick=()=>{Roster.setActive(id);Screens.refresh()};
      actions.appendChild(lvlBtn);actions.appendChild(rankBtn);actions.appendChild(selBtn);
      card.appendChild(portrait);card.appendChild(info);card.appendChild(actions);
      wrap.appendChild(card)}
    document.getElementById('rosterBack').onclick=()=>Screens.title()},
  // ---- crystal (open) -------------------------------------------------------------------------
  canAfford(kind){
    const k=Crystal.KINDS[kind];
    for(const c in k.cost)if((Save.data[c]||0)<k.cost[c])return false;
    return true},
  costText(kind){
    const k=Crystal.KINDS[kind],parts=[];
    for(const c in k.cost)if(k.cost[c])parts.push(k.cost[c]+' '+c.toUpperCase());
    return parts.join(' + ')||'FREE'},
  resultText(r){
    const def=CHAMPS[r.champId];
    return r.dup?(def.name+' DUPLICATE — '+r.stars+'★ ('+r.shards+'/5 SHARDS)')
                :('NEW CHAMPION: '+def.name+' '+r.stars+'★')},
  // Shared by the standalone crystal screen's own OPEN buttons and the shop's BASIC/PREMIUM
  // CRYSTAL buy buttons (ruling #5 of the Phase 4 plan: "buying opens immediately via Crystal.open
  // and shows the reveal") -- Crystal.open itself already checks and deducts cost, so there's
  // nothing left for a screen to mutate directly; refresh/navigate first (so the now-updated
  // gold/units and a fresh reveal canvas are in the DOM), then arm the reveal, which tickReveal
  // (called from G.tick every frame, fight or no fight) advances frame by frame.
  openCrystal(kind){
    if(!Screens.canAfford(kind))return;
    const r=Crystal.open(kind);
    if(!r)return;
    if(Screens._current!=='crystal')Screens.crystal();else Screens.refresh();
    Screens._reveal={kind,result:r,frame:0}},
  renderCrystal(){
    Screens.renderCurrency('crystalCurrency');
    const wrap=document.getElementById('crystalCards');wrap.innerHTML='';
    for(const kind of['basic','premium']){
      const card=document.createElement('div');card.className='kcard';card.id='kcard_'+kind;
      const h=document.createElement('h3');h.textContent=kind.toUpperCase()+' CRYSTAL';
      const cost=document.createElement('div');cost.className='cost';cost.textContent=Screens.costText(kind);
      const cv=document.createElement('canvas');cv.width=140;cv.height=64;cv.id='revealCanvas_'+kind;
      const rtext=document.createElement('div');rtext.className='rtext';rtext.id='revealText_'+kind;
      const btn=document.createElement('button');btn.id='openBtn_'+kind;btn.textContent='OPEN';
      btn.disabled=!Screens.canAfford(kind);
      btn.onclick=()=>Screens.openCrystal(kind);
      card.appendChild(h);card.appendChild(cost);card.appendChild(cv);card.appendChild(rtext);card.appendChild(btn);
      wrap.appendChild(card);
      if(this._reveal&&this._reveal.kind===kind)Screens.drawReveal(this._reveal)}
    document.getElementById('crystalBack').onclick=()=>Screens.title()},
  // 40-frame, purely frame-counted (no Date.now()/performance.now()) progress ring; the outcome
  // itself was already decided by Crystal.open's RNG(Save.data.seed++) draw at click time -- this
  // is only ever a presentation delay before showing it.
  drawReveal(rv){
    const cv=document.getElementById('revealCanvas_'+rv.kind);
    if(!cv)return;
    const c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);
    const t=Math.min(1,rv.frame/Screens.REVEAL_FRAMES),cx=cv.width/2,cy=cv.height/2;
    c.strokeStyle='#f4c542';c.lineWidth=3;
    c.beginPath();c.arc(cx,cy,8+22*t,0,Math.PI*2*t);c.stroke();
    if(rv.frame>=Screens.REVEAL_FRAMES){
      const def=CHAMPS[rv.result.champId];
      c.fillStyle='#f4c542';c.font='bold 10px ui-monospace,monospace';c.textAlign='center';
      c.fillText(def.name,cx,cy+3);
      const el=document.getElementById('revealText_'+rv.kind);
      if(el)el.textContent=Screens.resultText(rv.result)}},
  // Called from G.tick every frame (fight or no fight -- see its comment); a no-op whenever no
  // reveal is in flight, or once one has already finished (frame pinned at REVEAL_FRAMES).
  tickReveal(){
    const rv=this._reveal;
    if(!rv||rv.frame>=Screens.REVEAL_FRAMES)return;
    rv.frame++;Screens.drawReveal(rv)},
  // ---- shop (SPONSOR PERK KIOSK) --------------------------------------------------------------
  // Fix-wave item 9 (Phase 5 seam, ruled): renders one card per Meta.SHOP_ITEMS entry instead of
  // three hand-copied blocks, so a future sponsor perk is just a new table entry, not a new block
  // here. A `run`-type item (a crystal) keeps the established reveal UX -- navigate to the crystal
  // screen and arm the reveal via Screens.openCrystal -- rather than Meta.buy's own plain
  // refuse/refresh, since Meta.buy would just call Crystal.open directly and lose that presentation.
  canAffordItem(itemId){
    const item=Meta.SHOP_ITEMS[itemId];
    for(const c in item.cost)if((Save.data[c]||0)<item.cost[c])return false;
    return true},
  // Task 5.2: same short-on-gold check Sponsors.buy itself does, exposed here so a card's BUY button
  // can start out correctly disabled instead of only refusing after a click.
  canAffordPerk(id){return(Save.data.gold||0)>=Sponsors.PERKS[id].cost},
  renderShop(){
    const cur=document.getElementById('shopCurrency');
    const catParts=Object.keys(Save.data.cats).map(c=>c.slice(0,4).toUpperCase()+' '+Save.data.cats[c]);
    cur.innerHTML=['GOLD '+Save.data.gold,'UNITS '+Save.data.units,'ISO '+Save.data.iso]
      .concat(catParts).map(s=>'<span>'+s+'</span>').join('');
    const wrap=document.getElementById('shopCards');wrap.innerHTML='';
    for(const itemId in Meta.SHOP_ITEMS){
      const item=Meta.SHOP_ITEMS[itemId];
      const card=document.createElement('div');card.className='kcard';
      const h=document.createElement('h3');h.textContent=item.label;
      const costTxt=Object.keys(item.cost).filter(c=>item.cost[c]).map(c=>item.cost[c]+' '+c.toUpperCase()).join(' + ');
      const cost=document.createElement('div');cost.className='cost';cost.textContent=costTxt;
      const btn=document.createElement('button');
      btn.id='buy'+itemId[0].toUpperCase()+itemId.slice(1);
      btn.textContent='BUY';
      btn.disabled=!Screens.canAffordItem(itemId);
      btn.onclick=item.run
        ?(()=>Screens.openCrystal(itemId==='basicCrystal'?'basic':'premium'))
        :(()=>{Meta.buy(itemId);Screens.refresh()});
      card.appendChild(h);card.appendChild(cost);card.appendChild(btn);
      wrap.appendChild(card)}
    // Task 5.2: a PERKS section beneath the consumable-item cards above -- a permanent, one-time
    // buy per perk (never a `run`/`grant` item, so it doesn't belong in Meta.SHOP_ITEMS), rendered
    // from Sponsors.PERKS the same "one table, one loop" way the cards above render from
    // Meta.SHOP_ITEMS. Compact list rows (not another row of big .kcard tiles) so both sections fit
    // 854x480 without scrolling in the common case; #shopBody (00_head.html) scrolls if they don't.
    const pwrap=document.getElementById('shopPerks');pwrap.innerHTML='';
    for(const id in Sponsors.PERKS){
      const perk=Sponsors.PERKS[id],owned=Sponsors.owned().includes(id);
      const row=document.createElement('div');row.className='perkrow';
      const info=document.createElement('div');info.className='pinfo';
      // Fix-wave item 3 (final review, Important): an effect line (Sponsors.DESC) between the name
      // and the cost -- see its own comment (13_broadcast.js) for the exact wording per perk.
      info.innerHTML='<div class="pname">'+(Sponsors.LABELS[id]||id.toUpperCase())+'</div>'+
        '<div class="pdesc">'+(Sponsors.DESC[id]||'')+'</div>'+
        '<div class="pcost">'+perk.cost+' GOLD</div>';
      const btn=document.createElement('button');
      btn.id='buyPerk'+id[0].toUpperCase()+id.slice(1);
      if(owned){btn.className='owned';btn.textContent='OWNED';btn.disabled=true}
      else{btn.textContent='BUY';btn.disabled=!Screens.canAffordPerk(id);
        btn.onclick=()=>{Sponsors.buy(id);Screens.refresh()}}
      row.appendChild(info);row.appendChild(btn);
      pwrap.appendChild(row)}
    document.getElementById('shopBack').onclick=()=>Screens.title()},
  // ---- arena ---------------------------------------------------------------------------------
  renderArena(){
    const a=Save.data.arena;
    document.getElementById('arenaStreak').textContent='STREAK '+a.streak;
    document.getElementById('arenaBest').textContent='BEST '+a.best;
    const prev=document.getElementById('arenaEnemy');prev.innerHTML='';
    const enc=Arena.start(); // pure preview -- reads Save.data.arena.streak only, no RNG/mutation
    const cv=Rig.portrait(lookFor(enc.enemy));
    const nm=document.createElement('div');nm.textContent=enc.enemy.name+' ('+enc.tier.toUpperCase()+')';
    prev.appendChild(cv);prev.appendChild(nm);
    document.getElementById('arenaFight').onclick=()=>{Screens._origin={name:'arena'};G.startArena()};
    // Task 5.1: top 5 of Save.data.leaderboard (already sorted/capped at 10 by Meta.recordScore) --
    // one row per entry, each cell its own <span> (renderCurrency's own pattern above) so a test can
    // assert on textContent without depending on exact spacing/punctuation.
    const lb=document.getElementById('arenaLeaderboard');
    if(lb){
      lb.innerHTML='';
      const h3=document.createElement('h3');h3.textContent='TOP VIEWERS';lb.appendChild(h3);
      (Save.data.leaderboard||[]).slice(0,5).forEach((e,i)=>{
        const row=document.createElement('div');row.className='lbrow';
        const champName=(CHAMPS[e.champ]&&CHAMPS[e.champ].name)||e.champ;
        const prog=e.floor!=null?('FLOOR '+e.floor):('STREAK '+e.streak);
        row.innerHTML=[String(i+1),Render.fmtViewers(e.viewers)+' VIEWERS',champName,prog,e.date]
          .map(s=>'<span>'+s+'</span>').join('');
        lb.appendChild(row)})}
    document.getElementById('arenaBack').onclick=()=>Screens.title()},
  // ---- result ----------------------------------------------------------------------------------
  // G.onFightEnd calls this with exactly (rewards, won) -- G.fight is still set at that point (not
  // cleared until toTitle/backToOrigin), so the hp line can still be built here even though it
  // isn't part of the frozen signature.
  renderResult(){
    const rewards=this._rewards,won=this._won;
    document.getElementById('resultTitle').textContent=won?'VICTORY':'DEFEATED';
    let line='';
    if(G.fight&&G.fight.winner){
      const w=G.fight.winner;
      line=w.def.name+' wins with '+Math.round(100*w.hp/w.maxHp)+'% health.'}
    // Fix-wave item 9 (final review, Minor): segments joined with ' · ' instead of two plain spaces,
    // which HTML collapses to one -- "+300 GOLD NEW CHAMPION: KATIA 1★ PEAK VIEWERS 1,283" used to
    // run every segment together with no visible separation at all.
    if(rewards){
      const rt=G.rewardsText(rewards);
      if(rt)line=line?line+' · '+rt:rt}
    // Task 5.3: the tutorial's own special line -- shown on every tutorial win, even a replay through
    // the map's .node.tutorial row (which never re-grants gold, see G.onFightEnd); the +300 GOLD
    // suffix only appears on the run that actually granted it (G.tutorialJustGranted).
    if(won&&G.mode==='tutorial'){
      const t='TUTORIAL COMPLETE'+(G.tutorialJustGranted?' — +300 GOLD':'');
      line=line?line+' · '+t:t;
      // Task 6.4: on a first completion only, the free basic crystal G.onFightEnd already opened
      // (G.tutorialFreeCrystal, Crystal.open('basic',{free:true})) gets the exact same result-line
      // text the standalone crystal screen's own reveal shows (Screens.resultText) -- "NEW CHAMPION:
      // KATIA 2★" for a fresh pull, or the dup/shards line if it happened to roll an already-owned
      // champion. Never shown on a replay (tutorialJustGranted false, tutorialFreeCrystal null).
      if(G.tutorialJustGranted&&G.tutorialFreeCrystal)
        line=line+' · '+Screens.resultText(G.tutorialFreeCrystal)}
    // Task 5.1: the ratings recap -- shown for every fight (win or loss), independent of rewards,
    // since viewers accrue off the fight itself, not off the quest/arena outcome.
    if(this._peakViewers!=null)line=(line?line+' · ':'')+'PEAK VIEWERS '+Render.fmtViewers(this._peakViewers);
    document.getElementById('resultLine').textContent=line;
    // Task 6.1 (frozen Phase 6 interface): FIGHT AGAIN only for an exhibition or arena WIN --
    // replaced the old "shown for every outcome except a quest win or any tutorial result" rule,
    // which is exactly what the owner's "No way to exit it seems after a defeat" playtest note was
    // running into (a quest LOSS used to show FIGHT AGAIN + one combined CONTINUE/TITLE button with
    // no dedicated, unconditional exit -- see below). Reasons the old per-mode exceptions no longer
    // apply, kept for anyone re-deriving this:
    // - quest: replaying the exact node right after a win is meaningless (Quest.start would refuse
    //   it, node's already 'done'); replaying after a LOSS is also dropped now -- CONTINUE already
    //   lands back on the open map node (Screens._origin), one tap into the same retry.
    // - tutorial: G.lastFightOpts for a tutorial fight is {encounter:'tutorial',mode:'tutorial',
    //   ctrl2:Ctrl.tutorialDummy(...),playerBuffs:[...,'noKo']}, and FIGHT AGAIN's own handler
    //   (G.init, 80_game.js) always calls startFight(opts) directly, never G.startTutorial(opts) --
    //   so it never runs Tutorial.reset(), replaying with Tutorial.state already at step 4/"FINISH
    //   HIM" pinned on screen and p2.guardActive already false. The map's own always-open TUTORIAL
    //   row is the one correct way to replay it.
    // - exhibition/arena LOSS: dropped for the same "CONTINUE/TITLE are enough" reason as quest.
    const again=document.getElementById('again');
    again.style.display=(won&&(G.mode==='exhibition'||G.mode==='arena'))?'':'none';
    // CONTINUE always routes to wherever this fight was launched from (Screens._origin); TITLE
    // (00_head.html) is a second, unconditional button -- always visible, always straight to the
    // title screen, win or lose, every mode -- the fix for "No way to exit it seems after a defeat":
    // a real escape hatch that doesn't depend on _origin resolving correctly. Both buttons' onclick
    // are already bound once in G.init() (never re-bound here, same as 'again'/'shareBtn' above);
    // only their text/labels are ever this render's own concern.
    document.getElementById('resultTitleBtn').textContent='CONTINUE'}};
