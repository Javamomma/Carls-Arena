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
    shop:'renderShop',arena:'renderArena',result:'renderResult'},
  // Hides every Phase 4 overlay (plus pauseMenu, so the pause menu's QUIT and the result screen's
  // CONTINUE -- both of which land here through backToOrigin -- never leave it stuck on screen
  // over a browsing screen) and the touch buttons, shows exactly `name`, then renders it. The
  // concrete spec calls `Screens.show('map')` directly and expects it already populated (not just
  // visible) -- so show() both toggles AND renders, and Screens.map/roster/... below are thin
  // wrappers that stash their arg (if any) and call this.
  show(name){
    for(const id of['title','map','roster','crystal','shop','arena','result','pauseMenu'])G.show(id,id===name);
    G.show('btns',false);
    this._current=name;
    const fn=this.RENDER[name];
    if(fn)this[fn]();
  },
  title(){this.show('title')},
  map(n){this._floor=n||this._floor||1;this.show('map')},
  roster(){this.show('roster')},
  crystal(){this.show('crystal')},
  shop(){this.show('shop')},
  arena(){this.show('arena')},
  result(rewards,won){this._rewards=rewards;this._won=won;this.show('result')},
  // Called from G.startFight the instant a fight actually begins (title/result/pauseMenu are
  // already hidden there directly) -- a fight can be launched from any browsing screen (a map
  // node, arena's FIGHT, exhibition off the title screen), so whichever one is still up needs
  // hiding too, or it would linger visually over the fight underneath.
  hideAll(){for(const id of['title','map','roster','crystal','shop','arena'])G.show(id,false);this._current=null},
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
    // The SOUND button's click handler (the one place that actually flips Audio.muted/Save.data.mute)
    // stays bound in G.init() (80_game.js), unchanged from before Task 4.5 -- Screens only syncs the
    // label text here (read-only) so it reflects the persisted mute state whenever title is shown.
    document.getElementById('titleMute').textContent='SOUND: '+(Audio.muted?'OFF':'ON');
    document.getElementById('btnCampaign').onclick=()=>{const n=Screens.lastFloor();
      Screens._origin={name:'map',args:[n]};Screens.map(n)};
    document.getElementById('btnArenaMenu').onclick=()=>{Screens._origin={name:'arena'};Screens.arena()};
    document.getElementById('btnRoster').onclick=()=>{Screens._origin={name:'title'};Screens.roster()};
    document.getElementById('btnKiosk').onclick=()=>{Screens._origin={name:'title'};Screens.shop()};
    // EXHIBITION: the old single-button title's FIGHT (carl vs donut, mode 'exhibition' -- no
    // floor/encounter passed) -- Audio.init() unlocks the AudioContext on this first real gesture,
    // same as the old fightBtn did.
    document.getElementById('btnExhibition').onclick=()=>{Screens._origin={name:'title'};
      Audio.init();G.startFight()}},
  // ---- map (campaign) -----------------------------------------------------------------------
  renderMap(){
    Energy.tick(); // regen before reading/displaying it or gating node clicks below
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
    const path=document.getElementById('mapPath');path.innerHTML='';
    if(f){
      f.nodes.forEach((node,i)=>{
        const b=document.createElement('button');
        b.className='node '+node.state;
        b.textContent='DOOR '+(i+1);
        b.onclick=()=>{Screens._origin={name:'map',args:[n]};
          G.startFight({floor:n,node:i,champ:Save.data.active})};
        path.appendChild(b)});
      const boss=document.createElement('button');
      boss.className='node boss '+f.boss.state;
      boss.textContent='BOSS';
      boss.onclick=()=>{Screens._origin={name:'map',args:[n]};
        G.startFight({floor:n,node:'boss',champ:Save.data.active})};
      path.appendChild(boss)}
    const erow=document.getElementById('mapEnergy');erow.innerHTML='';
    const e=Save.data.energy;
    for(let i=0;i<e.max;i++){
      const p=document.createElement('div');p.className='pip'+(i<e.n?' full':'');erow.appendChild(p)}
    document.getElementById('mapBack').onclick=()=>Screens.title()},
  // ---- roster --------------------------------------------------------------------------------
  renderRoster(){
    const wrap=document.getElementById('rosterCards');wrap.innerHTML='';
    for(const id of Object.keys(Save.data.roster)){
      const entry=Save.data.roster[id],def=CHAMPS[id];
      const card=document.createElement('div');card.className='card'+(id===Save.data.active?' active':'');
      const portrait=Rig.portrait(lookFor(def));
      const info=document.createElement('div');info.className='info';
      const capLvl=Stats.caps.level(entry.rank),atCap=entry.level>=capLvl;
      const xpNeed=Stats.xpToLevel(entry.level+1);
      const pct=atCap?100:Math.max(0,Math.min(100,Math.round(100*entry.xp/xpNeed)));
      info.innerHTML=
        '<div class="name">'+def.name+'</div>'+
        '<div class="stars">'+'★'.repeat(entry.stars)+'☆'.repeat(5-entry.stars)+'</div>'+
        '<div class="pips">'+Array.from({length:entry.stars},(_,i)=>
          '<span class="rp'+(i<entry.rank?' on':'')+'"></span>').join('')+'</div>'+
        '<div class="lvl">LVL '+entry.level+(atCap?' (MAX)':'')+'</div>'+
        '<div class="xpbar"><i style="width:'+pct+'%"></i></div>';
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
      info.appendChild(lvlBtn);info.appendChild(rankBtn);info.appendChild(selBtn);
      card.appendChild(portrait);card.appendChild(info);
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
  // ISO PACK isn't a Crystal.KINDS entry (no draw, just a currency conversion), so it has no
  // dedicated Meta function of its own -- Rewards.grant already applies signed currency deltas
  // unconditionally, so a -200 gold/+60 iso grant is exactly a purchase, without adding a new
  // Meta-layer function for one card. Affordability is still checked here (read-only) before
  // calling it, same as every other buy button.
  ISO_PACK:{cost:{gold:200},iso:60},
  renderShop(){
    const cur=document.getElementById('shopCurrency');
    const catParts=Object.keys(Save.data.cats).map(c=>c.slice(0,4).toUpperCase()+' '+Save.data.cats[c]);
    cur.innerHTML=['GOLD '+Save.data.gold,'UNITS '+Save.data.units,'ISO '+Save.data.iso]
      .concat(catParts).map(s=>'<span>'+s+'</span>').join('');
    const wrap=document.getElementById('shopCards');wrap.innerHTML='';
    const mk=(id,label,costObj,afford,onclick)=>{
      const card=document.createElement('div');card.className='kcard';
      const h=document.createElement('h3');h.textContent=label;
      const costTxt=Object.keys(costObj).filter(c=>costObj[c]).map(c=>costObj[c]+' '+c.toUpperCase()).join(' + ');
      const cost=document.createElement('div');cost.className='cost';cost.textContent=costTxt;
      const btn=document.createElement('button');btn.id=id;btn.textContent='BUY';
      btn.disabled=!afford;btn.onclick=onclick;
      card.appendChild(h);card.appendChild(cost);card.appendChild(btn);
      wrap.appendChild(card)};
    mk('buyBasic','BASIC CRYSTAL',Crystal.KINDS.basic.cost,Screens.canAfford('basic'),
      ()=>Screens.openCrystal('basic'));
    mk('buyPremium','PREMIUM CRYSTAL',Crystal.KINDS.premium.cost,Screens.canAfford('premium'),
      ()=>Screens.openCrystal('premium'));
    const isoAfford=(Save.data.gold||0)>=Screens.ISO_PACK.cost.gold;
    mk('buyIso','ISO PACK',Screens.ISO_PACK.cost,isoAfford,()=>{
      if((Save.data.gold||0)<Screens.ISO_PACK.cost.gold)return;
      Rewards.grant({gold:-Screens.ISO_PACK.cost.gold,iso:Screens.ISO_PACK.iso});
      Screens.refresh()});
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
    if(rewards){
      const rt=G.rewardsText(rewards);
      if(rt)line=line?line+'  '+rt:rt}
    document.getElementById('resultLine').textContent=line;
    // FIGHT AGAIN replays the exact same options (G.lastFightOpts) -- meaningless right after a
    // quest win, since that node is now 'done' and Quest.start would just refuse it; hidden then,
    // shown for every other outcome (a quest loss, any exhibition/arena result).
    const again=document.getElementById('again');
    again.style.display=(won&&G.mode==='quest')?'none':'';
    const cont=document.getElementById('resultTitleBtn');
    cont.textContent='CONTINUE';
    cont.onclick=()=>G.backToOrigin()}};
