'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function fixture({navigator={},picker,FileClass=class{}}={}){
 const calls={clicks:0,shared:0,revoked:[],events:{}},status={},links={replaceChildren(a){this.link=a;}};
 const window={addEventListener:(n,f)=>calls.events[n]=f,showSaveFilePicker:picker};
 const context={window,navigator,File:FileClass,BackupI18n:{t:s=>s},URL:{createObjectURL:()=>`blob:${calls.clicks}`,revokeObjectURL:u=>calls.revoked.push(u)},document:{createElement:()=>({click:()=>calls.clicks++})}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../settings/download.js'),'utf8')+';globalThis.save=BackupDownload.save',context);
 return {calls,status,links,save:shareOnly=>context.save({type:'application/json'},'backup.json',{status,links,shareOnly})};
}
test('Download uses a persistent link in Firefox even when file sharing is available',async()=>{
 const f=fixture({navigator:{canShare:()=>true,share:async()=>{throw Error('must not share');}}});await f.save(false);assert.equal(f.calls.clicks,1);assert.equal(f.links.hidden,false);assert.equal(f.links.link.download,'backup.json');
 f.calls.events.pagehide({persisted:true});assert.equal(f.calls.revoked.length,0);f.calls.events.pagehide({persisted:false});assert.equal(f.calls.revoked.length,1);
});
test('Download does not use showSaveFilePicker in restricted Homey settings',async()=>{
 let pickerCalls=0;
 const f=fixture({picker:async()=>{pickerCalls++;throw Object.assign(Error('blocked'),{name:'SecurityError'});}});
 await f.save(false);
 assert.equal(pickerCalls,0);
 assert.equal(f.calls.clicks,1);
 assert.equal(f.links.hidden,false);
 assert.equal(f.links.link.download,'backup.json');
});
test('share capability exceptions and missing File API do not prevent downloading',async()=>{
 const f=fixture({navigator:{share:async()=>{},canShare:()=>{throw Error('policy');}}});await f.save(true);assert.equal(f.calls.clicks,1);
 const g=fixture({FileClass:null});await g.save(false);assert.equal(g.calls.clicks,1);
});
