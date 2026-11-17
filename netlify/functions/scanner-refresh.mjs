import {refreshSharedScan} from '../../server/shared-scanner.mjs';
import {command} from '../../server/storage.mjs';
// Minute ticks spread one three-hour cycle across bounded batches; idle ticks do not
// contact Twelve Data. Netlify does not expose scheduled functions as public URLs.
export default async function handler(){
 const signal=AbortSignal.timeout(24000);
 const fetcher=(url,options={})=>fetch(url,{...options,signal:options.signal?AbortSignal.any([signal,options.signal]):signal});
 const run=(args,options)=>command(args,{...options,fetcher});
 try{return Response.json(await refreshSharedScan({run,fetcher}))}
 catch{return Response.json({status:'unavailable'},{status:503})}
}
