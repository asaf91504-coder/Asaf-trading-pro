import {randomUUID} from 'node:crypto';
import {publicAuthConfigured} from './auth-core.mjs';
import {command,storageKey} from './storage.mjs';
import {validateBar} from '../netlify/functions/market.mjs';
export const marketIntervals=['1min','5min','15min','30min','1h','1day','1week'];
export function approvedMarketSymbols(env=process.env){const symbols=[...new Set((env.ASAF_MARKET_ALLOWED_SYMBOLS||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))];return symbols.length>0&&symbols.length<=50&&symbols.every(s=>/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(s))?symbols:[]}
export const publicMarketConfigured=(env=process.env)=>publicAuthConfigured(env)&&env.ASAF_MARKET_ENABLED==='true'&&env.ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED==='true'&&env.ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED==='true'&&!!env.TWELVE_DATA_API_KEY&&/^\d{1,4}$/.test(env.ASAF_MARKET_DELAY_MINUTES||'')&&approvedMarketSymbols(env).length>0;
export class MarketError extends Error{constructor(message,status=503){super(message);this.status=status}}
export function marketSelection(selected,interval='1day',env=process.env){
 const parts=String(selected||'').trim().toUpperCase().split(':');
 if(parts.length>2||(parts.length===2&&!['NASDAQ','NYSE','AMEX','NYSEARCA','BATS'].includes(parts[0])))throw new MarketError('החיבור תומך במניות ארה״ב מורשות בלבד.',400);
 const symbol=parts.at(-1);if(!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(symbol)||!marketIntervals.includes(interval))throw new MarketError('סימול או טווח זמן אינם תקינים.',400);
 if(!approvedMarketSymbols(env).includes(symbol))throw new MarketError('הסימול אינו כלול בחיבור הנתונים הנוכחי.',403);return {symbol,interval};
}
export const marketSnapshotKey=(symbol,interval,env=process.env)=>storageKey('market:snapshot:'+symbol+':'+interval+':'+env.ASAF_MARKET_DELAY_MINUTES,env);
export function applyMarketDelay(bars,interval,delay,now){
 if(!delay)return bars;const cutoff=now-delay*60000;
 return bars.filter(b=>{const t=Date.parse(b.date.length===10?b.date+'T00:00:00Z':b.date.replace(' ','T')+'Z');const duration=interval==='1week'?7*86400000:interval==='1day'?86400000:interval.endsWith('min')?parseInt(interval)*60000:3600000;return Number.isFinite(t)&&t+duration<=cutoff});
}
const QUOTA="for i=1,#KEYS do local n=tonumber(redis.call('GET',KEYS[i]) or '0');if n>=tonumber(ARGV[i]) then return 0 end end;for i=1,#KEYS do redis.call('INCR',KEYS[i]);redis.call('EXPIRE',KEYS[i],tonumber(ARGV[#KEYS+i])) end;return 1";
export async function readMarketSnapshot({selected,interval='1day',env=process.env,run=command,fetcher=fetch,now=Date.now(),cachedOnly=false,maxAgeMs=60000}={}){
 if(!publicMarketConfigured(env))throw new MarketError('נתוני השוק ממתינים למנוי, רישוי והפעלה.');
 const {symbol}=marketSelection(selected,interval,env),cacheKey=marketSnapshotKey(symbol,interval,env),raw=await run(['GET',cacheKey],{env});
 if(raw){const data=JSON.parse(raw),age=now-Date.parse(data.receivedAt);if(data.symbol===symbol&&data.interval===interval&&Array.isArray(data.bars)&&data.bars.length>=21&&age>=0&&age<maxAgeMs)return {...data,cached:true}}
 if(cachedOnly)throw new MarketError('אין נתוני ספק טריים במטמון. רענן את הגרף.',409);
 const lock=cacheKey+':lock',token=randomUUID();if(await run(['SET',lock,token,'NX','EX','15'],{env})!=='OK')throw new MarketError('הנתונים מתעדכנים כרגע. נסה בעוד כמה שניות.',429);
 try{
  const minute=Math.floor(now/60000),day=new Date(now).toISOString().slice(0,10),min=Number(env.ASAF_MARKET_REQUESTS_PER_MINUTE||8),daily=Number(env.ASAF_MARKET_REQUESTS_PER_DAY||800);
  if(!Number.isInteger(min)||min<1||min>600||!Number.isInteger(daily)||daily<1||daily>10000)throw Error('Invalid quotas');
  if(await run(['EVAL',QUOTA,'2',storageKey('market:provider-minute:'+minute,env),storageKey('market:provider-day:'+day,env),String(min),String(daily),'120','172800'],{env})!==1)throw new MarketError('מכסת ספק הנתונים נוצלה.',429);
  const url=new URL('https://api.twelvedata.com/time_series');url.search=new URLSearchParams({apikey:env.TWELVE_DATA_API_KEY,symbol,interval,outputsize:'200',format:'JSON',timezone:'UTC'}).toString();
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!response.ok)throw new MarketError('ספק הנתונים אינו זמין כרגע.',502);
  const data=await response.json();if(data.status==='error'||!Array.isArray(data.values))throw new MarketError(Number(data.code)===429?'מכסת הספק נוצלה.':'הספק אינו מאפשר גישה לנתונים.',Number(data.code)===429?429:422);
  if(data.meta?.symbol&&String(data.meta.symbol).toUpperCase()!==symbol)throw new MarketError('הספק החזיר סימול שאינו תואם לבקשה.',502);
  const unique=new Map(data.values.map(validateBar).filter(Boolean).map(b=>[b.date,b])),bars=applyMarketDelay([...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)),interval,Number(env.ASAF_MARKET_DELAY_MINUTES),now);
  if(bars.length<21)throw new MarketError('הספק החזיר פחות מ־21 נרות תקינים לאחר החלת העיכוב.',422);
  const coverage=['1day','1week'].includes(interval)?'נתוני יום/EOD מאוחדים לפי הצהרת Twelve Data':'פיד מזירות נבחרות: כ־5% ממחזור ארה״ב לפי הצהרת Twelve Data; אינו שוק מאוחד';
  const result={source:'Twelve Data',symbol,interval,bars,currency:typeof data.meta?.currency==='string'?data.meta.currency:null,exchange:typeof data.meta?.exchange==='string'?data.meta.exchange:null,exchangeTimezone:'UTC',receivedAt:new Date(now).toISOString(),latestBarTime:bars.at(-1).date,delayMinutes:Number(env.ASAF_MARKET_DELAY_MINUTES),expires:now+60000,coverage,disclaimer:'רענון עד דקה; זמן הנר אינו זמן הקבלה. נר אחרון עשוי להיות חלקי. השימוש הוא להצגה באתר, ללא הפצת נתונים גולמיים.'};
  await run(['SET',cacheKey,JSON.stringify(result),'EX','172800'],{env});return {...result,cached:false};
 }finally{try{await run(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lock,token],{env})}catch{}}
}
