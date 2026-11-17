import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshSharedScan,readSharedScan,sharedScannerKey,SCANNER_COMMIT} from '../server/shared-scanner.mjs';
import {createScanMarketHandler} from '../netlify/functions/scan-market.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
const now=Math.floor(Date.now()/3600000)*3600000;
const env={...authEnv,ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL,MSFT',TWELVE_DATA_API_KEY:'mock',ASAF_MARKET_REQUESTS_PER_MINUTE:'1'};
function setup(){const f=fixture();const run=async a=>{if(a[1]!==SCANNER_COMMIT)return f.run(a);const [lock,state,snapshot,token,value,data]=a.slice(3);if(f.db.get(lock)!==token)return 0;f.db.set(state,value);if(data)f.db.set(snapshot,data);return 1};return {...f,run}}
const bars=Array.from({length:200},(_,i)=>({date:new Date(now-(201-i)*86400000).toISOString().slice(0,10),open:100+i,high:102+i,low:99+i,close:101+i,volume:1000+i}));
const sample=async({selected,now})=>({symbol:selected,bars,source:'Twelve Data',interval:'1day',receivedAt:new Date(now).toISOString()});
test('hourly worker spreads batches and publishes atomically once, with no customer provider calls',async()=>{
 const f=setup(),u=seed(f);let calls=0;const options={env,run:f.run,readBars:async a=>{calls++;return sample(a)}};
 assert.equal((await refreshSharedScan({...options,now})).status,'progress');
 await assert.rejects(readSharedScan({env,run:f.run,now}),/עדיין/);
 assert.equal((await refreshSharedScan({...options,now})).status,'busy');assert.equal(calls,1);
 assert.equal((await refreshSharedScan({...options,now:now+60000})).status,'updated');
 assert.equal((await refreshSharedScan({...options,now:now+120000})).status,'current');assert.equal(calls,2);
 const h=createScanMarketHandler({env,run:f.run,now:()=>now+120000,fetcher:async()=>{throw Error('must never fetch')}});
 for(let i=0;i<5;i++){const r=await h(request('scan-market',{symbols:['AAPL','MSFT']},u.cookie));assert.equal(r.status,200);const data=await r.json();assert.equal(data.records.length,2);assert.equal(data.shared,true);assert.equal(data.stale,false)}
 assert.equal(calls,2);assert.equal((await readSharedScan({env,run:f.run,now:now+3600000})).stale,true);
 assert.equal((await refreshSharedScan({...options,now:now+3600000})).status,'progress');assert.equal(calls,3);
});
test('missing and broken cache do not trigger on-demand provider requests',async()=>{
 const f=setup(),u=seed(f);let calls=0;const h=createScanMarketHandler({env,run:f.run,now:()=>now,fetcher:async()=>{calls++;throw Error('unexpected')}});
 for(const raw of [null,'bad json']){if(raw)f.db.set(sharedScannerKey(env)+':snapshot',raw);assert.equal((await h(request('scan-market',{symbols:['AAPL']},u.cookie))).status,503)}assert.equal(calls,0);
});
test('trial snapshots are owner scoped, expire, and never run in preview or disabled mode',async()=>{
 const f=setup(),owner=seed(f),other=seed(f,'other@test.test','87654321-4321-4321-4321-cba987654321','e'.repeat(64));
 const trial={...env,ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:owner.record.id,ASAF_TWELVE_TRIAL_ENDS_AT:new Date(now+3600000).toISOString()};
 let calls=0;const options={env:trial,run:f.run,readBars:async a=>{calls++;return sample(a)}};
 for(const overrides of [{CONTEXT:'deploy-preview'},{ASAF_HOURLY_SCANNER_ENABLED:'false'}])assert.equal((await refreshSharedScan({...options,env:{...trial,...overrides},now})).status,'disabled');
 assert.equal((await refreshSharedScan({...options,now:now+3600000})).status,'disabled');assert.equal(calls,0);
 await refreshSharedScan({...options,now});await refreshSharedScan({...options,now:now+60000});
 const h=createScanMarketHandler({env:trial,run:f.run,now:()=>now+120000});
 assert.equal((await h(request('scan-market',{symbols:['AAPL']},owner.cookie))).status,200);
 for(const cookie of ['',other.cookie])assert.equal((await h(request('scan-market',{symbols:['AAPL']},cookie))).status,503);
 assert.notEqual(sharedScannerKey(env),sharedScannerKey(trial));
 await assert.rejects(readSharedScan({env:trial,run:f.run,memberId:owner.record.id,now:now+3600000}),/אינה זמינה/);
});
test('partial update labels missing symbols; all-failed cycle retains previous snapshot',async()=>{
 const f=setup(),e={...env,ASAF_MARKET_REQUESTS_PER_MINUTE:'8'};
 const readBars=async a=>{if(a.selected==='MSFT')throw Error('provider failure');return sample(a)};
 await refreshSharedScan({env:e,run:f.run,now,readBars});const data=await readSharedScan({env:e,run:f.run,now});assert.equal(data.partial,true);assert.equal(data.errors[0].symbol,'MSFT');assert.equal(data.records.length,1);
 assert.equal((await refreshSharedScan({env:e,run:f.run,now:now+3600000,readBars:async()=>{throw Error('offline')}})).status,'failed');
 const retained=await readSharedScan({env:e,run:f.run,now:now+3600000});assert.equal(retained.completedAt,data.completedAt);assert.equal(retained.stale,true);
 await assert.rejects(readSharedScan({env:e,run:f.run,now:now+86400001}),/עדיין/);
});
test('fencing rejects stale workers and concurrent invocations cannot duplicate the batch',async()=>{
 const f=setup();let release;const blocked=new Promise(r=>release=r);let calls=0;
 const p=refreshSharedScan({env,run:f.run,now,readBars:async a=>{calls++;await blocked;return sample(a)}});
 await new Promise(r=>setImmediate(r));assert.equal((await refreshSharedScan({env,run:f.run,now,readBars:sample})).status,'busy');
 f.db.set(sharedScannerKey(env)+':lock','replacement-worker');release();assert.equal((await p).status,'superseded');assert.equal(calls,1);assert.equal(f.db.has(sharedScannerKey(env)+':snapshot'),false);
});
test('real provider path respects the existing shared daily budget without increasing it',async()=>{
 const f=setup(),e={...env,ASAF_MARKET_REQUESTS_PER_DAY:'1'};let calls=0;
 const fetcher=async url=>{calls++;return Response.json({meta:{symbol:url.searchParams.get('symbol'),interval:'1day'},values:bars.map(({date,...b})=>({...b,datetime:date}))})};
 await refreshSharedScan({env:e,run:f.run,now,fetcher});
 await refreshSharedScan({env:e,run:f.run,now:now+60000,fetcher});
 const data=await readSharedScan({env:e,run:f.run,now:now+60000});assert.equal(calls,1);assert.equal(data.records.length,1);assert.equal(data.partial,true);assert.equal(data.errors[0].symbol,'MSFT');
});
