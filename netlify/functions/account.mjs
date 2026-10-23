import {randomUUID} from 'node:crypto';
import {publicAuthConfigured,currentUser,cookieToken,digest,normalizeEmail} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
const reply=(body,status=200,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const expiredCookie='asaf_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
const parse=value=>{try{return JSON.parse(value||'null')}catch{return null}};
const CHANGE=`-- account-version-change
if redis.call('GET',KEYS[1])~=ARGV[1] or redis.call('GET',KEYS[2])~=ARGV[2] then return 0 end
redis.call('SET',KEYS[1],ARGV[3]);redis.call('SET',KEYS[2],ARGV[4]);return 1`;
const DELETE=`-- account-self-delete
if redis.call('GET',KEYS[1])~=ARGV[1] or redis.call('GET',KEYS[2])~=ARGV[2] then return 0 end
if ARGV[3]=='1' and redis.call('GET',KEYS[5])==ARGV[4] then redis.call('DEL',KEYS[5]) end
redis.call('DEL',KEYS[1],KEYS[2],KEYS[3],KEYS[4],KEYS[6]);redis.call('SREM',KEYS[7],ARGV[5]);return 1`;
export function createAccountHandler({env=process.env,run=command}={}){return async request=>{
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(!publicAuthConfigured(env))return reply({error:'ניהול חשבונות אינו זמין.'},503);
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 try{
  const current=await currentUser(request,{env,run});if(!current)return reply({error:'יש להיכנס לחשבון.'},401);
  const admin=(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').map(x=>x.trim()).includes(current.id);
  let hash=await run(['GET',storageKey('auth:index:'+current.id,env)],{env});
  let userKey=typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)?storageKey('auth:user:'+hash,env):null;
  let userRaw=userKey?await run(['GET',userKey],{env}):null,user=parse(userRaw);
  if(user&&user.id!==current.id)throw Error('Account mismatch');
  if(request.method==='GET')return reply({authenticated:true,memberId:current.id,admin,googleLinked:!!user?.googleSubject,managementReady:!!user});
  if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON only'},415);
  const raw=await request.text();if(raw.length>2048)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!body||typeof body.action!=='string')return reply({error:'Invalid action'},400);
  const allowed=await run(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=15 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('auth:manage:'+current.id+':'+Math.floor(Date.now()/60000),env)],{env});
  if(allowed!==1)return reply({error:'יותר מדי פעולות. נסה בעוד דקה.'},429);
  const adminAction=body.action.startsWith('admin-');
  if(adminAction){
   if(!admin)return reply({error:'נדרשת הרשאת מנהל.'},403);
   if(!['admin-status','admin-disable','admin-enable'].includes(body.action))return reply({error:'Invalid action'},400);
   const email=normalizeEmail(body.email);if(!/^[^\s@]{1,100}@[^\s@]{1,150}\.[^\s@]{2,50}$/.test(email))return reply({error:'יש להזין אימייל תקין.'},400);
   hash=digest(email);userKey=storageKey('auth:user:'+hash,env);userRaw=await run(['GET',userKey],{env});user=parse(userRaw);
   if(!user)return reply({exists:false});
   if(body.action==='admin-status')return reply({exists:true,memberId:user.id,enabled:user.enabled===true});
   if(user.id===current.id)return reply({error:'אין לשנות את גישת המנהל דרך טופס זה.'},409);
  }else if(!['logout-all','delete'].includes(body.action))return reply({error:'Invalid action'},400);
  if(!user||typeof user.version!=='string'||!/^[a-f0-9-]{36}$/.test(user.id))return reply({error:'לניהול החשבון היכנס שוב עם הסיסמה או קשר Google.'},409);
  const memberKey=storageKey('auth:member:'+user.id,env),memberRaw=await run(['GET',memberKey],{env}),member=parse(memberRaw);
  if(!member||member.version!==user.version||member.enabled!==user.enabled)throw Error('Account changed');
  if(body.action==='delete'){
   if(body.confirmation!=='DELETE')return reply({error:'נדרש אישור מחיקה.'},400);
   const result=await run(['EVAL',DELETE,'7',userKey,memberKey,storageKey('workspace:member:'+user.id,env),storageKey('auth:index:'+user.id,env),storageKey('auth:google:'+(user.googleSubject||'none'),env),storageKey('auth:session:'+digest(cookieToken(request)),env),storageKey('auth:members',env),userRaw,memberRaw,user.googleSubject?'1':'0',hash,user.id],{env});
   if(result!==1)return reply({error:'החשבון עודכן. נסה שוב.'},409);
   return reply({deleted:true,authenticated:false},200,{'Set-Cookie':expiredCookie});
  }
  const version=randomUUID(),enabled=adminAction?body.action==='admin-enable':true;
  const record={...user,version,enabled},changed=await run(['EVAL',CHANGE,'2',userKey,memberKey,userRaw,memberRaw,JSON.stringify(record),JSON.stringify({id:user.id,version,enabled})],{env});
  if(changed!==1)return reply({error:'החשבון עודכן. נסה שוב.'},409);
  return adminAction?reply({exists:true,memberId:user.id,enabled}):reply({authenticated:false,allSessionsRevoked:true},200,{'Set-Cookie':expiredCookie});
 }catch{return reply({error:'ניהול החשבון אינו זמין. נסה שוב.'},503)}
}}
export default request=>createAccountHandler()(request);
