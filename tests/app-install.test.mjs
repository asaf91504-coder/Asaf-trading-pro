import test from 'node:test';
import assert from 'node:assert/strict';
import {isAppleMobile,appDisplayMode,mountAppInstall} from '../app-install.mjs';

function fixture({apple=false,standalone=false,registerError=false,native=true,ready='complete'}={}){
 const handlers={},registrations=[],elements=[];
 const doc={readyState:ready,activeElement:null,getElementById:id=>elements.find(node=>node.id===id),createElement(tag){
  const events={},attributes={};const node={tagName:tag,children:[],hidden:false,disabled:false,events,append(...nodes){this.children.push(...nodes)},setAttribute(name,value){attributes[name]=value},removeAttribute(name){delete attributes[name]},hasAttribute(name){return Object.hasOwn(attributes,name)},addEventListener(name,callback){events[name]=callback},focus(){doc.activeElement=this},querySelectorAll(){return this.children.flatMap(child=>child.tagName==='div'?child.children:[child]).filter(child=>['button','a'].includes(child.tagName))}};
  if(tag==='dialog'&&native){node.showModal=()=>{attributes.open=''};node.close=()=>{delete attributes.open;events.close?.()}}
  elements.push(node);return node;
 },querySelector(){return header}};
 const header=doc.createElement('header');doc.body=doc.createElement('body');
 const nav={userAgent:apple?'iPhone':'Android',platform:apple?'iPhone':'Linux',onLine:true,serviceWorker:{async register(...args){registrations.push(args);if(registerError)throw Error('unavailable');return {}}}};
 const win={isSecureContext:true,matchMedia:()=>({matches:standalone,addEventListener(){}}),addEventListener(name,callback){handlers[name]=callback}};
 const ui=mountAppInstall({window:win,document:doc,navigator:nav});
 return {doc,nav,win,ui,handlers,registrations,async settle(){await new Promise(resolve=>setImmediate(resolve))}};
}

test('Apple mobile and standalone detection include iPad desktop mode without misclassifying desktop Mac',()=>{
 assert.equal(isAppleMobile({userAgent:'iPad'}),true);assert.equal(isAppleMobile({platform:'MacIntel',maxTouchPoints:5}),true);assert.equal(isAppleMobile({platform:'MacIntel',maxTouchPoints:0}),false);
 assert.equal(appDisplayMode({}, {standalone:true}),true);assert.equal(appDisplayMode({matchMedia:()=>({matches:true})}),true);assert.equal(appDisplayMode({}),false);
});
test('install prompt never runs on capture/open; only explicit install click, and cannot be replayed',async()=>{
 const f=fixture();let prompts=0,prevented=0;
 f.handlers.beforeinstallprompt({preventDefault(){prevented++},async prompt(){prompts++},userChoice:Promise.resolve({outcome:'dismissed'})});assert.equal(prompts,0);assert.equal(prevented,1);
 f.ui.button.events.click();assert.equal(prompts,0);assert.equal(f.ui.promptButton.hidden,false);assert.equal(f.ui.dialog.hasAttribute('open'),true);
 await f.ui.promptButton.events.click();assert.equal(prompts,1);assert.equal(f.ui.promptButton.hidden,true);assert.match(f.ui.status.textContent,/נסגרה/);
 await f.ui.promptButton.events.click();assert.equal(prompts,1);
});
test('accepted/appinstalled states hide installation affordance without reload or account access',async()=>{
 const f=fixture();f.handlers.beforeinstallprompt({preventDefault(){},async prompt(){},userChoice:Promise.resolve({outcome:'accepted'})});await f.ui.promptButton.events.click();assert.equal(f.ui.button.hidden,true);assert.match(f.ui.status.textContent,/אושרה/);
 const other=fixture();other.ui.button.events.click();other.handlers.appinstalled();assert.equal(other.ui.button.hidden,true);assert.equal(other.ui.dialog.hasAttribute('open'),false);
 assert.equal(fixture({standalone:true}).ui.button.hidden,true);
});
test('iPhone instructions use manual share flow and network status is truthful',()=>{
 const f=fixture({apple:true});f.ui.button.events.click();const text=f.ui.dialog.children.map(n=>n.textContent||'').join(' ');assert.match(text,/Safari/);assert.match(text,/הוסף למסך הבית/);assert.match(text,/דורשים חיבור לאינטרנט/);assert.equal(f.ui.promptButton.hidden,true);
 f.nav.onLine=false;f.handlers.offline();assert.equal(f.ui.offline.hidden,false);f.nav.onLine=true;f.handlers.online();assert.equal(f.ui.offline.hidden,true);
});
test('worker registers after load with own scope/no stale worker script caching and fails softly',async()=>{
 const f=fixture({ready:'loading',registerError:true});assert.equal(f.registrations.length,0);await f.handlers.load();assert.deepEqual(f.registrations,[['/sw.js',{scope:'/',updateViaCache:'none'}]]);
 f.ui.button.events.click();assert.match(f.ui.status.textContent,/אינו זמין/);assert.equal(f.ui.button.hidden,false);
});
test('fallback dialog has Escape, keyboard trap and returns focus to install button',()=>{
 const f=fixture({native:false});f.ui.button.events.click();assert.equal(f.doc.activeElement.tagName,'button');assert.equal(f.ui.dialog.hasAttribute('open'),true);
 let prevented=0;f.ui.dialog.events.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented++}});assert.equal(prevented,1);assert.equal(f.doc.activeElement.tagName,'a');
 f.ui.dialog.events.keydown({key:'Escape',preventDefault(){prevented++}});assert.equal(f.ui.dialog.hasAttribute('open'),false);assert.equal(f.doc.activeElement,f.ui.button);
});
