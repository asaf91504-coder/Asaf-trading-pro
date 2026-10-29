import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMobileSessionHandler} from '../server/mobile-session.mjs';
import {digest,currentUser} from '../server/auth-core.mjs';
import {env as identityEnv,origin,prefix,request,seed} from './identity-fixture.mjs';

const verifier='A'.repeat(43),otherVerifier='B'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url');
function setup(overrides={}){
 const db=new Map(),ttls=new Map(),calls=[];let time=Date.now(),online=true,next=1,beforeApprove=null,beforeRedeem=null;
 const get=key=>{if(ttls.has(key)&&ttls.get(key)<=time){db.delete(key);ttls.delete(key)}return db.get(key)||null};
 const run=async a=>{
  calls.push(a);if(!online)throw Error('offline');
  if(a[0]==='GET')return get(a[1]);
  if(a[0]==='SET'){if(a.includes('NX')&&get(a[1]))return null;db.set(a[1],a[2]);const pos=a.indexOf('EX');if(pos>=0)ttls.set(a[1],time+Number(a[pos+1])*1000);return 'OK'}
  if(a[0]!=='EVAL')throw Error('Unknown command');
  const n=Number(a[2]),keys=a.slice(3,3+n),values=a.slice(3+n);
  if(a[1].includes('mobile-session-rate')){
   if(keys.some((key,i)=>Number(get(key)||0)>=Number(values[i])))return 0;
   for(let i=0;i<keys.length;i++){db.set(keys[i],String(Number(get(keys[i])||0)+1));ttls.set(keys[i],time+Number(values[n+i])*1000)}return 1;
  }
  if(a[1].includes('mobile-session-approve')){
   if(beforeApprove)beforeApprove();
   if(get(keys[0])!==values[0]||get(keys[1])!==values[1]||get(keys[2])!==values[2])return 0;
   db.set(keys[0],values[3]);ttls.set(keys[0],time+Number(values[4])*1000);return 1;
  }
  if(a[1].includes('mobile-session-redeem')){
   if(beforeRedeem)beforeRedeem();
   if(get(keys[0])!==values[0]||get(keys[1])!==values[1])return 0;
   if(get(keys[2]))return -1;
   db.set(keys[2],values[2]);ttls.set(keys[2],time+3600000);db.delete(keys[0]);ttls.delete(keys[0]);return 1;
  }
  throw Error('Unknown Lua');
 };
 const config={...identityEnv,ASAF_NATIVE_APP_ENABLED:'true',...overrides},state={db,run},handler=createMobileSessionHandler({env:config,run,now:()=>time,random:()=>String(next++).padStart(64,'0')});
 return {handler,config,state,db,calls,ttls,advance:ms=>{time+=ms},set online(value){online=value},set beforeApprove(fn){beforeApprove=fn},set beforeRedeem(fn){beforeRedeem=fn},async begin(){const response=await handler(request('mobile-session',{action:'begin',challenge}));assert.equal(response.status,200);return response.json()},approve:(id,cookie)=>handler(request('mobile-session',{action:'approve',requestId:id,confirmation:'CONNECT'},cookie)),redeem:(id,v=verifier)=>handler(request('mobile-session',{action:'redeem',requestId:id,verifier:v}))};
}
test('mobile session handoff is disabled by default and does not access storage',async()=>{
 const s=setup({ASAF_NATIVE_APP_ENABLED:undefined});assert.deepEqual(await(await s.handler(request('mobile-session'))).json(),{enabled:false});assert.equal((await s.handler(request('mobile-session',{action:'begin',challenge}))).status,503);assert.equal(s.calls.length,0);
 const noAuth=setup({ASAF_PUBLIC_AUTH_ENABLED:'false'});assert.deepEqual(await(await noAuth.handler(request('mobile-session'))).json(),{enabled:false});assert.equal(noAuth.calls.length,0);
});
test('origin, content-type, malformed body and unknown redirect fields fail before storage',async()=>{
 const s=setup();
 const foreign=new Request(origin+'/.netlify/functions/mobile-session',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({action:'begin',challenge})});assert.equal((await s.handler(foreign)).status,403);
 const plain=new Request(origin+'/.netlify/functions/mobile-session',{method:'POST',headers:{origin,'content-type':'text/plain'},body:'{}'});assert.equal((await s.handler(plain)).status,415);
 for(const body of [{action:'begin',challenge:'x'.repeat(42)},{action:'begin',challenge,redirect:'https://evil.test'},[],{action:{}},{action:'approve',requestId:'a'.repeat(64),confirmation:'YES'}])assert.equal((await s.handler(request('mobile-session',body))).status,400);
 const large=new Request(origin+'/.netlify/functions/mobile-session',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'begin',challenge,padding:'א'.repeat(2100)})});assert.equal((await s.handler(large)).status,413);assert.equal(s.calls.length,0);
});
test('begin stores a hashed request key with five-minute lifetime and no verifier or cookies',async()=>{
 const s=setup(),b=await s.begin();assert.match(b.requestId,/^[a-f0-9]{64}$/);assert.equal(b.approvalPath,'/mobile-connect.html?request='+b.requestId);assert.equal(b.expiresIn,300);
 const key=prefix+'auth:mobile-request:'+digest(b.requestId),record=JSON.parse(s.db.get(key));assert.equal(record.challenge,challenge);assert.equal(record.status,'pending');assert.ok(![...s.db.keys()].includes(prefix+'auth:mobile-request:'+b.requestId));assert.ok(!JSON.stringify([...s.db]).includes(verifier));
 assert.equal((await s.redeem(b.requestId,otherVerifier)).status,401);assert.equal((await s.redeem(b.requestId)).status,202);assert.ok(s.db.has(key));
});
test('explicit browser approval plus correct verifier creates exactly one secure native session',async()=>{
 const s=setup(),user=seed(s.state),b=await s.begin();assert.equal((await s.approve(b.requestId,'')).status,401);
 const approved=await s.approve(b.requestId,user.cookie);assert.equal(approved.status,200);assert.deepEqual(await approved.json(),{status:'approved'});assert.equal(approved.headers.get('set-cookie'),null);
 const status=await s.handler(request('mobile-session',{action:'status',requestId:b.requestId,verifier}));assert.deepEqual(await status.json(),{status:'approved'});assert.equal(status.headers.get('set-cookie'),null);
 assert.equal((await s.redeem(b.requestId,otherVerifier)).status,401);
 const results=await Promise.all([s.redeem(b.requestId),s.redeem(b.requestId)]);assert.equal(results.filter(r=>r.status===200).length,1);const success=results.find(r=>r.status===200);assert.deepEqual(await success.json(),{authenticated:true});assert.match(success.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict; Max-Age=3600/);
 const cookie=success.headers.get('set-cookie').split(';')[0];assert.equal((await currentUser(request('auth',undefined,cookie),{env:s.config,run:s.state.run})).id,user.record.id);assert.equal((await s.redeem(b.requestId)).status,401);assert.equal([...s.db.keys()].filter(key=>key.includes('auth:session:')).length,2);
});
test('approval cannot be reassigned and member revocation or expiry prevents redeem',async()=>{
 const s=setup(),user=seed(s.state),second=seed(s.state,'other@example.test','22345678-1234-1234-1234-123456789abc','e'.repeat(64)),b=await s.begin();assert.equal((await s.approve(b.requestId,user.cookie)).status,200);assert.equal((await s.approve(b.requestId,second.cookie)).status,409);
 s.db.set(prefix+'auth:member:'+user.record.id,JSON.stringify({id:user.record.id,version:'v2',enabled:true}));assert.equal((await s.redeem(b.requestId)).status,403);
 const x=setup(),u=seed(x.state),c=await x.begin();await x.approve(c.requestId,u.cookie);x.advance(300001);assert.equal((await x.redeem(c.requestId)).status,401);
});
test('atomic approval and redemption fail if browser session or member changes after reads',async()=>{
 const s=setup(),user=seed(s.state),b=await s.begin();s.beforeApprove=()=>s.db.delete(prefix+'auth:session:'+digest(user.cookie.slice(13)));assert.equal((await s.approve(b.requestId,user.cookie)).status,409);
 const x=setup(),u=seed(x.state),c=await x.begin();await x.approve(c.requestId,u.cookie);x.beforeRedeem=()=>x.db.set(prefix+'auth:member:'+u.record.id,JSON.stringify({id:u.record.id,version:'v2',enabled:true}));assert.equal((await x.redeem(c.requestId)).status,409);assert.equal([...x.db.keys()].filter(key=>key.includes('auth:session:')).length,1);
});
test('begin and per-request polling are bounded; storage outages never mint sessions',async()=>{
 const s=setup();for(let i=0;i<30;i++)await s.begin();assert.equal((await s.handler(request('mobile-session',{action:'begin',challenge}))).status,429);
 const x=setup(),b=await x.begin();for(let i=0;i<60;i++)assert.equal((await x.redeem(b.requestId)).status,202);assert.equal((await x.redeem(b.requestId)).status,429);
 const y=setup();y.online=false;const response=await y.handler(request('mobile-session',{action:'begin',challenge}));assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);assert.equal(y.db.size,0);
});
