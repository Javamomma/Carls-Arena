const Save={key:'carlsArena.v1',bakKey:'carlsArena.v1.bak',data:null,
  // false once an unreadable save couldn't be backed up: the original stays untouched and play goes on in memory.
  writable:true,noteShown:0,
  load(){
    this.writable=true;
    let str=null;
    // An unreadable store may still hold a good save, so never write over it.
    try{str=localStorage.getItem(this.key)}catch(e){str=null;this.writable=false}
    let data=null;
    if(str!==null){
      let raw;
      try{raw=JSON.parse(str)}catch(e){raw=undefined}
      const known=!!raw&&typeof raw==='object'&&(raw.v===1||raw.v===2||raw.v===3);
      const upgrading=known&&raw.v<3;
      if(known){try{data=Meta.migrate(raw)}catch(e){data=null}}
      // An upgrade rewrites the save in a new shape, so keep the original string first.
      if(!data||upgrading)this.backup(str)}
    this.data=data||Meta.defaults();
    this.put()},
  // Keeps the raw string of a save we can't read before it is replaced; if the copy fails, stop writing.
  backup(str){
    try{localStorage.setItem(this.bakKey,str)}catch(e){this.writable=false}},
  put(){
    try{
      if(!this.writable)throw new Error('save is read-only');
      localStorage.setItem(this.key,JSON.stringify(this.data));return true}
    catch(e){this.warn();return false}},
  // One quiet title-screen line, once per session, so a failing write is never silent but never nags.
  warn(){
    if(this.noteShown)return;
    this.noteShown=1;this.syncNote()},
  syncNote(){
    const el=typeof document!=='undefined'&&document.getElementById('saveNote');
    if(el){el.textContent="Progress isn't saving on this device.";el.style.display=this.noteShown?'block':'none'}}};
Save.load();
