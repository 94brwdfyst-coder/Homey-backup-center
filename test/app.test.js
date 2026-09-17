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

test('BLL restore plan detects none, update and persistent create safely',async()=>{
 const f=await fixture('en',{betterLogicVariables:[
  {name:'Same BLL',type:'number',value:1,persistent:true},
  {name:'Changed BLL',type:'string',value:'current',persistent:true}
 ]});
 const backup=await f.app.exportBackup();

 // Same value must not become a change.
 let plan=await f.app.buildRestorePlan(backup);
 assert.equal(plan.betterLogicVariables.operations.find(x=>x.name==='Same BLL').action,'none');

 // A changed value with the same type is a safe update.
 backup.inventory.betterLogicVariables.find(x=>x.name==='Changed BLL').value='backup';
 plan=await f.app.buildRestorePlan(backup);
 const update=plan.betterLogicVariables.operations.find(x=>x.name==='Changed BLL');
 assert.equal(update.action,'update');
 assert.equal(update.currentValue,'current');

 // A missing permanent backup variable may be recreated.
 backup.inventory.betterLogicVariables.push({
  name:'Missing permanent BLL',type:'boolean',value:true,persistent:true
 });
 plan=await f.app.buildRestorePlan(backup);
 const create=plan.betterLogicVariables.operations.find(x=>x.name==='Missing permanent BLL');
 assert.equal(create.action,'create');
 assert.equal(create.defaultSelected,false);
});

test('BLL restore plan refuses missing transient and type mismatch',async()=>{
 const f=await fixture('en',{betterLogicVariables:[
  {name:'Existing BLL',type:'number',value:12,persistent:true}
 ]});
 const backup=await f.app.exportBackup();

 backup.inventory.betterLogicVariables.push({
  name:'Missing transient BLL',type:'string',value:'temporary',persistent:false
 });
 backup.inventory.betterLogicVariables.find(x=>x.name==='Existing BLL').type='string';
 backup.inventory.betterLogicVariables.find(x=>x.name==='Existing BLL').value='12';

 const plan=await f.app.buildRestorePlan(backup);

 const transient=plan.betterLogicVariables.operations.find(x=>x.name==='Missing transient BLL');
 assert.equal(transient.action,'unsupported');
 assert.equal(transient.reason,'missing-transient');

 const mismatch=plan.betterLogicVariables.operations.find(x=>x.name==='Existing BLL');
 assert.equal(mismatch.action,'unsupported');
 assert.equal(mismatch.reason,'type-mismatch');

 assert.equal(plan.betterLogicVariables.changes,0);
});

test('BLL restore plan ignores lastChanged metadata',async()=>{
 const f=await fixture('en',{betterLogicVariables:[
  {name:'BLL timestamp test',type:'boolean',value:true,persistent:true,lastChanged:'2099-01-01T00:00:00.000Z'}
 ]});
 const backup=await f.app.exportBackup();

 // Export intentionally does not retain volatile BLL metadata.
 assert.equal(Object.hasOwn(backup.inventory.betterLogicVariables[0],'lastChanged'),false);

 const plan=await f.app.buildRestorePlan(backup);
 assert.equal(plan.betterLogicVariables.operations[0].action,'none');
 assert.equal(plan.betterLogicVariables.changes,0);
});

test('BLL restore plan reports unavailable library without blocking normal restore plan',async()=>{
 const f=await fixture('en');
 const backup=await f.app.exportBackup();

 // Simulate a backup originating from a Homey where BLL was available.
 backup.inventory.betterLogicVariables=[
  {name:'Unavailable BLL variable',type:'number',value:42,persistent:true}
 ];

 f.app.getBetterLogicVariables=async()=>{throw Error('BLL unavailable');};

 const plan=await f.app.buildRestorePlan(backup);
 assert.equal(plan.ok,true);
 assert.equal(plan.betterLogicVariables.available,false);
 assert.match(plan.betterLogicVariables.error,/BLL unavailable/);
 assert.equal(plan.betterLogicVariables.operations[0].action,'unsupported');
 assert.equal(plan.betterLogicVariables.operations[0].reason,'better-logic-unavailable');
 assert.equal(plan.betterLogicVariables.changes,0);
});


test('BLL selective restore updates existing values with safe URL encoding',async()=>{
 const f=await fixture('en',{betterLogicVariables:[
  {name:'Special / BLL & test?',type:'string',value:'current',persistent:true},
  {name:'BLL number',type:'number',value:1,persistent:true},
  {name:'BLL boolean',type:'boolean',value:false,persistent:true}
 ]});
 const backup=await f.app.exportBackup();

 backup.inventory.betterLogicVariables.find(x=>x.name==='Special / BLL & test?').value='Test & 50% / klaar?';
 backup.inventory.betterLogicVariables.find(x=>x.name==='BLL number').value=123.45;
 backup.inventory.betterLogicVariables.find(x=>x.name==='BLL boolean').value=true;

 const report=await f.app.restoreBackup(backup,true,{
  betterLogicVariables:['Special / BLL & test?','BLL number','BLL boolean']
 });

 assert.equal(report.ok,true);
 assert.equal(report.betterLogicVariables.ok,3);
 assert.equal(report.betterLogicVariables.failed.length,0);
 assert.equal(report.betterLogicVariables.verified.length,3);

 assert(f.calls.bllPut.includes(
  '/Special%20%2F%20BLL%20%26%20test%3F/Test%20%26%2050%25%20%2F%20klaar%3F'
 ));
 assert(f.calls.bllPut.includes('/BLL%20number/123.45'));
 assert(f.calls.bllPut.includes('/BLL%20boolean/true'));

 assert.equal(f.data.betterLogicVariables.find(x=>x.name==='Special / BLL & test?').value,'Test & 50% / klaar?');
 assert.equal(f.data.betterLogicVariables.find(x=>x.name==='BLL number').value,123.45);
 assert.equal(f.data.betterLogicVariables.find(x=>x.name==='BLL boolean').value,true);
});

test('BLL selective restore creates only selected persistent variable and preserves unrelated variables',async()=>{
 const f=await fixture('en',{betterLogicVariables:[
  {name:'Existing permanent',type:'string',value:'keep me',persistent:true},
  {name:'Existing transient',type:'number',value:77,persistent:false}
 ]});
 const backup=await f.app.exportBackup();

 backup.inventory.betterLogicVariables.push(
  {name:'Create selected',type:'boolean',value:true,persistent:true},
  {name:'Create not selected',type:'string',value:'do not create',persistent:true}
 );

 const report=await f.app.restoreBackup(backup,true,{
  betterLogicVariables:['Create selected']
 });

 assert.equal(report.ok,true);
 assert.equal(report.betterLogicVariables.ok,1);
 assert.equal(f.calls.bllSettingsWrites.length,1);

 const written=f.calls.bllSettingsWrites[0];
 assert(written.some(v=>v.name==='Existing permanent' && v.value==='keep me'));
 assert(written.some(v=>v.name==='Create selected' && v.type==='boolean' && v.value===true));
 assert(!written.some(v=>v.name==='Create not selected'));

 assert(f.data.betterLogicVariables.some(v=>v.name==='Existing permanent' && v.value==='keep me'));
 assert(f.data.betterLogicVariables.some(v=>v.name==='Existing transient' && v.value===77 && v.persistent===false));
 assert(f.data.betterLogicVariables.some(v=>v.name==='Create selected' && v.value===true && v.persistent===true));
 assert(!f.data.betterLogicVariables.some(v=>v.name==='Create not selected'));

 assert(report.betterLogicVariables.skipped.some(v=>v.name==='Create not selected'));
});

test('BLL selective restore never writes unsupported transient or type mismatch operations',async()=>{
 const f=await fixture('en',{betterLogicVariables:[
  {name:'Type mismatch BLL',type:'number',value:12,persistent:true}
 ]});
 const backup=await f.app.exportBackup();

 const mismatch=backup.inventory.betterLogicVariables.find(x=>x.name==='Type mismatch BLL');
 mismatch.type='string';
 mismatch.value='12';

 backup.inventory.betterLogicVariables.push({
  name:'Missing transient BLL',
  type:'string',
  value:'temporary',
  persistent:false
 });

 const plan=await f.app.buildRestorePlan(backup);

 assert.equal(plan.ok,true);
 assert.equal(plan.totalChanges,0);
 assert.equal(plan.betterLogicVariables.changes,0);

 assert(plan.betterLogicVariables.operations.some(
  v=>v.name==='Type mismatch BLL'
    && v.action==='unsupported'
    && v.reason==='type-mismatch'
 ));
 assert(plan.betterLogicVariables.operations.some(
  v=>v.name==='Missing transient BLL'
    && v.action==='unsupported'
    && v.reason==='missing-transient'
 ));

 const report=await f.app.restoreBackup(backup,true,{
  betterLogicVariables:['Type mismatch BLL','Missing transient BLL']
 });

 assert.equal(report.ok,true);
 assert.equal(report.noChangesNeeded,true);
 assert.equal(report.totalChanges,0);
 assert.equal(f.calls.bllPut.length,0);
 assert.equal(f.calls.bllSettingsWrites.length,0);
});

test('BLL restore writes nothing when no BLL changes are explicitly selected',async()=>{
 const f=await fixture('en',{betterLogicVariables:[
  {name:'Do not touch BLL',type:'number',value:1,persistent:true}
 ]});
 const backup=await f.app.exportBackup();
 backup.inventory.betterLogicVariables[0].value=999;

 const report=await f.app.restoreBackup(backup,true,{});

 assert.equal(report.ok,true);
 assert.equal(report.betterLogicVariables.ok,0);
 assert.equal(f.data.betterLogicVariables[0].value,1);
 assert.equal(f.calls.bllPut.length,0);
 assert.equal(f.calls.bllSettingsWrites.length,0);
 assert(report.betterLogicVariables.skipped.some(v=>v.name==='Do not touch BLL'));
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

test('new exports use backup format 5 while restore keeps formats 2 through 5 compatible',async()=>{
 const f=await fixture('en');
 const backup=await f.app.exportBackup();

 assert.equal(backup.format,'homey-backup-center');
 assert.equal(backup.version,5);

 for(const version of [2,3,4,5]){
   const candidate=structuredClone(backup);
   candidate.version=version;
   assert.doesNotThrow(()=>f.app.validateRestoreBackup(candidate));
 }

 for(const version of [1,6]){
   const candidate=structuredClone(backup);
   candidate.version=version;
   assert.throws(
     ()=>f.app.validateRestoreBackup(candidate),
     /supported|ondersteunde/i
   );
 }
});
