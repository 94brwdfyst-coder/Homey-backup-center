'use strict';
const RETRY_MS = 15 * 60 * 1000;
function localDay(now) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Amsterdam', year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(new Date(now));
  const get = k => p.find(x => x.type === k).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, weekday: String({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[get('weekday')]), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}
class Scheduler {
  constructor({read,write,upload,notify,timeline,now=Date.now}) { Object.assign(this,{read,write,upload,notify,timeline,now}); this.busy=false; }
  state() {
    const s = this.read() || {};
    const legacySuccess = !s.schemaVersion && s.lastStatus === 'ok' && s.lastRun;
    return { ...s, schemaVersion:2, enabled:!!s.enabled, time:s.time || '03:00', weekdays:Array.isArray(s.weekdays)?s.weekdays.map(String):[], targetId:s.targetId || '', notifyUserId:s.notifyUserId || '',
      lastAttempt:s.lastAttempt || null, lastRun:s.lastRun || null,
      lastSuccessDate:s.lastSuccessDate || (legacySuccess ? localDay(Date.parse(s.lastRun)).date : null),
      lastSuccessTarget:s.lastSuccessTarget || (legacySuccess ? s.targetId : null),
      attempts:Math.max(0,Math.min(3,Number(s.attempts)||0)), attemptDate:s.attemptDate || null,
      nextAttemptAt:s.nextAttemptAt || (!s.schemaVersion && s.attempts ? this.now()+RETRY_MS : null),
      lastStatus:s.lastStatus || null,lastError:s.lastError || null };
  }
  async tick() {
    if(this.busy) return;
    this.busy=true;
    try {
      let s=this.state(); if(!s.enabled || !s.targetId) return;
      // Persist migration once, including the conservative retry delay after an upgrade.
      this.write(s);
      if(s.attempts>=3 && s.lastStatus==='error') await this.reportFailure(s);
      s=this.state(); const now=this.now(), day=localDay(now);
      const retry=s.lastStatus==='error' && s.attempts>0 && s.attempts<3;
      if(retry) { if(now < Number(s.nextAttemptAt||0)) return; }
      else {
        if(s.attemptDate===day.date && s.attempts>=3) return;
        if(s.lastSuccessDate===day.date && s.lastSuccessTarget===s.targetId) return;
        const [h,m]=s.time.split(':').map(Number);
        if(!s.weekdays.includes(day.weekday) || day.minutes<h*60+m) return;
        s.attemptDate=day.date; s.attempts=0; s.notificationAttempts=0; s.notificationNextAt=null;
        s.notificationError=null; s.notifiedDate=null; s.timelineDate=null; s.timelineError=null;
      }
      s.attempts++; s.lastAttempt=new Date(now).toISOString(); s.lastStatus='running';
      s.nextAttemptAt=now+RETRY_MS; this.write(s);
      try {
        const result=await this.upload(s.targetId);
        s.lastStatus='ok'; s.lastRun=new Date(this.now()).toISOString(); s.lastSuccessDate=s.attemptDate; s.lastSuccessTarget=s.targetId;
        s.lastError=null; s.nextAttemptAt=null; s.warnings=result.warnings || [];
      } catch(e) {
        s.lastStatus='error'; s.lastError=String(e.message||e);
        // Wait 15 minutes after completion, including across midnight and restarts.
        s.nextAttemptAt=this.now()+RETRY_MS;
      }
      this.write(s);
      if(s.attempts>=3 && s.lastStatus==='error') await this.reportFailure(s);
    } finally { this.busy=false; }
  }
  async reportFailure(s) {
    if(s.notifiedDate===s.attemptDate) return;
    if(this.now()<Number(s.notificationNextAt||0) || (s.notificationAttempts||0)>=3) return;
    s.notificationAttempts=(s.notificationAttempts||0)+1; s.notificationNextAt=this.now()+RETRY_MS;
    // Persist before awaiting; never hide an unsuccessful delivery.
    this.write(s);
    if(s.timelineDate!==s.attemptDate) {
      try { await this.timeline(s); s.timelineDate=s.attemptDate; s.timelineError=null; }
      catch(e) { s.timelineError=String(e.message||e); }
    }
    try { await this.notify(s); s.notifiedDate=s.attemptDate; s.notificationError=null; }
    catch(e) { s.notificationError=String(e.message||e); }
    this.write(s);
  }
  async manual(targetId) {
    if(this.busy) throw Error('A backup is already running. Try again when it has finished.');
    this.busy=true;
    try {
      const result=await this.upload(targetId);
      const s=this.state(); s.manual={at:new Date(this.now()).toISOString(),status:'ok',targetId,warnings:result.warnings||[]}; this.write(s);
      return result;
    } catch(e) { const s=this.state();s.manual={at:new Date(this.now()).toISOString(),status:'error',targetId,error:String(e.message||e)};this.write(s);throw e; }
    finally {this.busy=false;}
  }
}
module.exports={Scheduler,localDay,RETRY_MS};
