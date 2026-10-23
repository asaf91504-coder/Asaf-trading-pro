import {randomUUID,randomBytes} from 'node:crypto';
import {command,storageKey} from '../../server/storage.mjs';
import {publicAuthConfigured,normalizeEmail,digest,passwordRecord,sessionCookie} from '../../server/auth-core.mjs';
const reply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
// The invite contains only an email digest and expiry. Its random token is never stored.
// Account, session and invite consumption are committed together. Existing accounts
// cannot be overwritten through this endpoint, even with another valid invite.
const RESET="if redis.call('GET',KEYS[1])~=ARGV[1] or redis.call('GET',KEYS[2])~=ARGV[2] then return 0 end; redis.call('SET',KEYS[2],ARGV[3]); redis.call('SET',KEYS[3],ARGV[4]); redis.call('SET',KEYS[4],ARGV[5],'EX',3600); redis.call('DEL',KEYS[1]); return 1";
const ACTIVATE="if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end; if redis.call('EXISTS',KEYS[2])==1 then return 0 end; redis.call('SET',KEYS[2],ARGV[2]); redis.call('SET',KEYS[3],ARGV[3]); redis.call('SET',KEYS[4],ARGV[4],'EX',3600); redis.call('DEL',KEYS[1]); return 1";
export default async function handler(request){
 if(request.method!=='POST')return reply({error:'POST only'},405);
 if(!publicAuthConfigured())return reply({error:'הפעלת חשבונות עדיין אינה זמינה.'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON only'},415);
 try{
  if(Number(request.headers.get('content-length')||0)>4096)return reply({error:'Request too large'},413);
  const raw=await request.text();if(raw.length>4096)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  const {token,password}=body||{},email=normalizeEmail(body?.email),reset=body?.action==='reset'||(body?.action==='check'&&body?.mode==='reset'),check=body?.action==='check';
  if(body?.action!==undefined&&!['activate','reset','check'].includes(body.action))return reply({error:'Invalid action'},400);
  if(!/^[a-f0-9]{64}$/.test(token||'')||!/^[^\s@]{1,100}@[^\s@]{1,150}\.[^\s@]{2,50}$/.test(email)||(!check&&(typeof password!=='string'||password.length<12||password.length>200)))return reply({error:'נדרשים הזמנה תקינה, אימייל וסיסמה באורך 12–200 תווים.'},400);
  const attempt=await command(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=20 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('auth:activation-attempt:'+Math.floor(Date.now()/60000))]);
  if(attempt!==1)return reply({error:'יותר מדי ניסיונות. נסה בעוד דקה.'},429);
  const inviteKey=storageKey('auth:'+(reset?'reset:':'invite:')+digest(token)),stored=await command(['GET',inviteKey]);let invite;try{invite=JSON.parse(stored||'null')}catch{}
  if(!invite||!Number.isFinite(invite.expires)||invite.expires<=Date.now())return reply({error:'הקישור אינו תקף, פג או כבר נוצל. פתח את הקישור האישי מהמייל.'},401);
  if(invite.emailHash!==digest(email))return reply({error:'האימייל אינו תואם להזמנה. השתמש באימייל שאליו נשלח הקישור.'},401);
  const userKey=storageKey('auth:user:'+digest(email));let previous=null,previousRaw=null;
  if(reset){previousRaw=await command(['GET',userKey]);try{previous=JSON.parse(previousRaw||'null')}catch{}
   if(!previous||previous.enabled!==true||!/^[a-f0-9-]{36}$/.test(previous.id)||invite.version!==previous.version)return reply({error:'קישור השחזור פג או שהגישה לחשבון חסומה.'},401);
  }
  if(check){if(!reset&&await command(['EXISTS',userKey])===1)return reply({error:'החשבון כבר הופעל. עבור לכניסה עם הסיסמה שבחרת.'},409);return reply({valid:true,mode:reset?'reset':'activate'})}
  const id=reset?previous.id:randomUUID(),version=randomUUID(),sessionToken=randomBytes(32).toString('hex');
  const record={id,version,enabled:true,...(previous?.googleSubject?{googleSubject:previous.googleSubject}:{}),...await passwordRecord(password)};
  const result=await command(['EVAL',reset?RESET:ACTIVATE,'4',inviteKey,userKey,storageKey('auth:member:'+id),storageKey('auth:session:'+digest(sessionToken)),stored,...(reset?[previousRaw]:[]),JSON.stringify(record),JSON.stringify({id,version,enabled:true}),JSON.stringify({id,version,expires:Date.now()+3600000})]);
  if(result!==1)return reply({error:'ההזמנה כבר נוצלה או שקיים חשבון. נסה להיכנס לחשבון הקיים.'},409);
  return reply(reset?{reset:true,authenticated:true}:{created:true,authenticated:true},reset?200:201,{'Set-Cookie':sessionCookie(sessionToken)});
 }catch{return reply({error:'לא ניתן להשלים הפעלה כרגע. הגישה נשארה מוגנת.'},503)}
}
