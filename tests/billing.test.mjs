import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,seed,env as authEnv,request,prefix} from './identity-fixture.mjs';
import {DAY,billingIdentity,startTrial,readBilling,saveBilling,entitlement,subscriptionGuard,createSubscription,syncSubscription,paidThrough,nextMonth,withBillingLock} from '../server/billing.mjs';
import {validatePlan,paypalConfigured,createPayPal} from '../server/paypal.mjs';
import {createBillingHandler} from '../netlify/functions/billing.mjs';
import {createWebhookHandler} from '../netlify/functions/paypal-webhook.mjs';
import {createAccountHandler} from '../netlify/functions/account.mjs';
const env={...authEnv,ASAF_BILLING_ENABLED:'true',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'mock',PAYPAL_CLIENT_SECRET:'mock',PAYPAL_PLAN_ID:'P-TESTPLAN',PAYPAL_WEBHOOK_ID:'MOCK-WEBHOOK'};
const now=Date.parse('2026-11-11T08:00:00Z'),id='I-TESTSUB';
const plan={id:env.PAYPAL_PLAN_ID,status:'ACTIVE',payment_preferences:{auto_bill_outstanding:false,payment_failure_threshold:1},billing_cycles:[{tenure_type:'REGULAR',frequency:{interval_unit:'MONTH',interval_count:1},total_cycles:0,pricing_scheme:{fixed_price:{value:'10.00',currency_code:'USD'}}}]};
function setup(){const f=fixture(),user=seed(f);return {...f,user};}
const payment=(time=now,extra={})=>({id:'SALE123',status:'COMPLETED',time:new Date(time).toISOString(),amount_with_breakdown:{gross_amount:{value:'10.00',currency_code:'USD'}},...extra});
function provider(identity,{status='ACTIVE',transactions=[payment()],signature='SUCCESS',custom_id=identity}={}){
 const calls=[];let current=status;
 const api=async(path,options={})=>{
  calls.push({path,...options});
  if(path.includes('verify-webhook'))return {verification_status:signature};
  if(path.includes('/plans/'))return structuredClone(plan);
  if(path.endsWith('/cancel')){current='CANCELLED';return {};}
  if(path.includes('/transactions?'))return {transactions,total_pages:1};
  if(path==='/v1/billing/subscriptions'&&options.method==='POST')return {id,status:'APPROVAL_PENDING',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=mock'}]};
  return {id,status:current,custom_id,plan_id:env.PAYPAL_PLAN_ID,billing_info:{next_billing_time:new Date(nextMonth(now)).toISOString()},links:current==='APPROVAL_PENDING'?[{rel:'approve',href:'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=mock'}]:[]};
 };return {api,calls};
}
test('trial lasts exactly 14 days, does not restart across devices or recreated account',async()=>{
 const f=setup(),identity=await billingIdentity(f.user.record.id,{env,run:f.run});
 const trial=await startTrial(identity,{env,run:f.run,now});
 assert.equal(entitlement(trial,now+14*DAY-1).access,true);assert.equal(entitlement(trial,now+14*DAY).access,false);
 assert.deepEqual(await startTrial(identity,{env,run:f.run,now:now+30*DAY}),trial);
 const recreated=seed(f,'member@example.test','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 assert.equal(await billingIdentity(recreated.record.id,{env,run:f.run}),identity);
 assert.equal(entitlement(await startTrial(identity,{env,run:f.run,now:now+30*DAY}),now+30*DAY).status,'expired');
});
test('disabled rollout preserves access and creates no trial; enabled incomplete config fails closed',async()=>{
 const f=setup(),user={id:f.user.record.id};
 assert.equal(await subscriptionGuard(user,{env:{...env,ASAF_BILLING_ENABLED:'false'},run:f.run,now}),null);
 assert.equal([...f.db.keys()].filter(k=>k.includes('billing:')).length,0);
 assert.equal((await subscriptionGuard(user,{env:{...env,PAYPAL_CLIENT_SECRET:''},run:f.run,now})).status,503);
 assert.equal(await subscriptionGuard(user,{env,run:f.run,now}),null);
 const response=await subscriptionGuard(user,{env,run:f.run,now:now+14*DAY});assert.equal(response.status,402);assert.equal((await response.json()).code,'subscription_required');
});
test('plan rejects wrong price, currency, interval, extra fee, trial and quantity',()=>{
 validatePlan(plan,env.PAYPAL_PLAN_ID);
 for(const mutate of [p=>p.billing_cycles[0].pricing_scheme.fixed_price.value='11',p=>p.billing_cycles[0].pricing_scheme.fixed_price.currency_code='EUR',p=>p.billing_cycles[0].frequency.interval_unit='YEAR',p=>p.billing_cycles.push({...p.billing_cycles[0],tenure_type:'TRIAL'}),p=>p.payment_preferences={setup_fee:{value:'1'}},p=>p.taxes={percentage:'5'},p=>p.quantity_supported=true]){const p=structuredClone(plan);mutate(p);assert.throws(()=>validatePlan(p,env.PAYPAL_PLAN_ID));}
 assert.equal(paypalConfigured({...env,CONTEXT:'deploy-preview',PAYPAL_ENVIRONMENT:'live'}),false);
});
test('checkout cannot charge during trial, ignores client prices and requires explicit consent',async()=>{
 const f=setup(),identity=await billingIdentity(f.user.record.id,{env,run:f.run}),p=provider(identity),handler=createBillingHandler({env,run:f.run,now:()=>now,api:p.api});
 assert.equal((await handler(request('billing',{action:'subscribe',consent:'USD10_MONTHLY_V1'},f.user.cookie))).status,409);
 await handler(request('billing',{action:'start-trial'},f.user.cookie));
 assert.equal((await handler(request('billing',{action:'subscribe',consent:'USD10_MONTHLY_V1'},f.user.cookie))).status,409);
 assert.equal((await handler(request('billing',{action:'subscribe'},f.user.cookie))).status,400);
 assert.equal(p.calls.length,0);
 const expired=createBillingHandler({env,run:f.run,now:()=>now+14*DAY,api:p.api});
 const r=await expired(request('billing',{action:'subscribe',consent:'USD10_MONTHLY_V1',price:1,memberId:'someone-else'},f.user.cookie));assert.equal(r.status,200);
 const creation=p.calls.find(c=>c.path==='/v1/billing/subscriptions');assert.equal(creation.body.plan_id,env.PAYPAL_PLAN_ID);assert.equal(creation.body.custom_id,identity);assert.ok(creation.requestId);
 assert.equal(creation.body.application_context.return_url,'https://example.test/subscription.html?paypal=return');
});
test('ambiguous creation retry reuses persisted idempotency key and rejects stale attempts',async()=>{
 const f=setup(),identity=await billingIdentity(f.user.record.id,{env,run:f.run});await startTrial(identity,{env,run:f.run,now:now-15*DAY});
 const ids=[];const api=async(path,opt)=>{if(path.includes('/plans/'))return plan;ids.push(opt.requestId);throw Error('lost response');};
 // Exercise actual retries using the persisted record, not a reconstructed request.
 for(let i=0;i<2;i++){const record=await readBilling(identity,{env,run:f.run});await assert.rejects(()=>createSubscription(identity,record,{env,run:f.run,api,now,origin:'https://example.test'}));}
 assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);
 const record=await readBilling(identity,{env,run:f.run});await assert.rejects(()=>createSubscription(identity,record,{env,run:f.run,api,now:now+71*3600000,origin:'https://example.test'}));assert.equal(ids.length,2);
});
test('only completed USD 10 payments grant access; cancellation retains paid month',()=>{
 const sub={billing_info:{next_billing_time:new Date(nextMonth(now)).toISOString()}};
 assert.equal(paidThrough([payment()],sub,[],now),nextMonth(now));
 for(const status of ['PENDING','REFUNDED','FAILED','DECLINED','PARTIALLY_REFUNDED'])assert.equal(paidThrough([payment(now,{status})],sub,[],now),0);
 assert.equal(paidThrough([payment()],sub,['SALE123'],now),0);
 assert.equal(paidThrough([payment(now+DAY)],sub,[],now),0);
 assert.equal(paidThrough([payment(now,{amount_with_breakdown:{gross_amount:{value:'10',currency_code:'EUR'}}})],sub,[],now),0);
 assert.equal(paidThrough([payment()],{status:'CANCELLED'},[],now),nextMonth(now));
 assert.equal(new Date(nextMonth(Date.parse('2027-01-31T08:00:00Z'))).toISOString(),'2027-02-28T08:00:00.000Z');
});
test('redirect spoof and another account subscription never grant paid access',async()=>{
 const f=setup(),identity=await billingIdentity(f.user.record.id,{env,run:f.run});
 let record=await startTrial(identity,{env,run:f.run,now:now-15*DAY});record=await saveBilling(identity,{...record,subscriptionId:id},{env,run:f.run});
 const p=provider(identity,{custom_id:'another-account'});await assert.rejects(()=>syncSubscription(identity,record,{env,run:f.run,api:p.api,now}));
 const handler=createBillingHandler({env,run:f.run,now:()=>now,api:p.api});
 assert.equal((await handler(request('billing',{action:'sync',subscription_id:'I-OTHER'},f.user.cookie))).status,503);
 assert.equal(entitlement(await readBilling(identity,{env,run:f.run}),now).access,false);
});
test('cancel is idempotent, preserves paid access and stops future charges',async()=>{
 const f=setup(),identity=await billingIdentity(f.user.record.id,{env,run:f.run}),p=provider(identity);
 const trial=await startTrial(identity,{env,run:f.run,now:now-15*DAY});await saveBilling(identity,{...trial,subscriptionId:id},{env,run:f.run});
 const handler=createBillingHandler({env,run:f.run,now:()=>now,api:p.api});
 for(let i=0;i<2;i++){const d=await (await handler(request('billing',{action:'cancel'},f.user.cookie))).json();assert.equal(d.access,true);assert.equal(d.subscriptionStatus,'CANCELLED');assert.equal(d.canCancel,false);}
 assert.equal(p.calls.filter(c=>c.path.endsWith('/cancel')).length,1);
});
function webhook(event){return new Request('https://example.test/.netlify/functions/paypal-webhook',{method:'POST',headers:{'Content-Type':'application/json','paypal-auth-algo':'SHA256withRSA','paypal-cert-url':'https://api.paypal.com/cert','paypal-transmission-id':'mock-id','paypal-transmission-sig':'mock-signature','paypal-transmission-time':new Date(now).toISOString()},body:JSON.stringify(event)});}
test('forged webhooks rejected; duplicates and stale activation read current provider state',async()=>{
 const f=setup(),identity=await billingIdentity(f.user.record.id,{env,run:f.run});const trial=await startTrial(identity,{env,run:f.run,now:now-15*DAY});await saveBilling(identity,{...trial,subscriptionId:id},{env,run:f.run});f.db.set(prefix+'billing:subscription:'+id,identity);
 const event={id:'EVENT1',event_type:'BILLING.SUBSCRIPTION.ACTIVATED',resource:{id}};
 const forged=createWebhookHandler({env,run:f.run,now:()=>now,api:provider(identity,{signature:'FAILURE'}).api});assert.equal((await forged(webhook(event))).status,401);
 assert.equal(entitlement(await readBilling(identity,{env,run:f.run}),now).access,false);
 const p=provider(identity,{status:'CANCELLED'}),handler=createWebhookHandler({env,run:f.run,now:()=>now,api:p.api});
 for(let i=0;i<2;i++)assert.equal((await handler(webhook(event))).status,200);
 const record=await readBilling(identity,{env,run:f.run});assert.equal(record.subscriptionStatus,'CANCELLED');assert.equal(record.paidUntil,nextMonth(now));
});
test('refund remains revoked while transaction API still says completed; unknown webhook mapping retries',async()=>{
 const f=setup(),identity=await billingIdentity(f.user.record.id,{env,run:f.run});const trial=await startTrial(identity,{env,run:f.run,now:now-15*DAY});await saveBilling(identity,{...trial,subscriptionId:id,paidUntil:nextMonth(now)},{env,run:f.run});f.db.set(prefix+'billing:subscription:'+id,identity);
 const handler=createWebhookHandler({env,run:f.run,now:()=>now,api:provider(identity).api});
 assert.equal((await handler(webhook({id:'E2',event_type:'PAYMENT.SALE.REFUNDED',resource:{billing_agreement_id:id,sale_id:'SALE123',id:'REFUND123'}}))).status,200);
 assert.equal(entitlement(await readBilling(identity,{env,run:f.run}),now).access,false);
 assert.equal((await handler(webhook({id:'E3',event_type:'BILLING.SUBSCRIPTION.ACTIVATED',resource:{id:'I-UNKNOWN'}}))).status,503);
});
test('billing routes require session and same-origin JSON; account deletion blocks ongoing charges',async()=>{
 const f=setup(),identity=await billingIdentity(f.user.record.id,{env,run:f.run}),handler=createBillingHandler({env,run:f.run,now:()=>now,api:provider(identity).api});
 assert.equal((await handler(request('billing',{action:'start-trial'}))).status,401);
 assert.equal((await handler(new Request('https://example.test/.netlify/functions/billing',{method:'POST',headers:{Origin:'https://evil.test',cookie:f.user.cookie},body:'{}'}))).status,403);
 const trial=await startTrial(identity,{env,run:f.run,now});await saveBilling(identity,{...trial,subscriptionId:id,subscriptionStatus:'ACTIVE'},{env,run:f.run});
 const account=createAccountHandler({env,run:f.run});assert.equal((await account(request('account',{action:'delete',confirmation:'DELETE'},f.user.cookie))).status,409);
 await saveBilling(identity,{...trial,subscriptionId:id,subscriptionStatus:'CANCELLED'},{env,run:f.run});assert.equal((await account(request('account',{action:'delete',confirmation:'DELETE'},f.user.cookie))).status,200);
 assert.ok(await readBilling(identity,{env,run:f.run}));
});
test('account lock rejects concurrent checkout and releases after a failure',async()=>{
 const f=setup();let release;const waiting=new Promise(r=>release=r),first=withBillingLock('test',()=>waiting,{env,run:f.run});await new Promise(r=>setImmediate(r));
 await assert.rejects(()=>withBillingLock('test',()=>{}, {env,run:f.run}));release();await first;
 await assert.rejects(()=>withBillingLock('test',()=>{throw Error('provider down');},{env,run:f.run}));assert.equal(await withBillingLock('test',()=>42,{env,run:f.run}),42);
});
test('PayPal client selects exact sandbox origin and keeps secrets in authorization headers',async()=>{
 const calls=[],api=createPayPal({env,fetcher:async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/token')?{access_token:'mock-token'}:plan);}});
 await api('/v1/billing/plans/'+env.PAYPAL_PLAN_ID);assert.equal(calls.length,2);assert.equal(calls[0].url,'https://api-m.sandbox.paypal.com/v1/oauth2/token');assert.equal(calls[1].options.headers.Authorization,'Bearer mock-token');assert.ok(!calls[0].url.includes(env.PAYPAL_CLIENT_SECRET));
});
