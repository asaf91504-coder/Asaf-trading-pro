import test from 'node:test';
import assert from 'node:assert/strict';
import {chartViewContext,technicalEvidence,analysisReceipt} from '../chart-analysis-context.mjs';
import {marketDataContext} from '../netlify/functions/free-chat.mjs';
const bars=Array.from({length:160},(_,i)=>({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),open:100+i,high:102+i,low:99+i,close:101+i,volume:100+i}));
test('viewport resolves exact dates from candles and ignores client-provided prices or counts',()=>{
 const range={start:bars[20].date,end:bars[39].date,high:999999,candleCount:999};
 const view=chartViewContext(bars,range);
 assert.equal(view.candleCount,20);assert.equal(view.high,bars[39].high);assert.equal(view.low,bars[20].low);
 assert.equal(view.includesLatestLoadedBar,false);assert.equal(view.closeChangePercent,(bars[39].close/bars[20].close-1)*100);
});
test('unknown, reversed and missing viewport dates are never interpreted as a chart range',()=>{
 for(const range of [null,{}, {start:'made up',end:bars[3].date},{start:bars[4].date,end:bars[3].date}])assert.equal(chartViewContext(bars,range),null);
 assert.equal(chartViewContext(bars,{start:bars[0].date,end:bars.at(-1).date}).includesLatestLoadedBar,true);
});
test('zoom does not recompute indicator history or fabricate market cap and targets',()=>{
 const full=marketDataContext('AAPL',bars,{interval:'1day'});
 const zoomed=marketDataContext('AAPL',bars,{interval:'1day',chartSettings:{visibleRange:{start:bars[130].date,end:bars[145].date}}});
 assert.equal(zoomed.sma150,full.sma150);assert.equal(zoomed.candleCount,160);assert.equal(zoomed.visibleChart.candleCount,16);
 assert.equal(zoomed.technicalEvidence.marketCap,null);assert.equal(zoomed.technicalEvidence.targetUpsidePercent,null);
 assert.equal(zoomed.technicalEvidence.aboveMA20,true);assert.equal(zoomed.technicalEvidence.aboveMA150,true);
});
test('missing volume and unavailable averages remain unknown rather than a pass',()=>{
 const context={dailyChangePercent:0,sma20:null,sma150:null,volumeRatio:null};
 const facts=technicalEvidence(context,bars.map(b=>({...b,volume:null})));
 assert.equal(facts.aboveMA20,null);assert.equal(facts.aboveMA150,null);assert.equal(facts.volumeAbovePreviousBar,null);assert.equal(facts.volumeAbovePrior20Average,null);
});
test('source receipt distinguishes validated data, latest candle and historical viewport',()=>{
 const context=marketDataContext('COINLORE:BTCUSD',bars,{source:'CoinLore',interval:'1day',provenance:'server-crypto-cache',chartSettings:{visibleRange:{start:bars[20].date,end:bars[39].date}}});
 const receipt=analysisReceipt(context);
 assert.match(receipt,/CoinLore/);assert.match(receipt,/תואם לעותק/);assert.match(receipt,/תצוגה היסטורית/);assert.match(receipt,/אינו מבטיח/);
 assert.match(analysisReceipt({...context,provenance:'browser-unverified'}),/לא אומת/);
 assert.equal(analysisReceipt(null),'');
});

test('endpoint returns the server evidence receipt and sends resolved viewport to one free-model request',async()=>{
 const {default:handler}=await import('../netlify/functions/free-chat.mjs');
 const previous={...process.env},original=global.fetch;let sent;
 Object.assign(process.env,{ASAF_FREE_AI_ENABLED:'true',ASAF_PUBLIC_AUTH_ENABLED:'false',ASAF_FREE_AI_DURABLE_QUOTA:'false',ASAF_FREE_AI_ACCESS_CODE:'test-analysis-evidence-access-code',OPENROUTER_API_KEY:'mock-only'});
 global.fetch=async(url,init)=>{assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');sent=JSON.parse(init.body);return Response.json({choices:[{message:{content:'ניתוח לפי החלון ההיסטורי'},finish_reason:'stop'}]})};
 try{
  const request=new Request('https://app.test/.netlify/functions/free-chat',{method:'POST',headers:{'content-type':'application/json','x-asaf-free-ai-code':process.env.ASAF_FREE_AI_ACCESS_CODE},body:JSON.stringify({message:'מה קורה בזום?',symbol:'AAPL',source:'CSV',bars,chartSettings:{style:'candles',indicators:['MA20'],visibleRange:{start:bars[20].date,end:bars[39].date,low:-1234}}})});
  const response=await handler(request),body=await response.json();assert.equal(response.status,200);
  assert.equal(body.analysisContext.visibleChart.candleCount,20);assert.equal(body.analysisContext.lastCandleTime,bars.at(-1).date);assert.equal(body.analysisContext.provenance,'browser-unverified');
  assert.equal(sent.model,'openrouter/free');assert.equal(sent.max_tokens,1800);assert.match(sent.messages[0].content,/visibleChart/);assert.match(sent.messages.at(-1).content, /"includesLatestLoadedBar":false/);assert.doesNotMatch(sent.messages.at(-1).content, /-1234/);
 }finally{process.env=previous;global.fetch=original}
});
