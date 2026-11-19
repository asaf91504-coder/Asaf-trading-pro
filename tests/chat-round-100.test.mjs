import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/free-chat.mjs';
import {responseLanguages} from '../interface-language.mjs';

const beforeEnv=process.env, beforeFetch=globalThis.fetch, beforeNow=Date.now;
const owner='offline-test-owner-code-only';
let latestMock, modelCalls, caseNumber=0;
before(()=>{
 process.env={ASAF_AI_PROVIDER:'openrouter',ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'offline-fixture-not-a-real-key',ASAF_FREE_AI_ACCESS_CODE:owner};
 globalThis.fetch=async (url,options)=>{
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions','Unexpected outbound request in offline QA');
  modelCalls.push(JSON.parse(options.body));
  return latestMock();
 };
 // Advance more than the real function's rate-limit window after each independent case.
 Date.now=()=>Date.UTC(2026,10,19)+caseNumber*61000;
});
after(()=>{process.env=beforeEnv;globalThis.fetch=beforeFetch;Date.now=beforeNow});
const examples={
 he:['איך מחשבים תנודתיות?','מחשבים את פיזור התשואות.','he-IL'],
 en:['How is volatility measured?','Measure the variation of returns.','en-US'],
 es:['¿Cómo se mide la volatilidad?','Mide la variación de los rendimientos.','es-ES'],
 ar:['كيف نقيس التقلب؟','نقيس تشتت العوائد.','ar-SA'],
 fr:['Comment mesure-t-on la volatilité ?','On mesure la dispersion des rendements.','fr-FR'],
 de:['Wie misst man die Volatilität?','Man misst die Streuung der Renditen.','de-DE'],
 pt:['Como se mede a volatilidade?','Mede-se a dispersão dos retornos.','pt-BR'],
 ru:['Как измеряют волатильность?','Измеряют разброс доходностей.','ru-RU'],
 zh:['如何衡量波动率？','衡量收益率的离散程度。','zh-CN'],
 ja:['ボラティリティはどう測りますか？','リターンのばらつきを測ります。','ja-JP'],
};
const disableRSI={type:'indicator',indicator:'RSI14',enabled:false};
const opening={type:'symbol',symbol:'NASDAQ:NVDA'};
const tests={
 'plain lesson preserves exact model prose and does not request a chart action':async ({ask,answer})=>{
  const data=await ask();assert.equal(data.answer,answer);
  assert.equal(data.analysisContext,null);assert.equal(data.tradeScenario,null);assert.equal(data.actions,undefined);
 },
 'regional locale applies to a conflicting-language question and history':async ({ask,answer,region})=>{
  const data=await ask({language:region,message:'What is momentum?',history:[{role:'assistant',content:'היסטוריה בשפה אחרת'}]});
  assert.equal(data.answer,answer);assert.deepEqual(modelCalls[0].messages.slice(1,-1),[{role:'assistant',content:'היסטוריה בשפה אחרת'}]);
 },
 'historical chart stays separate from the current chart selection':async ({ask})=>{
  await ask({symbol:'NASDAQ:NVDA',interval:'1week',history:[{role:'assistant',content:'OLD UNIQUE VALUE 305.12',chartContext:{symbol:'NASDAQ:AAPL',source:'CSV',interval:'1day'}}]});
  const messages=modelCalls[0].messages;
  assert.match(messages.at(-2).content,/OLD UNIQUE VALUE 305\.12.*NASDAQ:AAPL/s);
  assert.match(messages.at(-1).content,/SELECTED_CHART.*NASDAQ:NVDA.*1week.*No verified OHLCV/s);
  assert.doesNotMatch(messages.at(-1).content,/305\.12|NASDAQ:AAPL/);
 },
 'chart analysis without candles refuses to invent entry and stop':async ({ask,answer,noMixed})=>{
  const data=await ask({message:'Analyze the chart and include an entry point and stop loss'});
  assert.equal(data.tradeScenario.available,false);assert.equal(data.tradeScenario.entry,undefined);
  assert.ok(data.answer.startsWith(answer+'\n\n'));noMixed(data.answer);
 },
 'unverified synthetic candles carry provenance but do not yield a trade scenario':async ({ask,noMixed})=>{
  const bars=Array.from({length:25},(_,i)=>({date:new Date(Date.UTC(2026,9,i+1)).toISOString().slice(0,10),open:100,high:102,low:98,close:101,volume:2000}));
  const data=await ask({message:'Analyze the chart with a stop loss',symbol:'AAPL',source:'CSV',bars});
  assert.equal(data.analysisContext.candleCount,25);assert.equal(data.analysisContext.provenance,'browser-unverified');
  assert.equal(data.tradeScenario.available,false);noMixed(data.answer);
  assert.match(modelCalls[0].messages.at(-1).content,/unverified OHLCV/);
 },
 'valid chart plan preserves ticker and indicator identifiers':async ({ask,answer})=>{
  const data=await ask({chartControl:true},{text:JSON.stringify({answer,actions:[opening,disableRSI]})});
  assert.equal(data.answer,answer);assert.deepEqual(data.actions,[opening,disableRSI]);assert.equal(data.chartActionStatus,'planned');
 },
 'text-only response in chart tool mode gets localized no-action explanation':async ({ask,answer,noMixed})=>{
  const data=await ask({chartControl:true},{text:answer});
  assert.ok(data.answer.startsWith(answer+'\n\n'));assert.equal(data.chartActionStatus,'unavailable');assert.deepEqual(data.actions,[]);noMixed(data.answer);
 },
 'unsupported chart plan is discarded with localized status, including its model prose':async ({ask,answer,noMixed})=>{
  const data=await ask({chartControl:true},{text:JSON.stringify({answer,actions:[opening,{type:'unknown-chart-mode'}]})});
  assert.equal(data.chartActionStatus,'unavailable');assert.deepEqual(data.actions,[]);assert.ok(!data.answer.includes(answer));noMixed(data.answer);
 },
 'truncated chart plan never applies a partial operation and explains in selected language':async ({ask,answer,noMixed})=>{
  const data=await ask({chartControl:true},{text:JSON.stringify({answer,actions:[opening]}),finish:'length'});
  assert.equal(data.truncated,true);assert.equal(data.chartActionStatus,'unavailable');assert.deepEqual(data.actions,[]);assert.ok(!data.answer.includes(answer));noMixed(data.answer);
 },
 'truncated prose keeps exact partial answer and appends a localized notice without retries':async ({ask,answer,noMixed})=>{
  const data=await ask({},{finish:'length'});
  assert.equal(data.truncated,true);assert.ok(data.answer.startsWith(answer+'\n\n⚠️ '));assert.ok(data.answer.length>answer.length+15);noMixed(data.answer);
 },
};
for(const [locale,[message,answer,region]] of Object.entries(examples))for(const [name,verify] of Object.entries(tests)){
 test(`QA-CHAT ${locale}: ${name}`,async()=>{
  caseNumber++;modelCalls=[];
  const ask=async(body={},options={})=>{
   latestMock=()=>Response.json({choices:[{message:{content:options.text??answer},finish_reason:options.finish??'stop'}]});
   const result=await handler(new Request('https://offline.test/.netlify/functions/free-chat',{method:'POST',headers:{'content-type':'application/json','x-asaf-free-ai-code':owner},body:JSON.stringify({message,language:locale,...body})}));
   const data=await result.json();
   assert.equal(result.status,200,JSON.stringify(data));
   assert.equal(result.headers.get('cache-control'),'no-store');
   assert.equal(modelCalls.length,1,'No real or repeated provider request');
   const system=modelCalls[0].messages[0].content;
   assert.ok(system.includes('Response language: '+responseLanguages[locale]+'.'));
   assert.equal(data.responseLanguage,locale);
   return data;
  };
  const noMixed=text=>{
   if(locale==='he')assert.match(text,/[\u0590-\u05ff]/u);
   else assert.doesNotMatch(text,/[\u0590-\u05ff]/u);
  };
  await verify({ask,answer,region,noMixed});
 });
}
