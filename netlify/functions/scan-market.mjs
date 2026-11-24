import {screenWithMethodology} from '../../server/asaf-methodology.mjs';
import {sharedScannerEnabled,readSharedScan} from '../../server/shared-scanner.mjs';
import {scannerBatchPlan} from '../../server/scanner-budget.mjs';
import {ventureScanRecord} from '../../server/venture-presentation.mjs';
import {currentUser} from '../../server/auth-core.mjs';
import {paidSubscriptionGuard,subscriptionGuard} from '../../server/billing.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {marketAccessAllowed,privateMarketTrial,approvedMarketSymbols,marketSelection,readMarketSnapshot,MarketError} from '../../server/market-feed.mjs';
import {readMarketFundamentals,fundamentalsConfigured} from '../../server/market-fundamentals.mjs';
import {scanBars} from '../../scanner-core.mjs';
const reply=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export function createScanMarketHandler({env=process.env,run=command,fetcher=fetch,now=()=>Date.now()}={}){return async request=>{
 let viewer;try{viewer=await currentUser(request,{env,run})}catch{return reply({error:'Authentication unavailable'},503)}
 const access=marketAccessAllowed(viewer?.id,env,now()),trial=privateMarketTrial(env);
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(access&&!trial){
  const blocked=await paidSubscriptionGuard(viewer,{env,run,now:now()});
  if(blocked)return blocked;
 }
 let plan={maxSymbols:0,batchDelayMs:61000};
 try{if(access)plan=scannerBatchPlan(env,{fundamentals:fundamentalsConfigured(env)})}catch{return reply({error:'הגדרות מכסת הסריקה אינן תקינות.'},503)}
 const shared=sharedScannerEnabled(env),enabled=access&&(shared||plan.maxSymbols>0);
 if(request.method==='GET')return reply({enabled,...plan,shared,maxSymbols:shared?10:plan.maxSymbols,interval:'1day',fundamentalsEnabled:fundamentalsConfigured(env),barPolicy:'previous-daily-sessions',presentation:'derived-only',...(enabled&&viewer?{symbols:approvedMarketSymbols(env)}:{})});
 if(!enabled)return reply({error:'סריקה מספק ממתינה למנוי ולהפעלת רישוי הנתונים.'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
 try{const user=viewer;if(!user)return reply({error:'יש להיכנס לחשבון.'},401);const raw=await request.text();if(raw.length>8192)return reply({error:'Request too large'},413);let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(trial){const billingBlock=await subscriptionGuard(user,{env,run,now:now()});if(billingBlock)return billingBlock;}
  if(!Array.isArray(body.symbols)||!body.symbols.length||body.symbols.length>10)return reply({error:'בחר 1 עד 10 מניות מורשות בכל סריקה.'},400);
  const symbols=[...new Set(body.symbols.map(s=>marketSelection(s,'1day',env).symbol))];
  if(body.filters!==undefined&&(!body.filters||Array.isArray(body.filters)||typeof body.filters!=='object'))return reply({error:'Invalid filters'},400);
  const filters=body.filters||{};
  const project=input=>{const {record,screen,methodology}=screenWithMethodology(input,filters,{now:now()});return ventureScanRecord(record,screen,methodology)};
  if(!shared&&body.cachedOnly!==true&&symbols.length>plan.maxSymbols)return reply({error:`אפשר לסרוק עד ${plan.maxSymbols} מניות בקבוצה לפי מכסת הספק הנוכחית.`,code:'scan_batch_limit',maxSymbols:plan.maxSymbols},422);
  const slot=Math.floor(now()/60000);const quota=await run(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>="+(shared||body.cachedOnly===true?'12':'2')+" then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('market:scan:'+(body.cachedOnly===true?'filter:':'fetch:')+user.id+':'+slot,env)],{env});if(quota!==1)return reply({error:'מכסת הסריקות או שינויי המסננים בדקה נוצלה. המתן ונסה שוב.'},429);
  if(shared){const scan=await readSharedScan({env,run,now:now(),memberId:user.id,symbols});return reply({records:scan.records.map(r=>project(r)),errors:scan.errors,scope:scan.scope,shared:true,stale:scan.stale,partial:scan.partial,completedAt:scan.completedAt,nextUpdateAt:scan.nextUpdateAt});}
  const scanTime=now();
  const results=await Promise.all(symbols.map(async symbol=>{try{
   const snapshot=await readMarketSnapshot({selected:symbol,interval:'1day',memberId:user.id,env,run,fetcher,now:scanTime,cachedOnly:body.cachedOnly===true,maxAgeMs:15*60000});
   let fundamentals;
   try{fundamentals=await readMarketFundamentals({selected:symbol,env,run,fetcher,now:scanTime,cachedOnly:body.cachedOnly===true})}
   catch(e){fundamentals={status:'unavailable',reason:e instanceof MarketError?e.message:'לא ניתן לאמת שווי שוק כרגע.'}}
   const record={...scanBars(symbol,snapshot.bars,snapshot),source:snapshot.source,interval:snapshot.interval,receivedAt:snapshot.receivedAt,coverage:snapshot.coverage,exchangeTimezone:snapshot.exchangeTimezone,barPolicy:snapshot.barPolicy,latestBarMayBePartial:snapshot.latestBarMayBePartial,fundamentals};
   return {record:project(record)};
  }catch(e){return {symbol,error:e instanceof MarketError?e.message:'הנתונים אינם זמינים כרגע'}}}));
  return reply({records:results.filter(x=>x.record).map(x=>x.record),errors:results.filter(x=>x.error),scope:'מניות שנבחרו בלבד; נרות יומיים קודמים. שווי שוק חסר אינו עובר את מסנן שווי השוק. אין סריקה של כלל השוק.'});
 }catch(e){return reply({error:e instanceof MarketError?e.message:'הסריקה אינה זמינה כרגע.'},e instanceof MarketError?e.status:503)}
}}
export default request=>createScanMarketHandler()(request);
