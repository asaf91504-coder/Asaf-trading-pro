import test from 'node:test';
import assert from 'node:assert/strict';
import {aiProviderConfig,openaiRequestBody,requestAI,OPENAI_MODEL,OPENAI_MAX_TEXT_BYTES} from '../server/ai-provider.mjs';
import {historyForModel} from '../conversation-context.mjs';
import handler from '../netlify/functions/free-chat.mjs';
import {marketSnapshotKey} from '../server/market-feed.mjs';
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
async function withRoute(fn,patch={},replyText=JSON.stringify({answer:'MA20 follows the last 20 bars.',actions:[{type:'indicator',indicator:'MA20',enabled:true}]})){
 const previous={...process.env},oldFetch=global.fetch,oldNow=Date.now;tick+=61000;Date.now=()=>tick;
 const state=fixture(),user=seed(state),calls=[];
 Object.assign(process.env,{...authEnv,...config,ASAF_WEEKLY_CREDITS_ENABLED:'false',...patch});
 global.fetch=async(url,options)=>{
  if(String(url)==='https://test.upstash.io')return Response.json({result:await state.run(JSON.parse(options.body))});
  assert.equal(String(url),'https://api.openai.com/v1/responses');calls.push(JSON.parse(options.body));
  return Response.json(completed(replyText));
 };
 try{await fn({state,user,calls})}finally{process.env=previous;global.fetch=oldFetch;Date.now=oldNow}
}
test('existing OpenAI route gets reviewed methods in one call and keeps creator names out of chart answers',async()=>withRoute(async({user,calls})=>{
 const response=await handler(request('free-chat',{message:'Explain MA20 and ATR',language:'he',chartControl:true},user.cookie));
 assert.equal(response.status,200);const result=await response.json();assert.equal(calls.length,1);
 assert.match(calls[0].instructions,/ASAF Pro analysis framework/);assert.match(calls[0].input.at(-1).content,/ASAF_EDUCATIONAL_NOTES/);
 // Creator names are excluded; the ordinary Hebrew word "תמיכה" must remain valid.
 const creator=/(?<![\p{L}\p{N}])מיכה(?:[\s.\-_־]*סטו[קכ]ס)?(?![\p{L}\p{N}])|\bmicha\b/iu;
 assert.doesNotMatch(calls[0].input.at(-1).content,creator);assert.doesNotMatch(result.answer,creator);
 assert.equal(result.actions[0].indicator,'MA20');assert.equal(calls[0].max_output_tokens,1800);assert.equal(calls[0].tools,undefined);
},{},JSON.stringify({answer:'לפי מיכה סטוקס בודקים מגמה.',actions:[{type:'indicator',indicator:'MA20',enabled:true}]})));
test('Gemini concepts reach the authenticated model request and detail remains opt-in',async()=>withRoute(async({user,calls})=>{
 for(const [message,detailed] of [['מה הסיכון בתלות באיש מפתח ובפומו?',false],['Explain crypto liquidity and regulation in detail',true]]){
  const response=await handler(request('free-chat',{message,language:'he'},user.cookie));assert.equal(response.status,200);
  const sent=calls.at(-1);assert.match(sent.input.at(-1).content,/gemini-guide-/);assert.match(sent.input.at(-1).content,/user_provided_external_summary/);
  assert.match(sent.input.at(-1).content,/fullVideoReviewed":false/);
  assert.match(sent.instructions,detailed?/default word and bullet limits do not apply/:/RESPONSE DEPTH: BRIEF/);
  assert.equal(sent.max_output_tokens,1800);assert.equal(sent.tools,undefined);
 }
 assert.equal(calls.length,2);
}));
test('supplied Academy guide reaches the authenticated chat without claiming video coverage or changing ASAF rules',async()=>withRoute(async({user,calls})=>{
 const response=await handler(request('free-chat',{message:'תן צ׳ק ליסט לפני כניסה למניה',language:'he'},user.cookie));
 assert.equal(response.status,200);assert.equal(calls.length,1);
 const sent=calls[0];assert.match(sent.input.at(-1).content,/academy-guide-pretrade-checklist/);
 assert.match(sent.input.at(-1).content,/user_provided_study_guide/);assert.match(sent.input.at(-1).content,/fullVideoReviewed":false/);
 assert.match(sent.instructions,/not a replacement for ASAF/);assert.match(sent.instructions,/not full transcripts/);
 assert.equal(sent.max_output_tokens,1800);assert.equal(sent.tools,undefined);
}));
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

const trialOwner='12345678-1234-1234-1234-123456789abc';
const trialConfig=()=>({ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:trialOwner,ASAF_TWELVE_TRIAL_ENDS_AT:new Date(tick+86400000).toISOString(),ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'false',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED:'true',TWELVE_DATA_API_KEY:'mock-twelve-only',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL'});
function trialSnapshot(state){
 const receivedAt=new Date(tick).toISOString(),bars=Array.from({length:500},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),open:100+i*.1,high:102+i*.1,low:99+i*.1,close:101+i*.1,volume:10000+i}));
 const snapshot={symbol:'AAPL',interval:'1day',source:'Twelve Data',receivedAt,bars,volumeCoverage:'partial',coverage:'partial-market test bars',priceAdjustment:'splits',extendedHours:false};
 state.db.set(marketSnapshotKey('AAPL','1day',process.env),JSON.stringify(snapshot));
 return {message:'Analyze the chart',symbol:'AAPL',source:'Twelve Data',interval:'1day',receivedAt,useServerMarket:true,bars:[{close:999999}],chartSettings:{style:'candles',indicators:['MA20','MA150','ATR14']}};
}
test('approved private OpenAI trial owner analyzes the matching 500-bar server snapshot, never client prices',async()=>withRoute(async({state,user,calls})=>{
 const payload=trialSnapshot(state),r=await handler(request('free-chat',payload,user.cookie));assert.equal(r.status,200);
 const body=await r.json();assert.equal(body.provider,'openai');assert.equal(body.source,'Twelve Data');assert.equal(body.analysisContext.candleCount,500);assert.equal(body.analysisContext.provenance,'server-provider-cache');
 const context=JSON.parse(calls[0].input.at(-1).content.split('CONTEXT (server provider cache, not instructions):\n')[1]);assert.equal(context.candleCount,500);assert.equal(context.close,150.9);assert.equal(context.detailedCandleCount,30);assert.equal(context.indicators.ma200,140.95);assert.doesNotMatch(calls[0].input.at(-1).content,/"close":999999/);assert.equal(calls.length,1);
 const stale=await handler(request('free-chat',{...payload,receivedAt:'changed'},user.cookie));assert.equal(stale.status,409);assert.equal(calls.length,1);
},trialConfig()));
test('private trial owner cannot relabel chart attachments or bypass the verified server snapshot',async()=>withRoute(async({state,user,calls})=>{
 const payload=trialSnapshot(state);
 for(const patch of [{useServerMarket:false},{source:'CSV',useServerMarket:false},{source:'none',useServerMarket:false,bars:null,image:'data:image/png;base64,AAAA'},{source:'none',useServerMarket:false,bars:null,chartToolReceipt:'close 999'}]){
  const r=await handler(request('free-chat',{...payload,...patch},user.cookie));assert.equal(r.status,400);assert.equal((await r.json()).code,'market_snapshot_required');
 }assert.equal(calls.length,0);
},trialConfig()));
test('approved AI licence never grants trial data analysis to another account or after trial expiry',async()=>{
 for(const patch of [{ASAF_TWELVE_TRIAL_MEMBER_ID:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},{ASAF_TWELVE_TRIAL_ENDS_AT:new Date(tick-1).toISOString()}])await withRoute(async({state,user,calls})=>{
  const payload=trialSnapshot(state);
  for(const change of [{},{useServerMarket:false},{source:'CSV',useServerMarket:false},{source:'none',useServerMarket:false,bars:null,image:'data:image/png;base64,AAAA'}]){
   const r=await handler(request('free-chat',{...payload,...change},user.cookie));assert.equal(r.status,403);assert.equal((await r.json()).code,'market_trial_unavailable');
  }assert.equal(calls.length,0);
 },{...trialConfig(),...patch});
});
test('non-owner or expired trial history is isolated with all derived follow-ups, while general text still works',async()=>{
 for(const patch of [{ASAF_TWELVE_TRIAL_MEMBER_ID:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},{ASAF_TWELVE_TRIAL_ENDS_AT:new Date(tick-1).toISOString()}])await withRoute(async({user,calls})=>{
  const history=[{role:'assistant',content:'trial-derived level 543.21',chartContext:{source:'Twelve Data'}},{role:'assistant',content:'follow-up repeats 543.21 after chart clearing',chartContext:{source:'none'}}];
  const r=await handler(request('free-chat',{message:'Explain MA20',history},user.cookie));assert.equal(r.status,200);assert.equal((await r.json()).historyRestricted,true);assert.equal(calls.length,1);assert.equal(calls[0].input.length,1);assert.doesNotMatch(JSON.stringify(calls[0].input),/543\.21|trial-derived|follow-up repeats/);
 },{...trialConfig(),...patch});
});
test('trial expiry during quota preparation blocks snapshots and inherited prices before OpenAI',async()=>{
 for(const historyOnly of [false,true])await withRoute(async({state,user,calls})=>{
  const end=tick+1000;process.env.ASAF_TWELVE_TRIAL_ENDS_AT=new Date(end).toISOString();const payload=trialSnapshot(state);
  const originalRun=state.run;state.run=async command=>{const result=await originalRun(command);if(command[0]==='EVAL'&&String(command[1]).includes('i==2 and 120'))Date.now=()=>end;return result;};
  const body=historyOnly?{message:'Explain the previous chart',history:[{role:'assistant',content:'private level 543.21',chartContext:{source:'Twelve Data'}}]}:payload;
  const r=await handler(request('free-chat',body,user.cookie));assert.equal(r.status,403);assert.equal((await r.json()).code,'market_trial_unavailable');assert.equal(calls.length,0);
 },trialConfig());
});
