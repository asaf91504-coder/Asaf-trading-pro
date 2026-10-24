import {randomUUID} from 'node:crypto';
import {currentUser,cookieToken,digest,publicAuthConfigured} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {publicMarketConfigured,marketSelection} from '../../server/market-feed.mjs';
import {alertRules,alertSignature} from '../../alert-core.mjs';
const reply=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export const ALERT_SAVE=`-- alert-rules-save
if redis.call('GET',KEYS[2])~=ARGV[3] or redis.call('GET',KEYS[3])~=ARGV[4] then return -1 end
local s=cjson.decode(ARGV[3]);local t=redis.call('TIME');if s.expires<=tonumber(t[1])*1000+tonumber(t[2])/1000 then return -1 end
local old=redis.call('GET',KEYS[1]);if old then if cjson.decode(old).revision~=ARGV[1] then return 0 end elseif ARGV[1]~='' then return 0 end
redis.call('SET',KEYS[1],ARGV[2]);if ARGV[6]=='0' then redis.call('SREM',KEYS[4],ARGV[5]) else redis.call('SADD',KEYS[4],ARGV[5]) end;return 1`;
export function createAlertsHandler({env=process.env,run=command,now=()=>Date.now()}={}){return async request=>{
 if(!['GET','PUT'].includes(request.method))return reply({error:'Method not allowed'},405);if(!publicAuthConfigured(env))return reply({error:'ניהול התראות ממתין לחיבור החשבון.'},503);
 if(request.method==='PUT'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 try{const user=await currentUser(request,{env,run,includeRecords:true});if(!user)return reply({error:'יש להיכנס לחשבון לניהול התראות.'},401);
  const allowed=await run(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=20 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('alerts:requests:'+user.id+':'+Math.floor(now()/60000),env)],{env});if(allowed!==1)return reply({error:'יותר מדי פעולות התראות בדקה.'},429);
  const key=storageKey('alerts:rules:'+user.id,env),oldRaw=await run(['GET',key],{env}),old=oldRaw?JSON.parse(oldRaw):{revision:'',rules:[]};
  if(request.method==='GET'){const inbox=await run(['GET',storageKey('alerts:inbox:'+user.id,env)],{env});return reply({...old,inbox:inbox?JSON.parse(inbox):[],pendingMarket:!publicMarketConfigured(env),backgroundEnabled:env.ASAF_BACKGROUND_REFRESH_ENABLED==='true'&&publicMarketConfigured(env),note:'התראות יומיות סגורות, בתיבת האתר בלבד. אין דוא״ל, SMS או Push. ההפעלה ברקע דורשת חיבור נתונים והתקנת תזמון.'})}
  if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);const raw=await request.text();if(raw.length>16000)return reply({error:'Request too large'},413);let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(body?.memberId!==user.id||typeof body.revision!=='string'||body.revision!==old.revision)return reply({error:'החשבון או הכללים השתנו. טען אותם שוב לפני שמירה.'},409);
  let rules;try{rules=alertRules(body.rules);if(publicMarketConfigured(env))for(const r of rules)marketSelection(r.symbol,'1day',env)}catch(e){return reply({error:e.message},400)}
  rules=rules.map(r=>{const previous=old.rules.find(x=>x.id===r.id);return {...r,createdAt:previous&&alertSignature(previous)===alertSignature(r)?previous.createdAt:now()}});
  const saved={revision:randomUUID(),rules,updatedAt:new Date(now()).toISOString()};
  const result=await run(['EVAL',ALERT_SAVE,'4',key,storageKey('auth:session:'+digest(cookieToken(request)),env),storageKey('auth:member:'+user.id,env),storageKey('alerts:members',env),body.revision,JSON.stringify(saved),user.sessionRaw,user.memberRaw,user.id,String(rules.length)],{env});
  if(result===-1)return reply({error:'הכניסה פגה. היכנס שוב.'},401);if(result!==1)return reply({error:'הכללים עודכנו. טען מחדש.'},409);return reply(saved);
 }catch{return reply({error:'ניהול התראות אינו זמין. העותק בחשבון לא נדרס.'},503)}
}}
export default request=>createAlertsHandler()(request);
