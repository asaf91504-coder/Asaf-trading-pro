import test from 'node:test';
import assert from 'node:assert/strict';
import {intrinioSnapshotKey} from '../server/intrinio-research.mjs';
import {env as authEnv,fixture,seed,request} from './identity-fixture.mjs';
let id=0;
async function scenario(callback,{licensed=true,admin=true}={}){
 const old={...process.env},fetcher=global.fetch,state=fixture(),owner=seed(state),now=Date.now(),models=[];
 Object.assign(process.env,{...authEnv,ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'mock',INTRINIO_API_KEY:'mock',ASAF_INTRINIO_ENABLED:'true',ASAF_INTRINIO_TRIAL_ENDS_AT:new Date(now+86400000).toISOString(),ASAF_ADMIN_MEMBER_IDS:admin?owner.record.id:'other',ASAF_INTRINIO_AI_LICENSE_CONFIRMED:String(licensed)});
 const bars=Array.from({length:40},(_,i)=>({date:new Date(now-(41-i)*86400000).toISOString().slice(0,10),open:100,high:102,low:99,close:101,volume:1000})),receivedAt=new Date(now-100).toISOString();
 const snapshot={source:'Intrinio',symbol:'AAPL',interval:'1day',bars,receivedAt,internalResearchOnly:true,priceAdjustment:'splits-and-dividends',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,exchangeTimezone:'America/New_York',coverage:'Adjusted EOD'};
 state.db.set(intrinioSnapshotKey('AAPL'),JSON.stringify(snapshot));
 global.fetch=async(url,options)=>{if(String(url)==='https://test.upstash.io')return Response.json({result:await state.run(JSON.parse(options.body))});assert.equal(String(url),'https://openrouter.ai/api/v1/chat/completions');models.push(JSON.parse(options.body));return Response.json({choices:[{message:{content:'Analysis'},finish_reason:'stop'}]})};
 const {default:handler}=await import('../netlify/functions/free-chat.mjs?intrinioCase='+id++);
 const payload={message:'נתח',symbol:'AAPL',source:'Intrinio',useServerIntrinio:true,interval:'1day',receivedAt,bars:[{close:999999}]};
 try{await callback({models,payload,send:body=>handler(request('free-chat',body||payload,owner.cookie))})}finally{process.env=old;global.fetch=fetcher}
}
test('Intrinio model context uses owner server cache, accurate provenance and adjusted EOD disclosure',async()=>{
 await scenario(async s=>{const response=await s.send();assert.equal(response.status,200);const data=await response.json();assert.equal(data.source,'Intrinio');assert.equal(data.analysisContext.provenance,'server-intrinio-cache');const text=s.models[0].messages.at(-1).content;assert.match(text,/"close":101/);assert.match(text,/splits and dividends/);assert.doesNotMatch(text,/999999/)});
});
test('Intrinio external AI stays blocked without plan rights or owner access',async()=>{
 for(const options of [{licensed:false},{admin:false}])await scenario(async s=>{assert.equal((await s.send()).status,403);assert.equal(s.models.length,0)},options);
});
test('Intrinio mismatched snapshots and mixed flags stop before model inference',async()=>{
 await scenario(async s=>{assert.equal((await s.send({...s.payload,receivedAt:'old'})).status,409);assert.equal((await s.send({...s.payload,useServerMarket:true})).status,400);assert.equal((await s.send({...s.payload,useServerIntrinio:false})).status,400);assert.equal(s.models.length,0)});
});

test('cleared or switched charts cannot forward restricted historical messages to the model',async()=>{
 for(const options of [{licensed:false},{licensed:true,admin:false}])await scenario(async s=>{
  const response=await s.send({message:'Explain diversification conceptually',symbol:'',source:'none',bars:null,history:[{role:'assistant',content:'restricted-derived-values',chartContext:{symbol:'AAPL',source:'Intrinio'}},{role:'user',content:'general-learning-context',chartContext:{source:'none'}}]});
  assert.equal(response.status,200);assert.equal(s.models.length,1);const sent=JSON.stringify(s.models[0].messages);assert.doesNotMatch(sent,/restricted-derived-values/);assert.match(sent,/general-learning-context/);
 },options);
});

test('verified chart analysis always writes a computed entry/stop section from the server snapshot',async()=>{
 await scenario(async s=>{
  const response=await s.send({...s.payload,message:'תנתח AAPL'}),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.tradeScenario.available,true);assert.equal(data.tradeScenario.entry,102.75);assert.equal(data.tradeScenario.stop,98.25);
  assert.match(data.answer,/נקודת כניסה מותנית: 102.75/);assert.match(data.answer,/סטופ־לוס לתרחיש: 98.25/);assert.doesNotMatch(data.answer,/999999/);
  assert.match(s.models[0].messages.at(-1).content,/entryStopScenario/);
 });
});
test('client-supplied provenance cannot unlock numeric entry/stop and general conversation stays natural',async()=>{
 await scenario(async s=>{
  const payload={message:'נתח את הגרף',symbol:'AAPL',source:'CSV',provenance:'server-intrinio-cache',latestBarMayBePartial:false,bars:null};
  const response=await s.send(payload),data=await response.json();assert.equal(response.status,200);assert.equal(data.tradeScenario.available,false);assert.match(data.answer,/נקודת כניסה: לא זמינה/);assert.match(data.answer,/סטופ־לוס: לא זמין/);
  const general=await (await s.send({...payload,message:'שלום, מה נשמע?'})).json();assert.equal(general.tradeScenario,null);assert.equal(general.answer,'Analysis');
 },{licensed:false});
});
