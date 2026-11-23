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
