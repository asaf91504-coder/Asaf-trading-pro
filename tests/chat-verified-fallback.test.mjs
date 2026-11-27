import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedChatFallback} from '../server/chat-verified-fallback.mjs';
import {languageNames} from '../interface-language.mjs';
const candidate={symbol:'TEST',asOf:'2026-11-25',interval:'1day',close:100,changePercent:1.23,sma20:95,side:'long',status:'watch',priceLevels:{support:[98],resistance:[104]}};
test('outage summary uses supplied dated prices in every interface language and labels unconfirmed entries',()=>{
 for(const language of Object.keys(languageNames)){
  const result=verifiedChatFallback({discovery:{status:'available',candidates:[candidate]},language});
  assert.equal(result.answerMode,'verified-data');assert.equal(result.modelUnavailable,true);
  for(const text of ['TEST','2026-11-25','1day','$100','+1.23%','$98','$104'])assert.ok(result.answer.includes(text),language+': '+text);
  assert.ok(result.answer.length<1200);assert.doesNotMatch(result.answer,/NaN|undefined/);
 }
 assert.match(verifiedChatFallback({discovery:{status:'available',candidates:[candidate]},language:'he'}).answer,/אין אישור לכניסה/);
});
test('no raw CSV, screenshot, browser prices, empty scanner results or old prose becomes an outage quote',()=>{
 for(const context of [null,{...candidate,provenance:'browser-unverified'},{...candidate,provenance:'CSV'}])assert.equal(verifiedChatFallback({context}),null);
 assert.equal(verifiedChatFallback({discovery:{status:'available',candidates:[]}}),null);
 assert.equal(verifiedChatFallback({discovery:{status:'available',candidates:[{...candidate,close:null}]}}),null);
});
test('single-asset fallback keeps the matching server symbol, actual interval and between-bar comparison',()=>{
 const context={...candidate,symbol:'TSLA',provenance:'server-provider-cache',interval:'15min',lastCandleTime:'2026-11-25T20:00:00Z',close:100,last30Candles:[['earlier',null,null,null,80],['latest',null,null,null,100]]};
 const result=verifiedChatFallback({context});assert.match(result.answer,/TSLA.*2026-11-25T20:00:00Z.*15min/);assert.match(result.answer,/\+25%/);assert.match(result.answer,/שינוי בין הנרות/);
});
