'use strict';
const BackupTransfer = (()=>{
  let api;
  const configure=fn=>{api=fn;};
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const base64=bytes=>{let text='';for(const b of bytes)text+=String.fromCharCode(b);return btoa(text);};
  async function upload(snapshot,progress,kind='backup'){
    const bytes=new TextEncoder().encode(JSON.stringify(snapshot));
    const meta=await api('POST','/transfer/start',{bytes:bytes.length,kind});
    try {
      for(let offset=0;offset<bytes.length;offset+=meta.chunkBytes){
        await api('POST','/transfer/append',{id:meta.id,offset,data:base64(bytes.subarray(offset,offset+meta.chunkBytes))});
        progress?.(Math.min(100,Math.round((offset+meta.chunkBytes)/bytes.length*100)));
      }
      return await api('POST','/transfer/finish',{id:meta.id});
    } catch(e){await release(meta.id);throw e;}
  }
  async function receive(meta,progress){
    try {
      const bytes=new Uint8Array(meta.bytes);
      for(let offset=0;offset<meta.bytes;){
        const part=await api('POST','/transfer/read',{id:meta.id,offset});
        const chunk=Uint8Array.from(atob(part.data),c=>c.charCodeAt(0));
        if(!chunk.length || part.next!==offset+chunk.length || part.next>meta.bytes)throw Error('Invalid transfer response.');
        bytes.set(chunk,offset);offset=part.next;progress?.(Math.round(offset/meta.bytes*100));
      }
      return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    } finally {await release(meta.id);}
  }
  async function job(path,body){
    const {jobId}=await api('POST',path,body);
    // Poll only the existing operation: never automatically repeat restore writes.
    let failures=0;
    for(;;){
      let result;
      try{result=await api('POST','/job',{id:jobId});failures=0;}
      catch(e){if(++failures>=3)throw Error('The operation status could not be retrieved. Check Homey before starting another restore.');await sleep(1000);continue;}
      if(result.status==='running'){await sleep(500);continue;}
      await api('POST','/job/release',{id:jobId}).catch(()=>{});
      if(result.status==='error')throw Error(result.error);
      return receive(result.result);
    }
  }
  async function release(id){if(id)await api('POST','/transfer/release',{id}).catch(()=>{});}
  return {configure,upload,receive,job,release};
})();
