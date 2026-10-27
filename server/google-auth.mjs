import {OAuth2Client} from 'google-auth-library';
import {googleDisplayName} from '../welcome-message.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
import {publicAuthConfigured,digest,normalizeEmail,currentUser,sessionCookie} from './auth-core.mjs';

const google=new OAuth2Client();
const uuid=/^[a-f0-9-]{36}$/;
export const googleConfigured=(env=process.env)=>publicAuthConfigured(env)&&env.ASAF_GOOGLE_AUTH_ENABLED==='true'&&/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID||'');
const reply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const parse=raw=>{try{return JSON.parse(raw||'null')}catch{return null}};
const COMMIT=`-- google-identity-commit
if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
local identity=redis.call('GET',KEYS[2]);if (identity or '')~=ARGV[2] then return 0 end
local previous=redis.call('GET',KEYS[3]);if (previous or '')~=ARGV[3] then return 0 end
local member=redis.call('GET',KEYS[4]);if (member or '')~=ARGV[4] then return 0 end
if ARGV[3]=='' and redis.call('SCARD',KEYS[7])>=tonumber(ARGV[9]) then return -1 end
redis.call('SET',KEYS[2],ARGV[5]);redis.call('SET',KEYS[3],ARGV[6]);redis.call('SET',KEYS[4],ARGV[7]);redis.call('SET',KEYS[5],ARGV[8],'EX',3600);redis.call('SET',KEYS[6],ARGV[5]);redis.call('SADD',KEYS[7],ARGV[10]);redis.call('DEL',KEYS[1]);return 1`;

// GIS returns an ID token to this site's callback; no Google access/refresh token
// or client secret is requested. Google's maintained library verifies signatures,
// issuer, expiry and audience. A one-use nonce is bound to an HttpOnly site cookie.
export function createGoogleHandler({env=process.env,run=command,verify=async token=>(await google.verifyIdToken({idToken:token,audience:env.GOOGLE_CLIENT_ID})).getPayload(),now=()=>Date.now()}={}){
 return async function handler(request){
  if(request.method==='GET')return reply({enabled:googleConfigured(env),signupEnabled:googleConfigured(env)&&env.ASAF_GOOGLE_SIGNUP_ENABLED==='true',...(googleConfigured(env)?{clientId:env.GOOGLE_CLIENT_ID}:{})});
  if(request.method!=='POST')return reply({error:'POST only'},405);
  if(!googleConfigured(env))return reply({error:'כניסה עם Google עדיין אינה מוגדרת.'},503);
  if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
  if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON only'},415);
  try{
   const raw=await request.text();if(raw.length>16000)return reply({error:'Request too large'},413);
   let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
   if(!body||!['begin','signin'].includes(body.action))return reply({error:'Invalid action'},400);
   const minute=Math.floor(now()/60000);
   const allowed=await run(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=60 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('auth:google-attempt:'+minute,env)],{env});
   if(allowed!==1)return reply({error:'יותר מדי ניסיונות כניסה. נסה בעוד דקה.'},429);
   if(body.action==='begin'){
    const nonce=randomBytes(32).toString('hex'),binding=randomBytes(32).toString('hex');
    await run(['SET',storageKey('auth:google-nonce:'+digest(nonce),env),JSON.stringify({binding:digest(binding),expires:now()+300000}),'EX','300'],{env});
    return reply({nonce,clientId:env.GOOGLE_CLIENT_ID},200,{'Set-Cookie':'asaf_google_binding='+binding+'; Path=/.netlify/functions/google-auth; HttpOnly; Secure; SameSite=Strict; Max-Age=300'});
   }
   if(typeof body.credential!=='string'||body.credential.length>14000||!body.credential||!/^[a-f0-9]{64}$/.test(body.nonce||''))return reply({error:'בקשת Google אינה תקינה.'},400);
   const binding=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('asaf_google_binding='))?.slice(20);
   if(!/^[a-f0-9]{64}$/.test(binding||''))return reply({error:'הכניסה פגה. התחל שוב.'},401);
   const nonceKey=storageKey('auth:google-nonce:'+digest(body.nonce),env),nonceRaw=await run(['GET',nonceKey],{env}),nonce=parse(nonceRaw);
   if(!nonce||nonce.binding!==digest(binding)||nonce.expires<=now())return reply({error:'הכניסה פגה. התחל שוב.'},401);
   let claims;try{claims=await verify(body.credential)}catch{return reply({error:'Google לא אימת את פרטי הכניסה.'},401)}
   if(!claims||claims.aud!==env.GOOGLE_CLIENT_ID||!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||!Number.isFinite(claims.exp)||claims.exp*1000<=now()||claims.nonce!==body.nonce||claims.email_verified!==true||typeof claims.sub!=='string'||!/^\d{1,255}$/.test(claims.sub))return reply({error:'אימות Google נכשל.'},401);
   const email=normalizeEmail(claims.email);if(!/^[^\s@]{1,100}@[^\s@]{1,150}\.[^\s@]{2,50}$/.test(email))return reply({error:'Google לא החזיר אימייל מאומת.'},401);
   const subjectHash=digest(claims.sub),identityKey=storageKey('auth:google:'+subjectHash,env),identity=await run(['GET',identityKey],{env});
   if(identity&&!/^[a-f0-9]{64}$/.test(identity))throw Error('Invalid identity');
   const emailHash=identity||digest(email),userKey=storageKey('auth:user:'+emailHash,env),previousRaw=await run(['GET',userKey],{env}),previous=parse(previousRaw);
   const current=await currentUser(request,{env,run});
   if(previousRaw&&(!previous||!uuid.test(previous.id)||typeof previous.version!=='string'))throw Error('Invalid account');
   if(previous?.enabled!==undefined&&previous.enabled!==true)return reply({error:'הגישה לחשבון חסומה.'},403);
   if(identity&&(!previous||previous.googleSubject!==subjectHash))return reply({error:'קישור החשבון אינו תקין.'},403);
   if(previous?.googleSubject&&previous.googleSubject!==subjectHash)return reply({error:'כבר מקושר לחשבון Google אחר.'},409);
   // Google is authoritative for @gmail.com addresses. Do not extend this
   // shortcut to third-party email domains, whose ownership can change.
   const googleOwnedMailbox=email.endsWith('@gmail.com');
   if(!identity&&previous&&current?.id!==previous.id&&!googleOwnedMailbox)return reply({error:'קיים חשבון עם אימייל זה. היכנס עם הסיסמה הקיימת ואז קשר את Google.',code:'link_required'},409);
   if(current&&previous&&current.id!==previous.id)return reply({error:'צא מהחשבון לפני מעבר לחשבון Google אחר.'},409);
   if(current&&!previous)return reply({error:'לקישור Google, בחר את אותו אימייל של החשבון הקיים.'},409);
   if(!previous&&env.ASAF_GOOGLE_SIGNUP_ENABLED!=='true')return reply({error:'הרשמה עם Google עדיין אינה פתוחה.'},403);
   const id=previous?.id||randomUUID(),version=previous?.version||randomUUID(),memberKey=storageKey('auth:member:'+id,env),memberRaw=await run(['GET',memberKey],{env}),member=parse(memberRaw);
   if(previous&&(!member||member.enabled!==true||member.id!==id||member.version!==version))return reply({error:'הגישה לחשבון חסומה.'},403);
   const user={...previous,id,version,enabled:true,googleSubject:subjectHash};
   const session=randomBytes(32).toString('hex'),max=Number(env.ASAF_ACCOUNT_MAX_MEMBERS||100);
   if(!Number.isInteger(max)||max<1||max>10000)throw Error('Invalid account limit');
   const saved=await run(['EVAL',COMMIT,'7',nonceKey,identityKey,userKey,memberKey,storageKey('auth:session:'+digest(session),env),storageKey('auth:index:'+id,env),storageKey('auth:members',env),nonceRaw,identity||'',previousRaw||'',memberRaw||'',emailHash,JSON.stringify(user),JSON.stringify({id,version,enabled:true}),JSON.stringify({id,version,expires:now()+3600000}),String(max),id],{env});
   if(saved===-1)return reply({error:'ההרשמה מלאה כרגע. פנה למנהל האתר.'},403);
   if(saved!==1)return reply({error:'הבקשה כבר נוצלה או שהחשבון עודכן. התחל שוב.'},409);
   return reply({authenticated:true,created:!previous,displayName:googleDisplayName(claims)},previous?200:201,{'Set-Cookie':sessionCookie(session)});
  }catch{return reply({error:'שירות הכניסה אינו זמין. לא נפתחה גישה.'},503)}
 };
}
