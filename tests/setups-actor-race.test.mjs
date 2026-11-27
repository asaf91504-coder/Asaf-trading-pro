import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetupsHandler} from '../netlify/functions/setups.mjs';
import {sharedScannerKey,SCAN_PERIOD_MS} from '../server/shared-scanner.mjs';
import {writeManualSetup} from '../server/manual-setups.mjs';
import {decideSetup} from '../server/setup-review.mjs';
import {digest} from '../server/auth-core.mjs';
import {fixture,seed,env as authEnv,prefix,request} from './identity-fixture.mjs';

const idea={symbol:'AAPL',side:'long',atr14:3,entry:100,target:118,title:'Owner idea',analysis:'Owner analysis',ownAnalysis:true};
function setup(){
 const f=fixture(),owner=seed(f),now=Date.now();
 const env={...authEnv,ASAF_ADMIN_MEMBER_IDS:owner.record.id,ASAF_CHAT_OWNER_MEMBER_ID:owner.record.id,ASAF_SETUPS_REVIEWER_MEMBER_ID:owner.record.id,ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL',TWELVE_DATA_API_KEY:'mock'};
 const sessionKey=prefix+'auth:session:'+digest('d'.repeat(64)),memberKey=prefix+'auth:member:'+owner.record.id,key=sharedScannerKey(env);
 const bars=Array.from({length:15},(_,i)=>({date:new Date(Date.UTC(2026,10,i+2)).toISOString().slice(0,10),high:112,low:105,close:108}));
 const snapshot={startedAt:new Date(now-60000).toISOString(),completedAt:new Date(now).toISOString(),nextUpdateAt:now+SCAN_PERIOD_MS,errors:[],records:[{symbol:'AAPL',source:'Twelve Data',receivedAt:new Date(now).toISOString(),summary:{date:'2026-11-16'},bars,interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,research:{candidates:[{kind:'breakout',label:'Breakout',stage:'confirmed',scenario:{side:'long',entry:110,stop:100,target:130}}]}}]};
 f.db.set(key+':snapshot',JSON.stringify(snapshot));
 let race='none',calls=0,expectedBook,bookKey;
 const run=async a=>{
  if(a[0]!=='EVAL'||!/^-- (manual-setup|setup-review)-cas/.test(a[1]))return f.run(a);
  calls++;
  const manual=a[1].includes('manual-setup-cas'),count=manual?3:4,ki=manual?1:2,vi=manual?2:3;
  assert.equal(Number(a[2]),count);
  const keys=a.slice(3,3+count),args=a.slice(3+count);
  assert.equal(keys[ki],sessionKey);assert.equal(keys[ki+1],memberKey);
  assert.ok(a[1].includes(`if redis.call('GET',KEYS[${ki+1}])~=ARGV[${vi+1}] or redis.call('GET',KEYS[${ki+2}])~=ARGV[${vi+2}] then return -1 end`));
  assert.ok(a[1].includes(`local session=cjson.decode(ARGV[${vi+1}]);local clock=redis.call('TIME');if session.expires<=tonumber(clock[1])*1000+tonumber(clock[2])/1000 then return -1 end`));
  bookKey=keys[manual?0:1];
  if(race==='revoked session')f.db.delete(sessionKey);
  if(race==='disabled actor')f.db.set(memberKey,JSON.stringify({id:owner.record.id,version:'v2',enabled:false}));
  if(race==='target conflict')f.db.set(bookKey,JSON.stringify({concurrent:true}));
  expectedBook=f.db.get(bookKey);
  const clock=race==='expired session'?JSON.parse(args[vi]).expires:Date.now();
  if(f.db.get(keys[ki])!==args[vi]||f.db.get(keys[ki+1])!==args[vi+1]||JSON.parse(args[vi]).expires<=clock)return -1;
  if(manual){if((f.db.get(keys[0])||'')!==args[0])return 0;f.db.set(keys[0],args[1]);return 1}
  if((f.db.get(keys[0])||'')!==args[0]||(f.db.get(keys[1])||'')!==args[1])return 0;
  f.db.set(keys[1],args[2]);return 1;
 };
 const handler=createSetupsHandler({env,run,now:()=>now});
 return {f,owner,env,handler,setRace:value=>{race=value;calls=0},get calls(){return calls},get bookKey(){return bookKey},get expectedBook(){return expectedBook}};
}
for(const operation of ['manual create','manual edit','manual approve','manual reject','review edit','review approve','review reject']){
 for(const race of ['revoked session','disabled actor','expired session','target conflict','none']){
  test(`${operation}: ${race} at commit`,async()=>{
   const t=setup();let body;
   if(operation==='manual create')body={action:'create-manual-draft',idea};
   else if(operation.startsWith('manual')){
    const created=await t.handler(request('setups',{action:'create-manual-draft',idea},t.owner.cookie));assert.equal(created.status,200);
    const {id,revision}=await created.json();
    body=operation==='manual edit'?{action:'edit-manual-draft',id,revision,edits:{entry:101,target:118,title:'Edited',analysis:'Edited analysis'}}:{action:'decide-manual',id,revision,decision:operation.endsWith('approve')?'approved':'rejected'};
   }else{
    const response=await t.handler(request('setups',null,t.owner.cookie));assert.equal(response.status,200);
    const [candidate]=(await response.json()).queue;
    body=operation==='review edit'?{action:'save-draft',id:candidate.id,edits:{...candidate.scenario,title:'Edited',analysis:'Edited analysis'}}:{id:candidate.id,decision:operation.endsWith('approve')?'approved':'rejected'};
    if(body.edits)delete body.edits.side;
   }
   t.setRace(race);
   const response=await t.handler(request('setups',body,t.owner.cookie));
   assert.equal(t.calls,1);
   assert.equal(response.status,race==='none'?200:race==='target conflict'?409:401);
   if(race!=='none')assert.equal(t.f.db.get(t.bookKey),t.expectedBook,'no draft/publication changes after failed authorization/CAS');
  });
 }
}
test('direct mutation helpers fail closed without an authenticated actor snapshot',async()=>{
 const t=setup(),options={user:{id:t.owner.record.id},env:t.env,run:t.f.run,now:Date.now()};
 await assert.rejects(writeManualSetup({action:'create-manual-draft',idea},options),e=>e.status===401);
 await assert.rejects(decideSetup({candidates:[{id:'x',atr14:3,scenario:{side:'long',entry:100,stop:94,target:118}}],book:{},scan:{stale:false}}, {...options,id:'x',decision:'approved'}),e=>e.status===401);
});
