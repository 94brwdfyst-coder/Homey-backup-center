'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createRequire}=require('node:module');

const realRequire=createRequire(require.resolve('../lib/network-worker'));

function adapter(fail=false){
 const calls=[];

 class Client{
  constructor(timeout){
   calls.push(['client',timeout]);
   this.ftp={verbose:true};
  }

  async access(options){
   calls.push(['access',options]);
  }

  async cd(directory){
   calls.push(['cd',directory]);
  }

  async uploadFrom(stream,remote){
   const chunks=[];
   for await(const chunk of stream)chunks.push(Buffer.from(chunk));
   calls.push(['write',remote,Buffer.concat(chunks)]);
   if(fail)throw Error('FTP write failed');
  }

  async rename(from,to){
   calls.push(['rename',from,to]);
  }

  async remove(remote){
   calls.push(['remove',remote]);
  }

  close(){
   calls.push(['close']);
  }
 }

 const sandbox={
  module:{exports:{}},
  Buffer,
  setTimeout,
  require:name=>{
   if(name==='node:worker_threads')return {parentPort:null};
   if(name==='basic-ftp')return {Client};
   return realRequire(name);
  }
 };

 vm.runInNewContext(
  fs.readFileSync(require.resolve('../lib/network-worker'),'utf8'),
  sandbox
 );

 return {calls,transfer:sandbox.module.exports.transfer};
}

const target={
 type:'ftp',
 host:'nas',
 port:21,
 username:'backup',
 password:'secret',
 directory:'/backups',
 timeoutMs:30000
};

test('FTP adapter connects, changes folder and publishes only after temporary upload',async()=>{
 const a=adapter();

 const result=await a.transfer({
  target,
  filename:'backup.json',
  body:Buffer.from('data')
 });

 assert.equal(result.ok,true);

 const access=a.calls.find(c=>c[0]==='access');
 assert.equal(access[1].host,'nas');
 assert.equal(access[1].port,21);
 assert.equal(access[1].user,'backup');
 assert.equal(access[1].password,'secret');
 assert.equal(access[1].secure,false);

 assert.deepEqual(a.calls.find(c=>c[0]==='cd'),['cd','/backups']);

 const write=a.calls.find(c=>c[0]==='write');
 assert.match(write[1],/^\.homey-.*\.partial$/);
 assert.deepEqual(write[2],Buffer.from('data'));

 const rename=a.calls.find(c=>c[0]==='rename');
 assert.match(rename[1],/^\.homey-.*\.partial$/);
 assert.equal(rename[2],'backup.json');

 assert.equal(a.calls.at(-1)[0],'close');
});

test('FTP probe renames and removes its probe; failed upload never publishes final backup',async()=>{
 const a=adapter();

 assert.equal((await a.transfer({target})).ok,true);

 const remove=a.calls.find(c=>c[0]==='remove');
 assert.match(remove[1],/\.partial\.probe$/);

 const b=adapter(true);
 const result=await b.transfer({
  target,
  filename:'backup.json',
  body:Buffer.from('data')
 });

 assert.equal(result.ok,false);
 assert.equal(result.code,'IO');
 assert(!b.calls.some(c=>c[0]==='rename'));
 assert(b.calls.some(c=>c[0]==='remove'));
 assert.equal(b.calls.at(-1)[0],'close');
});

test('FTP errors report the failing FTP stage without exposing the password',async()=>{
 const a=adapter(true);
 const result=await a.transfer({
  target,
  filename:'backup.json',
  body:Buffer.from('data')
 });

 assert.equal(result.ok,false);
 assert.match(result.detail,/FTP failed during write-probe/);
 assert(!result.detail.includes('secret'));
});
