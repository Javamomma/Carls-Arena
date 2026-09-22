const Save={key:'carlsArena.v1',data:null,
  load(){let raw=null;try{raw=JSON.parse(localStorage.getItem(this.key))}catch(e){raw=null}
    this.data=Meta.migrate(raw);this.put()},
  put(){try{localStorage.setItem(this.key,JSON.stringify(this.data))}catch(e){}}};
Save.load();
