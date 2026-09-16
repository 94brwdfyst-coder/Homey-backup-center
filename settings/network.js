'use strict';
// Uses the settings page's Homey API bridge; credentials never enter Flow arguments.
const NetworkUi=(()=>{
 const el=id=>document.getElementById(id);
 const fields=['name','type','host','port','share','directory','domain','username','password','fingerprint','timeoutMs'];
 let selected='',targets=[],busy=false;
 const label=(en,nl)=>BackupI18n.getLanguage()==='nl'?nl:en;
 function protocol(){const smb=el('net-type').value==='smb';for(const key of ['share','domain'])el('net-'+key).parentElement.hidden=!smb;el('net-fingerprint').parentElement.hidden=smb;}
 function edit(t={}){
  selected=t.id||'';
  const defaults={type:'sftp',port:22,directory:'/',timeoutMs:30000};
  for(const key of fields)el('net-'+key).value=key==='password'?'':t[key]??defaults[key]??'';
  el('net-password').placeholder=t.hasPassword?label('Saved; leave empty to keep','Opgeslagen; leeg laten om te behouden'):'';
  el('net-select').value=selected;protocol();
 }
 function render(){const select=el('net-select');select.replaceChildren(new Option(label('New destination','Nieuwe bestemming'),''));for(const t of targets)select.add(new Option(t.name+' ('+t.type.toUpperCase()+')',t.id));select.value=selected;}
 async function save(){const target={};for(const key of fields)target[key]=el('net-'+key).value;if(selected)target.id=selected;targets=await api('POST','/network',{target});const current=selected?targets.find(t=>t.id===selected):targets[targets.length-1];selected=current.id;render();edit(current);}
 async function poll(path){const handle=await api('POST',path,{id:selected});let done=false;
  try{for(;;){const job=await api('POST','/job',{id:handle.jobId});if(job.status==='error'){done=true;throw Error(job.error);}if(job.status==='done'){done=true;return job.result;}await new Promise(resolve=>setTimeout(resolve,700));}}
  finally{if(done)await api('POST','/job/release',{id:handle.jobId}).catch(()=>{});}
 }
 async function act(fn){if(busy)return;busy=true;el('network-fields').disabled=true;el('network-status').textContent=label('Working…','Bezig…');try{await fn();}catch(e){el('network-status').textContent=e.message||String(e);}finally{busy=false;el('network-fields').disabled=false;}}
 async function init(){
  el('net-type').onchange=()=>{el('net-port').value=el('net-type').value==='smb'?445:22;el('net-directory').value=el('net-type').value==='smb'?'':'/';protocol();};
  el('net-select').onchange=()=>edit(targets.find(t=>t.id===el('net-select').value));
  el('net-save').onclick=()=>act(async()=>{await save();el('network-status').textContent=label('Destination saved.','Bestemming opgeslagen.');});
  el('net-remove').onclick=()=>act(async()=>{if(!selected)return;targets=await api('POST','/network/remove',{id:selected});selected='';render();edit();el('network-status').textContent=label('Destination removed. Existing Flows must select another destination.','Bestemming verwijderd. Kies in bestaande Flows een andere bestemming.');});
  for(const [id,path] of [['net-test','/network/test'],['net-backup','/network/backup']])el(id).onclick=()=>act(async()=>{await save();const result=await poll(path);el('network-status').textContent=result.filename?label('Backup saved: ','Back-up opgeslagen: ')+result.filename:label('Connection and write permissions verified.','Verbinding en schrijfrechten gecontroleerd.');});
  await act(async()=>{targets=await api('GET','/network',null);render();edit();el('network-status').textContent='';});
 }
 return {init};
})();
