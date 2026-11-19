import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../netlify/functions/free-chat.mjs';
import {chatThrottleCopy} from '../chat-throttle-copy.mjs';
import {languageNames} from '../interface-language.mjs';
import {env as authEnv,fixture,request,seed} from './identity-fixture.mjs';
import {billingIdentity,saveBilling} from '../server/billing.mjs';
import {MarketError} from '../server/market-feed.mjs';

const owner='offline-test-owner-code-only';
let clock=Date.parse('2026-11-19T14:00:00Z');
async function fixtureRun(fn,{publicMode=false,patch={},store,upstream}={}){
 const env=process.env,fetcher=globalThis.fetch,now=Date.now,models=[];
 clock+=61000;Date.now=()=>clock;
 const storeFixture=fixture(),user=seed(storeFixture);
 process.env={ASAF_AI_PROVIDER:'openrouter',ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'fixture-only',ASAF_FREE_AI_ACCESS_CODE:owner,...authEnv,ASAF_PUBLIC_AUTH_ENABLED:String(publicMode),...patch};
 globalThis.fetch=async (url,options)=>{
  const body=JSON.parse(options.body);
  if(url==='https://test.upstash.io')return Response.json({result:await (store??((a,s)=>s.run(a)))(body,storeFixture)});
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions','Unexpected outbound URL');
  models.push(body);
  assert.ok(upstream,'Unexpected fake-provider call');
  return upstream();
 };
 const ask=(language,body={})=>{
  const payload={message:'Explain moving averages',symbol:'AAPL',language,...body};
  if(publicMode)return handler(request('free-chat',payload,user.cookie));
  return handler(new Request('https://example.test/.netlify/functions/free-chat',{method:'POST',headers:{'content-type':'application/json','x-asaf-free-ai-code':owner},body:JSON.stringify(payload)}));
 };
 try{await fn({ask,models,storeFixture,user})}finally{process.env=env;globalThis.fetch=fetcher;Date.now=now}
}
async function localized(result,status,code,locale){
 assert.equal(result.status,status);
 const {code:actual,error,credits}=await result.json();
 assert.equal(actual,code);assert.equal(error,chatThrottleCopy(code,locale));assert.equal(credits,undefined);
 assert.doesNotMatch(error,/fixture|SECRET/);
 if(locale==='he')assert.match(error,/[\u0590-\u05ff]/u);
 else assert.doesNotMatch(error,/[\u0590-\u05ff]/u);
}
const quotaCommand=a=>a[0]==='EVAL'&&a[1].includes('i==2 and 120');
for(const locale of Object.keys(languageNames)){
 for(const gated of [false,true])test(`throttle ${locale}: minute limit ${gated?'before attached news':'on ordinary chat'} blocks at exactly the same threshold`,async()=>fixtureRun(async({ask,models})=>{
  // An unavailable durable quota prevents provider calls while exercising admission.
  for(let i=0;i<6;i++)assert.equal((await ask(locale)).status,503);
  await localized(await ask(locale,{includeNews:gated}),429,'chat_rate_limited',locale);
  assert.equal(models.length,0);
 },{patch:{ASAF_FREE_AI_DURABLE_QUOTA:'true',ASAF_EXTERNAL_SERVICES_APPROVED:'false'}}));
 test(`throttle ${locale}: shared store denial blocks before the model`,async()=>fixtureRun(async({ask,models})=>{
  await localized(await ask(locale),429,'chat_shared_quota_exhausted',locale);assert.equal(models.length,0);
 },{publicMode:true,store:(a,s)=>quotaCommand(a)?0:s.run(a)}));
 test(`throttle ${locale}: shared store failure hides details and keeps 503`,async()=>fixtureRun(async({ask,models})=>{
  await localized(await ask(locale),503,'chat_quota_unavailable',locale);assert.equal(models.length,0);
 },{publicMode:true,store:(a,s)=>{if(quotaCommand(a))throw Error('SECRET store exception');return s.run(a)}}));
 test(`throttle ${locale}: missing durable quota configuration keeps 503 and never calls AI`,async()=>fixtureRun(async({ask,models})=>{
  await localized(await ask(locale),503,'chat_quota_unavailable',locale);assert.equal(models.length,0);
 },{patch:{ASAF_FREE_AI_DURABLE_QUOTA:'true',ASAF_EXTERNAL_SERVICES_APPROVED:'false'}}));
 const upstreamModes=[
  ['insufficient provider credits',()=>Response.json({error:{code:'insufficient_quota',message:'SECRET'}},{status:429}),'provider_credits_exhausted'],
  ['ordinary upstream rate limit',()=>Response.json({error:{code:'rate_limit_exceeded',message:'SECRET'}},{status:429}),'provider_rate_limited'],
  ['non-JSON upstream response',()=>new Response('<html>SECRET upstream</html>',{status:429}),'provider_rate_limited'],
 ];
 for(const [label,upstream,code] of upstreamModes)test(`throttle ${locale}: ${label} has a localized stable code with no retry`,async()=>fixtureRun(async({ask,models})=>{
  await localized(await ask(locale),429,code,locale);assert.equal(models.length,1);
 },{upstream}));
 test(`throttle ${locale}: monthly web search exhaustion never sends a search or a model request`,async()=>fixtureRun(async({ask,models})=>{
  await localized(await ask(locale,{webSearch:true}),429,'chat_web_search_quota_exhausted',locale);assert.equal(models.length,0);
 },{patch:{ASAF_WEB_SEARCH_APPROVED:'true',ASAF_WEB_SEARCH_MONTHLY_LIMIT:'1'},store:(a,s)=>a.some(v=>String(v).includes('web-search:month:'))?0:s.run(a)}));
 test(`throttle ${locale}: a typed market preparation 429 retains status and never reaches inference`,async()=>fixtureRun(async({ask,models})=>{
  await localized(await ask(locale,{source:'Twelve Data',useServerMarket:true}),429,'chat_market_rate_limited',locale);assert.equal(models.length,0);
 },{publicMode:true,patch:{ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',TWELVE_DATA_API_KEY:'fixture-only',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL'},
 store:(a,s)=>{if(a[0]==='GET'&&String(a[1]).includes('market:snapshot:'))throw new MarketError('SECRET market-server fixture',429);return s.run(a)}}));
}

for(const trigger of ['app','provider'])test(`localized 429 refunds exactly one reserved application credit (${trigger})`,async()=>{
 const events=[];
 await fixtureRun(async({ask,models,storeFixture,user})=>{
  const options={env:process.env,run:storeFixture.run};
  const identity=await billingIdentity(user.record.id,options);
  await saveBilling(identity,{trialStartedAt:clock-1000,trialEndsAt:clock-1000+7*86400000},options);
  // OpenRouter legacy route reserves one application credit for consent value 1.
  await localized(await ask('ru',{creditConsent:1}),429,trigger==='app'?'chat_shared_quota_exhausted':'provider_rate_limited','ru');
  assert.deepEqual(events,['reserve','refund']);assert.equal(models.length,trigger==='app'?0:1);
 },{publicMode:true,patch:{ASAF_WEEKLY_CREDITS_ENABLED:'true'},
  upstream:()=>Response.json({error:{code:'rate_limit_exceeded'}},{status:429}),
  store:(a,s)=>{
   if(a[0]==='EVAL'&&a[1].includes('trial-total-migration'))return 1;
   if(a[0]==='EVAL'&&a[1].includes('weekly-credit-reserve')){assert.equal(a[5],'1');events.push('reserve');return 1}
   if(a[0]==='EVAL'&&a[1].includes('weekly-credit-refund')){events.push('refund');return 1}
   return quotaCommand(a)&&trigger==='app'?0:s.run(a);
  }});
});
for(const locale of [undefined,'not-a-language'])test(`throttle uses Hebrew fallback when language is ${String(locale)}`,async()=>fixtureRun(async({ask,models})=>{
 await localized(await ask(locale),429,'chat_shared_quota_exhausted','he');assert.equal(models.length,0);
},{publicMode:true,store:(a,s)=>quotaCommand(a)?0:s.run(a)}));
