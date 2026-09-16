'use strict';
const BackupDownload = (()=>{
  const activeUrls=new Set();
  function dispose(){for(const url of activeUrls)URL.revokeObjectURL(url);activeUrls.clear();}
  async function save(blob,name,{status,links,shareOnly=false}){
    const t=BackupI18n.t;
    const fallback=()=>{
      const activeUrl=URL.createObjectURL(blob);activeUrls.add(activeUrl);
      const a=document.createElement('a');a.href=activeUrl;a.download=name;a.textContent=t('Open or save the file');a.target='_blank';a.rel='noopener';
      links.replaceChildren(a);links.hidden=false;
      // Keep the link and URL alive: mobile webviews may consume them asynchronously.
      a.click();
      status.textContent=t('Download requested. Check your browser downloads. If nothing happens, use the file link or save the backup to WebDAV.');
    };
    status.textContent=t('Preparing file…');
    try {
      const file=typeof File==='function' ? new File([blob],name,{type:blob.type||'application/json'}) : null;
      let canShare=false;
      if(shareOnly && file && typeof navigator.share==='function'){
        try {canShare=Boolean(navigator.canShare?.({files:[file]}));} catch (_) { /* Permissions policy may deny sharing in an iframe. */ }
      }
      if(canShare) {
        await navigator.share({files:[file],title:t('Homey Backup Center')});
        status.textContent=t('File handed to the share sheet. Check the destination you selected.');return;
      }
      if(!shareOnly && typeof window.showSaveFilePicker==='function'){
        const handle=await window.showSaveFilePicker({suggestedName:name});
        const stream=await handle.createWritable();
        try {await stream.write(blob);await stream.close();}
        catch(e){await stream.abort().catch(()=>{});throw e;}
        status.textContent=t('File saved.');return;
      }
      fallback();
    }catch(e){
      if(e.name==='AbortError'){status.textContent=t('Saving or sharing was cancelled.');return;}
      try {fallback();status.textContent=t('Saving or sharing failed: ')+t(e.message||String(e))+'. '+t('Use the file link or save the backup to WebDAV.');}
      catch(failure){status.textContent=t('Download could not be started: ')+t(failure.message||String(failure));}
    }
  }
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
  return {save};
})();
