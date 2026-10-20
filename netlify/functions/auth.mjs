import {command,storageKey} from '../../server/storage.mjs';
import {publicAuthConfigured,normalizeEmail,digest,passwordMatches,currentUser,createSession,cookieToken,sessionCookie} from '../../server/auth-core.mjs';
const response=(body,status=200,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export default async function handler(request){
 if(!['GET','POST'].includes(request.method))return response({error:'Method not allowed'},405);
 if(!publicAuthConfigured())return response({enabled:false,authenticated:false},request.method==='GET'?200:503);
 try{
  if(request.method==='GET')return response({enabled:true,authenticated:!!await currentUser(request)});
  if(request.headers.get('origin')!==new URL(request.url).origin)return response({error:'Origin mismatch'},403);
  if(!(request.headers.get('content-type')||'').includes('application/json'))return response({error:'JSON only'},415);
  const raw=await request.text();if(raw.length>4096)return response({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return response({error:'Invalid JSON'},400)}
  if(body.action==='logout'){const token=cookieToken(request);if(token)await command(['DEL',storageKey('auth:session:'+digest(token))]);return response({authenticated:false},200,{'Set-Cookie':'asaf_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'})}
  const email=normalizeEmail(body.email),password=body.password;
  if(!/^[^\s@]{1,100}@[^\s@]{1,150}\.[^\s@]{2,50}$/.test(email)||typeof password!=='string'||password.length<1||password.length>200)return response({error:'פרטי הכניסה אינם תקינים'},400);
  const userKey=storageKey('auth:user:'+digest(email)),window=storageKey('auth:attempt:'+digest(email)+':'+Math.floor(Date.now()/60000));
  const globalWindow=storageKey('auth:global-attempt:'+Math.floor(Date.now()/60000));
  const allowed=await command(['EVAL',"local a=tonumber(redis.call('GET',KEYS[1]) or '0');local b=tonumber(redis.call('GET',KEYS[2]) or '0');if a>=5 or b>=30 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);redis.call('INCR',KEYS[2]);redis.call('EXPIRE',KEYS[2],120);return 1",'2',window,globalWindow]);
  if(allowed!==1)return response({error:'יותר מדי ניסיונות כניסה. נסה בעוד דקה.'},429);
  const record=await command(['GET',userKey]);let user;try{user=JSON.parse(record||'null')}catch{}
  // Use the same password work for unknown addresses to avoid a fast account-existence signal.
  const valid=await passwordMatches(password,user||{salt:'0'.repeat(32),hash:'0'.repeat(64)});
  if(!valid||user?.enabled!==true||typeof user?.version!=='string'||!/^[a-f0-9-]{36}$/.test(user?.id))return response({error:'האימייל או הסיסמה שגויים, או שהגישה טרם אושרה.'},401);
  const token=await createSession(user.id,user.version);return response({authenticated:true},200,{'Set-Cookie':sessionCookie(token)});
 }catch{return response({error:'שירות הכניסה אינו זמין. לא נפתחה גישה לצ׳אט.'},503)}
}
