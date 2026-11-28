import test from 'node:test';
import assert from 'node:assert/strict';
import {scannerJson} from '../venture-scanner-ui.mjs';
const endpoint='https://example.invalid/scanner';

test('scanner request uses hard deadline and parent cancellation without AbortSignal.any',async()=>{
 const original=AbortSignal.any;
 try{
  AbortSignal.any=undefined;
  const req=new AbortController();
  const ok=await scannerJson(async (url,options)=>{
   assert.equal(url,endpoint);
   assert.equal(options.method,'POST');
   assert.notEqual(options.signal,req.signal);
   return Response.json({records:[]});
  },endpoint,{method:'POST'},req.signal,500);
  assert.deepEqual(ok.data,{records:[]});
  const wait=async (_,{signal})=>await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  const pending=scannerJson(wait,endpoint,{},req.signal,500);
  req.abort(new DOMException('Cancelled','AbortError'));
  await assert.rejects(pending,{name:'AbortError'});
  await assert.rejects(scannerJson(wait,endpoint,{},new AbortController().signal,4),{name:'TimeoutError'});
  await assert.rejects(scannerJson(()=>assert.fail('pre-aborted must not fetch'),endpoint,{},req.signal,500),{name:'AbortError'});
 }finally{AbortSignal.any=original;}
});

// Exercise the same request wrapper used by discovery, manual scans and filters.
test('explicit expired-trial and paid-scanner denials navigate to local plan selection',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'location'),destinations=[];
 Object.defineProperty(globalThis,'location',{configurable:true,value:{assign:url=>destinations.push(url)}});
 try{
  for(const method of ['GET','POST'])for(const code of ['subscription_required','paid_subscription_required']){
   const result=await scannerJson(async()=>Response.json({code,subscriptionUrl:'https://foreign.invalid/checkout'},{status:402}),endpoint,{method},new AbortController().signal,500);
   assert.equal(result.response.status,402);assert.equal(destinations.at(-1),'/subscription.html');
  }
  assert.equal(destinations.length,4);
  for(const [status,code] of [[200,'subscription_required'],[401,'authentication_required'],[403,'license_required'],[402,'credits_exhausted'],[429,'rate_limited'],[503,'billing_unavailable']]){
   await scannerJson(async()=>Response.json({code},{status}),endpoint,{},new AbortController().signal,500);
  }
  assert.equal(destinations.length,4,'auth, quota and provider outages must not redirect to payment');
  await assert.rejects(scannerJson(async()=>{throw Error('Offline')},endpoint,{},new AbortController().signal,500));
  assert.equal(destinations.length,4);
 }finally{if(original)Object.defineProperty(globalThis,'location',original);else delete globalThis.location;}
});
