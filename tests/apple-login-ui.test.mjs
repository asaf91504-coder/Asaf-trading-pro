import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apple-login-ui.mjs',import.meta.url),'utf8').replace(/^import .*;\n/,'');
function setup({enabled=true,outcome='success',failure=false}={}){
 const prepare={disabled:false},signin={hidden:true,disabled:false},status={textContent:''};
 const host={hidden:true,querySelector:s=>s.includes('prepare')?prepare:s.includes('signin')?signin:status};
 const calls=[],redirects=[];let options,popupCalls=0;
 const authState={authenticated:false};
 const context={Response,AbortSignal,authState,refreshAuth:async()=>{authState.authenticated=outcome!=='unverified';},document:{getElementById:()=>host},window:{location:{replace:url=>redirects.push(url)},AppleID:{auth:{init:o=>{options=o;},signIn:()=>{popupCalls++;if(outcome==='cancel')return Promise.reject({error:'popup_closed_by_user'});return Promise.resolve({authorization:{state:outcome==='mismatch'?'wrong':'nonce',code:'code'}});}}}},fetch:async(url,request)=>{
  if(!request?.body){if(failure)throw Error('offline');return Response.json({enabled});}
  const body=JSON.parse(request.body);calls.push(body);
  if(body.action==='begin')return Response.json({clientId:'client',redirectURI:'https://example.test/subscription.html',nonce:'nonce',state:'nonce'});
  return outcome==='rejected'?Response.json({error:'Denied'},{status:401}):Response.json({authenticated:true});
 }};
 const ready=vm.runInNewContext('(async()=>{'+source+'})()',context);
 return {ready,host,prepare,signin,status,calls,redirects,get options(){return options;},get popupCalls(){return popupCalls;}};
}
for(const config of [{enabled:false},{failure:true}])test('unavailable Apple capability remains hidden '+JSON.stringify(config),async()=>{const s=setup(config);await s.ready;assert.equal(s.host.hidden,true);assert.equal(s.calls.length,0);});
for(const outcome of ['success','cancel','mismatch','rejected','unverified'])test('Apple popup '+outcome+' keeps billing access server verified',async()=>{
 const s=setup({outcome});await s.ready;assert.equal(s.host.hidden,false);
 await s.prepare.onclick();assert.equal(s.options.usePopup,true);assert.equal(s.options.scope,'email');assert.equal(s.popupCalls,0,'preparation never opens a popup without the second gesture');assert.equal(s.signin.hidden,false);
 const pending=s.signin.onclick();assert.equal(s.popupCalls,1,'popup opens synchronously on the user gesture');await pending;
 assert.deepEqual(s.redirects,outcome==='success'?['/subscription.html']:[]);
 assert.equal(s.prepare.disabled,false);assert.equal(s.signin.hidden,true);
 assert.deepEqual(s.calls.map(c=>c.action),['begin',...(['cancel','mismatch'].includes(outcome)?[]:['signin'])]);
 if(outcome!=='success')assert.ok(s.status.textContent);
});
