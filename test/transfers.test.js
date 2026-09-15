'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Transfers,CHUNK_BYTES,MAX_BYTES,TTL}=require('../lib/transfers');
const Backup=require('../settings/backup');
const sample=()=>({format:'homey-backup-center',version:4,flows:[{id:'a',type:'standard',name:'Test 🏠',args:'é😀漢字'.repeat(400000)}],inventory:{}});
test('large Unicode backup survives small upload chunks and download chunks exactly',()=>{
 const store=new Transfers(),value=sample(),buffer=Buffer.from(JSON.stringify(value));assert(buffer.length>4.5e6);
 const meta=store.create(buffer.length);
 for(let offset=0;offset<buffer.length;offset+=CHUNK_BYTES){const data=buffer.subarray(offset,offset+CHUNK_BYTES).toString('base64');assert(Buffer.byteLength(JSON.stringify({id:meta.id,offset,data}))<33000);store.append(meta.id,offset,data);}
 store.finish(meta.id,data=>Backup.validate(data.flows));assert.deepEqual(store.json(meta.id),value);
 const output=store.publish(value),chunks=[];let offset=0;
 while(offset<output.bytes){const r=store.read(output.id,offset);assert(Buffer.byteLength(JSON.stringify(r))<33000);chunks.push(Buffer.from(r.data,'base64'));offset=r.next;}
 assert.deepEqual(JSON.parse(Buffer.concat(chunks)),value);
});
test('incomplete, out of order, corrupt and oversized chunks are rejected; exact retry is idempotent',()=>{
 const store=new Transfers(),meta=store.create(5);assert.throws(()=>store.finish(meta.id,()=>{}),/incomplete/);
 assert.throws(()=>store.append(meta.id,1,'eA=='),/order/);assert.throws(()=>store.append(meta.id,0,'!!!!'),/Invalid/);
 store.append(meta.id,0,'eA==');store.append(meta.id,0,'eA==');assert.throws(()=>store.append(meta.id,0,'eQ=='),/order/);
 assert.throws(()=>store.append(meta.id,1,Buffer.alloc(CHUNK_BYTES+1).toString('base64')),/Invalid/);
 assert.throws(()=>store.create(MAX_BYTES+1),/size/);
});
test('invalid JSON and invalid backup do not become ready',()=>{
 const s=new Transfers();for(const text of ['oops','{}']){const m=s.create(text.length);s.append(m.id,0,Buffer.from(text).toString('base64'));assert.throws(()=>s.finish(m.id,d=>Backup.validate(d.flows)));assert.throws(()=>s.json(m.id),/incomplete/);}
});
test('expiry and deletion invalidate handles; pinned operations remain alive',async()=>{
 let now=0;const s=new Transfers(()=>now),m=s.create(2);s.append(m.id,0,'e30=');s.finish(m.id,()=>{});
 await s.withBackup(m.id,async()=>{now+=TTL+1;s.prune();s.release(m.id);assert.deepEqual(s.json(m.id),{});});
 now+=TTL+1;assert.throws(()=>s.json(m.id),/expired/);
 const n=s.create(2);s.release(n.id);assert.throws(()=>s.get(n.id),/expired/);
});
test('result handles cannot be used as restore inputs',()=>{const s=new Transfers(),m=s.publish({});assert.throws(()=>s.json(m.id),/expired/);});
