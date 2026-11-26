import test from 'node:test';
import assert from 'node:assert/strict';
import {createScannerCapacityHandler} from '../netlify/functions/scanner-capacity.mjs';
import {env as authEnv,fixture,seed,request} from './identity-fixture.mjs';
const now=Date.parse('2026-11-26T12:00:00Z'),owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const env={...authEnv,ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AMD',TWELVE_DATA_API_KEY:'test-only-provider-secret',ASAF_MARKET_REQUESTS_PER_MINUTE:'60',ASAF_MARKET_REQUESTS_PER_DAY:'2000',ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:owner,ASAF_TWELVE_TRIAL_ENDS_AT:'2026-11-28T22:00:00Z'};
test('live capacity inspection is owner-only, uses provider authorization and returns no raw secrets',async()=>{
 const f=fixture(),user=seed(f,'owner@test.test',owner),other=seed(f,'other@test.test','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','e'.repeat(64));let calls=0;
 const h=createScannerCapacityHandler({env,run:f.run,now:()=>now,fetcher:async (url,options)=>{calls++;assert.equal(url,'https://api.twelvedata.com/api_usage');assert.equal(options.headers.Authorization,'apikey '+env.TWELVE_DATA_API_KEY);return Response.json({plan_limit:610,plan_daily_limit:100000,apikey:'must-not-be-returned',user_email:'must-not-be-returned'})}});
 for(const cookie of ['',other.cookie]){assert.equal((await(await h(request('scanner-capacity',null,cookie))).json()).enabled,false);assert.equal((await h(request('scanner-capacity',{},cookie))).status,403);}
 assert.equal(calls,0);assert.equal((await(await h(request('scanner-capacity',null,user.cookie))).json()).enabled,true);assert.equal(calls,0);
 const response=await h(request('scanner-capacity',{},user.cookie));assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.providerLimits,{perMinute:610,perDay:100000,planCategory:null});assert.equal(body.company.available,false);assert.doesNotMatch(JSON.stringify(body),/test-only-provider-secret|must-not-be-returned|Authorization/);
 assert.equal((await h(request('scanner-capacity',{},user.cookie))).status,429);assert.equal(calls,1);
});
test('company availability probe uses the same guarded statistics connection',async()=>{
 const f=fixture(),user=seed(f,'owner@test.test',owner),h=createScannerCapacityHandler({env:{...env,ASAF_MARKET_FUNDAMENTALS_ENABLED:'true'},run:f.run,now:()=>now,fetcher:async url=>String(url).includes('api_usage')?Response.json({plan_limit:60}):Response.json({meta:{symbol:'AMD',currency:'USD'},statistics:{valuations_metrics:{market_capitalization:450e9}}})});
 const body=await(await h(request('scanner-capacity',{},user.cookie))).json();assert.equal(body.company.available,true);assert.equal(body.company.symbol,'AMD');assert.equal(body.company.marketCap,undefined);assert.equal(body.providerLimits.perDay,null);
});
