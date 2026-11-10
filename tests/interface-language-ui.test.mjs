import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as language from '../interface-language.mjs';
const source=readFileSync(new URL('../interface-language-ui.mjs',import.meta.url),'utf8').replace(/^import .*;\n/,'');
function fixture(){
 class Node{
  constructor(tag,text){this.tagName=tag;this.nodeType=tag?1:3;this.nodeValue=text;this.childNodes=[];this.attributes={};this.handlers={};this.value=''}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.childNodes.push(node)}}
  set textContent(text){this.childNodes=[];this.append(new Node(null,text))}get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(n=>n.textContent).join('')}
  set translate(value){this.setAttribute('translate',value===false?'no':'yes')}
  setAttribute(k,v){this.attributes[k]=v}getAttribute(k){return this.attributes[k]}hasAttribute(k){return Object.hasOwn(this.attributes,k)}
  addEventListener(k,fn){this.handlers[k]=fn}
  closest(){for(let n=this;n;n=n.parentElement)if(n.attributes?.translate==='no'||['script','style'].includes(n.tagName)||n.className==='bubble user')return n;return null}
 }
 const body=new Node('body'),header=new Node('header'),nav=new Node('button'),input=new Node('textarea'),user=new Node('p');nav.textContent='חדשות';input.value='My NVDA draft';input.setAttribute('placeholder','כתוב כאן');user.className='bubble user';user.textContent='חדשות NVDA';body.append(header,nav,input,user);
 let observer,fail=false,blocked=false;const memory=new Map(),events=[],storage={getItem:k=>memory.get(k),setItem:(k,v)=>{if(blocked)throw Error('quota');memory.set(k,v)}};
 const ctx={...language,AbortSignal,Event,CustomEvent:class extends Event{constructor(t,o){super(t);this.detail=o.detail}},document:{body,documentElement:{lang:'he',dir:'rtl'},createElement:tag=>new Node(tag),querySelector:()=>header},window:{localStorage:storage,confirm:()=>true,prompt:()=>'',dispatchEvent:e=>events.push(e.type)},MutationObserver:class{constructor(callback){observer=callback}disconnect(){}observe(){}},fetch:async url=>{if(fail)throw Error('offline');return {ok:true,json:async()=>url.includes('/ar.')?{'חדשות':'أخبار','כתוב כאן':'اكتب هنا'}:{'חדשות':'News','כתוב כאן':'Write here'}}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,body,nav,input,user,Node,memory,events,observe:r=>observer(r),fail:()=>{fail=true},block:()=>{blocked=true}};
}
test('language switch updates existing and new UI, preserves drafts/user text and restores Hebrew',async()=>{
 const f=fixture();await f.ctx.applyLanguage('en');assert.equal(f.nav.textContent,'News');assert.equal(f.input.getAttribute('placeholder'),'Write here');assert.equal(f.input.value,'My NVDA draft');assert.equal(f.user.textContent,'חדשות NVDA');assert.equal(f.ctx.document.documentElement.dir,'ltr');assert.equal(f.memory.get('asaf_interface_language_v1'),'en');
 const later=new f.Node('button');later.textContent='חדשות';f.body.append(later);f.observe([{type:'childList',addedNodes:[later]}]);assert.equal(later.textContent,'News');
 await f.ctx.applyLanguage('ar');assert.equal(f.nav.textContent,'أخبار');assert.equal(f.ctx.document.documentElement.dir,'rtl');
 await f.ctx.applyLanguage('he');assert.equal(f.nav.textContent,'חדשות');assert.equal(later.textContent,'חדשות');assert.equal(f.input.getAttribute('placeholder'),'כתוב כאן');
});
test('failed locale fetch keeps working language and blocked persistence does not break selection',async()=>{
 const f=fixture();f.block();await f.ctx.applyLanguage('en');assert.equal(f.nav.textContent,'News');f.fail();await f.ctx.applyLanguage('ar');assert.equal(f.nav.textContent,'News');assert.equal(f.ctx.document.documentElement.lang,'en');
});
test('application text updates replace original translation source without observer loops',async()=>{
 const f=fixture();await f.ctx.applyLanguage('en');const text=f.nav.childNodes[0];f.observe([{type:'characterData',target:text}]);assert.equal(text.nodeValue,'News');text.nodeValue='NVDA 123.45';f.observe([{type:'characterData',target:text}]);await f.ctx.applyLanguage('he');assert.equal(f.nav.textContent,'NVDA 123.45');
});
