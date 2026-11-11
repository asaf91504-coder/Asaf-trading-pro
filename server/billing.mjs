import {randomUUID} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
import {digest,publicAuthConfigured} from './auth-core.mjs';
import {paypalConfigured,createPayPal,validatePlan,approvalLink} from './paypal.mjs';
export const DAY=86400000,TRIAL_DAYS=14,PRICE_USD=10;
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
 await run(['SET',recordKey(identity,env),JSON.stringify({trialStartedAt:now,trialEndsAt:now+TRIAL_DAYS*DAY,paidUntil:0}),'NX'],{env});
 const record=await readBilling(identity,{env,run});
 if(!Number.isFinite(record?.trialStartedAt)||record.trialEndsAt!==record.trialStartedAt+TRIAL_DAYS*DAY)throw Error('Invalid trial record');
 return record;
}
export function entitlement(record,now=Date.now()){
 const trial=Number.isFinite(record?.trialStartedAt)&&record.trialEndsAt===record.trialStartedAt+TRIAL_DAYS*DAY&&record.trialStartedAt<=now&&now<record.trialEndsAt;
 const paid=Number.isFinite(record?.paidUntil)&&record.paidUntil>now;
 return {access:trial||paid,status:paid?'paid':trial?'trial':record?'expired':'not_started',trialEndsAt:record?.trialEndsAt||null,paidUntil:record?.paidUntil||null,daysRemaining:trial?Math.ceil((record.trialEndsAt-now)/DAY):0,subscriptionStatus:record?.subscriptionStatus||null,canCancel:['ACTIVE','SUSPENDED','APPROVED'].includes(record?.subscriptionStatus)};
}
export async function subscriptionGuard(user,{env=process.env,run=command,now=Date.now()}={}){
 if(!billingEnabled(env))return null;
 if(!billingReady(env))return Response.json({error:'שירות המנויים אינו זמין כרגע. נסה שוב.',code:'billing_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{
  const identity=await billingIdentity(user.id,{env,run}),record=await startTrial(identity,{env,run,now});
  if(entitlement(record,now).access)return null;
  return Response.json({error:'תקופת הניסיון הסתיימה. להמשך השימוש יש להפעיל מנוי ב־10 דולר לחודש.',code:'subscription_required',subscriptionUrl:'/subscription.html'},{status:402,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'לא ניתן לבדוק את המנוי כרגע. נסה שוב.',code:'billing_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
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
export function paidThrough(transactions,subscription,revoked=[],now=Date.now()){
 const payments=transactions.filter(t=>t.status==='COMPLETED'&&!revoked.includes(t.id)&&t.amount_with_breakdown?.gross_amount?.currency_code==='USD'&&Number(t.amount_with_breakdown.gross_amount.value)===PRICE_USD&&Date.parse(t.time)<=now);
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
 const sub=await api('/v1/billing/subscriptions/'+id);
 if(sub.id!==id||sub.custom_id!==identity||sub.plan_id!==env.PAYPAL_PLAN_ID||sub.plan_overridden===true||Number(sub.quantity||1)!==1||Number(sub.shipping_amount?.value||0)!==0)throw Error('Subscription does not match account and plan');
 const query=new URLSearchParams({start_time:new Date(now-62*DAY).toISOString(),end_time:new Date(now).toISOString()});
 const history=await api('/v1/billing/subscriptions/'+id+'/transactions?'+query);
 if(!Array.isArray(history.transactions)||Number(history.total_pages||1)>1)throw Error('Incomplete payment history');
 const updated={...record,subscriptionStatus:sub.status,paidUntil:paidThrough(history.transactions,sub,record.revokedTransactionIds,now),verifiedAt:now,approvalUrl:approvalLink(sub,env)};
 return saveBilling(identity,updated,{env,run});
}
export async function createSubscription(identity,record,{env=process.env,run=command,api=createPayPal({env}),now=Date.now(),origin}={}){
 if(!record||now<record.trialEndsAt||entitlement(record,now).access)throw Error('The free trial or paid period is still active');
 if(record.subscriptionId){
  record=await syncSubscription(identity,record,{env,run,api,now});
  if(record.subscriptionStatus==='APPROVAL_PENDING'&&record.approvalUrl)return {approvalUrl:record.approvalUrl};
  if(!['CANCELLED','EXPIRED'].includes(record.subscriptionStatus))throw Error('Manage your existing subscription before creating another');
  if(entitlement(record,now).access)throw Error('Your paid period is still active');
 }
 validatePlan(await api('/v1/billing/plans/'+env.PAYPAL_PLAN_ID),env.PAYPAL_PLAN_ID);
 const attempt=record.createRequestId&&!record.subscriptionId?record.createRequestId:randomUUID();
 if(record.createRequestId&&!record.subscriptionId&&now-record.createStartedAt>70*3600000)throw Error('Unresolved checkout: contact support before retrying');
 record={...record,createRequestId:attempt,createStartedAt:record.subscriptionId?now:(record.createStartedAt||now),subscriptionId:null,subscriptionStatus:null,approvalUrl:null};
 await saveBilling(identity,record,{env,run});
 const sub=await api('/v1/billing/subscriptions',{method:'POST',requestId:attempt,body:{plan_id:env.PAYPAL_PLAN_ID,custom_id:identity,application_context:{brand_name:'ASAF Pro',shipping_preference:'NO_SHIPPING',user_action:'SUBSCRIBE_NOW',return_url:origin+'/subscription.html?paypal=return',cancel_url:origin+'/subscription.html?paypal=cancel'}}});
 if(!/^I-[A-Z0-9]+$/.test(sub.id||''))throw Error('Invalid PayPal subscription');
 const url=approvalLink(sub,env);if(!url)throw Error('PayPal approval unavailable');
 await run(['SET',storageKey('billing:subscription:'+sub.id,env),identity],{env});
 await saveBilling(identity,{...record,subscriptionId:sub.id,subscriptionStatus:sub.status,approvalUrl:url,revokedTransactionIds:[]},{env,run});
 return {approvalUrl:url};
}
