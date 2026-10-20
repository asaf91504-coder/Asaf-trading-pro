// Twelve Data owner-only connector. Disabled by default. No OpenAI calls.
// Never put a provider API key in frontend code or the repository.
const respond=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
const cache=new Map(); // Best-effort per-instance cache, NOT a distributed hard quota.
const parseSymbol=value=>{
  const normalized=String(value||"").trim().toUpperCase();
  const ticker=normalized.includes(":")?normalized.split(":").at(-1):normalized;
  return /^[A-Z0-9][A-Z0-9._\/-]{0,19}$/.test(ticker)?ticker:null;
};
const allowedIntervals=new Set(["1min","5min","15min","30min","1h","1day","1week"]);
const validateBar=item=>{
  const open=Number(item.open),high=Number(item.high),low=Number(item.low),close=Number(item.close);
  const vol=item.volume===undefined||item.volume===null?null:Number(item.volume);
  const date=typeof item.datetime==="string"?item.datetime:"";
  if(!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(date))return null;
  if(![open,high,low,close].every(Number.isFinite)||low<=0||high<low||open<low||open>high||close<low||close>high)return null;
  return {date,open,high,low,close,volume:vol!==null&&Number.isFinite(vol)&&vol>=0?vol:null};
};
export default async function handler(request) {
 if(request.method!=="POST")return respond({error:"Only POST is supported"},405);
 if(process.env.ASAF_MARKET_ENABLED!=="true")return respond({error:"חיבור נתוני השוק עדיין לא הופעל — לא מתבצעות קריאות לספק"},503);
 const expected=process.env.ASAF_MARKET_ACCESS_CODE;
 if(!expected||expected.length<20)return respond({error:"Private market access has not been configured"},503);
 if(request.headers.get("x-asaf-market-access")!==expected)return respond({error:"קוד גישה שגוי"},401);
 const providerKey=process.env.TWELVE_DATA_API_KEY;
 if(!providerKey)return respond({error:"לא הוגדר מפתח Twelve Data בשרת"},503);
 const approved=(process.env.ASAF_MARKET_ALLOWED_SYMBOLS||"").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);
 if(!approved.length)return respond({error:"לא הוגדרה רשימת סימולים מורשים בשרת"},503);
 let payload;
 try{
  if(!(request.headers.get("content-type")||"").includes("application/json"))return respond({error:"Content type must be JSON"},415);
  const raw=await request.text();
  if(raw.length>1024)return respond({error:"Request too large"},413);
  payload=JSON.parse(raw);
 }catch{return respond({error:"Invalid JSON"},400)}
 const symbol=parseSymbol(payload?.symbol);
 const interval=String(payload?.interval||"1day");
 if(!symbol||!allowedIntervals.has(interval))return respond({error:"סימול או טווח זמן אינם תקינים"},400);
 if(!approved.includes(symbol))return respond({error:"הסימול אינו ברשימת המעקב המורשית"},403);
 const cacheKey=symbol+"|"+interval,old=cache.get(cacheKey),now=Date.now();
 if(old&&now-old.time<300000)return respond({...old.result,cached:true});
 // A request is initiated only when the owner clicks the fetch button.
 // A durable global quota needs a stateful store / provider controls before any public deployment.
 const url=new URL("https://api.twelvedata.com/time_series");
 url.searchParams.set("apikey",providerKey);
 url.searchParams.set("symbol",symbol);
 url.searchParams.set("interval",interval);
 url.searchParams.set("outputsize","200");
 url.searchParams.set("format","JSON");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const remote=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});
  if(!remote.ok)return respond({error:"ספק השוק אינו זמין כרגע"},502);
  const data=await remote.json();
  if(data?.status==="error"||!Array.isArray(data?.values)){
   const code=Number(data?.code);
   return respond({error:code===429?"חריגה ממכסת החינם של הספק":"הספק אינו מאפשר גישה לסימול או לטווח הזמן שנבחר"},code===429?429:422);
  }
  const bars=data.values.map(validateBar).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
  if(bars.length<21)return respond({error:"הספק החזיר פחות מ-21 נרות תקינים — לא ניתן לבצע ניתוח"},422);
  const result={source:"Twelve Data",symbol,interval,bars,currency:typeof data.meta?.currency==="string"?data.meta.currency:null,exchange:typeof data.meta?.exchange==="string"?data.meta.exchange:null,exchangeTimezone:typeof data.meta?.exchange_timezone==="string"?data.meta.exchange_timezone:null,receivedAt:new Date().toISOString(),latestBarTime:bars.at(-1).date,disclaimer:"עדכניות, עיכוב ורישיון שימוש תלויים בבורסה ובמסלול הספק. הנתונים אינם הבטחת זמן אמת."};
  if(cache.size>50)cache.clear();
  cache.set(cacheKey,{result,time:Date.now()});
  return respond({...result,cached:false});
 }catch{return respond({error:"שגיאת תקשורת עם ספק הנתונים"},502)}
 finally{clearTimeout(timer)}
}
