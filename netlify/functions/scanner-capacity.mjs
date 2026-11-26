import {currentUser} from '../../server/auth-core.mjs';
import {canReviewSetups} from '../../server/setup-review.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {approvedMarketSymbols,marketAccessAllowed,privateMarketTrial,reserveMarketCredits} from '../../server/market-feed.mjs';
import {fundamentalsConfigured,readMarketFundamentals} from '../../server/market-fundamentals.mjs';
import {scannerCapacity} from '../../server/scanner-budget.mjs';

const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const limit=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
export function createScannerCapacityHandler({env=process.env,run=command,fetcher=fetch,now=()=>Date.now()}={}){return async request=>{
 try{
  const user=await currentUser(request,{env,run}),time=now();
  const owner=!!user&&(canReviewSetups(user,env)||privateMarketTrial(env)&&user.id===env.ASAF_TWELVE_TRIAL_MEMBER_ID);
  const enabled=owner&&marketAccessAllowed(user.id,env,time);
  if(request.method==='GET')return reply({enabled});
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  if(!enabled)return reply({error:'הבדיקה זמינה לבעל האתר בלבד.'},403);
  if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
  if(await run(['SET',storageKey('scanner:capacity:'+user.id+':'+Math.floor(time/60000),env),'1','NX','EX','120'],{env})!=='OK')return reply({error:'המתן דקה לפני בדיקה נוספת.'},429);
  await reserveMarketCredits({env,run,now:time,cost:1});
  const response=await fetcher('https://api.twelvedata.com/api_usage',{headers:{Authorization:'apikey '+env.TWELVE_DATA_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return reply({error:'לא ניתן לאמת כרגע את מכסת חשבון הנתונים.'},502);
  const data=await response.json();if(data.status==='error')return reply({error:'חשבון הנתונים לא אפשר את בדיקת המכסה.'},502);
  const symbols=approvedMarketSymbols(env),fundamentals=fundamentalsConfigured(env,time);
  let company={available:false,reason:'נתוני שווי שוק אינם מופעלים.'};
  if(fundamentals)try{const cap=await readMarketFundamentals({selected:symbols[0],memberId:user.id,env,run,fetcher,now:time});company={available:true,symbol:cap.symbol,receivedAt:cap.receivedAt};}catch{company={available:false,reason:'הספק לא החזיר שווי שוק תקין במסגרת המכסה והגישה הנוכחיות.'};}
  return reply({provider:'Twelve Data',providerLimits:{perMinute:limit(data.plan_limit),perDay:limit(data.plan_daily_limit),planCategory:/^[a-z-]{1,30}$/.test(data.plan_category||'')?data.plan_category:null},
   configured:scannerCapacity(env,{symbols:symbols.length,fundamentals}),company,checkedAt:new Date(time).toISOString()});
 }catch{return reply({error:'לא ניתן להשלים את בדיקת הסורק כרגע.'},503);}
};}
export default request=>createScannerCapacityHandler()(request);
