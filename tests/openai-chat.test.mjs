import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/free-chat.mjs';
import {openAIBlock,openAIRequest,OPENAI_MODEL} from '../server/chat-provider.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
import {billingIdentity,saveBilling} from '../server/billing.mjs';
const owner='12345678-1234-1234-1234-123456789abc';
const configured={...authEnv,ASAF_CHAT_PROVIDER:'openai',ASAF_OPENAI_ENABLED:'true',ASAF_OPENAI_FUNDING_VERIFIED:'true',ASAF_OPENAI_FUNDING_EXPIRES_AT:'2099-01-01',ASAF_OPENAI_MEMBER_ID:owner,OPENAI_API_KEY:'mock-openai',ASAF_WEEKLY_CREDITS_ENABLED:'true',ASAF_BILLING_ENABLED:'false'};
const approved={ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:owner,ASAF_TWELVE_TRIAL_ENDS_AT:'2099-01-01'};
let time=Date.now();
async function simulate(overrides,fn,provider=()=>Response.json({choices:[{message:{content:'A moving average smooths past prices.'},finish_reason:'stop'}]})){
 const saved={...process.env},oldFetch=globalThis.fetch,oldNow=Date.now;time+=61000;Date.now=()=>time;
 const f=fixture(),user=seed(f),calls=[];let charged=0,refunds=0,quotaAllowed=true,refundErrors=0,refundAttempts=0;
 try{
  for(const k of Object.keys(process.env))if(k.startsWith('ASAF_')||k.startsWith('OPENAI_')||k==='CONTEXT')delete process.env[k];
  Object.assign(process.env,configured,overrides);
  const identity=await billingIdentity(owner,{env:process.env,run:f.run});
  await saveBilling(identity,{trialStartedAt:time-1000,trialEndsAt:time-1000+7*86400000},{env:process.env,run:f.run});
  globalThis.fetch=async(url,options)=>{
   const body=JSON.parse(options.body);
   if(url===authEnv.ASAF_REDIS_REST_URL){
    let result;
    if(body[1]?.includes('trial-total-migration'))result=1;
    else if(body[1]?.includes('weekly-credit-reserve')){charged++;result=charged;}
    else if(body[1]?.includes('weekly-credit-refund')){refundAttempts++;if(refundErrors-->0)return new Response('',{status:503});charged--;refunds++;result=1;}
    else if(body[1]?.startsWith('for i=1,#KEYS'))result=quotaAllowed?1:0;
    else result=await f.run(body);
    return Response.json({result});
   }
   calls.push({url,body,headers:options.headers});return provider();
  };
  await fn({send:(body={},cookie=user.cookie)=>handler(request('free-chat',{message:'Explain moving averages',creditConsent:1,...body},cookie)),calls,get charged(){return charged},get refunds(){return refunds},denyQuota:()=>{quotaAllowed=false},failRefunds:n=>{refundErrors=n},get refundAttempts(){return refundAttempts}});
 }finally{globalThis.fetch=oldFetch;Date.now=oldNow;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
}
test('direct OpenAI uses authenticated route, bounded model and one credit',async()=>simulate({},async s=>{
 const r=await s.send();assert.equal(r.status,200);assert.equal((await r.json()).credits.charged,1);assert.equal(s.charged,1);assert.equal(s.calls.length,1);const c=s.calls[0];assert.equal(c.url,'https://api.openai.com/v1/chat/completions');assert.equal(c.body.model,OPENAI_MODEL);assert.equal(c.body.store,false);assert.equal(c.body.max_completion_tokens,1800);assert.equal(c.body.provider,undefined);
}));
test('unauthenticated, other member, funding and consent gates prevent inference',async()=>{
 for(const overrides of [{ASAF_OPENAI_MEMBER_ID:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},{ASAF_OPENAI_ENABLED:'false'},{ASAF_OPENAI_FUNDING_VERIFIED:'false'},{ASAF_OPENAI_FUNDING_EXPIRES_AT:'2020-01-01'},{OPENAI_API_KEY:''}])await simulate(overrides,async s=>{assert.notEqual((await s.send()).status,200);assert.equal(s.calls.length,0);assert.equal(s.charged,0)});
 await simulate({},async s=>{assert.equal((await s.send({},'')).status,401);assert.equal((await s.send({creditConsent:0})).status,428);assert.equal(s.calls.length,0)});
});
test('Twelve Data, disguised bars, screenshots, derived and legacy history fail closed',async()=>{
 for(const payload of [{source:'Twelve Data'},{useServerMarket:true},{source:'CSV',bars:[]},{image:'data:image/png;base64,YQ=='},{history:[{role:'assistant',content:'price 123',chartContext:{source:'Twelve Data'}}]},{history:[{role:'assistant',content:'price 123'}]},{chartToolReceipt:'price 123'}])await simulate({},async s=>{const r=await s.send(payload);assert.equal(r.status,403);assert.equal((await r.json()).code,'openai_data_approval_required');assert.equal(s.calls.length,0);assert.equal(s.charged,0)});
 assert.ok(openAIBlock({id:owner},{bars:[]},{...configured,...approved,ASAF_TWELVE_TRIAL_ENDS_AT:'2020-01-01'}));
});
test('approved history and validated chart actions stay on same complete route',async()=>simulate(approved,async s=>{
 const r=await s.send({chartControl:true,history:[{role:'user',content:'What is MA20?'},{role:'assistant',content:'A twenty-bar average.'}],message:'Show MA20'});assert.equal(r.status,200);const body=await r.json();assert.equal(body.actions[0].type,'indicator');assert.equal(body.chartActionStatus,'planned');assert.equal(s.calls[0].body.messages[1].content,'What is MA20?');assert.equal(s.charged,1);
},()=>Response.json({choices:[{message:{content:JSON.stringify({answer:'I propose showing MA20.',actions:[{type:'indicator',indicator:'MA20',enabled:true}]})}}]})));
test('provider failures, timeout, empty and malformed outputs refund without fallback',async()=>{
 const failures=[()=>new Response('',{status:429}),()=>new Response('',{status:500}),()=>{throw Object.assign(Error('timeout'),{name:'AbortError'})},()=>new Response('{'),()=>Response.json({choices:[]}),()=>Response.json({choices:[{message:{content:'   '}}]}),()=>Response.json({choices:[{message:{content:'ASAF_OUT_OF_SCOPE'}}]})];
 for(const failure of failures)await simulate({},async s=>{assert.notEqual((await s.send()).status,200);assert.equal(s.charged,0);assert.equal(s.refunds,1);assert.equal(s.calls.length,1)},failure);
 await simulate({},async s=>{assert.equal((await s.send({chartControl:true})).status,502);assert.equal(s.charged,0);assert.equal(s.refunds,1)},()=>Response.json({choices:[{message:{content:'not JSON'}}]}));
});
test('durable quota blocks provider and refunds reservation',async()=>simulate({},async s=>{s.denyQuota();assert.equal((await s.send()).status,429);assert.equal(s.charged,0);assert.equal(s.calls.length,0)}));
test('input ceiling handles multibyte text and never accepts a second image',()=>{
 assert.throws(()=>openAIRequest([{role:'user',content:'א'.repeat(15000)}]),{code:'model_input_limit'});
 assert.throws(()=>openAIRequest([{role:'user',content:Array.from({length:2},()=>({type:'image_url',image_url:{url:'data:image/png;base64,YQ=='}}))}]),{code:'model_input_limit'});
 assert.equal(openAIRequest([{role:'user',content:'Explain MA20'}]).store,false);
});

test('refund storage failures retry once and persistent failure is explicit',async()=>{
 for(const failures of [1,2])await simulate({},async s=>{s.failRefunds(failures);const r=await s.send();const body=await r.json();assert.equal(s.refundAttempts,2);assert.equal(s.calls.length,1);if(failures===1){assert.equal(s.charged,0);assert.notEqual(body.code,'credit_refund_pending')}else{assert.equal(s.charged,1);assert.equal(body.code,'credit_refund_pending');assert.equal(body.credits.refundPending,true)}},()=>new Response('',{status:500}));
});
test('approved synthetic candles retain computed analysis and screenshot content',async()=>simulate(approved,async s=>{
 const bars=Array.from({length:35},(_,i)=>({date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:100+i,high:102+i,low:99+i,close:101+i,volume:1000+i}));
 const image='data:image/png;base64,YQ==';const r=await s.send({message:'Explain this chart',source:'CSV',symbol:'QA.TEST',bars,image});assert.equal(r.status,200);const body=await r.json();assert.equal(body.analysisContext.candleCount,35);assert.equal(body.source,'CSV');const content=s.calls[0].body.messages.at(-1).content;assert.equal(content[1].image_url.url,image);assert.match(content[0].text,/last30Candles/);assert.equal(s.charged,1);
}));
