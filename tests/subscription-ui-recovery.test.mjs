import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../subscription-ui.mjs',import.meta.url),'utf8');
const expired={enabled:true,ready:true,authenticated:true,access:false,status:'expired',canCancel:false,subscriptionStatus:'APPROVAL_PENDING'};
const paid={...expired,access:true,status:'paid',subscriptionStatus:'ACTIVE',canCancel:true,paidUntil:Date.now()+86400000};
async function page(responses,search=''){
 const elements=new Map(),calls=[],navigation=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{hidden:true,disabled:false,checked:false,textContent:''});return elements.get(id);};
 const context={URL,URLSearchParams,Intl,Date,AbortSignal,document:{getElementById:get,documentElement:{lang:'he'}},window:{confirm:()=>true,addEventListener(){}},history:{replaceState(){}},location:{search,assign:url=>navigation.push(url)},fetch:async(_url,options)=>{
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
  p.get('billingConsent').checked=true;
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
