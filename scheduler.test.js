'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {Scheduler,localDay,RETRY_MS}=require('../lib/scheduler');
function fixture(date='2026-09-15T01:00:00Z',initial={}){
 let now=Date.parse(date),state={enabled:true,time:'03:00',weekdays:['0','1','2','3','4','5','6'],targetId:'koofr',...initial};
 const events={uploads:[],push:0,timeline:0};let fail=true,pushFail=false;
 const deps={now:()=>now,read:()=>structuredClone(state),write:s=>state=structuredClone(s),upload:async id=>{events.uploads.push(id);if(fail)throw Error('NAS offline');return {filename:'test.json'};},notify:async()=>{events.push++;if(pushFail)throw Error('push offline');},timeline:async()=>{events.timeline++;}};
 return {scheduler:new Scheduler(deps),deps,events,state:()=>state,advance:ms=>now+=ms,setTime:date=>now=Date.parse(date),succeed:()=>fail=false,fail:()=>fail=true,failPush:()=>pushFail=true};
}
test('three attempts on each date, retries wait 15 minutes, notify only after final failure',async()=>{
 const f=fixture();await f.scheduler.tick();await f.scheduler.tick();assert.equal(f.events.uploads.length,1);assert.equal(f.events.push,0);
 for(let i=0;i<2;i++){f.advance(RETRY_MS);await f.scheduler.tick();}
 assert.equal(f.events.uploads.length,3);assert.equal(f.events.push,1);assert.equal(f.events.timeline,1);
 f.advance(RETRY_MS);await f.scheduler.tick();assert.equal(f.events.uploads.length,3);
 f.setTime('2026-09-16T01:00:00Z');await f.scheduler.tick();for(let i=0;i<2;i++){f.advance(RETRY_MS);await f.scheduler.tick();}
 assert.equal(f.events.uploads.length,6);assert.equal(f.events.push,2);
});
test('success stops automatic attempts and manual successes/failures do not change that state',async()=>{
 const f=fixture();f.succeed();await f.scheduler.manual('other');assert.equal(f.state().lastRun,null);
 await f.scheduler.tick();await f.scheduler.tick();assert.deepEqual(f.events.uploads,['other','koofr']);
 const before=f.state().lastRun;f.fail();await assert.rejects(f.scheduler.manual('other'));await f.scheduler.tick();assert.equal(f.events.uploads.length,3);assert.equal(f.state().lastRun,before);assert.equal(f.state().lastStatus,'ok');
});
test('persisted retry deadline survives restart',async()=>{
 const f=fixture();await f.scheduler.tick();const restarted=new Scheduler(f.deps);f.advance(RETRY_MS-1);await restarted.tick();assert.equal(f.events.uploads.length,1);f.advance(1);await restarted.tick();assert.equal(f.events.uploads.length,2);
});
test('late schedule completes its retries after midnight even on an unselected weekday',async()=>{
 const f=fixture('2026-09-15T21:55:00Z',{time:'23:55',weekdays:['2']});await f.scheduler.tick();
 f.advance(RETRY_MS);await f.scheduler.tick();f.advance(RETRY_MS);await f.scheduler.tick();
 assert.equal(f.events.uploads.length,3);assert.equal(f.state().attemptDate,'2026-09-15');assert.equal(f.events.push,1);
});
test('notification failure is visible, retried without rerunning backup, and bounded',async()=>{
 const f=fixture();f.failPush();for(let i=0;i<3;i++){await f.scheduler.tick();f.advance(RETRY_MS);}
 assert.equal(f.state().notificationError,'push offline');assert.equal(f.state().notifiedDate,null);
 for(let i=0;i<4;i++){await f.scheduler.tick();f.advance(RETRY_MS);}
 assert.equal(f.events.uploads.length,3);assert.equal(f.events.push,3);assert.equal(f.events.timeline,1);
});
test('a received notification stays deduplicated across restart',async()=>{
 const f=fixture();for(let i=0;i<3;i++){await f.scheduler.tick();f.advance(RETRY_MS);}
 await new Scheduler(f.deps).tick();assert.equal(f.events.push,1);
});
test('no overlaps between automatic and manual upload',async()=>{
 const f=fixture();let finish;f.scheduler.upload=()=>new Promise(r=>finish=r);
 const pending=f.scheduler.tick();await Promise.resolve();await assert.rejects(f.scheduler.manual('other'),/already running/);
 await f.scheduler.tick();finish({filename:'test'});await pending;assert.equal(f.scheduler.busy,false);
});
test('timezone handles DST and no early scheduled starts',async()=>{
 assert.equal(localDay(Date.parse('2026-10-25T01:30:00Z')).minutes,150);
 const f=fixture('2026-09-15T00:59:00Z');await f.scheduler.tick();assert.equal(f.events.uploads.length,0);
 f.advance(60000);await f.scheduler.tick();assert.equal(f.events.uploads.length,1);
});
test('disabled and unselected schedules do not run or notify',async()=>{
 const f=fixture(undefined,{enabled:false});await f.scheduler.tick();assert.equal(f.events.uploads.length,0);
 const g=fixture(undefined,{weekdays:['0']});await g.scheduler.tick();assert.equal(g.events.uploads.length,0);
});
