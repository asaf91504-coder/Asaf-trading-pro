import {randomUUID} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
import {marketAccessAllowed,privateMarketTrial,marketSelection,reserveMarketCredits,MarketError} from './market-feed.mjs';
import {marketCapAvailable} from '../market-quality.mjs';
export const fundamentalsConfigured=(env=process.env,now=Date.now())=>env.ASAF_MARKET_FUNDAMENTALS_ENABLED==='true'&&marketAccessAllowed(privateMarketTrial(env)?env.ASAF_TWELVE_TRIAL_MEMBER_ID:null,env,now);
export async function readMarketFundamentals({selected,memberId=null,env=process.env,run=command,fetcher=fetch,now=Date.now(),cachedOnly=false,maxAgeMs=86400000}={}){
 if(!fundamentalsConfigured(env,now)||!marketAccessAllowed(memberId,env,now))throw new MarketError('אימות שווי שוק ממתין להפעלת נתוני חברה במסלול הספק.');
 const {symbol}=marketSelection(selected,'1day',env),key=storageKey('market:fundamentals:v1:'+symbol,env),raw=await run(['GET',key],{env});
 if(!Number.isFinite(maxAgeMs)||maxAgeMs<0||maxAgeMs>86400000)throw new MarketError('Invalid company cache age.',400);
 if(raw){try{const data=JSON.parse(raw);if(marketCapAvailable({symbol,fundamentals:data},now)&&now-Date.parse(data.receivedAt)<maxAgeMs)return data}catch{}}
 if(cachedOnly)throw new MarketError('אין שווי שוק מאומת במטמון; בצע סריקה חדשה.',409);
 const lock=key+':lock',token=randomUUID();if(await run(['SET',lock,token,'NX','EX','15'],{env})!=='OK')throw new MarketError('שווי השוק מתעדכן כרגע. נסה שוב בעוד כמה שניות.',429);
 try{
  await reserveMarketCredits({env,run,now,cost:50});
  const url=new URL('https://api.twelvedata.com/statistics');url.search=new URLSearchParams({symbol,country:'United States',apikey:env.TWELVE_DATA_API_KEY}).toString();
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new MarketError('נתוני שווי השוק אינם זמינים מהספק.',response.status===429?429:502);
  const data=await response.json();
  if(data.status==='error')throw new MarketError(Number(data.code)===429?'מכסת הספק נוצלה.':'המסלול אינו מאפשר גישה לנתוני שווי שוק.',Number(data.code)===429?429:422);
  const value=data.statistics?.valuations_metrics?.market_capitalization;
  const marketCap=typeof value==='number'?value:typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value)?Number(value):NaN;
  if(data.meta?.symbol!==symbol||data.meta?.currency!=='USD'||!Number.isFinite(marketCap)||marketCap<=0)throw new MarketError('לא התקבל שווי שוק תקין בדולרים לסימול שנבחר.',422);
  const result={status:'available',source:'Twelve Data',symbol,currency:'USD',marketCap,receivedAt:new Date(now).toISOString(),asOf:null,note:'זמן הקבלה אינו מועד העדכון של הספק. נתון נוכחי, לא שווי שוק היסטורי למועד הנר.'};
  await run(['SET',key,JSON.stringify(result),'EX','86400'],{env});return result;
 }finally{try{await run(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lock,token],{env})}catch{}}
}
