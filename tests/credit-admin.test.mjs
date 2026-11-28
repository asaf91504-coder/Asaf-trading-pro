import {createAccountHandler} from '../netlify/functions/account.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,seed,env as authEnv,request,prefix} from './identity-fixture.mjs';
import {createCreditAdminHandler} from '../netlify/functions/credit-admin.mjs';
import {createBillingHandler} from '../netlify/functions/billing.mjs';
import {billingIdentity,readBilling,saveBilling,subscriptionGuard,paidSubscriptionGuard,DAY} from '../server/billing.mjs';
import {creditStatus,reserveCredits,bonusUsedKey} from '../server/credits.mjs';
import {digest} from '../server/auth-core.mjs';
import {ownerCreditCopy} from '../owner-credit-copy.mjs';
const time=Date.now(),email='friend@example.test';
function setup(){
 const f=fixture(),owner=seed(f,'owner@example.test'),friend=seed(f,email,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','e'.repeat(64)),admin=seed(f,'admin@example.test','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','f'.repeat(64));
 const env={...authEnv,ASAF_ADMIN_MEMBER_IDS:owner.record.id+','+admin.record.id,ASAF_CHAT_OWNER_MEMBER_ID:owner.record.id,ASAF_WEEKLY_CREDITS_ENABLED:'true',ASAF_BILLING_ENABLED:'true',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'mock',PAYPAL_CLIENT_SECRET:'mock',PAYPAL_WEBHOOK_ID:'mock',PAYPAL_PLAN_STARTER_ID:'P-STARTER',PAYPAL_PLAN_PLUS_ID:'P-PLUS',PAYPAL_PLAN_PRO_ID:'P-PRO',PAYPAL_PLAN_PREMIUM_ID:'P-PREMIUM'};
 const run=async a=>{
  if(a[0]!=='EVAL')return f.run(a);
  const n=Number(a[2]),k=a.slice(3,3+n),v=a.slice(3+n),script=a[1];
  if(script.includes('owner-credit-grant')){if(k.some((key,i)=>(f.db.get(key)||'')!==v[i])||JSON.parse(v[0]).expires<=Date.now())return 0;f.db.set(k[4],v[5]);return 1;}
  if(script.includes('trial-total-migration')){if(!f.db.has(k[0]))f.db.set(k[0],String(k.slice(1).reduce((n,key)=>n+Number(f.db.get(key)||0),0)));return 1;}
  if(script.includes('gifted-credit-reserve')){const used=Number(f.db.get(k[0])||0),giftUsed=Number(f.db.get(k[2])||0),base=Math.min(Number(v[0]),Math.max(0,Number(v[1])-used)),gift=Number(v[0])-base;if(giftUsed+gift>Number(v[2]))return -1;f.db.set(k[0],String(used+base));f.db.set(k[2],String(giftUsed+gift));f.db.set(k[1],JSON.stringify({base,gift}));return [used+base,giftUsed+gift];}
  if(script.includes('gifted-credit-refund')){const raw=f.db.get(k[1]);if(!raw)return 0;const amount=JSON.parse(raw);f.db.delete(k[1]);f.db.set(k[0],String(Number(f.db.get(k[0])||0)-amount.base));f.db.set(k[2],String(Number(f.db.get(k[2])||0)-amount.gift));return 1;}
  return f.run(a);
 };
 return {f,owner,friend,admin,env,run,handler:createCreditAdminHandler({env,run,now:()=>time})};
}
const grant=(credits=50)=>({action:'grant',email,credits,requestId:randomUUID()});
test('credit management requires the configured owner, not another administrator or forged browser fields',async()=>{
 const x=setup();
 assert.equal((await x.handler(request('credit-admin',grant()))).status,401);
 for(const user of [x.friend,x.admin])assert.equal((await x.handler(request('credit-admin',{...grant(),owner:true,memberId:x.owner.record.id},user.cookie))).status,403);
 for(const credits of [0,-1,1.5,100001,'50'])assert.equal((await x.handler(request('credit-admin',grant(credits),x.owner.cookie))).status,400);
 const forged=request('credit-admin',grant(),x.owner.cookie);forged.headers.set('origin','https://foreign.test');assert.equal((await x.handler(forged)).status,403);
 assert.equal((await x.handler(request('credit-admin',{...grant(),email:'missing@example.test'},x.owner.cookie))).status,404);
});
test('grant is audited, idempotent and creates only the normal seven-day first trial',async()=>{
 const x=setup(),body=grant(),options={env:x.env,run:x.run,now:time};
 const first=await (await x.handler(request('credit-admin',body,x.owner.cookie))).json();assert.equal(first.granted,50);assert.equal(first.bonusRemaining,50);assert.equal(first.credits.remaining,100);
 const again=await (await x.handler(request('credit-admin',body,x.owner.cookie))).json();assert.equal(again.duplicate,true);assert.equal(again.bonusRemaining,50);
 assert.equal((await x.handler(request('credit-admin',{...body,credits:60},x.owner.cookie))).status,409);
 const id=await billingIdentity(x.friend.record.id,options),r=await readBilling(id,options);assert.equal(r.trialTotalCredits,50);assert.equal(r.trialEndsAt,time+7*DAY);assert.equal(r.creditGrants.length,1);assert.equal(r.creditGrants[0].actorId,x.owner.record.id);
});
test('gift credits cover only the excess above normal quota and concurrent reservations cannot overspend',async()=>{
 const x=setup(),options={env:x.env,run:x.run,now:time},id=await billingIdentity(x.friend.record.id,options);
 await saveBilling(id,{trialStartedAt:time,trialEndsAt:time+7*DAY,trialTotalCredits:2,paidUntil:0},options);
 await x.handler(request('credit-admin',grant(5),x.owner.cookie));
 const results=await Promise.allSettled(Array.from({length:10},()=>reserveCredits(x.friend.record.id,.02,options)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,7);assert.equal((await creditStatus(x.friend.record.id,options)).remaining,0);assert.equal(Number(x.f.db.get(bonusUsedKey(id,x.env))),5);
 const ticket=results[6].value;await ticket.refund();await ticket.refund();assert.equal((await creditStatus(x.friend.record.id,options)).remaining,1);assert.equal(Number(x.f.db.get(bonusUsedKey(id,x.env))),4);
});
test('paid week rollover does not refill consumed gifts and does not alter payment or subscription records',async()=>{
 const x=setup(),options={env:x.env,run:x.run,now:time},id=await billingIdentity(x.friend.record.id,options);
 const r={trialStartedAt:time-30*DAY,trialEndsAt:time-23*DAY,paidUntil:time+30*DAY,planId:'starter',creditAnchor:time,bonusUntil:time-1,subscriptionId:'I-UNCHANGED',subscriptionStatus:'ACTIVE'};await saveBilling(id,r,options);
 await x.handler(request('credit-admin',grant(10),x.owner.cookie));await reserveCredits(x.friend.record.id,3.10,options);
 const next=await creditStatus(x.friend.record.id,{...options,now:time+7*DAY});assert.equal(next.bonusRemaining,5);assert.equal(next.remaining,155);
 const updated=await readBilling(id,options);for(const key of Object.keys(r))assert.equal(updated[key],r[key]);
});
test('credits may be gifted to an expired account but cannot extend access, reset usage or unlock disabled accounts',async()=>{
 const x=setup(),options={env:x.env,run:x.run,now:time},id=await billingIdentity(x.friend.record.id,options),r={trialStartedAt:time-20*DAY,trialEndsAt:time-13*DAY,trialTotalCredits:50,paidUntil:0};await saveBilling(id,r,options);
 const result=await (await x.handler(request('credit-admin',grant(10),x.owner.cookie))).json();assert.equal(result.access,false);assert.equal(result.bonusRemaining,10);assert.equal(result.trialEndsAt,r.trialEndsAt);
 await assert.rejects(reserveCredits(x.friend.record.id,.02,options),/No credit entitlement/);
 x.f.db.set(prefix+'auth:user:'+digest(email),JSON.stringify({...x.friend.record,enabled:false}));assert.equal((await x.handler(request('credit-admin',grant(10),x.owner.cookie))).status,409);
});
test('revoked actor or changed target cannot commit a grant after authorization',async()=>{
 for(const changed of ['actor','target']){
  const x=setup(),run=async a=>{if(a[0]==='EVAL'&&a[1].includes('owner-credit-grant'))x.f.db.delete(changed==='actor'?prefix+'auth:session:'+digest('d'.repeat(64)):prefix+'auth:member:'+x.friend.record.id);return x.run(a);};
  const handler=createCreditAdminHandler({env:x.env,run,now:()=>time});assert.equal((await handler(request('credit-admin',grant(),x.owner.cookie))).status,409);
 }
});
test('owner access and credits are unlimited after trial expiry, without conferring this on other admins',async()=>{
 const x=setup(),options={env:x.env,run:x.run,now:time};
 assert.equal(await subscriptionGuard(x.owner.record,options),null);assert.equal(await paidSubscriptionGuard(x.owner.record,options),null);
 const balance=await creditStatus(x.owner.record.id,options);assert.equal(balance.unlimited,true);assert.equal(balance.limit,null);assert.equal(await reserveCredits(x.owner.record.id,.4,options),null);
 const handler=createBillingHandler({env:x.env,run:x.run,now:()=>time}),status=await (await handler(request('billing',null,x.owner.cookie))).json();assert.equal(status.ownerUnlimited,true);assert.equal(status.access,true);assert.equal(status.status,'owner');
 assert.notEqual(await paidSubscriptionGuard(x.admin.record,options),null);assert.equal(await creditStatus(x.admin.record.id,options),null);
});
test('all supported languages explain owner credits and the non-renewing gift without raw placeholders',()=>{
 for(const lang of ['he','en','es','ar','fr','de','pt','ru','zh','ja'])for(const key of ['unlimited','title','email','amount','grant','check','note','busy','added','balance','inactive','error','duplicate']){const text=ownerCreditCopy(lang,key,25);assert.ok(text);assert.doesNotMatch(text,/\{count\}/);}
});

test('account capability flags distinguish the owner, another admin and a regular customer',async()=>{
 const x=setup(),handler=createAccountHandler({env:x.env,run:x.run});
 for(const [user,admin,owner] of [[x.owner,true,true],[x.admin,true,false],[x.friend,false,false]]){const data=await (await handler(request('account',null,user.cookie))).json();assert.equal(data.admin,admin);assert.equal(data.owner,owner);}
});

test('inspecting the owner reports unlimited active access without requiring a trial record',async()=>{
 const x=setup(),data=await (await x.handler(request('credit-admin',{action:'inspect',email:'owner@example.test'},x.owner.cookie))).json();
 assert.equal(data.ownerUnlimited,true);assert.equal(data.access,true);assert.equal(data.status,'owner');assert.equal(data.credits.unlimited,true);
});
