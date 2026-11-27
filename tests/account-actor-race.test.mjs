import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountHandler} from '../netlify/functions/account.mjs';
import {digest} from '../server/auth-core.mjs';
import {fixture,env,prefix,request,seed} from './identity-fixture.mjs';

// This adapter extends the shared in-memory Redis fixture with the account Lua
// actor precondition. Validate its positions and server-time comparison as well
// so races cannot accidentally pass against the fixture's legacy target-only CAS.
function accountMutation(a,state,now){
 const deleting=a[1].includes('account-self-delete');
 const count=deleting?15:4,ki=deleting?13:2,vi=deleting?6:4;
 assert.equal(Number(a[2]),count);
 const keys=a.slice(3,3+count),args=a.slice(3+count);
 assert.ok(a[1].includes(`if redis.call('GET',KEYS[${ki+1}])~=ARGV[${vi+1}] or redis.call('GET',KEYS[${ki+2}])~=ARGV[${vi+2}] then return -1 end`));
 assert.ok(a[1].includes(`local session=cjson.decode(ARGV[${vi+1}]);local clock=redis.call('TIME');if session.expires<=tonumber(clock[1])*1000+tonumber(clock[2])/1000 then return -1 end`));
 assert.ok(a[1].indexOf('return -1')<a[1].indexOf("redis.call('SET'"));
 if(state.db.get(keys[ki])!==args[vi]||state.db.get(keys[ki+1])!==args[vi+1]||JSON.parse(args[vi]).expires<=now)return -1;
 return state.run(a);
}
for(const action of ['delete','admin-disable','logout-all']){
 for(const race of ['revoked session','disabled actor','expired session','target conflict','none']){
  test(`${action}: ${race} at atomic commit`,async()=>{
   const state=fixture(),actor=seed(state,'owner@example.test');
   const target=action==='admin-disable'?seed(state,'other@example.test','87654321-4321-4321-4321-cba987654321','e'.repeat(64)):actor;
   const sessionKey=prefix+'auth:session:'+digest('d'.repeat(64)),actorMemberKey=prefix+'auth:member:'+actor.record.id;
   const email=action==='admin-disable'?'other@example.test':'owner@example.test';
   const targetUserKey=prefix+'auth:user:'+digest(email),targetMemberKey=prefix+'auth:member:'+target.record.id;
   const workspaceKey=prefix+'workspace:member:'+target.record.id;
   state.db.set(workspaceKey,'private data');
   let mutationCount=0,expectedUser,expectedMember;
   const run=async a=>{
    if(a[0]!=='EVAL'||!/^-- account-(version-change|self-delete)/.test(a[1]))return state.run(a);
    mutationCount++;
    if(race==='revoked session')state.db.delete(sessionKey);
    if(race==='disabled actor')state.db.set(actorMemberKey,JSON.stringify({id:actor.record.id,version:'revoked',enabled:false}));
    if(race==='target conflict')state.db.set(targetUserKey,JSON.stringify({...target.record,version:'concurrent'}));
    expectedUser=state.db.get(targetUserKey);expectedMember=state.db.get(targetMemberKey);
    const now=race==='expired session'?JSON.parse(state.db.get(sessionKey)).expires:Date.now();
    return accountMutation(a,state,now);
   };
   const handler=createAccountHandler({env:{...env,ASAF_ADMIN_MEMBER_IDS:actor.record.id},run});
   const response=await handler(request('account',{action,confirmation:'DELETE',email},actor.cookie));
   assert.equal(mutationCount,1);
   assert.equal(response.status,race==='none'?200:race==='target conflict'?409:401);
   if(race!=='none'){
    assert.equal(state.db.get(targetUserKey),expectedUser,'target account must not be modified');
    assert.equal(state.db.get(targetMemberKey),expectedMember,'target membership must not be modified');
    assert.equal(state.db.get(workspaceKey),'private data','workspace must not be deleted');
   }else if(action==='delete'){
    assert.equal(state.db.has(targetUserKey),false);assert.equal(state.db.has(workspaceKey),false);
   }else{
    assert.notEqual(JSON.parse(state.db.get(targetUserKey)).version,'v1');
    assert.equal(JSON.parse(state.db.get(targetMemberKey)).enabled,action!=='admin-disable');
   }
  });
 }
}
