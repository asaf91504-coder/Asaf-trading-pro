import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as flow from '../google-login-flow.mjs';

const load=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const sources={main:load('google-login-ui.mjs'),billing:load('subscription-login.mjs')};

function fixture(page,{ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',nav={},enabled=true,storageBlocked=false}={}){
 const elements=new Map(),listing=page==='main'?'googleLoginButton':'billingGoogleButton';
 const prepare=page==='main'?'googlePrepare':'billingLogin';
 const status=page==='main'?'googleLoginStatus':'billingLoginStatus';
 const node=id=>{if(!elements.has(id)){
  const classes=new Set();
  elements.set(id,{rendered:false,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},replaceChildren(){this.rendered=false},removeAttribute(){}});
 }return elements.get(id)};
 const listeners=new Map(),store=new Map(),calls=[],initializations=[],timers=new Map();
 let serial=0,now=100000,handle=0;
 const authState={enabled:true,authenticated:false,memberId:null,checkAvailable:true};
 const announce=()=>listeners.get('asaf:auth')?.();
 const mockWindow={
  navigator:{userAgent:ua,...nav},
  location:{origin:'https://asafpro.com',replace(){}},
  sessionStorage:{
   setItem(k,v){if(storageBlocked)throw Error('disabled');store.set(k,v)},
   getItem:k=>store.get(k)??null,
   removeItem:k=>store.delete(k),
  },
  setTimeout(fn){timers.set(++handle,fn);return handle;},
  clearTimeout(k){timers.delete(k)},
  addEventListener:(name,fn)=>listeners.set(name,fn),
  google:{accounts:{id:{initialize:options=>initializations.push(options),renderButton:target=>{target.rendered=true}}}},
 };
 const ctx={...flow,AbortSignal,Response,Date:{now:()=>now},authState,refreshAuth:async()=>{},welcomeMessage:()=>'',window:mockWindow,document:{getElementById:node,documentElement:{lang:'he'}},
  fetch:async(url,opts)=>{
   if(url.endsWith('/account'))return Response.json({googleLinked:false});
   const body=opts?.body&&JSON.parse(opts.body);calls.push(body||'capability');
   return body?.action==='begin'?Response.json({clientId:'client',nonce:String(++serial).padStart(64,'0')}):
    body?.action==='signin'?Response.json({error:'denied'},{status:401}):Response.json({enabled:true,redirectEnabled:enabled});
  }};
 vm.runInNewContext(sources[page],ctx);
 return {ready:()=>new Promise(resolve=>setImmediate(resolve)),authState,announce,store,calls,initializations,listing:node(listing),status:node(status),click:()=>node(prepare).onclick(),expire(){now+=300000;for(const fn of [...timers.values()])fn()}};
}

for(const [page,path] of [['main','/'],['billing','/subscription.html']]){
 test(page+' uses same-tab redirect on iOS only when configured',async()=>{
  const f=fixture(page);await f.ready();await f.click();
  assert.equal(f.listing.rendered,true);
  const opts=f.initializations[0];
  assert.equal(opts.ux_mode,'redirect');assert.equal(opts.login_uri,'https://asafpro.com/.netlify/functions/google-redirect');assert.equal(opts.callback,undefined);
  assert.deepEqual(JSON.parse(f.store.get(flow.googleLoginAttemptKey)),{returnTo:path,nonce:opts.nonce,startedAt:100000});
  assert.equal(f.calls.some(c=>c.action==='signin'),false);
  await f.click();
  assert.notEqual(f.initializations[1].nonce,opts.nonce);
  f.expire();
  assert.equal(f.listing.rendered,false);assert.equal(f.store.size,0);
 });
 test(page+' preserves desktop and feature-disabled popup behavior',async()=>{
  for(const args of [{ua:'Mozilla/5.0 (Macintosh)',nav:{maxTouchPoints:0}}, {enabled:false}]){
   const f=fixture(page,args);await f.ready();await f.click();
   assert.equal(f.listing.rendered,true);
   const opts=f.initializations[0];assert.equal(opts.ux_mode,undefined);assert.equal(opts.login_uri,undefined);assert.equal(typeof opts.callback,'function');
   assert.equal(f.store.size,0);
  }
 });
 test(page+' with blocked tab storage shows retry guidance and does not open a popup',async()=>{
  const f=fixture(page,{storageBlocked:true});await f.ready();await f.click();
  assert.equal(f.listing.rendered,false);assert.equal(f.initializations.length,0);assert.match(f.status.textContent,/Safari/);
 });
}
test('iPad desktop mode is recognized without classifying ordinary Macs as iOS',()=>{
 assert.equal(flow.usesIosGoogleRedirect({userAgent:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:5}),true);
 assert.equal(flow.usesIosGoogleRedirect({userAgent:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:1}),false);
});
test('unchanged auth refresh preserves the prepared button; identity changes invalidate stale callbacks',async()=>{
 const f=fixture('main',{enabled:false});await f.ready();await f.click();
 const cb=f.initializations[0].callback;
 assert.equal(f.listing.rendered,true);
 f.announce();assert.equal(f.listing.rendered,true);
 f.authState.authenticated=true;f.authState.memberId='new-member';f.announce();
 assert.equal(f.listing.rendered,false);assert.match(f.status.textContent,/השתנה/);
 await cb({credential:'stale'});
 assert.equal(f.calls.some(c=>c.action==='signin'),false);
});
test('cancelled chooser returning to an unchanged session is retryable, but only the latest popup can submit',async()=>{
 const f=fixture('main',{enabled:false});await f.ready();await f.click();const first=f.initializations[0].callback;
 f.announce();await f.click();const second=f.initializations[1].callback;
 await first({credential:'stale'});assert.equal(f.calls.some(c=>c.action==='signin'),false);
 await second({credential:'fixture'});assert.equal(f.calls.filter(c=>c.action==='signin').length,1);
});
