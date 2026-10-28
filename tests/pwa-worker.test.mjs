import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function worker({networkFailure=false,cached=true,status=200}={}){
 const handlers={},adds=[],deleted=[],fetches=[];let claims=0;const response=new Response('network response',{status}),offline=new Response('offline page');
 const cache={add:async path=>adds.push(path),match:async path=>cached&&path==='/offline.html'?offline:undefined};
 const context={URL,Response,Set,Promise,caches:{open:async()=>cache,keys:async()=>['asaf-offline-v0','asaf-offline-v1','some-other-cache'],delete:async name=>deleted.push(name)},self:{location:{origin:'https://app.example'},clients:{claim:async()=>{claims++}},addEventListener:(type,handler)=>{handlers[type]=handler}},fetch:async request=>{fetches.push(request);if(networkFailure)throw Error('offline');return response}};
 vm.createContext(context);vm.runInContext(source,context);
 function request(path,options={}){let result;handlers.fetch({request:{url:new URL(path,'https://app.example').href,method:'GET',mode:'navigate',...options},respondWith(value){result=value}});return result;}
 return {handlers,request,adds,deleted,fetches,response,offline,claims:()=>claims};
}
test('installation precaches only static offline page; activation deletes only own obsolete caches',async()=>{
 const w=worker();let pending;w.handlers.install({waitUntil(promise){pending=promise}});await pending;assert.deepEqual(w.adds,['/offline.html']);w.handlers.activate({waitUntil(promise){pending=promise}});await pending;assert.deepEqual(w.deleted,['asaf-offline-v0']);assert.equal(w.claims(),1);assert.doesNotMatch(source,/skipWaiting\(/);
});
test('public navigation uses network unchanged without caching response or user content',async()=>{
 const w=worker();for(const path of ['/','/?tab=chat&symbol=NASDAQ%3AAAPL','/index.html','/journal','/journal.html','/data-privacy','/data-privacy.html'])assert.equal(await w.request(path),w.response);
 assert.equal(w.fetches.length,7);assert.deepEqual(w.adds,[]);
});
test('API/auth/callback/POST/cross-origin and module requests are never intercepted',()=>{
 const w=worker({networkFailure:true});for(const path of ['/.netlify/functions/auth','/.netlify/functions/google-auth?code=secret','/.netlify/functions/free-chat','/.netlify/functions/public-market','/activate','/activate.html','/google-auth','/auth/callback','/?code=secret&state=secret','/?error=denied','/?unknown=value','https://accounts.google.com/','/stock-chat-ui.mjs'])assert.equal(w.request(path),undefined,path);
 assert.equal(w.request('/',{method:'POST'}),undefined);assert.equal(w.request('/',{mode:'cors'}),undefined);assert.equal(w.fetches.length,0);assert.deepEqual(w.adds,[]);
});
test('network rejection returns fixed offline page, not a cached signed-in page',async()=>{
 const w=worker({networkFailure:true});assert.equal(await w.request('/?tab=chat'),w.offline);assert.deepEqual(w.adds,[]);
});
test('HTTP failure response is preserved; missing fallback produces explicit uncached 503',async()=>{
 const w=worker({status:503});assert.equal(await w.request('/'),w.response);assert.equal(w.response.status,503);
 const missing=worker({networkFailure:true,cached:false}),fallback=await missing.request('/');assert.equal(fallback.status,503);assert.equal(fallback.headers.get('cache-control'),'no-store');assert.match(await fallback.text(),/דורשים אינטרנט/);
});
