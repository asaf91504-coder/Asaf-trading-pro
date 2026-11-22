import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetupsHandler} from '../netlify/functions/setups.mjs';
import {sharedScannerKey,SCAN_PERIOD_MS} from '../server/shared-scanner.mjs';
import {REVIEW_COMMIT} from '../server/setup-review.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
const dailyBars=Array.from({length:15},(_,i)=>({date:new Date(Date.UTC(2026,10,i+2)).toISOString().slice(0,10),high:112,low:105,close:108}));
function setup(){const f=fixture(),owner=seed(f),other=seed(f,'other@test.test','87654321-4321-4321-4321-cba987654321','e'.repeat(64));const now=Date.now();
 const env={...authEnv,ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL',TWELVE_DATA_API_KEY:'mock',ASAF_SETUPS_REVIEWER_MEMBER_ID:owner.record.id};
 const snapshot={startedAt:new Date(now-60000).toISOString(),completedAt:new Date(now).toISOString(),nextUpdateAt:now+SCAN_PERIOD_MS,errors:[],records:[{symbol:'AAPL',source:'Twelve Data',receivedAt:new Date(now).toISOString(),summary:{date:'2026-11-16'},bars:dailyBars,interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,research:{candidates:[{kind:'breakout',label:'פריצה',stage:'confirmed',scenario:{side:'long',entry:110,stop:100,target:130}}]}}]};
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

const edits={title:'כותרת אישית',analysis:'<img src=x onerror=alert(1)>\nהתרחיש עדיין להמחשה.',entry:112,stop:98,target:141};
const get=async(x,user=x.owner)=>await(await x.handler(request('setups',null,user.cookie))).json();
const save=async(x,id,changes=edits,revision=null,user=x.owner)=>x.handler(request('setups',{id,action:'save-draft',edits:changes,revision},user.cookie));
test('a curated draft is visible only to the owner and approval publishes the selected values with original provenance',async()=>{
 const x=setup(),[original]=(await get(x)).queue,{id}=original;
 assert.equal((await save(x,id,edits,null,x.other)).status,403);
 const response=await save(x,id);assert.equal(response.status,200);
 const {revision}=await response.json();assert.match(revision,/^[a-f0-9-]{36}$/);
 const pending=await get(x);assert.equal(pending.queue[0].status,'pending');assert.equal(pending.queue[0].draft.analysis,edits.analysis);
 assert.deepEqual(pending.queue[0].scenario,original.scenario);
 const guest=await get(x,x.other);assert.equal(guest.queue,undefined);assert.deepEqual(guest.published,[]);
 const publish=await x.handler(request('setups',{id,decision:'approved',revision},x.owner.cookie));assert.equal(publish.status,200);
 const result=await get(x,x.other),published=result.published[0];
 assert.deepEqual(published,{...Object.fromEntries(Object.entries(original).filter(([key])=>!['status','atr14'].includes(key))),scenario:{side:'long',entry:112,stop:98,target:141},
  approvedAt:new Date(x.now).toISOString(),title:edits.title,analysis:edits.analysis,edited:true});
 assert.equal(published.draft,undefined);assert.equal(published.original,undefined);assert.equal(published.reviewer,undefined);
 const internal=JSON.parse(x.f.db.get(x.key+':reviews'))[id];
 assert.deepEqual(internal.original.scenario,original.scenario);
 assert.deepEqual((await get(x)).queue[0].originalScenario,original.scenario);
 assert.equal((await save(x,id,{...edits,entry:113,stop:99},revision)).status,409);
 assert.deepEqual((await get(x,x.other)).published,result.published);
});
test('drafts and stale owner tabs cannot accidentally publish or overwrite a different revision',async()=>{
 const x=setup(),{id}=(await get(x)).queue[0];
 const revision=(await(await save(x,id)).json()).revision;
 assert.equal((await save(x,id,{...edits,entry:113})).status,409);
 const next=(await(await save(x,id,{...edits,entry:113,stop:99},revision)).json()).revision;
 assert.notEqual(next,revision);
 assert.equal((await x.handler(request('setups',{id,decision:'approved',revision},x.owner.cookie))).status,409);
 assert.equal((await x.handler(request('setups',{id,decision:'approved'},x.owner.cookie))).status,409);
 assert.equal((await x.handler(request('setups',{id,decision:'approved',revision:next,edits},x.owner.cookie))).status,400);
 assert.equal((await x.handler(request('setups',{id,action:'save-draft',decision:'approved',revision:next,edits},x.owner.cookie))).status,400);
 assert.deepEqual((await get(x,x.other)).published,[]);
 const conflicted=createSetupsHandler({env:x.env,run:async a=>a[1]===REVIEW_COMMIT?0:x.run(a),now:()=>x.now});
 assert.equal((await conflicted(request('setups',{id,action:'save-draft',revision:next,edits},x.owner.cookie))).status,409);
 assert.equal((await get(x)).queue[0].draft.entry,113);
});
test('long and short draft levels are strictly ordered and provenance fields cannot be changed',async()=>{
 const x=setup();
 x.snapshot.records[0].research.candidates.push({kind:'below',label:'שבירה',stage:'crossed',scenario:{side:'short',entry:100,stop:110,target:89}});
 x.f.db.set(x.key+':snapshot',JSON.stringify(x.snapshot));
 const [long,short]=(await get(x)).queue;
 for(const change of [{entry:100,stop:101},{entry:141},{stop:0},{target:Infinity},{entry:'112'}, {side:'short'}, {source:'other'}, {symbol:'MSFT'}, {title:'a\nb'}, {title:'א'.repeat(81)}, {analysis:'測'.repeat(401)}, {analysis:'note\u202E'}]){
  assert.equal((await save(x,long.id,{...edits,...change})).status,400,JSON.stringify(change));
 }
 assert.equal((await save(x,short.id,edits)).status,400);
 const shortEdits={title:'Short sample',analysis:'Research only',entry:98.05001,stop:98.05001+14,target:89};
 assert.equal((await save(x,short.id,shortEdits)).status,200);
 const state=await get(x);assert.equal(state.queue[1].scenario.side,'short');assert.equal(state.queue[1].draft.entry,98.05001);
});
test('even a valid draft cannot outlive its scan or appear to a regular viewer after a scan roll',async()=>{
 const x=setup(),old=(await get(x)).queue[0],revision=(await(await save(x,old.id)).json()).revision;
 const stale=createSetupsHandler({env:x.env,run:x.run,now:()=>x.now+SCAN_PERIOD_MS});
 assert.equal((await stale(request('setups',{id:old.id,action:'save-draft',edits,revision},x.owner.cookie))).status,409);
 x.snapshot.startedAt=new Date(x.now+100).toISOString();x.snapshot.completedAt=new Date(x.now+200).toISOString();
 x.f.db.set(x.key+':snapshot',JSON.stringify(x.snapshot));
 x.handler=createSetupsHandler({env:x.env,run:x.run,now:()=>x.now+300});
 const next=(await get(x)).queue[0];assert.notEqual(next.id,old.id);assert.equal(next.draft,undefined);
 assert.equal((await x.handler(request('setups',{id:old.id,decision:'approved',revision},x.owner.cookie))).status,409);
 assert.deepEqual((await get(x,x.other)).published,[]);
});
test('public projection strips internal draft and reviewer fields even if present in the stored item',async()=>{
 const x=setup(),[item]=(await get(x)).queue;
 x.f.db.set(x.key+':reviews',JSON.stringify({[item.id]:{status:'approved',at:x.snapshot.completedAt,item:{...item,draft:edits,reviewer:'private',originalScenario:{private:true},scenario:{...item.scenario,secret:'private'}}}}));
 const published=(await get(x,x.other)).published[0];
 assert.equal(published.draft,undefined);assert.equal(published.reviewer,undefined);assert.equal(published.originalScenario,undefined);
 assert.equal(published.scenario.secret,undefined);
});

test('review enforces exactly 2 ATR against edited entry and never changes an already approved price',async()=>{
 const x=setup(),{id}=(await get(x)).queue[0];
 for(const stop of [105,98.01,97.99]){
  const response=await save(x,id,{...edits,stop});
  assert.equal(response.status,400);
  assert.match((await response.json()).error,/ATR/);
 }
 const atTwo=await save(x,id,{...edits,stop:98});
 assert.equal(atTwo.status,200);
 const {revision}=await atTwo.json();
 assert.equal((await x.handler(request('setups',{id,decision:'approved',revision},x.owner.cookie))).status,200);
 x.snapshot.startedAt=new Date(x.now+1).toISOString();
 x.snapshot.records[0].bars=dailyBars.map(b=>({...b,high:120}));
 x.f.db.set(x.key+':snapshot',JSON.stringify(x.snapshot));
 assert.equal((await get(x,x.other)).published[0].scenario.stop,98);
});
