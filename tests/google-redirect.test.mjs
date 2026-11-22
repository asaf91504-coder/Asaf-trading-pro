import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createGoogleHandler} from '../server/google-auth.mjs';
import {createGoogleRedirectHandler} from '../netlify/functions/google-redirect.mjs';
import {env,fixture} from './identity-fixture.mjs';
const origin='https://asafpro.com',url=origin+'/.netlify/functions/google-redirect';
const enabled={...env,ASAF_GOOGLE_IOS_REDIRECT_ENABLED:'true'};
const handler=createGoogleRedirectHandler({env:enabled});
const jwt='abc.xyz.123',csrf='fixture_token';
const good=new URLSearchParams({g_csrf_token:csrf,credential:jwt}).toString();
const request=(body=good,cookie='g_csrf_token='+csrf,contentType='application/x-www-form-urlencoded')=>new Request(url,{method:'POST',headers:{cookie,'Content-Type':contentType},body});

test('only configured canonical origin advertises and accepts mobile redirect',async()=>{
 const google=createGoogleHandler({env:enabled,run:fixture().run});
 assert.equal((await (await google(new Request(origin+'/.netlify/functions/google-auth'))).json()).redirectEnabled,true);
 assert.equal((await (await google(new Request('https://preview.example/.netlify/functions/google-auth'))).json()).redirectEnabled,undefined);
 assert.equal((await createGoogleRedirectHandler({env})(request())).status,404);
 assert.equal((await handler(new Request(url))).status,405);
 assert.equal((await handler(request(good,'g_csrf_token='+csrf,'application/json'))).status,415);
});
test('redirect verifies Google double submit and strict payload before any HTML handoff',async()=>{
 for(const [body,cookie,status] of [[good,'',403],[good,'g_csrf_token=notmatched_token',403],[good,'g_csrf_token='+csrf+'; g_csrf_token='+csrf,403],
  [good+'&g_csrf_token='+csrf,'g_csrf_token='+csrf,403],[good+'&credential='+jwt,undefined,400],
  ['g_csrf_token='+csrf+'&credential=invalid',undefined,400],
  [good+'&extra='+'x'.repeat(16_000),undefined,400]]){
   const result=await handler(request(body,cookie));
   assert.equal(result.status,status);
   assert.doesNotMatch(await result.text(),/google-credential|google-redirect-return/);
 }
 const result=await handler(request());
 assert.equal(result.status,200);
 assert.equal(result.headers.get('set-cookie'),null);
 assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal(result.headers.get('referrer-policy'),'no-referrer');
 const html=await result.text(),nonce=html.match(/nonce="([^"]+)"/)[1];
 assert.ok(result.headers.get('content-security-policy').includes("'nonce-"+nonce+"'"));
 assert.match(html,/content="abc\.xyz\.123"/);
 assert.match(html,/src="\/google-redirect-return\.mjs"/);
});

const script=readFileSync(new URL('../google-redirect-return.mjs',import.meta.url),'utf8').replace('void finish();','finish();');
const key='asaf:google-redirect:v1',nonce='e'.repeat(64);
async function runBridge({attempt={nonce,returnTo:'/',startedAt:Date.now()-1000},credential=jwt,serverStatus=200,serverBody={authenticated:true}}={}){
 const state={back:{},status:{},nav:[],requests:[],metaRemoved:false},storage=new Map();
 if(attempt)storage.set(key,JSON.stringify(attempt));
 const context={
  document:{getElementById:id=>state[id],querySelector:()=>credential?{content:credential,remove(){state.metaRemoved=true}}:null},
  sessionStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},
  window:{location:{replace:p=>state.nav.push(p)}},
  fetch:async (url,args)=>{state.requests.push({url,...args,body:JSON.parse(args.body)});return Response.json(serverBody,{status:serverStatus})},
  AbortSignal
 };
 await vm.runInNewContext(script,context);
 return {...state,remaining:storage.has(key)};
}
test('same-tab callback consumes the attempt before submitting to the existing signed-in route',async()=>{
 const result=await runBridge({attempt:{nonce,returnTo:'/subscription.html',startedAt:Date.now()-100}});
 assert.equal(result.remaining,false);assert.equal(result.metaRemoved,true);
 assert.deepEqual(result.nav,['/subscription.html']);
 assert.equal(result.requests[0].url,'/.netlify/functions/google-auth');
 assert.equal(result.requests[0].credentials,'same-origin');
 assert.equal(result.requests[0].referrerPolicy,'same-origin');
 assert.equal(result.requests[0].redirect,'error');
 assert.deepEqual(result.requests[0].body,{action:'signin',credential:jwt,nonce});
});
test('expired, missing and malformed attempts never contact auth; rejection never navigates',async()=>{
 for(const attempt of [null,{nonce,startedAt:Date.now()-300001},{nonce:'invalid',startedAt:Date.now()-100},{nonce,startedAt:Date.now()+1000}]){
  const result=await runBridge({attempt});assert.deepEqual(result.requests,[]);assert.deepEqual(result.nav,[]);
  assert.match(result.status.textContent,/פגה/);
 }
 const result=await runBridge({serverStatus:401,serverBody:{error:'הכניסה פגה'}});
 assert.equal(result.status.textContent,'הכניסה פגה');assert.deepEqual(result.nav,[]);
});
test('return from Google cannot navigate to an arbitrary target',async()=>{
 for(const returnTo of ['https://example.test','//example.test','/subscription.html?pay=1']){
  const result=await runBridge({attempt:{nonce,returnTo,startedAt:Date.now()-100}});
  assert.deepEqual(result.nav,['/']);
 }
});
