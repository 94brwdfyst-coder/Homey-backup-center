'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),fs=require('node:fs');
test('settings form saves a destination and polls a single backup job',async()=>{
 const dom=new JSDOM(fs.readFileSync(require.resolve('../settings/index.html'),'utf8'),{runScripts:'outside-only'});const w=dom.window;w.BackupI18n={getLanguage:()=> 'en'};const calls=[];let targets=[];
 w.api=async(method,path,body)=>{calls.push({method,path,body});if(method==='GET')return targets;if(path==='/network'){targets=[{...body.target,id:'stable-id',hasPassword:true}];delete targets[0].password;return targets;}if(path==='/network/backup')return {jobId:'job'};if(path==='/job')return {status:'done',result:{filename:'backup.json'}};return {ok:true};};
 w.eval(fs.readFileSync(require.resolve('../settings/network'),'utf8')+';window.networkUi=NetworkUi');await w.networkUi.init();
 for(const [key,value] of Object.entries({name:'NAS',host:'nas.invalid',username:'backup',password:'SECRET',fingerprint:'SHA256:'+'A'.repeat(43)}))w.document.getElementById('net-'+key).value=value;
 w.document.getElementById('net-backup').click();for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));
 assert.equal(calls.filter(c=>c.path==='/network/backup').length,1);assert.equal(w.document.getElementById('net-password').value,'');assert.match(w.document.getElementById('network-status').textContent,/backup.json/);assert.equal(w.document.getElementById('network-fields').disabled,false);
 w.document.getElementById('net-type').value='smb';w.document.getElementById('net-type').dispatchEvent(new w.Event('change'));assert.equal(w.document.getElementById('net-port').value,'445');assert.equal(w.document.getElementById('net-fingerprint').parentElement.hidden,true);dom.window.close();
});
