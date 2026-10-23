import {currentUser} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {publicMarketConfigured,marketIntervals,readMarketSnapshot,MarketError} from '../../server/market-feed.mjs';
export {publicMarketConfigured};
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const QUOTA="for i=1,#KEYS do local n=tonumber(redis.call('GET',KEYS[i]) or '0');if n>=tonumber(ARGV[i]) then return 0 end end;for i=1,#KEYS do redis.call('INCR',KEYS[i]);redis.call('EXPIRE',KEYS[i],tonumber(ARGV[#KEYS+i])) end;return 1";
export function createPublicMarketHandler({env=process.env,run=command,fetcher=fetch,now=()=>Date.now()}={}){return async request=>{
 const enabled=publicMarketConfigured(env);if(request.method==='GET')return reply({enabled,refreshSeconds:60,...(enabled?{delayMinutes:Number(env.ASAF_MARKET_DELAY_MINUTES),intervals:marketIntervals}:{})});
 if(request.method!=='POST')return reply({error:'POST only'},405);if(!enabled)return reply({error:'נתוני השוק ממתינים למנוי, רישוי והפעלה.'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON only'},415);
 try{const user=await currentUser(request,{env,run});if(!user)return reply({error:'יש להיכנס לחשבון לפני טעינת נתוני שוק.'},401);const raw=await request.text();if(raw.length>1024)return reply({error:'Request too large'},413);let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  const minute=Math.floor(now()/60000);if(await run(['EVAL',QUOTA,'2',storageKey('market:requests:'+minute,env),storageKey('market:member:'+user.id+':'+minute,env),'120','12','120','120'],{env})!==1)return reply({error:'יותר מדי בקשות לנתוני שוק.'},429);
  return reply(await readMarketSnapshot({selected:body?.symbol,interval:body?.interval||'1day',env,run,fetcher,now:now()}));
 }catch(e){return reply({error:e instanceof MarketError?e.message:'חיבור הנתונים אינו זמין. הגרף הקיים לא שונה.'},e instanceof MarketError?e.status:503)}
}}
export default request=>createPublicMarketHandler()(request);
