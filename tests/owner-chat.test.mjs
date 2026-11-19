import {chatThrottleCopy} from "../chat-throttle-copy.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/free-chat.mjs';
import {isChatOwner,reserveOwnerChatBurst} from '../server/owner-chat.mjs';
import {env as authEnv,fixture,seed,request,origin} from './identity-fixture.mjs';
import {billingIdentity,saveBilling} from '../server/billing.mjs';
import {createTranslator,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';

const ownerId='12345678-1234-1234-1234-123456789abc';
const otherAdmin='abcdefab-abcd-abcd-abcd-abcdefabcdef';
const customerId='fedcbafe-fedc-fedc-fedc-fedcbafedcba';
const fakePass='legacy-test-long-code-no-secret';
const settings={...authEnv,ASAF_CHAT_OWNER_MEMBER_ID:ownerId,ASAF_ADMIN_MEMBER_IDS:ownerId+','+otherAdmin,ASAF_AI_PROVIDER:'openai',ASAF_OPENAI_ENABLED:'true',OPENAI_API_KEY:'mock-not-real',ASAF_WEEKLY_CREDITS_ENABLED:'true',ASAF_BILLING_ENABLED:'true',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'mock',PAYPAL_CLIENT_SECRET:'mock',PAYPAL_WEBHOOK_ID:'mock',PAYPAL_PLAN_STARTER_ID:'P-TESTSTARTER',PAYPAL_PLAN_PLUS_ID:'P-TESTPLUS',PAYPAL_PLAN_PRO_ID:'P-TESTPRO',PAYPAL_PLAN_PREMIUM_ID:'P-TESTPREMIUM'};
let tick=Date.parse('2026-11-19T14:00:00Z');
async function isolated(fn,{patch={},quotas=0,providerStatus=200}={}){
 const old=process.env,oldFetch=globalThis.fetch,oldNow=Date.now;
 const state=fixture(),calls=[],commands=[],samples=[];
 let time=tick+=61000,failBurst=false,duringRead=null;
 Date.now=()=>time;process.env={...settings,...patch};
 const user={owner:seed(state,'owner@example.test',ownerId,'a'.repeat(64)),admin:seed(state,'admin@example.test',otherAdmin,'b'.repeat(64)),customer:seed(state,'customer@example.test',customerId,'c'.repeat(64))};
 const setTrial=async(target,expired)=>{
  const options={env:process.env,run:state.run};
  const identity=await billingIdentity(user[target].record.id,options);
  const starts=time-(expired?14:1)*86400000;
  await saveBilling(identity,{trialStartedAt:starts,trialEndsAt:starts+7*86400000,trialTotalCredits:0,paidUntil:0},options);
 };
 globalThis.fetch=async (url,options)=>{
  const cmd=JSON.parse(options.body);
  if(url==='https://test.upstash.io'){
   commands.push(cmd);
   if(cmd[0]==='GET'&&cmd[1].includes('auth:session')&&duringRead&&duringRead())return Response.json({result:null});
   if(cmd[0]==='EVAL'&&cmd[1].includes('owner-chat-burst')){
    assert.equal(cmd[2],'1');assert.equal(cmd[3],'asaf:production:ai:owner-burst:'+ownerId);
    if(failBurst)throw Error('offline fixture');
    while(samples.length&&samples[0]<=Number(cmd[4])-15000)samples.shift();
    if(samples.length>=4)return Response.json({result:0});
    samples.push(Number(cmd[4]));return Response.json({result:1});
   }
   if(cmd[0]==='EVAL'&&cmd[1].includes('i==2 and 120'))return Response.json({result:quotas});
   if(cmd[0]==='EVAL'&&cmd[1].includes('trial-total-migration'))return Response.json({result:1});
   if(cmd[0]==='EVAL'&&cmd[1].includes('weekly-credit-reserve'))return Response.json({result:-1});
   return Response.json({result:await state.run(cmd)});
  }
  assert.ok(['https://api.openai.com/v1/responses','https://openrouter.ai/api/v1/chat/completions'].includes(url),'Unapproved test URL');
  calls.push({url,cmd});
  if(providerStatus!==200)return Response.json({error:{code:'rate_limit_exceeded'}},{status:providerStatus});
  return url.includes('openai.com')?Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'A moving average smooths prices.'}]}]}):Response.json({choices:[{message:{content:'A moving average smooths prices.'},finish_reason:'stop'}]});
 };
 const go=(target='owner',body={})=>handler(request('free-chat',{message:'Explain moving averages',language:'en',...body},user[target]?.cookie));
 const control={advance:ms=>time+=ms,failBurst:()=>failBurst=true,revokeDuring:(predicate)=>duringRead=predicate};
 try{await fn({go,user,calls,commands,control,setTrial})}finally{process.env=old;globalThis.fetch=oldFetch;Date.now=oldNow}
}
const ofType=(commands,needle)=>commands.filter(command=>command[0]==='EVAL'&&command[1].includes(needle));

test('chat owner requires the exact configured UUID and current admin membership',()=>{
 assert.equal(isChatOwner({id:ownerId},settings),true);
 for(const id of [undefined,'',ownerId+','+otherAdmin,' '+ownerId,ownerId.toUpperCase(),otherAdmin])assert.equal(isChatOwner({id:ownerId},{...settings,ASAF_CHAT_OWNER_MEMBER_ID:id}),false);
 assert.equal(isChatOwner({id:ownerId},{...settings,ASAF_ADMIN_MEMBER_IDS:otherAdmin}),false);
 assert.equal(isChatOwner({id:otherAdmin},settings),false);
 assert.equal(isChatOwner(null,settings),false);
});
test('burst helper refuses callers other than the configured owner before any storage access',async()=>{
 assert.equal(await reserveOwnerChatBurst({id:otherAdmin},{env:settings,run:()=>assert.fail('Unexpected storage command')}),false);
});
test('owner with expired trial and zero credits can chat without quote, debit, billing query or shared quota',async()=>isolated(async({go,setTrial,calls,commands})=>{
 await setTrial('owner',true);const r=await go();assert.equal(r.status,200);const x=await r.json();assert.equal(x.ownerChatNoAppCredits,true);assert.equal(x.credits,undefined);
 assert.equal(ofType(commands,'owner-chat-burst').length,1);assert.equal(ofType(commands,'i==2 and 120').length,0);assert.equal(ofType(commands,'weekly-credit-reserve').length,0);
 assert.ok(!commands.some(cmd=>cmd[0]==='GET'&&cmd[1].includes('billing:account:')));
 assert.equal(calls.length,1);assert.equal(calls[0].cmd.max_output_tokens,1800);assert.equal(calls[0].cmd.store,false);
}));
test('owner without a billing record can chat, and app credits disabled still does not use the shared quota',async()=>isolated(async({go,calls,commands})=>{
 const r=await go();assert.equal(r.status,200);assert.equal((await r.json()).ownerChatNoAppCredits,true);
 assert.equal(calls.length,1);assert.equal(ofType(commands,'i==2 and 120').length,0);
},{patch:{ASAF_WEEKLY_CREDITS_ENABLED:'false'}}));
test('other admin and customer cannot claim the owner bypass (even with owner fields in request)',async()=>isolated(async({go,setTrial,calls,commands})=>{
 for(const target of ['admin','customer']){
  await setTrial(target,true);
  const r=await go(target,{ownerChatNoAppCredits:true,ownerId,creditConsent:4});assert.equal(r.status,402);assert.equal((await r.json()).code,'subscription_required');
 }
 assert.equal(calls.length,0);assert.equal(ofType(commands,'owner-chat-burst').length,0);
}));
test('active customer still sees the same consent, cannot use owner bypass, and stays credit-gated',async()=>isolated(async({go,setTrial,calls,commands})=>{
 await setTrial('customer',false);
 const quote=await go('customer');assert.equal(quote.status,428);assert.equal((await quote.json()).maxCredits,4);
 const none=await go('customer',{creditConsent:4,ownerChatNoAppCredits:true});assert.equal(none.status,402);assert.equal((await none.json()).code,'credits_exhausted');
 assert.equal(ofType(commands,'weekly-credit-reserve').length,1);assert.equal(ofType(commands,'owner-chat-burst').length,0);assert.equal(calls.length,0);
}));
for(const patch of [{ASAF_CHAT_OWNER_MEMBER_ID:undefined},{ASAF_CHAT_OWNER_MEMBER_ID:ownerId+','+otherAdmin},{ASAF_ADMIN_MEMBER_IDS:otherAdmin}])test(`owner fails closed when configuration is missing, malformed, or not currently admin: ${Object.keys(patch)[0]} / ${String(Object.values(patch)[0])}`,async()=>isolated(async({go,setTrial,calls})=>{
 await setTrial('owner',true);assert.equal((await go()).status,402);assert.equal(calls.length,0);
},{patch}));
test('missing, revoked, or replaced credentials cannot use owner bypass',async()=>isolated(async({go,calls,control})=>{
 assert.equal((await go('anonymous')).status,401);
 let reads=0;control.revokeDuring(()=>++reads===2);
 assert.equal((await go()).status,401);assert.equal(calls.length,0);
}));
test('owner burst is separate and rolling; fifth request blocked, next window restored with no shared quota',async()=>isolated(async({go,calls,commands,control})=>{
 for(let i=0;i<4;i++)assert.equal((await go()).status,200);
 const limited=await go();assert.equal(limited.status,429);assert.equal((await limited.json()).code,'owner_chat_burst_limited');
 control.advance(14999);assert.equal((await go()).status,429);control.advance(1);assert.equal((await go()).status,200);
 assert.equal(calls.length,5);assert.equal(ofType(commands,'i==2 and 120').length,0);
}));
test('owner burst transport failure fails closed before provider request',async()=>isolated(async({go,control,calls})=>{
 control.failBurst();const r=await go();assert.equal(r.status,503);assert.equal((await r.json()).code,'owner_chat_burst_unavailable');assert.equal(calls.length,0);
}));
test('owner does not unlock paid search or unlicensed source; current request guards stay active',async()=>isolated(async({go,calls})=>{
 assert.equal((await go('owner',{webSearch:true})).status,503);
 const licensed=await go('owner',{source:'Twelve Data'});assert.equal(licensed.status,403);assert.equal((await licensed.json()).code,'ai_provider_license_pending');
 assert.equal((await go('owner',{message:'x'.repeat(1601)})).status,400);
 assert.equal((await go('owner',{image:'https://example.test/chart.png'})).status,400);
 assert.equal((await go('owner',{oversized:'x'.repeat(700001)})).status,413);assert.equal(calls.length,0);
}));
test('OpenAI provider rate limit still applies to owner; no retry or alternate provider',async()=>isolated(async({go,calls,commands})=>{
 const r=await go();assert.equal(r.status,429);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.openai.com/v1/responses');assert.equal(ofType(commands,'weekly-credit-reserve').length,0);
},{providerStatus:429}));
test('legacy owner access code is not equivalent to the verified authenticated exempt owner',async()=>isolated(async({calls,commands})=>{
 const req=new Request(origin+'/.netlify/functions/free-chat',{method:'POST',headers:{'x-asaf-free-ai-code':fakePass,'content-type':'application/json'},body:JSON.stringify({message:'Explain moving averages',ownerId,ownerChatNoAppCredits:true})});
 const r=await handler(req);assert.equal(r.status,200);assert.equal((await r.json()).ownerChatNoAppCredits,undefined);assert.equal(ofType(commands,'owner-chat-burst').length,0);assert.equal(calls.length,1);
},{patch:{ASAF_PUBLIC_AUTH_ENABLED:'false',ASAF_WEEKLY_CREDITS_ENABLED:'false',ASAF_AI_PROVIDER:'openrouter',ASAF_FREE_AI_ENABLED:'true',ASAF_FREE_AI_ACCESS_CODE:fakePass,OPENROUTER_API_KEY:'mock-not-real'}}));
test('only owner gets a display indicator, with a translated label in all ten locales',()=>{
 const label='גישת בעלים: ללא ניכוי קרדיטים באתר';
 for(const locale of Object.keys(languageNames)){
  const displayed=createTranslator(launchTranslations[locale])(label);
  assert.ok(displayed);
  if(locale!=='he'){assert.notEqual(displayed,label);assert.doesNotMatch(displayed,/[\u0590-\u05ff]/u)}
 }
});
test('owner still rejects an unknown origin despite a valid cookie',async()=>isolated(async({user,calls})=>{
 const req=new Request(origin+'/.netlify/functions/free-chat',{method:'POST',headers:{cookie:user.owner.cookie,'content-type':'application/json',origin:'https://untrusted.test'},body:JSON.stringify({message:'Explain moving averages'})});
 const r=await handler(req);assert.equal(r.status,403);assert.equal(calls.length,0);
}));
test('large chart context stays subject to the existing OpenAI request ceilings and tool restrictions',async()=>isolated(async({go,calls})=>{
 const bars=Array.from({length:1500},(_,i)=>({date:new Date(Date.UTC(2019,0,i+1)).toISOString().slice(0,10),open:100,low:99,high:105,close:100+i*.001,volume:2000000}));
 const r=await go('owner',{symbol:'AAPL',source:'CSV',bars,chartToolReceipt:'א'.repeat(6000)});
 // The actual server summarizes candles; it does not forward the unbounded source body.
 assert.equal(r.status,200);assert.equal(calls.length,1);
 const body=calls[0].cmd;
 assert.ok(Buffer.byteLength(body.instructions)+Buffer.byteLength(body.input.at(-1).content)<=48000);
 assert.equal(body.max_output_tokens,1800);assert.equal(body.tools,undefined);
}));
test('owner burst rejection runs before gated market cache work',async()=>isolated(async({go,calls,commands})=>{
 for(let i=0;i<4;i++)assert.equal((await go()).status,200);
 const body={symbol:'AAPL',source:'Twelve Data',useServerMarket:true};
 const r=await go('owner',body);
 assert.equal(r.status,429);assert.equal((await r.json()).code,'owner_chat_burst_limited');
 assert.equal(calls.length,4);assert.ok(!commands.some(cmd=>cmd[0]==='GET'&&cmd[1].includes('market:snapshot:')));
},{patch:{ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED:'true',TWELVE_DATA_API_KEY:'fixture-only',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL'}}));

for(const locale of Object.keys(languageNames))for(const offline of [false,true]){
 test(`owner technical burst status in ${locale} keeps existing admission controls (${offline?'store unavailable':'limit reached'})`,async()=>isolated(async({go,calls,commands,control})=>{
  const options={language:locale};
  if(offline)control.failBurst();
  else for(let n=0;n<4;n++)assert.equal((await go('owner',options)).status,200);
  const code=offline?'owner_chat_burst_unavailable':'owner_chat_burst_limited';
  const r=await go('owner',options);
  assert.equal(r.status,offline?503:429);
  const data=await r.json();
  assert.deepEqual(data,{code,error:chatThrottleCopy(code,locale)});
  if(locale!=='he')assert.doesNotMatch(data.error,/[\u0590-\u05ff]/u);
  assert.equal(calls.length,offline?0:4);
  assert.equal(ofType(commands,'i==2 and 120').length,0);
 }));
}
