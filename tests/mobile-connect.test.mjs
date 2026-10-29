import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileRequestId,mountMobileConnect} from '../mobile-connect.mjs';

const requestId='a'.repeat(64),memberId='12345678-1234-1234-1234-123456789012';
function fixture({search='?request='+requestId,enabled=true,authenticated=true,checkAvailable=true,refreshChange=false,responseError=false,approveBody={status:'approved'}}={}){
 const nodes=new Map(),events={},requests=[];let authLoads=0,refreshes=0;
 function node(){return {textContent:'',disabled:false,checked:false,hidden:true,handlers:{},addEventListener(type,handler){this.handlers[type]=handler}};}
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
 const auth={authState:{authenticated,checkAvailable,memberId:authenticated?memberId:null},async refreshAuth(){refreshes++;if(refreshChange&&refreshes>1)this.authState.memberId='different-member';events['asaf:auth']?.();}};
 const win={location:{search},addEventListener(type,handler){events[type]=handler}};
 const fetcher=async(url,options)=>{requests.push({url,options});if(!options?.method)return {ok:true,json:async()=>({enabled})};if(responseError)throw new DOMException('timed out','TimeoutError');return {ok:true,json:async()=>approveBody};};
 const start=()=>mountMobileConnect({window:win,document:{getElementById:get},fetcher,loadAuth:async()=>{authLoads++;return auth}});
 return {get,events,requests,auth,start,authLoads:()=>authLoads};
}
test('request parser accepts only one exact opaque request id, never callback data',()=>{
 assert.equal(mobileRequestId('?request='+requestId),requestId);
 for(const search of ['', '?request=bad','?request='+requestId+'&request='+requestId,'?request='+requestId.toUpperCase()])assert.equal(mobileRequestId(search),null);
});
test('invalid or disabled request does not load auth UI or send approval',async()=>{
 const invalid=fixture({search:'?request=bad'});await invalid.start();assert.equal(invalid.requests.length,0);assert.equal(invalid.authLoads(),0);assert.match(invalid.get('mobileApprovalStatus').textContent,/אינו תקין/);
 const disabled=fixture({enabled:false});await disabled.start();assert.equal(disabled.requests.length,1);assert.equal(disabled.authLoads(),0);assert.equal(disabled.get('mobileApprovalPanel').hidden,true);assert.match(disabled.get('mobileApprovalStatus').textContent,/עדיין בהכנה/);
});
test('enabled approval never posts automatically and requires explicit code consent plus verified auth',async()=>{
 const f=fixture();await f.start();assert.equal(f.get('mobileRequestCode').textContent,'AAAAAA');assert.equal(f.get('mobileApprove').disabled,true);assert.equal(f.requests.length,1);
 f.get('mobileConfirmDevice').checked=true;f.get('mobileConfirmDevice').handlers.change();assert.equal(f.get('mobileApprove').disabled,false);
 await f.get('mobileApprove').handlers.click();assert.equal(f.requests.length,2);assert.deepEqual(JSON.parse(f.requests[1].options.body),{action:'approve',requestId,confirmation:'CONNECT'});assert.equal(f.requests[1].options.credentials,'same-origin');assert.match(f.get('mobileApprovalStatus').textContent,/הבקשה אושרה/);assert.equal(f.get('mobileApprovalPanel').hidden,true);
});
test('unverified auth cannot enable approval; identity changes discard prior consent',async()=>{
 const unavailable=fixture({checkAvailable:false});await unavailable.start();unavailable.get('mobileConfirmDevice').checked=true;unavailable.get('mobileConfirmDevice').handlers.change();assert.equal(unavailable.get('mobileApprove').disabled,true);
 const f=fixture({refreshChange:true});await f.start();f.get('mobileConfirmDevice').checked=true;f.get('mobileConfirmDevice').handlers.change();await f.get('mobileApprove').handlers.click();assert.equal(f.requests.length,1);assert.match(f.get('mobileApprovalStatus').textContent,/מצב החשבון השתנה/);assert.equal(f.get('mobileConfirmDevice').checked,false);
});
test('timeout never claims success, redirects, or posts an automatic retry',async()=>{
 const f=fixture({responseError:true});await f.start();f.get('mobileConfirmDevice').checked=true;f.get('mobileConfirmDevice').handlers.change();await f.get('mobileApprove').handlers.click();assert.equal(f.requests.length,2);assert.match(f.get('mobileApprovalStatus').textContent,/לא התקבל אישור בזמן/);assert.equal(f.get('mobileApprovalPanel').hidden,false);assert.equal(f.get('mobileApprove').disabled,true);
});
test('a malformed HTTP200 response is not treated as an approved native session',async()=>{
 const f=fixture({approveBody:{}});await f.start();f.get('mobileConfirmDevice').checked=true;f.get('mobileConfirmDevice').handlers.change();await f.get('mobileApprove').handlers.click();assert.equal(f.requests.length,2);assert.match(f.get('mobileApprovalStatus').textContent,/לא התקבל אישור תקין/);assert.equal(f.get('mobileApprovalPanel').hidden,false);
});
test('approval page includes existing Google login DOM contracts without exposing account management',()=>{
 const html=readFileSync(new URL('../mobile-connect.html',import.meta.url),'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
 for(const id of ['memberLogin','memberLogout','memberStatus','memberEmail','memberPassword','googlePrepare','googleLoginButton','googleLoginStatus','accountActions','accountDetails','adminActions','accountLogoutAll','accountDelete','accountActionStatus','adminForm','adminAction','adminEmail','adminStatus'])assert.ok(ids.includes(id),id);
 assert.match(html,/name="referrer" content="no-referrer"/);assert.match(html,/<div hidden aria-hidden="true">/);assert.doesNotMatch(html,/serviceWorker|location\.href|location\.assign/);
});
