import {currentUser} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {publicMarketConfigured,marketSelection,readMarketSnapshot,MarketError} from '../../server/market-feed.mjs';
import {scanBars} from '../../scanner-core.mjs';
const reply=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export function createScanMarketHandler({env=process.env,run=command,fetcher=fetch,now=()=>Date.now()}={}){return async request=>{
 if(request.method==='GET')return reply({enabled:publicMarketConfigured(env),maxSymbols:5,interval:'1day'});
 if(request.method!=='POST')return reply({error:'POST only'},405);if(!publicMarketConfigured(env))return reply({error:'סריקה מספק ממתינה למנוי ולהפעלת רישוי הנתונים.'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
 try{const user=await currentUser(request,{env,run});if(!user)return reply({error:'יש להיכנס לחשבון.'},401);const raw=await request.text();if(raw.length>2048)return reply({error:'Request too large'},413);let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!Array.isArray(body.symbols)||!body.symbols.length||body.symbols.length>5)return reply({error:'בחר 1 עד 5 מניות מורשות בכל סריקה.'},400);
  const symbols=[...new Set(body.symbols.map(s=>marketSelection(s,'1day',env).symbol))];
  const slot=Math.floor(now()/60000);const quota=await run(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=2 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('market:scan:'+user.id+':'+slot,env)],{env});if(quota!==1)return reply({error:'מקסימום שתי סריקות בדקה לחשבון.'},429);
  const results=await Promise.all(symbols.map(async symbol=>{try{const snapshot=await readMarketSnapshot({selected:symbol,interval:'1day',env,run,fetcher,now:now()});return {record:{...scanBars(symbol,snapshot.bars),source:'Twelve Data',interval:'1day',receivedAt:snapshot.receivedAt,coverage:snapshot.coverage}}}catch(e){return {symbol,error:e instanceof MarketError?e.message:'הנתונים אינם זמינים כרגע'}}}));
  return reply({records:results.filter(x=>x.record).map(x=>x.record),errors:results.filter(x=>x.error),scope:'מניות שנבחרו בלבד; נתונים יומיים. אין אימות שווי שוק או סריקה של כלל השוק.'});
 }catch(e){return reply({error:e instanceof MarketError?e.message:'הסריקה אינה זמינה כרגע.'},e instanceof MarketError?e.status:503)}
}}
export default request=>createScanMarketHandler()(request);
