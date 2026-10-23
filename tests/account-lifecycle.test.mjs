import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {passwordRecord,passwordMatches,currentUser,digest} from '../server/auth-core.mjs';
import activate from '../netlify/functions/activate.mjs';
import workspace from '../netlify/functions/workspace.mjs';
const env={CONTEXT:'production',ASAF_PUBLIC_AUTH_ENABLED:'true',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'mock-only'},origin='https://example.test';
const id='12345678-1234-1234-1234-123456789abc',other='87654321-4321-4321-4321-cba987654321',session='b'.repeat(64),token='c'.repeat(64),email='member@example.test',prefix='asaf:production:';
const req=(path,body,options={})=>new Request(origin+'/.netlify/functions/'+path,{method:body===undefined?'GET':options.method||'POST',headers:{origin:options.origin||origin,cookie:'asaf_session='+(options.session||session),'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(path==='workspace'?{memberId:id,...body}:body)})});
async function fixture(run){const previous={...process.env},original=global.fetch,db=new Map();Object.assign(process.env,env);let available=true,throttle=true,calls=0,beforeSave=null;
 const record={id,version:'v1',enabled:true,...await passwordRecord('old-test-password-only')};
 db.set(prefix+'auth:user:'+digest(email),JSON.stringify(record));db.set(prefix+'auth:member:'+id,JSON.stringify({id,version:'v1',enabled:true}));db.set(prefix+'auth:session:'+digest(session),JSON.stringify({id,version:'v1',expires:Date.now()+600000}));
 global.fetch=async(_url,options)=>{calls++;if(!available)throw Error('offline');const a=JSON.parse(options.body);let result;
 if(a[0]==='GET')result=db.get(a[1])||null;
 else if(a[0]==='EVAL'){
  const n=Number(a[2]),keys=a.slice(3,3+n),values=a.slice(3+n);
  if(a[1].includes('local n=tonumber'))result=throttle?1:0;
  else if(n===4){if(db.get(keys[0])!==values[0]||db.get(keys[1])!==values[1])result=0;else{db.set(keys[1],values[2]);db.set(keys[2],values[3]);db.set(keys[3],values[4]);db.delete(keys[0]);result=1}}
  else if(n===3){beforeSave?.();if(JSON.parse(values[2]).expires<=Date.now()||db.get(keys[1])!==values[2]||db.get(keys[2])!==values[3])result=-1;else{const old=db.get(keys[0]);if(old?JSON.parse(old).revision!==values[0]:values[0]!=='')result=0;else{db.set(keys[0],values[1]);result=1}}}
  else throw Error('Unexpected script');
 }else throw Error('Unexpected operation');return Response.json({result})};
 try{await run({db,record,get calls(){return calls},set beforeSave(value){beforeSave=value},set available(value){available=value},set throttle(value){throttle=value}})}finally{global.fetch=original;process.env=previous}}
function resetInvite(db,version='v1'){db.set(prefix+'auth:reset:'+digest(token),JSON.stringify({emailHash:digest(email),version,expires:Date.now()+600000}))}
test('recovery is single-use, preserves identity and invalidates every old session',async()=>fixture(async({db})=>{
 resetInvite(db);const r=await activate(req('activate',{action:'reset',token,email,password:'new-test-password-only'}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{reset:true,authenticated:true});
 const user=JSON.parse(db.get(prefix+'auth:user:'+digest(email)));assert.equal(user.id,id);assert.notEqual(user.version,'v1');assert.equal(await passwordMatches('new-test-password-only',user),true);
 assert.equal(await currentUser(req('auth')),null);const cookie=r.headers.get('set-cookie').split(';')[0];assert.deepEqual(await currentUser(new Request(origin,{headers:{cookie}})),{id});
 assert.equal((await activate(req('activate',{action:'reset',token,email,password:'another-test-password'}))).status,401);assert.ok(!JSON.stringify([...db]).includes('new-test-password-only'));
}));
test('recovery cannot reactivate revoked members or reuse an older password version',async()=>fixture(async({db,record})=>{
 resetInvite(db,'older-version');const body={action:'reset',token,email,password:'new-test-password-only'};assert.equal((await activate(req('activate',body))).status,401);
 resetInvite(db);db.set(prefix+'auth:user:'+digest(email),JSON.stringify({...record,enabled:false}));assert.equal((await activate(req('activate',body))).status,401);
}));
test('account copies are session-isolated and reject stale writes from another device',async()=>fixture(async({db})=>{
 assert.deepEqual(await (await workspace(req('workspace'))).json(),{revision:'',watch:[],updatedAt:null});
 const saved=await workspace(req('workspace',{revision:'',watch:[{symbol:'aapl',note:'private note',level:200}]},{method:'PUT'}));assert.equal(saved.status,200);const data=await saved.json();assert.equal(data.watch[0].symbol,'AAPL');
 assert.equal((await workspace(req('workspace',{revision:'',watch:[]},{method:'PUT'}))).status,409);
 assert.equal((await workspace(req('workspace',{revision:data.revision,watch:[]},{method:'PUT'}))).status,200);
 db.set(prefix+'auth:member:'+other,JSON.stringify({id:other,version:'v2',enabled:true}));db.set(prefix+'auth:session:'+digest('d'.repeat(64)),JSON.stringify({id:other,version:'v2',expires:Date.now()+600000}));
 assert.deepEqual((await (await workspace(req('workspace',undefined,{session:'d'.repeat(64)}))).json()).watch,[]);
 assert.equal((await workspace(req('workspace',undefined,{session:'e'.repeat(64)}))).status,401);
}));
test('workspace rejects foreign origins, invalid payloads, throttling and storage outages',async()=>fixture(async state=>{
 const count=state.calls;assert.equal((await workspace(req('workspace',{revision:'',watch:[]},{method:'PUT',origin:'https://other.test'}))).status,403);assert.equal(state.calls,count);
 assert.equal((await workspace(req('workspace',{revision:'invalid',watch:[]},{method:'PUT'}))).status,400);
 assert.equal((await workspace(req('workspace',{revision:'',watch:Array(101).fill('AAPL')},{method:'PUT'}))).status,400);
 state.throttle=false;assert.equal((await workspace(req('workspace'))).status,429);state.throttle=true;state.available=false;assert.equal((await workspace(req('workspace'))).status,503);assert.equal(state.db.has(prefix+'workspace:member:'+id),false);
}));
test('expired or revoked sessions cannot read or save account copies',async()=>fixture(async({db})=>{
 db.set(prefix+'auth:session:'+digest(session),JSON.stringify({id,version:'v1',expires:1}));assert.equal((await workspace(req('workspace'))).status,401);
 db.set(prefix+'auth:session:'+digest(session),JSON.stringify({id,version:'v1',expires:Date.now()+600000}));db.set(prefix+'auth:member:'+id,JSON.stringify({id,version:'v2',enabled:false}));assert.equal((await workspace(req('workspace',{revision:'',watch:[]},{method:'PUT'}))).status,401);
}));
test('personal section patches and legacy watch saves preserve each other atomically',async()=>fixture(async({db})=>{
 const trade={id:'t1',symbol:'NVDA',date:'2026-10-23',side:'long',entry:100,exit:110,qty:10,fees:2,setup:'פריצה',quality:'A',note:'private journal'};
 let revision='';const parts={conversations:[{id:'chat1',symbol:'NVDA',title:'private conversation',saved:'2026-10-24T00:00:00Z',messages:[{role:'user',content:'private question'},{role:'assistant',content:'private answer'}]}],journal:[trade],research:[{id:'r1',title:'report',symbol:'NVDA',url:'https://example.com/',note:'private source',saved:'2026-10-23T00:00:00Z'}],chartPreferences:{style:'line',chartMACD:true},drawings:{NVDA:{savedAt:1,lines:[[{date:'2026-10-01',price:100},{date:'2026-10-02',price:105}]]}}};
 for(const [section,data] of Object.entries(parts)){const r=await workspace(req('workspace',{revision,section,data},{method:'PUT'}));assert.equal(r.status,200);revision=(await r.json()).revision}
 const r=await workspace(req('workspace',{revision,watch:['AAPL']},{method:'PUT'}));assert.equal(r.status,200);const saved=await r.json();for(const [section,value] of Object.entries(parts))assert.deepEqual(saved[section],value);assert.equal(saved.watch[0].symbol,'AAPL');
 assert.deepEqual((await (await workspace(req('workspace'))).json()).conversations,parts.conversations);
 const before=db.get(prefix+'workspace:member:'+id);assert.equal((await workspace(req('workspace',{revision,section:'journal',data:[]},{method:'PUT'}))).status,409);assert.equal(db.get(prefix+'workspace:member:'+id),before);
 assert.equal((await workspace(req('workspace',{revision:saved.revision,section:'journal',data:[{...trade,entry:-1}]},{method:'PUT'}))).status,400);assert.equal(db.get(prefix+'workspace:member:'+id),before);
}));
test('a member mismatch cannot upload one account copy to another identity',async()=>fixture(async({db})=>{
 const r=await workspace(req('workspace',{memberId:other,revision:'',section:'journal',data:[]},{method:'PUT'}));assert.equal(r.status,409);assert.equal(db.has(prefix+'workspace:member:'+id),false);assert.equal(db.has(prefix+'workspace:member:'+other),false);
}));
test('deletion or revocation between authentication and commit cannot resurrect private data',async()=>fixture(async state=>{
 state.beforeSave=()=>{state.db.delete(prefix+'auth:member:'+id);state.db.delete(prefix+'workspace:member:'+id)};
 const r=await workspace(req('workspace',{revision:'',section:'journal',data:[]},{method:'PUT'}));assert.equal(r.status,401);assert.equal(state.db.has(prefix+'workspace:member:'+id),false);
}));
test('UTF-8 request caps and unknown personal sections fail before saving',async()=>fixture(async({db})=>{
 assert.equal((await workspace(req('workspace',{revision:'',section:'unknown',data:[]},{method:'PUT'}))).status,400);
 assert.equal((await workspace(req('workspace',{revision:'',section:'journal',data:[],padding:'א'.repeat(400000)},{method:'PUT'}))).status,413);assert.equal(db.has(prefix+'workspace:member:'+id),false);
}));
test('operator CLI fails safely without approval and does not print supplied secrets',()=>{
 const password='never-print-this-password',result=spawnSync(process.execPath,['scripts/manage-member.mjs'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH},input:JSON.stringify({action:'save',email,password,token}),encoding:'utf8'});assert.equal(result.status,1);assert.ok(!(result.stdout+result.stderr).includes(password));assert.ok(!(result.stdout+result.stderr).includes(token));
});
test('activation URLs are cleared; refresh recovery is bounded and tab-scoped',()=>{
 const html=readFileSync(new URL('../activate.html',import.meta.url),'utf8');assert.match(html,/history.replaceState/);assert.match(html,/sessionStorage.setItem/);assert.match(html,/30\*60\*1000/);assert.doesNotMatch(html,/localStorage|console\./);
});
