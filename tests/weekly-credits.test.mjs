import test from 'node:test';
import assert from 'node:assert/strict';
import {PLANS,WEEK,creditWindow,creditsForCost,creditPlansReady,consentFor} from '../server/plans.mjs';
import {reserveCredits,creditStatus} from '../server/credits.mjs';
import {createBillingHandler} from '../netlify/functions/billing.mjs';
import {billingIdentity,saveBilling,nextMonth,syncSubscription} from '../server/billing.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
const now=Date.parse('2026-11-16T10:00:00Z');
const env={...authEnv,ASAF_PUBLIC_PAID_LAUNCH:'true',ASAF_WEEKLY_CREDITS_ENABLED:'true',ASAF_BILLING_ENABLED:'true',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'mock',PAYPAL_CLIENT_SECRET:'mock',PAYPAL_WEBHOOK_ID:'mock',...Object.fromEntries(Object.keys(PLANS).map(id=>['PAYPAL_PLAN_'+id.toUpperCase()+'_ID','P-'+id.toUpperCase()]))};
const trial={trialStartedAt:now,trialEndsAt:now+2*WEEK};
test('trial has 100 total credits through day fourteen and extensions, without weekly reset',()=>{
 assert.equal(creditWindow(trial,now).limit,100);
 assert.equal(creditWindow(trial,now+WEEK-1).key,creditWindow(trial,now).key);
 assert.equal(creditWindow(trial,now+WEEK).key,creditWindow(trial,now).key);
 assert.equal(creditWindow(trial,now+2*WEEK),null);assert.equal(creditWindow(trial,now-1),null);
});
test('paid bonus ends at calendar month without resetting weekly consumption; legacy is untouched',()=>{
 const r={...trial,planId:'plus',creditAnchor:now,bonusUntil:nextMonth(now),paidUntil:nextMonth(nextMonth(now))};
 assert.equal(creditWindow(r,now).limit,336);assert.equal(creditWindow(r,r.bonusUntil).limit,300);
 assert.equal(creditWindow(r,r.bonusUntil-1).key,creditWindow(r,r.bonusUntil).key);
 assert.equal(creditWindow({...r,planId:undefined},now),null);
 assert.throws(()=>creditWindow({...r,creditAnchor:undefined},now));
});
test('unknown/nonfinite costs fail, whole-credit rounding never underprices',()=>{
 assert.equal(creditsForCost(.02),1);assert.equal(creditsForCost(.02001),2);assert.equal(creditsForCost(.40),20);
 for(const n of [NaN,Infinity,-1])assert.throws(()=>creditsForCost(n));
 assert.equal(creditPlansReady(env),true);assert.equal(creditPlansReady({...env,PAYPAL_PLAN_PLUS_ID:env.PAYPAL_PLAN_PRO_ID}),false);
});
function creditFixture(){const f=fixture();const run=async a=>{
 if(a[0]==='EVAL'&&a[1].includes('trial-total-migration')){const keys=a.slice(3,3+Number(a[2]));if(!f.db.has(keys[0]))f.db.set(keys[0],String(keys.slice(1).reduce((n,k)=>n+Number(f.db.get(k)||0),0)));return 1}

 if(a[0]==='EVAL'&&a[1].includes('weekly-credit-reserve')){const [key,res,cost,limit]=a.slice(3),used=Number(f.db.get(key)||0);if(used+Number(cost)>Number(limit))return -1;f.db.set(key,String(used+Number(cost)));f.db.set(res,cost);return used+Number(cost)}
 if(a[0]==='EVAL'&&a[1].includes('weekly-credit-refund')){const [key,res]=a.slice(3),cost=f.db.get(res);if(!cost)return 0;f.db.delete(res);f.db.set(key,String(Number(f.db.get(key))-Number(cost)));return 1}
 return f.run(a);
 };return {...f,run};}
test('concurrent requests stop at weekly balance, refunds idempotent and reset stays separate',async()=>{
 const f=creditFixture(),user=seed(f),identity=await billingIdentity(user.record.id,{env,run:f.run});await saveBilling(identity,trial,{env,run:f.run});
 const options={env,run:f.run,now};const results=await Promise.allSettled(Array.from({length:105},()=>reserveCredits(user.record.id,.02,options)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,100);assert.equal((await creditStatus(user.record.id,options)).remaining,0);
 const ticket=results.find(r=>r.status==='fulfilled').value;await ticket.refund();await ticket.refund();assert.equal((await creditStatus(user.record.id,options)).remaining,1);
 const next={...options,now:now+WEEK};assert.equal((await creditStatus(user.record.id,next)).remaining,1);await ticket.refund();assert.equal((await creditStatus(user.record.id,next)).remaining,1);
});
test('early upgrade selects verified price and consent; pending approval never grants paid credits',async()=>{
 const f=fixture(),user=seed(f),identity=await billingIdentity(user.record.id,{env,run:f.run});await saveBilling(identity,trial,{env,run:f.run});let created;
 const api=async(path,opt)=>{if(path.includes('/plans/'))return {id:env.PAYPAL_PLAN_PRO_ID,status:'ACTIVE',payment_preferences:{auto_bill_outstanding:false,payment_failure_threshold:1},billing_cycles:[{tenure_type:'REGULAR',frequency:{interval_unit:'MONTH',interval_count:1},total_cycles:0,pricing_scheme:{fixed_price:{value:'115',currency_code:'USD'}}}]};created=opt.body;return {id:'I-TEST',status:'APPROVAL_PENDING',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/checkout'}]}};
 const handler=createBillingHandler({env,run:f.run,now:()=>now,api});
 assert.equal((await handler(request('billing',{action:'subscribe',planId:'pro',consent:consentFor('starter')},user.cookie))).status,400);
 assert.equal((await handler(request('billing',{action:'subscribe',planId:'pro',consent:consentFor('pro'),price:1},user.cookie))).status,200);
 assert.equal(created.plan_id,env.PAYPAL_PLAN_PRO_ID);assert.equal(created.custom_id,identity);
 const record=JSON.parse([...f.db.entries()].find(([k])=>k.includes('billing:account:'))[1]);assert.equal(creditWindow(record,now).limit,100);
 const payment={id:'SALE1',time:new Date(now).toISOString(),status:'COMPLETED',amount_with_breakdown:{gross_amount:{value:'115',currency_code:'USD'}}};
 const syncApi=async path=>path.includes('transactions?')?{transactions:[payment]}:{id:'I-TEST',custom_id:identity,plan_id:env.PAYPAL_PLAN_PRO_ID,status:'ACTIVE'};
 const synced=await syncSubscription(identity,record,{env,run:f.run,now,api:syncApi});assert.equal(creditWindow(synced,now).limit,720);assert.equal(synced.creditAnchor,now);
 const again=await syncSubscription(identity,synced,{env,run:f.run,now:now+1,api:syncApi});assert.equal(again.bonusUntil,synced.bonusUntil);
});

test('payment pilot rejects non-admin checkout before contacting PayPal',async()=>{
 const f=fixture(),user=seed(f);let calls=0;
 const pilot={...env,ASAF_PUBLIC_PAID_LAUNCH:'false',ASAF_ADMIN_MEMBER_IDS:'another-admin'};
 const handler=createBillingHandler({env:pilot,run:f.run,api:async()=>{calls++;throw Error('must not call')}});
 const status=await (await handler(request('billing',null,user.cookie))).json();
 assert.equal(status.paymentPilot,true);assert.equal(status.checkoutAllowed,false);
 assert.equal((await handler(request('billing',{action:'subscribe',planId:'starter',consent:consentFor('starter')},user.cookie))).status,403);
 assert.equal(calls,0);
 const admin=createBillingHandler({env:{...pilot,ASAF_ADMIN_MEMBER_IDS:user.record.id},run:f.run});
 assert.equal((await (await admin(request('billing',null,user.cookie))).json()).checkoutAllowed,true);
});

test('trial migration retains both prior weeks usage once and extensions do not refill',async()=>{
 const f=creditFixture(),user=seed(f),identity=await billingIdentity(user.record.id,{env,run:f.run});await saveBilling(identity,{...trial,complimentaryUntil:now+4*WEEK},{env,run:f.run});
 const {storageKey}=await import('../server/storage.mjs');for(const [i,n] of [[0,60],[1,30]])f.db.set(storageKey(`credits:${identity}:trial:${now}:${i}`,env),String(n));
 const options={env,run:f.run,now:now+WEEK};assert.equal((await creditStatus(user.record.id,options)).remaining,10);await reserveCredits(user.record.id,.02,options);assert.equal((await creditStatus(user.record.id,{...options,now:now+3*WEEK})).remaining,9);
});

test('new grants persist 55 credits; repeated trial starts preserve old grants and usage',async()=>{
 const {startTrial,readBilling}=await import('../server/billing.mjs');
 const f=creditFixture(),user=seed(f),identity=await billingIdentity(user.record.id,{env,run:f.run});
 const options={env,run:f.run,now};
 const fresh=await startTrial(identity,options);
 assert.equal(fresh.trialTotalCredits,55);assert.equal(fresh.trialEndsAt,now+WEEK);
 const results=await Promise.allSettled(Array.from({length:56},()=>reserveCredits(user.record.id,.02,options)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,55);
 assert.match(results.find(r=>r.status==='rejected').reason.message,/55/);
 await startTrial(identity,{...options,now:now+1000});
 assert.equal((await creditStatus(user.record.id,options)).remaining,0);
 const ticket=results.find(r=>r.status==='fulfilled').value;await ticket.refund();await ticket.refund();
 assert.equal((await creditStatus(user.record.id,options)).remaining,1);
 await saveBilling(identity,{...trial,complimentaryUntil:now+3*WEEK},options);
 await startTrial(identity,options);
 assert.equal((await readBilling(identity,options)).trialTotalCredits,undefined);
 const legacy=await creditStatus(user.record.id,options);assert.equal(legacy.limit,100);assert.equal(legacy.remaining,46);
 assert.equal((await creditStatus(user.record.id,{...options,now:now+2*WEEK})).remaining,46);
});
test('stored allowances survive extensions, invalid allowances fail closed and paid tiers are unchanged',()=>{
 const fresh={trialStartedAt:now,trialEndsAt:now+WEEK,trialTotalCredits:55,complimentaryUntil:now+3*WEEK};
 assert.equal(creditWindow(fresh,now+2*WEEK).limit,55);
 assert.equal(creditWindow({...fresh,trialTotalCredits:100},now).limit,100);
 for(const n of [null,-1,1.5,'55'])assert.throws(()=>creditWindow({...fresh,trialTotalCredits:n},now));
 assert.deepEqual(Object.values(PLANS).map(p=>[p.price,p.weeklyCredits]),[[55,150],[75,300],[115,600],[359,2500]]);
});
test('public billing advertises 55 without creating an account and balance copy uses personal entitlement',async()=>{
 const {subscriptionCopy}=await import('../subscription-copy.mjs');
 const f=creditFixture();const handler=createBillingHandler({env,run:f.run,now:()=>now});
 const state=await (await handler(request('billing',null))).json();
 assert.equal(state.trialTotalCredits,55);assert.equal(state.trialDays,7);
 assert.equal([...f.db.keys()].some(k=>k.includes('billing:account:')),false);
 for(const language of ['he','en','es','ar','fr','de','pt','ru','zh','ja'])for(const limit of [55,100]){
  const copy=subscriptionCopy(language,'trialBalance',{remaining:12,limit,date:'DATE'});
  assert.ok(copy.includes(String(limit)));assert.ok(copy.includes('12'));assert.ok(!copy.includes('{limit}'));
 }
});
