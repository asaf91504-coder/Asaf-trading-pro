import {randomUUID} from 'node:crypto';
import {publicAuthConfigured,currentUser} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {validateBar} from './market.mjs';
const intervals=new Set(['1min','5min','15min','30min','1h','1day','1week']);
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function publicMarketConfigured(env=process.env){return publicAuthConfigured(env)&&env.ASAF_MARKET_ENABLED==='true'&&env.ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED==='true'&&env.ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED==='true'&&!!env.TWELVE_DATA_API_KEY&&/^\d{1,4}$/.test(env.ASAF_MARKET_DELAY_MINUTES||'')&&!!env.ASAF_MARKET_ALLOWED_SYMBOLS?.trim()}
const QUOTA="for i=1,#KEYS do local n=tonumber(redis.call('GET',KEYS[i]) or '0');if n>=tonumber(ARGV[i]) then return 0 end end;for i=1,#KEYS do redis.call('INCR',KEYS[i]);redis.call('EXPIRE',KEYS[i],tonumber(ARGV[#KEYS+i])) end;return 1";
export function createPublicMarketHandler({env=process.env,run=command,fetcher=fetch,now=()=>Date.now()}={}){return async request=>{
 const enabled=publicMarketConfigured(env);
 if(request.method==='GET')return reply({enabled,refreshSeconds:60,...(enabled?{delayMinutes:Number(env.ASAF_MARKET_DELAY_MINUTES),intervals:[...intervals]}:{})});
 if(request.method!=='POST')return reply({error:'POST only'},405);
 if(!enabled)return reply({error:'נתוני השוק למשתמשים טרם חוברו. ממתינים לספק ולאישור רישוי.'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON only'},415);
 let lockKey,lockToken;
 try{
  const user=await currentUser(request,{env,run});if(!user)return reply({error:'יש להיכנס לחשבון לפני טעינת נתוני שוק.'},401);
  const raw=await request.text();if(raw.length>1024)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  const selected=String(body?.symbol||'').trim().toUpperCase(),parts=selected.split(':');
  if(parts.length>2||(parts.length===2&&!['NASDAQ','NYSE','AMEX','NYSEARCA','BATS'].includes(parts[0])))return reply({error:'החיבור הראשוני תומך במניות ארה״ב מורשות בלבד.'},400);
  const symbol=parts.at(-1),interval=String(body?.interval||'1day');
  if(!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(symbol)||!intervals.has(interval))return reply({error:'סימול או טווח זמן אינם תקינים.'},400);
  const approved=(env.ASAF_MARKET_ALLOWED_SYMBOLS||'').split(',').map(x=>x.trim().toUpperCase());
  if(!approved.includes(symbol))return reply({error:'הסימול אינו כלול בחיבור הנתונים הנוכחי.'},403);
  const minute=Math.floor(now()/60000),day=new Date(now()).toISOString().slice(0,10);
  const requests=await run(['EVAL',QUOTA,'2',storageKey('market:requests:'+minute,env),storageKey('market:member:'+user.id+':'+minute,env),'120','12','120','120'],{env});
  if(requests!==1)return reply({error:'יותר מדי בקשות לנתוני שוק. נסה בעוד דקה.'},429);
  const cacheKey=storageKey('market:snapshot:'+symbol+':'+interval+':'+env.ASAF_MARKET_DELAY_MINUTES,env),cached=await run(['GET',cacheKey],{env});
  if(cached){const data=JSON.parse(cached);if(data.symbol===symbol&&data.interval===interval&&Array.isArray(data.bars)&&data.bars.length>=21&&Number.isFinite(data.expires)&&data.expires>now())return reply({...data,cached:true})}
  lockKey=cacheKey+':lock';lockToken=randomUUID();
  if(await run(['SET',lockKey,lockToken,'NX','EX','15'],{env})!=='OK'){lockKey=null;return reply({error:'הנתונים מתעדכנים כרגע. נסה שוב בעוד כמה שניות.'},429)}
  const minuteLimit=Number(env.ASAF_MARKET_REQUESTS_PER_MINUTE||8),dailyLimit=Number(env.ASAF_MARKET_REQUESTS_PER_DAY||800);
  if(!Number.isInteger(minuteLimit)||minuteLimit<1||minuteLimit>600||!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>10000)throw Error('Invalid quotas');
  const quota=await run(['EVAL',QUOTA,'2',storageKey('market:provider-minute:'+minute,env),storageKey('market:provider-day:'+day,env),String(minuteLimit),String(dailyLimit),'120','172800'],{env});
  if(quota!==1)return reply({error:'מכסת ספק הנתונים נוצלה. הנתונים הקיימים בגרף נשארו ללא שינוי.'},429);
  const url=new URL('https://api.twelvedata.com/time_series');url.search=new URLSearchParams({apikey:env.TWELVE_DATA_API_KEY,symbol,interval,outputsize:'200',format:'JSON',timezone:'UTC'}).toString();
  const remote=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!remote.ok)return reply({error:'ספק הנתונים אינו זמין כרגע.'},502);
  const data=await remote.json();if(data.status==='error'||!Array.isArray(data.values))return reply({error:Number(data.code)===429?'מכסת הספק נוצלה.':'הספק אינו מאפשר גישה לנתונים שנבחרו.'},Number(data.code)===429?429:422);
  if(data.meta?.symbol&&String(data.meta.symbol).toUpperCase()!==symbol)return reply({error:'הספק החזיר סימול שאינו תואם לבקשה.'},502);
  const unique=new Map(data.values.map(validateBar).filter(Boolean).map(b=>[b.date,b])),bars=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(bars.length<21)return reply({error:'הספק החזיר פחות מ־21 נרות תקינים.'},422);
  const result={source:'Twelve Data',symbol,interval,bars,currency:typeof data.meta?.currency==='string'?data.meta.currency:null,exchange:typeof data.meta?.exchange==='string'?data.meta.exchange:null,exchangeTimezone:'UTC',receivedAt:new Date(now()).toISOString(),latestBarTime:bars.at(-1).date,delayMinutes:Number(env.ASAF_MARKET_DELAY_MINUTES),expires:now()+60000,disclaimer:'חותמת זמן הנר היא זמן הנתונים; זמן הקבלה אינו זמן עסקה. רענון עד דקה, בהתאם לזמינות הספק והרישוי.'};
  await run(['SET',cacheKey,JSON.stringify(result),'EX','60'],{env});return reply({...result,cached:false});
 }catch{return reply({error:'חיבור הנתונים אינו זמין. הנתונים הקיימים בגרף נשארו ללא שינוי.'},503)}
 finally{if(lockKey)try{await run(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lockKey,lockToken],{env})}catch{}}
}}
export default request=>createPublicMarketHandler()(request);
