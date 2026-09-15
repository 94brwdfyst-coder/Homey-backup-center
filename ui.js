'use strict';
let snapshot = null;
let webdavTargets = [];
const $ = id => document.getElementById(id);
const tr = BackupI18n.t;
let stagedBackup=null;
let operationBusy=false;
const api = (method, path, data) => new Promise((resolve, reject) => Homey.api(method, path, data, (err, result) => err ? reject(err) : resolve(result)));

function fileBlob(data){ return new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}); }
function downloadBlob(blob,name,shareOnly=false){return BackupDownload.save(blob,name,{status:$('status'),links:$('downloadLinks'),shareOnly});}
function backupName(){return FlowBackup.backupFilename(snapshot?.createdAt ? new Date(snapshot.createdAt) : new Date());}
async function shareBackup(){if(snapshot)return downloadBlob(fileBlob(snapshot),backupName(),true);}
function setOperationBusy(busy){
  operationBusy=busy;
  for(const id of ['file','fetch','language'])$(id).disabled=busy;
}
async function ensureStagedBackup(){
  if(stagedBackup)return stagedBackup.id;
  stagedBackup=await BackupTransfer.upload(snapshot,percent=>{$('restoreStatus').textContent=tr('Transferring backup: ')+percent+'%';});
  return stagedBackup.id;
}
async function stagedPlan(){return BackupTransfer.job('/restore/staged-plan',{id:await ensureStagedBackup()});}
function show(data,label){
  BackupTransfer.release(stagedBackup?.id);stagedBackup=null;window.__restorePlan=null;window.__restoreArmed=false;
  snapshot=data;$('source').textContent=label;$('save').disabled=false;$('share').disabled=false;
  FlowBackup.validate(data.flows);renderStats(data.stats||{});render();
  if($('planRestore')) $('planRestore').disabled=false;
  if($('runRestore')) $('runRestore').disabled=true;
  if($('restoreStatus')) $('restoreStatus').textContent=tr('Back-up geladen. Maak eerst een herstelplan.');
  if($('restorePlan')) $('restorePlan').textContent='';
  if($('restoreResult')) {$('restoreResult').textContent=''; $('restoreResult').className='restore-result';}
  if($('restoreCounts')) $('restoreCounts').textContent='';
  if($('logicSelection')) $('logicSelection').replaceChildren();
  if($('restoreDetails')) $('restoreDetails').open=false;
}
function renderStats(s){ const el=$('stats'); el.hidden=false; const entries=[[tr('Standaardflows'),s.standardFlows],[tr('Advanced flows'),s.advancedFlows],[tr('Apparaten'),s.devices],['Apps',s.apps],['Zones',s.zones],['Logic',s.variables]]; el.replaceChildren(...entries.map(([n,v])=>{const d=document.createElement('div');d.className='stat';d.innerHTML='<b>'+String(v??'—')+'</b>'+n;return d;})); }
function render(){ $('list').replaceChildren();if(!snapshot)return;const term=$('search').value.toLocaleLowerCase();const flows=snapshot.flows.filter(f=>(f.name+' '+(f.folderName||'Root')).toLocaleLowerCase().includes(term));if(!flows.length){$('list').textContent=tr('Geen flows gevonden.');return;}for(const f of flows){const row=document.createElement('div');row.className='flow';const text=document.createElement('div');text.textContent=f.name;const sub=document.createElement('small');sub.textContent=(f.type==='advanced'?'Advanced':tr('Standaard'))+' · '+(f.folderName||'Root');text.appendChild(sub);const button=document.createElement('button');button.className='secondary';button.textContent=tr('Flowbestand bewaren');button.onclick=()=>downloadBlob(new Blob([JSON.stringify(f,null,2)],{type:'application/json'}),FlowBackup.filename(f));row.append(text,button);$('list').appendChild(row);}}

function newTarget(){return {id:'webdav-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name:tr('Mijn WebDAV'),url:'',username:'',password:'',hasPassword:false};}
function renderTargets(){
  const host=$('targets');host.replaceChildren();
  if(!webdavTargets.length){const p=document.createElement('p');p.className='hint';p.textContent=tr('Nog geen WebDAV-locaties ingesteld.');host.appendChild(p);return;}
  webdavTargets.forEach((t,i)=>{const wrap=document.createElement('div');wrap.className='target';wrap.innerHTML=`<div class="grid"><div class="field"><label>${tr('Naam')}</label><input data-k="name" value="${escapeHtml(t.name||'')}"></div><div class="field"><label>${tr('WebDAV-map-URL')}</label><input data-k="url" inputmode="url" placeholder="https://server.example/remote.php/dav/files/gebruiker/Homey/" value="${escapeHtml(t.url||'')}"></div><div class="field"><label>${tr('Gebruikersnaam')}</label><input data-k="username" autocomplete="username" value="${escapeHtml(t.username||'')}"></div><div class="field"><label>${tr('Wachtwoord')} ${t.hasPassword?tr('(opgeslagen; leeg = behouden)'):''}</label><input data-k="password" type="password" autocomplete="new-password" placeholder="${t.hasPassword?'••••••••':''}"></div></div><div class="target-actions"><button class="secondary" data-a="test">${tr('Verbinding testen')}</button><button data-a="upload">${tr('Maak back-up → WebDAV')}</button><button class="danger" data-a="remove">${tr('Verwijder')}</button></div><p class="hint" data-status></p>`;
    wrap.querySelectorAll('input').forEach(inp=>inp.oninput=()=>{t[inp.dataset.k]=inp.value;});
    wrap.querySelector('[data-a=remove]').onclick=()=>{webdavTargets.splice(i,1);renderTargets();};
    wrap.querySelector('[data-a=test]').onclick=async e=>{const s=wrap.querySelector('[data-status]');try{const button=e.currentTarget;button.disabled=true;await saveTargets(false,false);const r=await api('POST','/webdav/test',{targetId:t.id});s.textContent=tr('✓ Verbinding gelukt (HTTP ')+r.status+').';s.className='hint ok';}catch(err){s.textContent=tr('Test mislukt: ')+tr(err.message||String(err));s.className='hint error';}finally{wrap.querySelectorAll('button').forEach(b=>b.disabled=false);}};
    wrap.querySelector('[data-a=upload]').onclick=async e=>{const s=wrap.querySelector('[data-status]');try{const button=e.currentTarget;button.disabled=true;await saveTargets(false,false);s.textContent=tr('Back-up wordt gemaakt en geüpload…');const r=await api('POST','/webdav/upload',{targetId:t.id});s.textContent='✓ '+r.filename+tr(' opgeslagen op ')+r.target+' ('+Math.round(r.bytes/1024)+' kB).';s.className='hint ok';}catch(err){s.textContent=tr('Upload mislukt: ')+tr(err.message||String(err));s.className='hint error';}finally{wrap.querySelectorAll('button').forEach(b=>b.disabled=false);}};
    host.appendChild(wrap);
  });
}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
const WEEKDAYS=[['0','Zo'],['1','Ma'],['2','Di'],['3','Wo'],['4','Do'],['5','Vr'],['6','Za']];
function renderScheduleWeekdays(selected){
  const box=$('schedWeekdays'); if(!box)return;
  box.replaceChildren();
  for(const [num,label] of WEEKDAYS){
    const wrap=document.createElement('label'); wrap.style.display='inline-flex'; wrap.style.gap='6px'; wrap.style.alignItems='center'; wrap.style.marginRight='14px';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.value=num; cb.checked=selected.includes(num);
    wrap.appendChild(cb); wrap.appendChild(document.createTextNode(tr(label))); box.appendChild(wrap);
  }
}
function selectedWeekdays(){return [...$('schedWeekdays').querySelectorAll('input:checked')].map(x=>x.value);}
function renderScheduleTargetSelect(selectedId){
  const sel=$('schedTarget'); if(!sel)return;
  sel.replaceChildren();
  if(!webdavTargets.length){const o=document.createElement('option');o.value='';o.textContent=tr('Geen WebDAV-locatie — voeg er eerst één toe');sel.appendChild(o);return;}
  for(const t of webdavTargets){const o=document.createElement('option');o.value=t.id;o.textContent=t.name||t.url;sel.appendChild(o);}
  sel.value=selectedId;
}
function renderSchedule(s){
  $('schedEnabled').checked=!!s.enabled;$('schedTime').value=s.time;
  renderScheduleWeekdays(s.weekdays||[]);renderScheduleTargetSelect(s.targetId||'');
  $('schedNotifyUser').value=s.notifyUserId||'';
  showScheduleStatus(s);
}
function showScheduleStatus(s){
  const date=value=>value?new Date(value).toLocaleString(BackupI18n.getLanguage(),{timeZone:'Europe/Amsterdam'}):tr('none');
  const lines=[s.enabled?tr('Automatic backup enabled'):tr('Automatic backup disabled')];
  lines.push(tr('Last automatic attempt: ')+date(s.lastAttempt));
  lines.push(tr('Last automatic success: ')+date(s.lastRun));
  if(s.attemptDate)lines.push(tr('Attempts for ')+s.attemptDate+': '+s.attempts+'/3');
  if(s.lastStatus==='running')lines.push(tr('Backup is running…'));
  if(s.lastError)lines.push(tr('Backup error: ')+tr(s.lastError));
  if(s.notificationError)lines.push(tr('Push delivery failed: ')+tr(s.notificationError));
  if(s.timelineError)lines.push(tr('Timeline notification failed: ')+tr(s.timelineError));
  if(s.nextAttemptAt && s.lastStatus==='error' && s.attempts<3)lines.push(tr('Next retry no earlier than: ')+date(s.nextAttemptAt));
  if(s.manual)lines.push(tr('Last manual attempt: ')+date(s.manual.at)+(s.manual.status==='ok'?' ✓':' ✗'));
  if(s.warnings?.length)lines.push(tr('Backup warnings: ')+s.warnings.map(tr).join(' | '));
  $('scheduleStatus').textContent=lines.join('\n');$('scheduleStatus').className='hint'+(s.lastStatus==='error'||s.notificationError?' error':'');
}
async function loadNotificationUsers(){
  const select=$('schedNotifyUser');select.replaceChildren();
  const owner=document.createElement('option');owner.value='';owner.textContent=tr('Homey owner (automatic)');select.appendChild(owner);
  try{for(const user of await api('GET','/notification-users',null)){const o=document.createElement('option');o.value=user.id;o.textContent=user.name;select.appendChild(o);}}
  catch(e){$('notificationHelp').textContent=tr('Push recipients could not be loaded: ')+tr(e.message||String(e));}
}
async function saveTargets(showMessage=true,redraw=true){const config=webdavTargets.map(t=>({id:t.id,name:t.name,url:t.url,username:t.username,password:t.password||''}));const saved=await api('POST','/webdav',{config:JSON.stringify(config)});webdavTargets=saved.map(t=>{const existing=webdavTargets.find(x=>x.id===t.id)||{};return Object.assign(existing,t,{password:''});});if(redraw)renderTargets();if($('scheduleStatus')) renderScheduleTargetSelect($('schedTarget')?.value||'');if(showMessage)$('webdavStatus').textContent=tr('WebDAV-instellingen bewaard.');}

async function loadSchedule(){
  try{
    const s=await api('GET','/schedule',null);
    renderSchedule(s);

  }catch(e){ if($('scheduleStatus')){$('scheduleStatus').textContent=tr('Schema laden mislukt: ')+tr(e.message||String(e));$('scheduleStatus').className='hint error';} }
}
async function saveSchedule(showMessage=true){
  const config={enabled:$('schedEnabled').checked,time:$('schedTime').value,weekdays:selectedWeekdays(),targetId:$('schedTarget').value,notifyUserId:$('schedNotifyUser').value};
  if(config.enabled && config.weekdays.length===0){ $('scheduleStatus').textContent=tr('Kies minimaal één dag als de back-up is ingeschakeld.');$('scheduleStatus').className='hint error';return; }
  try{
    const s=await api('POST','/schedule',{config});
    renderSchedule(s);
    if(showMessage){ $('scheduleStatus').className='hint ok'; $('scheduleStatus').textContent=tr('Schema bewaard.')+(s.enabled?tr(' De automatische back-up is actief.'):''); }
  }catch(e){ $('scheduleStatus').textContent=tr('Schema opslaan mislukt: ')+tr(e.message||String(e)); $('scheduleStatus').className='hint error'; }
}
async function runScheduleNow(){
  const targetId=$('schedTarget').value;
  if(!targetId){ $('scheduleStatus').textContent=tr('Kies eerst een WebDAV-locatie.'); $('scheduleStatus').className='hint error'; return; }
  const btn=$('runScheduleNow'); const st=$('scheduleStatus');
  try{
    btn.disabled=true; st.textContent=tr('Back-up wordt nu gemaakt en geüpload…'); st.className='hint';
    const r=await api('POST','/schedule/run',{targetId});
    st.textContent='✓ '+r.filename+tr(' opgeslagen op ')+r.target+' ('+Math.round(r.bytes/1024)+' kB).'; st.className='hint ok';
  }catch(e){ st.textContent=tr('Back-up mislukt: ')+tr(e.message||String(e)); st.className='hint error'; }
  finally{ btn.disabled=false; }
}

$('search').oninput=render;$('save').onclick=()=>snapshot&&downloadBlob(fileBlob(snapshot),backupName());$('share').onclick=shareBackup;$('addTarget').onclick=()=>{webdavTargets.push(newTarget());renderTargets();};$('saveTargets').onclick=()=>saveTargets(true).catch(e=>$('webdavStatus').textContent=tr('Opslaan mislukt: ')+tr(e.message||String(e)));
$('file').onchange=async event=>{if(operationBusy)return;const file=event.target.files[0];if(!file)return;setOperationBusy(true);$('planRestore').disabled=true;$('runRestore').disabled=true;try{if(file.size>50*1024*1024)throw Error(tr('Bestand is groter dan 50 MB.'));show(FlowBackup.parse(await file.text()),tr('Geopend: ')+file.name);$('status').textContent=tr('Bewaarde back-up geopend.');}catch(error){snapshot=null;window.__restorePlan=null;window.__restoreArmed=false;$('planRestore').disabled=true;$('runRestore').disabled=true;BackupTransfer.release(stagedBackup?.id);stagedBackup=null;$('save').disabled=true;$('share').disabled=true;$('source').textContent='';render();$('status').textContent=tr('Openen mislukt: ')+tr(error.message);}finally{setOperationBusy(false);}};



async function loadRestoreAuth(){
  const el=$('restoreAuthStatus'); if(!el)return;
  try{
    const st=await api('GET','/restore/auth',null);
    el.textContent=st.connected?tr('✓ Homey API Key is opgeslagen en de lokale Homey API-verbinding werkt.'):st.configured?tr('Homey API Key is opgeslagen, maar verbinding is niet actief')+(st.error?': '+st.error:''):tr('Nog geen Homey API Key opgeslagen; dry-run werkt wel, terugschrijven niet.');
    el.className='hint '+(st.connected?'ok':'');
  }catch(e){el.textContent=tr('Homey API Key-status kon niet worden geladen: ')+tr(e.message||String(e));el.className='hint error';}
}
async function saveRestorePat(clear=false){
  const input=$('restorePat'), el=$('restoreAuthStatus');
  const token=clear?'':String(input?.value||'').trim();
  if(!clear && !token){el.textContent=tr('Vul een nieuwe Homey API Key in, of gebruik “Verbinding testen” om de bestaande token te controleren.');return;}
  try{
    const st=await api('POST','/restore/auth',{token});
    if(input) input.value='';
    el.textContent=clear?tr('Homey API Key gewist.'):st.connected?tr('✓ Homey API Key opgeslagen en verbonden.'):tr('Homey API Key opgeslagen, maar verbinding niet actief')+(st.error?': '+st.error:'');
    el.className='hint '+(st.connected?'ok':'');
  }catch(e){el.textContent=tr('Homey API Key opslaan mislukt: ')+tr(e.message||String(e));el.className='hint error';}
}
async function testRestorePat(){
  const el=$('restoreAuthStatus');
  try{const st=await api('POST','/restore/auth/test',{});el.textContent=tr('✓ Homey API Key-authenticatie werkt. Vereiste schrijfrechten worden bij de daadwerkelijke geselecteerde restore gecontroleerd.');el.className='hint ok';}
  catch(e){el.textContent=tr('Homey API Key-test mislukt: ')+tr(e.message||String(e));el.className='hint error';}
}

function displayValue(v){
  if(typeof v==='string') return '"'+v+'"';
  if(v===undefined) return '—';
  try{return JSON.stringify(v);}catch(_){return String(v);}
}
function summarizeRestorePlan(plan){
  const rows=[];
  const add=(label,x)=>{
    if(!x)return;
    if(typeof x==='number') rows.push(label+': '+x);
    else rows.push(label+': '+[x.ready,x.total].filter(v=>v!==undefined).join('/')+(x.changes!==undefined?' · '+x.changes+tr(' wijziging(en)'):'')+(x.warnings?.length?' · '+x.warnings.length+tr(' waarschuwing(en)'):''));
  };
  add('Apps',plan.apps); add('Zones',plan.zones); add('Logic',plan.variables);
  add(tr('Apparaten'),plan.devices); add(tr('Standaardflows'),plan.standardFlows); add(tr('Advanced flows'),plan.advancedFlows);

  const details=[];
  for(const v of plan.variables?.operations||[]){
    if(v.action==='none')continue;
    details.push('Logic — '+v.name+' ['+tr(v.action)+tr(']\n  huidig: ')+displayValue(v.currentValue)+tr('\n  back-up: ')+displayValue(v.value));
  }
  for(const z of plan.zones?.operations||[]){
    if(z.action==='none')continue;
    let line='Zone — '+(z.name||z.id)+' ['+tr(z.action)+']';
    if(z.changes?.length) line+=tr('\n  wijzigingen: ')+z.changes.map(tr).join(', ');
    if(z.action==='update') line+=tr('\n  huidig: ')+displayValue({name:z.currentName,parent:z.currentParent,icon:z.currentIcon})+tr('\n  back-up: ')+displayValue({name:z.name,parent:z.parent||null,icon:z.icon});
    details.push(line);
  }
  for(const d of plan.devices?.operations||[]){
    if(d.action==='none'||d.action==='missing')continue;
    let line=tr('Apparaat — ')+(d.name||d.id)+tr('\n  wijzigingen: ')+(d.changes||[]).map(tr).join(', ');
    if(Array.isArray(d.settingDetails)&&d.settingDetails.length){
      for(const sd of d.settingDetails){
        if(sd.sensitive){
          line+='\n  setting '+sd.key+tr(': waarde verborgen (')+(sd.currentType||'?')+' → '+(sd.backupType||'?')+')';
        }else{
          line+='\n  setting '+sd.key+tr(': huidig ')+displayValue(sd.currentValue)+' ('+(sd.currentType||'?')+tr(') → back-up ')+displayValue(sd.backupValue)+' ('+(sd.backupType||'?')+')';
        }
        if(sd.settingType) line+=tr(' · Homey-type ')+sd.settingType;
        if(sd.writable===false) line+=tr(' · NIET VEILIG SCHRIJFBAAR');
      }
    }
    details.push(line);
  }
  for(const f of plan.standardFlows?.operations||[]){if(f.action!=='none')details.push(tr('Standaardflow — ')+f.name+' ['+tr(f.action)+']');}
  for(const f of plan.advancedFlows?.operations||[]){if(f.action!=='none')details.push(tr('Advanced flow — ')+f.name+' ['+tr(f.action)+']');}
  for(const a of plan.apps?.install||[])details.push(tr('App installeren — ')+(a.name||a.id));
  if(details.length) rows.push(tr('\nGEPLANDE WIJZIGINGEN:\n\n')+details.join('\n\n'));

  if(plan.noChangesNeeded) rows.push(tr('\n✓ 0 wijzigingen nodig — Homey komt overeen met deze back-up.'));
  else if(plan.totalChanges!==undefined) rows.push(tr('\nTotaal geplande wijzigingen: ')+plan.totalChanges);
  if(plan.blockers?.length) rows.push(tr('\nBLOKKADES:\n- ')+plan.blockers.join('\n- '));
  if(plan.warnings?.length) rows.push(tr('\nWAARSCHUWINGEN:\n- ')+plan.warnings.join('\n- '));
  return rows.join('\n') || JSON.stringify(plan,null,2);
}

function compactRestoreCounts(plan){
  const parts=[];
  const add=(label,x)=>{if(x && x.changes) parts.push(label+': '+x.changes);};
  add('Apps',plan.apps); add('Zones',plan.zones); add('Logic',plan.variables); add(tr('Apparaten'),plan.devices); add(tr('Standaardflows'),plan.standardFlows); add(tr('Advanced flows'),plan.advancedFlows);
  return parts.length ? tr('Gevonden verschillen — ')+parts.join(' · ') : tr('Geen verschillen gevonden.');
}
function clearRestoreSelection(){const box=$('logicSelection'); if(box) box.replaceChildren();}
function renderLogicSelection(plan){
  const box=$('logicSelection'); if(!box)return;
  box.innerHTML='';
  const ops=(plan.variables?.operations||[]).filter(v=>v.action!=='none');
  if(!ops.length)return;
  const title=document.createElement('p'); title.innerHTML='<b>'+tr('Logic selecteren voor restore')+'</b>'; box.appendChild(title);
  for(const v of ops){
    const label=document.createElement('label'); label.style.display='block'; label.style.margin='8px 0';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.className='logicRestoreSelect'; cb.dataset.name=v.name; cb.checked=false;
    label.appendChild(cb); label.appendChild(document.createTextNode(' '+v.name+(v.volatile?tr(' — dynamisch, overslaan'):' — '+displayValue(v.currentValue)+' → '+displayValue(v.value)))); box.appendChild(label);
  }
}
function renderZoneSelection(plan){
  const box=$('logicSelection'); if(!box)return;
  const ops=(plan.zones?.operations||[]).filter(z=>z.action!=='none');
  if(!ops.length)return;
  const title=document.createElement('p'); title.innerHTML='<b>'+tr('Zones selecteren voor restore')+'</b>'; box.appendChild(title);
  for(const z of ops){
    const label=document.createElement('label'); label.style.display='block'; label.style.margin='8px 0';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.className='zoneRestoreSelect'; cb.dataset.id=z.id; cb.checked=false;
    const changes=(z.changes||[]).length?' — '+z.changes.map(tr).join(', '):'';
    label.appendChild(cb); label.appendChild(document.createTextNode(' '+(z.name||z.id)+changes)); box.appendChild(label);
  }
}
function selectedZoneIds(){return [...document.querySelectorAll('.zoneRestoreSelect:checked')].map(x=>x.dataset.id);}

function renderDeviceSelection(plan){
  const box=$('logicSelection'); if(!box)return;
  const ops=(plan.devices?.operations||[]).filter(d=>d.action==='update');
  if(!ops.length)return;
  const title=document.createElement('p'); title.innerHTML='<b>'+tr('Apparaten selecteren voor restore')+'</b>'; box.appendChild(title);
  for(const d of ops){
    const label=document.createElement('label'); label.style.display='block'; label.style.margin='8px 0';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.className='deviceRestoreSelect'; cb.dataset.id=d.id; cb.checked=false;
    let detail='';
    const safe=(d.settingDetails||[]).filter(x=>x.writable!==false);
    if(safe.length===1){const x=safe[0]; detail=' — '+x.key+(x.sensitive?tr(' (waarde verborgen)'):' '+displayValue(x.currentValue)+' → '+displayValue(x.backupValue));}
    else if(safe.length>1) detail=' — '+safe.length+tr(' instellingen');
    else if((d.changes||[]).length) detail=' — '+d.changes.map(tr).join(', ');
    label.appendChild(cb); label.appendChild(document.createTextNode(' '+(d.name||d.id)+detail)); box.appendChild(label);
  }
}
function selectedDeviceIds(){return [...document.querySelectorAll('.deviceRestoreSelect:checked')].map(x=>x.dataset.id);}

function renderFlowSelection(plan){
  const box=$('logicSelection'); if(!box)return;
  const groups=[
    [tr('Standaardflows selecteren voor restore'),'standardFlowRestoreSelect',plan.standardFlows?.operations||[]],
    [tr('Advanced flows selecteren voor restore'),'advancedFlowRestoreSelect',plan.advancedFlows?.operations||[]]
  ];
  for(const [titleText,className,allOps] of groups){
    const ops=allOps.filter(f=>f.action!=='none');
    if(!ops.length)continue;
    const title=document.createElement('p'); title.innerHTML='<b>'+titleText+'</b>'; box.appendChild(title);
    for(const f of ops){
      const label=document.createElement('label'); label.style.display='block'; label.style.margin='8px 0';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.className=className; cb.dataset.id=f.id; cb.checked=false;
      label.appendChild(cb); label.appendChild(document.createTextNode(' '+f.name+' ['+tr(f.action)+']')); box.appendChild(label);
    }
  }
}
function selectedLogicNames(){return [...document.querySelectorAll('.logicRestoreSelect:checked')].map(x=>x.dataset.name);}
function selectedFlowIds(className){return [...document.querySelectorAll('.'+className+':checked')].map(x=>x.dataset.id);}

async function requestRestorePlan(){
  if(!snapshot)return;
  const status=$('restoreStatus'), pre=$('restorePlan');
  try{
    setOperationBusy(true);window.__restorePlan=null;window.__restoreArmed=false;
    $('planRestore').disabled=true; $('runRestore').disabled=true;
    status.textContent=tr('Herstelplan wordt gecontroleerd…');
    const plan=await stagedPlan();
    clearRestoreSelection();
    if($('restoreResult')) {$('restoreResult').textContent=''; $('restoreResult').className='restore-result';}
    if($('restoreCounts')) $('restoreCounts').textContent=compactRestoreCounts(plan);
    renderLogicSelection(plan); renderZoneSelection(plan); renderDeviceSelection(plan); renderFlowSelection(plan);
    pre.textContent=summarizeRestorePlan(plan);
    if($('restoreDetails')) $('restoreDetails').open=false;
    status.textContent=plan.blockers?.length?tr('Herstelplan bevat blokkades; restore is geblokkeerd.'):plan.noChangesNeeded?tr('✓ Alles komt overeen met deze back-up.'):tr('Kies hieronder alleen wat je wilt herstellen.');
    $('runRestore').disabled=!!plan.blockers?.length || !!plan.noChangesNeeded;
    window.__restorePlan=plan;
  }catch(e){
    pre.textContent='';
    status.textContent=tr('Restore plan failed: ')+tr(e.message||String(e));
    BackupTransfer.release(stagedBackup?.id);stagedBackup=null;
  }finally{setOperationBusy(false);$('planRestore').disabled=!snapshot;}
}

async function runRestore(){
  if(!snapshot || !window.__restorePlan)return;
  const button=$('runRestore'), status=$('restoreStatus');
  // Homey iOS webviews do not always surface window.confirm reliably. Use an explicit two-tap confirmation.
  if(!window.__restoreArmed){
    window.__restoreArmed=true;
    button.textContent=tr('Bevestig restore');
    status.textContent=tr('Controleer het plan. Tik nogmaals op “Bevestig restore” om de geplande wijzigingen uit te voeren.');
    setTimeout(()=>{if(window.__restoreArmed){window.__restoreArmed=false;button.textContent=tr('Restore uitvoeren');}},15000);
    return;
  }
  window.__restoreArmed=false;
  button.textContent=tr('Restore uitvoeren');
  try{
    setOperationBusy(true);button.disabled=true;$('planRestore').disabled=true;
    status.textContent=tr('Restore wordt uitgevoerd…');
    // Bewaar exact wat de gebruiker voor deze run heeft geselecteerd. De verse
    // verificatie kan andere, niet-geselecteerde verschillen bevatten; die mogen
    // een geslaagde restore niet als mislukt laten lijken.
    const selectedLogic=selectedLogicNames();
    const selectedZones=selectedZoneIds();
    const selectedDevices=selectedDeviceIds();
    const selectedStandardFlows=selectedFlowIds('standardFlowRestoreSelect');
    const selectedAdvancedFlows=selectedFlowIds('advancedFlowRestoreSelect');
    const selectedTotal=selectedLogic.length+selectedZones.length+selectedDevices.length+selectedStandardFlows.length+selectedAdvancedFlows.length;
    if(!selectedTotal){status.textContent=tr('Selecteer eerst minimaal één zone, Logic-waarde, apparaat of flow om te herstellen.');button.disabled=false;return;}
    const selectionTransfer=await BackupTransfer.upload({zones:selectedZones,logic:selectedLogic,devices:selectedDevices,standardFlows:selectedStandardFlows,advancedFlows:selectedAdvancedFlows},null,'selection');
    let result;
    try{result=await BackupTransfer.job('/restore/staged-run',{id:await ensureStagedBackup(),confirm:true,selectionId:selectionTransfer.id});}
    finally{await BackupTransfer.release(selectionTransfer.id);}

    if(!result.ok){$('restorePlan').textContent=JSON.stringify(result,null,2); if($('restoreResult')){$('restoreResult').textContent=tr('✗ Restore afgerond met fouten. Open technische details voor het rapport.');$('restoreResult').className='restore-result error';} status.textContent=tr('Restore niet geslaagd.');return;}
    status.textContent=tr('Restore uitgevoerd. Geselecteerde wijzigingen worden geverifieerd…');
    const verify=await stagedPlan();
    window.__restorePlan=verify;

    const remainingZones=new Set((verify.zones?.operations||[]).filter(z=>z.action!=='none').map(z=>z.id));
    const remainingDevices=new Set((verify.devices?.operations||[]).filter(d=>d.action==='update').map(d=>d.id));
    const remainingLogic=new Map((verify.variables?.operations||[]).filter(v=>v.action!=='none').map(v=>[v.name,v]));
    const remainingStd=new Set((verify.standardFlows?.operations||[]).filter(v=>v.action!=='none').map(v=>v.id));
    const remainingAdv=new Set((verify.advancedFlows?.operations||[]).filter(v=>v.action!=='none').map(v=>v.id));
    const failedZones=selectedZones.filter(id=>remainingZones.has(id));
    const failedDevices=selectedDevices.filter(id=>remainingDevices.has(id));
    const failedLogic=selectedLogic.filter(name=>remainingLogic.has(name));
    const failedStd=selectedStandardFlows.filter(id=>remainingStd.has(id));
    const failedAdv=selectedAdvancedFlows.filter(id=>remainingAdv.has(id));
    const failedCount=failedZones.length+failedDevices.length+failedLogic.length+failedStd.length+failedAdv.length;
    const verifiedCount=selectedTotal-failedCount;
    const otherChanges=Math.max(0,(verify.totalChanges||0)-failedCount);

    let verification=tr('\n\nRESTORE-VERIFICATIE:');
    if(verifiedCount) verification+=tr('\n\n✓ Geverifieerd: ')+verifiedCount+'/'+selectedTotal+tr(' geselecteerde wijziging(en).');
    if(failedCount){
      verification+=tr('\n✗ Nog afwijkend: ')+failedCount+tr(' geselecteerde wijziging(en).');
      for(const id of failedZones){const z=(verify.zones?.operations||[]).find(x=>x.id===id);verification+='\n  Zone: '+(z?.name||id)+' ('+(z?.changes||[]).map(tr).join(', ')+')';}
      for(const id of failedDevices){const d=(verify.devices?.operations||[]).find(x=>x.id===id);verification+=tr('\n  Apparaat: ')+(d?.name||id)+' ('+(d?.changes||[]).map(tr).join(', ')+')';}
      for(const name of failedLogic){const v=remainingLogic.get(name);verification+='\n  Logic '+name+tr(': huidig ')+displayValue(v?.currentValue)+tr(' · verwacht ')+displayValue(v?.value);}
      for(const id of failedStd){const f=(verify.standardFlows?.operations||[]).find(x=>x.id===id);verification+=tr('\n  Standaardflow: ')+(f?.name||id);}
      for(const id of failedAdv){const f=(verify.advancedFlows?.operations||[]).find(x=>x.id===id);verification+='\n  Advanced flow: '+(f?.name||id);}
    }
    if(otherChanges>0) verification+=tr('\n\nOVERIGE VERSCHILLEN — NIET GEWIJZIGD: ')+otherChanges;

    $('restorePlan').textContent=summarizeRestorePlan(verify)+verification;
    if($('restoreDetails')) $('restoreDetails').open=false;
    clearRestoreSelection();
    if($('restoreCounts')) $('restoreCounts').textContent=otherChanges ? otherChanges+tr(' overige verschil(len) met deze back-up — niet gewijzigd.') : tr('Geen overige verschillen.');
    const resultBox=$('restoreResult');
    if(failedCount){
      status.textContent=tr('Restore niet volledig geverifieerd.');
      if(resultBox){resultBox.textContent='✗ '+failedCount+tr(' van ')+selectedTotal+tr(' geselecteerde wijziging(en) wijkt nog af. Open technische details voor meer informatie.');resultBox.className='restore-result error';}
    }else{
      status.textContent=tr('Restore afgerond.');
      if(resultBox){resultBox.textContent=tr('✓ Herstel geslaagd — ')+verifiedCount+tr(' van ')+selectedTotal+tr(' geselecteerde wijziging(en) uitgevoerd én gecontroleerd.');resultBox.className='restore-result ok';}
    }
    button.disabled=!!verify.blockers?.length || !!verify.noChangesNeeded;
  }catch(e){status.textContent=tr('Restore mislukt: ')+tr(e.message||String(e));button.disabled=true;window.__restorePlan=null;}
  finally{setOperationBusy(false);$('planRestore').disabled=false;}
}
async function onHomeyReady(HomeyInstance){
  window.Homey=HomeyInstance;BackupTransfer.configure(api);HomeyInstance.ready();
  const info=await api('GET','/app-info',null).catch(()=>({language:'nl'}));
  BackupI18n.setLanguage(info.language);BackupI18n.apply(document);$('language').value=BackupI18n.getLanguage();
  $('language').onchange=async()=>{try{await api('POST','/language',{language:$('language').value});location.reload();}catch(e){$('languageStatus').textContent=tr('Language could not be saved: ')+tr(e.message||String(e));}};
  await loadNotificationUsers();
  setInterval(()=>{if(!operationBusy)api('GET','/schedule',null).then(showScheduleStatus).catch(()=>{});},15000);
  api('GET','/app-info',null).then(info=>{ const v=String(info?.version||'—'); if($('appVersion')) $('appVersion').textContent=v; if($('restoreVersion')) $('restoreVersion').textContent=v; }).catch(()=>{ if($('appVersion')) $('appVersion').textContent='—'; if($('restoreVersion')) $('restoreVersion').textContent='—'; });
  $('fetch').onclick=async()=>{try{setOperationBusy(true);$('fetch').disabled=true;$('status').textContent=tr('Homey-back-up wordt opgebouwd…');const data=await BackupTransfer.job('/export/prepare',{});show(data,tr('Opgehaald uit deze Homey: ')+new Date(data.createdAt).toLocaleString(BackupI18n.getLanguage()));const w=(data.warnings||[]);$('status').textContent=tr('Back-up klaar.')+(w.length?tr(' Waarschuwingen: ')+w.join(' | '):'');}catch(error){snapshot=null;window.__restorePlan=null;window.__restoreArmed=false;$('planRestore').disabled=true;$('runRestore').disabled=true;BackupTransfer.release(stagedBackup?.id);stagedBackup=null;$('save').disabled=true;$('share').disabled=true;$('status').textContent=tr('Ophalen mislukt: ')+tr(error.message||String(error));}finally{setOperationBusy(false);$('fetch').disabled=false;}};
  api('GET','/webdav',null).then(x=>{webdavTargets=x.map(t=>({...t,password:''}));renderTargets();loadSchedule();}).catch(e=>{$('webdavStatus').textContent=tr('WebDAV-instellingen laden mislukt: ')+tr(e.message||String(e));loadSchedule();});
  if($('saveSchedule')) $('saveSchedule').onclick=()=>saveSchedule().catch(e=>{ $('scheduleStatus').textContent=tr('Iets misgegaan: ')+tr(e.message||String(e)); });
  if($('runScheduleNow')) $('runScheduleNow').onclick=runScheduleNow;
  loadRestoreAuth();
  if($('saveRestorePat')) $('saveRestorePat').onclick=()=>saveRestorePat(false);
  if($('testRestorePat')) $('testRestorePat').onclick=testRestorePat;
  if($('clearRestorePat')) $('clearRestorePat').onclick=()=>saveRestorePat(true);
  if($('planRestore')) $('planRestore').onclick=requestRestorePlan;
  if($('runRestore')) $('runRestore').onclick=runRestore;

}
