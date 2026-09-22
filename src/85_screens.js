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
    const path=document.getElementById('mapPath');path.innerHTML='';
    if(f){
      // Fix-wave item 6: a non-'open' node is disabled -- it used to be a live button that looked
      // and clicked exactly like an open one, silently refusing (via a toast an overlay painted
      // over) instead of visibly blocking the click in the first place.
      f.nodes.forEach((node,i)=>{
        const b=document.createElement('button');
        b.className='node '+node.state;
        b.textContent='DOOR '+(i+1);
        b.disabled=node.state!=='open';
        b.onclick=()=>{Screens._origin={name:'map',args:[n]};
          G.startFight({floor:n,node:i,champ:Save.data.active})};
        path.appendChild(b)});
      const boss=document.createElement('button');
      boss.className='node boss '+f.boss.state;
      boss.textContent='BOSS';
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
  // ---- roster --------------------------------------------------------------------------------
  // Fix round 1 (controller review, Important): cards are a single-column, full-width row --
  // portrait | info | a horizontal action row -- so LEVEL UP/RANK UP/SELECT can be real 44px+
  // touch targets side by side, instead of the old 2-column grid's 3 stacked 26px buttons.
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
    if(rewards){
      const rt=G.rewardsText(rewards);
      if(rt)line=line?line+'  '+rt:rt}
    // Task 5.1: the ratings recap -- shown for every fight (win or loss), independent of rewards,
    // since viewers accrue off the fight itself, not off the quest/arena outcome.
    if(this._peakViewers!=null)line=(line?line+'  ':'')+'PEAK VIEWERS '+Render.fmtViewers(this._peakViewers);
    document.getElementById('resultLine').textContent=line;
    // FIGHT AGAIN replays the exact same options (G.lastFightOpts) -- meaningless right after a
    // quest win, since that node is now 'done' and Quest.start would just refuse it; hidden then,
    // shown for every other outcome (a quest loss, any exhibition/arena result).
    const again=document.getElementById('again');
    again.style.display=(won&&G.mode==='quest')?'none':'';
    const cont=document.getElementById('resultTitleBtn');
    cont.textContent='CONTINUE';
    cont.onclick=()=>G.backToOrigin()}};
