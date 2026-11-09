import {randomUUID} from 'node:crypto';
import {publicAuthConfigured} from './auth-core.mjs';
import {command,storageKey} from './storage.mjs';
import {validCandleTime} from '../candle-time.mjs';
import {newYorkDate} from '../market-quality.mjs';

export class IntrinioError extends Error {constructor(message,status=503){super(message);this.status=status}}
export function intrinioConfigured(env=process.env,now=Date.now()){
 return publicAuthConfigured(env)&&env.ASAF_INTRINIO_ENABLED==='true'&&!!env.INTRINIO_API_KEY&&Date.parse(env.ASAF_INTRINIO_TRIAL_ENDS_AT)>now&&(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').some(id=>/^[a-f0-9-]{36}$/.test(id.trim()));
}
export function intrinioSelection(selected,interval='1day'){
 const parts=typeof selected==='string'?selected.trim().toUpperCase().split(':'):[];
 if(parts.length<1||parts.length>2||parts.length===2&&!['NASDAQ','NYSE','AMEX','NYSEARCA','BATS'].includes(parts[0])||! /^[A-Z][A-Z0-9.-]{0,14}$/.test(parts.at(-1))||interval!=='1day')throw new IntrinioError('ניסיון Intrinio תומך כרגע במניות ארה״ב ובנרות יומיים (1day) בלבד.',400);
 return {symbol:parts.at(-1),interval};
}
export const intrinioSnapshotKey=(symbol,env=process.env)=>storageKey('intrinio:snapshot:v1:'+symbol,env);
const QUOTA="for i=1,#KEYS do local n=tonumber(redis.call('GET',KEYS[i]) or '0');if n>=tonumber(ARGV[i]) then return 0 end end;for i=1,#KEYS do redis.call('INCR',KEYS[i]);redis.call('EXPIRE',KEYS[i],tonumber(ARGV[#KEYS+i])) end;return 1";
function validate(bars,now){
 const today=newYorkDate(now),positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e12;
 if(!Array.isArray(bars)||bars.length<21||bars.length>200||bars.some((b,i)=>!b||!validCandleTime(b.date)||b.date.length!==10||b.date>=today||![b.open,b.high,b.low,b.close].every(positive)||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||typeof b.volume!=='number'||!Number.isFinite(b.volume)||b.volume<0||b.volume>1e18||i>0&&bars[i-1].date>=b.date))throw new IntrinioError('Intrinio החזיר סדרת נרות לא תקינה.',502);
 if(now-Date.parse(bars.at(-1).date+'T00:00:00Z')>7*86400000)throw new IntrinioError('הנר האחרון של Intrinio ישן משבוע; הנתונים לא הוצגו כעדכניים.',502);
 return bars;
}
async function providerJSON(response){
 const limit=256*1024;if(Number(response.headers.get('content-length'))>limit)throw new IntrinioError('תגובת Intrinio גדולה מדי.',502);
 const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new IntrinioError('תגובת Intrinio גדולה מדי.',502)}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();}finally{reader.releaseLock()}
 try{return JSON.parse(text)}catch{throw new IntrinioError('תגובת Intrinio אינה תקינה.',502)}
}
// Caller enforces owner authentication. No public feed or external AI grant is inferred.
export async function readIntrinioSnapshot({selected,interval='1day',env=process.env,run=command,fetcher=fetch,now=Date.now(),cachedOnly=false}={}){
 if(!intrinioConfigured(env,now))throw new IntrinioError('חיבור Intrinio ממתין להפעלה או שהניסיון הסתיים.');
 const {symbol}=intrinioSelection(selected,interval),key=intrinioSnapshotKey(symbol,env),raw=await run(['GET',key],{env});
 if(raw){try{const d=JSON.parse(raw),age=now-Date.parse(d.receivedAt);if(d.source==='Intrinio'&&d.symbol===symbol&&d.interval==='1day'&&d.internalResearchOnly===true&&d.priceAdjustment==='splits-and-dividends'&&age>=0&&age<(cachedOnly?300000:60000))return {...d,bars:validate(d.bars,now),cached:true}}catch{}}
 if(cachedOnly)throw new IntrinioError('רענן את גרף Intrinio לפני ניתוח AI; אין עותק שרת טרי.',409);
 const lock=key+':lock',token=randomUUID();if(await run(['SET',lock,token,'NX','EX','15'],{env})!=='OK')throw new IntrinioError('נתוני Intrinio מתעדכנים כרגע. נסה בעוד כמה שניות.',429);
 try{
  const minute=Math.floor(now/60000),day=new Date(now).toISOString().slice(0,10);
  if(await run(['EVAL',QUOTA,'2',storageKey('intrinio:minute:'+minute,env),storageKey('intrinio:day:'+day,env),'5','100','120','172800'],{env})!==1)throw new IntrinioError('מכסת ניסיון Intrinio נוצלה. נסה מאוחר יותר.',429);
  const url=new URL('https://api-v2.intrinio.com/securities/'+encodeURIComponent(symbol)+'/prices');url.search=new URLSearchParams({frequency:'daily',page_size:'201'}).toString();
  const response=await fetcher(url,{headers:{Accept:'application/json',Authorization:'Bearer '+env.INTRINIO_API_KEY},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new IntrinioError([401,403].includes(response.status)?'מפתח Intrinio או הרשאת הנרות היומיים אינם פעילים בחשבון.':response.status===429?'Intrinio הגביל את הבקשות.':'Intrinio אינו זמין כרגע.',response.status===429?429:502);
  const data=await providerJSON(response);
  if(data.security?.ticker!==symbol||data.security?.currency!=='USD'||!['XNAS','XNYS','ARCX','XASE','BATS','IEXG'].includes(data.security?.exchange_mic||data.security?.exchange)||!Array.isArray(data.stock_prices)||data.stock_prices.length>201)throw new IntrinioError('הסימול, המטבע או הבורסה בתשובת Intrinio אינם תואמים.',502);
  const bars=validate(data.stock_prices.filter(b=>b.intraperiod===false&&b.frequency==='daily'&&b.date<newYorkDate(now)).map(b=>({date:b.date,open:b.adj_open,high:b.adj_high,low:b.adj_low,close:b.adj_close,volume:b.adj_volume})).sort((a,b)=>a.date.localeCompare(b.date)).slice(-200),now);
  const snapshot={source:'Intrinio',symbol,interval,bars,currency:'USD',exchange:data.security.exchange_mic||data.security.exchange,exchangeTimezone:'America/New_York',receivedAt:new Date(now).toISOString(),latestBarTime:bars.at(-1).date,barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,internalResearchOnly:true,priceAdjustment:'splits-and-dividends',delayMinutes:null,coverage:'Intrinio · נרות יומיים קודמים, מותאמים לפיצולים ודיבידנדים · ניסיון פנימי למנהל · לא מחיר חי'};
  await run(['SET',key,JSON.stringify(snapshot),'EX','900'],{env});return {...snapshot,cached:false};
 }catch(e){if(e instanceof IntrinioError)throw e;throw new IntrinioError('חיבור Intrinio נכשל. הנתונים הקודמים לא הוצגו כחדשים.',502)}
 finally{try{await run(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lock,token],{env})}catch{}}
}
