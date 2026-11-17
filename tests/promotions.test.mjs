import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePromotion,publicPromotion} from '../server/promotions.mjs';
import {PLANS,consentFor,creditWindow,WEEK} from '../server/plans.mjs';
import {billingIdentity,readBilling,syncSubscription,entitlement,nextMonth} from '../server/billing.mjs';
import {createBillingHandler} from '../netlify/functions/billing.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
const now=Date.parse('2026-11-17T10:00:00Z');
const promotion={code:'FRIENDS',planId:'starter',monthlyPrice:44,paypalPlanId:'P-DISCOUNT',enabled:true,startsAt:'2026-11-01T00:00:00Z',expiresAt:'2026-12-01T00:00:00Z'};
const env={...authEnv,ASAF_PUBLIC_PAID_LAUNCH:'true',ASAF_WEEKLY_CREDITS_ENABLED:'true',ASAF_BILLING_ENABLED:'true',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'mock',PAYPAL_CLIENT_SECRET:'mock',PAYPAL_WEBHOOK_ID:'mock',ASAF_PROMOTIONS_JSON:JSON.stringify([promotion]),...Object.fromEntries(Object.keys(PLANS).map(id=>['PAYPAL_PLAN_'+id.toUpperCase()+'_ID','P-'+id.toUpperCase()]))};
const resolve=(code='friends',e=env)=>resolvePromotion(code,'starter',{env:e,now});
test('promos are server-owned, bounded, time-limited, plan-specific and recurring',()=>{
 const p=resolve();assert.equal(p.monthlyPrice,44);assert.equal(publicPromotion(p).recurring,true);assert.equal(publicPromotion(p).paypalPlanId,undefined);
 assert.equal(resolvePromotion('',undefined),null);
 for(const patch of [{enabled:false},{monthlyPrice:0},{monthlyPrice:55},{monthlyPrice:44.001},{expiresAt:'invalid'},{expiresAt:'2026-11-16'},{startsAt:'2026-11-18'},{paypalPlanId:'bad'},{planId:'plus'}])assert.throws(()=>resolve('FRIENDS',{...env,ASAF_PROMOTIONS_JSON:JSON.stringify([{...promotion,...patch}])}));
 for(const code of [123,{},'UNKNOWN','<script>'])assert.throws(()=>resolve(code));
 assert.throws(()=>resolve('FRIENDS',{...env,ASAF_PROMOTIONS_JSON:'[]'}));
 assert.notEqual(resolve().consent,resolve('FRIENDS',{...env,ASAF_PROMOTIONS_JSON:JSON.stringify([{...promotion,monthlyPrice:43}])}).consent);
});
test('discount checkout requires exact consent and verified PayPal price; sync honors stored discount after code expires',async()=>{
 const f=fixture(),user=seed(f),identity=await billingIdentity(user.record.id,{env,run:f.run});const calls=[];
 let price=44;
 const api=async(path,opt)=>{calls.push({path,opt});if(path.includes('/plans/'))return {id:'P-DISCOUNT',status:'ACTIVE',payment_preferences:{auto_bill_outstanding:false,payment_failure_threshold:1},billing_cycles:[{tenure_type:'REGULAR',frequency:{interval_unit:'MONTH',interval_count:1},total_cycles:0,pricing_scheme:{fixed_price:{value:String(price),currency_code:'USD'}}}]};if(opt?.method==='POST')return {id:'I-DISCOUNT',status:'APPROVAL_PENDING',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/checkout'}]};if(path.includes('/transactions?'))return {transactions:[{id:'SALE',status:'COMPLETED',time:new Date(now).toISOString(),amount_with_breakdown:{gross_amount:{value:'44',currency_code:'USD'}}}],total_pages:1};return {id:'I-DISCOUNT',custom_id:identity,plan_id:'P-DISCOUNT',status:'ACTIVE',billing_info:{next_billing_time:new Date(nextMonth(now)).toISOString()}};};
 const handler=createBillingHandler({env,run:f.run,now:()=>now,api});
 const quote=await (await handler(request('billing',{action:'promo-quote',planId:'starter',promoCode:'FRIENDS'},user.cookie))).json();assert.equal(quote.promotion.monthlyPrice,44);assert.equal(calls.length,0);
 const body={action:'subscribe',planId:'starter',promoCode:'FRIENDS',consent:consentFor('starter'),price:1};
 assert.equal((await handler(request('billing',body,user.cookie))).status,400);assert.equal(calls.length,0);
 body.consent=quote.promotion.consent;price=55;assert.equal((await handler(request('billing',body,user.cookie))).status,503);assert.equal(calls.filter(c=>c.opt?.method==='POST').length,0);
 price=44;assert.equal((await handler(request('billing',body,user.cookie))).status,200);
 assert.equal(calls.find(c=>c.opt?.method==='POST').opt.body.plan_id,'P-DISCOUNT');
 assert.equal((await handler(request('billing',{...body,promoCode:'',consent:consentFor('starter')},user.cookie))).status,503);
 const r=await readBilling(identity,{env,run:f.run});assert.equal(r.promotion.monthlyPrice,44);
 const paid=await syncSubscription(identity,r,{env:{...env,ASAF_PROMOTIONS_JSON:'[]'},run:f.run,api,now:now+15*86400000});assert.equal(entitlement(paid,now+15*86400000).status,'paid');assert.equal(creditWindow(paid,now+15*86400000).limit,165);
});
test('new seven-day trial ends exactly at boundary; legacy fourteen-day promises remain valid',()=>{
 const fresh={trialStartedAt:now,trialEndsAt:now+WEEK};assert.equal(creditWindow(fresh,now+WEEK-1).limit,100);assert.equal(creditWindow(fresh,now+WEEK),null);assert.equal(entitlement(fresh,now+WEEK).access,false);
 const legacy={trialStartedAt:now,trialEndsAt:now+2*WEEK};assert.equal(entitlement(legacy,now+WEEK).access,true);assert.equal(creditWindow(legacy,now+WEEK).key,creditWindow(legacy,now).key);
});
