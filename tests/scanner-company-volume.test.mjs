import test from 'node:test';
import assert from 'node:assert/strict';
import {readScannerSnapshot} from '../server/scanner-market-data.mjs';
import {readMarketSnapshot} from '../server/market-feed.mjs';
import {readMarketFundamentals} from '../server/market-fundamentals.mjs';
import {refreshSharedScan,readSharedScan,SCANNER_COMMIT} from '../server/shared-scanner.mjs';
import {createScanMarketHandler} from '../netlify/functions/scan-market.mjs';
import {scannerBatchPlan} from '../server/scanner-budget.mjs';
import {comparableDailyVolume} from '../comparable-volume.mjs';
import {scanBars} from '../scanner-core.mjs';
import {ventureScanRecord} from '../server/venture-presentation.mjs';
import {env as authEnv,fixture,seed,request} from './identity-fixture.mjs';
const now=Date.parse('2026-11-26T12:00:00Z'),owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const env={...authEnv,ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AMD,TSLA',TWELVE_DATA_API_KEY:'mock-key',ASAF_MARKET_FUNDAMENTALS_ENABLED:'true',ASAF_SCANNER_DAILY_VOLUME_ENABLED:'true',ASAF_MARKET_REQUESTS_PER_MINUTE:'60',ASAF_MARKET_REQUESTS_PER_DAY:'4000',ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:owner,ASAF_TWELVE_TRIAL_ENDS_AT:'2026-11-28T22:00:00Z'};
const values=Array.from({length:200},(_,i)=>({datetime:new Date(now-(201-i)*86400000).toISOString().slice(0,10),open:100+i,high:102+i,low:99+i,close:101+i,volume:i===199?30000:10000}));
const provider=(url)=>Response.json(url.pathname==='/statistics'?{meta:{symbol:url.searchParams.get('symbol'),currency:'USD'},statistics:{valuations_metrics:{market_capitalization:'450000000000'}}}:{meta:{symbol:url.searchParams.get('symbol'),currency:'USD',interval:'1day',exchange_timezone:'America/New_York'},values:values.map(b=>({...b,volume:url.searchParams.get('adjust')==='none'?b.volume:1}))});

test('trial owner receives company size and comparable consolidated volume without changing chart candles',async()=>{
 const f=fixture(),u=seed(f,'owner@test.test',owner),calls=[];
 const h=createScanMarketHandler({env,run:f.run,now:()=>now,fetcher:async url=>{calls.push(url);return provider(url)}});
 const response=await h(request('scan-market',{symbols:['AMD']},u.cookie));assert.equal(response.status,200);
 const r=(await response.json()).records[0];assert.equal(r.marketCapStatus,'available');assert.equal(r.company.marketCapUsd,450e9);assert.equal(r.company.asOf,null);assert.equal(r.company.receivedAt,new Date(now).toISOString());
 assert.equal(r.metrics.relativeVolume,3);assert.equal(r.metrics.volumeCoverage,'consolidated');assert.equal(r.metrics.volumeComparison,'verified');assert.equal(r.bars,undefined);assert.equal(r.fundamentals,undefined);
 assert.deepEqual(calls.map(u=>[u.pathname,u.searchParams.get('adjust')]),[['/time_series','splits'],['/time_series','none'],['/statistics',null]]);
 const chart=await readMarketSnapshot({selected:'AMD',memberId:owner,env,now,run:f.run,cachedOnly:true});assert.equal(chart.bars.at(-1).volume,1);assert.equal(chart.priceAdjustment,'splits');
 const cached=await h(request('scan-market',{symbols:['AMD'],cachedOnly:true},u.cookie));assert.equal(cached.status,200);assert.equal(calls.length,3);
 assert.doesNotMatch(JSON.stringify(r),/mock-key/);
});

test('company cache still enforces trial identity and expiry before reading storage',async()=>{
 for(const [memberId,time] of [[null,now],['other',now],[owner,Date.parse(env.ASAF_TWELVE_TRIAL_ENDS_AT)]])await assert.rejects(readMarketFundamentals({selected:'AMD',memberId,env,now:time,run:()=>assert.fail('must reject before storage')}));
 const f=fixture();let calls=0;const opts={selected:'AMD',memberId:owner,env,now,run:f.run,fetcher:async url=>{calls++;return provider(url)}};
 const first=await readMarketFundamentals(opts),cached=await readMarketFundamentals({...opts,now:now+23*3600000});assert.deepEqual(cached,first);assert.equal(calls,1);
});

test('volume outage preserves price research but cannot pass the volume rule',async()=>{
 const f=fixture();const r=await readScannerSnapshot({selected:'AMD',memberId:owner,env,run:f.run,now,fetcher:async url=>url.searchParams.get('adjust')==='none'?new Response('',{status:403}):provider(url)});
 assert.equal(r.bars.length,200);assert.equal(r.volumeBasis,null);assert.equal(comparableDailyVolume(r.bars,r).status,'unverifiable');
});

test('unadjusted volume does not borrow missing dates or accept wrong currency',async()=>{
 for(const wrongCurrency of [false,true]){
  const f=fixture(),r=await readScannerSnapshot({selected:'AMD',memberId:owner,env,run:f.run,now,fetcher:async url=>{
   const data=await provider(url).json();if(url.searchParams.get('adjust')==='none'){if(wrongCurrency)data.meta.currency='EUR';else data.values.splice(-2,1);}return Response.json(data);
  }});
  assert.equal(comparableDailyVolume(r.bars,r).status,'unverifiable');
 }
});

test('numeric cap projection rejects stale, mismatched and nonfinite data',()=>{
 const r={...scanBars('AMD',values.map(({datetime,...b})=>({date:datetime,...b}))),fundamentals:{status:'available',source:'Twelve Data',symbol:'AMD',currency:'USD',marketCap:450e9,receivedAt:new Date(now).toISOString()}};
 for(const patch of [{receivedAt:new Date(now-86400000).toISOString()},{symbol:'TSLA'},{currency:'EUR'},{marketCap:NaN}]){
  const projected=ventureScanRecord({...r,fundamentals:{...r.fundamentals,...patch}},{matches:false,reasons:[]},null,[],now);assert.equal(projected.company,null);assert.equal(projected.marketCapStatus,'unavailable');
 }
});

test('cold scanner budget includes both series and statistics',()=>{
 assert.deepEqual(scannerBatchPlan(env,{fundamentals:true}),{maxSymbols:1,batchDelayMs:61000});
 assert.equal(scannerBatchPlan({...env,ASAF_MARKET_REQUESTS_PER_MINUTE:'51'},{fundamentals:true}).maxSymbols,0);
 assert.equal(scannerBatchPlan({...env,ASAF_MARKET_REQUESTS_PER_MINUTE:'104'},{fundamentals:true}).maxSymbols,2);
});

test('background refresh enriches every stock as the trial owner and client reads spend no credits',async()=>{
 const f=fixture(),configured={...env,ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_ALLOWED_SYMBOLS:Array.from({length:50},(_,i)=>'STOCK'+i).join(',')};let calls=0;
 const run=async a=>{if(a[1]!==SCANNER_COMMIT)return f.run(a);const [lock,state,snapshot,token,value,data]=a.slice(3);if(f.db.get(lock)!==token)return 0;f.db.set(state,value);if(data)f.db.set(snapshot,data);return 1;};
 const opts={env:configured,run,fetcher:async url=>{calls++;return provider(url)}};
 for(let i=0;i<50;i++)assert.equal((await refreshSharedScan({...opts,now:now+i*60000})).status,i===49?'updated':'progress');assert.equal(calls,150);
 const scan=await readSharedScan({env:configured,run,now:now+50*60000,memberId:owner});assert.equal(scan.records.length,50);
 for(const r of scan.records){assert.equal(r.fundamentals.marketCap,450e9);assert.equal(r.volumeComparison.ratio,3);assert.equal(r.volumeComparison.coverage,'consolidated');}
 assert.equal(calls,150);
});
