import {indexStocks} from '../index-stock-catalogue.mjs';
import {twelveSettings,twelveIntervals} from './twelve-config.mjs';
import {createHash} from 'node:crypto';
import {randomUUID} from 'node:crypto';
import {publicAuthConfigured} from './auth-core.mjs';
import {command,storageKey} from './storage.mjs';
import {comparableDailyVolume,sameVolumeBasis} from '../comparable-volume.mjs';
import {previousDailyBars,marketCoverage} from '../market-quality.mjs';
import {validateBar} from '../netlify/functions/market.mjs';
import {scannerUniverse} from './scanner-universe.mjs';
import {readProviderQuota} from './provider-quota.mjs';
export const marketIntervals=twelveIntervals;
export const configuredMarketIntervals=(env=process.env)=>twelveSettings(env).intervals;
const settingsValid=env=>{try{twelveSettings(env);return true}catch{return false}};
export const approvedMarketSymbols=(env=process.env)=>scannerUniverse(env);
// Additional chart symbols do not expand the scheduled scanner universe.
export function approvedChartSymbols(env=process.env){
 const extra=[...new Set((env.ASAF_MARKET_CHART_SYMBOLS||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))];
 const base=[...approvedMarketSymbols(env),...indexStocks.map(a=>a.symbol)];
 if(extra.length>200||extra.some(s=>!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(s)))return [...new Set(base)];
 return [...new Set([...base,...extra])];
}
const baseMarketConfigured=(env=process.env)=>publicAuthConfigured(env)&&settingsValid(env)&&env.ASAF_MARKET_ENABLED==='true'&&env.ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED==='true'&&!!env.TWELVE_DATA_API_KEY&&/^\d{1,4}$/.test(env.ASAF_MARKET_DELAY_MINUTES||'')&&approvedMarketSymbols(env).length>0;
export function marketConfigurationIssues(env=process.env){
 const issues=[];
 if(!publicAuthConfigured(env))issues.push('authenticated-storage');
 if(!settingsValid(env))issues.push('provider-settings');
 if(env.ASAF_MARKET_ENABLED!=='true')issues.push('market-disabled');
 if(env.ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED!=='true')issues.push('display-not-configured');
 if(!env.TWELVE_DATA_API_KEY)issues.push('provider-key-missing');
 if(!/^\d{1,4}$/.test(env.ASAF_MARKET_DELAY_MINUTES||''))issues.push('delay-not-configured');
 if(!approvedMarketSymbols(env).length)issues.push('symbols-not-configured');
 return issues;
}
export class MarketError extends Error{constructor(message,status=503){super(message);this.status=status}}
export const privateMarketTrial=(env=process.env)=>env.ASAF_TWELVE_PRIVATE_TRIAL==='true';
export const publicMarketConfigured=(env=process.env)=>!privateMarketTrial(env)&&baseMarketConfigured(env)&&env.ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED==='true';
export function marketAccessAllowed(memberId,env=process.env,now=Date.now()){
 if(!privateMarketTrial(env))return publicMarketConfigured(env);
 const owner=env.ASAF_TWELVE_TRIAL_MEMBER_ID,end=Date.parse(env.ASAF_TWELVE_TRIAL_ENDS_AT||'');
 return baseMarketConfigured(env)&&/^[a-f0-9-]{36}$/.test(owner||'')&&memberId===owner&&Number.isFinite(end)&&now<end;
}
export function marketSelection(selected,interval='1day',env=process.env){
 const parts=String(selected||'').trim().toUpperCase().split(':');
 if(parts.length>2||(parts.length===2&&!['NASDAQ','NYSE','AMEX','NYSEARCA','BATS'].includes(parts[0])))throw new MarketError('החיבור תומך במניות ארה״ב מורשות בלבד.',400);
 const symbol=parts.at(-1);if(!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(symbol)||!marketIntervals.includes(interval))throw new MarketError('סימול או טווח זמן אינם תקינים.',400);
 if(!configuredMarketIntervals(env).includes(interval))throw new MarketError('טווח הזמן אינו כלול בחיבור הנתונים הנוכחי.',403);
 if(!approvedChartSymbols(env).includes(symbol))throw new MarketError('המניה '+symbol+' אינה מופעלת בחיבור הנתונים. בחר מניה זמינה בחיפוש.',403);return {symbol,interval};
}
function snapshotKey(symbol,interval,env,version,settings){
 return storageKey('market:snapshot:'+version+':'+symbol+':'+interval+':'+env.ASAF_MARKET_DELAY_MINUTES+':'+createHash('sha256').update(JSON.stringify({...settings,privateOwner:privateMarketTrial(env)?env.ASAF_TWELVE_TRIAL_MEMBER_ID:null,trialEnd:privateMarketTrial(env)?env.ASAF_TWELVE_TRIAL_ENDS_AT:null})).digest('hex').slice(0,16),env);
}
export const marketSnapshotKey=(symbol,interval,env=process.env)=>snapshotKey(symbol,interval,env,'v4',twelveSettings(env));
// The shared scanner namespace also stores setup review decisions. Preserve its
// previous identity independently of the ephemeral provider snapshot format.
export const legacyMarketSnapshotKey=(symbol,interval,env=process.env)=>{
 const {dailyVolumeBasis,...settings}=twelveSettings(env);
 return snapshotKey(symbol,interval,env,'v3',settings);
};
export function applyMarketDelay(bars,interval,delay,now){
 if(!delay)return bars;if(interval==='1day')return previousDailyBars(bars,now-delay*60000);const cutoff=now-delay*60000;
 return bars.filter(b=>{const t=Date.parse(b.date.length===10?b.date+'T00:00:00Z':b.date.replace(' ','T')+'Z');const duration=interval==='1week'?7*86400000:interval==='1day'?86400000:interval.endsWith('min')?parseInt(interval)*60000:3600000;return Number.isFinite(t)&&t+duration<=cutoff});
}
// Credits, not HTTP requests: /time_series costs 1, /statistics costs 50.
export const MARKET_CREDIT_QUOTA="-- market-credit-reserve\nlocal cost=tonumber(ARGV[5]);for i=1,#KEYS do local n=tonumber(redis.call('GET',KEYS[i]) or '0');if n+cost>tonumber(ARGV[i]) then return 0 end end;for i=1,#KEYS do redis.call('INCRBY',KEYS[i],cost);redis.call('EXPIRE',KEYS[i],tonumber(ARGV[#KEYS+i])) end;return 1";
export async function reserveMarketCredits({env=process.env,run=command,now=Date.now(),cost=1}={}){
 const minute=Math.floor(now/60000),day=new Date(now).toISOString().slice(0,10),quota=await readProviderQuota({env,run,now}),min=quota.minuteCredits,daily=quota.dailyCredits;
 if(!Number.isInteger(cost)||cost<1||!Number.isInteger(min)||min<1||min>10000||!Number.isInteger(daily)||daily<1||daily>10000000)throw new MarketError('הגדרות מכסת ספק הנתונים אינן תקינות.');
 if(await run(['EVAL',MARKET_CREDIT_QUOTA,'2',storageKey('market:provider-minute:'+minute,env),storageKey('market:provider-day:'+day,env),String(min),String(daily),'120','172800',String(cost)],{env})!==1)throw new MarketError('מכסת הקרדיטים של ספק הנתונים אינה מספיקה לבקשה.',429);
}
export async function readMarketSnapshot({selected,interval='1day',env=process.env,run=command,fetcher=fetch,now=Date.now(),cachedOnly=false,maxAgeMs=60000,memberId=null,unadjustedVolume=false}={}){
 if(!marketAccessAllowed(memberId,env,now))throw new MarketError('נתוני השוק ממתינים למנוי, רישוי והפעלה.');
 if(unadjustedVolume&&interval!=='1day')throw new MarketError('Unadjusted volume requires daily bars.',400);
 const {symbol}=marketSelection(selected,interval,env),cacheKey=marketSnapshotKey(symbol,interval,env)+(unadjustedVolume?':unadjusted-volume-v1':''),raw=await run(['GET',cacheKey],{env});
 if(raw){try{const data=JSON.parse(raw),age=now-Date.parse(data.receivedAt);if(data.symbol===symbol&&data.interval===interval&&Array.isArray(data.bars)&&data.bars.length>=21&&age>=0&&age<maxAgeMs)return {...data,cached:true}}catch{/* An invalid cache entry is never sent to the chart or AI. */}}
 if(cachedOnly)throw new MarketError('אין נתוני ספק טריים במטמון. רענן את הגרף.',409);
 const lock=cacheKey+':lock',token=randomUUID();if(await run(['SET',lock,token,'NX','EX','15'],{env})!=='OK')throw new MarketError('הנתונים מתעדכנים כרגע. נסה בעוד כמה שניות.',429);
 try{
  await reserveMarketCredits({env,run,now});
  const url=new URL('https://api.twelvedata.com/time_series');url.search=new URLSearchParams({apikey:env.TWELVE_DATA_API_KEY,symbol,interval,outputsize:String(twelveSettings(env).historyBars+(interval==='1day'?1:0)),prepost:'false',format:'JSON',timezone:'UTC',country:'United States'}).toString();
  url.searchParams.set('adjust',unadjustedVolume?'none':'splits');
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!response.ok)throw new MarketError(response.status===429?'מכסת הספק נוצלה.':'ספק הנתונים אינו זמין כרגע.',response.status===429?429:502);
  const data=await response.json();if(data.status==='error'||!Array.isArray(data.values))throw new MarketError(Number(data.code)===429?'מכסת הספק נוצלה.':'הספק אינו מאפשר גישה לנתונים.',Number(data.code)===429?429:422);
  if(data.meta?.symbol&&String(data.meta.symbol).toUpperCase()!==symbol)throw new MarketError('הספק החזיר סימול שאינו תואם לבקשה.',502);
  if(data.meta?.interval&&data.meta.interval!==interval)throw new MarketError('הספק החזיר טווח זמן שאינו תואם לבקשה.',502);
  const parsed=data.values.map(validateBar);
  if(parsed.some(b=>!b))throw new MarketError('הספק החזיר נרות לא תקינים. הגרף הקיים לא שונה.',502);
  const settings=twelveSettings(env),daily=interval==='1day',volumeBasis=daily&&!unadjustedVolume?settings.dailyVolumeBasis:null;
 const unique=new Map(),conflicts=new Set();
 for(const [i,bar] of parsed.entries()){
  const rawBar=data.values[i],prior=unique.get(bar.date);
  if((prior&&['open','high','low','close','volume'].some(key=>prior[key]!==bar[key]))||
    rawBar.complete===false||rawBar.is_final===false||rawBar.is_partial===true||
    (rawBar.volumeBasis!==undefined&&!sameVolumeBasis(rawBar.volumeBasis,volumeBasis)))conflicts.add(bar.date);
  unique.set(bar.date,bar);
 }
 const ordered=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const eligible=daily?previousDailyBars(ordered,now):ordered,bars=applyMarketDelay(eligible,interval,Number(env.ASAF_MARKET_DELAY_MINUTES),now).slice(-twelveSettings(env).historyBars);
  if(bars.length<21)throw new MarketError('הספק החזיר פחות מ־21 נרות תקינים לאחר החלת העיכוב.',422);
  const volumeConflictDates=bars.filter(b=>conflicts.has(b.date)).map(b=>b.date);
  const receivedAt=new Date(now).toISOString();
  const volumeCoverage=daily?(comparableDailyVolume(bars,{interval,barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,
    volumeBasis,volumeConflictDates,receivedAt}).coverage||'unconfirmed'):settings.volumeCoverage;
  const coverage=marketCoverage(interval,volumeCoverage);
  const result={source:'Twelve Data',symbol,interval,bars,currency:typeof data.meta?.currency==='string'?data.meta.currency:null,exchange:typeof data.meta?.exchange==='string'?data.meta.exchange:null,exchangeTimezone:['1day','1week'].includes(interval)?(data.meta?.exchange_timezone||'America/New_York'):'UTC',barPolicy:daily?'previous-daily-sessions':'may-include-open-candle',latestBarMayBePartial:!daily,excludedCurrentBars:ordered.length-eligible.length,receivedAt,latestBarTime:bars.at(-1).date,delayMinutes:Number(env.ASAF_MARKET_DELAY_MINUTES),expires:now+60000,coverage,volumeCoverage,volumeBasis,volumeConflictDates,priceAdjustment:!unadjustedVolume&&['1day','1week'].includes(interval)?'splits':'unadjusted',extendedHours:false,disclaimer:'רענון עד דקה; זמן הנר אינו זמן הקבלה. בנרות יומיים יום המסחר הנוכחי מוחרג; נתוני הספק עשויים להתעדכן בדיעבד. השימוש הוא להצגה באתר, ללא הפצת נתונים גולמיים.'};
  await run(['SET',cacheKey,JSON.stringify(result),'EX',String(privateMarketTrial(env)?Math.max(1,Math.min(172800,Math.floor((Date.parse(env.ASAF_TWELVE_TRIAL_ENDS_AT)-now)/1000))):172800)],{env});return {...result,cached:false};
 }finally{try{await run(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lock,token],{env})}catch{}}
}
