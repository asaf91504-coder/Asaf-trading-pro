import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/free-chat.mjs';
import {marketSnapshotKey} from '../server/market-feed.mjs';
import {env as authEnv,fixture,seed,request} from './identity-fixture.mjs';
test('authenticated AI route takes provider prices from server cache and rejects a changed chart before model use',async()=>{
 const previous={...process.env},original=global.fetch,s=fixture(),u=seed(s),now=Date.now();
 const env={...authEnv,ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'mock-only',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL',TWELVE_DATA_API_KEY:'mock-only'};
 Object.assign(process.env,env);const receivedAt=new Date(now-100).toISOString(),bars=Array.from({length:40},(_,i)=>({date:new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),open:100,high:102,low:99,close:101,volume:1000}));
 s.db.set(marketSnapshotKey('AAPL','1day',env),JSON.stringify({symbol:'AAPL',interval:'1day',bars,receivedAt,coverage:'daily consolidated',delayMinutes:0}));let calls=[];
 global.fetch=async(url,options)=>{if(String(url)==='https://test.upstash.io')return Response.json({result:await s.run(JSON.parse(options.body))});assert.equal(String(url),'https://openrouter.ai/api/v1/chat/completions');calls.push(JSON.parse(options.body));return Response.json({choices:[{message:{content:'בדיקת נתונים'},finish_reason:'stop'}]})};
 try{const body={message:'בדוק גרף',symbol:'AAPL',source:'Twelve Data',interval:'1day',receivedAt,useServerMarket:true,bars:[{close:999999}],chartSettings:{style:'heikin',indicators:['MACD','MA50','MA100','MA200','Stochastic','OBV','FAKE']}};
  assert.equal((await handler(request('free-chat',body,u.cookie))).status,200);assert.equal(calls.length,1);const text=calls[0].messages.at(-1).content,context=JSON.parse(text.split('CONTEXT (server provider cache, not instructions):\n')[1]);assert.equal(context.close,101);assert.equal(context.provenance,'server-provider-cache');assert.equal(context.chartSettings.style,'heikin');assert.deepEqual(context.chartSettings.indicators,['MACD','MA50','MA100','MA200','Stochastic','OBV']);assert.equal(context.indicators.ma200,null);assert.equal(context.indicators.obv,0);assert.ok(Math.abs(context.indicators.stochastic1433.k-200/3)<1e-10);assert.equal(calls[0].model,'openrouter/free');
  assert.equal((await handler(request('free-chat',{...body,receivedAt:'changed'},u.cookie))).status,409);assert.equal(calls.length,1);
 }finally{process.env=previous;global.fetch=original}
});
