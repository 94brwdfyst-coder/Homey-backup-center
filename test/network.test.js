'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NetworkDestinations}=require('../lib/network');
const {fixture}=require('./helpers.cjs');
const target={type:'sftp',name:'NAS',host:'nas.invalid',username:'backup',password:'test-secret',fingerprint:'SHA256:'+'A'.repeat(43),directory:'/backup'};
function setup(run=async()=>({ok:true}),emit=async()=>{}){const state={};return new NetworkDestinations({settings:{get:k=>state[k],set:(k,v)=>state[k]=v},exportBackup:async()=>({flows:[],version:4}),run,emit});}
test('destination validation, secret preservation, deletion and endpoint changes',()=>{
 const n=setup();const [t]=n.save(target);assert.equal(t.hasPassword,true);assert.equal(t.password,undefined);
 assert.equal(n.save({...t,password:''})[0].id,t.id);
 for(const change of [{host:'new.invalid'},{username:'different'},{port:2222},{fingerprint:'SHA256:'+'B'.repeat(43)}])assert.throws(()=>n.save({...t,...change,password:''}),/password/);
 for(const change of [{directory:'../escape'},{host:'sftp://nas'},{port:0.5},{timeoutMs:500},{fingerprint:'anything'},{type:'ftp'}])assert.throws(()=>n.save({...target,...change}));
 n.remove(t.id);assert.throws(()=>n.get(t.id));
});
test('backup success emits only safe tokens; failed event delivery cannot undo success',async()=>{
 let call,event;const n=setup(async(...args)=>{call=args;return {ok:true};},async(...args)=>{event=args;throw Error('Flow failed');});const [t]=n.save(target);const result=await n.backup(t.id);
 assert.equal(call[0].password,'test-secret');assert.match(call[1],/^Homey_Backup_Center_.*\.json$/);assert.equal(JSON.parse(call[2]).version,4);assert.equal(result.ok,true);assert.equal(event[0],'network_backup_completed');assert(!JSON.stringify(event).includes('test-secret'));assert.equal(n.busy,false);
});
test('failed upload is redacted and triggers failure only',async()=>{
 let event;const n=setup(async()=>{throw Error('server leaked test-secret');},async(...args)=>{event=args;});const [t]=n.save(target);await assert.rejects(n.backup(t.id),/Network operation failed/);assert.equal(event[0],'network_backup_failed');assert(!JSON.stringify(event).includes('test-secret'));assert.equal(n.busy,false);
});
test('simultaneous uploads and mutations are rejected and recover after completion',async()=>{
 let resolve;const n=setup(()=>new Promise(r=>resolve=r));const [t]=n.save(target);const task=n.backup(t.id);await new Promise(r=>setImmediate(r));await assert.rejects(n.backup(t.id),/already running/);await assert.rejects(n.test(t.id),/already running/);assert.throws(()=>n.remove(t.id),/already running/);assert.throws(()=>n.save(target),/already running/);resolve({ok:true});await task;assert.equal(n.busy,false);
});
test('Flow cards select stable IDs and filter completion events by destination',async()=>{
 const {app,flowCards}=await fixture();const [t]=app.network.save(target);let runId;app.network.backup=async id=>{runId=id;};const action=flowCards.get('network_backup');assert.equal(await action.run({destination:{id:t.id}}),true);assert.equal(runId,t.id);const results=await action.autocomplete('nas');assert.equal(results[0].id,t.id);assert(!JSON.stringify(results).includes('test-secret'));
 const trigger=flowCards.get('network_backup_completed');assert.equal(await trigger.run({destination:{id:t.id}},{destinationId:t.id}),true);assert.equal(await trigger.run({destination:{id:'other'}},{destinationId:t.id}),false);
 app.network.test=async()=>{throw Error('offline');};assert.equal(await flowCards.get('network_destination_reachable').run({destination:{id:t.id}}),false);
 const backup=await app.exportBackup();assert(!JSON.stringify(backup).includes('test-secret'));assert(!JSON.stringify(backup).includes('networkTargets'));
});
test('SFTP accepts Synology-style SHA1 fingerprints as well as SHA256',()=>{
 const n=setup();
 const common={type:'sftp',name:'NAS',host:'nas.local',port:22,username:'backup',password:'secret',directory:'/backup',timeoutMs:30000};
 assert.doesNotThrow(()=>n.save({...common,fingerprint:'SHA1:'+'aa:'.repeat(19)+'aa'}));
 assert.throws(()=>n.save({...common,name:'bad',fingerprint:'SHA1:not-a-fingerprint'}),/SHA256.*SHA1/);
});
