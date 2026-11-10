import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the actual browser module with a minimal DOM, rather than copying
// its state machine. Requests never leave this process.
test('unavailable auth blocks access without logout; recovery preserves account, confirmed invalidity clears it',async()=>{
 const original={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,CustomEvent:globalThis.CustomEvent};
 const events=[],handlers={};let response=()=>Response.json({enabled:true,authenticated:true,memberId:'member-1'});
 globalThis.document={getElementById:()=>null,addEventListener:()=>{}};
 globalThis.window={dispatchEvent:event=>events.push(event.type),addEventListener:(type,handler)=>{handlers[type]=handler}};
 globalThis.CustomEvent=class extends Event{constructor(type,options){super(type);this.detail=options.detail}};
 globalThis.fetch=async()=>response();
 try{
  const mod=await import('../auth-ui.mjs?reliability-test');await mod.refreshAuth();
  assert.equal(mod.authState.authenticated,true);assert.equal(mod.authState.memberId,'member-1');
  for(const unavailable of [()=>{throw Error('network timeout')},()=>new Response('',{status:503}),()=>Response.json({unexpected:true}),()=>new Response('{',{headers:{'content-type':'application/json'}})]){
   response=unavailable;events.length=0;await mod.refreshAuth();
   assert.equal(mod.authState.enabled,true);assert.equal(mod.authState.authenticated,false);assert.equal(mod.authState.checkAvailable,false);assert.equal(mod.authState.memberId,'member-1');assert.ok(!events.includes('asaf:logout'));
  }
  response=()=>Response.json({enabled:true,authenticated:true,memberId:'member-1'});events.length=0;await mod.refreshAuth();
  assert.equal(mod.authState.checkAvailable,true);assert.equal(mod.authState.authenticated,true);assert.ok(!events.includes('asaf:logout'));
  response=()=>Response.json({enabled:true,authenticated:false});await mod.refreshAuth();assert.equal(mod.authState.memberId,null);assert.ok(events.includes('asaf:logout'));
  response=()=>Response.json({enabled:true,authenticated:true,memberId:'member-1'});await mod.refreshAuth();events.length=0;
  response=()=>Response.json({enabled:true,authenticated:true,memberId:'member-2'});await mod.refreshAuth();assert.equal(events.filter(e=>e==='asaf:logout').length,1);
  response=()=>Response.json({enabled:true,authenticated:false});await handlers['asaf:native-authenticated']({detail:{authenticated:true,memberId:'forged'}});assert.equal(mod.authState.authenticated,false);assert.equal(mod.authState.memberId,null);
 }finally{Object.assign(globalThis,original)}
});

test('a delayed status response cannot sign the UI back in after confirmed logout',async()=>{
 const original={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,CustomEvent:globalThis.CustomEvent};
 const nodes=new Map(),events=[];let resolveOld,delayNext=false;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',value:'',querySelector:()=>({disabled:false})});return nodes.get(id)};
 globalThis.document={getElementById:node,addEventListener(){}};
 globalThis.window={addEventListener(){},dispatchEvent:e=>events.push(e.type)};
 globalThis.CustomEvent=class extends Event{constructor(type,options){super(type);this.detail=options.detail}};
 let signedIn=true;
 globalThis.fetch=async(_url,options)=>{
  if(options?.method==='POST'){signedIn=false;return Response.json({ok:true})}
  if(delayNext){delayNext=false;return new Promise(resolve=>{resolveOld=resolve})}
  return Response.json({enabled:true,authenticated:signedIn,...(signedIn?{memberId:'member-1'}:{})});
 };
 try{
  const mod=await import('../auth-ui.mjs?logout-race');await mod.refreshAuth();assert.equal(mod.authState.authenticated,true);
  delayNext=true;const oldCheck=mod.refreshAuth();
  const logout=node('memberLogout').onclick();
  await new Promise(resolve=>setImmediate(resolve));
  resolveOld(Response.json({enabled:true,authenticated:true,memberId:'member-1'}));
  await Promise.all([logout,oldCheck]);
  assert.equal(mod.authState.authenticated,false);assert.equal(mod.authState.memberId,null);
  assert.equal(node('memberLogin').hidden,false);assert.equal(node('memberLogout').hidden,true);
  assert.equal(events.filter(e=>e==='asaf:logout').length,1);
 }finally{Object.assign(globalThis,original)}
});

test('obsolete responses and failures neither overwrite a new login nor release its pending check',async()=>{
 const original={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,CustomEvent:globalThis.CustomEvent};
 globalThis.document={getElementById:()=>null,addEventListener(){}};
 globalThis.window={dispatchEvent(){},addEventListener(){}};
 globalThis.CustomEvent=class extends Event{constructor(type,options){super(type);this.detail=options.detail}};
 try{for(const failOld of [false,true]){
  const pending=[];let calls=0,queued=false;
  globalThis.fetch=()=>{calls++;return queued?new Promise((resolve,reject)=>pending.push({resolve,reject})):Promise.resolve(Response.json({enabled:true,authenticated:true,memberId:'old-member'}))};
  const mod=await import('../auth-ui.mjs?refresh-race='+failOld);await mod.refreshAuth();queued=true;
  const old=mod.refreshAuth(),fresh=mod.refreshAuth({fresh:true});assert.equal(pending.length,2);
  if(failOld)pending[0].reject(Error('old timeout'));else pending[0].resolve(Response.json({enabled:true,authenticated:false}));
  await old;const before=calls,joined=mod.refreshAuth();assert.equal(calls,before,'old finally must not release a newer pending check');
  pending[1].resolve(Response.json({enabled:true,authenticated:true,memberId:'new-member'}));await Promise.all([fresh,joined]);
  assert.equal(mod.authState.authenticated,true);assert.equal(mod.authState.memberId,'new-member');assert.equal(mod.authState.checkAvailable,true);
 }}finally{Object.assign(globalThis,original)}
});
