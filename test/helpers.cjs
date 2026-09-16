'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');const base=path.resolve(__dirname,'..'),realRequire=createRequire(base+'/app.js');
const I18n=require('../settings/i18n');
async function fixture(language='nl'){
 const state={language,restorePat:'FAKE-TEST-KEY',webdavTargets:[{id:'koofr',name:'Test NAS',url:'https://example.invalid/backups/'}],schedule:{enabled:false,time:'03:00',weekdays:['0','1','2','3','4','5','6'],targetId:'koofr'}};
 const data={variables:{a:{id:'a',name:'Test variable',type:'number',value:1},b:{id:'b',name:'Leave alone',type:'number',value:5},c:{id:'c',name:'ha_backup_token',type:'string',value:'FAKE-NEW-TOKEN'}},flows:{a:{id:'a',name:'Test flow',actions:[]}},zones:{a:{id:'a',name:'Room',icon:'home',parent:null}}};
 const calls={writes:[],push:[],cards:[]};
 const client={logic:{getVariables:async()=>structuredClone(data.variables),updateVariable:async({id,variable})=>{calls.writes.push(id);Object.assign(data.variables[id],variable);}},flow:{getFlows:async()=>structuredClone(data.flows),getAdvancedFlows:async()=>({}),getFlowFolders:async()=>({}),getFlowCardAction:async args=>calls.cards.push(args),runFlowCardAction:async args=>calls.push.push(args)},devices:{getDevices:async()=>({})},zones:{getZones:async()=>structuredClone(data.zones)},apps:{getApps:async()=>({})},users:{getUsers:async()=>({owner:{id:'owner-test-id',name:'Test owner',role:'owner'}})}};
 const flowCards=new Map();
 const card=id=>{if(!flowCards.has(id))flowCards.set(id,{registerRunListener(fn){this.run=fn;return this;},registerArgumentAutocompleteListener(name,fn){this.autocomplete=fn;return this;},async trigger(tokens,state){calls.cards.push({id,tokens,state});}});return flowCards.get(id);};
 const sandbox={module:{exports:{}},require:name=>name==='homey'?{App:class{}}:name==='homey-api'?{HomeyAPI:{createAppAPI:async()=>client,createLocalAPI:async()=>client}}:realRequire(name),Buffer,URL,setTimeout};
 vm.runInNewContext(fs.readFileSync(base+'/app.js','utf8'),sandbox,{filename:'app.js'});
 const app=new sandbox.module.exports();app.log=()=>{};app.error=()=>{};app.homey={flow:{getActionCard:card,getConditionCard:card,getTriggerCard:card},settings:{get:k=>structuredClone(state[k]),set:(k,v)=>state[k]=structuredClone(v),unset:k=>delete state[k]},i18n:{getLanguage:()=>language},api:{getLocalUrl:async()=> 'http://example.invalid'},app:{manifest:{version:'0.3.27'}},setInterval:()=>1,clearInterval:()=>{},notifications:{createNotification:async()=>{}}};
 await app.onInit();await new Promise(r=>setImmediate(r));return {app,state,data,calls,client,flowCards};
}
async function job(app,handle){for(let i=0;i<30;i++){await new Promise(r=>setImmediate(r));const s=app.jobs.get(handle.jobId);if(s.status==='error')throw Error(s.error);if(s.status==='done'){const chunks=[];for(let offset=0;offset<s.result.bytes;){const p=app.transfers.read(s.result.id,offset);chunks.push(Buffer.from(p.data,'base64'));offset=p.next;}app.transfers.release(s.result.id);app.jobs.release(handle.jobId);return JSON.parse(Buffer.concat(chunks));}}throw Error('test job timed out');}
function stage(app,data,kind='backup'){const bytes=Buffer.from(JSON.stringify(data)),meta=app.startBackupTransfer(bytes.length,kind);for(let offset=0;offset<bytes.length;offset+=meta.chunkBytes)app.appendBackupTransfer({id:meta.id,offset,data:bytes.subarray(offset,offset+meta.chunkBytes).toString('base64')});app.finishBackupTransfer(meta.id);return meta.id;}

module.exports={fixture,job,stage};
