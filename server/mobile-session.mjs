import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
import {publicAuthConfigured,currentUser,cookieToken,digest,sessionCookie} from './auth-core.mjs';

const REQUEST_TTL=300;
const requestIdRE=/^[a-f0-9]{64}$/;
const verifierRE=/^[A-Za-z0-9._~-]{43,128}$/;
const uuidRE=/^[a-f0-9-]{36}$/;
const json=raw=>{try{return JSON.parse(raw||'null')}catch{return null}};
const reply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export const mobileSessionConfigured=(env=process.env)=>env.ASAF_NATIVE_APP_ENABLED==='true'&&publicAuthConfigured(env);
const validChallenge=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value)&&Buffer.from(value,'base64url').toString('base64url')===value;
const matchesChallenge=(verifier,challenge)=>{
 if(typeof verifier!=='string'||!verifierRE.test(verifier)||!validChallenge(challenge))return false;
 const actual=createHash('sha256').update(verifier).digest(),expected=Buffer.from(challenge,'base64url');
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
};
const RATE=`-- mobile-session-rate
for i=1,#KEYS do if tonumber(redis.call('GET',KEYS[i]) or '0')>=tonumber(ARGV[i]) then return 0 end end
for i=1,#KEYS do redis.call('INCR',KEYS[i]);redis.call('EXPIRE',KEYS[i],tonumber(ARGV[#KEYS+i])) end
return 1`;
// Request, approving member and approving browser session must be unchanged in
// the same transaction. Approval never overrides another account's approval.
const APPROVE=`-- mobile-session-approve
if redis.call('GET',KEYS[1])~=ARGV[1] or redis.call('GET',KEYS[2])~=ARGV[2] or redis.call('GET',KEYS[3])~=ARGV[3] then return 0 end
redis.call('SET',KEYS[1],ARGV[4],'EX',tonumber(ARGV[5]));return 1`;
// Consume grant and issue the one-hour session atomically; a response lost in
// transit cannot be replayed to mint a second session. A collision fails closed.
const REDEEM=`-- mobile-session-redeem
if redis.call('GET',KEYS[1])~=ARGV[1] or redis.call('GET',KEYS[2])~=ARGV[2] then return 0 end
if redis.call('EXISTS',KEYS[3])==1 then return -1 end
redis.call('SET',KEYS[3],ARGV[3],'EX',3600);redis.call('DEL',KEYS[1]);return 1`;

/** Same-origin PKCE handoff from the system browser to the native app's site
 * session. Disabled until the native platform flow is independently accepted.
 * No Google tokens, cookie values, redirects or user details are returned in JSON.
 */
export function createMobileSessionHandler({env=process.env,run=command,now=()=>Date.now(),random=()=>randomBytes(32).toString('hex')}={}){
 return async function handler(request){
  if(request.method==='GET')return reply({enabled:mobileSessionConfigured(env)});
  if(request.method!=='POST')return reply({error:'POST only'},405);
  if(!mobileSessionConfigured(env))return reply({error:'חיבור האפליקציה עדיין אינו מופעל.'},503);
  if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
  if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON only'},415);
  try{
   const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>4096)return reply({error:'Request too large'},413);
   const body=json(raw),action=body?.action;
   const fields={begin:['action','challenge'],approve:['action','requestId','confirmation'],redeem:['action','requestId','verifier'],status:['action','requestId','verifier']};
   if(!body||Array.isArray(body)||typeof action!=='string'||!Object.hasOwn(fields,action)||Object.keys(body).length!==fields[action].length||!fields[action].every(key=>Object.hasOwn(body,key)))return reply({error:'Invalid request'},400);
   if(action==='begin'&&!validChallenge(body.challenge))return reply({error:'Invalid challenge'},400);
   if(action!=='begin'&&(typeof body.requestId!=='string'||!requestIdRE.test(body.requestId)))return reply({error:'Invalid request'},400);
   if(['redeem','status'].includes(action)&&(typeof body.verifier!=='string'||!verifierRE.test(body.verifier)))return reply({error:'Invalid verifier'},400);
   if(action==='approve'&&body.confirmation!=='CONNECT')return reply({error:'נדרש אישור מפורש לחיבור האפליקציה.'},400);
   const minute=Math.floor(now()/60000),rateName=action==='begin'?'begin':action==='approve'?'approve':'redeem';
   const rateKeys=[storageKey('auth:mobile-rate:'+rateName+':'+minute,env)],limits=[rateName==='redeem'?180:30],ttls=[120];
   if(rateName==='redeem'){rateKeys.push(storageKey('auth:mobile-poll:'+digest(body.requestId),env));limits.push(60);ttls.push(REQUEST_TTL);}
   if(await run(['EVAL',RATE,String(rateKeys.length),...rateKeys,...limits.map(String),...ttls.map(String)],{env})!==1)return reply({error:'יותר מדי ניסיונות חיבור. נסה מאוחר יותר.'},429);
   if(action==='begin'){
    const requestId=random();if(!requestIdRE.test(requestId))throw Error('Invalid random source');
    const record={status:'pending',challenge:body.challenge,expires:now()+REQUEST_TTL*1000};
    if(await run(['SET',storageKey('auth:mobile-request:'+digest(requestId),env),JSON.stringify(record),'EX',String(REQUEST_TTL),'NX'],{env})!=='OK')throw Error('Request collision');
    return reply({requestId,approvalPath:'/mobile-connect.html?request='+requestId,expiresIn:REQUEST_TTL});
   }
   const requestKey=storageKey('auth:mobile-request:'+digest(body.requestId),env),recordRaw=await run(['GET',requestKey],{env}),record=json(recordRaw);
   if(!record||!['pending','approved'].includes(record.status)||!validChallenge(record.challenge)||!Number.isFinite(record.expires)||record.expires<=now())return reply({error:'בקשת החיבור פגה או כבר נוצלה. התחל מחדש.'},401);
   if(action==='approve'){
    const user=await currentUser(request,{env,run,includeRecords:true});
    if(!user)return reply({error:'יש להיכנס לחשבון לפני אישור האפליקציה.'},401);
    if(record.status!=='pending')return reply({error:'בקשת החיבור כבר אושרה. התחל מחדש אם נבחר חשבון שגוי.'},409);
    const member=json(user.memberRaw),approvingSession=json(user.sessionRaw);
    if(!uuidRE.test(user.id)||typeof member?.version!=='string'||!member.version||!Number.isFinite(approvingSession?.expires)||approvingSession.expires<=now())return reply({error:'הכניסה אינה פעילה. היכנס שוב.'},401);
    const approved={...record,status:'approved',id:user.id,version:member.version};
    const saved=await run(['EVAL',APPROVE,'3',requestKey,storageKey('auth:member:'+user.id,env),storageKey('auth:session:'+digest(cookieToken(request)),env),recordRaw,user.memberRaw,user.sessionRaw,JSON.stringify(approved),String(Math.max(1,Math.ceil((record.expires-now())/1000)))],{env});
    if(saved!==1)return reply({error:'בקשת החיבור או החשבון השתנו. התחל מחדש.'},409);
    return reply({status:'approved'});
   }
   if(!matchesChallenge(body.verifier,record.challenge))return reply({error:'לא ניתן לאמת את בקשת החיבור.'},401);
   if(record.status==='pending')return reply({status:'pending'},202);
   if(!uuidRE.test(record.id)||typeof record.version!=='string'||!record.version)throw Error('Invalid approval');
   const memberKey=storageKey('auth:member:'+record.id,env),memberRaw=await run(['GET',memberKey],{env}),member=json(memberRaw);
   if(!member||member.enabled!==true||member.id!==record.id||member.version!==record.version)return reply({error:'החשבון אינו פעיל או שהכניסה בוטלה. התחל מחדש.'},403);
   if(action==='status')return reply({status:'approved'});
   const session=random();if(!requestIdRE.test(session))throw Error('Invalid random source');
   const saved=await run(['EVAL',REDEEM,'3',requestKey,memberKey,storageKey('auth:session:'+digest(session),env),recordRaw,memberRaw,JSON.stringify({id:record.id,version:record.version,expires:now()+3600000})],{env});
   if(saved!==1)return reply({error:'בקשת החיבור כבר נוצלה או שהחשבון השתנה. התחל מחדש.'},409);
   return reply({authenticated:true},200,{'Set-Cookie':sessionCookie(session)});
  }catch{return reply({error:'שירות חיבור האפליקציה אינו זמין. לא נפתחה גישה.'},503)}
 };
}
