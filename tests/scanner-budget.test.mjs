import test from 'node:test';
import assert from 'node:assert/strict';
import {scannerBatchPlan} from '../server/scanner-budget.mjs';
import {createScanMarketHandler} from '../netlify/functions/scan-market.mjs';
import {fixture,seed,seedPaid,env as authEnv,request} from './identity-fixture.mjs';
test('cold fundamental batches fit 610 credits and cannot repeat twice per minute',()=>{
 const p=scannerBatchPlan({ASAF_MARKET_REQUESTS_PER_MINUTE:'610',ASAF_MARKET_REQUESTS_PER_DAY:'10000'},{fundamentals:true});
 assert.equal(p.maxSymbols,10);assert.equal(p.batchDelayMs,61000);assert.ok(p.maxSymbols*51<=610);
});
test('small, daily and invalid budgets fail conservatively',()=>{
 assert.deepEqual(scannerBatchPlan({}),{maxSymbols:8,batchDelayMs:61000});
 assert.equal(scannerBatchPlan({},{fundamentals:true}).maxSymbols,0);
 assert.equal(scannerBatchPlan({ASAF_MARKET_REQUESTS_PER_MINUTE:'610',ASAF_MARKET_REQUESTS_PER_DAY:'100'},{fundamentals:true}).maxSymbols,1);
 assert.throws(()=>scannerBatchPlan({ASAF_MARKET_REQUESTS_PER_MINUTE:'NaN'}));
 assert.equal(scannerBatchPlan({ASAF_MARKET_REQUESTS_PER_MINUTE:'610'}).batchDelayMs,31000);
});
test('discovery reports affordable size and manual oversized scan makes no provider or quota calls',async()=>{
 const f=fixture(),u=seed(f);seedPaid(f,u,Date.now()+86400000);let calls=0,quotaCalls=0;
 const env={...authEnv,ASAF_BILLING_ENABLED:'true',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL,MSFT',TWELVE_DATA_API_KEY:'mock',ASAF_MARKET_REQUESTS_PER_MINUTE:'1'};
 const h=createScanMarketHandler({env,run:async a=>{if(a[0]==='EVAL')quotaCalls++;return f.run(a)},fetcher:async()=>{calls++;throw Error('unexpected')}});
 const config=await(await h(request('scan-market',null,u.cookie))).json();assert.equal(config.enabled,true);assert.equal(config.maxSymbols,1);assert.equal(config.batchDelayMs,61000);
 const r=await h(request('scan-market',{symbols:['AAPL','MSFT']},u.cookie));assert.equal(r.status,422);assert.equal((await r.json()).code,'scan_batch_limit');assert.equal(calls,0);assert.equal(quotaCalls,0);
 const blocked=createScanMarketHandler({env:{...env,ASAF_MARKET_FUNDAMENTALS_ENABLED:'true'},run:f.run});assert.equal((await(await blocked(request('scan-market',null,u.cookie))).json()).enabled,false);
});
