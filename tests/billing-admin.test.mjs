import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,seed,env as baseEnv,request,prefix} from './identity-fixture.mjs';
import {createBillingAdminHandler} from '../netlify/functions/billing-admin.mjs';
import {billingIdentity,readBilling,saveBilling,entitlement,DAY,startTrial} from '../server/billing.mjs';
import {digest} from '../server/auth-core.mjs';
const time=Date.now(),email='friend@example.test';
function setup(){const f=fixture(),owner=seed(f,'owner@example.test'),friend=seed(f,email,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','e'.repeat(64));const env={...baseEnv,ASAF_ADMIN_MEMBER_IDS:owner.record.id,ASAF_BILLING_ENABLED:'true',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'mock',PAYPAL_CLIENT_SECRET:'mock',PAYPAL_PLAN_ID:'P-TEST',PAYPAL_WEBHOOK_ID:'mock'};return {f,owner,friend,env,handler:createBillingAdminHandler({env,run:f.run,now:()=>time})};}
const body=(days=30)=>({action:'extend',email,days,requestId:randomUUID()});
test('only authenticated admin may inspect or extend; origin and numeric limits enforced',async()=>{
 const x=setup();
 assert.equal((await x.handler(request('billing-admin',body()))).status,401);
 assert.equal((await x.handler(request('billing-admin',body(),x.friend.cookie))).status,403);
 for(const days of [0,366,-1,1.5,'30'])assert.equal((await x.handler(request('billing-admin',body(days),x.owner.cookie))).status,400);
 const forged=request('billing-admin',body(),x.owner.cookie);forged.headers.set('origin','https://evil.test');assert.equal((await x.handler(forged)).status,403);
 assert.equal((await x.handler(request('billing-admin',{...body(),email:'missing@example.test'},x.owner.cookie))).status,404);
});
test('grant extends initial 14 days, survives repeat request and account recreation',async()=>{
 const x=setup(),b=body(),id=await billingIdentity(x.friend.record.id,{env:x.env,run:x.f.run});
 const first=await (await x.handler(request('billing-admin',b,x.owner.cookie))).json();assert.equal(first.trialEndsAt,time+44*DAY);
 const again=await (await x.handler(request('billing-admin',b,x.owner.cookie))).json();assert.equal(again.trialEndsAt,first.trialEndsAt);assert.equal(again.duplicate,true);
 const record=await readBilling(id,{env:x.env,run:x.f.run});assert.equal(record.trialGrants.length,1);assert.equal(record.trialGrants[0].actorId,x.owner.record.id);
 assert.equal(entitlement(record,time+43*DAY).access,true);assert.equal(entitlement(record,time+44*DAY).access,false);
 assert.deepEqual(await startTrial(id,{env:x.env,run:x.f.run,now:time+DAY}),record);
 seed(x.f,email,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','f'.repeat(64));assert.equal(await billingIdentity('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',{env:x.env,run:x.f.run}),id);
});
test('expired trial gets full added days; cancelled paid time is preserved',async()=>{
 const x=setup(),id=await billingIdentity(x.friend.record.id,{env:x.env,run:x.f.run}),opts={env:x.env,run:x.f.run};
 await saveBilling(id,{trialStartedAt:time-30*DAY,trialEndsAt:time-16*DAY,paidUntil:0},opts);
 let result=await (await x.handler(request('billing-admin',body(7),x.owner.cookie))).json();assert.equal(result.trialEndsAt,time+7*DAY);
 await saveBilling(id,{trialStartedAt:time-30*DAY,trialEndsAt:time-16*DAY,paidUntil:time+10*DAY,subscriptionId:'I-TEST',subscriptionStatus:'CANCELLED'},opts);
 result=await (await x.handler(request('billing-admin',body(7),x.owner.cookie))).json();assert.equal(result.trialEndsAt,time+17*DAY);assert.equal(result.paidUntil,time+10*DAY);
});
test('renewing or unresolved checkout cannot receive misleading free time',async()=>{
 const x=setup(),id=await billingIdentity(x.friend.record.id,{env:x.env,run:x.f.run}),opts={env:x.env,run:x.f.run};
 for(const extra of [{subscriptionId:'I-TEST',subscriptionStatus:'ACTIVE'},{subscriptionId:'I-TEST',subscriptionStatus:'APPROVAL_PENDING'},{createRequestId:'unresolved'}]){
  await saveBilling(id,{trialStartedAt:time-30*DAY,trialEndsAt:time-16*DAY,...extra},opts);
  assert.equal((await x.handler(request('billing-admin',body(),x.owner.cookie))).status,409);
 }
});
test('revoked owner session or changed target cannot commit a grant',async()=>{
 for(const keyKind of ['session','target']){
  const x=setup();let modified=false;
  const run=async(args,opts)=>{if(args[0]==='EVAL'&&args[1].includes('billing-admin-grant')){modified=true;x.f.db.delete(keyKind==='session'?prefix+'auth:session:'+digest('d'.repeat(64)):prefix+'auth:user:'+digest(email));}return x.f.run(args,opts);};
  const handler=createBillingAdminHandler({env:x.env,run,now:()=>time});assert.equal((await handler(request('billing-admin',body(),x.owner.cookie))).status,409);assert.equal(modified,true);
 }
});
