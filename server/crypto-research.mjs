import {randomUUID} from 'node:crypto';
import {publicAuthConfigured} from './auth-core.mjs';
import {command,storageKey} from './storage.mjs';
import {validCandleTime} from '../candle-time.mjs';

export const cryptoResearchIntervals=Object.freeze(['1day']);
const periods={'1day':86400};
const products={BTCUSD:'90',ETHUSD:'80'};
export class CryptoResearchError extends Error{constructor(message,status=503){super(message);this.status=status}}
export const cryptoResearchConfigured=(env=process.env)=>publicAuthConfigured(env)&&(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').map(value=>value.trim()).some(value=>/^[a-f0-9-]{36}$/.test(value));
export function cryptoResearchSelection(selected,interval='1day'){
 if(typeof selected!=='string'||typeof interval!=='string'||!Object.hasOwn(periods,interval))throw new CryptoResearchError('סימול קריפטו או טווח זמן אינם נתמכים.',400);
 const value=selected.trim().toUpperCase(),parts=value.split(':');
 if(parts.length>2||parts.length===2&&parts[0]!=='COINLORE')throw new CryptoResearchError('מחקר הקריפטו תומך ב־CoinLore בלבד.',400);
 const ticker=parts.at(-1).replace(/^BTC-USD$/,'BTCUSD').replace(/^ETH-USD$/,'ETHUSD');
 if(!Object.hasOwn(products,ticker))throw new CryptoResearchError('מחקר הקריפטו תומך ב־BTC-USD וב־ETH-USD בלבד.',400);
 return {symbol:'COINLORE:'+ticker,product:products[ticker],interval,granularity:periods[interval]};
}
export const cryptoSnapshotKey=(symbol,interval,env=process.env)=>storageKey('crypto:snapshot:'+cryptoResearchSelection(symbol,interval).symbol+':'+interval,env);
const QUOTA="for i=1,#KEYS do local n=tonumber(redis.call('GET',KEYS[i]) or '0');if n>=tonumber(ARGV[i]) then return 0 end end;for i=1,#KEYS do redis.call('INCR',KEYS[i]);redis.call('EXPIRE',KEYS[i],tonumber(ARGV[#KEYS+i])) end;return 1";
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=1e12;
function normalizedBars(input,interval,now){
 if(!Array.isArray(input)||input.length<21||input.length>365)throw new CryptoResearchError('הספק לא החזיר בין 21 ל־365 נרות תקינים.',502);
 const period=periods[interval],bars=input.map(bar=>{
  if(!bar||!validCandleTime(bar.date)||interval==='1day'&&bar.date.length!==10||interval!=='1day'&&bar.date.length!==19||![bar.low,bar.high,bar.open,bar.close].every(positive)||bar.high<bar.low||bar.open<bar.low||bar.open>bar.high||bar.close<bar.low||bar.close>bar.high||typeof bar.volume!=='number'||!Number.isFinite(bar.volume)||bar.volume<0||bar.volume>1e18)throw new CryptoResearchError('הספק החזיר נרות שאינם תקינים.',502);
  const timestamp=Date.parse(bar.date+(bar.date.length===10?'T00:00:00Z':'Z'));
  if(!Number.isFinite(timestamp)||timestamp>now||timestamp%(period*1000)!==0)throw new CryptoResearchError('חותמות זמן של נרות הספק אינן תקינות.',502);
  return {date:bar.date,low:bar.low,high:bar.high,open:bar.open,close:bar.close,volume:bar.volume};
 });
 if(now-Date.parse(bars.at(-1).date+'T00:00:00Z')>72*3600000)throw new CryptoResearchError('היסטוריית הקריפטו ישנה מדי למחקר הנוכחי.',502);
 if(bars.some((bar,index)=>index>0&&bar.date<=bars[index-1].date))throw new CryptoResearchError('הספק החזיר נרות כפולים או לא מסודרים.',502);
 return bars;
}
function providerBars(input,interval,now){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length<21||Object.keys(input).length>365)throw new CryptoResearchError('הספק לא החזיר בין 21 ל־365 נרות יומיים תקינים.',502);
 const bars=Object.entries(input).map(([key,row])=>{
  if(!/^\d{10,11}$/.test(key)||!Array.isArray(row)||row.length!==6||!Number.isSafeInteger(row[0])||String(row[0])!==key||row[0]<0||row[0]%86400!==0||row[0]*1000>now)throw new CryptoResearchError('מבנה נרות CoinLore אינו תקין.',502);
  const timestamp=new Date(row[0]*1000);if(!Number.isFinite(timestamp.getTime()))throw new CryptoResearchError('חותמת זמן אינה תקינה.',502);
  return {date:timestamp.toISOString().slice(0,10),open:row[1],high:row[2],low:row[3],close:row[4],volume:row[5]};
 }).sort((a,b)=>a.date.localeCompare(b.date));
 return normalizedBars(bars,interval,now);
}
function providerQuote(input,product,ticker,receivedAt){
 const item=Array.isArray(input)&&input.length===1?input[0]:null,raw=item?.price_usd;
 if(!item||String(item.id)!==product||item.symbol!==ticker||typeof raw!=='string'||raw.length>64||!/^\d+(?:\.\d+)?$/.test(raw)||!positive(Number(raw)))throw new CryptoResearchError('ציטוט המחיר של CoinLore אינו תקין או אינו תואם למטבע.',502);
 return {price:Number(raw),receivedAt,quoteTime:null};
}
async function boundedJSON(response){
 const limit=256*1024,size=Number(response.headers?.get('content-length'));
 if(Number.isFinite(size)&&size>limit)throw new CryptoResearchError('תגובת הספק גדולה מדי.',502);
 let text='';
 if(response.body?.getReader){
  const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>limit){await reader.cancel();throw new CryptoResearchError('תגובת הספק גדולה מדי.',502)}text+=decoder.decode(chunk.value,{stream:true})}text+=decoder.decode();}finally{reader.releaseLock();}
 }else{text=await response.text();if(Buffer.byteLength(text,'utf8')>limit)throw new CryptoResearchError('תגובת הספק גדולה מדי.',502);}
 try{return JSON.parse(text)}catch{throw new CryptoResearchError('תגובת הספק אינה JSON תקין.',502)}
}
/** Server-side owner research only. The caller must independently enforce admin
 * authentication before invoking this helper. No public redistribution grant is
 * inferred from the provider's public HTTPS endpoint. */
export async function readCryptoSnapshot({selected,interval='1day',env=process.env,run=command,fetcher=fetch,now=Date.now(),cachedOnly=false,maxAgeMs=60000}={}){
 if(!cryptoResearchConfigured(env))throw new CryptoResearchError('מחקר הקריפטו למנהל אינו זמין.');
 const selection=cryptoResearchSelection(selected,interval),{symbol,product,granularity}=selection,key=cryptoSnapshotKey(symbol,interval,env);
 if(!Number.isFinite(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<=0||maxAgeMs>900000)throw new CryptoResearchError('טווח עדכניות המחקר אינו תקין.',400);
 const raw=await run(['GET',key],{env});
 if(raw){
  try{const snapshot=JSON.parse(raw),age=now-Date.parse(snapshot.receivedAt);
   if(snapshot.source==='CoinLore'&&snapshot.symbol===symbol&&snapshot.interval===interval&&snapshot.providerCoinId===product&&snapshot.internalResearchOnly===true&&age>=0&&age<Math.min(maxAgeMs,cachedOnly?900000:60000)){
    if(!positive(snapshot.quote?.price)||snapshot.quote?.quoteTime!==null||snapshot.quote?.receivedAt!==snapshot.receivedAt)throw Error('Invalid quote');const bars=normalizedBars(snapshot.bars,interval,now);return {...snapshot,bars,cached:true};
   }
  }catch{}
 }
 if(cachedOnly)throw new CryptoResearchError('אין עותק מחקר טרי בשרת. רענן את גרף הקריפטו לפני ניתוח AI.',409);
 const lock=key+':lock',token=randomUUID();if(await run(['SET',lock,token,'NX','EX','15'],{env})!=='OK')throw new CryptoResearchError('נתוני הקריפטו מתעדכנים כרגע. נסה בעוד כמה שניות.',429);
 try{
  const minute=Math.floor(now/60000),day=new Date(now).toISOString().slice(0,10);
  if(await run(['EVAL',QUOTA,'2',storageKey('crypto:provider-minute:'+minute,env),storageKey('crypto:provider-day:'+day,env),'3','100','120','172800'],{env})!==1)throw new CryptoResearchError('מכסת מחקר הקריפטו נוצלה. נסה מאוחר יותר.',429);
  // Each reserved refresh slot allows two fixed requests: <=6 upstream calls
  // per minute and <=200 per day. Quotes never alter the historical candles.
  const options={method:'GET',headers:{Accept:'application/json','User-Agent':'ASAF-Trading-Pro-Owner-Research'},redirect:'error',signal:AbortSignal.timeout(8000)};
  const url=new URL('https://api.coinlore.net/api/coin/ohlcv/');url.searchParams.set('coin',product);
  const response=await fetcher(url,options);
  if(!response.ok)throw new CryptoResearchError(response.status===429?'ספק הקריפטו הגביל את הבקשות. נסה מאוחר יותר.':'ספק הקריפטו אינו זמין כרגע.',response.status===429?429:502);
  const bars=providerBars(await boundedJSON(response),interval,now),quoteURL=new URL('https://api.coinlore.net/api/ticker/');quoteURL.searchParams.set('id',product);
  const quoteResponse=await fetcher(quoteURL,options);if(!quoteResponse.ok)throw new CryptoResearchError('ציטוט המחיר של CoinLore אינו זמין כרגע.',quoteResponse.status===429?429:502);
  const receivedAt=new Date(now).toISOString(),quote=providerQuote(await boundedJSON(quoteResponse),product,symbol.split(':').at(-1).replace('USD',''),receivedAt);
  const snapshot={source:'CoinLore',symbol,interval,providerCoinId:product,bars,quote,currency:'USD',exchange:'CoinLore aggregated crypto data',exchangeTimezone:'UTC',receivedAt,latestBarTime:bars.at(-1).date,latestBarMayBePartial:true,delayMinutes:null,refreshSeconds:60,internalResearchOnly:true,coverage:'נתוני קריפטו מצטברים של CoinLore; אינם פיד עסקאות של בורסה יחידה או שוק מאוחד מאומת.',disclaimer:'מחיר ציטוט לפי זמן קבלה והיסטוריית נרות יומיים למחקר פנימי של המנהל בלבד. זמן העסקה של הציטוט אינו ידוע; הנר האחרון עשוי להיות חלקי. אין כאן זרם עסקאות חי או אישור להפצה מסחרית.'};
  await run(['SET',key,JSON.stringify(snapshot),'EX','900'],{env});return {...snapshot,cached:false};
 }catch(error){if(error instanceof CryptoResearchError)throw error;throw new CryptoResearchError('נתוני הקריפטו לא רועננו. העותק הקודם לא הוצג כעדכני.',502)}
 finally{try{await run(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lock,token],{env})}catch{}}
}
