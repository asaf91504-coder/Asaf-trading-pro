import test from 'node:test';
import assert from 'node:assert/strict';
import {requestSetups,setupLoadingMessage} from '../setup-loading.mjs';
import {languageNames} from '../interface-language.mjs';
const data={reviewer:false,published:[]};
test('mobile timeout is localized, releases the request and does not need AbortSignal.timeout',async()=>{
 for(const language of Object.keys(languageNames)){
  let calls=0,signal;
  const fetcher=(_url,options)=>{calls++;signal=options.signal;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Fetch is aborted','AbortError')),{once:true}))};
  await assert.rejects(requestSetups(fetcher,{language,timeoutMs:5}),e=>e.message===setupLoadingMessage('timeout',language));assert.equal(signal.aborted,true);assert.equal(calls,1);
 }
});
test('a timed-out save is uncertain, not a claim that the mutation failed or safe to repeat',async()=>{
 const fetcher=(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
 await assert.rejects(requestSetups(fetcher,{body:{action:'save-draft'},timeoutMs:5}),e=>e.message===setupLoadingMessage('uncertain','he'));
});
test('gateway, network, authentication and malformed data failures stay actionable without retrying',async()=>{
 const cases=[
  [async()=>{throw new TypeError('Failed to fetch')},'network'],
  [async()=>new Response('<html>504</html>',{status:504}),'invalid'],
  [async()=>Response.json(null),'invalid'],
  [async()=>Response.json({reviewer:false,published:'wrong'}),'invalid']
 ];
 for(const [fetcher,key] of cases)await assert.rejects(requestSetups(fetcher),e=>e.message===setupLoadingMessage(key,'he'));
 await assert.rejects(requestSetups(async()=>Response.json({error:'sign in required'},{status:401})),e=>e.status===401);
 assert.deepEqual(await requestSetups(async()=>Response.json(data)),data);
});
