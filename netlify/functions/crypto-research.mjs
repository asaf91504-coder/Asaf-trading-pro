import {currentUser} from '../../server/auth-core.mjs';
import {command} from '../../server/storage.mjs';
import {cryptoResearchConfigured,cryptoResearchIntervals,cryptoResearchSelection,readCryptoSnapshot,CryptoResearchError} from '../../server/crypto-research.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createCryptoResearchHandler({env=process.env,run=command,fetcher=fetch,now=()=>Date.now()}={}){return async request=>{
 const enabled=cryptoResearchConfigured(env);
 if(request.method==='GET')return reply({enabled,ownerOnly:true,provider:'CoinLore',refreshSeconds:60,intervals:cryptoResearchIntervals});
 if(request.method!=='POST')return reply({error:'POST only'},405);
 if(!enabled)return reply({error:'מחקר הקריפטו למנהל אינו זמין.'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON only'},415);
 try{
  const user=await currentUser(request,{env,run});if(!user)return reply({error:'יש להיכנס לחשבון.'},401);
  if(!(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').map(value=>value.trim()).includes(user.id))return reply({error:'מחקר הקריפטו זמין למנהל בלבד.'},403);
  const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>1024)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!body||Array.isArray(body)||typeof body.symbol!=='string'||Object.keys(body).some(key=>!['symbol','interval'].includes(key)))return reply({error:'Invalid request'},400);
  cryptoResearchSelection(body.symbol,body.interval??'1day');
  return reply(await readCryptoSnapshot({selected:body.symbol,interval:body.interval??'1day',env,run,fetcher,now:now()}));
 }catch(error){return reply({error:error instanceof CryptoResearchError?error.message:'חיבור מחקר הקריפטו אינו זמין.'},error instanceof CryptoResearchError?error.status:503)}
};}
export default request=>createCryptoResearchHandler()(request);
