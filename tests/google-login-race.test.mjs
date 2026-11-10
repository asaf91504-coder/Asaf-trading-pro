import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const authSource=readFileSync(new URL('../auth-ui.mjs',import.meta.url),'utf8').replaceAll('export ','');
const googleSource=readFileSync(new URL('../google-login-ui.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
for(const failure of ['offline','gateway','invalid-json','disabled'])test('Google preparation remains retryable after '+failure,async()=>{
 const nodes=new Map(),calls=[];let rendered=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:true,textContent:'',replaceChildren(){},removeAttribute(){},classList:{remove(){},contains(){return false}}});return nodes.get(id)};
 const ctx={Response,AbortSignal,authState:{authenticated:false},refreshAuth:async()=>{},document:{getElementById:node},window:{addEventListener(){},google:{accounts:{id:{initialize(){},renderButton(){rendered++}}}}},fetch:async(url,options)=>{
  calls.push({url,body:options?.body&&JSON.parse(options.body)});
  if(options?.method==='POST')return Response.json({clientId:'fixture',nonce:'fixture'});
  if(failure==='offline')throw new TypeError('Failed to fetch');
  if(failure==='gateway')return new Response('Unavailable',{status:503});
  if(failure==='invalid-json')return new Response('<html>Unavailable</html>');
  return Response.json({enabled:false});
 }};
 vm.createContext(ctx);vm.runInContext(googleSource,ctx);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1,'no automatic retry or sign-in request');
 if(failure==='disabled'){assert.equal(node('googlePrepare').disabled,true);return}
 assert.equal(node('googlePrepare').disabled,false,'customer can retry after connectivity recovers');
 assert.equal(node('googleLoginStatus').textContent,'לא ניתן לבדוק את חיבור Google כרגע.');
 await node('googlePrepare').onclick();
 assert.equal(calls.length,2);
 assert.deepEqual(calls[1].body,{action:'begin'});
 assert.equal(rendered,1,'retry reaches the Google sign-in button');
 assert.equal(ctx.authState.authenticated,false,'preparation never grants authentication');
});
for(const transition of ['signin','logout-all','delete'])test('Google/account '+transition+' ignores pre-transition auth response',async()=>{
 const nodes=new Map(),listeners={};let signedIn=transition!=='signin',delay=false,resolveOld,callback;
 const node=id=>{if(!nodes.has(id)){const classes=new Set();nodes.set(id,{value:'',hidden:false,textContent:'',disabled:false,replaceChildren(){},removeAttribute(){},querySelector(){return {disabled:false}},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}})}return nodes.get(id)};
 const ctx={URL,Response,AbortSignal,Event,CustomEvent:class extends Event{constructor(t,o){super(t);this.detail=o.detail}},welcomeMessage:()=> 'Welcome',document:{getElementById:node,addEventListener(){}},window:{confirm:()=>true,addEventListener(t,fn){(listeners[t]??=[]).push(fn)},dispatchEvent(e){for(const fn of listeners[e.type]||[])fn(e)},google:{accounts:{id:{initialize(options){callback=options.callback},renderButton(){}}}}},fetch:async(url,options)=>{
  if(url.endsWith('/auth')){
   if(delay){delay=false;return new Promise(resolve=>{resolveOld=resolve})}
   return Response.json({enabled:true,authenticated:signedIn,...(signedIn?{memberId:'member-1'}:{})});
  }
  const body=options?.body?JSON.parse(options.body):null;
  if(url.endsWith('/google-auth')){
   if(body?.action==='signin'){signedIn=true;return Response.json({displayName:'Test'})}
   return Response.json({enabled:true,signupEnabled:true,clientId:'test',nonce:'test'});
  }
  if(body?.action==='logout-all'||body?.action==='delete')signedIn=false;
  return Response.json({googleLinked:true,admin:false});
 }};
 vm.createContext(ctx);
 const mod=vm.runInContext('(()=>{'+authSource+';return {authState,refreshAuth}})()',ctx);
 Object.assign(ctx,mod);await mod.refreshAuth();vm.runInContext(googleSource,ctx);
 await new Promise(resolve=>setImmediate(resolve));
 if(transition==='signin')await node('googlePrepare').onclick();
 delay=true;const old=mod.refreshAuth();
 const operation=transition==='signin'?callback({credential:'fixture'}):node(transition==='delete'?'accountDelete':'accountLogoutAll').onclick();
 await new Promise(resolve=>setImmediate(resolve));
 resolveOld(Response.json({enabled:true,authenticated:transition!=='signin',...(transition!=='signin'?{memberId:'member-1'}:{})}));
 await Promise.all([old,operation]);
 assert.equal(mod.authState.authenticated,transition==='signin');
 assert.equal(mod.authState.memberId,transition==='signin'?'member-1':null);
 if(transition==='signin')assert.equal(node('googleLoginStatus').textContent,'Welcome');
});
