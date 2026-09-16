'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {createRequire}=require('node:module');
const realRequire=createRequire(require.resolve('../lib/network-worker'));
function adapter(fail=false){
 const calls=[];const tree={readDirectory:async p=>calls.push(['list',p]),createFile:async(p,b)=>{calls.push(['write',p,b]);if(fail)throw Error('secret server error');},renameFile:async(a,b)=>calls.push(['rename',a,b]),removeFile:async p=>calls.push(['remove',p])};
 class Client{constructor(host,opts){calls.push(['client',host,opts]);}on(){}async authenticate(auth){calls.push(['auth',auth]);return {connectTree:async share=>{calls.push(['share',share]);return tree;}};}async close(){calls.push(['close']);}}
 const sandbox={module:{exports:{}},Buffer,setTimeout,require:name=>name==='node:worker_threads'?{parentPort:null}:name==='node-smb2'?{Client}:realRequire(name)};vm.runInNewContext(fs.readFileSync(require.resolve('../lib/network-worker'),'utf8'),sandbox);
 return {calls,transfer:sandbox.module.exports.transfer};
}
const target={type:'smb',host:'nas',port:445,username:'backup',password:'secret',domain:'WORKGROUP',share:'backups',directory:'Homey',timeoutMs:30000};
test('SMB adapter authenticates and publishes only after temporary file write',async()=>{
 const a=adapter();assert.equal((await a.transfer({target,filename:'backup.json',body:Buffer.from('data')})).ok,true);assert.equal(a.calls[1][1].domain,'WORKGROUP');assert.deepEqual(a.calls.find(c=>c[0]==='share'),['share','backups']);assert.match(a.calls.find(c=>c[0]==='write')[1],/^Homey\/\.homey-.*\.partial$/);assert.equal(a.calls.find(c=>c[0]==='rename')[2],'Homey/backup.json');assert.equal(a.calls.at(-1)[0],'close');
});
test('SMB probe cleans its own file; failed write never publishes final backup',async()=>{
 const a=adapter();assert.equal((await a.transfer({target})).ok,true);assert.match(a.calls.find(c=>c[0]==='remove')[1],/\.partial\.probe$/);
 const b=adapter(true),result=await b.transfer({target,filename:'backup.json',body:Buffer.from('data')});assert.equal(result.ok,false);assert.equal(result.code,'IO');assert(!b.calls.some(c=>c[0]==='rename'));assert(b.calls.some(c=>c[0]==='remove'));assert.equal(b.calls.at(-1)[0],'close');
});
