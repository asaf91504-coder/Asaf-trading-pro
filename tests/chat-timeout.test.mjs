import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/free-chat.mjs';

test('model can finish after the former 18s deadline but is aborted at 45s without retry',async t=>{
 const keys=['ASAF_FREE_AI_ENABLED','OPENROUTER_API_KEY','ASAF_FREE_AI_ACCESS_CODE','ASAF_PUBLIC_AUTH_ENABLED','ASAF_FREE_AI_DURABLE_QUOTA'];
 const saved=keys.map(k=>process.env[k]),originalFetch=globalThis.fetch;
 const pass='test_private_access_code_for_timeout';
 t.mock.timers.enable({apis:['setTimeout']});
 try{
  keys.forEach(k=>delete process.env[k]);Object.assign(process.env,{ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'test_only',ASAF_FREE_AI_ACCESS_CODE:pass});
  let calls=0,signal,entered;
  const ready=new Promise(resolve=>entered=resolve);
  globalThis.fetch=async(url,options)=>{calls++;signal=options.signal;const body=JSON.parse(options.body);assert.equal(body.model,'openrouter/free');assert.equal(body.provider.sort,'latency');entered();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Timeout','AbortError')),{once:true}))};
  const response=handler(new Request('https://asaf.example/.netlify/functions/free-chat',{method:'POST',headers:{'content-type':'application/json','x-asaf-free-ai-code':pass},body:JSON.stringify({message:'נתח את המגמה'})}));
  await ready;t.mock.timers.tick(18001);assert.equal(signal.aborted,false);
  t.mock.timers.tick(27000);assert.equal(signal.aborted,true);
  assert.equal((await (await response).json()).code,'model_timeout');assert.equal(calls,1);
 }finally{globalThis.fetch=originalFetch;keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);t.mock.timers.reset()}
});
