import test from 'node:test';
import assert from 'node:assert/strict';
import {twelveSettings} from '../server/twelve-config.mjs';
import {readMarketSnapshot,marketSnapshotKey,publicMarketConfigured} from '../server/market-feed.mjs';
import {analysisMarket} from '../server/analysis-sources.mjs';
import {createPublicMarketHandler} from '../netlify/functions/public-market.mjs';
import {validateBar} from '../netlify/functions/market.mjs';
import {env as authEnv,fixture} from './identity-fixture.mjs';
const env={...authEnv,ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL',TWELVE_DATA_API_KEY:'never-print-test-key'};
const now=Date.parse('2026-11-16T16:00:00Z');
const sample=()=>({meta:{symbol:'AAPL',interval:'1day',currency:'USD'},values:Array.from({length:501},(_,i)=>({datetime:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),open:'100',high:'102',low:'99',close:'101',volume:'1000'}))});
test('500-bar history is ordered, bounded and identical for chart and AI without a second provider call',async()=>{
 const s=fixture();let calls=0;const result=await readMarketSnapshot({selected:'AAPL',env,run:s.run,now,fetcher:async url=>{calls++;assert.equal(url.searchParams.get('outputsize'),'501');assert.equal(url.searchParams.get('prepost'),'false');return Response.json(sample())}});
 assert.equal(result.bars.length,500);assert.equal(result.volumeCoverage,'unconfirmed');assert.equal(result.priceAdjustment,'splits');
 const analysis=await analysisMarket({symbol:'AAPL',receivedAt:result.receivedAt},{env,run:s.run,now});assert.deepEqual(analysis.bars,result.bars);assert.equal(analysis.meta.volumeCoverage,'unconfirmed');assert.equal(calls,1);
});
test('restricted interval is rejected before any provider call',async()=>{
 let calls=0;await assert.rejects(readMarketSnapshot({selected:'AAPL',interval:'1min',env:{...env,ASAF_MARKET_INTERVALS:'1day'},run:fixture().run,now,fetcher:async()=>{calls++}}),e=>e.status===403);assert.equal(calls,0);
});
test('invalid settings fail closed and budget accepts explicitly configured commercial daily limits',()=>{
 for(const override of [{ASAF_MARKET_HISTORY_BARS:'5000'},{ASAF_MARKET_REQUESTS_PER_DAY:'NaN'},{ASAF_MARKET_INTERVALS:'1sec'},{ASAF_MARKET_VOLUME_COVERAGE:'full'}])assert.equal(publicMarketConfigured({...env,...override}),false);
 assert.equal(twelveSettings({...env,ASAF_MARKET_REQUESTS_PER_DAY:'100000'}).dailyCredits,100000);
});
test('settings changes isolate old cache and missing volume is not zero',()=>{
 const key=marketSnapshotKey('AAPL','1day',env);
 for(const extra of [{ASAF_MARKET_HISTORY_BARS:'1000'},{ASAF_MARKET_VOLUME_COVERAGE:'partial'}])assert.notEqual(key,marketSnapshotKey('AAPL','1day',{...env,...extra}));
 for(const volume of ['',null,undefined,false])assert.equal(validateBar({...sample().values[0],volume}).volume,null);
 assert.equal(validateBar({...sample().values[0],volume:'0'}).volume,0);
});
test('wrong interval and invalid prices fail without replacing a snapshot',async()=>{
 for(const mutate of [x=>x.meta.interval='1min',x=>x.values[0].close='999']){
 const s=fixture(),payload=sample();mutate(payload);
 await assert.rejects(readMarketSnapshot({selected:'AAPL',env,run:s.run,now,fetcher:async()=>Response.json(payload)}),e=>e.status===502);
 assert.equal(s.db.has(marketSnapshotKey('AAPL','1day',env)),false);
 }
});
test('malformed cache refreshes while cached-only AI fails closed',async()=>{
 const s=fixture();s.db.set(marketSnapshotKey('AAPL','1day',env),'broken');
 await assert.rejects(readMarketSnapshot({selected:'AAPL',env,run:s.run,now,cachedOnly:true}),e=>e.status===409);
 const result=await readMarketSnapshot({selected:'AAPL',env,run:s.run,now,fetcher:async()=>Response.json(sample())});assert.equal(result.bars.length,500);
});
test('public configuration exposes only permitted intervals and no key',async()=>{
 const h=createPublicMarketHandler({env:{...env,ASAF_MARKET_INTERVALS:'1day'},run:fixture().run,fetcher:()=>{throw Error('Must not fetch')}});
 const data=await(await h(new Request('https://example.test/.netlify/functions/public-market'))).json();assert.deepEqual(data.intervals,['1day']);assert.equal(data.aiAnalysisEnabled,true);assert.equal(JSON.stringify(data).includes(env.TWELVE_DATA_API_KEY),false);
});
