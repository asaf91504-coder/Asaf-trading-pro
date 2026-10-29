import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

// Keep the root test gate independent of optional native npm dependencies.
// The exact bootstrap source is executed with injected native bridge fixtures.
const source=readFileSync(new URL('../mobile/native-bootstrap.mjs',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'').replace(/export /g,'');
function module(){const context={URL,Request,Response,Headers,DOMException,Event,TextEncoder,Uint8Array,btoa,setTimeout,clearTimeout,console};vm.createContext(context);vm.runInContext(source,context);return context;}
function fetchFixture({result={status:200,data:{ok:true},headers:{'content-type':'application/json','Set-Cookie':'secret=opaque; HttpOnly','set-cookie2':'more-secret'}},request:custom}={}){
 const calls=[],delegated=[],win={location:{href:'capacitor://localhost/index.html'},fetch:async(...args)=>{delegated.push(args);return new Response('delegated')}};
 module().setupNativeFetch({window:win,http:{request:custom||(async options=>{calls.push(options);return result})}});return {win,calls,delegated};
}
test('native API facade fixes destination/origin and hides session cookies from JavaScript',async()=>{
 const f=fetchFixture(),response=await f.win.fetch('/.netlify/functions/workspace?section=watch',{method:'PUT',headers:{Cookie:'forged',Authorization:'secret',Origin:'https://evil.test','X-Request':'safe'},body:JSON.stringify({test:true})});
 assert.deepEqual(await response.json(),{ok:true});assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('set-cookie2'),null);
 assert.equal(f.calls[0].url,'https://joyful-seahorse-967889.netlify.app/.netlify/functions/workspace?section=watch');assert.equal(f.calls[0].headers.Origin,'https://joyful-seahorse-967889.netlify.app');assert.equal(f.calls[0].headers.cookie,undefined);assert.equal(f.calls[0].headers.authorization,undefined);assert.equal(f.calls[0].headers['x-request'],'safe');assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].data)),{test:true});
 assert.equal(f.calls[0].disableRedirects,true);assert.equal(f.calls[0].connectTimeout+f.calls[0].readTimeout,30000);
});
test('only exact native origin and production API routes enter privileged native HTTP',async()=>{
 const f=fetchFixture();for(const path of ['https://evil.test/.netlify/functions/auth','evil://localhost/.netlify/functions/auth','capacitor://otherhost/.netlify/functions/auth','/icons/app-192.png','https://accounts.google.com/','https://joyful-seahorse-967889.netlify.app/mobile-connect.html'])await f.win.fetch(path);
 assert.equal(f.calls.length,0);assert.equal(f.delegated.length,6);
 await f.win.fetch('https://joyful-seahorse-967889.netlify.app/.netlify/functions/auth');assert.equal(f.calls.length,1);
});
test('Request objects preserve JSON, safe headers and status while rejecting unsupported bodies/methods',async()=>{
 const f=fetchFixture({result:{status:403,data:{error:'denied'},headers:{'Content-Type':'application/json'}}});
 const response=await f.win.fetch(new Request('https://joyful-seahorse-967889.netlify.app/.netlify/functions/account',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"status"}'}));assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'denied'});assert.equal(f.calls[0].data.action,'status');
 await assert.rejects(f.win.fetch('/.netlify/functions/auth',{method:'TRACE'}));await assert.rejects(f.win.fetch('/.netlify/functions/auth',{method:'POST',body:'not JSON'}));await assert.rejects(f.win.fetch('/.netlify/functions/auth',{body:'{}'}));
 const empty=fetchFixture({result:{status:204,data:'ignored',headers:{}}});assert.equal(await (await empty.win.fetch('/.netlify/functions/account')).text(),'');
});
test('aborted native request never retries or delivers its eventual response',async()=>{
 const initial=new AbortController(),f=fetchFixture();initial.abort();await assert.rejects(f.win.fetch('/.netlify/functions/auth',{signal:initial.signal}),{name:'AbortError'});assert.equal(f.calls.length,0);
 let resolve;const controller=new AbortController(),pending=fetchFixture({request:()=>new Promise(r=>{resolve=r})});const response=pending.win.fetch('/.netlify/functions/auth',{signal:controller.signal});controller.abort();await assert.rejects(response,{name:'AbortError'});resolve({status:200,data:{authenticated:true}});
});
test('approval link accepts only exact request ID path and PKCE has correct SHA256 challenge',async()=>{
 const m=module(),id='a'.repeat(64);assert.equal(m.approvalURL('/mobile-connect.html?request='+id,id),'https://joyful-seahorse-967889.netlify.app/mobile-connect.html?request='+id);
 for(const path of ['https://evil.test/','//evil.test/','/mobile-connect.html?request='+id+'&next=evil','/mobile-connect.html?request='+'b'.repeat(64)])assert.throws(()=>m.approvalURL(path,id));
 const pkce=await m.createPKCE(webcrypto);assert.match(pkce.verifier,/^[a-zA-Z0-9_-]{43}$/);assert.match(pkce.challenge,/^[a-zA-Z0-9_-]{43}$/);const expected=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(pkce.verifier))).toString('base64url');assert.equal(pkce.challenge,expected);
});

function bootstrapFixture({enabled=true,launcherWait=null}={}){
 const m=module(),elements=new Map(),handlers={},events={},calls=[],opened=[],scheduled=new Map();let time=0,redeemed=false,appResume;
 const element=tag=>({tagName:tag,textContent:'',hidden:false,disabled:false,isConnected:true,children:[],listeners:{},append(...items){this.children.push(...items)},after(node){elements.set(node.id,node)},addEventListener(type,fn){this.listeners[type]=fn}});
 elements.set('googleLoginStatus',element('p'));
 const doc={getElementById:id=>elements.get(id)||null,createElement:element,addEventListener(type,fn){handlers[type]=fn}};
 const win={location:{href:'capacitor://localhost/index.html'},history:{replaceState(){}},fetch:async()=>new Response('unused'),crypto:webcrypto,setTimeout(fn){scheduled.set(1,fn);return 1},clearTimeout(id){scheduled.delete(id)},addEventListener(type,fn){events[type]=fn},dispatchEvent(event){events.dispatched=event.type}};
 const http={async request(options){calls.push(options);if(options.method==='GET')return {status:200,data:{enabled}};if(options.data.action==='begin')return {status:200,data:{requestId:'a'.repeat(64),approvalPath:'/mobile-connect.html?request='+'a'.repeat(64),expiresIn:300}};if(options.data.action==='redeem')return redeemed?{status:200,data:{authenticated:true}}:{status:202,data:{status:'pending'}};throw Error('unexpected request')}};
 let entered;const launchEntered=new Promise(resolve=>{entered=resolve});
 const control=m.installNativeBootstrap({window:win,document:doc,http,capacitor:{isNativePlatform:()=>true},app:{addListener(_type,callback){appResume=callback;return Promise.resolve({remove(){}})}},launcher:{async openUrl(options){opened.push(options);entered();if(launcherWait)await launcherWait;return {completed:true}}},now:()=>time});
 return {control,calls,opened,launchEntered,status:()=>elements.get('googleLoginStatus').textContent,handlers,events,scheduled,advance(value){time=value},approved(){redeemed=true},resume:()=>appResume({isActive:true}),elements};
}
test('disabled native authentication never launches Google or creates a handoff request',async()=>{
 const f=bootstrapFixture({enabled:false});await f.control.begin();assert.equal(f.calls.length,1);assert.equal(f.opened.length,0);assert.match(f.status(),/לא הופעלה/);
 let prevented=false,stopped=false;f.handlers.click({target:{closest:()=>({})},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});assert.equal(prevented,true);assert.equal(stopped,true);
});
test('external approval stays memory-only and redemption requires return/resume, not polling',async()=>{
 const f=bootstrapFixture();await f.control.begin();assert.equal(f.opened.length,1);assert.equal(f.calls.length,2);assert.match(f.status(),/aaaaaa/);assert.equal(f.scheduled.size,1);
 await f.control.redeem();assert.equal(f.calls.length,3);assert.equal(f.calls[2].data.action,'redeem');assert.match(f.status(),/עדיין ממתין/);
 f.approved();await f.control.redeem();assert.equal(f.events.dispatched,'asaf:native-authenticated');assert.equal(f.scheduled.size,0);assert.equal(f.elements.get('nativeLoginControls').hidden,true);
 assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie|setInterval|\.google\.accounts/);
});
test('cancellation, logout and expiry discard handoff so it cannot later redeem',async()=>{
 const f=bootstrapFixture();await f.control.begin();f.control.cancel();await f.control.redeem();assert.equal(f.calls.length,2);
 await f.control.begin();f.events['asaf:logout']();await f.control.redeem();assert.equal(f.calls.length,4);
 await f.control.begin();f.advance(300001);await f.control.redeem();assert.equal(f.calls.length,6);assert.match(f.status(),/פגה/);
});
test('expiry clears pending verifier and unlocks UI even while external launcher has not settled',async()=>{
 let release;const waiting=new Promise(resolve=>{release=resolve}),f=bootstrapFixture({launcherWait:waiting});
 const begun=f.control.begin();await f.launchEntered;assert.equal(f.elements.get('nativeLoginControls').hidden,false);
 f.advance(300001);[...f.scheduled.values()][0]();assert.equal(f.elements.get('nativeLoginControls').hidden,true);assert.match(f.status(),/פגה/);await f.control.redeem();assert.equal(f.calls.length,2);
 release();await begun;assert.match(f.status(),/פגה/);
});
