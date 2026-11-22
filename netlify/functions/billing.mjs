import {resolvePromotion,publicPromotion} from '../../server/promotions.mjs';
import {NEW_TRIAL_CREDITS,PLANS,creditsEnabled,consentFor,creditCheckoutReady,CHECKOUT_PRICE_VERSION} from '../../server/plans.mjs';
import {creditStatus} from '../../server/credits.mjs';
import {currentUser} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {billingEnabled,billingReady,billingIdentity,startTrial,readBilling,saveBilling,entitlement,withBillingLock,syncSubscription,createSubscription,subscriptionMonthlyPrice} from '../../server/billing.mjs';
import {createPayPal} from '../../server/paypal.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createBillingHandler({env=process.env,run=command,now=()=>Date.now(),api=createPayPal({env})}={}){return async request=>{
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 const config={enabled:billingEnabled(env),ready:billingReady(env),pricingVersion:creditsEnabled(env)?2:1,checkoutPriceVersion:CHECKOUT_PRICE_VERSION,plans:Object.values(PLANS),trialTotalCredits:NEW_TRIAL_CREDITS,trialDays:7,monthlyPrice:creditsEnabled(env)?null:10,currency:'USD',sandbox:env.PAYPAL_ENVIRONMENT==='sandbox'};
 try{
  const user=await currentUser(request,{env,run});
  const accountTerms=record=>({subscriptionMonthlyPrice:subscriptionMonthlyPrice(record,env),subscriptionPlanId:record?.subscriptionId&&Object.hasOwn(PLANS,record.planId)?record.planId:null,priorCheckoutUnresolved:creditsEnabled(env)&&!!record&&!record.priceContract&&((!!record.createRequestId&&!record.subscriptionId)||(!!record.subscriptionId&&record.subscriptionStatus==='APPROVAL_PENDING'))});
  config.paymentPilot=creditsEnabled(env)&&env.ASAF_PUBLIC_PAID_LAUNCH!=='true';
  config.checkoutAllowed=!creditsEnabled(env)||creditCheckoutReady(env)&&(!config.paymentPilot||!!user&&(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').map(x=>x.trim()).includes(user.id));
  if(request.method==='GET'){
   const record=user?await readBilling(await billingIdentity(user.id,{env,run}),{env,run}):null;
   return reply({...config,authenticated:!!user,credits:user?await creditStatus(user.id,{env,run,now:now()}):null,...accountTerms(record),...entitlement(record,now())});
  }
  if(!user)return reply({error:'יש להיכנס לחשבון לפני ניהול המנוי.'},401);
  if(!config.ready)return reply({error:'ההרשמה למנוי תיפתח לאחר השלמת חיבור התשלום.'},503);
  if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
  const raw=await request.text();if(raw.length>1024)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!['start-trial','subscribe','sync','cancel','promo-quote'].includes(body?.action))return reply({error:'Invalid action'},400);
  const identity=await billingIdentity(user.id,{env,run});
  if(body.action==='start-trial'){const record=await startTrial(identity,{env,run,now:now()});return reply({...config,authenticated:true,...accountTerms(record),...entitlement(record,now())});}
  const allowed=await run(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=10 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('billing:requests:'+identity+':'+Math.floor(now()/60000),env)],{env});
  if(allowed!==1)return reply({error:'יותר מדי בקשות. נסה שוב בעוד דקה.'},429);
  return await withBillingLock(identity,async()=>{
   const active=await currentUser(request,{env,run});if(active?.id!==user.id)return reply({error:'הכניסה פגה. יש להיכנס שוב.'},401);
   let record=await readBilling(identity,{env,run});
   let promotion=null;
   if(['subscribe','promo-quote'].includes(body.action)){
    if(creditsEnabled(env)&&!creditCheckoutReady(env))return reply({error:'המסלולים החדשים בהכנה. רכישה תיפתח לאחר בדיקת התשלום ומכסות השימוש.'},403);
    try{promotion=resolvePromotion(body.promoCode,body.planId,{env,now:now()});}catch{return reply({error:'הקוד אינו זמין למסלול הזה. המחיר לא השתנה.',code:'promo_unavailable'},422);}
    if(body.action==='promo-quote')return promotion?reply({promotion:publicPromotion(promotion)}):reply({error:'יש להזין קוד הטבה.'},422);
   }
   if(body.action==='subscribe'){
    if(!config.checkoutAllowed)return reply({error:'התשלום החדש פתוח כרגע לבדיקת מנהל בלבד.'},403);
    if(creditsEnabled(env)&&!Object.hasOwn(PLANS,body.planId))return reply({error:'Invalid plan'},400);
    if(body.consent!==(promotion?.consent||(creditsEnabled(env)?consentFor(body.planId):'USD10_MONTHLY_V1')))return reply({error:'נדרש אישור לסכום המסלול ולחיוב החודשי.'},400);
    if(!record)record=await startTrial(identity,{env,run,now:now()});
    if(!creditsEnabled(env)&&entitlement(record,now()).access)return reply({error:'יש לממש קודם את תקופת הניסיון. לא נוצר חיוב.'},409);
    return reply(await createSubscription(identity,record,{env,run,api,now:now(),origin:new URL(request.url).origin,planId:body.planId,promotion}));
   }
   if(!record?.subscriptionId)return reply({...config,authenticated:true,...accountTerms(record),...entitlement(record,now())});
   record=await syncSubscription(identity,record,{env,run,api,now:now()});
   if(body.action==='cancel'&&['ACTIVE','SUSPENDED','APPROVED'].includes(record.subscriptionStatus)){
    await api('/v1/billing/subscriptions/'+record.subscriptionId+'/cancel',{method:'POST',body:{reason:'Customer cancelled renewal in ASAF Pro'}});
    record=await saveBilling(identity,{...record,subscriptionStatus:'CANCELLED',approvalUrl:null},{env,run});
   }
   return reply({...config,authenticated:true,...accountTerms(record),...entitlement(record,now())});
  },{env,run});
 }catch{return reply({error:'לא ניתן להשלים את פעולת המנוי כרגע. נסה שוב; אם כבר אישרת ב־PayPal, לחץ על בדיקת תשלום לפני ניסיון נוסף.'},503)}
};}
export default request=>createBillingHandler()(request);
