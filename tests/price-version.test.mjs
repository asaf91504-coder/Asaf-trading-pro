import test from 'node:test';
import assert from 'node:assert/strict';
import {PLANS,LEGACY_PLAN_PRICES,planEnv,creditCheckoutReady,usdCents,usdPriceText,consentFor} from '../server/plans.mjs';
import {billingIdentity,nextMonth,readBilling,saveBilling,syncSubscription} from '../server/billing.mjs';
import {createBillingHandler} from '../netlify/functions/billing.mjs';
import {validatePlan} from '../server/paypal.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
const day=86400000,now=Date.parse('2026-11-20T20:00:00Z');
const base={...authEnv,ASAF_BILLING_ENABLED:'true',ASAF_WEEKLY_CREDITS_ENABLED:'true',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'mock',PAYPAL_CLIENT_SECRET:'mock',PAYPAL_WEBHOOK_ID:'mock',PAYPAL_PLAN_ID:'P-LEGACYTEN',...Object.fromEntries(Object.keys(PLANS).map(id=>[planEnv(id),'P-V1'+id.toUpperCase()]))};
const allowed={...base,ASAF_WEEKLY_PRICE_V2_CHECKOUT:'true',...Object.fromEntries(Object.keys(PLANS).map(id=>[planEnv(id,2),'P-V2'+id.toUpperCase()]))};
const trial={trialStartedAt:now-8*day,trialEndsAt:now-day,trialTotalCredits:50,paidUntil:0};
const pp=(id,value)=>({id,status:'ACTIVE',payment_preferences:{auto_bill_outstanding:false,payment_failure_threshold:1},billing_cycles:[{tenure_type:'REGULAR',frequency:{interval_unit:'MONTH',interval_count:1},total_cycles:0,pricing_scheme:{fixed_price:{value,currency_code:'USD'}}}]});
const pay=(value,id='SALE1')=>({id,status:'COMPLETED',time:new Date(now).toISOString(),amount_with_breakdown:{gross_amount:{value,currency_code:'USD'}}});
const pendingLink='https://www.sandbox.paypal.com/approve';
const action=(planId='premium',consent=consentFor(planId))=>({action:'subscribe',planId,consent});
async function setup(){
 const f=fixture(),user=seed(f),identity=await billingIdentity(user.record.id,{env:base,run:f.run});
 return {...f,user,identity};
}
test('Premium checkout uses exact cents and rejects replayed consent and malformed PayPal values',()=>{
 const planId=allowed.PAYPAL_PLAN_PREMIUM_V2_ID;
 assert.equal(usdPriceText(PLANS.premium.price),'145');
 assert.equal(usdCents('145.00'),14500);
 assert.equal(usdCents('145.0'),14500);
 assert.equal(consentFor('premium'),'USD145_MONTHLY_WEEKLY_V2');
 validatePlan(pp(planId,'145.00'),planId,PLANS.premium.price);
 for(const amount of ['143.60','144.99','145.01','145.000','1.45e2',' 145.00','0145.00',null,true]) assert.throws(()=>validatePlan(pp(planId,amount),planId,PLANS.premium.price));
});
test('pricing can go live while checkout stays blocked even for an admin and trial still starts',async()=>{
 const f=await setup();
 let calls=0;const api=async()=>{calls++;throw Error('no requests allowed')};
 const env={...base,ASAF_ADMIN_MEMBER_IDS:f.user.record.id};
 const handler=createBillingHandler({env,run:f.run,now:()=>now,api});
 const publicStatus=await (await handler(request('billing',null))).json();
 assert.equal(publicStatus.ready,true);assert.equal(publicStatus.checkoutAllowed,false);
 assert.equal(publicStatus.trialTotalCredits,50);assert.equal(publicStatus.trialDays,7);
 assert.equal(publicStatus.plans.some(p=>p.paypalPlanId),false);
 assert.equal((await handler(request('billing',action(),f.user.cookie))).status,403);
 assert.equal((await handler(request('billing',{action:'start-trial'},f.user.cookie))).status,200);
 assert.equal((await readBilling(f.identity,{env,run:f.run})).trialTotalCredits,50);assert.equal(calls,0);
 assert.equal(creditCheckoutReady(allowed),true);
 for(const env of [{...allowed,ASAF_WEEKLY_PRICE_V2_CHECKOUT:'false'},{...allowed,PAYPAL_PLAN_PREMIUM_V2_ID:undefined},{...allowed,PAYPAL_PLAN_PREMIUM_V2_ID:allowed.PAYPAL_PLAN_PRO_V2_ID},{...allowed,PAYPAL_PLAN_PREMIUM_V2_ID:allowed.PAYPAL_PLAN_PREMIUM_ID},{...allowed,PAYPAL_PLAN_PREMIUM_V2_ID:allowed.PAYPAL_PLAN_ID}])assert.equal(creditCheckoutReady(env),false);
});
test('new checkout pins V2 ID and cents before POST, then syncs even if checkout settings subsequently change',async()=>{
 const f=await setup(),env={...allowed,ASAF_ADMIN_MEMBER_IDS:f.user.record.id},ppid=env.PAYPAL_PLAN_PREMIUM_V2_ID;
 await saveBilling(f.identity,trial,{env,run:f.run});
 let calls=0;
 const api=async(path,opts)=>{
  calls++;
  if(path==='/v1/billing/plans/'+ppid)return pp(ppid,'145.00');
  assert.equal(path,'/v1/billing/subscriptions');assert.equal(opts.method,'POST');assert.equal(opts.body.plan_id,ppid);
  assert.deepEqual((await readBilling(f.identity,{env,run:f.run})).priceContract,{version:2,paypalPlanId:ppid,monthlyPriceCents:14500});
  return {id:'I-PREMIUMV2',status:'APPROVAL_PENDING',links:[{rel:'approve',href:pendingLink}]};
 };
 const handler=createBillingHandler({env,run:f.run,now:()=>now,api});
 assert.equal((await handler(request('billing',action('premium','USD359_MONTHLY_WEEKLY_V1'),f.user.cookie))).status,400);
 assert.equal((await handler(request('billing',action('premium','USD143.60_MONTHLY_WEEKLY_V2'),f.user.cookie))).status,400);
 assert.equal(calls,0);
 const res=await handler(request('billing',{...action(),price:1,priceContract:{monthlyPriceCents:100}},f.user.cookie));
 assert.equal(res.status,200);assert.equal((await res.json()).approvalUrl,pendingLink);
 const record=await readBilling(f.identity,{env,run:f.run});
 const updated=await syncSubscription(f.identity,record,{
  env:{...base,PAYPAL_PLAN_PREMIUM_V2_ID:'P-UNRELATED'},run:f.run,now,
  api:async path=>path.includes('/transactions?')?{transactions:[pay('143.60','WRONG'),pay('145.00')]}:{id:'I-PREMIUMV2',plan_id:ppid,custom_id:f.identity,status:'ACTIVE'}
 });
 assert.equal(updated.paidUntil,nextMonth(now));assert.equal(updated.creditAnchor,now);
});
test('legacy tiers and saved promotions use historical prices during sync; cancel and access work while V2 stays off',async()=>{
 const f=await setup(),options={env:base,run:f.run,now};
 for(const [planId,price] of Object.entries(LEGACY_PLAN_PRICES)){
  const oldId=base[planEnv(planId)],record={...trial,planId,subscriptionId:'I-HISTORICAL',subscriptionStatus:'ACTIVE'};
  const mock=async path=>path.includes('/transactions?')?{transactions:[pay(String(price))]}:{id:record.subscriptionId,plan_id:oldId,custom_id:f.identity,status:'ACTIVE'};
  const synced=await syncSubscription(f.identity,record,{...options,api:mock});
  assert.equal(synced.paidUntil,nextMonth(now));assert.equal(synced.creditAnchor,now);
 }
 await saveBilling(f.identity,{...trial,planId:'starter',subscriptionId:'I-OLDPROMO',subscriptionStatus:'ACTIVE',promotion:{paypalPlanId:'P-OLDPROMO',monthlyPrice:44}},{env:base,run:f.run});
 let cancel=0;
 const handler=createBillingHandler({...options,now:()=>now,api:async(path,opts)=>{
  if(path.endsWith('/cancel')){cancel++;assert.equal(opts.method,'POST');return {}}
  return path.includes('/transactions?')?{transactions:[pay('44.00')]}:{id:'I-OLDPROMO',plan_id:'P-OLDPROMO',custom_id:f.identity,status:'ACTIVE'};
 }});
 const result=await handler(request('billing',{action:'cancel'},f.user.cookie));assert.equal(result.status,200);
 const body=await result.json();assert.equal(body.status,'paid');assert.equal(body.paidUntil,nextMonth(now));assert.equal(body.subscriptionMonthlyPrice,44);assert.equal(body.subscriptionStatus,'CANCELLED');assert.equal(cancel,1);
});
test('old pending or ambiguous checkout never returns an old link or starts another subscription under V2 consent',async()=>{
 const f=await setup(),env={...allowed,ASAF_ADMIN_MEMBER_IDS:f.user.record.id};let writes=0;
 const api=async(path,opts)=>{
  if(opts?.method==='POST'){writes++;throw Error('no create')}
  return path.includes('/transactions?')?{transactions:[]}:{id:'I-OLDPENDING',plan_id:env.PAYPAL_PLAN_PREMIUM_ID,custom_id:f.identity,status:'APPROVAL_PENDING',links:[{rel:'approve',href:pendingLink}]};
 };
 const handler=createBillingHandler({env,run:f.run,now:()=>now,api});
 for(const record of [{...trial,planId:'premium',subscriptionId:'I-OLDPENDING',subscriptionStatus:'APPROVAL_PENDING',approvalUrl:pendingLink},{...trial,planId:'premium',createRequestId:'old-key',createStartedAt:now-day}]){
  await saveBilling(f.identity,record,{env,run:f.run});
  const state=await (await handler(request('billing',null,f.user.cookie))).json();assert.equal(state.priorCheckoutUnresolved,true);
  const res=await handler(request('billing',action(),f.user.cookie));assert.equal(res.status,503);
  assert.equal((await res.json()).approvalUrl,undefined);
 }
 assert.equal(writes,0);
});

test('legacy USD10 consent cannot reopen a pending weekly approval when the weekly flag changes',async()=>{
 const f=await setup(),env={...base,ASAF_WEEKLY_CREDITS_ENABLED:'false'},options={env,run:f.run};
 const handler=createBillingHandler({...options,now:()=>now,api:async(path,opts)=>{
  assert.notEqual(opts?.method,'POST');
  return path.includes('/transactions?')?{transactions:[]}:{id:'I-WEEKLY',plan_id:base.PAYPAL_PLAN_PREMIUM_ID,custom_id:f.identity,status:'APPROVAL_PENDING',links:[{rel:'approve',href:pendingLink}]};
 }});
 await saveBilling(f.identity,{...trial,planId:'premium',subscriptionId:'I-WEEKLY',subscriptionStatus:'APPROVAL_PENDING',approvalUrl:pendingLink},options);
 const response=await handler(request('billing',{action:'subscribe',consent:'USD10_MONTHLY_V1'},f.user.cookie));
 assert.equal(response.status,503);assert.equal((await response.json()).approvalUrl,undefined);
});
