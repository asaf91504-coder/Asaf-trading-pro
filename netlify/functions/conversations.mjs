import {randomUUID} from 'node:crypto';
import {currentUser,publicAuthConfigured,cookieToken,digest} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {updateChatStore} from '../../chat-history-core.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const SAVE=`-- conversations-authenticated-save
if redis.call('GET',KEYS[2])~=ARGV[3] or redis.call('GET',KEYS[3])~=ARGV[4] then return -1 end
local session=cjson.decode(ARGV[3]);local clock=redis.call('TIME');if session.expires<=tonumber(clock[1])*1000+tonumber(clock[2])/1000 then return -1 end
local old=redis.call('GET',KEYS[1]);if old then if cjson.decode(old).revision~=ARGV[1] then return 0 end elseif ARGV[1]~='' then return 0 end
redis.call('SET',KEYS[1],ARGV[2]);return 1`;
export function createConversationsHandler({env=process.env,run=command}={}){return async request=>{
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(!publicAuthConfigured(env))return reply({error:'שמירת שיחות בחשבון אינה זמינה.'},503);
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 try{
  const user=await currentUser(request,{env,run,includeRecords:true});if(!user)return reply({error:'יש להיכנס לחשבון.'},401);
  const allowed=await run(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=60 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('conversations:rate:'+user.id+':'+Math.floor(Date.now()/60000),env)],{env});
  if(allowed!==1)return reply({error:'יותר מדי פעולות. נסה בעוד דקה.'},429);
  const key=storageKey('conversations:member:'+user.id,env);
  const read=async()=>JSON.parse(await run(['GET',key],{env})||'{"revision":"","conversations":[]}');
  if(request.method==='GET')return reply(await read());
  if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
  if(Number(request.headers.get('content-length'))>250000)return reply({error:'Request too large'},413);
  const raw=await request.text();if(Buffer.byteLength(raw)>250000)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(body?.memberId!==user.id)return reply({error:'החשבון השתנה. רענן את העמוד.'},409);
  for(let attempt=0;attempt<3;attempt++){
   const old=await read();let next;try{next=updateChatStore(old,body)}catch(e){return reply({error:e.message},400)}
   if(next===old)return reply({saved:true});
   next.revision=randomUUID();
   const result=await run(['EVAL',SAVE,'3',key,storageKey('auth:session:'+digest(cookieToken(request)),env),storageKey('auth:member:'+user.id,env),old.revision,JSON.stringify(next),user.sessionRaw,user.memberRaw],{env});
   if(result===-1)return reply({error:'הכניסה פגה. היכנס שוב כדי לשמור.'},401);
   if(result===1)return reply({saved:true});
  }
  return reply({error:'השיחות עודכנו במכשיר אחר. נסה שוב.'},409);
 }catch{return reply({error:'השמירה אינה זמינה כרגע. אפשר לנסות שוב.'},503)}
}}
export default request=>createConversationsHandler()(request);
