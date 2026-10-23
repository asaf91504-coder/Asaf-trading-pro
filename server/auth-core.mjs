import {randomBytes,createHash,timingSafeEqual,scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import {command,storageKey,storeConfigured} from './storage.mjs';
const scrypt=promisify(scryptCallback);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const normalizeEmail=value=>String(value||'').trim().toLowerCase();
export async function passwordRecord(password){if(typeof password!=='string'||password.length<12||password.length>200)throw Error('Password must contain 12 to 200 characters');const salt=randomBytes(16).toString('hex'),hash=await scrypt(password,salt,32);return {salt,hash:hash.toString('hex')}}
export async function passwordMatches(password,record){if(typeof password!=='string'||password.length>200||!/^[a-f0-9]{32}$/.test(record?.salt)||!/^[a-f0-9]{64}$/.test(record?.hash))return false;const actual=await scrypt(password,record.salt,32);return timingSafeEqual(actual,Buffer.from(record.hash,'hex'))}
export function publicAuthConfigured(env=process.env){return env.ASAF_PUBLIC_AUTH_ENABLED==='true'&&storeConfigured(env)}
export const sessionCookie=token=>'asaf_session='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600';
export function cookieToken(request){const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('asaf_session='))?.slice(13);return /^[a-f0-9]{64}$/.test(value||'')?value:null}
export async function currentUser(request,{env=process.env,run=command,includeRecords=false}={}){
 if(!publicAuthConfigured(env))return null;const token=cookieToken(request);if(!token)return null;
 const raw=await run(['GET',storageKey('auth:session:'+digest(token),env)],{env});if(!raw)return null;
 let session;try{session=JSON.parse(raw)}catch{return null}
 if(!/^[a-f0-9-]{36}$/.test(session?.id)||!Number.isFinite(session.expires)||session.expires<=Date.now())return null;
 const userRaw=await run(['GET',storageKey('auth:member:'+session.id,env)],{env});if(!userRaw)return null;
 let user;try{user=JSON.parse(userRaw)}catch{return null}
 return user.enabled===true&&user.id===session.id&&typeof session.version==='string'&&session.version===user.version?{id:user.id,...(includeRecords?{sessionRaw:raw,memberRaw:userRaw}:{})}:null;
}
export async function createSession(id,version,{env=process.env,run=command}={}){const token=randomBytes(32).toString('hex');await run(['SET',storageKey('auth:session:'+digest(token),env),JSON.stringify({id,version,expires:Date.now()+3600000}),'EX','3600'],{env});return token}
