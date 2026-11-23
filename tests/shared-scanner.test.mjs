import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshSharedScan,readSharedScan,sharedScannerKey,SCANNER_COMMIT} from '../server/shared-scanner.mjs';
import {billingIdentity,recordKey,DAY} from '../server/billing.mjs';
import {createScanMarketHandler} from '../netlify/functions/scan-market.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
const now=Math.floor(Date.now()/10800000)*10800000;
const env={...authEnv,ASAF_BILLING_ENABLED:'true',ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL,MSFT',TWELVE_DATA_API_KEY:'mock',ASAF_MARKET_REQUESTS_PER_MINUTE:'1'};
function setup(){const f=fixture();const run=async a=>{if(a[1]!==SCANNER_COMMIT)return f.run(a);const [lock,state,snapshot,token,value,data]=a.slice(3);if(f.db.get(lock)!==token)return 0;f.db.set(state,value);if(data)f.db.set(snapshot,data);return 1};return {...f,run}}
async function seedBilling(f,u,record){
 const identity=await billingIdentity(u.record.id,{env,run:f.run});
 const key=recordKey(identity,env);
 if(record!==undefined)f.db.set(key,typeof record==='string'?record:JSON.stringify(record));
 return key;
}
const bars=Array.from({length:200},(_,i)=>({date:new Date(now-(201-i)*86400000).toISOString().slice(0,10),open:100+i,high:102+i,low:99+i,close:101+i,volume:1000+i}));
const sample=async({selected,now})=>({symbol:selected,bars,source:'Twelve Data',interval:'1day',receivedAt:new Date(now).toISOString()});
test('three-hour worker spreads batches and publishes atomically once, with no customer provider calls',async()=>{
 const f=setup(),u=seed(f);await seedBilling(f,u,{paidUntil:now+DAY});let calls=0;const options={env,run:f.run,readBars:async a=>{calls++;return sample(a)}};
 assert.equal((await refreshSharedScan({...options,now})).status,'progress');
 await assert.rejects(readSharedScan({env,run:f.run,now}),/עדיין/);
 assert.equal((await refreshSharedScan({...options,now})).status,'busy');assert.equal(calls,1);
 assert.equal((await refreshSharedScan({...options,now:now+60000})).status,'updated');
 assert.equal((await refreshSharedScan({...options,now:now+120000})).status,'current');assert.equal(calls,2);
 const h=createScanMarketHandler({env,run:f.run,now:()=>now+120000,fetcher:async()=>{throw Error('must never fetch')}});
 for(let i=0;i<5;i++){const r=await h(request('scan-market',{symbols:['AAPL','MSFT']},u.cookie));assert.equal(r.status,200);const data=await r.json();assert.equal(data.records.length,2);assert.equal(data.shared,true);assert.equal(data.stale,false)}
 assert.equal(calls,2);assert.equal((await refreshSharedScan({...options,now:now+3600000})).status,'current');assert.equal((await refreshSharedScan({...options,now:now+7200000})).status,'current');assert.equal(calls,2);assert.equal((await readSharedScan({env,run:f.run,now:now+10800000})).stale,true);
 assert.equal((await refreshSharedScan({...options,now:now+10800000})).status,'progress');assert.equal(calls,3);
});
test('missing and broken cache do not trigger on-demand provider requests',async()=>{
 const f=setup(),u=seed(f);await seedBilling(f,u,{paidUntil:now+DAY});let calls=0;const h=createScanMarketHandler({env,run:f.run,now:()=>now,fetcher:async()=>{calls++;throw Error('unexpected')}});
 for(const raw of [null,'bad json']){if(raw)f.db.set(sharedScannerKey(env)+':snapshot',raw);assert.equal((await h(request('scan-market',{symbols:['AAPL']},u.cookie))).status,503)}assert.equal(calls,0);
});
test('commercial scanner rejects anonymous, missing, free, complimentary, expired and uncheckable access without creating trials',async()=>{
 for(const [record,expected,overrides] of [
  [undefined,402,{}],
  [{trialStartedAt:now,trialEndsAt:now+7*DAY},402,{}],
  [{trialStartedAt:now-DAY,trialEndsAt:now+6*DAY,complimentaryUntil:now+20*DAY},402,{}],
  [{paidUntil:now},402,{}],
  ['bad json',503,{}],
  [{paidUntil:now+DAY},503,{ASAF_BILLING_ENABLED:'false'}],
 ]){
  const f=setup(),u=seed(f),key=await seedBilling(f,u,record),before=f.db.get(key),commands=[];
  const h=createScanMarketHandler({env:{...env,...overrides},now:()=>now,run:async a=>{commands.push(a);return f.run(a)},fetcher:async()=>{assert.fail('provider should not be called')}});
  for(const body of [undefined,{symbols:['AAPL']},{symbols:['AAPL'],cachedOnly:true}]){
   const result=await h(request('scan-market',body,u.cookie));
   assert.equal(result.status,expected);
   assert.deepEqual(Object.keys(await result.json()).sort(),['code','enabled','error']);
  }
  assert.ok(commands.every(a=>a[0]==='GET'));
  assert.equal(f.db.get(key),before);
 }
 const f=setup(),h=createScanMarketHandler({env,run:f.run,now:()=>now});
 for(const body of [undefined,{symbols:['AAPL']}])assert.equal((await h(request('scan-market',body))).status,401);
});
test('commercial scanner configuration is available to paid accounts and never writes to billing',async()=>{
 const f=setup(),u=seed(f);await seedBilling(f,u,{paidUntil:now+1});
 const commands=[],h=createScanMarketHandler({env,run:async a=>{commands.push(a);return f.run(a)},now:()=>now});
 const result=await h(request('scan-market',undefined,u.cookie));
 assert.equal(result.status,200);
 assert.deepEqual((await result.json()).symbols,['AAPL','MSFT']);
 assert.ok(commands.every(a=>a[0]==='GET'));
});
test('trial snapshots are owner scoped, expire, and never run in preview or disabled mode',async()=>{
 const f=setup(),owner=seed(f),other=seed(f,'other@test.test','87654321-4321-4321-4321-cba987654321','e'.repeat(64));
 const trial={...env,ASAF_BILLING_ENABLED:'false',ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:owner.record.id,ASAF_TWELVE_TRIAL_ENDS_AT:new Date(now+10800000).toISOString()};
 let calls=0;const options={env:trial,run:f.run,readBars:async a=>{calls++;return sample(a)}};
 for(const overrides of [{CONTEXT:'deploy-preview'},{ASAF_HOURLY_SCANNER_ENABLED:'false'}])assert.equal((await refreshSharedScan({...options,env:{...trial,...overrides},now})).status,'disabled');
 assert.equal((await refreshSharedScan({...options,now:now+10800000})).status,'disabled');assert.equal(calls,0);
 await refreshSharedScan({...options,now});await refreshSharedScan({...options,now:now+60000});
 const h=createScanMarketHandler({env:trial,run:f.run,now:()=>now+120000});
 assert.equal((await h(request('scan-market',{symbols:['AAPL']},owner.cookie))).status,200);
 for(const cookie of ['',other.cookie])assert.equal((await h(request('scan-market',{symbols:['AAPL']},cookie))).status,503);
 assert.notEqual(sharedScannerKey(env),sharedScannerKey(trial));
 await assert.rejects(readSharedScan({env:trial,run:f.run,memberId:owner.record.id,now:now+10800000}),/אינה זמינה/);
});
test('partial update labels missing symbols; all-failed cycle retains previous snapshot',async()=>{
 const f=setup(),e={...env,ASAF_MARKET_REQUESTS_PER_MINUTE:'8'};
 const readBars=async a=>{if(a.selected==='MSFT')throw Error('provider failure');return sample(a)};
 await refreshSharedScan({env:e,run:f.run,now,readBars});const data=await readSharedScan({env:e,run:f.run,now});assert.equal(data.partial,true);assert.equal(data.errors[0].symbol,'MSFT');assert.equal(data.records.length,1);
 assert.equal((await refreshSharedScan({env:e,run:f.run,now:now+10800000,readBars:async()=>{throw Error('offline')}})).status,'failed');
 const retained=await readSharedScan({env:e,run:f.run,now:now+10800000});assert.equal(retained.completedAt,data.completedAt);assert.equal(retained.stale,true);
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
