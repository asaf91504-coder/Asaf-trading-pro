import test from 'node:test';
import assert from 'node:assert/strict';
import {aiProviderConfig,openaiRequestBody,requestAI,OPENAI_MODEL,OPENAI_MAX_TEXT_BYTES} from '../server/ai-provider.mjs';
import {historyForModel} from '../conversation-context.mjs';
import handler from '../netlify/functions/free-chat.mjs';
import {env as authEnv,fixture,seed,request} from './identity-fixture.mjs';

const config={ASAF_AI_PROVIDER:'openai',ASAF_OPENAI_ENABLED:'true',OPENAI_API_KEY:'test-openai-secret',OPENROUTER_API_KEY:'test-other-secret'};
const messages=[{role:'system',content:'Explain market data; Spanish response.'},{role:'user',content:'Explain MA20'},{role:'assistant',content:'It is an average.'},{role:'user',content:'How does that compare with MA150?'}];
const completed=(text='A moving average smooths prices.')=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}]});
test('OpenAI requires explicit opt-in, a key and the reviewed model; no implicit paid fallback',()=>{
 assert.equal(aiProviderConfig({OPENAI_API_KEY:'test'}).provider,'openrouter');
 for(const patch of [{ASAF_OPENAI_ENABLED:'false'},{OPENAI_API_KEY:''},{OPENAI_MODEL:'unreviewed-expensive-model'}])assert.equal(aiProviderConfig({...config,...patch}).enabled,false);
 assert.equal(aiProviderConfig({...config,ASAF_AI_PROVIDER:'unknown'}).enabled,false);
});
test('Responses request uses the organization key, stateless history, bounded output and no hosted tools',async()=>{
 const calls=[];
 const result=await requestAI({messages,env:config,fetcher:async(url,options)=>{calls.push({url,options});return Response.json(completed())}});
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.openai.com/v1/responses');
 assert.equal(calls[0].options.headers.Authorization,'Bearer test-openai-secret');
 const body=JSON.parse(calls[0].options.body);
 assert.equal(body.store,false);assert.equal(body.stream,false);assert.equal(body.service_tier,'default');assert.equal(body.max_output_tokens,1800);assert.equal(body.tools,undefined);assert.equal(body.provider,undefined);assert.equal(body.model,OPENAI_MODEL);
 assert.deepEqual(body.input,messages.slice(1));assert.equal(body.instructions,messages[0].content);
 assert.equal(result.provider,'openai');assert.equal(result.model,OPENAI_MODEL);assert.doesNotMatch(JSON.stringify(result),/test-.*secret/);
});
test('OpenAI images use input_image with low detail; oldest history is removed before text bounds are exceeded',()=>{
 const body=openaiRequestBody([{role:'system',content:'system'},...Array.from({length:24},(_,i)=>({role:i%2?'assistant':'user',content:'א'.repeat(2000)})),{role:'user',content:[{type:'text',text:'current question'},{type:'image_url',image_url:{url:'data:image/png;base64,AAAA'}}]}]);
 assert.equal(body.input.at(-1).content[1].type,'input_image');assert.equal(body.input.at(-1).content[1].detail,'low');
 const bytes=Buffer.byteLength(body.instructions)+body.input.reduce((n,m)=>n+(typeof m.content==='string'?Buffer.byteLength(m.content):Buffer.byteLength(m.content[0].text)),0);
 assert.ok(bytes<=OPENAI_MAX_TEXT_BYTES);assert.ok(body.input.length<25);
 assert.throws(()=>openaiRequestBody([{role:'system',content:'system'},{role:'user',content:'x'.repeat(OPENAI_MAX_TEXT_BYTES)}]),e=>e.code==='model_input_too_large');
});
test('quota errors, malformed output and truncation never retry or use the other provider',async()=>{
 for(const status of [401,429,500]){
  let calls=0;await assert.rejects(requestAI({messages,env:config,fetcher:async()=>{calls++;return Response.json({error:{code:'credit_balance_exhausted',message:'secret upstream body'}},{status})}}),e=>!e.message.includes('secret')&&(status!==429||e.code==='provider_credits_exhausted'));
  assert.equal(calls,1);
 }
 let calls=0;
 await assert.rejects(requestAI({messages,env:config,fetcher:async()=>{calls++;return Response.json({status:'completed',output:[]})}}));assert.equal(calls,1);
 const result=await requestAI({messages,env:config,fetcher:async()=>Response.json({...completed('partial'),status:'incomplete',incomplete_details:{reason:'max_output_tokens'}})});assert.equal(result.truncated,true);
});

let tick=Date.now();
async function withRoute(fn,patch={}){
 const previous={...process.env},oldFetch=global.fetch,oldNow=Date.now;tick+=61000;Date.now=()=>tick;
 const state=fixture(),user=seed(state),calls=[];
 Object.assign(process.env,{...authEnv,...config,ASAF_WEEKLY_CREDITS_ENABLED:'false',...patch});
 global.fetch=async(url,options)=>{
  if(String(url)==='https://test.upstash.io')return Response.json({result:await state.run(JSON.parse(options.body))});
  assert.equal(String(url),'https://api.openai.com/v1/responses');calls.push(JSON.parse(options.body));
  return Response.json(completed(JSON.stringify({answer:'MA20 follows the last 20 bars.',actions:[{type:'indicator',indicator:'MA20',enabled:true}]})));
 };
 try{await fn({state,user,calls})}finally{process.env=previous;global.fetch=oldFetch;Date.now=oldNow}
}
test('authenticated OpenAI chat retains language, history and validated chart actions',async()=>withRoute(async({user,calls})=>{
 const response=await handler(request('free-chat',{message:'Add MA20',language:'es',chartControl:true,history:[{role:'user',content:'Compare moving averages.'}]},user.cookie));
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.provider,'openai');assert.equal(body.model,OPENAI_MODEL);assert.equal(body.actions[0].indicator,'MA20');
 assert.match(calls[0].instructions,/Response language: Spanish/);assert.equal(calls[0].input[0].content,'Compare moving averages.');
}));
test('anonymous, disabled configuration and exhausted durable quota stop before OpenAI',async()=>{
 await withRoute(async({calls})=>{assert.equal((await handler(request('free-chat',{message:'Explain MA20'}))).status,401);assert.equal(calls.length,0)});
 await withRoute(async({user,calls})=>{assert.equal((await handler(request('free-chat',{message:'Explain MA20'},user.cookie))).status,503);assert.equal(calls.length,0)},{OPENAI_API_KEY:''});
 await withRoute(async({state,user,calls})=>{state.allowed=false;assert.equal((await handler(request('free-chat',{message:'Explain MA20'},user.cookie))).status,429);assert.equal(calls.length,0)});
});
test('current Twelve Data, sourced images, legacy Intrinio and crypto are blocked before provider calls',async()=>withRoute(async({user,calls})=>{
 for(const payload of [{source:'Twelve Data'},{useServerMarket:true},{source:'Intrinio'},{source:'CoinLore'},{image:'data:image/png;base64,AAAA'},{bars:[]},{chartToolReceipt:'close was 123'}]){
  const r=await handler(request('free-chat',{message:'Analyze the chart',...payload},user.cookie));assert.equal(r.status,403);assert.equal((await r.json()).code,'ai_provider_license_pending');
 }assert.equal(calls.length,0);
},{ASAF_TWELVE_PRIVATE_TRIAL:'true'}));
test('a restricted conversation is isolated including derived follow-ups after clearing the chart',async()=>withRoute(async({user,calls})=>{
 const history=[{role:'user',content:'Explain MA20'},{role:'assistant',content:'restricted twelve price 999',chartContext:{source:'Twelve Data'}},{role:'assistant',content:'restricted crypto 888',chartContext:{source:'CoinLore'}},{role:'assistant',content:'restricted intrinio 777',chartContext:{source:'Intrinio'}},{role:'assistant',content:'derived levels 123.45 after clearing',chartContext:{source:'none'}}];
 const r=await handler(request('free-chat',{message:'Compare MA20 and MA150',history},user.cookie));assert.equal(r.status,200);assert.equal((await r.json()).historyRestricted,true);assert.doesNotMatch(JSON.stringify(calls),/restricted|999|888|777|123.45|derived levels|Explain MA20/);assert.equal(calls[0].input.length,1);
 assert.deepEqual(historyForModel(history,{blockedSources:['Twelve Data','CoinLore'],isolateBlockedHistory:true}),[]);
},{ASAF_TWELVE_PRIVATE_TRIAL:'true'}));
test('OpenAI benefit route never invokes separately billed OpenRouter web search',async()=>withRoute(async({user,calls})=>{
 const response=await handler(request('free-chat',{message:'Search NVDA earnings',webSearch:true},user.cookie));assert.equal(response.status,503);assert.equal((await response.json()).code,'web_search_unavailable');assert.equal(calls.length,0);
}));
test('OpenAI application-credit cost is quoted explicitly before inference',async()=>withRoute(async({user,calls})=>{
 for(const creditConsent of [undefined,1]){
  const response=await handler(request('free-chat',{message:'Explain MA20',creditConsent},user.cookie));assert.equal(response.status,428);assert.equal((await response.json()).maxCredits,4);
 }assert.equal(calls.length,0);
},{ASAF_WEEKLY_CREDITS_ENABLED:'true'}));
test('OpenAI mode never invokes separately billed OpenRouter web search',async()=>withRoute(async({user,calls})=>{
 const response=await handler(request('free-chat',{message:'Look up AAPL news',webSearch:true},user.cookie));assert.equal(response.status,503);assert.equal(calls.length,0);
}));
