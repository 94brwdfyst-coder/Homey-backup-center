'use strict';
const {randomUUID}=require('node:crypto');
const {Worker}=require('node:worker_threads');
const path=require('node:path');
const messages={
 TIMEOUT:'Network operation timed out. Check the server and timeout setting.',
 HOST_KEY:'SFTP host key did not match the configured host-key fingerprint.',
 AUTH:'Network login refused. Check the username and password.',
 CONNECTION:'Could not connect to the network destination.',
 IO:'Network operation failed. Check the folder, permissions and protocol support.',
 BUSY:'A network backup is already running.',
};
function networkError(code,detail){const base=messages[code]||messages.IO;return Object.assign(new Error(detail?base+' '+detail:base),{code:messages[code]?code:'IO'});}
function runWorker(target,filename,body){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(path.join(__dirname,'network-worker.js'),{workerData:{target,filename,body}});
  let settled=false;
  const finish=(error,result)=>{
   if(settled)return;settled=true;clearTimeout(timer);
   // Termination closes sockets even if a server never answers a logout request.
   worker.terminate().then(()=>error?reject(error):resolve(result),()=>reject(networkError('IO')));
  };
  const timer=setTimeout(()=>finish(networkError('TIMEOUT')),target.timeoutMs);
  worker.once('message',m=>m.ok?finish(null,m):finish(networkError(m.code,m.detail)));
  worker.once('error',()=>finish(networkError('IO')));
  worker.once('exit',()=>{if(!settled)finish(networkError('IO'));});
 });
}
function normalize(input,previous){
 if(!input || typeof input!=='object' || !['smb','sftp'].includes(input.type))throw Error('Choose SMB or SFTP.');
 const type=input.type,host=String(input.host||'').trim(),username=String(input.username||'').trim();
 if(!host || host.length>253 || /[\s/\\@?#\x00-\x1f]/.test(host))throw Error('Enter a hostname or IP address, without a URL or share path.');
 if(!username || username.length>200)throw Error('Enter a username.');
 const port=Number(input.port || (type==='smb'?445:22)),timeoutMs=Number(input.timeoutMs||30000);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port must be between 1 and 65535.');
 if(!Number.isInteger(timeoutMs)||timeoutMs<5000||timeoutMs>120000)throw Error('Timeout must be between 5 and 120 seconds.');
 const directory=String(input.directory|| (type==='sftp'?'/': '')).replace(/\\/g,'/');
 if(directory.length>1000 || /[\x00-\x1f]/.test(directory) || directory.split('/').includes('..') || (type==='smb' && /[:*?"<>|]/.test(directory)))throw Error('Enter a folder without parent traversal or invalid characters.');
 const share=type==='smb'?String(input.share||'').trim():'';
 if(type==='smb' && (!share || /[\\/:*?"<>|\x00-\x1f]/.test(share)))throw Error('Enter the SMB share name separately from the folder.');
 let fingerprint=type==='sftp'?String(input.fingerprint||'').trim():'';
 if(/^sha256:/i.test(fingerprint)) fingerprint='SHA256:'+fingerprint.slice(fingerprint.indexOf(':')+1).trim();
 if(/^sha1:/i.test(fingerprint)) fingerprint='SHA1:'+fingerprint.slice(fingerprint.indexOf(':')+1).trim();
 if(type==='sftp' && !(/^(SHA256:[A-Za-z0-9+/]{43}=?|SHA1:(?:[0-9a-fA-F]{2}:){19}[0-9a-fA-F]{2})$/.test(fingerprint)))throw Error('Enter a SHA256:… or SHA1:aa:bb:… server host-key fingerprint.');
 // Never silently send a retained secret to a changed server or account.
 const domain=type==='smb'?String(input.domain||'').slice(0,200):'';
 const same=previous && ['type','host','port','username','share','fingerprint','domain'].every(k=>previous[k]===({type,host,port,username,share,fingerprint,domain})[k]);
 const password=input.password?String(input.password):(same?previous.password:'');
 if(!password || password.length>4096)throw Error('Enter a password. Re-enter it when changing the server or account.');
 return {id:previous?.id||randomUUID(),type,name:String(input.name||type.toUpperCase()).trim().slice(0,80),host,port,username,password,directory,share,fingerprint,domain,timeoutMs};
}
class NetworkDestinations {
 constructor({settings,exportBackup,emit=async()=>{},run=runWorker}){Object.assign(this,{settings,exportBackup,emit,run});this.busy=false;this.testing=false;}
 list(){return (this.settings.get('networkTargets')||[]).map(({password,...t})=>({...t,hasPassword:Boolean(password)}));}
 get(id){const t=(this.settings.get('networkTargets')||[]).find(t=>t.id===id);if(!t)throw Error('Network destination not found. Select an existing destination.');return t;}
 save(input){
  if(this.busy||this.testing)throw networkError('BUSY');
  const items=this.settings.get('networkTargets')||[];
  const previous=input?.id?this.get(input.id):null;
  if(!previous&&items.length>=8)throw Error('Use at most eight network destinations.');
  const target=normalize(input,previous);
  this.settings.set('networkTargets',[...items.filter(t=>t.id!==target.id),target]);
  return this.list();
 }
 remove(id){if(this.busy||this.testing)throw networkError('BUSY');this.get(id);this.settings.set('networkTargets',(this.settings.get('networkTargets')||[]).filter(t=>t.id!==id));return this.list();}
 async test(id){
  if(this.busy||this.testing)throw networkError('BUSY');const target=this.get(id);this.testing=true;
  try {return await this.run(target,null,null);}catch(e){throw e && e.code ? e : networkError('IO');}finally{this.testing=false;}
 }
 async backup(id){
  if(this.busy||this.testing)throw networkError('BUSY');const target=this.get(id);this.busy=true;
  let result,error;
  try {
   const data=await this.exportBackup();
   const filename='Homey_Backup_Center_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+randomUUID()+'.json';
   const body=Buffer.from(JSON.stringify(data,null,2));
   await this.run(target,filename,body);
   result={ok:true,filename,bytes:body.length,destination:target.name};
  }catch(e){error=networkError(e.code);}
  // Trigger delivery errors must never turn a completed upload into a failed backup.
  try {await this.emit(error?'network_backup_failed':'network_backup_completed',error?{destination:target.name,error:error.message}:{destination:target.name,filename:result.filename,bytes:result.bytes},{destinationId:target.id});}catch(_){/* Upload result remains authoritative. */}
  finally{this.busy=false;}
  if(error)throw error;return result;
 }
}
module.exports={NetworkDestinations,normalize,runWorker,networkError};
