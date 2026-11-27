import test from 'node:test';
import assert from 'node:assert/strict';
import {scannerUniverse} from '../server/scanner-universe.mjs';
import {scannerCapacity} from '../server/scanner-budget.mjs';
import {refreshSharedScan,readSharedScan,sharedScannerKey,SCANNER_COMMIT} from '../server/shared-scanner.mjs';
import {scannerDailyVolumeBasis} from '../server/scanner-market-data.mjs';
import {MarketError} from '../server/market-feed.mjs';
import {createScanMarketHandler} from '../netlify/functions/scan-market.mjs';
import {setupCandidates} from '../server/setup-review.mjs';
import {env as authEnv,fixture,seed,request} from './identity-fixture.mjs';
const now=Date.parse('2026-11-26T12:00:00Z'),owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const symbols=Array.from({length:1000},(_,i)=>'STOCK'+i);
const env={...authEnv,ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:symbols.join(','),TWELVE_DATA_API_KEY:'mock-key',ASAF_MARKET_FUNDAMENTALS_ENABLED:'true',ASAF_SCANNER_DAILY_VOLUME_ENABLED:'true',ASAF_MARKET_REQUESTS_PER_MINUTE:'610',ASAF_MARKET_REQUESTS_PER_DAY:'100000',ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:owner,ASAF_TWELVE_TRIAL_ENDS_AT:'2026-11-28T22:00:00Z'};
const bars=Array.from({length:200},(_,i)=>({date:new Date(now-(201-i)*86400000).toISOString().slice(0,10),open:100+i,high:102+i,low:99+i,close:101+i,volume:i===199?30000:10000}));
const sample=async ({selected,now,env})=>({symbol:selected,bars,source:'Twelve Data',interval:'1day',receivedAt:new Date(now).toISOString(),barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,volumeBasis:scannerDailyVolumeBasis(env)});
const company=async ({selected,now})=>({status:'available',source:'Twelve Data',symbol:selected,currency:'USD',marketCap:450e9,receivedAt:new Date(now).toISOString()});
function setup(){
 const f=fixture(),commands=[];
 const run=async a=>{
  commands.push(a);if(a[1]!==SCANNER_COMMIT)return f.run(a);
  const [lock,state,snapshot,token,value,data]=a.slice(3);if(f.db.get(lock)!==token)return 0;f.db.set(state,value);if(data)f.db.set(snapshot,data);return 1;
 };
 return {...f,run,commands};
}

test('legacy US cache preset has 1,000 unique symbols and preserves configured names',()=>{
 const list=scannerUniverse({ASAF_SCANNER_UNIVERSE:'us1000',ASAF_MARKET_ALLOWED_SYMBOLS:'TSLA,AMD, TSLA'},{legacy:true});
 assert.equal(list.length,1000);assert.equal(new Set(list).size,1000);assert.deepEqual(list.slice(0,2),['TSLA','AMD']);
 assert.equal(scannerUniverse(env).length,1000);
 assert.deepEqual(scannerUniverse({...env,ASAF_MARKET_ALLOWED_SYMBOLS:Array.from({length:10001},(_,i)=>'STOCK'+i).join(',')}),[]);
 for(const patch of [{ASAF_SCANNER_UNIVERSE:'unknown'},{ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL,bad/name'}])assert.deepEqual(scannerUniverse({...env,...patch}),[]);
});

test('capacity exposes the real cold-load budget and speed without changing provider limits',()=>{
 const constrained=scannerCapacity({...env,ASAF_MARKET_REQUESTS_PER_MINUTE:'60',ASAF_MARKET_REQUESTS_PER_DAY:'2000'},{symbols:1000,fundamentals:true});
 assert.equal(constrained.coldCredits,52000);assert.equal(constrained.coldMinutes,1000);assert.equal(constrained.coldFitsDailyBudget,false);assert.equal(constrained.threeHourCyclePossible,false);
 const ready=scannerCapacity(env,{symbols:1000,fundamentals:true});assert.equal(ready.coldMinutes,100);assert.equal(ready.coldFitsDailyBudget,true);assert.equal(ready.threeHourCyclePossible,true);
});

test('1,000-stock worker stores bounded rows and exposes all 1,000 through ten cache-only pages',async()=>{
 const f=setup(),user=seed(f,'owner@test.test',owner);let reads=0;
 const options={env,run:f.run,readBars:async a=>{reads++;return sample(a)},readFundamentals:company};
 for(let i=0;i<100;i++)assert.equal((await refreshSharedScan({...options,now:now+i*60000})).status,i===99?'updated':'progress');
 assert.equal(reads,1000);
 const manifest=JSON.parse(f.db.get(sharedScannerKey(env)+':snapshot'));
 assert.equal(manifest.rows.length,1000);assert.equal(manifest.records.length,0);assert.equal(manifest.progress.complete,true);
 assert.ok(JSON.stringify(manifest).length<300000);assert.ok(f.db.get(sharedScannerKey(env)+':large-state').length<1000);
 assert.equal(f.commands.filter(a=>a[0]==='SET'&&a[1].includes(':row:')).length,1000);
 const h=createScanMarketHandler({env,run:f.run,now:()=>now+100*60000,fetcher:()=>assert.fail('client must not call provider')});
 const config=await(await h(request('scan-market',null,user.cookie))).json();assert.equal(config.symbols.length,1000);assert.equal(config.maxSymbols,100);
 let received=0;
 for(let i=0;i<1000;i+=100){
  const response=await h(request('scan-market',{symbols:symbols.slice(i,i+100)},user.cookie));assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.records.length,100);assert.equal(body.errors.length,0);received+=body.records.length;
  assert.doesNotMatch(JSON.stringify(body),/"bars"|:row:|mock-key|"rows"/);
  for(const r of body.records){assert.equal(r.company.marketCapUsd,450e9);assert.equal(r.metrics.relativeVolume,3);}
 }
 assert.equal(received,1000);assert.equal(reads,1000);assert.ok(f.commands.filter(a=>a[0]==='MGET').every(a=>a.length<=26));
 assert.equal((await h(request('scan-market',{symbols:symbols.slice(0,101)},user.cookie))).status,400);
 const expired=createScanMarketHandler({env,run:f.run,now:()=>Date.parse(env.ASAF_TWELVE_TRIAL_ENDS_AT)});assert.equal((await expired(request('scan-market',{symbols:['STOCK0']},user.cookie))).status,503);
});

test('unfinished work resumes across three-hour boundaries and quota pauses instead of restarting',async()=>{
 const f=setup(),start=now+179*60000;let pause=false;
 const opts={env,run:f.run,readBars:async a=>{if(pause)throw new MarketError('quota',429);return sample(a)},readFundamentals:company};
 assert.equal((await refreshSharedScan({...opts,now:start})).processed,10);
 pause=true;const paused=await refreshSharedScan({...opts,now:start+60000});assert.equal(paused.status,'quota-paused');assert.equal(paused.processed,10);
 pause=false;const resumed=await refreshSharedScan({...opts,now:start+86400000});assert.equal(resumed.processed,20);
 const scan=await readSharedScan({env,run:f.run,now:start+86400000,memberId:owner,symbols:symbols.slice(0,20)});
 assert.equal(scan.records.length,10);assert.equal(scan.errors.length,10);assert.equal(scan.partial,true);assert.equal(scan.progress.processed,20);
});

test('company quota failure pauses the same stock without promoting unknown data',async()=>{
 const f=setup();const result=await refreshSharedScan({env,run:f.run,now,readBars:sample,readFundamentals:async()=>{throw new MarketError('quota',429)}});
 assert.equal(result.status,'quota-paused');assert.equal(result.processed,0);
 const scan=await readSharedScan({env,run:f.run,now,memberId:owner,symbols:symbols.slice(0,100)});assert.equal(scan.records.length,0);assert.equal(scan.partial,true);
});

test('an expired large worker cannot publish orphaned row keys or replace a newer manifest',async()=>{
 const f=setup();let release;const blocked=new Promise(r=>release=r);
 const pending=refreshSharedScan({env,run:f.run,now,readBars:async a=>{await blocked;return sample(a)},readFundamentals:company});
 await new Promise(r=>setImmediate(r));assert.equal((await refreshSharedScan({env,run:f.run,now,readBars:sample,readFundamentals:company})).status,'busy');
 f.db.set(sharedScannerKey(env)+':lock','new-worker');release();assert.equal((await pending).status,'superseded');assert.equal(f.db.has(sharedScannerKey(env)+':snapshot'),false);
});

test('rolling setup candidates use the actual stock update time while a cycle is incomplete',()=>{
 const receivedAt=new Date(now).toISOString();const list=setupCandidates({startedAt:receivedAt,completedAt:null,progress:{complete:false},records:[{symbol:'AMD',source:'Twelve Data',receivedAt,bars,interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,summary:{date:bars.at(-1).date},research:{candidates:[{kind:'breakout',scenario:{side:'long',entry:310,target:400}}]}}]});
 assert.equal(list.length,1);assert.equal(list[0].scanAt,receivedAt);
});

test('new rolling batches retire only rows superseded by a committed manifest',async()=>{
 const f=setup(),small={...env,ASAF_MARKET_ALLOWED_SYMBOLS:symbols.slice(0,60).join(',')},options={env:small,run:f.run,readBars:sample,readFundamentals:company};
 for(let i=0;i<6;i++)await refreshSharedScan({...options,now:now+i*60000});
 const first=JSON.parse(f.db.get(sharedScannerKey(small)+':snapshot'));assert.equal(first.rows.length,60);
 await refreshSharedScan({...options,now:now+3*3600000});
 const cleanup=f.commands.find(a=>a[1]?.includes('scanner-expire-superseded'));assert.ok(cleanup);assert.equal(Number(cleanup[2]),10);assert.deepEqual(cleanup.slice(3),first.rows.slice(0,10).map(r=>r.key));
 const rolling=await readSharedScan({env:small,run:f.run,now:now+3*3600000,memberId:owner});assert.equal(rolling.records.length,60);assert.equal(rolling.partial,true);assert.equal(rolling.progress.processed,10);
});

test('a transient refresh error preserves a previous valid scanner row and reports partial coverage',async()=>{
 const f=setup(),small={...env,ASAF_MARKET_ALLOWED_SYMBOLS:symbols.slice(0,60).join(',')},options={env:small,run:f.run,readBars:sample,readFundamentals:company};
 for(let i=0;i<6;i++)await refreshSharedScan({...options,now:now+i*60000});
 const prior=await readSharedScan({env:small,run:f.run,now:now+6*60000,memberId:owner});assert.equal(prior.records.length,60);
 await refreshSharedScan({...options,now:now+3*3600000,readBars:async()=>{throw new MarketError('temporary outage',503)}});
 const retained=await readSharedScan({env:small,run:f.run,now:now+3*3600000,memberId:owner});assert.equal(retained.records.length,60);assert.equal(retained.partial,true);assert.equal(retained.errors.length,10);assert.equal(retained.records[0].receivedAt,prior.records[0].receivedAt);
 const expired=await readSharedScan({env:small,run:f.run,now:now+25*3600000,memberId:owner});assert.equal(expired.records.length,0);
});

test('expanding to 10,000 retains prior cached research while the new namespace fills',async()=>{
 const f=setup(),options={env,run:f.run,readBars:sample,readFundamentals:company};
 const previousEnv={...env};
 for(let i=0;i<3;i++)await refreshSharedScan({...options,env:previousEnv,now:now+i*60000});
 const largerEnv={...env,ASAF_SCANNER_UNIVERSE:'us10000'};
 const before=await readSharedScan({env:largerEnv,run:f.run,memberId:owner,now:now+3*60000});
 assert.equal(before.records.length,30);assert.equal(before.total,10000);assert.equal(before.partial,true);assert.equal(before.progress.complete,false);
 const result=await refreshSharedScan({...options,env:largerEnv,now:now+3*60000});assert.equal(result.total,10000);
 const after=await readSharedScan({env:largerEnv,run:f.run,memberId:owner,now:now+3*60000});
 assert.equal(after.records.length,30);assert.equal(after.progress.processed,10);assert.equal(after.total,10000);
 assert.ok(after.records.some(r=>r.symbol==='STOCK29'));
});
