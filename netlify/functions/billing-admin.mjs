import {currentUser,cookieToken,digest,normalizeEmail} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {DAY,entitlement,recordKey,readBilling,withBillingLock} from '../../server/billing.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// Commit authorization, account version, billing record and audit together.
const GRANT=`-- billing-admin-grant
for i=1,4 do if (redis.call('GET',KEYS[i]) or '')~=ARGV[i] then return 0 end end
if cjson.decode(ARGV[1]).expires<=tonumber(ARGV[6]) then return 0 end
redis.call('SET',KEYS[4],ARGV[5]);return 1`;
export function createBillingAdminHandler({env=process.env,run=command,now=()=>Date.now()}={}){return async request=>{
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 try{
  const actor=await currentUser(request,{env,run,includeRecords:true});
  if(!actor)return reply({error:'יש להיכנס לחשבון.'},401);
  if(!(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').map(s=>s.trim()).includes(actor.id))return reply({error:'נדרשת הרשאת מנהל.'},403);
  if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
  const raw=await request.text();if(raw.length>2048)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!['inspect','extend'].includes(body?.action))return reply({error:'Invalid action'},400);
  const email=normalizeEmail(body.email);if(!/^[^\s@]{1,100}@[^\s@]{1,150}\.[^\s@]{2,50}$/.test(email))return reply({error:'יש להזין אימייל תקין.'},400);
  if(body.action==='extend'&&(!Number.isInteger(body.days)||body.days<1||body.days>365||!/^[-a-f0-9]{36}$/.test(body.requestId||'')))return reply({error:'יש לבחור 1–365 ימים ובקשה תקינה.'},400);
  const hash=digest(email),userKey=storageKey('auth:user:'+hash,env),userRaw=await run(['GET',userKey],{env}),user=userRaw?JSON.parse(userRaw):null;
  if(!user)return reply({error:'המשתמש צריך להירשם לאתר לפני מתן הארכה.'},404);
  if(!user.enabled)return reply({error:'החשבון חסום. הארכת ניסיון אינה פותחת חשבון חסום.'},409);
  const identity=digest('billing:'+hash);
  const result=await withBillingLock(identity,async()=>{
   const record=await readBilling(identity,{env,run}),time=now();
   if(body.action==='inspect')return reply({memberId:user.id,...entitlement(record,time),grants:(record?.trialGrants||[]).map(({at,days,until})=>({at,days,until}))});
   if(record?.trialGrants?.some(g=>g.requestId===body.requestId))return reply({duplicate:true,...entitlement(record,time)});
   if(record?.subscriptionId&&!['CANCELLED','EXPIRED'].includes(record.subscriptionStatus)||record?.createRequestId&&!record.subscriptionId)return reply({error:'יש לבטל או להסדיר קודם את החידוש ב־PayPal ולבצע בדיקת תשלום. ההארכה אינה מבטלת חיובים.'},409);
   if((record?.trialGrants||[]).length>=100)return reply({error:'הגעת למגבלת ההארכות לחשבון.'},409);
   const base=record||{trialStartedAt:time,trialEndsAt:time+14*DAY,paidUntil:0};
   const until=Math.max(time,base.trialEndsAt,base.complimentaryUntil||0,base.paidUntil||0)+body.days*DAY;
   const updated={...base,complimentaryUntil:until,trialGrants:[...(base.trialGrants||[]),{requestId:body.requestId,actorId:actor.id,at:time,days:body.days,until}]};
   const ok=await run(['EVAL',GRANT,'4',storageKey('auth:session:'+digest(cookieToken(request)),env),storageKey('auth:member:'+actor.id,env),userKey,recordKey(identity,env),actor.sessionRaw,actor.memberRaw,userRaw,record?JSON.stringify(record):'',JSON.stringify(updated),String(Date.now())],{env});
   if(ok!==1)return reply({error:'החשבון השתנה או שהכניסה פגה. רענן ונסה שוב.'},409);
   return reply({extended:true,...entitlement(updated,time)});
  },{env,run});return result;
 }catch{return reply({error:'לא ניתן לעדכן את הניסיון כרגע. נסה שוב עם אותה בקשה.'},503)}
};}
export default request=>createBillingAdminHandler()(request);
