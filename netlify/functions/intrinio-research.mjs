import {currentUser} from '../../server/auth-core.mjs';
import {command} from '../../server/storage.mjs';
import {intrinioConfigured,readIntrinioSnapshot,IntrinioError} from '../../server/intrinio-research.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createIntrinioHandler({env=process.env,run=command,fetcher=fetch,now=()=>Date.now()}={}){return async request=>{
 const enabled=intrinioConfigured(env,now());
 if(request.method==='GET')return reply({enabled,ownerOnly:true,provider:'Intrinio',intervals:['1day'],refreshSeconds:60,aiAnalysisEnabled:enabled&&env.ASAF_INTRINIO_AI_LICENSE_CONFIRMED==='true'});
 if(request.method!=='POST')return reply({error:'POST only'},405);
 if(!enabled)return reply({error:'ניסיון Intrinio לא הופעל בשרת או הסתיים.'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
 try{
  const user=await currentUser(request,{env,run});if(!user)return reply({error:'יש להיכנס לחשבון.'},401);
  if(!(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').map(s=>s.trim()).includes(user.id))return reply({error:'ניסיון Intrinio זמין לבעל הפרויקט בלבד.'},403);
  const raw=await request.text();if(Buffer.byteLength(raw)>1024)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!body||Array.isArray(body)||typeof body.symbol!=='string'||Object.keys(body).some(k=>!['symbol','interval'].includes(k)))return reply({error:'Invalid request'},400);
  return reply(await readIntrinioSnapshot({selected:body.symbol,interval:body.interval??'1day',env,run,fetcher,now:now()}));
 }catch(e){return reply({error:e instanceof IntrinioError?e.message:'שירות נתוני Intrinio אינו זמין.'},e instanceof IntrinioError?e.status:503)}
};}
export default request=>createIntrinioHandler()(request);
