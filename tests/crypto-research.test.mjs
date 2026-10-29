import test from 'node:test';
import assert from 'node:assert/strict';
import {createCryptoResearchHandler} from '../netlify/functions/crypto-research.mjs';
import {cryptoResearchConfigured,cryptoResearchSelection,cryptoSnapshotKey,readCryptoSnapshot,CryptoResearchError} from '../server/crypto-research.mjs';
import {env as authEnv,fixture,seed,request,prefix,origin} from './identity-fixture.mjs';
const ownerId='12345678-1234-1234-1234-123456789abc',env={...authEnv,ASAF_ADMIN_MEMBER_IDS:ownerId},now=Date.UTC(2026,9,29,12);
const rows=()=>Object.fromEntries(Array.from({length:365},(_,i)=>{const time=Math.floor(now/86400000)*86400-i*86400;return [String(time),[time,1000-i,1002-i,998-i,1001-i,10000+i]]}));
const quote=(id='90',symbol='BTC')=>[{id,symbol,price_usd:'1234.56'}];
function setup(config=env){const state=fixture(),owner=seed(state);let count=0;const calls=[];let respond=async url=>Response.json(url.pathname.includes('ohlcv')?rows():quote(url.searchParams.get('id'),url.searchParams.get('id')==='90'?'BTC':'ETH'));const fetcher=async(url,options)=>{count++;calls.push({url:String(url),options});return respond(url,options)};return {state,owner,handler:createCryptoResearchHandler({env:config,run:state.run,fetcher,now:()=>now}),fetcher,calls:()=>count,requests:calls,set respond(fn){respond=fn}};}
test('owner-only metadata is keyless, daily-only and does not activate stock market flags',async()=>{
 assert.equal(cryptoResearchConfigured(env),true);const s=setup();assert.deepEqual(await(await s.handler(request('crypto-research'))).json(),{enabled:true,ownerOnly:true,provider:'CoinLore',refreshSeconds:60,intervals:['1day']});assert.equal(s.calls(),0);
 const closed=setup({...env,ASAF_ADMIN_MEMBER_IDS:''});assert.equal((await(await closed.handler(request('crypto-research'))).json()).enabled,false);assert.equal((await closed.handler(request('crypto-research',{symbol:'BTCUSD'},closed.owner.cookie))).status,503);assert.equal(closed.calls(),0);
});
test('anonymous, ordinary member and foreign-origin requests cannot fetch research',async()=>{
 const s=setup();assert.equal((await s.handler(request('crypto-research',{symbol:'BTCUSD'}))).status,401);const ordinary=seed(s.state,'other@example.test','22345678-1234-1234-1234-123456789abc','e'.repeat(64));assert.equal((await s.handler(request('crypto-research',{symbol:'BTCUSD'},ordinary.cookie))).status,403);
 const foreign=new Request(origin+'/.netlify/functions/crypto-research',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{"symbol":"BTCUSD"}'});assert.equal((await s.handler(foreign)).status,403);assert.equal(s.calls(),0);assert.equal([...s.state.db.keys()].some(key=>key.includes('crypto:')),false);
});
test('strict BTC/ETH selection rejects unsupported exchange, host, product and intraday requests',async()=>{
 for(const value of ['BTCUSD','BTC-USD','COINLORE:BTCUSD'])assert.equal(cryptoResearchSelection(value).symbol,'COINLORE:BTCUSD');assert.equal(cryptoResearchSelection('ETH-USD').product,'80');
 for(const value of ['COINBASE:BTCUSD','https://evil.test','BTCUSDT','SOLUSD','BTC-USD/../../accounts'])assert.throws(()=>cryptoResearchSelection(value),CryptoResearchError);
 const s=setup();for(const body of [{symbol:'BTCUSDT'},{symbol:'BTCUSD',interval:'1min'},{symbol:'BTCUSD',url:'https://evil.test'}])assert.equal((await s.handler(request('crypto-research',body,s.owner.cookie))).status,400);assert.equal(s.calls(),0);
});
test('fixed two-request adapter preserves 365 daily bars and keeps received quote separate',async()=>{
 const s=setup(),response=await s.handler(request('crypto-research',{symbol:'BTC-USD'},s.owner.cookie));assert.equal(response.status,200);const data=await response.json();assert.equal(data.source,'CoinLore');assert.equal(data.symbol,'COINLORE:BTCUSD');assert.equal(data.providerCoinId,'90');assert.equal(data.internalResearchOnly,true);assert.equal(data.latestBarMayBePartial,true);assert.equal(data.delayMinutes,null);assert.equal(data.bars.length,365);assert.deepEqual(data.bars.at(-1),{date:'2026-10-29',open:1000,high:1002,low:998,close:1001,volume:10000});assert.deepEqual(data.quote,{price:1234.56,receivedAt:new Date(now).toISOString(),quoteTime:null});assert.notEqual(data.bars.at(-1).close,data.quote.price);
 assert.deepEqual(s.requests.map(r=>r.url),['https://api.coinlore.net/api/coin/ohlcv/?coin=90','https://api.coinlore.net/api/ticker/?id=90']);assert.equal(s.requests[0].options.redirect,'error');assert.ok(s.requests[0].options.signal);assert.equal(JSON.stringify(data).includes(authEnv.ASAF_REDIS_REST_TOKEN),false);
 const cached=await s.handler(request('crypto-research',{symbol:'COINLORE:BTCUSD'},s.owner.cookie));assert.equal((await cached.json()).cached,true);assert.equal(s.calls(),2);
});
test('historical last candle may be yesterday, but old, malformed or future history is rejected',async()=>{
 const s=setup();s.respond=async url=>{const data=rows();delete data[String(Math.floor(now/86400000)*86400)];return Response.json(url.pathname.includes('ohlcv')?data:quote())};assert.equal((await s.handler(request('crypto-research',{symbol:'BTCUSD'},s.owner.cookie))).status,200);
 const invalid=[()=>({}),()=>{const data=rows(),key=Object.keys(data).at(-1);data[key][1]=100000;return data},()=>{const data=rows(),key=Object.keys(data).at(-1);data[key][5]=-1;return data},()=>{const data=rows();data[String(Math.floor(now/86400000)*86400+86400)]=[Math.floor(now/86400000)*86400+86400,1,2,1,2,10];return data},()=>{const data=rows();for(const key of Object.keys(data))if(Number(key)>now/1000-4*86400)delete data[key];return data}];
 for(const make of invalid){const x=setup();x.respond=async()=>Response.json(make());assert.equal((await x.handler(request('crypto-research',{symbol:'BTCUSD'},x.owner.cookie))).status,502);assert.equal(x.state.db.has(cryptoSnapshotKey('BTCUSD','1day',env)),false);}
});
test('ticker mismatch and malformed quote cannot be converted into a fake daily candle',async()=>{
 for(const value of [quote('80','ETH'),[{id:'90',symbol:'BTC',price_usd:'NaN'}],[{id:'90',symbol:'BTC',price_usd:'-1'}]]){const s=setup();s.respond=async url=>Response.json(url.pathname.includes('ohlcv')?rows():value);assert.equal((await s.handler(request('crypto-research',{symbol:'BTCUSD'},s.owner.cookie))).status,502);assert.equal(s.state.db.has(cryptoSnapshotKey('BTCUSD','1day',env)),false);}
});
test('cache-only AI reads use server history and quote, never fetch or spend provider quota',async()=>{
 const s=setup();await assert.rejects(()=>readCryptoSnapshot({selected:'BTCUSD',env,run:s.state.run,fetcher:s.fetcher,now,cachedOnly:true}),e=>e.status===409);assert.equal(s.calls(),0);await s.handler(request('crypto-research',{symbol:'BTCUSD'},s.owner.cookie));
 const cached=await readCryptoSnapshot({selected:'BTCUSD',env,run:s.state.run,fetcher:s.fetcher,now:now+60001,cachedOnly:true,maxAgeMs:900000});assert.equal(cached.cached,true);assert.equal(s.calls(),2);await assert.rejects(()=>readCryptoSnapshot({selected:'BTCUSD',env,run:s.state.run,fetcher:s.fetcher,now:now+900001,cachedOnly:true,maxAgeMs:900000}),e=>e.status===409);assert.equal(s.calls(),2);
});
test('parallel requests share lock; 100 daily refresh slots cap two-request upstream cost at200',async()=>{
 const s=setup();let release;const pending=new Promise(resolve=>release=resolve);s.respond=async url=>{await pending;return Response.json(url.pathname.includes('ohlcv')?rows():quote())};const first=s.handler(request('crypto-research',{symbol:'BTCUSD'},s.owner.cookie));await new Promise(resolve=>setImmediate(resolve));assert.equal((await s.handler(request('crypto-research',{symbol:'BTCUSD'},s.owner.cookie))).status,429);release();assert.equal((await first).status,200);assert.equal(s.calls(),2);
 const x=setup();x.state.db.set(prefix+'crypto:provider-day:'+new Date(now).toISOString().slice(0,10),'100');assert.equal((await x.handler(request('crypto-research',{symbol:'BTCUSD'},x.owner.cookie))).status,429);assert.equal(x.calls(),0);
});
test('provider failure, oversized body and storage outage fail closed and preserve last good cache',async()=>{
 const s=setup();await s.handler(request('crypto-research',{symbol:'BTCUSD'},s.owner.cookie));const key=cryptoSnapshotKey('BTCUSD','1day',env),old=JSON.parse(s.state.db.get(key));old.receivedAt=new Date(now-60001).toISOString();old.quote.receivedAt=old.receivedAt;s.state.db.set(key,JSON.stringify(old));const saved=s.state.db.get(key);
 s.respond=async()=>new Response('x'.repeat(256*1024+1));assert.equal((await s.handler(request('crypto-research',{symbol:'BTCUSD'},s.owner.cookie))).status,502);assert.equal(s.state.db.get(key),saved);
 s.respond=async()=>{throw Error('secret debug detail')};const response=await s.handler(request('crypto-research',{symbol:'BTCUSD'},s.owner.cookie));assert.equal(response.status,502);assert.equal(JSON.stringify(await response.json()).includes('secret debug detail'),false);assert.equal(s.state.db.get(key),saved);
 const x=setup();x.state.online=false;assert.equal((await x.handler(request('crypto-research',{symbol:'BTCUSD'},x.owner.cookie))).status,503);assert.equal(x.calls(),0);
});
