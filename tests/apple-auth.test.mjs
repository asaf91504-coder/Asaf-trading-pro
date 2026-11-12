import {generateKeyPairSync} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppleHandler} from '../server/apple-auth.mjs';
import {currentUser,digest} from '../server/auth-core.mjs';
import {fixture,env,origin,prefix,request,seed} from './identity-fixture.mjs';
const appleEnv={...env,ASAF_APPLE_AUTH_ENABLED:'true',ASAF_APPLE_SIGNUP_ENABLED:'true',APPLE_CLIENT_ID:'com.example.web',APPLE_TEAM_ID:'AAAAAAAAAA',APPLE_KEY_ID:'BBBBBBBBBB',APPLE_REDIRECT_URI:origin+'/subscription.html',APPLE_PRIVATE_KEY:generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({type:'pkcs8',format:'pem'})};
function setup(overrides={}){const state=fixture(),config={...appleEnv,...overrides};let claims;const handler=createAppleHandler({env:config,run:state.run,verify:async()=>claims});return {state,config,handler,set claims(v){claims=v},async begin(){const r=await handler(request('apple-auth',{action:'begin'}));const b=await r.json();claims={iss:'https://appleid.apple.com',aud:config.APPLE_CLIENT_ID,exp:Date.now()/1000+300,nonce:b.nonce,sub:'12345678901234567890',email:'member@example.test',email_verified:true};return {...b,cookie:r.headers.get('set-cookie').split(';')[0]}}}}
test('Apple stays off without configuration and rejects foreign origins before storage',async()=>{
 const s=setup({ASAF_APPLE_AUTH_ENABLED:'false'});assert.deepEqual(await (await s.handler(request('apple-auth'))).json(),{enabled:false,signupEnabled:false});assert.equal((await s.handler(request('apple-auth',{action:'begin'}))).status,503);assert.equal(s.state.db.size,0);
 const active=setup();assert.equal((await active.handler(new Request(origin+'/.netlify/functions/apple-auth',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:'{"action":"begin"}'}))).status,403);assert.equal(active.state.db.size,0);
});
test('Apple signup makes a stable account and a secure session; one-use nonce cannot replay',async()=>{
 const s=setup(),b=await s.begin(),body={action:'signin',code:'mock-token',nonce:b.nonce,state:b.nonce};const r=await s.handler(request('apple-auth',body,b.cookie));assert.equal(r.status,201);assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);const cookie=r.headers.get('set-cookie').split(';')[0];const user=await currentUser(request('auth',undefined,cookie),{env:s.config,run:s.state.run});assert.ok(user?.id);assert.equal((await s.handler(request('apple-auth',body,b.cookie))).status,401);const saved=JSON.parse(s.state.db.get(prefix+'auth:user:'+digest('member@example.test')));assert.equal(saved.id,user.id);assert.ok(saved.appleSubject);assert.equal(JSON.stringify([...s.state.db]).includes('mock-token'),false);
 const again=await s.begin();assert.equal((await s.handler(request('apple-auth',{...body,nonce:again.nonce,state:again.nonce},again.cookie))).status,200);
});
test('Apple validates audience, issuer, expiry, nonce, subject and verified email',async()=>{
 for(const invalid of [{aud:'other'},{iss:'https://evil.test'},{exp:1},{nonce:'0'.repeat(64)},{sub:'invalid space'},{email_verified:false}]){const s=setup(),b=await s.begin();s.claims={iss:'https://appleid.apple.com',aud:appleEnv.APPLE_CLIENT_ID,exp:Date.now()/1000+300,nonce:b.nonce,sub:'123',email:'member@example.test',email_verified:true,...invalid};assert.equal((await s.handler(request('apple-auth',{action:'signin',code:'mock',nonce:b.nonce,state:b.nonce},b.cookie))).status,401);assert.ok(![...s.state.db.keys()].some(k=>k.includes('auth:member:')))}
});
test('a nonce cannot be used in a different browser and simultaneous consumes create only one session',async()=>{
 const s=setup(),b=await s.begin(),body={action:'signin',code:'mock',nonce:b.nonce,state:b.nonce};assert.equal((await s.handler(request('apple-auth',body,'asaf_apple_binding='+'a'.repeat(64)))).status,401);const results=await Promise.all([s.handler(request('apple-auth',body,b.cookie)),s.handler(request('apple-auth',body,b.cookie))]);assert.equal(results.filter(r=>r.status===201).length,1);assert.equal([...s.state.db.keys()].filter(k=>k.includes('auth:session:')).length,1);
});
test('same email cannot take over an existing password account; explicit authenticated linking preserves its ID',async()=>{
 const s=setup(),existing=seed(s.state),b=await s.begin(),body={action:'signin',code:'mock',nonce:b.nonce,state:b.nonce};assert.equal((await s.handler(request('apple-auth',body,b.cookie))).status,409);const linked=await s.handler(request('apple-auth',body,b.cookie+'; '+existing.cookie));assert.equal(linked.status,200);const saved=JSON.parse(s.state.db.get(prefix+'auth:user:'+digest('member@example.test')));assert.equal(saved.id,existing.record.id);assert.equal(saved.hash,existing.record.hash);assert.equal(saved.version,'v1');
});
test('Apple does not bypass revocation, closed signup, registration caps, throttles or storage failures',async()=>{
 const closed=setup({ASAF_APPLE_SIGNUP_ENABLED:'false'}),b=await closed.begin();assert.equal((await closed.handler(request('apple-auth',{action:'signin',code:'mock',nonce:b.nonce,state:b.nonce},b.cookie))).status,403);
 const capped=setup({ASAF_ACCOUNT_MAX_MEMBERS:'1'});capped.state.sets.set(prefix+'auth:members',new Set(['existing']));const c=await capped.begin();assert.equal((await capped.handler(request('apple-auth',{action:'signin',code:'mock',nonce:c.nonce,state:c.nonce},c.cookie))).status,403);
 const revoked=setup(),u=seed(revoked.state),d=await revoked.begin();revoked.state.db.set(prefix+'auth:user:'+digest('member@example.test'),JSON.stringify({...u.record,enabled:false}));assert.equal((await revoked.handler(request('apple-auth',{action:'signin',code:'mock',nonce:d.nonce,state:d.nonce},d.cookie))).status,403);
 const limited=setup();limited.state.allowed=false;assert.equal((await limited.handler(request('apple-auth',{action:'begin'}))).status,429);limited.state.online=false;assert.equal((await limited.handler(request('apple-auth',{action:'begin'}))).status,503);
});

test('Apple rejects mismatched state before exchanging the code',async()=>{const s=setup(),b=await s.begin();const r=await s.handler(request('apple-auth',{action:'signin',code:'mock',nonce:b.nonce,state:'different'},b.cookie));assert.equal(r.status,400);});
