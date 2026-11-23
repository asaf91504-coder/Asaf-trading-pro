import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetupsHandler} from '../netlify/functions/setups.mjs';
import {MANUAL_COMMIT} from '../server/manual-setups.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';

const example={symbol:'nyse:test',side:'long',atr14:3.125,entry:100,target:118,title:'My first idea',analysis:'Owner view of the pattern',ownAnalysis:true};
function setup(){
 const f=fixture(),owner=seed(f),admin=seed(f,'admin@example.test','22345678-1234-1234-1234-123456789abd','e'.repeat(64)),
 viewer=seed(f,'viewer@example.test','32345678-1234-1234-1234-123456789abe','f'.repeat(64));
 const when=Date.now(),env={...authEnv,ASAF_CHAT_OWNER_MEMBER_ID:owner.record.id,ASAF_SETUPS_REVIEWER_MEMBER_ID:owner.record.id,
  ASAF_ADMIN_MEMBER_IDS:[owner.record.id,admin.record.id].join(',')};
 let failWrite=false;
 const run=async a=>{
  if(a[1]!==MANUAL_COMMIT)return f.run(a);
  const [key,old,next]=a.slice(3);
  if(failWrite||(f.db.get(key)||'')!==old)return 0;
  f.db.set(key,next);return 1;
 };
 const make=(changes={},clock=when)=>createSetupsHandler({env:{...env,...changes},run,now:()=>clock});
 const handler=make();
 return {owner,admin,viewer,env,when,make,handler,failWrite:()=>{failWrite=true}};
}
const req=(user,body)=>request('setups',body,user?.cookie||'');
const create=(idea=example)=>({action:'create-manual-draft',idea});
const decision=(id,revision,value='approved')=>({action:'decide-manual',id,revision,decision:value});

test('creation is locked to the verified owner, not just administrator or reviewer, and requires same origin',async()=>{
 const t=setup();
 for(const [user,expected] of [[null,401],[t.admin,403],[t.viewer,403]])assert.equal((await t.handler(req(user,create()))).status,expected);
 assert.equal((await t.make({ASAF_SETUPS_REVIEWER_MEMBER_ID:t.admin.record.id})(req(t.admin,create()))).status,403);
 assert.equal((await t.make({ASAF_CHAT_OWNER_MEMBER_ID:''})(req(t.owner,create()))).status,403);
 const cross=req(t.owner,create());cross.headers.set('origin','https://not-example.test');
 assert.equal((await t.handler(cross)).status,403);
 assert.equal((await t.handler(req(t.owner,create()))).status,200);
});

test('manual flow works without a scanner, keeps a private draft, versions edits, and explicitly publishes only public fields',async()=>{
 const t=setup(),created=await(await t.handler(req(t.owner,create()))).json();
 const state=await(await t.handler(req(t.owner))).json();
 assert.equal(state.canAuthor,true);assert.deepEqual(state.queue,[]);assert.deepEqual(state.published,[]);
 const [draft]=state.manualQueue;
 assert.equal(draft.symbol,'NYSE:TEST');assert.equal(draft.scenario.stop,93.75);assert.equal(draft.draft.revision,created.revision);
 assert.equal((await t.handler(req(t.viewer))).status,403);
 const edit={action:'edit-manual-draft',id:created.id,revision:created.revision,edits:{title:'A changed title',analysis:'Changed rationale',entry:101,target:118}};
 const modified=await(await t.handler(req(t.owner,edit))).json();
 assert.equal((await t.handler(req(t.owner,decision(created.id,created.revision)))).status,409);
 assert.equal((await t.handler(req(t.owner,decision(created.id,modified.revision)))).status,200);
 const r=await(await t.handler(req(t.viewer))).json();
 assert.equal(r.canAuthor,undefined);assert.equal(r.manualQueue,undefined);assert.equal(r.queue,undefined);
 const [published]=r.published;
 assert.equal(published.source,undefined);assert.equal(published.atr14,undefined);assert.equal(published.draft,undefined);
 assert.equal(published.manual,true);assert.equal(published.title,'A changed title');assert.equal(published.scenario.stop,94.75);
 assert.equal((await t.make({ASAF_TWELVE_PRIVATE_TRIAL:'true'})(req(t.viewer))).status,403);
 assert.equal((await t.make({},t.when+86400001)(req(t.viewer))).status,403);
});

test('manual drafts reject tampered fields and invalid ATR, require authored analysis, and derive a short stop',async()=>{
 const t=setup();
 for(const misfit of [{ownAnalysis:false},{stop:99},{source:'Twelve Data'},{symbol:'<br>'},{atr14:-1},{entry:'100'},{atr14:60},{target:90},{analysis:''},{analysis:'b\u202e'},{title:'two\nlines'}])
  assert.equal((await t.handler(req(t.owner,create({...example,...misfit})))).status,400,JSON.stringify(misfit));
 assert.equal((await t.handler(req(t.owner,{...create(),decision:'approved'}))).status,400);
 const out=await t.handler(req(t.owner,create({...example,side:'short',target:80})));
 assert.equal(out.status,200);
 const state=await(await t.handler(req(t.owner))).json();
 assert.equal(state.manualQueue[0].scenario.stop,106.25);
});

test('a stale write fails rather than clobbering manual drafts',async()=>{
 const t=setup();t.failWrite();
 assert.equal((await t.handler(req(t.owner,create()))).status,409);
 assert.deepEqual((await(await t.handler(req(t.owner))).json()).manualQueue,[]);
});
