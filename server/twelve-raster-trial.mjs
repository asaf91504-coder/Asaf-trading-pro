// ISOLATED PREPARATION: not wired into netlify/functions or the public UI.
// No commercial flags are set or reused as permission to run this trial.
import {createHash} from 'node:crypto';
import {currentUser,publicAuthConfigured} from './auth-core.mjs';
import {command} from './storage.mjs';
import {marketSelection,reserveMarketCredits,applyMarketDelay} from './market-feed.mjs';
import {twelveSettings} from './twelve-config.mjs';
import {validateBar} from '../netlify/functions/market.mjs';
import {previousDailyBars} from '../market-quality.mjs';
import {renderMarketRaster} from './market-raster.mjs';

export function rasterTrialSettings(env,now){
 if(env.ASAF_TWELVE_RASTER_TRIAL_ENABLED!=='true'||env.ASAF_TWELVE_RASTER_TRIAL_SCOPE_CONFIRMED!=='true'||!publicAuthConfigured(env)||!env.TWELVE_DATA_API_KEY)throw Error('Trial unavailable');
 const owner=env.ASAF_TWELVE_RASTER_TRIAL_OWNER_ID,expiry=env.ASAF_TWELVE_RASTER_TRIAL_EXPIRES_AT;
 if(!/^[a-f0-9-]{36}$/.test(owner||'')||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expiry||'')||!Number.isFinite(Date.parse(expiry))||now>=Date.parse(expiry))throw Error('Trial unavailable');
 if(!/^\d+$/.test(env.ASAF_MARKET_DELAY_MINUTES||'')||Number(env.ASAF_MARKET_DELAY_MINUTES)>15)throw Error('Trial unavailable');
 const settings=twelveSettings(env);if(settings.historyBars>1000)throw Error('Raster preview history too large');
 return {owner,expiry:Date.parse(expiry),delay:Number(env.ASAF_MARKET_DELAY_MINUTES),settings};
}
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Vary':'Cookie, Origin'};
const failure=(status)=>new Response(JSON.stringify({error:'Trial chart unavailable'}),{status,headers:{...headers,'Content-Type':'application/json'}});
export function createRasterTrialHandler({env=process.env,run=command,fetcher=fetch,authenticate=currentUser,clock=()=>Date.now()}={}){
 // Only raster bytes are retained, bounded to eight images per process. No raw
 // source series are persisted, returned to browsers or forwarded to any AI.
 const images=new Map(),pending=new Set();
 return async request=>{
  if(request.method!=='POST')return failure(405);
  let config;try{config=rasterTrialSettings(env,clock())}catch{return failure(503)}
  if(request.headers.get('origin')!==new URL(request.url).origin)return failure(403);
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return failure(415);
  try{
   const user=await authenticate(request,{env,run});if(!user)return failure(401);if(user.id!==config.owner)return failure(403);
   const raw=await request.text();if(Buffer.byteLength(raw)>512)return failure(413);let body;try{body=JSON.parse(raw)}catch{return failure(400)}
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['symbol','interval'].includes(k)))return failure(400);
   let selected;try{selected=marketSelection(body.symbol,body.interval||'1day',env)}catch{return failure(400)}
   // Weekly bars are intentionally not in this minimal, daily/minute preview.
   if(!['1day','1min'].includes(selected.interval))return failure(400);
   const key=createHash('sha256').update(JSON.stringify([selected,config,env.TWELVE_DATA_API_KEY])).digest('hex');
   const now=clock();for(const [k,v] of images)if(v.until<=now)images.delete(k);
   const respond=bytes=>new Response(bytes,{headers:{...headers,'Content-Type':'image/png','X-Market-Source':'Twelve Data','X-Market-Usage':'owner-only trial','X-Market-Interval':selected.interval,'X-Market-Volume-Coverage':selected.interval==='1day'?'unconfirmed-daily':'unconfirmed-intraday'}});
   // Check scope/expiry again even on cached responses.
   rasterTrialSettings(env,clock());
   if(images.has(key))return respond(images.get(key).bytes);
   if(pending.has(key))return failure(429);pending.add(key);
   try{
    await reserveMarketCredits({env,run,now});
    const url=new URL('https://api.twelvedata.com/time_series');url.search=new URLSearchParams({apikey:env.TWELVE_DATA_API_KEY,symbol:selected.symbol,interval:selected.interval,outputsize:String(config.settings.historyBars+1),prepost:'false',format:'JSON',timezone:'UTC',country:'United States'}).toString();
    const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!response.ok)return failure(response.status===429?429:502);
    // Bound decoded input before parsing; provider errors are never reflected.
    const reader=response.body?.getReader();if(!reader)return failure(502);let size=0;const chunks=[];
    try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>1024*1024){await reader.cancel();return failure(502)}chunks.push(Buffer.from(item.value))}}finally{reader.releaseLock()}
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(data.status==='error'||data.meta?.symbol!==selected.symbol||data.meta?.interval!==selected.interval||!Array.isArray(data.values)||data.values.length>config.settings.historyBars+1)return failure(502);
    const parsed=data.values.map(validateBar);if(parsed.some(b=>!b))return failure(502);
    const ordered=parsed.sort((a,b)=>a.date.localeCompare(b.date));if(new Set(ordered.map(b=>b.date)).size!==ordered.length)return failure(502);
    const eligible=selected.interval==='1day'?previousDailyBars(ordered,clock()):ordered;
    const bars=applyMarketDelay(eligible,selected.interval,config.delay,clock()).slice(-config.settings.historyBars);if(bars.length<21)return failure(502);
    const bytes=renderMarketRaster(bars,{label:{symbol:selected.symbol,interval:selected.interval,delayMinutes:config.delay}});const checked=rasterTrialSettings(env,clock());
    if(images.size>=8)images.delete(images.keys().next().value);images.set(key,{bytes,until:Math.min(clock()+60000,checked.expiry)});
    return respond(bytes);
   }finally{pending.delete(key)}
  }catch{return failure(503)}
 };
}
