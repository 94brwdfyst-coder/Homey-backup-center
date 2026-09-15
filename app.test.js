'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');const realRequire=createRequire(require('node:path').resolve(__dirname,'../app.js'));
const {fixture,job,stage}=require('./helpers.cjs');
for(const language of ['nl','en'])test('export, staged plan and selective restore preserve protocol fields in '+language,async()=>{
 const f=await fixture(language),backup=await f.app.exportBackup();
 assert.equal(backup.inventory.variables.a.name,'Test variable');assert.equal(backup.inventory.zones.a.name,'Room');assert.equal(backup.inventory.zones.a.icon,'home');assert(!backup.inventory.variables.c);
 const same=await f.app.buildRestorePlan(backup);assert.equal(same.totalChanges,0);assert.equal(same.variables.operations[0].action,'none');
 backup.inventory.variables.a.value=2;backup.inventory.variables.b.value=9;backup.inventory.variables.c={id:'c',name:'ha_backup_token',type:'string',value:'FAKE-OLD-TOKEN'};
 backup.note='é😀'.repeat(800000);const id=stage(f.app,backup);const plan=await job(f.app,f.app.startRestorePlan(id));assert.equal(plan.variables.changes,2);assert(!plan.variables.operations.some(x=>x.name==='ha_backup_token'));
 const selectionId=stage(f.app,{logic:['Test variable','ha_backup_token']},'selection');
 assert.throws(()=>f.app.startRestoreRun(id,false,selectionId));const report=await job(f.app,f.app.startRestoreRun(id,true,selectionId));assert.equal(report.ok,true);assert.equal(f.data.variables.a.value,2);assert.equal(f.data.variables.b.value,5);assert.equal(f.data.variables.c.value,'FAKE-NEW-TOKEN');assert.deepEqual(f.calls.writes,['a']);
 const verify=await job(f.app,f.app.startRestorePlan(id));assert.equal(verify.variables.changes,1);assert.equal(verify.variables.operations.find(x=>x.name==='Test variable').action,'none');
 // Completed and released restore job must not block the next operation.
 const second=await job(f.app,f.app.startRestoreRun(id,true,selectionId));assert(second.ok);
 f.app.onUninit();
});
test('language choice persists and unknown language rejected',async()=>{const f=await fixture();assert.equal(f.app.saveLanguage('en').language,'en');assert.equal(f.state.language,'en');assert.throws(()=>f.app.saveLanguage('fr'));});
test('schedule validates days, time and destination; active target cannot be removed',async()=>{
 const {app}=await fixture();const c={enabled:true,time:'03:00',weekdays:['2'],targetId:'koofr'};
 for(const bad of [{weekdays:[]},{weekdays:['7']},{time:'25:00'},{targetId:'missing'}])assert.throws(()=>app.saveSchedule({...c,...bad}));
 app.saveSchedule(c);assert.throws(()=>app.saveWebdavTargets('[]'));app.saveSchedule({...c,enabled:false});assert.deepEqual(Array.from(app.saveWebdavTargets('[]')),[]);
});
test('push uses this Homey owner and the actual installed client method signature',async()=>{
 const f=await fixture('en');await f.app.notifyScheduleFailure({});assert.equal(f.calls.cards[0].id,'homey:manager:mobile:push_text_critical');assert.equal(f.calls.push[0].id,'homey:manager:mobile:push_text_critical');assert.equal(f.calls.push[0].args.user.id,'owner-test-id');assert(!JSON.stringify(f.calls.push).includes('Dennis'));
 f.client.flow.getFlowCardAction=async({id})=>{if(id.endsWith('_critical'))throw Error('not available');};await f.app.notifyScheduleFailure({});assert.equal(f.calls.push[1].id,'homey:manager:mobile:push_text');
 await assert.rejects(f.app.notifyScheduleFailure({notifyUserId:'deleted'}));
});
test('API names and versions match the manifest',()=>{const manifest=realRequire('./app.json'),api=realRequire('./api.js');assert.deepEqual(Object.keys(manifest.api).sort(),Object.keys(api).sort());assert.equal(manifest.version,realRequire('./package.json').version);});
