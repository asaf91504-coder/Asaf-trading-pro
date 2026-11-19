import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {personalBackup,parsePersonalBackup,personalData,tradeProfit} from '../personal-data.mjs';
import {preparePersonalRestore,completePersonalRestore,prepareFileRestore} from '../personal-restore.mjs';
import {PLANS,WEEK,creditWindow,creditsForCost,planFor,creditPlansReady,consentFor} from '../server/plans.mjs';
import {mountAppInstall} from '../app-install.mjs';

const member=(id='fixture-member')=>Response.json({enabled:true,authenticated:true,memberId:id});
const anonymous=()=>Response.json({enabled:true,authenticated:false});
const sources=Object.fromEntries(['auth-ui.mjs','accessibility.mjs','sw.js'].map(p=>[p,readFileSync(new URL('../'+p,import.meta.url),'utf8')]));
function fixture(){
 const document={listeners:{},hidden:false,readyState:'complete',documentElement:{dataset:{}},activeElement:null,addEventListener(k,f){this.listeners[k]=f}};
 function element(tag='div'){
   const attrs=new Map(),subs=new Map();
   const node={tagName:tag,children:[],hidden:false,disabled:false,checked:false,value:'',textContent:'',dataset:{},listeners:{},append(...n){this.children.push(...n)},addEventListener(k,f){this.listeners[k]=f},setAttribute(k,v){attrs.set(k,v)},removeAttribute(k){attrs.delete(k)},hasAttribute(k){return attrs.has(k)},getAttribute(k){return attrs.get(k)},focus(){document.activeElement=this},scrollIntoView(o){this.scroll=o},contains(e){return this.children.includes(e)||[...subs.values()].includes(e)},querySelector(k){if(!subs.has(k))subs.set(k,element(k==='button'||k==='.accessibility-close'?'button':'div'));return subs.get(k)},querySelectorAll(k){if(k==='[data-preference]')return this.querySelector('.accessibility-options').children.map(e=>e.children[0]);return this.children.flatMap(e=>e.tagName==='div'?e.children:[e]).filter(e=>['button','a'].includes(e.tagName))}};
   if(tag==='dialog'){node.showModal=()=>{node.open=true;attrs.set('open','');};node.close=()=>{node.open=false;attrs.delete('open');node.listeners.close?.()};}
   return node;
 }
 const nodes=new Map(),get=k=>{if(!nodes.has(k))nodes.set(k,element());return nodes.get(k)};
 const header=element('header'),body=element('body'),opener=element('button'),footer=element('button'),mainLink=element('a'),chatLink=element('a'),chatTab=element('button');
 mainLink.setAttribute('href','#mainContent');chatLink.setAttribute('href','#chatInput');chatTab.click=()=>{chatTab.clicked=true};
 Object.assign(document,{body,createElement:element,createTextNode:text=>({textContent:text}),getElementById:get,querySelector:k=>k==='[data-tab="chat"]'?chatTab:header,querySelectorAll:k=>k==='[data-accessibility-open]'?[opener,footer,header.children[0]].filter(Boolean):k==='.skip-links a'?[mainLink,chatLink]:[]});
 const events=[],window={handlers:{},isSecureContext:true,addEventListener(k,f){this.handlers[k]=f},dispatchEvent(e){events.push(e)}};
 return {document,window,nodes,get,header,body,opener,footer,mainLink,chatLink,chatTab,events,element};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function authFixture(getResponse=member){
 const f=fixture(),calls=[];let responder=(a,b)=>b?.method==='POST'?Response.json({ok:true}):getResponse();
 const scope={document:f.document,window:f.window,Event,CustomEvent:class extends Event{constructor(type,o){super(type);this.detail=o.detail}},AbortSignal,fetch:async(...args)=>{calls.push(args);return responder(...args)}};
 vm.runInNewContext(sources['auth-ui.mjs'].replace(/export /g,'')+'\nthis.api={refreshAuth,authState};',scope);
 return {...f,calls,...scope.api,setResponse(fn){responder=fn},login(){return f.get('memberLogin').onsubmit({target:f.get('memberLogin'),preventDefault(){}})},logout(){return f.get('memberLogout').onclick()},kinds(){return f.events.map(e=>e.type)}};
}

const authCases=[
 ['login form suppresses native submit and sends only supplied fields',async f=>{f.get('memberEmail').value='fixture@example.invalid';f.get('memberPassword').value='mock';await f.login();const [path,o]=f.calls.find(c=>c[1].method==='POST');assert.equal(path,'/.netlify/functions/auth');assert.deepEqual(JSON.parse(o.body),{email:'fixture@example.invalid',password:'mock'});}],
 ['credential transport failure releases button and clears password',async f=>{f.get('memberPassword').value='mock';f.setResponse(()=>{throw Error('offline')});await f.login();assert.equal(f.get('memberLogin').querySelector('button').disabled,false);assert.equal(f.get('memberPassword').value,'');}],
 ['server rejects credentials and user sees the returned error',async f=>{f.setResponse(()=>Response.json({error:'Credentials rejected'},{status:401}));await f.login();assert.equal(f.get('memberStatus').textContent,'Credentials rejected');}],
 ['sign-in pending disables button and clears only after completion',async f=>{let resolve;f.setResponse((_p,o)=>o.method==='POST'?new Promise(r=>{resolve=r}):member());f.get('memberPassword').value='mock';const done=f.login();assert.equal(f.get('memberLogin').querySelector('button').disabled,true);assert.equal(f.get('memberPassword').value,'mock');resolve(Response.json({ok:true}));await done;assert.equal(f.get('memberPassword').value,'');}],
 ['logout POST carries no credential or member data',async f=>{f.setResponse((_p,o)=>o.method==='POST'?Response.json({ok:true}):anonymous());await f.logout();assert.deepEqual(JSON.parse(f.calls.find(c=>c[1].method==='POST')[1].body),{action:'logout'});}],
 ['rejected logout keeps prior confirmed member and does not emit logout',async f=>{f.setResponse(()=>Response.json({error:'not done'},{status:500}));await f.logout();assert.equal(f.authState.memberId,'fixture-member');assert.ok(!f.kinds().includes('asaf:logout'));}],
 ['failed logout network shows retry message without a second request',async f=>{const start=f.calls.length;f.setResponse(()=>{throw Error('offline')});await f.logout();assert.equal(f.calls.length,start+1);assert.match(f.get('memberStatus').textContent,/נסה שוב/);}],
 ['hidden page visibility does not request auth status',async f=>{const start=f.calls.length;f.document.hidden=true;f.document.listeners.visibilitychange();await tick();assert.equal(f.calls.length,start);}],
 ['becoming visible refreshes auth with no cached response',async f=>{const start=f.calls.length;f.document.listeners.visibilitychange();await tick();assert.equal(f.calls.length,start+1);assert.equal(f.calls.at(-1)[1].cache,'no-store');}],
 ['disabled auth hides both sign-in and sign-out',async f=>{f.setResponse(()=>Response.json({enabled:false,authenticated:false}));await f.refreshAuth();assert.equal(f.get('memberLogin').hidden,true);assert.equal(f.get('memberLogout').hidden,true);}],
 ['anonymous confirmed auth shows login and hides legacy-code removal',async f=>{f.setResponse(anonymous);await f.refreshAuth();assert.equal(f.get('memberLogin').hidden,false);assert.equal(f.get('freeAiCode').hidden,false);assert.equal(f.get('forgetFreeAiCode').hidden,true);}],
 ['invalid successful status with numeric identity fails closed',async f=>{f.setResponse(()=>Response.json({enabled:true,authenticated:true,memberId:12}));await f.refreshAuth();assert.equal(f.authState.authenticated,false);assert.equal(f.authState.checkAvailable,false);}],
 ['status explicitly disabled cannot simultaneously authenticate a member',async f=>{f.setResponse(()=>Response.json({enabled:false,authenticated:true,memberId:'fixture-member'}));await f.refreshAuth();assert.equal(f.authState.checkAvailable,false);}],
 ['auth event detail is a detached snapshot',async f=>{const snapshot=f.events.at(-1).detail;snapshot.memberId='local-edit';assert.equal(f.authState.memberId,'fixture-member');}],
 ['pending ordinary auth checks join one transport round trip',async f=>{let resolve;f.setResponse(()=>new Promise(r=>{resolve=r}));const start=f.calls.length;const a=f.refreshAuth(),b=f.refreshAuth();assert.equal(f.calls.length,start+1);resolve(member());await Promise.all([a,b]);}],
];
for(const [label,run] of authCases)test('journey auth: '+label,async()=>{const f=authFixture();await f.refreshAuth();await run(f)});

const start=Date.parse('2026-11-19T11:00:00Z'),end=start+WEEK,trial={trialStartedAt:start,trialEndsAt:end,trialTotalCredits:55},paid={creditAnchor:start,paidUntil:start+4*WEEK,planId:'starter'};
const creditCases=[
 ['trial unavailable one millisecond before activation',()=>assert.equal(creditWindow(trial,start-1),null)],
 ['new trial fixed window and not local-midnight reset',()=>assert.deepEqual(creditWindow(trial,start+86400000),{key:'trial-total:'+start,limit:55,startsAt:start,resetsAt:end,planId:'trial'})],
 ['trial valid up to last millisecond',()=>assert.equal(creditWindow(trial,end-1).limit,55)],
 ['expired trial exact cutoff returns no entitlement',()=>assert.equal(creditWindow(trial,end),null)],
 ['zero explicit grant is not converted to a historical default',()=>assert.equal(creditWindow({...trial,trialTotalCredits:0},start).limit,0)],
 ['complimentary extension requires a valid original trial duration',()=>assert.equal(creditWindow({...trial,trialEndsAt:start+2*86400000,complimentaryUntil:start+3*WEEK},start),null)],
 ['paid period rolls at exact seven-day boundary',()=>assert.deepEqual(creditWindow(paid,end),{key:'paid:'+start+':1',limit:150,startsAt:end,resetsAt:end+WEEK,planId:'starter'})],
 ['paid expiration ends a partial weekly period',()=>assert.equal(creditWindow({...paid,paidUntil:start+1000},start).resetsAt,start+1000)],
 ['expired paid period does not override unexpired independent trial',()=>assert.equal(creditWindow({...trial,...paid,paidUntil:start+1000},start+1000).planId,'trial')],
 ['unused bonus does not spill beyond paid expiration',()=>assert.equal(creditWindow({...paid,bonusUntil:end,paidUntil:start+10},start).resetsAt,start+10)],
 ['future paid anchor invalid even when billing record says active',()=>assert.throws(()=>creditWindow({...paid,creditAnchor:start+1},start),/anchor/)],
 ['reserved deployment plans reject a malformed provider ID',()=>assert.equal(creditPlansReady(Object.fromEntries(Object.keys(PLANS).map((k,i)=>['PAYPAL_PLAN_'+k.toUpperCase()+'_ID',i===0?'p-LOW':'P-ID'+i]))),false)],
 ['unexpected plan field is not converted into a configured plan',()=>assert.throws(()=>planFor('enterprise'),/Unknown plan/)],
 ['tier consent carries preserved cents-free monthly USD contract',()=>assert.equal(consentFor('premium'),'USD359_MONTHLY_WEEKLY_V1')],
 ['zero estimated cost still uses minimum one credit',()=>assert.equal(creditsForCost(0),1)],
];
for(const [label,run] of creditCases)test('journey credits: '+label,run);

const day='2026-11-19',row=(id='fixture',extra={})=>({id,symbol:'TEST',date:day,side:'long',entry:100,exit:120,qty:3,fees:2,setup:'',quality:'',note:'',...extra});
const enc=(data,section='journal')=>JSON.stringify(personalBackup(section,data));
const file=(text,size=Buffer.byteLength(text))=>({size,text:async()=>text});
const rest=(options={})=>({file:file(enc([row('imported')])),section:'journal',read:()=>[row('local')],getMember:()=>'qa',confirm:()=>true,...options});
const journalCases=[
 ['long P&L subtracts fees at close',()=>assert.equal(tradeProfit(row()),58)],
 ['short loss charges fees on top of price movement',()=>assert.equal(tradeProfit(row('s',{side:'short'})),-62)],
 ['open trade ignores stored fees until closing',()=>assert.equal(tradeProfit(row('o',{exit:null,fees:999})),null)],
 ['impossible calendar date is not normalized and silently accepted',()=>assert.throws(()=>personalData('journal',[row('d',{date:'2026-02-29'})]))],
 ['real leap day remains exact after export and import',()=>assert.equal(parsePersonalBackup(enc([row('d',{date:'2028-02-29'})]),'journal')[0].date,'2028-02-29')],
 ['zero quantity prevents invalid imported trades',()=>assert.throws(()=>personalData('journal',[row('d',{qty:0})]))],
 ['negative commissions are rejected',()=>assert.throws(()=>personalData('journal',[row('d',{fees:-1})]))],
 ['backup ignores extra columns not in journal record contract',()=>assert.equal('unexpected' in parsePersonalBackup(enc([row('d',{unexpected:'local fixture'})]),'journal')[0],false)],
 ['backup version mismatch is refused before record normalization',()=>assert.throws(()=>parsePersonalBackup(JSON.stringify({...personalBackup('journal',[row()]),version:2}),'journal'))],
 ['oversize file is refused without reading it or asking to confirm',async()=>{let read=false,confirm=false;await assert.rejects(prepareFileRestore(rest({file:{size:750001,text(){read=true}},confirm(){confirm=true}})));assert.equal(read,false);assert.equal(confirm,false);}],
 ['file content that rejects during read preserves original failure and skips confirm',async()=>{await assert.rejects(prepareFileRestore(rest({file:{size:42,text:async()=>{throw Error('read failure')}},confirm(){assert.fail('unexpected confirm')}})),/read failure/);}],
 ['account change during confirmation still invalidates the file plan',async()=>{let m='qa';await assert.rejects(prepareFileRestore(rest({getMember:()=>m,confirm(){m='other';return true}})));}],
 ['new local edit during confirmation is never overwritten',async()=>{let rows=[row('local')];await assert.rejects(prepareFileRestore(rest({read:()=>rows,confirm(){rows=[row('local',{note:'new edit'})];return true}})));assert.equal(rows[0].note,'new edit');}],
 ['merged record overflow refuses plan rather than dropping oldest trades',()=>{const local=Array.from({length:300},(_,i)=>row('local'+i));assert.throws(()=>preparePersonalRestore('journal',local,enc([row('remote')])));assert.equal(local.length,300);}],
 ['session-independent manual plan preserves empty archive after valid restore',()=>{const text=enc([]);const plan=preparePersonalRestore('journal',[],text);assert.deepEqual(completePersonalRestore(plan,'journal',[],text),[]);}],
];
for(const [label,run] of journalCases)test('journey journal: '+label,run);

function installFixture({offline=false,insecure=false,deferWorker=false,navExtra=null,standalone=false}={}){
 const f=fixture();f.document.getElementById=id=>[...f.header.children,...f.body.children].find(e=>e.id===id)||null;const registrations=[];let worker;
 const navigator={userAgent:'Fixture Browser',onLine:!offline,serviceWorker:{register(...x){registrations.push(x);return deferWorker?new Promise(r=>worker=r):Promise.resolve({})}},...navExtra};
 f.window.isSecureContext=!insecure;let mode=standalone;
 const media={get matches(){return mode},addEventListener(k,f){this[k]=f}};
 f.window.matchMedia=()=>media;
 const ui=mountAppInstall({window:f.window,document:f.document,navigator});
 return {...f,navigator,registrations,ui,workerDone:()=>worker({}),changeMode(v){mode=v;media.change?.()},prompt(o){f.window.handlers.beforeinstallprompt({preventDefault(){},...o})}};
}
function swFixture({cachesAvailable=true,network=true,code=200,cacheKeys=[]}={}){
 const handlers={},calls=[],deletions=[];const offline=new Response('mock offline',{status:200});
 const self={location:{origin:'https://fixture.invalid'},addEventListener(k,f){handlers[k]=f},clients:{claim:async()=>calls.push('claim')}};
 const caches={open:async cache=>({async add(path){calls.push(cache+path)},async match(path){calls.push(path);return cachesAvailable?offline:null}}),keys:async()=>cacheKeys,delete:async k=>deletions.push(k)};
 vm.runInNewContext(sources['sw.js'],{self,caches,URL,Response,fetch:async req=>{calls.push(req.url);if(!network)throw Error('offline');return new Response('online',{status:code})}});
 return {calls,deletions,handler(k){let result;handlers[k]({waitUntil:p=>result=p});return result},request(path,{method='GET',mode='navigate'}={}){let result;handlers.fetch({request:{url:new URL(path,self.location.origin).href,method,mode},respondWith:p=>result=p});return result}};
}
const installCases=[
 ['offline banner is shown at first render without an event',()=>assert.equal(installFixture({offline:true}).ui.offline.hidden,false)],
 ['insecure page does not try service-worker installation',()=>assert.equal(installFixture({insecure:true}).registrations.length,0)],
 ['media transition into standalone mode hides site installer',()=>{const f=installFixture();f.changeMode(true);assert.equal(f.ui.button.hidden,true);f.changeMode(false);assert.equal(f.ui.button.hidden,false);}],
 ['failed browser prompt can recover with a newly delivered event',async()=>{const f=installFixture();await tick();f.prompt({prompt:async()=>{throw Error('denied')}});await f.ui.promptButton.listeners.click();assert.match(f.ui.status.textContent,/לא השלים/);f.prompt({prompt:async()=>{},userChoice:Promise.resolve({outcome:'accepted'})});await f.ui.promptButton.listeners.click();assert.equal(f.ui.button.hidden,true);}],
 ['concurrent clicks never call native browser installation twice',async()=>{const f=installFixture();let out,n=0;f.prompt({prompt:async()=>{n++},userChoice:new Promise(r=>out=r)});const first=f.ui.promptButton.listeners.click();await f.ui.promptButton.listeners.click();out({outcome:'dismissed'});await first;assert.equal(n,1);}],
 ['install result is not overwritten by deferred worker registration',async()=>{const f=installFixture({deferWorker:true});f.ui.button.listeners.click();f.prompt({prompt:async()=>{},userChoice:Promise.resolve({outcome:'accepted'})});await f.ui.promptButton.listeners.click();f.workerDone();await tick();assert.match(f.ui.status.textContent,/אושרה/);}],
 ['missing cached offline page returns explicit status without caching',async()=>{const f=swFixture({network:false,cachesAvailable:false});const r=await f.request('/help');assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');}],
 ['worker never intercepts navigation with a Google-style callback query',()=>assert.equal(swFixture().request('/?code=fixture'),undefined)],
 ['worker ignores static subresource requests even on a public path',()=>assert.equal(swFixture().request('/index.html',{mode:'cors'}),undefined)],
 ['worker ignores POST navigations on public paths',()=>assert.equal(swFixture().request('/help',{method:'POST'}),undefined)],
 ['server HTTP failures are not misreported as offline',async()=>{const f=swFixture({code:503});const r=await f.request('/terms');assert.equal(await r.text(),'online');assert.equal(f.calls.length,1);}],
 ['old offline caches are pruned without removing unrelated caches',async()=>{const f=swFixture({cacheKeys:['asaf-offline-previous','app-user-fixture','asaf-offline-v1']});await f.handler('activate');assert.deepEqual(f.deletions,['asaf-offline-previous']);assert.deepEqual(f.calls,['claim']);}],
];
for(const [label,run] of installCases)test('journey install & offline: '+label,run);

function accessFixture({raw,writeFails=false}={}){
 const f=fixture();const writes=[];const localStorage={getItem:()=>raw,setItem(k,v){if(writeFails)throw Error('unavailable');writes.push([k,JSON.parse(v)])}};
 vm.runInNewContext(sources['accessibility.mjs'].replace(/export /g,''),{document:f.document,localStorage});
 const dialog=f.body.children[0],controls=dialog.querySelectorAll('[data-preference]');
 return {...f,dialog,controls,writes,toggle(key,v){const c=controls.find(e=>e.dataset.preference===key);c.checked=v;c.listeners.change();}};
}
const accessibilityCases=[
 ['saved valid preferences are applied to shell before any modal opens',()=>{const f=accessFixture({raw:'{"contrast":true,"disableShortcuts":true}'});assert.equal(f.document.documentElement.dataset.contrast,'true');assert.equal(f.document.documentElement.dataset.disableShortcuts,'true');assert.equal(f.dialog.open,undefined);}],
 ['bad stored JSON still leaves accessibility controls reachable',()=>{const f=accessFixture({raw:'{bad'});f.opener.listeners.click();assert.equal(f.dialog.open,true);assert.equal(f.document.documentElement.dataset.largeText,'false');}],
 ['large text persists independently from reduced motion',()=>{const f=accessFixture();f.toggle('largeText',true);assert.equal(f.writes.at(-1)[0],'asaf-accessibility-v1');assert.equal(f.writes.at(-1)[1].largeText,true);assert.equal(f.document.documentElement.dataset.reduceMotion,'false');}],
 ['blocked preference storage still changes current visit',()=>{const f=accessFixture({writeFails:true});f.toggle('underline',true);assert.equal(f.document.documentElement.dataset.underline,'true');assert.match(f.dialog.querySelector('[role="status"]').textContent,/לביקור הנוכחי/);}],
 ['reset clears controls, dataset and persisted state together',()=>{const f=accessFixture({raw:'{"contrast":true,"largeText":true}'});f.dialog.querySelector('#resetAccessibility').listeners.click();assert.ok(f.controls.every(c=>!c.checked));assert.ok(Object.values(f.document.documentElement.dataset).every(v=>v==='false'));assert.ok(Object.values(f.writes.at(-1)[1]).every(v=>v===false));}],
 ['closing footer-triggered dialog gives keyboard focus back to footer',()=>{const f=accessFixture();f.footer.listeners.click();assert.equal(f.document.activeElement,f.dialog.querySelector('.accessibility-close'));f.dialog.close();assert.equal(f.document.activeElement,f.footer);}],
 ['skip main targets focus and avoids animated scroll',()=>{const f=accessFixture();let prevented=false;f.mainLink.listeners.click({preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(f.document.activeElement,f.get('mainContent'));assert.equal(f.document.activeElement.scroll.behavior,'instant');}],
 ['skip chat selects chat and transfers keyboard to the composer',()=>{const f=accessFixture();f.chatLink.listeners.click({preventDefault(){}});assert.equal(f.chatTab.clicked,true);assert.equal(f.document.activeElement,f.get('chatInput'));assert.equal(f.document.activeElement.scroll.block,'center');}],
];
for(const [label,run] of accessibilityCases)test('journey accessibility: '+label,run);
