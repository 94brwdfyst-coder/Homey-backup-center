'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const {createHash,randomUUID}=require('node:crypto');
const path=require('node:path').posix;
async function transfer({target:t,filename,body}){
 let hostMismatch=false,client;
 const temporary=path.join(t.directory,'.homey-'+randomUUID()+'.partial');
 const destination=filename?path.join(t.directory,filename):null;
 try {
  let put,rename,remove;
  if(t.type==='sftp'){
   const Sftp=require('ssh2-sftp-client');client=new Sftp();
   await client.connect({host:t.host,port:t.port,username:t.username,password:t.password,readyTimeout:t.timeoutMs,
    hostVerifier:key=>{const fingerprint='SHA256:'+createHash('sha256').update(key).digest('base64').replace(/=+$/,'');hostMismatch=fingerprint!==t.fingerprint.replace(/=+$/,'');return !hostMismatch;}});
   if(await client.exists(t.directory)!=='d')throw Error('directory');
   put=(p,b)=>client.put(b,p,{flags:'wx'});rename=(a,b)=>client.rename(a,b);remove=p=>client.delete(p,true);
  }else{
   const {Client}=require('@awo00/smb2');client=new Client(t.host,{port:t.port,connectTimeout:t.timeoutMs,requestTimeout:t.timeoutMs});
   client.on('error',()=>{});
   const session=await client.authenticate({domain:t.domain,username:t.username,password:t.password});
   const tree=await session.connectTree(t.share);
   await tree.readDirectory(t.directory||'/');
   put=(p,b)=>tree.createFile(p,b);rename=(a,b)=>tree.renameFile(a,b);remove=p=>tree.removeFile(p);
  }
  try{
   // The connection test proves write, rename and delete access using only its own random probe.
   await put(temporary,body?Buffer.from(body):Buffer.from('Homey connection test\n'));
   await rename(temporary,destination||temporary+'.probe');
   if(!filename)await remove(temporary+'.probe');
  }catch(e){await remove(temporary).catch(()=>{});throw e;}
  return {ok:true};
 }catch(e){
  const code=hostMismatch?'HOST_KEY':/auth|logon|password/i.test(String(e.code)+' '+e.message)?'AUTH':/ECONN|ENOTFOUND|EHOST/i.test(String(e.code))?'CONNECTION':'IO';
  return {ok:false,code};
 }finally{
  // Parent applies a hard wall-clock limit and closes sockets on every outcome.
  if(client){const close=t.type==='sftp'?()=>client.end():()=>client.close();await Promise.race([close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,500))]);}
 }
}
if(parentPort)transfer(workerData).then(result=>parentPort.postMessage(result),()=>parentPort.postMessage({ok:false,code:'IO'}));
module.exports={transfer};
