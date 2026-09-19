'use strict';
const Homey = require('homey');
const {Transfers} = require('./lib/transfers');
const {NetworkDestinations}=require('./lib/network');
const {Scheduler} = require('./lib/scheduler');
const Jobs = require('./lib/jobs');
const I18n = require('./settings/i18n');
const tr = I18n.t;
const { HomeyAPI } = require('homey-api');
const Backup = require('./settings/backup');
const http = require('http');
const https = require('https');
const { URL } = require('url');

function plain(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [id, value] of Object.entries(obj)) {
    const v = value || {};
    out[id] = v;
  }
  return out;
}
function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}
function safeCollection(collection, mapper) {
  const out = {};
  for (const [id, item] of Object.entries(collection || {})) out[id] = mapper(item, id);
  return out;
}

const WRITABLE_DEVICE_SETTING_TYPES = new Set(['text','password','textarea','number','checkbox','dropdown']);
const VERIFIED_LEGACY_DEVICE_SETTING_KEYS = new Set(['beacon_timeout']);
const SECRET_VARIABLES = new Set(['ha_backup_token']);
function isSecretVariable(name) { return SECRET_VARIABLES.has(String(name || '')); }
function isVerifiedLegacyDeviceSettingKey(key) { return VERIFIED_LEGACY_DEVICE_SETTING_KEYS.has(String(key || '')); }
function isWritableDeviceSettingType(type) {
  return WRITABLE_DEVICE_SETTING_TYPES.has(String(type || '').toLowerCase());
}

function extractDeviceSettingInfo(settingsObj) {
  const values = {};
  const meta = {};
  if (!settingsObj || typeof settingsObj !== 'object') return {values, meta};

  // Homey can return either a flat primitive map or a nested settings_obj UI tree.
  // SECURITY: only traverse the documented/settings UI `children` hierarchy.
  // Traversing every nested property can accidentally interpret unrelated device
  // metadata/capability objects (host, keys, homeyClass, etc.) as writable settings.
  // Shelly beacon_timeout is confirmed at $[0].children[0], so it remains supported.
  if (!Array.isArray(settingsObj)) {
    const entries = Object.entries(settingsObj);
    if (entries.length && entries.every(([, value]) => value === null || ['string','number','boolean'].includes(typeof value))) {
      for (const [id, value] of entries) {
        values[id] = value;
        meta[id] = {id, type: value === null ? null : typeof value, writable: false, sensitive: false};
      }
      return {values, meta};
    }
  }

  const seen = new WeakSet();
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (typeof node.id === 'string' && node.id && Object.prototype.hasOwnProperty.call(node, 'value')) {
      const value = node.value;
      if (value === null || ['string','number','boolean'].includes(typeof value)) {
        const settingType = typeof node.type === 'string' ? node.type.toLowerCase() : null;
        values[node.id] = value;
        meta[node.id] = {
          id: node.id,
          type: settingType || (value === null ? null : typeof value),
          label: typeof node.label === 'string' ? node.label : (typeof node.title === 'string' ? node.title : null),
          writable: isWritableDeviceSettingType(settingType),
          sensitive: settingType === 'password',
        };
      }
    }

    if (node.children && typeof node.children === 'object') visit(node.children);
  };
  visit(settingsObj);
  return {values, meta};
}


function extractDeviceSettingValues(settingsObj) {
  return extractDeviceSettingInfo(settingsObj).values;
}



function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}
function sameValue(a, b) {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

// Convert a backed-up device setting to the exact primitive type Homey expects.
// Never coerce null/undefined or complex values; those are unsafe to write.
function normalizeSettingValue(backupValue, liveValue, settingType, key = 'setting') {
  if (backupValue === null || backupValue === undefined) {
    throw new Error(tr('Instelling ')+key+tr(' heeft geen veilige back-upwaarde; niets geschreven.'));
  }
  if (typeof backupValue === 'object') {
    throw new Error(tr('Instelling ')+key+tr(' heeft een complexe back-upwaarde; niets geschreven.'));
  }

  const type = String(settingType || '').toLowerCase();
  if (type === 'number') {
    const n = typeof backupValue === 'number' ? backupValue : Number(backupValue);
    if (!Number.isFinite(n)) throw new Error(tr('Instelling ')+key+tr(' is geen geldig getal; niets geschreven.'));
    return n;
  }
  if (type === 'checkbox') {
    if (typeof backupValue === 'boolean') return backupValue;
    if (backupValue === 'true' || backupValue === 1 || backupValue === '1') return true;
    if (backupValue === 'false' || backupValue === 0 || backupValue === '0') return false;
    throw new Error(tr('Instelling ')+key+tr(' is geen geldige checkboxwaarde; niets geschreven.'));
  }
  if (['text','password','textarea','dropdown'].includes(type)) {
    if (typeof backupValue !== 'string') return String(backupValue);
    return backupValue;
  }

  // Defensive fallback for a schema that has no known writable type.
  if (typeof liveValue === typeof backupValue && ['string','number','boolean'].includes(typeof backupValue)) return backupValue;
  throw new Error(tr('Instelling ')+key+tr(' heeft een onbekend/onveilig datatype; niets geschreven.'));
}

function encodeBasic(user, pass) {
  return 'Basic ' + Buffer.from(String(user || '') + ':' + String(pass || ''), 'utf8').toString('base64');
}
function request(urlText, {method = 'GET', headers = {}, body = null, timeoutMs = 15000} = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlText); } catch (_) { return reject(new Error(tr('Ongeldige WebDAV-URL.'))); }
    if (!['http:', 'https:'].includes(url.protocol)) return reject(new Error(tr('WebDAV moet http:// of https:// gebruiken.')));
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {method, headers, timeout: timeoutMs}, res => {
      const chunks = [];
      res.on('data', c => { if (chunks.reduce((n,b)=>n+b.length,0) < 1024 * 1024) chunks.push(c); });
      res.on('end', () => resolve({status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('timeout', () => req.destroy(new Error(tr('WebDAV time-out.'))));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = class HomeyBackupCenterApp extends Homey.App {
  async onInit() {
    I18n.setLanguage(this.homey.settings.get('language') || this.homey.i18n.getLanguage());
    this.transfers = new Transfers(); this.jobs = new Jobs();
    this.network = new NetworkDestinations({settings:this.homey.settings,exportBackup:()=>this.exportBackup(),
      emit:(id,tokens,state)=>this.homey.flow.getTriggerCard(id).trigger(tokens,state)});
    this.registerNetworkFlows();
    this.client = await HomeyAPI.createAppAPI({homey:this.homey});
    this.writeClient=null; this.writeClientError=null;
    await this.initWriteClient();
    this.scheduler = new Scheduler({
      read:()=>this.homey.settings.get('schedule'), write:s=>this.homey.settings.set('schedule',s),
      upload:id=>this.runBackupTarget(id), notify:s=>this.notifyScheduleFailure(s),
      timeline:()=>this.homey.notifications.createNotification({excerpt:tr('Automatic backup failed after three attempts. Check the backup destination in Backup Center.')})
    });
    const previous=this.scheduler.state();
    if(previous.lastStatus==='running') {
      previous.lastStatus='error'; previous.lastError=tr('The previous backup was interrupted. A retry will follow.');
      previous.nextAttemptAt=Date.now()+15*60*1000; this.homey.settings.set('schedule',previous);
    }
    const tick=()=>this.scheduler.tick().catch(e=>this.error('Scheduler:',e.message));
    this.scheduleTimer=this.homey.setInterval(()=>{this.transfers.prune();this.jobs.prune();tick();},60*1000);
    tick();
    this.log('Backup Center '+this.homey.app.manifest.version);
  }
  onUninit() {
    if(this.scheduleTimer)this.homey.clearInterval(this.scheduleTimer);
    this.transfers?.clear();
  }
  registerNetworkFlows(){
    const autocomplete=async query=>{
      const webdav=(this.homey.settings.get('webdavTargets')||[])
        .map(t=>({id:t.id,name:t.name||t.url,description:'WEBDAV'}));
      const network=this.network.list()
        .map(t=>({id:t.id,name:t.name,description:t.type.toUpperCase()}));
      return [...webdav,...network]
        .filter(t=>t.name.toLowerCase().includes(String(query).toLowerCase()));
    };
    const action=this.homey.flow.getActionCard('network_backup');
    action.registerArgumentAutocompleteListener('destination',autocomplete);
    action.registerRunListener(async args=>{await this.runBackupTarget(args.destination?.id);return true;});
    const condition=this.homey.flow.getConditionCard('network_destination_reachable');
    condition.registerArgumentAutocompleteListener('destination',autocomplete);
    condition.registerRunListener(async args=>{try{
    const resolved=this.getBackupTarget(args.destination?.id);
    if(resolved.kind==='webdav') await this.testWebdav(args.destination?.id);
    else await this.network.test(args.destination?.id);
    return true;
  }catch(_){return false;}});
    for(const id of ['network_backup_completed','network_backup_failed']){
      const card=this.homey.flow.getTriggerCard(id);
      card.registerArgumentAutocompleteListener('destination',autocomplete);
      card.registerRunListener(async(args,state)=>args.destination?.id===state.destinationId);
    }
  }
  getAppInfo(){return {version:this.homey.app.manifest.version,language:I18n.getLanguage()};}
  saveLanguage(language){
    if(!['en','nl'].includes(language))throw Error(tr('Unsupported language.'));
    this.homey.settings.set('language',language); I18n.setLanguage(language);
    return this.getAppInfo();
  }
  removeNetworkTarget(id){
    const schedule=this.getSchedule();
    if(schedule.enabled && schedule.targetId===id)throw Error(tr('Disable or change the schedule before removing its backup destination.'));
    return this.network.remove(id);
  }
  getBackupTarget(id){
    const webdav=(this.homey.settings.get('webdavTargets')||[]).find(t=>t.id===id);
    if(webdav)return {kind:'webdav',target:webdav};
    const network=this.network.list().find(t=>t.id===id);
    if(network)return {kind:'network',target:network};
    throw Error(tr('Backup destination not found.'));
  }
  async runBackupTarget(id){
    const resolved=this.getBackupTarget(id);
    if(resolved.kind==='webdav')return this.uploadWebdav(id);
    const result=await this.network.backup(id);
    return {...result,target:result.target||result.destination,warnings:result.warnings||[]};
  }
  getSchedule(){return this.scheduler.state();}
  saveSchedule(config){
    if(this.scheduler.busy)throw Error(tr('A backup is already running. Try again when it has finished.'));
    if(!config || typeof config!=='object')throw Error(tr('Invalid backup schedule.'));
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(config.time||'')))throw Error(tr('Choose a valid time.'));
    if(!Array.isArray(config.weekdays) || config.weekdays.some(d=>!['0','1','2','3','4','5','6'].includes(String(d))))throw Error(tr('Choose valid weekdays.'));
    const weekdays=[...new Set(config.weekdays.map(String))];
    if(config.enabled && !weekdays.length)throw Error(tr('Choose at least one weekday.'));
    const targetId=String(config.targetId||'');
    if(config.enabled || targetId)this.getBackupTarget(targetId);
    const current=this.getSchedule();
    const changed=current.targetId!==targetId || current.time!==config.time || JSON.stringify(current.weekdays.slice().sort())!==JSON.stringify(weekdays.slice().sort());
    const next={...current,enabled:!!config.enabled,time:config.time,weekdays,targetId,notifyUserId:String(config.notifyUserId||'')};
    if(changed)Object.assign(next,{attempts:0,attemptDate:null,nextAttemptAt:null,notificationAttempts:0,notificationNextAt:null,notificationError:null});
    if(next.notifyUserId!==current.notifyUserId && current.notifiedDate!==current.attemptDate){next.notificationAttempts=0;next.notificationNextAt=null;next.notificationError=null;}
    this.homey.settings.set('schedule',next);
    return next;
  }
  async runScheduleNow(targetId){return this.scheduler.manual(targetId || this.getSchedule().targetId);}
  async notificationUsers(){
    const users=await this.client.users.getUsers();
    return Object.values(users).map(u=>({id:u.id,name:u.name||u.id,role:u.role}));
  }
  async notifyScheduleFailure(schedule){
    const users=await this.notificationUsers();
    const user=schedule.notifyUserId ? users.find(u=>u.id===schedule.notifyUserId) : users.find(u=>u.role==='owner');
    if(!user)throw Error(tr('Choose a push recipient in the backup schedule.'));
    const client=this.getWriteClient();
    // Verify the actual card exposed by this Homey. Prefer critical, otherwise normal push.
    let id='homey:manager:mobile:push_text_critical';
    try {await client.flow.getFlowCardAction({id});}
    catch(_) {id='homey:manager:mobile:push_text';await client.flow.getFlowCardAction({id});}
    await client.flow.runFlowCardAction({id,args:{user:{id:user.id,name:user.name},text:tr('Automatic backup failed after three attempts. Check the backup destination in Backup Center.')}});
  }
  startBackupTransfer(bytes,kind='backup'){if(!['backup','selection'].includes(kind))throw Error('Invalid backup chunk.');return this.transfers.create(bytes,kind);}
  appendBackupTransfer(body){return this.transfers.append(body.id,body.offset,body.data);}
  finishBackupTransfer(id){return this.transfers.finish(id,(data,kind)=>{if(kind==='backup')this.validateRestoreBackup(data);else this.validateSelection(data);});}
  startExport(){return this.jobs.start(async()=>this.transfers.publish(await this.exportBackup()));}
  startRestorePlan(id){return this.jobs.start(()=>this.transfers.withBackup(id,async data=>this.transfers.publish(await this.buildRestorePlan(data))));}
  validateSelection(selection){
    if(!selection || typeof selection!=='object' || Array.isArray(selection))throw Error('Invalid restore selection.');
    for(const [key,value] of Object.entries(selection))if(!['zones','logic','betterLogicVariables','devices','standardFlows','advancedFlows'].includes(key) || !Array.isArray(value) || value.some(x=>typeof x!=='string'))throw Error('Invalid restore selection.');
    return selection;
  }
  startRestoreRun(id,confirm,selectionId){
    const selection=this.validateSelection(this.transfers.json(selectionId,'selection'));
    if(confirm!==true)throw Error(tr('Restore has not been confirmed.'));
    if(this.restoreJobId && this.jobs.items.get(this.restoreJobId)?.status==='running')throw Error(tr('A restore is already running.'));
    const job=this.jobs.start(()=>this.transfers.withBackup(id,async data=>this.transfers.publish(await this.restoreBackup(data,confirm,selection))));
    this.restoreJobId=job.jobId;return job;
  }

  async initWriteClient() {
    this.writeClient = null;
    this.writeClientError = null;
    const token = String(this.homey.settings.get('restorePat') || '').trim();
    if (!token) return null;
    try {
      if (!this.homey.api || typeof this.homey.api.getLocalUrl !== 'function') {
        throw new Error(tr('Deze Homey-versie geeft geen lokaal API-adres aan apps door.'));
      }
      const address = await this.homey.api.getLocalUrl();
      this.writeClient = await HomeyAPI.createLocalAPI({ address, token });
      // Harmless read: verifies that the PAT can authenticate against this Homey.
      await this.writeClient.logic.getVariables();
      return this.writeClient;
    } catch (error) {
      this.writeClientError = String(error?.message || error);
      this.writeClient = null;
      return null;
    }
  }

  getRestoreAuthStatus() {
    const configured = Boolean(String(this.homey.settings.get('restorePat') || '').trim());
    return {
      configured,
      connected: Boolean(this.writeClient),
      error: this.writeClientError || null,
      requiredScopes: ['homey.logic','homey.device','homey.zone','homey.flow','homey.app'],
      note: tr('De Homey API Key blijft uitsluitend in de appinstellingen op Homey en wordt nooit in een back-up opgenomen.')
    };
  }

  async saveRestoreAuthToken(token) {
    token = String(token || '').trim();
    if (token) this.homey.settings.set('restorePat', token);
    else this.homey.settings.unset('restorePat');
    await this.initWriteClient();
    return this.getRestoreAuthStatus();
  }

  async testRestoreAuth() {
    await this.initWriteClient();
    const status = this.getRestoreAuthStatus();
    if (!status.configured) throw new Error(tr('Nog geen Homey API Key opgeslagen.'));
    if (!status.connected) throw new Error(tr('Homey API Key kon niet verbinden: ') + (status.error || tr('onbekende fout')));
    return {...status, ok:true};
  }

  getWriteClient() {
    if (!this.writeClient) {
      const reason = this.writeClientError ? ' (' + this.writeClientError + ')' : '';
      throw new Error(tr('Restore-schrijfrechten ontbreken. Sla eerst een Homey API Key met de vereiste scopes op.') + reason);
    }
    return this.writeClient;
  }

  async getBetterLogicVariables() {
    const appId = 'net.i-dev.betterlogic';

    // /ALL is the canonical BLL source and can also contain non-persistent variables.
    const bllApp = await this.client.apps.getApp({id: appId});
    const all = await bllApp.get({path: '/ALL'});
    if (!Array.isArray(all)) throw new Error('Better Logic Library /ALL returned invalid data.');

    // The app setting contains the variables that BLL persists permanently.
    const stored = await this.client.apps.getAppSetting({
      id: appId,
      name: 'variables'
    });
    const persistentNames = new Set(
      (Array.isArray(stored) ? stored : [])
        .map(variable => variable?.name)
        .filter(name => typeof name === 'string')
    );

    return all
      .filter(variable =>
        variable
        && typeof variable.name === 'string'
        && ['boolean', 'number', 'string'].includes(variable.type)
        && !isSecretVariable(variable.name)
      )
      .map(variable => ({
        name: variable.name,
        type: variable.type,
        value: variable.value,
        persistent: persistentNames.has(variable.name)
      }));
  }

  async exportBackup() {
    if (!this.client) throw new Error(tr('De app start nog op. Probeer het zo opnieuw.'));
    const jobs = {
      folders: this.client.flow.getFlowFolders(),
      standard: this.client.flow.getFlows(),
      advanced: this.client.flow.getAdvancedFlows(),
      devices: this.client.devices.getDevices(),
      zones: this.client.zones.getZones(),
      variables: this.client.logic.getVariables(),
      apps: this.client.apps.getApps(),
    };
    const keys = Object.keys(jobs);
    const settled = await Promise.allSettled(Object.values(jobs));
    const result = {};
    const warnings = [];
    settled.forEach((entry, i) => {
      if (entry.status === 'fulfilled') result[keys[i]] = entry.value;
      else { result[keys[i]] = {}; warnings.push(keys[i] + ': ' + (entry.reason?.message || entry.reason)); }
    });
    let betterLogicVariables = [];
    try {
      betterLogicVariables = await this.getBetterLogicVariables();
    } catch (error) {
      const message = String(error?.message || error);
      // BLL is optional. Its absence or unavailability must never abort a normal backup.
      if (!/not found|404|not installed/i.test(message)) {
        warnings.push('better-logic-library: ' + message);
      }
    }
    if (!Object.keys(result.standard).length && !Object.keys(result.advanced).length) {
      throw new Error(tr('Flows konden niet worden opgehaald. Back-up is afgebroken.'));
    }
    const flows = Backup.buildFlows(result.folders || {}, result.standard || {}, result.advanced || {});
    const devices = safeCollection(result.devices, (d, id) => ({
      id: d.id || id,
      ...pick(d, ['name','class','zone','driverId','virtualClass','available','unavailableMessage','capabilities','capabilitiesObj','energy','iconObj','color'])
    }));
    // Homey exposes settings through getDeviceSettingsObj(). Convert the UI-shaped
    // settings tree to the flat { settingId: value } format expected by setDeviceSettings().
    // Devices without readable settings are silently left without a settings payload.
    for (const [id, d] of Object.entries(devices)) {
      try {
        // Only settings that Homey's settings_obj schema identifies as user-writable
        // are backed up. Read-only labels/groups and unknown metadata are excluded.
        const settingsObj = await this.client.devices.getDeviceSettingsObj({id});
        const info = extractDeviceSettingInfo(settingsObj);
        const liveFlatSettings = result.devices?.[id]?.settings && typeof result.devices[id].settings === 'object'
          ? result.devices[id].settings
          : {};
        const safeValues = {};
        const settingTypes = {};
        for (const [key, meta] of Object.entries(info.meta)) {
          if (!meta?.writable) continue;
          // `settings_obj` describes the UI/schema. The Device `settings` object carries
          // the actual persisted setting values and can differ from settings_obj.value.
          if (!Object.prototype.hasOwnProperty.call(liveFlatSettings, key)) continue;
          safeValues[key] = liveFlatSettings[key];
          if (meta.type) settingTypes[key] = meta.type;
        }
        if (Object.keys(safeValues).length) {
          d.settings = safeValues;
          d.settingTypes = settingTypes;
        }
      } catch (e) {
        const message = String(e?.message || e);
        // Unsupported/no-settings devices are common; avoid flooding the UI with one warning per device.
        if (!/not found|404|no settings|unsupported/i.test(message)) {
          warnings.push('device-settings ' + (d.name || id) + ': ' + message);
        }
      }
    }
    const zones = safeCollection(result.zones, (z, id) => ({id: z.id || id, ...pick(z, ['name','parent','icon'])}));
    const variables = {};
    for (const [id, v] of Object.entries(result.variables || {})) {
      if (isSecretVariable(v?.name)) continue;
      variables[id] = {id: v.id || id, ...pick(v, ['name','type','value'])};
    }
    const apps = safeCollection(result.apps, (a, id) => ({
      id: a.id || id,
      ...pick(a, ['name','version','enabled','state','origin','channel','updateAvailable','crashed','crashCount'])
    }));
    return {
      format: 'homey-backup-center', version: 5, createdAt: new Date().toISOString(),
      deviceSettingsValueSource: 'device.settings',
      note: tr('WebDAV-wachtwoorden worden niet opgenomen. Apparaatinstellingen kunnen gevoelige gegevens bevatten; behandel dit bestand als vertrouwelijk.'),
      flows,
      inventory: {folders: plain(result.folders), devices, zones, variables, betterLogicVariables, apps},
      stats: {
        standardFlows: flows.filter(f => f.type === 'standard').length,
        advancedFlows: flows.filter(f => f.type === 'advanced').length,
        devices: Object.keys(devices).length,
        zones: Object.keys(zones).length,
        variables: Object.keys(variables).length,
        betterLogicVariables: betterLogicVariables.length,
        apps: Object.keys(apps).length
      },
      warnings
    };
  }

  validateRestoreBackup(data) {
    if (!data || data.format !== 'homey-backup-center' || ![2,3,4,5].includes(data.version)) throw new Error(tr('Geen ondersteunde Homey Backupcentrum-back-up.'));
    Backup.validate(data.flows);
    if (!data.inventory || typeof data.inventory !== 'object') throw new Error(tr('Inventaris ontbreekt.'));
    return data;
  }

  async buildRestorePlan(data) {
    data = this.validateRestoreBackup(data);
    const current = await Promise.all([
      this.client.apps.getApps(), this.client.zones.getZones(), this.client.logic.getVariables(),
      this.client.devices.getDevices(), this.client.flow.getFlows(), this.client.flow.getAdvancedFlows()
    ]);
    const [apps,zones,variables,devices,standard,advanced] = current;
    const inv=data.inventory || {};
    const values=x=>Object.values(x||{});
    const missingApps=values(inv.apps).filter(a=>a.id && !apps[a.id]).map(a=>({id:a.id,name:a.name,version:a.version,channel:a.channel}));
    // Match zones by stable Homey ID first. If an old ID no longer exists but a
    // zone with the same name does, reuse that zone instead of creating a duplicate.
    const currentZonesByName=new Map(values(zones).filter(z=>z?.name).map(z=>[z.name,z]));
    const zoneMatch={};
    for(const z of values(inv.zones)){
      const cur=zones[z.id] || (z.name ? currentZonesByName.get(z.name) : null);
      if(cur) zoneMatch[z.id]=cur.id;
    }
    const zoneOps=values(inv.zones).map(z=>{
      const currentId=zoneMatch[z.id];
      const cur=currentId ? zones[currentId] : null;
      if(!cur) return {id:z.id,currentId:null,name:z.name,parent:z.parent,icon:z.icon,action:'create',changes:['ontbreekt'],defaultSelected:false};
      const changes=[];
      if(z.name && z.name!==cur.name) changes.push('naam');
      const expectedParent=z.parent ? (zoneMatch[z.parent] || z.parent) : null;
      const currentParent=cur.parent || null;
      if(expectedParent!==currentParent) changes.push('bovenliggende zone');
      if(z.icon!==undefined && z.icon!==cur.icon) changes.push('icoon');
      return {id:z.id,currentId:cur.id,name:z.name,parent:z.parent,icon:z.icon,currentName:cur.name,currentParent:cur.parent||null,currentIcon:cur.icon,matchedByName:cur.id!==z.id,action:changes.length?'update':'none',changes,defaultSelected:false};
    });
    const varsByName=new Map(values(variables).map(v=>[v.name,v]));
    // Old backups can contain the same Logic variable more than once. Restore by
    // logical name, never by duplicate inventory rows.
    const backupVarsByName=new Map();
    for(const v of values(inv.variables)) if(v?.name && !isSecretVariable(v.name)) backupVarsByName.set(v.name,v);
    const isVolatileLogic=name => ['health_heartbeat'].includes(name);
    const variableOps=[...backupVarsByName.values()].map(v=>{
      const cur=varsByName.get(v.name);
      const action=!cur?'create':(cur.type!==v.type || !sameValue(cur.value,v.value))?'update':'none';
      return {backupId:v.id,name:v.name,type:v.type,value:v.value,currentValue:cur?.value,currentType:cur?.type,action,volatile:isVolatileLogic(v.name),defaultSelected:false};
    });

    // Better Logic Library is optional and is restored as a separate category.
    // Compare only name/type/value/persistence; BLL's lastChanged metadata is intentionally ignored.
    const backupBetterLogicByName=new Map();
    for(const v of values(inv.betterLogicVariables)){
      if(
        v
        && typeof v.name==='string'
        && ['boolean','number','string'].includes(v.type)
        && !isSecretVariable(v.name)
      ) backupBetterLogicByName.set(v.name,v);
    }

    let betterLogicAvailable=true;
    let betterLogicError=null;
    let currentBetterLogic=[];
    if(backupBetterLogicByName.size){
      try{
        currentBetterLogic=await this.getBetterLogicVariables();
      }catch(e){
        betterLogicAvailable=false;
        betterLogicError=String(e?.message||e);
      }
    }

    const currentBetterLogicByName=new Map(
      currentBetterLogic.map(v=>[v.name,v])
    );

    const betterLogicOps=[...backupBetterLogicByName.values()].map(v=>{
      if(!betterLogicAvailable){
        return {
          name:v.name,type:v.type,value:v.value,persistent:v.persistent===true,
          action:'unsupported',reason:'better-logic-unavailable',defaultSelected:false
        };
      }

      const cur=currentBetterLogicByName.get(v.name);

      if(!cur){
        if(v.persistent===true){
          return {
            name:v.name,type:v.type,value:v.value,persistent:true,
            action:'create',currentValue:undefined,currentType:undefined,
            defaultSelected:false
          };
        }
        return {
          name:v.name,type:v.type,value:v.value,persistent:false,
          action:'unsupported',reason:'missing-transient',defaultSelected:false
        };
      }

      if(cur.type!==v.type){
        return {
          name:v.name,type:v.type,value:v.value,persistent:v.persistent===true,
          currentValue:cur.value,currentType:cur.type,
          action:'unsupported',reason:'type-mismatch',defaultSelected:false
        };
      }

      return {
        name:v.name,type:v.type,value:v.value,persistent:v.persistent===true,
        currentValue:cur.value,currentType:cur.type,
        action:sameValue(cur.value,v.value)?'none':'update',
        defaultSelected:false
      };
    });

    const deviceOps=[];
    for (const d of values(inv.devices)) {
      const cur=devices[d.id];
      if(!cur){deviceOps.push({id:d.id,name:d.name,found:false,hasSettings:Boolean(d.settings),action:'missing'});continue;}
      const changes=[];
      if(d.name && d.name!==cur.name) changes.push('naam');
      if(d.zone && d.zone!==cur.zone) changes.push('zone');
      let settingChanges=[];
      let settingDetails=[];
      let liveSettingsObj=null;
      try{ liveSettingsObj=await this.client.devices.getDeviceSettingsObj({id:d.id}); }catch(e){}

      if(data.version>=3 && d.settings && typeof d.settings==='object'){
        try{
          // settings_obj is the authoritative schema: only compare keys that Homey
          // currently exposes as a writable device setting. This excludes labels,
          // groups and arbitrary metadata from older backups.
          const info=extractDeviceSettingInfo(liveSettingsObj || await this.client.devices.getDeviceSettingsObj({id:d.id}));
          // Homey's Device.settings is the persisted live value source. settings_obj is
          // the schema/UI tree and may expose a stale/default `value` for some drivers.
          const liveDevice = devices[d.id] || await this.client.devices.getDevice({id:d.id});
          const currentSettings=(liveDevice?.settings && typeof liveDevice.settings==='object') ? liveDevice.settings : {};
          // A difference is only a restore candidate when the backup contains a concrete
          // primitive value and the current Homey schema still exposes the key as writable.
          // Older backups can contain null placeholders; showing those as selectable changes
          // created noise even though restore correctly refused to write them.
          const legacyDeviceSettings = data.version === 3 && data.deviceSettingsValueSource !== 'device.settings';
          const candidateKeys=Object.keys(d.settings).filter(key=>{
            const backupValue=d.settings[key];
            const currentValue=currentSettings[key];
            const primitive=v=>v!==null && v!==undefined && ['string','number','boolean'].includes(typeof v);
            if (legacyDeviceSettings && !isVerifiedLegacyDeviceSettingKey(key)) return false;
            return info.meta[key]?.writable === true
              && Object.prototype.hasOwnProperty.call(currentSettings,key)
              && primitive(backupValue)
              && primitive(currentValue);
          });
          settingChanges=candidateKeys.filter(key=>!sameValue(d.settings[key],currentSettings[key]));
          settingDetails=settingChanges.map(key=>{
            const meta=info.meta[key] || {};
            const sensitive=meta.sensitive === true || d.settingTypes?.[key] === 'password';
            return {
              key,
              backupValue:sensitive?undefined:d.settings[key],
              currentValue:sensitive?undefined:currentSettings[key],
              backupType:d.settings[key]===null?'null':typeof d.settings[key],
              currentType:currentSettings[key]===null?'null':typeof currentSettings[key],
              settingType:meta.type || d.settingTypes?.[key] || null,
              sensitive,
              writable:meta.writable === true && d.settings[key]!==null && d.settings[key]!==undefined,
            };
          });
          if(settingChanges.length) changes.push('instellingen');
        }catch(e){
          changes.push('instellingen (niet vergelijkbaar)');
        }
      }
      deviceOps.push({id:d.id,name:d.name,found:true,hasSettings:Boolean(d.settings),settingChanges,settingDetails,action:changes.length?'update':'none',changes});
    }

    const cleanFlow=f=>{const x=JSON.parse(JSON.stringify(f));delete x.id;delete x.type;delete x.folderName;delete x.folderPath;delete x.broken;delete x.triggerable;delete x.uri;return x;};
    // Homey assigns a new ID when a missing flow is recreated. Match an exact
    // semantic copy as restored even when its original backup ID no longer exists.
    // Matching is one-to-one so two identical backup flows cannot both claim the
    // same live flow.
    const flowOps=(list,cur)=>{
      const used=new Set();
      return list.map(f=>{
        const byId=cur[f.id];
        if(byId){used.add(f.id);return {id:f.id,currentId:f.id,name:f.name,action:sameValue(cleanFlow(f),cleanFlow(byId))?'none':'update'};}
        const semantic=Object.values(cur).find(c=>!used.has(c.id) && sameValue(cleanFlow(f),cleanFlow(c)));
        if(semantic){used.add(semantic.id);return {id:f.id,currentId:semantic.id,name:f.name,action:'none',recreated:true};}
        return {id:f.id,name:f.name,action:'create'};
      });
    };
    const std=data.flows.filter(f=>f.type==='standard'), adv=data.flows.filter(f=>f.type==='advanced');
    const stdOps=flowOps(std,standard), advOps=flowOps(adv,advanced);
    const blockers=[];
    const warnings=[];
    if(values(inv.variables).some(v=>isSecretVariable(v?.name)))warnings.push(tr('The ha_backup_token variable is excluded from restore.'));
    if (missingApps.some(a=>!a.id)) blockers.push(tr('Een app mist een app-ID.'));
    if (data.version<3) warnings.push(tr('Back-up v2 bevat geen apparaatinstellingen; alleen inventaris/reconciliatie is mogelijk.'));
    if (data.version===3 && data.deviceSettingsValueSource !== 'device.settings') warnings.push(tr('Oudere v3-back-up: apparaatinstellingen zijn conservatief gefilterd. Alleen eerder bewezen compatibele keys worden aangeboden. Maak een nieuwe v4-back-up voor volledige, betrouwbare apparaatinstellingen.'));
    const missingDevices=deviceOps.filter(d=>!d.found);
    if(missingDevices.length) warnings.push(missingDevices.length+tr(' apparaat/apparaten bestaan niet meer met hetzelfde Homey-ID en worden niet automatisch gepaird.'));
    const changes={
      apps:missingApps.length,
      zones:zoneOps.filter(x=>x.action!=='none').length,
      variables:variableOps.filter(x=>x.action!=='none').length,
      betterLogicVariables:betterLogicOps.filter(x=>['create','update'].includes(x.action)).length,
      devices:deviceOps.filter(x=>x.action==='update').length,
      standardFlows:stdOps.filter(x=>x.action!=='none').length,
      advancedFlows:advOps.filter(x=>x.action!=='none').length
    };
    const totalChanges=Object.values(changes).reduce((a,b)=>a+b,0);
    if(totalChanges>0 && !this.writeClient) warnings.push(tr('Restore-schrijfrechten zijn nog niet actief. Configureer een Homey API Key voordat je restore uitvoert.'));
    return {
      ok: blockers.length===0, backupVersion:data.version, createdAt:data.createdAt, totalChanges, changes,
      noChangesNeeded:totalChanges===0 && missingDevices.length===0,
      apps:{total:values(inv.apps).length,ready:values(inv.apps).length-missingApps.length,install:missingApps,changes:changes.apps},
      zones:{total:zoneOps.length,ready:zoneOps.filter(z=>z.action!=='create').length,operations:zoneOps,create:zoneOps.filter(z=>z.action==='create'),changes:changes.zones},
      variables:{total:variableOps.length,ready:variableOps.length,operations:variableOps,changes:changes.variables,volatile:variableOps.filter(v=>v.action!=='none'&&v.volatile).map(v=>v.name)},
      betterLogicVariables:{
        total:betterLogicOps.length,
        ready:betterLogicOps.filter(v=>v.action!=='unsupported').length,
        operations:betterLogicOps,
        changes:changes.betterLogicVariables,
        available:betterLogicAvailable,
        error:betterLogicError
      },
      devices:{total:deviceOps.length,ready:deviceOps.filter(d=>d.found).length,operations:deviceOps,changes:changes.devices},
      standardFlows:{total:std.length,ready:stdOps.filter(f=>f.action!=='create').length,operations:stdOps,changes:changes.standardFlows},
      advancedFlows:{total:adv.length,ready:advOps.filter(f=>f.action!=='create').length,operations:advOps,changes:changes.advancedFlows},
      blockers,warnings
    };
  }

  async restoreBackup(data, confirmed, selection = {}) {
    if (confirmed !== true) throw new Error(tr('Restore is niet bevestigd.'));
    data=this.validateRestoreBackup(data);
    const plan=await this.buildRestorePlan(data);
    if(plan.blockers.length) throw new Error(tr('Restore geblokkeerd: ')+plan.blockers.join(' | '));
    if(plan.noChangesNeeded) return {ok:true,noChangesNeeded:true,totalChanges:0,message:tr('0 wijzigingen nodig — Homey komt overeen met deze back-up.'),warnings:[...plan.warnings]};
    const writer=this.getWriteClient();
    const report={ok:true,apps:{ok:0,failed:[]},zones:{ok:0,failed:[],skipped:[],verified:[]},variables:{ok:0,failed:[],skipped:[]},betterLogicVariables:{ok:0,failed:[],skipped:[],verified:[]},devices:{ok:0,failed:[],skipped:[]},standardFlows:{ok:0,failed:[],skipped:[]},advancedFlows:{ok:0,failed:[],skipped:[]},warnings:[...plan.warnings]};
    const fail=(bucket,item,e)=>{bucket.failed.push({item,error:String(e?.message||e)});report.ok=false;};

    // 1. Apps first, so flow cards/drivers have the best chance of existing before flows return.
    for(const a of plan.apps.install){try{await writer.apps.installFromAppStore({id:a.id,...(a.channel?{channel:a.channel}:{})});report.apps.ok++;}catch(e){fail(report.apps,a.id,e);}}

    // 2. Zones. Existing zones are updated only when explicitly selected.
    // Missing zones can be created, but their original Homey ID cannot be forced;
    // keep an old->current/new map so later device/flow references can be rewritten.
    let zones=await this.client.zones.getZones();
    const currentZonesByName=new Map(Object.values(zones).filter(z=>z?.name).map(z=>[z.name,z]));
    const zoneMap={};
    for(const z of Object.values(data.inventory.zones||{})){
      const cur=zones[z.id] || (z.name ? currentZonesByName.get(z.name) : null);
      if(cur) zoneMap[z.id]=cur.id;
    }
    const selectedZones = Array.isArray(selection.zones) ? new Set(selection.zones) : new Set();
    const zoneOps=(plan.zones?.operations||[]).filter(z=>z.action!=='none');
    const selectedCreates=zoneOps.filter(z=>z.action==='create' && selectedZones.has(z.id));
    const pending=[...selectedCreates];
    for(let pass=0;pass<Math.max(1,pending.length+1);pass++){
      let progress=false;
      for(const op of pending){
        if(zoneMap[op.id])continue;
        const z=(data.inventory.zones||{})[op.id] || op;
        const parent=z.parent ? zoneMap[z.parent] : null;
        if(z.parent && !parent)continue;
        try{
          const created=await writer.zones.createZone({zone:{name:z.name,icon:z.icon||'home',parent:parent||null}});
          zoneMap[op.id]=created.id; zones[created.id]=created; report.zones.ok++; progress=true;
        }catch(e){fail(report.zones,z.name||op.id,e);zoneMap[op.id]='';}
      }
      if(!progress)break;
    }
    for(const op of selectedCreates) if(zoneMap[op.id]===undefined) fail(report.zones,op.name||op.id,new Error(tr('Bovenliggende zone kon niet worden hersteld.')));

    for(const op of zoneOps){
      if(!selectedZones.has(op.id)){report.zones.skipped.push({id:op.id,name:op.name,reason:tr('niet geselecteerd')});continue;}
      if(op.action==='create') continue;
      const z=(data.inventory.zones||{})[op.id];
      const currentId=zoneMap[op.id] || op.currentId;
      if(!z || !currentId){fail(report.zones,op.name||op.id,new Error(tr('Zone niet gevonden voor update.')));continue;}
      try{
        const patch={};
        if(op.changes.includes('naam')) patch.name=z.name;
        if(op.changes.includes('icoon')) patch.icon=z.icon||'home';
        if(op.changes.includes('bovenliggende zone')){
          const parent=z.parent ? zoneMap[z.parent] : null;
          if(z.parent && !parent) throw new Error(tr('Bovenliggende zone is niet beschikbaar.'));
          patch.parent=parent||null;
        }
        if(Object.keys(patch).length){
          await writer.zones.updateZone({id:currentId,zone:patch});
          // Do not trust a fulfilled write promise by itself. Read the zone back
          // through the PAT-backed client and verify only the fields selected by the plan.
          await new Promise(resolve=>setTimeout(resolve,250));
          const actual=await writer.zones.getZone({id:currentId});
          const mismatches=[];
          if(op.changes.includes('naam') && actual?.name!==z.name) mismatches.push(tr('naam: actueel ')+JSON.stringify(actual?.name)+tr('; verwacht ')+JSON.stringify(z.name));
          if(op.changes.includes('icoon') && (actual?.icon||'home')!==(z.icon||'home')) mismatches.push(tr('icoon: actueel ')+JSON.stringify(actual?.icon)+tr('; verwacht ')+JSON.stringify(z.icon||'home'));
          if(op.changes.includes('bovenliggende zone')){
            const expectedParent=z.parent ? zoneMap[z.parent] : null;
            const actualParent=actual?.parent||null;
            if(actualParent!==expectedParent) mismatches.push(tr('bovenliggende zone: actueel ')+JSON.stringify(actualParent)+tr('; verwacht ')+JSON.stringify(expectedParent));
          }
          if(mismatches.length) throw new Error(tr('Zone-write niet toegepast/gecontroleerd: ')+mismatches.join(' | '));
          report.zones.verified.push({id:currentId,name:actual?.name||z.name,parent:actual?.parent||null,icon:actual?.icon||null});
        }
        report.zones.ok++;
      }catch(e){fail(report.zones,op.name||op.id,e);}
    }

    // 3. Logic by name. Flow references to newly-created variable IDs cannot safely be rewritten generically.
    let vars=await this.client.logic.getVariables(); const varsByName=new Map(Object.values(vars).map(v=>[v.name,v]));
    const selectedLogic = Array.isArray(selection.logic) ? new Set(selection.logic) : null;
    const selectedBetterLogic = Array.isArray(selection.betterLogicVariables) ? new Set(selection.betterLogicVariables) : new Set();
    const selectedStandardFlows = Array.isArray(selection.standardFlows) ? new Set(selection.standardFlows) : new Set();
    const selectedAdvancedFlows = Array.isArray(selection.advancedFlows) ? new Set(selection.advancedFlows) : new Set();
    const selectedDevices = Array.isArray(selection.devices) ? new Set(selection.devices) : new Set();
    for(const op of plan.variables.operations.filter(v=>v.action!=='none')){
      // Volatile values are never restored implicitly. The UI may explicitly select
      // a non-volatile item; API callers without a selection get safe defaults.
      const selected = selectedLogic ? selectedLogic.has(op.name) : op.defaultSelected;
      if(!selected){report.variables.skipped=(report.variables.skipped||[]);report.variables.skipped.push({name:op.name,reason:op.volatile?tr('dynamische variabele'):tr('niet geselecteerd')});continue;}
      try{const cur=varsByName.get(op.name); if(cur){if(cur.type!==op.type) throw new Error(tr('Bestaande variabele heeft type ')+cur.type+tr(' i.p.v. ')+op.type);await writer.logic.updateVariable({id:cur.id,variable:{name:op.name,value:op.value}});}else{const created=await writer.logic.createVariable({variable:{name:op.name,type:op.type,value:op.value}});varsByName.set(op.name,created);}report.variables.ok++;}catch(e){fail(report.variables,op.name||op.backupId,e);}
    }

    // 4. Better Logic Library variables. Only explicitly selected safe operations are written.
    // Existing variables use BLL's public PUT API. Missing variables are recreated only
    // when the backup proves they were persistent; the current settings array is re-read
    // immediately before each merge so unrelated BLL variables are never removed.
    const bllAppId='net.i-dev.betterlogic';
    const bllOps=plan.betterLogicVariables?.operations||[];
    for(const op of bllOps.filter(v=>v.action!=='none')){
      if(!selectedBetterLogic.has(op.name)){
        report.betterLogicVariables.skipped.push({
          name:op.name,
          reason:op.action==='unsupported' ? (op.reason||'unsupported') : tr('niet geselecteerd')
        });
        continue;
      }

      if(op.action==='unsupported'){
        report.betterLogicVariables.skipped.push({
          name:op.name,
          reason:op.reason||'unsupported'
        });
        continue;
      }

      try{
        if(!['boolean','number','string'].includes(op.type)){
          throw new Error(tr('Niet-ondersteund Better Logic Library type: ')+op.type);
        }

        // Re-read canonical BLL state immediately before every operation.
        const liveApp=await this.client.apps.getApp({id:bllAppId});
        const liveAll=await liveApp.get({path:'/ALL'});
        if(!Array.isArray(liveAll)) throw new Error(tr('Better Logic Library gaf geen geldige variabelenlijst terug.'));
        const live=liveAll.find(v=>v?.name===op.name);

        if(live){
          if(live.type!==op.type){
            throw new Error(
              tr('Bestaande Better Logic Library variabele heeft type ')
              +live.type+tr(' i.p.v. ')+op.type
            );
          }

          const encodedName=encodeURIComponent(op.name);
          const encodedValue=encodeURIComponent(String(op.value));
          await liveApp.put({path:'/'+encodedName+'/'+encodedValue});
        }else{
          if(op.action!=='create' || op.persistent!==true){
            throw new Error(tr('Ontbrekende tijdelijke Better Logic Library variabele wordt niet automatisch aangemaakt.'));
          }

          // PAT-backed settings write. Always merge into a fresh array.
          const stored=await writer.apps.getAppSetting({
            id:bllAppId,
            name:'variables'
          });
          if(!Array.isArray(stored)){
            throw new Error(tr('Better Logic Library permanente variabelen konden niet veilig worden gelezen.'));
          }

          const existing=stored.find(v=>v?.name===op.name);
          if(existing){
            // State changed between /ALL and settings read. Never overwrite blindly.
            if(existing.type!==op.type){
              throw new Error(
                tr('Better Logic Library variabele veranderde tijdens restore; typeconflict gedetecteerd.')
              );
            }
            throw new Error(
              tr('Better Logic Library variabele veranderde tijdens restore; probeer het restore-plan opnieuw.')
            );
          }

          const merged=[
            ...stored,
            {name:op.name,type:op.type,value:op.value}
          ];

          await writer.apps.setAppSetting({
            id:bllAppId,
            name:'variables',
            value:merged
          });
        }

        // A fulfilled write is not enough: verify canonical /ALL state.
        await new Promise(resolve=>setTimeout(resolve,250));
        const verifyApp=await this.client.apps.getApp({id:bllAppId});
        const verifyAll=await verifyApp.get({path:'/ALL'});
        if(!Array.isArray(verifyAll)){
          throw new Error(tr('Better Logic Library verificatie gaf geen geldige variabelenlijst terug.'));
        }

        const actual=verifyAll.find(v=>v?.name===op.name);
        if(!actual){
          throw new Error(tr('Better Logic Library write kon niet worden geverifieerd: variabele ontbreekt.'));
        }
        if(actual.type!==op.type || !sameValue(actual.value,op.value)){
          throw new Error(
            tr('Better Logic Library write niet toegepast/gecontroleerd: actueel ')
            +JSON.stringify(actual.value)
            +tr('; verwacht ')
            +JSON.stringify(op.value)
          );
        }

        report.betterLogicVariables.ok++;
        report.betterLogicVariables.verified.push({
          name:op.name,
          type:actual.type,
          value:actual.value
        });
      }catch(e){
        fail(report.betterLogicVariables,op.name,e);
      }
    }

    // 5. Existing devices only. Never auto-pair radio devices. Write only actual plan differences.
    const currentDevices=await this.client.devices.getDevices();
    const backupDevicesById=new Map(Object.values(data.inventory.devices||{}).map(d=>[d.id,d]));
    for(const op of plan.devices.operations){
      if(op.action==='missing'){report.devices.skipped.push({id:op.id,name:op.name,reason:tr('niet gevonden; opnieuw pairen vereist')});continue;}
      if(op.action!=='update') continue;
      if(!selectedDevices.has(op.id)){report.devices.skipped.push({id:op.id,name:op.name,reason:tr('niet geselecteerd')});continue;}
      const d=backupDevicesById.get(op.id), cur=currentDevices[op.id];
      if(!d || !cur) continue;
      try{
        const patch={};
        if(op.changes.includes('naam') && d.name) patch.name=d.name;
        if(op.changes.includes('zone') && d.zone && zoneMap[d.zone]) patch.zone=zoneMap[d.zone];
        if(Object.keys(patch).length) await writer.devices.updateDevice({id:d.id,device:patch});
        if(op.changes.some(x=>String(x).startsWith('instellingen')) && data.version>=3 && d.settings && typeof d.settings==='object') {
          if(op.changes.includes('instellingen (niet vergelijkbaar)')) throw new Error(tr('Apparaatinstellingen konden vooraf niet betrouwbaar worden vergeleken; restore afgebroken.'));
          const keys=Array.isArray(op.settingChanges)?op.settingChanges:[];
          const liveInfo=extractDeviceSettingInfo(await writer.devices.getDeviceSettingsObj({id:d.id}));
          const liveDeviceBefore=await writer.devices.getDevice({id:d.id});
          const liveFlatBefore=(liveDeviceBefore?.settings && typeof liveDeviceBefore.settings==='object') ? liveDeviceBefore.settings : {};
          const settingsPatch={};
          for(const key of keys){
            if(!Object.prototype.hasOwnProperty.call(d.settings,key)) continue;
            const meta=liveInfo.meta[key];
            if(meta?.writable !== true) throw new Error(tr('Instelling ')+key+tr(' is door Homey niet als schrijfbare device-setting gemarkeerd; niets geschreven.'));
            if(!Object.prototype.hasOwnProperty.call(liveFlatBefore,key)) throw new Error(tr('Instelling ')+key+tr(' ontbreekt in de actuele Device.settings; niets geschreven.'));
            settingsPatch[key]=normalizeSettingValue(d.settings[key],liveFlatBefore[key],meta.type,key);
          }
          if(Object.keys(settingsPatch).length){
            await writer.devices.setDeviceSettings({id:d.id,settings:settingsPatch});
            await new Promise(resolve=>setTimeout(resolve,400));
            const verifyDevice=await writer.devices.getDevice({id:d.id});
            const verifySettings=(verifyDevice?.settings && typeof verifyDevice.settings==='object') ? verifyDevice.settings : {};
            const mismatches=[];
            for(const [key,expected] of Object.entries(settingsPatch)) if(!Object.prototype.hasOwnProperty.call(verifySettings,key) || !sameValue(verifySettings[key],expected)) mismatches.push(key);
            if(mismatches.length) throw new Error(tr('Device-settings write niet toegepast/gecontroleerd: ')+mismatches.join(', '));
          }
        }
        report.devices.ok++;
      }catch(e){fail(report.devices,d.name||d.id,e);}
    }

    // 6. Flows last. Write only flows that differ from the plan; never rewrite matching flows. Existing IDs are updated; missing flows are recreated (Homey assigns a new ID).
    const stdNow=await this.client.flow.getFlows(), advNow=await this.client.flow.getAdvancedFlows();
    const cleanFlow=f=>{const x=JSON.parse(JSON.stringify(f));delete x.id;delete x.type;delete x.folderName;delete x.folderPath;if(x.folder&&zoneMap[x.folder])x.folder=zoneMap[x.folder];return x;};
    const backupFlowsById=new Map(data.flows.map(f=>[f.id,f]));
    for(const op of plan.standardFlows.operations.filter(x=>x.action!=='none' && selectedStandardFlows.has(x.id))){
      const f=backupFlowsById.get(op.id); if(!f)continue;
      try{const body=cleanFlow(f);if(stdNow[f.id])await writer.flow.updateFlow({id:f.id,flow:body});else await writer.flow.createFlow({flow:body});report.standardFlows.ok++;}catch(e){fail(report.standardFlows,f.name||f.id,e);}
    }
    for(const op of plan.advancedFlows.operations.filter(x=>x.action!=='none' && selectedAdvancedFlows.has(x.id))){
      const f=backupFlowsById.get(op.id); if(!f)continue;
      try{const body=cleanFlow(f);if(advNow[f.id])await writer.flow.updateAdvancedFlow({id:f.id,advancedflow:body});else await writer.flow.createAdvancedFlow({advancedflow:body});report.advancedFlows.ok++;}catch(e){fail(report.advancedFlows,f.name||f.id,e);}
    }

    // 7. Fresh verification counts. 'broken' is included where Homey exposes it.
    const [stdVerify,advVerify]=await Promise.all([this.client.flow.getFlows(),this.client.flow.getAdvancedFlows()]);
    report.verification={standard:{total:Object.keys(stdVerify).length,broken:Object.values(stdVerify).filter(f=>f.broken===true).map(f=>f.name)},advanced:{total:Object.keys(advVerify).length,broken:Object.values(advVerify).filter(f=>f.broken===true).map(f=>f.name)}};
    if(report.verification.standard.broken.length||report.verification.advanced.broken.length)report.ok=false;
    return report;
  }

  getWebdavTargetsForUi() {
    const targets = this.homey.settings.get('webdavTargets') || [];
    return targets.map(t => ({id:t.id, name:t.name, url:t.url, username:t.username || '', hasPassword:Boolean(t.password)}));
  }

  saveWebdavTargets(configText) {
    let incoming;
    try { incoming = JSON.parse(configText); } catch (_) { throw new Error(tr('WebDAV-instellingen zijn geen geldige JSON.')); }
    if (!Array.isArray(incoming) || incoming.length > 8) throw new Error(tr('Gebruik maximaal 8 WebDAV-locaties.'));
    const old = new Map((this.homey.settings.get('webdavTargets') || []).map(t => [t.id, t]));
    const normalized = incoming.map((t, index) => {
      if (!t || typeof t !== 'object') throw new Error(tr('Ongeldige WebDAV-locatie.'));
      const id = String(t.id || ('webdav-' + Date.now() + '-' + index)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
      const name = String(t.name || 'WebDAV').trim().slice(0, 80);
      const url = String(t.url || '').trim();
      const username = String(t.username || '').trim().slice(0, 200);
      if (!/^https?:\/\//i.test(url)) throw new Error(tr('WebDAV-URL moet met http:// of https:// beginnen.'));
      const previous = old.get(id);
      const password = t.password ? String(t.password) : (previous?.password || '');
      return {id, name, url, username, password};
    });
    const schedule=this.getSchedule();
    if(schedule.enabled && !normalized.some(t=>t.id===schedule.targetId)) throw Error(tr('Disable or change the schedule before removing its WebDAV location.'));
    this.homey.settings.set('webdavTargets', normalized);
    return this.getWebdavTargetsForUi();
  }

  getTarget(id) {
    const target = (this.homey.settings.get('webdavTargets') || []).find(t => t.id === id);
    if (!target) throw new Error(tr('WebDAV-locatie niet gevonden.'));
    return target;
  }

  authHeaders(target) {
    return target.username || target.password ? {Authorization: encodeBasic(target.username, target.password)} : {};
  }

  async testWebdav(targetId) {
    const t = this.getTarget(targetId);
    const headers = {...this.authHeaders(t), Depth: '0'};
    let response = await request(t.url, {method:'PROPFIND', headers});
    if ([401,403].includes(response.status)) throw new Error(tr('WebDAV-login geweigerd (') + response.status + ').');
    if (response.status >= 200 && response.status < 400) return {ok:true, status:response.status};
    // Some simple WebDAV servers dislike PROPFIND on a collection but accept OPTIONS.
    response = await request(t.url, {method:'OPTIONS', headers:this.authHeaders(t)});
    if (response.status >= 200 && response.status < 400) return {ok:true, status:response.status};
    throw new Error(tr('WebDAV-test mislukt (HTTP ') + response.status + tr('). Controleer URL en map.'));
  }

  async uploadWebdav(targetId) {
    const t = this.getTarget(targetId);
    const data = await this.exportBackup();
    const filename = 'Backup_Center_' + data.createdAt.replace(/[:.]/g, '-') + '.json';
    const base = t.url.endsWith('/') ? t.url : t.url + '/';
    const destination = new URL(encodeURIComponent(filename), base).toString();
    const body = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
    const headers = {
      ...this.authHeaders(t),
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': String(body.length)
    };
    const response = await request(destination, {method:'PUT', headers, body, timeoutMs:30000});
    if (response.status < 200 || response.status >= 300) throw new Error(tr('Upload mislukt (HTTP ') + response.status + ').');
    return {ok:true, status:response.status, filename, bytes:body.length, target:t.name, warnings:data.warnings || []};
  }
};
