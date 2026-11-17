// Isolated image-only client. The caller supplies a synthetic transport in the
// preview. No deployed endpoint, auth changes, provider key or OHLCV handling.
export function imageController({transport,onState,urls=URL}){
 let revision=0,active=null,current=null,closed=false;
 const state=value=>{if(!closed)onState(value)};
 return {
  async load(symbol,interval){
   if(closed)return;
   if(!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(symbol)||!['1day','1min'].includes(interval)){state({status:'invalid',image:current});return}
   const ticket=++revision;active?.abort();active=new AbortController();state({status:'loading',image:current});
   try{
    const r=await transport({symbol,interval},active.signal);
    if(!r.ok||r.headers.get('content-type')?.split(';')[0]!=='image/png')throw Error('Unavailable');
    const blob=await r.blob();if(blob.size>8*1024*1024||blob.size<8)throw Error('Invalid image');
    const signature=new Uint8Array(await blob.slice(0,8).arrayBuffer());if(signature.join(',')!=='137,80,78,71,13,10,26,10')throw Error('Invalid image');
    if(closed||ticket!==revision)return;
    const next=urls.createObjectURL(blob),previous=current;current=next;state({status:'ready',image:next,symbol,interval});if(previous)urls.revokeObjectURL(previous);
   }catch{if(!closed&&ticket===revision)state({status:'error',image:current})}
  },
  cancel(){revision++;active?.abort();state({status:'idle',image:current})},
  dispose(){closed=true;revision++;active?.abort();if(current)urls.revokeObjectURL(current);current=null}
 };
}
