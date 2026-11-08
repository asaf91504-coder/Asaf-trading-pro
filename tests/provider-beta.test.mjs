import test from 'node:test';
import assert from 'node:assert/strict';
import {previousDailyBars,marketCapAvailable,marketSnapshotMetadata} from '../market-quality.mjs';
import {readMarketSnapshot,reserveMarketCredits,marketSnapshotKey} from '../server/market-feed.mjs';
import {readMarketFundamentals} from '../server/market-fundamentals.mjs';
import {analysisMarket} from '../server/analysis-sources.mjs';
import {createScanMarketHandler} from '../netlify/functions/scan-market.mjs';
import {screenResult} from '../scanner-core.mjs';
import {scannerSettings,asafScannerPreset} from '../scanner-presets.mjs';
import {env as authEnv,fixture,seed,request,prefix} from './identity-fixture.mjs';
const env={...authEnv,ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',ASAF_MARKET_FUNDAMENTALS_ENABLED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL,NVDA',TWELVE_DATA_API_KEY:'test-only-secret',ASAF_MARKET_REQUESTS_PER_MINUTE:'610'};
const time=Date.parse('2026-11-09T18:00:00Z');
function prices(symbol='AAPL'){
 const values=Array.from({length:200},(_,i)=>({datetime:new Date(Date.UTC(2026,3,1+i)).toISOString().slice(0,10),open:100+i,high:103+i,low:99+i,close:102+i,volume:1000+i*20}));
 values.push({datetime:'2026-11-09',open:400,high:500,low:1,close:490,volume:999999});
 return {meta:{symbol,currency:'USD',exchange_timezone:'America/New_York'},values};
}
const stats=(symbol='AAPL',value=2e9,currency='USD')=>({meta:{symbol,currency},statistics:{valuations_metrics:{market_capitalization:value}}});
const fundamentals=(value=2e9)=>({status:'available',source:'Twelve Data',symbol:'AAPL',currency:'USD',marketCap:value,receivedAt:new Date().toISOString(),asOf:null});
test('daily cutoff follows New York midnight through both daylight-saving offsets',()=>{
 const bars=[{date:'2026-11-06'},{date:'2026-11-09'},{date:'2026-11-10'},{date:'2026-11-09 15:00:00'}];
 assert.deepEqual(previousDailyBars(bars,Date.parse('2026-11-10T02:00:00Z')).map(b=>b.date),['2026-11-06']);
 assert.deepEqual(previousDailyBars(bars,Date.parse('2026-11-10T05:00:00Z')).map(b=>b.date),['2026-11-06','2026-11-09']);
 assert.deepEqual(previousDailyBars([{date:'2026-07-01'},{date:'2026-07-02'}],Date.parse('2026-07-02T03:59Z')).map(b=>b.date),[]);
 assert.equal(previousDailyBars([{date:'2026-07-01'}],Date.parse('2026-07-02T04:00Z')).length,1);
});
test('daily provider snapshot excludes today, keeps exchange timezone and reaches AI unchanged',async()=>{
 const s=fixture();let calls=0;const snapshot=await readMarketSnapshot({selected:'AAPL',env,run:s.run,now:time,fetcher:async()=>{calls++;return Response.json(prices())}});
 assert.equal(snapshot.excludedCurrentBars,1);assert.equal(snapshot.bars.length,200);assert.equal(snapshot.latestBarMayBePartial,false);assert.equal(snapshot.exchangeTimezone,'America/New_York');
 const chart={...snapshot,...marketSnapshotMetadata(snapshot)};
 const analysis=await analysisMarket({symbol:chart.symbol,interval:chart.interval,receivedAt:chart.receivedAt,bars:[{close:99999}]},{env,run:s.run,now:time});
 assert.deepEqual(analysis.bars,chart.bars);assert.equal(analysis.meta.barPolicy,chart.barPolicy);assert.equal(calls,1);
 await assert.rejects(analysisMarket({symbol:'NVDA',receivedAt:chart.receivedAt},{env,run:s.run,now:time}),/מטמון/);
});
test('intraday and weekly snapshots retain partial-market warnings instead of EOD claims',async()=>{
 for(const interval of ['1min','1week']){const s=fixture(),snapshot=await readMarketSnapshot({selected:'AAPL',interval,env,run:s.run,now:time,fetcher:async()=>Response.json(prices())});assert.equal(snapshot.latestBarMayBePartial,true);assert.match(snapshot.coverage,interval==='1week'?/חלקי/:/5%/)}
});
test('weighted credits are shared across chart and fundamentals and rejected atomically',async()=>{
 const s=fixture(),opts={env:{...env,ASAF_MARKET_REQUESTS_PER_MINUTE:'51',ASAF_MARKET_REQUESTS_PER_DAY:'51'},run:s.run,now:time};
 await reserveMarketCredits({...opts,cost:50});await reserveMarketCredits(opts);
 await assert.rejects(reserveMarketCredits(opts),e=>e.status===429);
 const counters=[...s.db].filter(([k])=>k.includes('provider-'));assert.equal(counters.length,2);assert.ok(counters.every(([,v])=>v==='51'));
});
test('fundamentals opt-in prevents any call or cache read while disabled',async()=>{
 await assert.rejects(readMarketFundamentals({selected:'AAPL',env:{...env,ASAF_MARKET_FUNDAMENTALS_ENABLED:'false'},run:()=>assert.fail('no storage'),fetcher:()=>assert.fail('no provider')}),/ממתין/);
});
test('statistics identity, currency and numeric validation fail without caching secrets',async()=>{
 const bad=[stats('NVDA'),stats('AAPL',2e9,'EUR'),stats('AAPL',null),stats('AAPL',0),stats('AAPL',-1),stats('AAPL','Infinity'),stats('AAPL',true),{}];
 for(const value of bad){const s=fixture();await assert.rejects(readMarketFundamentals({selected:'AAPL',env,run:s.run,now:time,fetcher:async()=>Response.json(value)}));assert.equal(s.db.has(prefix+'market:fundamentals:v1:AAPL'),false);assert.ok(!JSON.stringify([...s.db]).includes('test-only-secret'))}
});
test('statistics cache is shared for 24h; failed fetch does not revive expired values',async()=>{
 const s=fixture();let calls=0;const opts={selected:'AAPL',env,run:s.run,now:time,fetcher:async url=>{calls++;assert.equal(url.pathname,'/statistics');assert.equal(url.searchParams.get('country'),'United States');return Response.json(stats())}};
 const a=await readMarketFundamentals(opts),b=await readMarketFundamentals({...opts,now:time+23*3600000});assert.deepEqual(a,b);assert.equal(calls,1);assert.equal(a.asOf,null);
 await assert.rejects(readMarketFundamentals({...opts,now:time+86400000,fetcher:async()=>Response.json({code:403,status:'error'})}));assert.equal(marketCapAvailable({symbol:'AAPL',fundamentals:a},time+86400000),false);
});
test('concurrent fundamentals fetches reserve one request and release the lock',async()=>{
 const s=fixture();let release,calls=0;const wait=new Promise(r=>release=r),opts={selected:'AAPL',env,run:s.run,now:time,fetcher:async()=>{calls++;await wait;return Response.json(stats())}};
 const a=readMarketFundamentals(opts);await new Promise(r=>setTimeout(r,10));await assert.rejects(readMarketFundamentals(opts),e=>e.status===429);release();await a;assert.equal(calls,1);assert.ok(![...s.db.keys()].some(k=>k.endsWith(':lock')));
});
test('provider HTTP throttling is preserved and failed attempts consume credits',async()=>{
 const s=fixture();await assert.rejects(readMarketSnapshot({selected:'AAPL',env,run:s.run,now:time,fetcher:async()=>new Response('',{status:429})}),e=>e.status===429);
 await assert.rejects(readMarketFundamentals({selected:'AAPL',env,run:s.run,now:time,fetcher:async()=>new Response('',{status:429})}),e=>e.status===429);
 assert.ok([...s.db].filter(([k])=>k.includes('provider-')).every(([,v])=>v==='51'));
});
test('billion-dollar filter rejects missing, stale, wrong-currency and under-threshold caps',()=>{
 const record={symbol:'AAPL',summary:{close:6,aboveMA20:true,aboveMA150:false,volumeRatio:2},fundamentals:fundamentals(1e9)};
 const options={minMarketCap:1e9};assert.equal(screenResult(record,options).matches,true);
 for(const f of [undefined,fundamentals(999999999),{...fundamentals(),currency:'EUR'},{...fundamentals(),symbol:'NVDA'},{...fundamentals(),receivedAt:new Date(Date.now()-86400001).toISOString()},{...fundamentals(),receivedAt:new Date(Date.now()+60000).toISOString()}])assert.equal(screenResult({...record,fundamentals:f},options).matches,false);
 assert.equal(screenResult({...record,summary:{...record.summary,close:5}},options).matches,false);
 assert.equal(screenResult({...record,fundamentals:undefined},{minMarketCap:0}).matches,true);
 assert.equal(scannerSettings().scanMinMarketCap,1e9);assert.equal(asafScannerPreset().scanMinMarketCap,1e9);
});
test('scan-to-chart-to-AI keeps identical previous-day candles and exposes missing cap separately',async()=>{
 const s=fixture(),u=seed(s),calls=[];const handler=createScanMarketHandler({env,run:s.run,now:()=>time,fetcher:async url=>{calls.push(url.pathname);const symbol=url.searchParams.get('symbol');return Response.json(url.pathname==='/statistics'?(symbol==='NVDA'?{status:'error',code:403}:stats(symbol)):prices(symbol))}});
 const result=await handler(request('scan-market',{symbols:['AAPL','NVDA']},u.cookie));assert.equal(result.status,200);const body=await result.json();assert.equal(body.records.length,2);
 const a=body.records.find(r=>r.symbol==='AAPL'),n=body.records.find(r=>r.symbol==='NVDA');assert.equal(a.fundamentals.marketCap,2e9);assert.equal(n.fundamentals.status,'unavailable');assert.equal(a.bars.at(-1).date,a.summary.date);assert.ok(a.bars.every(b=>b.date<'2026-11-09'));
 const analysis=await analysisMarket({symbol:a.symbol,interval:a.interval,receivedAt:a.receivedAt},{env,run:s.run,now:time});assert.deepEqual(analysis.bars,a.bars);assert.equal(analysis.meta.barPolicy,a.barPolicy);assert.equal(calls.length,4);
 assert.equal(JSON.stringify(body).includes('test-only-secret'),false);
});
