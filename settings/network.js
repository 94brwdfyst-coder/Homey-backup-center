'use strict';
// Uses the settings page's Homey API bridge; credentials never enter Flow arguments.
const NetworkUi=(()=>{
 const el=id=>document.getElementById(id);
 const fields=['name','type','host','port','share','directory','domain','username','password','fingerprint','timeoutMs'];
 let selected='',targets=[],busy=false;
 const selectionKey='homeyBackupCenter.network.selected';
 function rememberSelection(){try{if(selected)localStorage.setItem(selectionKey,selected);else localStorage.removeItem(selectionKey);}catch(_){/* Storage can be unavailable in embedded settings views. */}}
 const label=(en,nl)=>BackupI18n.getLanguage()==='nl'?nl:en;
 function protocol(){const smb=el('net-type').value==='smb';for(const key of ['share','domain'])el('net-'+key).parentElement.hidden=!smb;el('net-fingerprint').parentElement.hidden=smb;const l=el('net-directory-label'),h=el('net-directory-hint'),d=el('net-directory');if(smb){l.textContent=label('Existing folder inside share','Bestaande map binnen de share');h.textContent=label('Example: for smb://NAS/home/backup/homey use share = home and folder = backup/homey. Do not start the share name with /.','Voorbeeld: gebruik voor smb://NAS/home/backup/homey share = home en map = backup/homey. Zet geen / voor de sharenaam.');d.placeholder='backup/homey';}else{l.textContent=label('Remote folder','Externe map');h.textContent=label('SFTP: enter an existing absolute folder on the server, for example /home/user/backups.','SFTP: vul een bestaande absolute map op de server in, bijvoorbeeld /home/gebruiker/backups.');d.placeholder='/home/user/backups';}}
 function edit(t={}){
  selected=t.id||'';
  const defaults={type:'sftp',port:22,directory:'/',timeoutMs:30000};
  for(const key of fields)el('net-'+key).value=key==='password'?'':t[key]??defaults[key]??'';
  el('net-password').placeholder=t.hasPassword?label('Saved; leave empty to keep','Opgeslagen; leeg laten om te behouden'):'';
  el('net-select').value=selected;protocol();
 }
 function render(){const select=el('net-select');select.replaceChildren(new Option(label('New destination','Nieuwe bestemming'),''));for(const t of targets)select.add(new Option(t.name+' ('+t.type.toUpperCase()+')',t.id));select.value=selected;}
 async function save(){const target={};for(const key of fields)target[key]=el('net-'+key).value;if(selected)target.id=selected;targets=await api('POST','/network',{target});const current=selected?targets.find(t=>t.id===selected):targets[targets.length-1];selected=current.id;rememberSelection();render();edit(current);}
 async function poll(path){const handle=await api('POST',path,{id:selected});let done=false;
  try{for(;;){const job=await api('POST','/job',{id:handle.jobId});if(job.status==='error'){done=true;throw Error(job.error);}if(job.status==='done'){done=true;return job.result;}await new Promise(resolve=>setTimeout(resolve,700));}}
  finally{if(done)await api('POST','/job/release',{id:handle.jobId}).catch(()=>{});}
 }
 function status(text,kind=''){const s=el('network-status');s.textContent=text;s.className='hint'+(kind?' '+kind:'');s.scrollIntoView({block:'nearest',behavior:'smooth'});} async function act(fn){if(busy)return;busy=true;el('network-fields').disabled=true;status(label('Working…','Bezig…'));try{await fn();}catch(e){status('✗ '+(e.message||String(e)),'error');}finally{busy=false;el('network-fields').disabled=false;}}
 async function init(){
  el('net-type').onchange=()=>{el('net-port').value=el('net-type').value==='smb'?445:22;el('net-directory').value=el('net-type').value==='smb'?'':'/';protocol();};
  el('net-select').onchange=()=>{selected=el('net-select').value;rememberSelection();edit(targets.find(t=>t.id===selected));};
  el('net-save').onclick=()=>act(async()=>{status(label('Saving destination…','Bestemming opslaan…'));await save();status('✓ '+label('Destination saved.','Bestemming opgeslagen.'),'ok');});
  el('net-remove').onclick=()=>act(async()=>{if(!selected)return;targets=await api('POST','/network/remove',{id:selected});selected='';rememberSelection();render();edit();status('✓ '+label('Destination removed. Existing Flows must select another destination.','Bestemming verwijderd. Kies in bestaande Flows een andere bestemming.'),'ok');});
  for(const [id,path] of [['net-test','/network/test'],['net-backup','/network/backup']])el(id).onclick=()=>act(async()=>{status(id==='net-test'?label('Saving settings, then testing connection and write access…','Instellingen opslaan, daarna verbinding en schrijfrechten testen…'):label('Saving settings, then creating network backup…','Instellingen opslaan, daarna netwerkback-up maken…'));await save();const result=await poll(path);status('✓ '+(result.filename?label('Backup saved: ','Back-up opgeslagen: ')+result.filename:label('Connection and write permissions verified.','Verbinding en schrijfrechten gecontroleerd.')),'ok');});
  await act(async()=>{targets=await api('GET','/network',null);let remembered='';try{remembered=localStorage.getItem(selectionKey)||'';}catch(_){/* Ignore unavailable storage. */}selected=targets.some(t=>t.id===remembered)?remembered:(targets[0]?.id||'');rememberSelection();render();edit(targets.find(t=>t.id===selected));status('');});
 }
 return {init};
})();
