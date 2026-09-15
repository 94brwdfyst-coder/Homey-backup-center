'use strict';
const {randomUUID}=require('node:crypto');
class Jobs {
  constructor(now=Date.now){this.now=now;this.items=new Map();}
  prune(){for(const [id,x] of this.items)if(x.status!=='running' && x.expires<this.now())this.items.delete(id);}
  start(fn){
    this.prune();if(this.items.size>=8)throw Error('Too many pending operations. Close other backups and try again.');
    const id=randomUUID(), item={status:'running',expires:this.now()+30*60*1000};this.items.set(id,item);
    Promise.resolve().then(fn).then(result=>Object.assign(item,{status:'done',result}),error=>Object.assign(item,{status:'error',error:String(error.message||error)})).finally(()=>{item.expires=this.now()+30*60*1000;});
    return {jobId:id};
  }
  get(id){this.prune();const item=this.items.get(id);if(!item)throw Error('This operation has expired. Reload the backup.');return {...item};}
  release(id){if(this.items.get(id)?.status!=='running')this.items.delete(id);return {ok:true};}
}
module.exports=Jobs;
