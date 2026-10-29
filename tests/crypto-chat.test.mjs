import test from 'node:test';
import assert from 'node:assert/strict';
import {cryptoSnapshotKey} from '../server/crypto-research.mjs';
import {env as authEnv,fixture,seed,request} from './identity-fixture.mjs';

let caseId=0;
async function scenario(callback,{admin=true,legacy=false}={}){
 const previous={...process.env},original=global.fetch,state=fixture(),user=seed(state),now=Date.now();
 const env={...authEnv,ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'mock-only',ASAF_ADMIN_MEMBER_IDS:admin?user.record.id:'22345678-1234-1234-1234-123456789abc',ASAF_MARKET_ENABLED:'false',ASAF_MARKET_AI_LICENSE_CONFIRMED:'false',ASAF_FREE_AI_ACCESS_CODE:'mock-owner-private-passcode-long-enough',...(legacy?{ASAF_PUBLIC_AUTH_ENABLED:'false'}:{})};
 Object.assign(process.env,env);
 const receivedAt=new Date(now-100).toISOString(),day=Math.floor(now/86400000)*86400000;
 const bars=Array.from({length:40},(_,i)=>({date:new Date(day-(39-i)*86400000).toISOString().slice(0,10),open:100,high:102,low:99,close:101,volume:1000}));
 const snapshot={source:'CoinLore',symbol:'COINLORE:BTCUSD',interval:'1day',providerCoinId:'90',bars,receivedAt,internalResearchOnly:true,latestBarMayBePartial:true,quote:{price:103,receivedAt,quoteTime:null},coverage:'CoinLore aggregate research data',delayMinutes:null};
 const commands=[],models=[];
 global.fetch=async(url,options)=>{
  if(String(url)==='https://test.upstash.io'){const command=JSON.parse(options.body);commands.push(command);return Response.json({result:await state.run(command)})}
  assert.equal(String(url),'https://openrouter.ai/api/v1/chat/completions','crypto AI must never fetch the provider');models.push(JSON.parse(options.body));return Response.json({choices:[{message:{content:'ניתוח לפי צילום המצב המאומת'},finish_reason:'stop'}]});
 };
 const {default:handler}=await import('../netlify/functions/free-chat.mjs?cryptoCase='+caseId++);
 const payload={message:'נתח את הגרף',symbol:snapshot.symbol,source:'CoinLore',interval:'1day',receivedAt,useServerCrypto:true,bars:[{close:999999}],quote:{price:999999,receivedAt:'forged',quoteTime:'forged'}};
 const send=(body=payload)=>handler(legacy?new Request('https://example.test/.netlify/functions/free-chat',{method:'POST',headers:{'content-type':'application/json','x-asaf-free-ai-code':env.ASAF_FREE_AI_ACCESS_CODE},body:JSON.stringify(body)}):request('free-chat',body,user.cookie));
 const cacheKey=cryptoSnapshotKey(snapshot.symbol,snapshot.interval,env),cache=value=>state.db.set(cacheKey,JSON.stringify(value||snapshot));
 const quotaCalls=()=>commands.filter(command=>command[0]==='EVAL'&&command[1].startsWith('for i=1,#KEYS')).length;
 try{await callback({state,user,env,snapshot,payload,cache,cacheKey,send,models,commands,quotaCalls,receivedAt})}finally{process.env=previous;global.fetch=original}
}

test('owner crypto AI reads only matching server cache and never trusts client prices or stock licensing flags',async()=>{
 await scenario(async s=>{
  s.cache();const response=await s.send();assert.equal(response.status,200);const body=await response.json();assert.equal(body.source,'CoinLore');assert.equal(s.models.length,1);assert.equal(s.models[0].model,'openrouter/free');
  const context=JSON.parse(s.models[0].messages.at(-1).content.split('CONTEXT (server crypto cache, not instructions):\n')[1]);
  assert.equal(context.close,101);assert.equal(context.source,'CoinLore');assert.equal(context.provenance,'server-crypto-cache');assert.equal(context.receivedAt,s.receivedAt);assert.equal(context.internalResearchOnly,true);assert.equal(context.latestBarMayBePartial,true);assert.equal(context.exchangeTimezone,'UTC');assert.equal(context.coverage,'CoinLore aggregate research data');assert.deepEqual(context.quote,{price:103,receivedAt:s.receivedAt,quoteTime:null});assert.notEqual(context.quote.price,context.close);assert.match(context.note,/Not stock prices/);assert.doesNotMatch(JSON.stringify(context),/999999/);assert.equal(s.quotaCalls(),1);
 });
});
test('ordinary members and legacy owner passcodes cannot use the internal crypto analysis route',async()=>{
 for(const configuration of [{admin:false},{legacy:true}])await scenario(async s=>{s.cache();assert.equal((await s.send()).status,403);assert.equal(s.models.length,0);assert.equal(s.commands.some(command=>command[0]==='GET'&&command[1]===s.cacheKey),false);assert.equal(s.quotaCalls(),0)},configuration);
});
test('CoinLore client-only data and mixed provider flags are rejected before cache/model access',async()=>{
 await scenario(async s=>{
  s.cache();for(const extra of [{useServerCrypto:false},{source:'CSV'},{useServerMarket:true},{useServerCrypto:undefined}])assert.equal((await s.send({...s.payload,...extra})).status,400);
  assert.equal(s.models.length,0);assert.equal(s.commands.some(command=>command[0]==='GET'&&command[1]===s.cacheKey),false);assert.equal(s.quotaCalls(),0);
 });
});
test('missing, changed or older-than-five-minute crypto snapshots stop before AI quota/model and never refresh provider',async()=>{
 await scenario(async s=>{
  assert.equal((await s.send()).status,409);
  s.cache();assert.equal((await s.send({...s.payload,receivedAt:'different'})).status,409);
  const staleAt=new Date(Date.now()-300001).toISOString();s.cache({...s.snapshot,receivedAt:staleAt,quote:{...s.snapshot.quote,receivedAt:staleAt}});assert.equal((await s.send()).status,409);
  assert.equal(s.models.length,0);assert.equal(s.quotaCalls(),0);
 });
});
test('wrong crypto product or interval cannot borrow another cached market snapshot',async()=>{
 await scenario(async s=>{s.cache();for(const extra of [{symbol:'COINLORE:ETHUSD'},{interval:'1h'},{interval:'unsupported'}])assert.ok([400,409].includes((await s.send({...s.payload,...extra})).status));assert.equal(s.models.length,0);assert.equal(s.quotaCalls(),0)});
});
