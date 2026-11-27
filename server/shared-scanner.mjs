import {marketCoverage} from '../market-quality.mjs';
import {comparableDailyVolume} from '../comparable-volume.mjs';
import {createHash,randomUUID} from 'node:crypto';
import runtimeContext from './runtime-context.mjs';
import {command,storageKey} from './storage.mjs';
import {approvedMarketSymbols,legacyMarketSnapshotKey,marketAccessAllowed,privateMarketTrial,MarketError} from './market-feed.mjs';
import {fundamentalsConfigured,readMarketFundamentals} from './market-fundamentals.mjs';
import {readScannerSnapshot,scannerDailyVolumeBasis,scannerDailyVolumeEnabled} from './scanner-market-data.mjs';
import {scannerBatchPlan} from './scanner-budget.mjs';
import {scanBars} from '../scanner-core.mjs';
import {twelveSettings} from './twelve-config.mjs';
import {isScannerManifest,readScannerManifest,refreshLargeScanner} from './scanner-large-cache.mjs';
import {scannerUniverse} from './scanner-universe.mjs';
export const SCAN_PERIOD_MS=3*60*60*1000;
export const sharedScannerEnabled=env=>env.ASAF_HOURLY_SCANNER_ENABLED==='true';
export function sharedScannerKey(env,symbols=approvedMarketSymbols(env)){return storageKey('scanner:three-hour:v2:'+createHash('sha256').update(JSON.stringify({symbols,feed:legacyMarketSnapshotKey('_','1day',env),fundamentals:env.ASAF_MARKET_FUNDAMENTALS_ENABLED==='true',...(scannerDailyVolumeEnabled(env)?{dailyVolume:true}:{})})).digest('hex').slice(0,24),env)}
const parse=raw=>{try{return JSON.parse(raw)}catch{return null}};
// Preserve existing research while the larger namespace fills progressively.
export const previousScannerKey=env=>['us1000','us10000'].includes(env.ASAF_SCANNER_UNIVERSE)?sharedScannerKey(env,scannerUniverse(env,{legacy:true})):null;
export async function readSharedScan({env=process.env,run=command,now=Date.now(),memberId,symbols}={}){
 if(!sharedScannerEnabled(env)||!marketAccessAllowed(memberId,env,now))throw new MarketError('הסריקה המשותפת אינה זמינה לחשבון זה.',403);
 let snapshot=parse(await run(['GET',sharedScannerKey(env)+':snapshot'],{env}));
 const previousKey=previousScannerKey(env);
 if(!snapshot&&previousKey){snapshot=parse(await run(['GET',previousKey+':snapshot'],{env}));if(snapshot)snapshot={...snapshot,total:approvedMarketSymbols(env).length,partial:true,progress:{processed:0,total:approvedMarketSymbols(env).length,complete:false}};}
 const age=now-Date.parse(isScannerManifest(snapshot)?snapshot.updatedAt:snapshot?.completedAt);
 if(!snapshot||!Array.isArray(snapshot.records)||!Number.isFinite(age)||age<0||age>86400000)throw new MarketError('הסריקה התלת־שעתית עדיין אינה זמינה. נסה שוב לאחר העדכון הבא.',503);
 const selected=new Set(symbols||approvedMarketSymbols(env)),basis=scannerDailyVolumeBasis(env)||twelveSettings(env).dailyVolumeBasis;
 const loaded=isScannerManifest(snapshot)?await readScannerManifest(snapshot,{symbols:[...selected],run,env,now}):{records:snapshot.records,errors:[]};
 const records=loaded.records.filter(r=>selected.has(r.symbol)).map(r=>{
  // A cycle assembled before deployment or a basis change may still be readable
  // for price and existing setup reviews, but it cannot testify about volume.
  const meta={...r,volumeBasis:JSON.stringify(r.volumeBasis??null)===JSON.stringify(basis)?basis:null};
  const comparison=comparableDailyVolume(r.bars,meta);
  const obvSafe=r.volumeComparison?.status==='verified'&&comparableDailyVolume(r.bars,meta,{verifyWholeSeries:true}).status==='verified';
  return {...r,coverage:marketCoverage(r.interval||'1day',comparison.coverage),volumeComparison:comparison,summary:{...r.summary,volumeRatio:comparison.ratio,...(!obvSafe?{obv:null,obvPrevious:null}:{})}};
 });
 const {rows,format,...metadata}=snapshot;
 return {...metadata,records,errors:[...snapshot.errors.filter(e=>selected.has(e.symbol)),...loaded.errors],shared:true,stale:now>=snapshot.nextUpdateAt,scope:'סריקה משותפת של המניות המורשות בלבד, לפי נרות יומיים קודמים. הבקשה לא פנתה לספק הנתונים.'};
}
// A fencing token prevents an expired worker from overwriting a newer cycle.
export const SCANNER_COMMIT=`-- scanner-hourly-commit
if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
redis.call('SET',KEYS[2],ARGV[2],'EX',172800)
if ARGV[3]~='' then redis.call('SET',KEYS[3],ARGV[3],'EX',86400) end
return 1`;
export async function refreshSharedScan({env=process.env,run=command,fetcher=fetch,now=Date.now(),readBars=readScannerSnapshot,readFundamentals=readMarketFundamentals}={}){
 const memberId=privateMarketTrial(env)?env.ASAF_TWELVE_TRIAL_MEMBER_ID:null;
 if(!sharedScannerEnabled(env)||(env.CONTEXT||runtimeContext)!=='production'||!marketAccessAllowed(memberId,env,now))return {status:'disabled'};
 const symbols=approvedMarketSymbols(env),plan=scannerBatchPlan(env,{fundamentals:fundamentalsConfigured(env,now)});
 if(!plan.maxSymbols)return {status:'budget-too-small'};
 if(symbols.length>50)return refreshLargeScanner({env,run,fetcher,now,key:sharedScannerKey(env),seedKey:previousScannerKey(env),symbols,plan,memberId,readBars,readFundamentals,fundamentals:fundamentalsConfigured(env,now),commitScript:SCANNER_COMMIT,periodMs:SCAN_PERIOD_MS});
 const key=sharedScannerKey(env),token=randomUUID(),lock=key+':lock';
 if(await run(['SET',lock,token,'NX','EX','55'],{env})!=='OK')return {status:'busy'};
 try{
  const hour=Math.floor(now/SCAN_PERIOD_MS),minute=Math.floor(now/60000);
  let state=parse(await run(['GET',key+':state'],{env}));
  if(state?.hour===hour&&state.done)return {status:'current'};
  // A lost invocation cannot retry within the same minute and double its batch spend.
  if(await run(['SET',key+':tick:'+minute,'1','NX','EX','120'],{env})!=='OK')return {status:'busy'};
  if(!state||state.hour!==hour)state={hour,cursor:0,records:[],errors:[],startedAt:new Date(now).toISOString()};
  const batch=symbols.slice(state.cursor,state.cursor+plan.maxSymbols);
  const results=await Promise.all(batch.map(async symbol=>{
   try{
    const [snapshot,fundamentals]=await Promise.all([
     readBars({selected:symbol,interval:'1day',memberId,env,run,fetcher,now}),
     fundamentalsConfigured(env,now)?readFundamentals({selected:symbol,memberId,env,run,fetcher,now}).catch(()=>({status:'unavailable',reason:'שווי שוק לא אומת בסריקה זו.'})):Promise.resolve({status:'unavailable',reason:'נתוני שווי שוק אינם מופעלים.'})
    ]);
    return {record:{...scanBars(symbol,snapshot.bars,snapshot),source:snapshot.source,interval:snapshot.interval,receivedAt:snapshot.receivedAt,coverage:snapshot.coverage,exchangeTimezone:snapshot.exchangeTimezone,barPolicy:snapshot.barPolicy,volumeBasis:snapshot.volumeBasis,volumeConflictDates:snapshot.volumeConflictDates,latestBarMayBePartial:snapshot.latestBarMayBePartial,fundamentals}};
   }catch{return {symbol,error:'נתוני המניה לא היו זמינים בעדכון האחרון.'}}
  }));
  state.cursor+=batch.length;state.records.push(...results.filter(x=>x.record).map(x=>x.record));state.errors.push(...results.filter(x=>x.error));state.done=state.cursor>=symbols.length;
  const snapshot=state.done&&state.records.length?JSON.stringify({records:state.records,errors:state.errors,startedAt:state.startedAt,completedAt:new Date(now).toISOString(),nextUpdateAt:(hour+1)*SCAN_PERIOD_MS,partial:state.errors.length>0,total:symbols.length}):'';
  const committed=await run(['EVAL',SCANNER_COMMIT,'3',lock,key+':state',key+':snapshot',token,JSON.stringify(state),snapshot],{env});
  return {status:committed!==1?'superseded':state.done?(snapshot?'updated':'failed'):'progress',processed:state.cursor,total:symbols.length};
 }finally{try{await run(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lock,token],{env})}catch{}}
}
