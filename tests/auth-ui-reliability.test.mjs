import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the actual browser module with a minimal DOM, rather than copying
// its state machine. Requests never leave this process.
test('unavailable auth blocks access without logout; recovery preserves account, confirmed invalidity clears it',async()=>{
 const original={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,CustomEvent:globalThis.CustomEvent};
 const events=[];let response=()=>Response.json({enabled:true,authenticated:true,memberId:'member-1'});
 globalThis.document={getElementById:()=>null,addEventListener:()=>{}};
 globalThis.window={dispatchEvent:event=>events.push(event.type)};
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
 }finally{Object.assign(globalThis,original)}
});
