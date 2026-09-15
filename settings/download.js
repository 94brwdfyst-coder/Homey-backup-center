'use strict';
const BackupDownload = (()=>{
  let activeUrl=null;
  function dispose(){if(activeUrl)URL.revokeObjectURL(activeUrl);activeUrl=null;}
  async function save(blob,name,{status,links,shareOnly=false}){
    const t=BackupI18n.t;
    const fallback=()=>{
      dispose();activeUrl=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=activeUrl;a.download=name;a.textContent=t('Open or save the file');a.target='_blank';a.rel='noopener';
      links.replaceChildren(a);links.hidden=false;
      // Keep the link and URL alive: mobile webviews may consume them asynchronously.
      a.click();
      status.textContent=t('Download requested. Check your browser downloads. If nothing happens, use the file link or save the backup to WebDAV.');
    };
    status.textContent=t('Preparing file…');
    try {
      const file=new File([blob],name,{type:blob.type||'application/json'});
      const canShare=typeof navigator.share==='function' && navigator.canShare?.({files:[file]});
      if(canShare && (shareOnly || !window.showSaveFilePicker)) {
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
  window.addEventListener('pagehide',dispose);
  return {save};
})();
