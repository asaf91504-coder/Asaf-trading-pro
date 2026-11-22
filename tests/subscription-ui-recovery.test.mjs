import {subscriptionCopy} from '../subscription-copy.mjs';
import {PLANS,consentFor,CHECKOUT_PRICE_VERSION,usdPriceText} from '../server/plans.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../subscription-ui.mjs',import.meta.url),'utf8').replace(/^import .*\n/gm,'');
const expired={enabled:true,ready:true,pricingVersion:2,checkoutPriceVersion:2,checkoutAllowed:true,authenticated:true,access:false,status:'expired',canCancel:false,subscriptionStatus:'APPROVAL_PENDING'};
const paid={...expired,access:true,status:'paid',subscriptionStatus:'ACTIVE',canCancel:true,paidUntil:Date.now()+86400000};
async function page(responses,search=''){
 const elements=new Map(),calls=[],navigation=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{hidden:true,disabled:false,checked:false,textContent:'',setAttribute(){},value:id==='billingPlan'?'starter':''});return elements.get(id);};
 const context={subscriptionCopy,PLANS,consentFor,CHECKOUT_PRICE_VERSION,usdPriceText,URL,URLSearchParams,Intl,Date,AbortSignal,document:{getElementById:get,querySelector:()=>get("price"),documentElement:{lang:'he'}},window:{confirm:()=>true,addEventListener(){}},history:{replaceState(){}},location:{search,assign:url=>navigation.push(url)},fetch:async(_url,options)=>{
  calls.push(options.body?JSON.parse(options.body).action:'GET');
  const next=responses.shift();assert.ok(next,'Unexpected request');if(next instanceof Error)throw next;
  return {ok:!next.httpError,status:next.httpError||200,json:async()=>next.httpError?{error:'יש להיכנס לחשבון.'}:next};
 }};
 await vm.runInNewContext('(async()=>{'+source+'})()',context);
 return {get,calls,navigation};
}
test('failed PayPal return verification retries provider sync, not a cached GET',async()=>{
 const p=await page([expired,Error('network failure'),paid],'?paypal=return&subscription_id=untrusted');
 assert.deepEqual(p.calls,['GET','sync']);assert.equal(p.get('billingRetry').hidden,false);
 await p.get('billingRetry').onclick();
 assert.deepEqual(p.calls,['GET','sync','sync']);assert.equal(p.get('billingContinue').hidden,false);assert.deepEqual(p.navigation,[]);
});
test('expired session clears paid access and exposes sign-in rather than stale controls',async()=>{
 const p=await page([paid,{httpError:401},{...expired,authenticated:false,subscriptionStatus:null}]);
 await p.get('billingSync').onclick();
 assert.equal(p.get('billingContinue').hidden,true);assert.equal(p.get('billingCancel').hidden,true);assert.equal(p.get('billingLogin').hidden,false);
 await p.get('billingRetry').onclick();assert.deepEqual(p.calls,['GET','sync','GET']);
});
test('retry never silently repeats a subscription creation or cancellation',async()=>{
 for(const action of ['subscribe','cancel']){
  const initial=action==='cancel'?paid:expired;
  const p=await page([initial,Error('lost response'),initial]);
  p.get('billingConsent').checked=true;p.get('billingConsent').onchange();
  p.get(action==='cancel'?'billingCancel':'billingSubscribe').onclick();
  await new Promise(resolve=>setImmediate(resolve));
  await p.get('billingRetry').onclick();assert.deepEqual(p.calls,['GET',action,'GET']);assert.deepEqual(p.navigation,[]);
 }
});
test('pending and suspended payments do not display paid access',async()=>{
 for(const subscriptionStatus of ['APPROVAL_PENDING','ACTIVE','SUSPENDED']){
  const p=await page([{...expired,subscriptionStatus}]);
  assert.equal(p.get('billingContinue').hidden,true);assert.notEqual(p.get('billingStatus').textContent,'תקופת הניסיון הסתיימה.');assert.equal(p.get('billingSync').hidden,false);
 }
});

test('selected plan price remains correct when account lookup fails',async()=>{
 const p=await page([Error('network failure')],'?plan=premium');
 assert.equal(p.get('price').textContent,'$145');
 assert.match(p.get('billingPlanDetails').textContent,/2,500/);
 assert.doesNotMatch(p.get('billingPlanDetails').textContent,/month|week/);
 assert.equal(p.get('billingRetry').hidden,false);
});
test('verified paid plan overrides a stale selection link',async()=>{
 const p=await page([{...paid,subscriptionMonthlyPrice:115,credits:{planId:'pro',remaining:500,limit:600,resetsAt:Date.now()+86400000}}],'?plan=starter');
 assert.equal(p.get('billingPlan').value,'pro');
 assert.equal(p.get('price').textContent,'$115');
 assert.match(p.get('billingCredits').textContent,/500 מתוך 600/);
});
test('expired authentication clears the previous accounts credit balance',async()=>{
 const p=await page([{...paid,subscriptionMonthlyPrice:115,credits:{planId:'pro',remaining:500,limit:600,resetsAt:Date.now()+86400000}},{httpError:401}]);
 await p.get('billingSync').onclick();
 assert.equal(p.get('billingCredits').textContent,'');
});

test('checkout pilot notice does not overwrite signed-out, trial, or paid status',async()=>{
 const base={...expired,subscriptionStatus:null,paymentPilot:true,checkoutAllowed:false};
 const active={...base,access:true,status:'trial',trialEndsAt:Date.now()+86400000};
 for(const [state,label] of [
  [{...base,authenticated:false},'התחבר לחשבון כדי לקבל 7 ימים בחינם.'],
  [active,'תקופת הניסיון שלך פעילה.'],
  [base,'תקופת הניסיון הסתיימה.']
 ]){
  const p=await page([state]);
  assert.equal(p.get('billingStatus').textContent,label);
  assert.equal(p.get('billingAvailability').hidden,false);
  assert.match(p.get('billingAvailability').textContent,/רכישה תיפתח/);
  assert.equal(p.get('billingCheckout').hidden,true);
  if(state===active)assert.match(p.get('billingDate').textContent,/סיום הניסיון/);
 }
 const p=await page([{...paid,paymentPilot:true,checkoutAllowed:false}]);
 assert.equal(p.get('billingStatus').textContent,'המנוי שלך פעיל.');
 assert.equal(p.get('billingAvailability').hidden,true);
 assert.equal(p.get('billingCancel').hidden,false);
});

test('open checkout and administrator pilot retain distinct controls and notices',async()=>{
 const base={...expired,subscriptionStatus:null,checkoutAllowed:true};
 const publicPage=await page([{...base,paymentPilot:false}]);
 assert.equal(publicPage.get('billingCheckout').hidden,false);
 assert.equal(publicPage.get('billingAvailability').hidden,true);
 assert.equal(publicPage.get('billingSubscribe').disabled,true);
 const adminPage=await page([{...base,paymentPilot:true}]);
 assert.equal(adminPage.get('billingCheckout').hidden,false);
 assert.equal(adminPage.get('billingStatus').textContent,'תקופת הניסיון הסתיימה.');
 assert.match(adminPage.get('billingAvailability').textContent,/חיוב אמיתי ומתחדש/);
});
