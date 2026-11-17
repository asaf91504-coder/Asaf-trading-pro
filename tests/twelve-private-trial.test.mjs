import test from 'node:test';
import assert from 'node:assert/strict';
import {marketAccessAllowed,publicMarketConfigured,readMarketSnapshot,marketSnapshotKey} from '../server/market-feed.mjs';
import {analysisMarket} from '../server/analysis-sources.mjs';
import {createPublicMarketHandler} from '../netlify/functions/public-market.mjs';
import {createScanMarketHandler} from '../netlify/functions/scan-market.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
const now=Date.parse('2026-11-17T14:00:00Z'),end='2026-11-28T22:00:00Z',owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const env={...authEnv,ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'false',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',TWELVE_DATA_API_KEY:'test-secret',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL',ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:owner,ASAF_TWELVE_TRIAL_ENDS_AT:end};
test('private trial authorizes exactly one owner, expires, and never activates public/background access',()=>{
 assert.equal(publicMarketConfigured(env),false);assert.equal(marketAccessAllowed(owner,env,now),true);
 for(const id of [null,undefined,'other',owner+',other'])assert.equal(marketAccessAllowed(id,env,now),false);
 for(const patch of [{ASAF_TWELVE_TRIAL_MEMBER_ID:''},{ASAF_TWELVE_TRIAL_ENDS_AT:'bad'},{ASAF_MARKET_ENABLED:'false'}])assert.equal(marketAccessAllowed(owner,{...env,...patch},now),false);
 assert.equal(marketAccessAllowed(owner,env,Date.parse(end)),false);assert.equal(publicMarketConfigured({...env,ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true'}),false);
});
test('private market GET is per-account; anonymous and other accounts cannot fetch cached or new prices',async()=>{
 const f=fixture(),a=seed(f,'owner@example.test',owner),b=seed(f,'other@example.test','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','e'.repeat(64));let calls=0;
 const h=createPublicMarketHandler({env,run:f.run,now:()=>now,fetcher:async()=>{calls++;throw Error('unexpected provider call')}});
 const get=cookie=>new Request('https://example.test/.netlify/functions/public-market',{headers:cookie?{cookie}:{}});
 assert.equal((await(await h(get(a.cookie))).json()).enabled,true);
 for(const cookie of [null,b.cookie]){assert.equal((await(await h(get(cookie))).json()).enabled,false);assert.equal((await h(request('public-market',{symbol:'AAPL'},cookie))).status,503);}
 for(const memberId of [null,b.record.id])await assert.rejects(readMarketSnapshot({selected:'AAPL',env,now,memberId,run:async()=>{throw Error('storage must not be read')}}),/ממתינים/);
 await assert.rejects(analysisMarket({symbol:'AAPL',receivedAt:'x'},{env,now,memberId:b.record.id,run:f.run}));
 assert.equal(calls,0);
 const scan=createScanMarketHandler({env,run:f.run,now:()=>now});assert.equal((await(await scan(get(a.cookie))).json()).enabled,false);
});
test('private cache isolation and cached AI reads require owner on every call',async()=>{
 const f=fixture(),receivedAt=new Date(now).toISOString(),snapshot={symbol:'AAPL',interval:'1day',receivedAt,bars:Array.from({length:21},()=>({close:1})),volumeCoverage:'partial'};
 f.db.set(marketSnapshotKey('AAPL','1day',env),JSON.stringify(snapshot));
 const result=await analysisMarket({symbol:'AAPL',receivedAt},{env,now,memberId:owner,run:f.run});assert.equal(result.bars.length,21);
 await assert.rejects(analysisMarket({symbol:'AAPL',receivedAt},{env,now:Date.parse(end),memberId:owner,run:f.run}));
 assert.notEqual(marketSnapshotKey('AAPL','1day',env),marketSnapshotKey('AAPL','1day',{...env,ASAF_TWELVE_PRIVATE_TRIAL:'false'}));
});
