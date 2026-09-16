'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,createHash}=require('node:crypto');
const {Server,utils}=require('ssh2');
const {runWorker}=require('../lib/network');
const {STATUS_CODE}=utils.sftp;
async function server(t){
 const keys=generateKeyPairSync('rsa',{modulusLength:2048});
 const privateKey=keys.privateKey.export({type:'pkcs1',format:'pem'});
 const fingerprint='SHA256:'+createHash('sha256').update(utils.parseKey(privateKey).getPublicSSH()).digest('base64').replace(/=+$/,'');
 const files=new Map(),clients=new Set();let deny=false;
 const srv=new Server({hostKeys:[privateKey]},client=>{
  clients.add(client);client.on('error',()=>{});client.on('close',()=>clients.delete(client));
  client.on('authentication',ctx=>ctx.username==='backup'&&ctx.password==='test-secret'?ctx.accept():ctx.reject());
  client.on('ready',()=>client.on('session',accept=>accept().on('sftp',accept=>{
   const s=accept();
   s.on('REALPATH',(id,p)=>s.name(id,[{filename:p,longname:p,attrs:{}}]));
   s.on('STAT',(id,p)=>p==='/backup'?s.attrs(id,{mode:0o40755,size:0,uid:0,gid:0,atime:0,mtime:0}):s.status(id,STATUS_CODE.NO_SUCH_FILE));
   s.on('LSTAT',(id,p)=>p==='/backup'?s.attrs(id,{mode:0o40755,size:0,uid:0,gid:0,atime:0,mtime:0}):s.status(id,STATUS_CODE.NO_SUCH_FILE));
   s.on('OPEN',(id,p)=>{if(deny)return s.status(id,STATUS_CODE.PERMISSION_DENIED);files.set(p,Buffer.alloc(0));s.handle(id,Buffer.from(p));});
   s.on('WRITE',(id,handle,offset,data)=>{const p=handle.toString(),old=files.get(p);const next=Buffer.alloc(Math.max(old.length,offset+data.length));old.copy(next);data.copy(next,offset);files.set(p,next);s.status(id,STATUS_CODE.OK);});
   s.on('CLOSE',id=>s.status(id,STATUS_CODE.OK));
   s.on('RENAME',(id,a,b)=>{if(!files.has(a))return s.status(id,STATUS_CODE.NO_SUCH_FILE);files.set(b,files.get(a));files.delete(a);s.status(id,STATUS_CODE.OK);});
   s.on('REMOVE',(id,p)=>{files.delete(p);s.status(id,STATUS_CODE.OK);});
  })));
 });
 await new Promise((resolve,reject)=>{srv.once('error',reject);srv.listen(0,'127.0.0.1',resolve);});
 t.after(async()=>{for(const c of clients)c.end();await new Promise(resolve=>srv.close(resolve));});
 return {files,deny:()=>deny=true,target:{type:'sftp',host:'127.0.0.1',port:srv.address().port,username:'backup',password:'test-secret',fingerprint,directory:'/backup',timeoutMs:5000}};
}
test('real SFTP: write/rename/delete probe and byte-exact Unicode backup',async t=>{
 const s=await server(t);await runWorker(s.target,null,null);assert.equal(s.files.size,0);
 const body=Buffer.from(JSON.stringify({flows:[{name:'é😀'}],data:'x'.repeat(180000)}));await runWorker(s.target,'backup.json',body);assert.equal(s.files.size,1);assert.deepEqual(s.files.get('/backup/backup.json'),body);
});
test('real SFTP: wrong host key, bad password and denied writes fail safely',async t=>{
 const s=await server(t);
 await assert.rejects(runWorker({...s.target,fingerprint:'SHA256:'+'A'.repeat(43)},null,null),e=>e.code==='HOST_KEY');
 await assert.rejects(runWorker({...s.target,password:'incorrect'},null,null),e=>e.code==='AUTH');
 s.deny();await assert.rejects(runWorker(s.target,'backup.json',Buffer.from('data')),e=>e.code==='IO');assert.equal(s.files.size,0);
});
test('worker timeout closes a stalled socket without a late upload',async t=>{
 const net=require('node:net'),sockets=new Set();const srv=net.createServer(s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});await new Promise(r=>srv.listen(0,'127.0.0.1',r));t.after(()=>{for(const s of sockets)s.destroy();srv.close();});
 const started=Date.now();await assert.rejects(runWorker({type:'sftp',host:'127.0.0.1',port:srv.address().port,username:'x',password:'x',directory:'/backup',timeoutMs:150,fingerprint:'SHA256:'+'A'.repeat(43)},'backup.json',Buffer.from('x')),e=>e.code==='TIMEOUT');assert(Date.now()-started<2000);
});
