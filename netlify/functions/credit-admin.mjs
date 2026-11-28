import {currentUser,cookieToken,digest,normalizeEmail} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {isChatOwner} from '../../server/owner-chat.mjs';
import {DAY,entitlement,recordKey,readBilling,withBillingLock} from '../../server/billing.mjs';
import {bonusUsedKey,bonusCreditTotal,creditStatus} from '../../server/credits.mjs';
import {NEW_TRIAL_CREDITS} from '../../server/plans.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const GRANT=`-- owner-credit-grant
for i=1,5 do if (redis.call('GET',KEYS[i]) or '')~=ARGV[i] then return 0 end end
local clock=redis.call('TIME');if cjson.decode(ARGV[1]).expires<=tonumber(clock[1])*1000+tonumber(clock[2])/1000 then return 0 end
redis.call('SET',KEYS[5],ARGV[6]);return 1`;
export function createCreditAdminHandler({env=process.env,run=command,now=()=>Date.now()}={}){return async request=>{
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 try{
  const actor=await currentUser(request,{env,run,includeRecords:true});
  if(!actor)return reply({error:'יש להיכנס לחשבון.'},401);
  if(!isChatOwner(actor,env))return reply({error:'נדרשת הרשאת בעלים.'},403);
  if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
  const raw=await request.text();if(raw.length>2048)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!['inspect','grant'].includes(body?.action))return reply({error:'Invalid action'},400);
  const email=normalizeEmail(body.email);if(!/^[^\s@]{1,100}@[^\s@]{1,150}\.[^\s@]{2,50}$/.test(email))return reply({error:'יש להזין אימייל תקין.'},400);
  if(body.action==='grant'&&(!Number.isSafeInteger(body.credits)||body.credits<1||body.credits>100000||!/^[-a-f0-9]{36}$/.test(body.requestId||'')))return reply({error:'יש להזין 1–100,000 קרדיטים ובקשה תקינה.'},400);
  const hash=digest(email),userKey=storageKey('auth:user:'+hash,env),userRaw=await run(['GET',userKey],{env}),user=userRaw?JSON.parse(userRaw):null;
  if(!user)return reply({error:'המשתמש צריך להירשם לאתר תחילה.'},404);
  const memberKey=storageKey('auth:member:'+user.id,env),memberRaw=await run(['GET',memberKey],{env}),member=memberRaw?JSON.parse(memberRaw):null;
  if(user.enabled!==true||member?.enabled!==true||member.version!==user.version)return reply({error:'החשבון חסום או השתנה. הקרדיטים אינם פותחים חשבון חסום.'},409);
  const identity=digest('billing:'+hash);
  return await withBillingLock(identity,async()=>{
   const record=await readBilling(identity,{env,run}),time=now(),total=bonusCreditTotal(record);
   const summary=async(updated,extra={})=>{
    const used=Number(await run(['GET',bonusUsedKey(identity,env)],{env})||0),giftTotal=bonusCreditTotal(updated);
    if(!Number.isSafeInteger(used)||used<0||used>giftTotal)throw Error('Invalid gift balance');
    return reply({...extra,memberId:user.id,...entitlement(updated,time),...(isChatOwner(user,env)?{ownerUnlimited:true,access:true,status:'owner'}:{ownerUnlimited:false}),bonusRemaining:giftTotal-used,credits:await creditStatus(user.id,{env,run,now:time})});
   };
   if(body.action==='inspect')return summary(record);
   if(isChatOwner(user,env))return reply({error:'לחשבון הבעלים כבר יש קרדיטים ללא הגבלה.'},409);
   const prior=record?.creditGrants?.find(g=>g.requestId===body.requestId);
   if(prior)return prior.credits===body.credits?summary(record,{duplicate:true}):reply({error:'מזהה הבקשה כבר שימש לכמות אחרת.'},409);
   if((record?.creditGrants||[]).length>=1000||total+body.credits>1000000000)return reply({error:'הגעת למגבלת ההענקות לחשבון.'},409);
   const base=record||{trialStartedAt:time,trialEndsAt:time+7*DAY,trialTotalCredits:NEW_TRIAL_CREDITS,paidUntil:0};
   const updated={...base,bonusCredits:total+body.credits,creditGrants:[...(base.creditGrants||[]),{requestId:body.requestId,actorId:actor.id,at:time,credits:body.credits}]};
   const ok=await run(['EVAL',GRANT,'5',storageKey('auth:session:'+digest(cookieToken(request)),env),storageKey('auth:member:'+actor.id,env),userKey,memberKey,recordKey(identity,env),actor.sessionRaw,actor.memberRaw,userRaw,memberRaw,record?JSON.stringify(record):'',JSON.stringify(updated)],{env});
   if(ok!==1)return reply({error:'החשבון השתנה או שהכניסה פגה. רענן ונסה שוב.'},409);
   return summary(updated,{granted:body.credits});
  },{env,run});
 }catch{return reply({error:'לא ניתן להשלים את הפעולה כרגע. נסה שוב עם אותה בקשה.'},503)}
};}
export default request=>createCreditAdminHandler()(request);
