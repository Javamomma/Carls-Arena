const Save={key:'carlsArena.v1',data:null,
  load(){try{this.data=JSON.parse(localStorage.getItem(this.key))||null}catch(e){this.data=null}
    if(!this.data)this.data={v:1,gold:0,units:0,roster:{},mute:false,settings:{}}},
  put(){try{localStorage.setItem(this.key,JSON.stringify(this.data))}catch(e){}}};
Save.load();
