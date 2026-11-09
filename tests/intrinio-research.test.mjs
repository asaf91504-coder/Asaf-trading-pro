import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntrinioHandler} from '../netlify/functions/intrinio-research.mjs';
import {readIntrinioSnapshot,intrinioSnapshotKey,intrinioSelection} from '../server/intrinio-research.mjs';
import {env as authEnv,fixture,seed,request,prefix,origin} from './identity-fixture.mjs';
const now=Date.UTC(2026,10,9,12),ownerId='12345678-1234-1234-1234-123456789abc';
const env={...authEnv,ASAF_ADMIN_MEMBER_IDS:ownerId,ASAF_INTRINIO_ENABLED:'true',INTRINIO_API_KEY:'test-secret-never-in-url',ASAF_INTRINIO_TRIAL_ENDS_AT:'2026-11-23T00:00:00Z'};
const rows=()=>({security:{ticker:'AAPL',currency:'USD',exchange_mic:'XNAS'},stock_prices:Array.from({length:201},(_,i)=>({date:new Date(now-i*86400000).toISOString().slice(0,10),frequency:'daily',intraperiod:i===0,open:500,adj_open:100,adj_high:103,adj_low:99,adj_close:102,adj_volume:1234})),next_page:'unused'});
function setup(config=env){const state=fixture(),owner=seed(state),calls=[];let respond=async()=>Response.json(rows());const fetcher=async(url,options)=>{calls.push({url:String(url),options});return respond()};return {state,owner,calls,fetcher,handler:createIntrinioHandler({env:config,run:state.run,fetcher,now:()=>now}),set respond(fn){respond=fn}}}
test('Intrinio disabled, expired and incomplete setup fails closed before spending credits',async()=>{
 for(const change of [{ASAF_INTRINIO_ENABLED:'false'},{INTRINIO_API_KEY:''},{ASAF_INTRINIO_TRIAL_ENDS_AT:''},{ASAF_INTRINIO_TRIAL_ENDS_AT:'2026-11-08T00:00:00Z'},{ASAF_ADMIN_MEMBER_IDS:''}]){const s=setup({...env,...change});assert.equal((await(await s.handler(request('intrinio-research'))).json()).enabled,false);assert.equal((await s.handler(request('intrinio-research',{symbol:'AAPL'},s.owner.cookie))).status,503);assert.equal(s.calls.length,0)}
});
test('Intrinio metadata is secret-free and owner endpoint rejects guests, members and cross-origin writes',async()=>{
 const s=setup();assert.deepEqual(await(await s.handler(request('intrinio-research'))).json(),{enabled:true,ownerOnly:true,provider:'Intrinio',intervals:['1day'],refreshSeconds:60,aiAnalysisEnabled:false});
 assert.equal((await s.handler(request('intrinio-research',{symbol:'AAPL'}))).status,401);
 const other=seed(s.state,'other@example.test','22345678-1234-1234-1234-123456789abc','e'.repeat(64));assert.equal((await s.handler(request('intrinio-research',{symbol:'AAPL'},other.cookie))).status,403);
 assert.equal((await s.handler(new Request(origin+'/.netlify/functions/intrinio-research',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:'{}'}))).status,403);assert.equal(s.calls.length,0);
});
test('Intrinio fixed endpoint uses header auth, adjusted completed daily candles and one capped request',async()=>{
 const s=setup(),response=await s.handler(request('intrinio-research',{symbol:'NASDAQ:AAPL'},s.owner.cookie));assert.equal(response.status,200);const d=await response.json();assert.equal(d.bars.length,200);assert.equal(d.bars.at(-1).date,'2026-11-08');assert.equal(d.bars.at(-1).open,100);assert.equal(d.internalResearchOnly,true);assert.equal(d.latestBarMayBePartial,false);assert.equal(d.priceAdjustment,'splits-and-dividends');assert.equal(d.source,'Intrinio');assert.equal(d.delayMinutes,null);assert.equal(s.calls.length,1);
 assert.equal(s.calls[0].url,'https://api-v2.intrinio.com/securities/AAPL/prices?frequency=daily&page_size=201');assert.equal(s.calls[0].options.headers.Authorization,'Bearer '+env.INTRINIO_API_KEY);assert.equal(s.calls[0].options.redirect,'error');assert.equal(JSON.stringify(d).includes(env.INTRINIO_API_KEY),false);
 assert.equal((await(await s.handler(request('intrinio-research',{symbol:'AAPL'},s.owner.cookie))).json()).cached,true);assert.equal(s.calls.length,1);
});
test('Intrinio only accepts US tickers and daily data; arbitrary upstream input is rejected',async()=>{
 for(const symbol of ['TASE:AAPL','NASDAQ:AAPL:other','https://evil.test','AAPL/../../accounts'])assert.throws(()=>intrinioSelection(symbol));assert.throws(()=>intrinioSelection('AAPL','1min'));
 const s=setup();for(const body of [{symbol:'AAPL',interval:'1week'},{symbol:'AAPL',url:'https://evil.test'}])assert.equal((await s.handler(request('intrinio-research',body,s.owner.cookie))).status,400);assert.equal(s.calls.length,0);
});
test('Intrinio rejects foreign securities, malformed OHLCV, stale history and mismatched currency',async()=>{
 const mutations=[d=>d.security.ticker='MSFT',d=>d.security.currency='EUR',d=>d.security.exchange_mic='XLON',d=>d.stock_prices[1].adj_high=1,d=>d.stock_prices[1].adj_volume=-1,d=>d.stock_prices=d.stock_prices.slice(10),d=>d.stock_prices[1].date=d.stock_prices[2].date];
 for(const mutate of mutations){const s=setup(),d=rows();mutate(d);s.respond=async()=>Response.json(d);assert.equal((await s.handler(request('intrinio-research',{symbol:'AAPL'},s.owner.cookie))).status,502);assert.equal(s.state.db.has(intrinioSnapshotKey('AAPL',env)),false)}
});
test('Intrinio external failures do not leak key or replace last good snapshot',async()=>{
 const s=setup();await s.handler(request('intrinio-research',{symbol:'AAPL'},s.owner.cookie));const key=intrinioSnapshotKey('AAPL',env),d=JSON.parse(s.state.db.get(key));d.receivedAt=new Date(now-61000).toISOString();s.state.db.set(key,JSON.stringify(d));const old=s.state.db.get(key);
 for(const respond of [async()=>{throw Error(env.INTRINIO_API_KEY)},async()=>new Response(env.INTRINIO_API_KEY,{status:403}),async()=>new Response('x'.repeat(256*1024+1))]){s.respond=respond;const r=await s.handler(request('intrinio-research',{symbol:'AAPL'},s.owner.cookie));assert.equal(r.status,502);assert.equal(JSON.stringify(await r.json()).includes(env.INTRINIO_API_KEY),false);assert.equal(s.state.db.get(key),old)}
});
test('Intrinio quota and per-symbol lock bound requests; cache-only AI never calls upstream',async()=>{
 const s=setup();await assert.rejects(()=>readIntrinioSnapshot({selected:'AAPL',env,run:s.state.run,fetcher:s.fetcher,now,cachedOnly:true}),e=>e.status===409);assert.equal(s.calls.length,0);
 let release;const pending=new Promise(resolve=>release=resolve);s.respond=async()=>{await pending;return Response.json(rows())};const first=s.handler(request('intrinio-research',{symbol:'AAPL'},s.owner.cookie));await new Promise(resolve=>setImmediate(resolve));assert.equal((await s.handler(request('intrinio-research',{symbol:'AAPL'},s.owner.cookie))).status,429);release();assert.equal((await first).status,200);
 assert.equal((await readIntrinioSnapshot({selected:'AAPL',env,run:s.state.run,fetcher:s.fetcher,now:now+60001,cachedOnly:true})).cached,true);assert.equal(s.calls.length,1);
 await assert.rejects(()=>readIntrinioSnapshot({selected:'AAPL',env,run:s.state.run,fetcher:s.fetcher,now:now+300001,cachedOnly:true}),e=>e.status===409);assert.equal(s.calls.length,1);
 const quota=setup();quota.state.db.set(prefix+'intrinio:day:2026-11-09','100');assert.equal((await quota.handler(request('intrinio-research',{symbol:'AAPL'},quota.owner.cookie))).status,429);assert.equal(quota.calls.length,0);
});
