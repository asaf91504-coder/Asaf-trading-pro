import {refreshSharedScan} from '../../server/shared-scanner.mjs';
import {command} from '../../server/storage.mjs';
import {syncProviderQuota} from '../../server/provider-quota.mjs';
import {marketAccessAllowed,privateMarketTrial} from '../../server/market-feed.mjs';
// Minute ticks spread one three-hour cycle across bounded batches; idle ticks do not
// contact Twelve Data. Netlify does not expose scheduled functions as public URLs.
export default async function handler(){
 const signal=AbortSignal.timeout(24000);
 const fetcher=(url,options={})=>fetch(url,{...options,signal:options.signal?AbortSignal.any([signal,options.signal]):signal});
 const run=(args,options)=>command(args,{...options,fetcher});
 try{const memberId=privateMarketTrial(process.env)?process.env.ASAF_TWELVE_TRIAL_MEMBER_ID:null;if(process.env.ASAF_HOURLY_SCANNER_ENABLED==='true'&&marketAccessAllowed(memberId))await syncProviderQuota({run,fetcher});return Response.json(await refreshSharedScan({run,fetcher}))}
 catch{return Response.json({status:'unavailable'},{status:503})}
}
