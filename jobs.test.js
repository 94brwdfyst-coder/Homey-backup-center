'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Jobs=require('../lib/jobs');
const tick=()=>new Promise(r=>setImmediate(r));
test('polling does not repeat a mutation and pending jobs cannot be released',async()=>{
 const jobs=new Jobs();let calls=0,resolve;
 const {jobId}=jobs.start(async()=>{calls++;return new Promise(r=>resolve=r);});await tick();
 assert.equal(jobs.get(jobId).status,'running');jobs.release(jobId);assert.equal(jobs.get(jobId).status,'running');assert.equal(calls,1);
 resolve({ok:true});await tick();assert.equal(jobs.get(jobId).status,'done');assert.deepEqual(jobs.get(jobId).result,{ok:true});jobs.release(jobId);assert.throws(()=>jobs.get(jobId),/expired/);
});
test('failed operations expose their error',async()=>{const j=new Jobs(),{jobId}=j.start(()=>{throw Error('failure')});await tick();assert.equal(j.get(jobId).status,'error');assert.equal(j.get(jobId).error,'failure');});
