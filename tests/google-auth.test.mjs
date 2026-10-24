import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleHandler} from '../server/google-auth.mjs';
import {currentUser,digest} from '../server/auth-core.mjs';
import {fixture,env,origin,prefix,request,seed} from './identity-fixture.mjs';
function setup(overrides={}){const state=fixture(),config={...env,...overrides};let claims;const handler=createGoogleHandler({env:config,run:state.run,verify:async()=>claims});return {state,config,handler,set claims(v){claims=v},async begin(){const r=await handler(request('google-auth',{action:'begin'}));const b=await r.json();claims={iss:'https://accounts.google.com',aud:config.GOOGLE_CLIENT_ID,exp:Date.now()/1000+300,nonce:b.nonce,sub:'12345678901234567890',email:'member@example.test',email_verified:true};return {...b,cookie:r.headers.get('set-cookie').split(';')[0]}}}}
test('Google stays off without configuration and rejects foreign origins before storage',async()=>{
 const s=setup({ASAF_GOOGLE_AUTH_ENABLED:'false'});assert.deepEqual(await (await s.handler(request('google-auth'))).json(),{enabled:false,signupEnabled:false});assert.equal((await s.handler(request('google-auth',{action:'begin'}))).status,503);assert.equal(s.state.db.size,0);
 const active=setup();assert.equal((await active.handler(new Request(origin+'/.netlify/functions/google-auth',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:'{"action":"begin"}'}))).status,403);assert.equal(active.state.db.size,0);
});
test('Google signup makes a stable account and a secure session; one-use nonce cannot replay',async()=>{
 const s=setup(),b=await s.begin(),body={action:'signin',credential:'mock-token',nonce:b.nonce};const r=await s.handler(request('google-auth',body,b.cookie));assert.equal(r.status,201);assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);const cookie=r.headers.get('set-cookie').split(';')[0];const user=await currentUser(request('auth',undefined,cookie),{env:s.config,run:s.state.run});assert.ok(user?.id);assert.equal((await s.handler(request('google-auth',body,b.cookie))).status,401);const saved=JSON.parse(s.state.db.get(prefix+'auth:user:'+digest('member@example.test')));assert.equal(saved.id,user.id);assert.ok(saved.googleSubject);assert.equal(JSON.stringify([...s.state.db]).includes('mock-token'),false);
 const again=await s.begin();assert.equal((await s.handler(request('google-auth',{...body,nonce:again.nonce},again.cookie))).status,200);
});
test('Google validates audience, issuer, expiry, nonce, subject and verified email',async()=>{
 for(const invalid of [{aud:'other'},{iss:'https://evil.test'},{exp:1},{nonce:'0'.repeat(64)},{sub:'invalid'},{email_verified:false}]){const s=setup(),b=await s.begin();s.claims={iss:'https://accounts.google.com',aud:env.GOOGLE_CLIENT_ID,exp:Date.now()/1000+300,nonce:b.nonce,sub:'123',email:'member@example.test',email_verified:true,...invalid};assert.equal((await s.handler(request('google-auth',{action:'signin',credential:'mock',nonce:b.nonce},b.cookie))).status,401);assert.ok(![...s.state.db.keys()].some(k=>k.includes('auth:member:')))}
});
test('a nonce cannot be used in a different browser and simultaneous consumes create only one session',async()=>{
 const s=setup(),b=await s.begin(),body={action:'signin',credential:'mock',nonce:b.nonce};assert.equal((await s.handler(request('google-auth',body,'asaf_google_binding='+'a'.repeat(64)))).status,401);const results=await Promise.all([s.handler(request('google-auth',body,b.cookie)),s.handler(request('google-auth',body,b.cookie))]);assert.equal(results.filter(r=>r.status===201).length,1);assert.equal([...s.state.db.keys()].filter(k=>k.includes('auth:session:')).length,1);
});
test('same email cannot take over an existing password account; explicit authenticated linking preserves its ID',async()=>{
 const s=setup(),existing=seed(s.state),b=await s.begin(),body={action:'signin',credential:'mock',nonce:b.nonce};assert.equal((await s.handler(request('google-auth',body,b.cookie))).status,409);const linked=await s.handler(request('google-auth',body,b.cookie+'; '+existing.cookie));assert.equal(linked.status,200);const saved=JSON.parse(s.state.db.get(prefix+'auth:user:'+digest('member@example.test')));assert.equal(saved.id,existing.record.id);assert.equal(saved.hash,existing.record.hash);assert.equal(saved.version,'v1');
});
test('Google does not bypass revocation, closed signup, registration caps, throttles or storage failures',async()=>{
 const closed=setup({ASAF_GOOGLE_SIGNUP_ENABLED:'false'}),b=await closed.begin();assert.equal((await closed.handler(request('google-auth',{action:'signin',credential:'mock',nonce:b.nonce},b.cookie))).status,403);
 const capped=setup({ASAF_ACCOUNT_MAX_MEMBERS:'1'});capped.state.sets.set(prefix+'auth:members',new Set(['existing']));const c=await capped.begin();assert.equal((await capped.handler(request('google-auth',{action:'signin',credential:'mock',nonce:c.nonce},c.cookie))).status,403);
 const revoked=setup(),u=seed(revoked.state),d=await revoked.begin();revoked.state.db.set(prefix+'auth:user:'+digest('member@example.test'),JSON.stringify({...u.record,enabled:false}));assert.equal((await revoked.handler(request('google-auth',{action:'signin',credential:'mock',nonce:d.nonce},d.cookie))).status,403);
 const limited=setup();limited.state.allowed=false;assert.equal((await limited.handler(request('google-auth',{action:'begin'}))).status,429);limited.state.online=false;assert.equal((await limited.handler(request('google-auth',{action:'begin'}))).status,503);
});

test('welcome name comes only from verified Google claims and is not stored in account records',async()=>{
 const s=setup(),b=await s.begin();s.claims={iss:'https://accounts.google.com',aud:env.GOOGLE_CLIENT_ID,exp:Date.now()/1000+300,nonce:b.nonce,sub:'123',email:'member@example.test',email_verified:true,given_name:'  אסף  ',name:'אסף כהן'};
 const r=await s.handler(request('google-auth',{action:'signin',credential:'mock',nonce:b.nonce,displayName:'forged'},b.cookie));
 assert.equal(r.status,201);assert.deepEqual(await r.json(),{authenticated:true,created:true,displayName:'אסף'});
 assert.equal(JSON.stringify([...s.state.db]).includes('אסף'),false);
});
