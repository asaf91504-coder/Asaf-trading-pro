import {isChatOwner} from './owner-chat.mjs';
import {NEW_TRIAL_CREDITS,creditsEnabled,planFor,planEnv,LEGACY_PLAN_PRICES,CHECKOUT_PRICE_VERSION,creditCheckoutReady,usdCents} from './plans.mjs';
import {randomUUID} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
import {digest,publicAuthConfigured} from './auth-core.mjs';
import {paypalConfigured,createPayPal,validatePlan,approvalLink} from './paypal.mjs';
export const DAY=86400000,TRIAL_DAYS=7,PRICE_USD=10;
export const billingEnabled=(env=process.env)=>env.ASAF_BILLING_ENABLED==='true';
export const billingReady=(env=process.env)=>billingEnabled(env)&&publicAuthConfigured(env)&&paypalConfigured(env);
const parse=raw=>raw?JSON.parse(raw):null;
export async function billingIdentity(memberId,{env=process.env,run=command}={}){
 const hash=await run(['GET',storageKey('auth:index:'+memberId,env)],{env});
 if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error('Account identity unavailable');
 // Survives logout and account recreation without storing a plaintext email.
 return digest('billing:'+hash);
}
export const recordKey=(identity,env)=>storageKey('billing:account:'+identity,env);
export async function readBilling(identity,{env=process.env,run=command}={}){
 return parse(await run(['GET',recordKey(identity,env)],{env}));
}
export async function saveBilling(identity,record,{env=process.env,run=command}={}){
 await run(['SET',recordKey(identity,env),JSON.stringify(record)],{env});return record;
}
export async function startTrial(identity,{env=process.env,run=command,now=Date.now()}={}){
 if(!billingReady(env))throw Error('Subscriptions are not open');
 await run(['SET',recordKey(identity,env),JSON.stringify({trialStartedAt:now,trialEndsAt:now+TRIAL_DAYS*DAY,trialTotalCredits:NEW_TRIAL_CREDITS,paidUntil:0}),'NX'],{env});
 const record=await readBilling(identity,{env,run});
 if(!Number.isFinite(record?.trialStartedAt)||![7,14].some(days=>record.trialEndsAt===record.trialStartedAt+days*DAY))throw Error('Invalid trial record');
 return record;
}
export function entitlement(record,now=Date.now()){
 const validTrial=Number.isFinite(record?.trialStartedAt)&&[7,14].some(days=>record.trialEndsAt===record.trialStartedAt+days*DAY);
 const trialEndsAt=Math.max(validTrial?record.trialEndsAt:0,Number.isFinite(record?.complimentaryUntil)?record.complimentaryUntil:0);
 const trial=validTrial&&record.trialStartedAt<=now&&now<trialEndsAt;
 const paid=Number.isFinite(record?.paidUntil)&&record.paidUntil>now;
 return {access:trial||paid,status:paid?'paid':trial?'trial':record?'expired':'not_started',trialEndsAt:trialEndsAt||null,paidUntil:record?.paidUntil||null,daysRemaining:trial?Math.ceil((trialEndsAt-now)/DAY):0,subscriptionStatus:record?.subscriptionStatus||null,canCancel:['ACTIVE','SUSPENDED','APPROVED'].includes(record?.subscriptionStatus)};
}
export async function subscriptionGuard(user,{env=process.env,run=command,now=Date.now()}={}){
 if(isChatOwner(user,env))return null;
 if(!billingEnabled(env))return null;
 if(!billingReady(env))return Response.json({error:'שירות המנויים אינו זמין כרגע. נסה שוב.',code:'billing_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{
  const identity=await billingIdentity(user.id,{env,run}),record=await startTrial(identity,{env,run,now});
  if(entitlement(record,now).access)return null;
  return Response.json({error:'תקופת הניסיון הסתיימה. להמשך השימוש יש לבחור מסלול בעמוד המנוי.',code:'subscription_required',subscriptionUrl:'/subscription.html'},{status:402,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'לא ניתן לבדוק את המנוי כרגע. נסה שוב.',code:'billing_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
// Access to the commercial market scanner must never start a trial or
// inherit the general guard's bypass when billing is disabled.
export async function paidSubscriptionGuard(user,{env=process.env,run=command,now=Date.now()}={}){
 const reply=(error,code,status)=>Response.json({enabled:false,error,code},{status,headers:{'Cache-Control':'no-store'}});
 if(!user?.id)return reply('יש להיכנס לחשבון.','authentication_required',401);
 if(isChatOwner(user,env))return null;
 if(!billingEnabled(env))return reply('שירות המנויים אינו זמין כרגע.','billing_unavailable',503);
 try{
  const identity=await billingIdentity(user.id,{env,run}),record=await readBilling(identity,{env,run});
  if(entitlement(record,now).status==='paid')return null;
  return reply('סריקת מניות זמינה למנויים משלמים בלבד.','paid_subscription_required',402);
 }catch{return reply('לא ניתן לבדוק את המנוי כרגע. נסה שוב.','billing_unavailable',503)}
}
const RELEASE="if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";
export async function withBillingLock(identity,fn,{env=process.env,run=command}={}){
 const key=storageKey('billing:lock:'+identity,env),token=randomUUID();
 if(await run(['SET',key,token,'NX','EX','120'],{env})!=='OK')throw Error('A billing operation is already in progress');
 try{return await fn()}finally{await run(['EVAL',RELEASE,'1',key,token],{env})}
}
export function nextMonth(time){
 const d=new Date(time),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.getTime();
}
// Old records did not store a contract. Derive only from the original plan IDs
// and prices (or the saved promotion), never the current public catalog.
function recordedTerms(record,env){
 if(record?.priceContract!==undefined){
  const contract=record.priceContract;
  if(!contract||contract.version!==CHECKOUT_PRICE_VERSION||!Object.hasOwn(LEGACY_PLAN_PRICES,record.planId)||!/^P-[A-Z0-9]+$/.test(contract.paypalPlanId||'')||!Number.isSafeInteger(contract.monthlyPriceCents)||contract.monthlyPriceCents<=0)throw Error('Invalid recorded payment terms');
  return contract;
 }
 const paypalPlanId=record?.promotion?.paypalPlanId||(record?.planId?env[planEnv(record.planId)]:env.PAYPAL_PLAN_ID);
 const monthlyPriceCents=usdCents(record?.promotion?.monthlyPrice??(record?.planId?LEGACY_PLAN_PRICES[record.planId]:PRICE_USD));
 if(!/^P-[A-Z0-9]+$/.test(paypalPlanId||'')||monthlyPriceCents===null||monthlyPriceCents<=0)throw Error('Missing historical payment terms');
 return {version:1,paypalPlanId,monthlyPriceCents};
}
export function subscriptionMonthlyPrice(record,env){
 if(!record?.subscriptionId)return null;
 try{return recordedTerms(record,env).monthlyPriceCents/100}catch{return null}
}
const sameContract=(saved,terms)=>saved?.version===terms?.version&&saved?.paypalPlanId===terms?.paypalPlanId&&saved?.monthlyPriceCents===terms?.monthlyPriceCents;
const validPayment=(t,revoked,now,priceCents)=>priceCents!==null&&t.status==='COMPLETED'&&!revoked.includes(t.id)&&t.amount_with_breakdown?.gross_amount?.currency_code==='USD'&&usdCents(t.amount_with_breakdown.gross_amount.value)===priceCents&&Date.parse(t.time)<=now;
export function paidThrough(transactions,subscription,revoked=[],now=Date.now(),price=PRICE_USD){
 const payments=transactions.filter(t=>validPayment(t,revoked,now,usdCents(price)));
 const latest=payments.sort((a,b)=>Date.parse(b.time)-Date.parse(a.time))[0];if(!latest)return 0;
 const time=Date.parse(latest.time),next=Date.parse(subscription.billing_info?.next_billing_time);
 return Number.isFinite(next)&&next>time&&next<=time+32*DAY?next:nextMonth(time);
}
// Must run under the account billing lock. Refresh authoritative data even for
// old/duplicate webhooks, so event ordering cannot resurrect cancelled access.
export async function syncSubscription(identity,record,{env=process.env,run=command,api=createPayPal({env}),now=Date.now()}={}){
 if(!record?.subscriptionId)return record;
 const id=record.subscriptionId;
 if(!/^I-[A-Z0-9]+$/.test(id))throw Error('Invalid subscription');
 const terms=recordedTerms(record,env);
 const sub=await api('/v1/billing/subscriptions/'+id);
 if(sub.id!==id||sub.custom_id!==identity||sub.plan_id!==terms.paypalPlanId||sub.plan_overridden===true||Number(sub.quantity||1)!==1||Number(sub.shipping_amount?.value||0)!==0)throw Error('Subscription does not match account and plan');
 const query=new URLSearchParams({start_time:new Date(now-62*DAY).toISOString(),end_time:new Date(now).toISOString()});
 const history=await api('/v1/billing/subscriptions/'+id+'/transactions?'+query);
 if(!Array.isArray(history.transactions)||Number(history.total_pages||1)>1)throw Error('Incomplete payment history');
 const valid=history.transactions.filter(t=>validPayment(t,record.revokedTransactionIds||[],now,terms.monthlyPriceCents));
 const first=valid.length?Math.min(...valid.map(t=>Date.parse(t.time))):null;
 const anchor=record.creditAnchor??first;
 const updated={...record,...(record.planId&&anchor!==null?{creditAnchor:anchor,bonusUntil:record.bonusUntil??nextMonth(anchor)}:{}),subscriptionStatus:sub.status,paidUntil:paidThrough(history.transactions,sub,record.revokedTransactionIds,now,terms.monthlyPriceCents/100),verifiedAt:now,approvalUrl:approvalLink(sub,env)};
 return saveBilling(identity,updated,{env,run});
}
export async function createSubscription(identity,record,{env=process.env,run=command,api=createPayPal({env}),now=Date.now(),origin,planId,promotion=null}={}){
 if(!record||(!creditsEnabled(env)&&(now<record.trialEndsAt||entitlement(record,now).access))||entitlement(record,now).status==='paid')throw Error('The free trial or paid period is still active');
 const chosen=creditsEnabled(env)?planFor(planId):null;
 if(chosen&&!creditCheckoutReady(env))throw Error('New checkout is not yet available');
 const paypalPlanId=promotion?.paypalPlanId||(chosen?env[planEnv(chosen.id,CHECKOUT_PRICE_VERSION)]:env.PAYPAL_PLAN_ID);
 const price=promotion?.monthlyPrice??chosen?.price??PRICE_USD;
 const contract=chosen?{version:CHECKOUT_PRICE_VERSION,paypalPlanId,monthlyPriceCents:usdCents(price)}:undefined;
 if(chosen&&(!contract.monthlyPriceCents||promotion&&[env.PAYPAL_PLAN_ID,...Object.keys(LEGACY_PLAN_PRICES).flatMap(id=>[env[planEnv(id)],env[planEnv(id,CHECKOUT_PRICE_VERSION)]])].includes(paypalPlanId)))throw Error('Invalid new payment terms');
 if((record.createRequestId&&!record.subscriptionId)||(record.subscriptionId&&!['CANCELLED','EXPIRED'].includes(record.subscriptionStatus))){
  if((record.promotion?.consent||null)!==(promotion?.consent||null))throw Error('Resolve existing checkout before changing promotion');
 }
 if(record.subscriptionId){
  if(creditsEnabled(env)&&record.planId!==planId&&!['CANCELLED','EXPIRED'].includes(record.subscriptionStatus))throw Error('Resolve the existing checkout before selecting another plan');
  record=await syncSubscription(identity,record,{env,run,api,now});
  if(record.subscriptionStatus==='APPROVAL_PENDING'&&record.approvalUrl){
   if(chosen){
    if(!sameContract(record.priceContract,contract))throw Error('Resolve an earlier checkout before starting a new one');
    validatePlan(await api('/v1/billing/plans/'+paypalPlanId),paypalPlanId,price);
   }else if(record.planId||record.priceContract)throw Error('Resolve an earlier checkout before starting a new one');
   return {approvalUrl:record.approvalUrl};
  }
  if(!['CANCELLED','EXPIRED'].includes(record.subscriptionStatus))throw Error('Manage your existing subscription before creating another');
  if(entitlement(record,now).access)throw Error('Your paid period is still active');
 }
 if(record.createRequestId&&!record.subscriptionId&&(record.planId!==chosen?.id||chosen&&!sameContract(record.priceContract,contract)))throw Error('Unresolved checkout at different terms');
 validatePlan(await api('/v1/billing/plans/'+paypalPlanId),paypalPlanId,price);
 const attempt=record.createRequestId&&!record.subscriptionId?record.createRequestId:randomUUID();
 if(record.createRequestId&&!record.subscriptionId&&now-record.createStartedAt>70*3600000)throw Error('Unresolved checkout: contact support before retrying');
 record={...record,promotion,planId:chosen?.id,priceContract:contract,createRequestId:attempt,createStartedAt:record.subscriptionId?now:(record.createStartedAt||now),subscriptionId:null,subscriptionStatus:null,approvalUrl:null};
 await saveBilling(identity,record,{env,run});
 const sub=await api('/v1/billing/subscriptions',{method:'POST',requestId:attempt,body:{plan_id:paypalPlanId,custom_id:identity,application_context:{brand_name:'ASAF Pro',shipping_preference:'NO_SHIPPING',user_action:'SUBSCRIBE_NOW',return_url:origin+'/subscription.html?paypal=return',cancel_url:origin+'/subscription.html?paypal=cancel'}}});
 if(!/^I-[A-Z0-9]+$/.test(sub.id||''))throw Error('Invalid PayPal subscription');
 const url=approvalLink(sub,env);if(!url)throw Error('PayPal approval unavailable');
 await run(['SET',storageKey('billing:subscription:'+sub.id,env),identity],{env});
 await saveBilling(identity,{...record,subscriptionId:sub.id,subscriptionStatus:sub.status,approvalUrl:url,revokedTransactionIds:[]},{env,run});
 return {approvalUrl:url};
}
