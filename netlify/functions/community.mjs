import {randomUUID} from 'node:crypto';
import {currentUser,publicAuthConfigured,digest,cookieToken} from '../../server/auth-core.mjs';
import {subscriptionGuard} from '../../server/billing.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {setupInput,publicSetup} from '../../server/community-core.mjs';
const reply=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// All mutations recheck the session and member inside the same atomic write.
export const MUTATE=`-- community-mutate
if redis.call('GET',KEYS[3])~=ARGV[6] or redis.call('GET',KEYS[4])~=ARGV[7] then return -1 end
local session=cjson.decode(ARGV[6]);local clock=redis.call('TIME');if session.expires<=tonumber(clock[1])*1000 then return -1 end
local posts=cjson.decode(redis.call('GET',KEYS[1]) or '[]')
local action=ARGV[1];local actor=ARGV[2]
if action=='create' then
 local n=tonumber(redis.call('GET',KEYS[2]) or '0');if n>=5 then return -2 end
 table.insert(posts,1,cjson.decode(ARGV[3]));while #posts>200 do table.remove(posts) end
 redis.call('INCR',KEYS[2]);redis.call('EXPIRE',KEYS[2],86400)
else
 local found=false
 for i,p in ipairs(posts) do if p.id==ARGV[4] then
  found=true
  if action=='delete' then if p.authorId~=actor and ARGV[5]~='1' then return -3 end;table.remove(posts,i)
  elseif action=='report' then p.reports=p.reports or {};local n=0;for _ in pairs(p.reports) do n=n+1 end;if n<50 then p.reports[actor]=true end
  else return -3 end
  break
 end end
 if not found then return -4 end
end
redis.call('SET',KEYS[1],cjson.encode(posts));return 1`;
export function createCommunityHandler({env=process.env,run=command,authenticate=currentUser}={}){return async request=>{
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(!publicAuthConfigured(env))return reply({error:'הקהילה אינה זמינה כרגע.'},503);
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 try{
 const user=await authenticate(request,{env,run,includeRecords:true});if(!user)return reply({error:'יש להתחבר כדי לצפות בקהילה ולפרסם סטאפים.'},401);
 const author=digest(user.id),admin=(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').map(s=>s.trim()).includes(user.id),key=storageKey('community:posts',env);
 if(request.method==='GET'){const posts=JSON.parse(await run(['GET',key],{env})||'[]');return reply({posts:(Array.isArray(posts)?posts:[]).map(p=>publicSetup(p,author,admin)),admin})}
 if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
 const raw=await request.text();if(Buffer.byteLength(raw)>12000)return reply({error:'הפרסום גדול מדי'},413);
 let body,post;try{body=JSON.parse(raw);if(!['create','delete','report'].includes(body.action))throw Error('פעולה לא תקינה');if(body.action==='create')post={...setupInput(body),id:randomUUID(),authorId:author,createdAt:new Date().toISOString(),reports:{}};else if(!/^[a-f0-9-]{36}$/.test(body.id||''))throw Error('מזהה לא תקין')}catch(e){return reply({error:e.message},400)}
 if(body.action==='create'){const billingBlock=await subscriptionGuard(user,{env,run});if(billingBlock)return billingBlock;}
 const result=await run(['EVAL',MUTATE,'4',key,storageKey('community:quota:'+author+':'+new Date().toISOString().slice(0,10),env),storageKey('auth:session:'+digest(cookieToken(request)),env),storageKey('auth:member:'+user.id,env),body.action,author,post?JSON.stringify(post):'',body.id||'',admin?'1':'0',user.sessionRaw,user.memberRaw],{env});
 if(result!==1)return reply({error:({'-1':'הכניסה פגה. התחבר שוב.','-2':'ניתן לפרסם עד 5 סטאפים ביום.','-3':'אין הרשאה למחוק את הפרסום.','-4':'הפרסום כבר אינו זמין.'})[result]||'הפעולה נכשלה'},({'-1':401,'-2':429,'-3':403,'-4':404})[result]||503);
 return reply({ok:true},post?201:200);
 }catch{return reply({error:'לא ניתן לגשת לקהילה כרגע. הטיוטה שלך לא נמחקה; נסה לרענן.'},503)}
}}
export default request=>createCommunityHandler()(request);
