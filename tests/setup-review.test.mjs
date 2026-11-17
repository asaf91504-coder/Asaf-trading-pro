import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetupsHandler} from '../netlify/functions/setups.mjs';
import {sharedScannerKey,SCAN_PERIOD_MS} from '../server/shared-scanner.mjs';
import {REVIEW_COMMIT} from '../server/setup-review.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
function setup(){const f=fixture(),owner=seed(f),other=seed(f,'other@test.test','87654321-4321-4321-4321-cba987654321','e'.repeat(64));const now=Date.now();
 const env={...authEnv,ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL',TWELVE_DATA_API_KEY:'mock',ASAF_SETUPS_REVIEWER_MEMBER_ID:owner.record.id};
 const snapshot={startedAt:new Date(now-60000).toISOString(),completedAt:new Date(now).toISOString(),nextUpdateAt:now+SCAN_PERIOD_MS,errors:[],records:[{symbol:'AAPL',source:'Twelve Data',receivedAt:new Date(now).toISOString(),summary:{date:'2026-11-16'},research:{candidates:[{kind:'breakout',label:'פריצה',stage:'confirmed',scenario:{side:'long',entry:110,stop:100,target:130}}]}}]};
 const key=sharedScannerKey(env);f.db.set(key+':snapshot',JSON.stringify(snapshot));
 const run=async a=>{if(a[1]!==REVIEW_COMMIT)return f.run(a);const [snapshotKey,bookKey,oldSnapshot,oldBook,next]=a.slice(3);if(f.db.get(snapshotKey)!==oldSnapshot||(f.db.get(bookKey)||'')!==oldBook)return 0;f.db.set(bookKey,next);return 1};
 const handler=createSetupsHandler({env,run,now:()=>now});return {f,owner,other,env,key,run,handler,now,snapshot};}
test('only the designated reviewer sees pending candidates and can publish trusted server data',async()=>{
 const {handler,owner,other}=setup();
 assert.equal((await handler(request('setups'))).status,401);
 let body=await(await handler(request('setups',null,other.cookie))).json();assert.equal(body.queue,undefined);assert.deepEqual(body.published,[]);
 body=await(await handler(request('setups',null,owner.cookie))).json();assert.equal(body.queue[0].status,'pending');const id=body.queue[0].id;
 assert.equal((await handler(request('setups',{id,decision:'approved'},other.cookie))).status,403);
 assert.equal((await handler(request('setups',{id,decision:'approved',scenario:{entry:1}},owner.cookie))).status,200);
 body=await(await handler(request('setups',null,other.cookie))).json();assert.equal(body.published.length,1);assert.equal(body.published[0].scenario.entry,110);assert.equal(body.queue,undefined);
 assert.equal((await handler(request('setups',{id,decision:'rejected'},owner.cookie))).status,200);
 assert.deepEqual((await(await handler(request('setups',null,other.cookie))).json()).published,[]);
});
test('new scans never inherit approval; previous approved entries retain their original timestamp',async()=>{
 const x=setup();const original=await(await x.handler(request('setups',null,x.owner.cookie))).json();
 await x.handler(request('setups',{id:original.queue[0].id,decision:'approved'},x.owner.cookie));
 x.snapshot.startedAt=new Date(x.now+60000).toISOString();x.snapshot.completedAt=new Date(x.now+120000).toISOString();x.f.db.set(x.key+':snapshot',JSON.stringify(x.snapshot));
 const h=createSetupsHandler({env:x.env,run:x.run,now:()=>x.now+180000});const result=await(await h(request('setups',null,x.owner.cookie))).json();assert.equal(result.queue[0].status,'pending');assert.equal(result.published.length,1);assert.equal(result.published[0].scanAt,original.completedAt);
 assert.equal((await h(request('setups',{id:original.queue[0].id,decision:'approved'},x.owner.cookie))).status,409);
});
test('CSRF, absent reviewer configuration, expired scans and compare-and-swap conflicts fail closed',async()=>{
 const x=setup(),body=await(await x.handler(request('setups',null,x.owner.cookie))).json(),id=body.queue[0].id;
 const req=request('setups',{id,decision:'approved'},x.owner.cookie);req.headers.set('origin','https://evil.test');assert.equal((await x.handler(req)).status,403);
 const h=createSetupsHandler({env:{...x.env,ASAF_SETUPS_REVIEWER_MEMBER_ID:''},run:x.run,now:()=>x.now});assert.equal((await h(request('setups',{id,decision:'approved'},x.owner.cookie))).status,403);
 const stale=createSetupsHandler({env:x.env,run:x.run,now:()=>x.now+SCAN_PERIOD_MS});assert.equal((await stale(request('setups',{id,decision:'approved'},x.owner.cookie))).status,409);
 const conflict=createSetupsHandler({env:x.env,run:async a=>a[1]===REVIEW_COMMIT?0:x.run(a),now:()=>x.now});assert.equal((await conflict(request('setups',{id,decision:'approved'},x.owner.cookie))).status,409);
 assert.equal((await x.handler(request('setups',{id,decision:'anything'},x.owner.cookie))).status,400);
});
test('personal trial never exposes setups to other customers even if approved',async()=>{
 const x=setup(),env={...x.env,ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:x.owner.record.id,ASAF_TWELVE_TRIAL_ENDS_AT:new Date(x.now+86400000).toISOString()};
 x.f.db.set(sharedScannerKey(env)+':snapshot',JSON.stringify(x.snapshot));const h=createSetupsHandler({env,run:x.run,now:()=>x.now});const body=await(await h(request('setups',null,x.owner.cookie))).json();
 assert.equal((await h(request('setups',{id:body.queue[0].id,decision:'approved'},x.owner.cookie))).status,200);
 assert.equal((await h(request('setups',null,x.other.cookie))).status,403);
});
