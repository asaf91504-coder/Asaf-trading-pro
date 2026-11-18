import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../display-polish.mjs',import.meta.url),'utf8');
function fixture(){
 const handlers={},winHandlers={};
 class El{
  constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.open=false}
  append(...els){for(const el of els){if(el.parent)el.parent.children=el.parent.children.filter(x=>x!==el);el.parent=this;this.children.push(el)}}
  addEventListener(name,fn){this.handlers[name]=fn}
  contains(el){return el===this||this.children.some(x=>x.contains(el))}
  focus(){this.focused=true}
 }
 const header=new El('header'),language=new El('label'),data=new El('button');
 const selectors={'.interface-language-picker':language,'.terminal-data-button':data};
 header.append(language,data);header.querySelector=s=>selectors[s];
 const ctx={document:{querySelector:()=>header,createElement:t=>new El(t),getElementById:()=>null,addEventListener:(name,fn)=>handlers[name]=fn},window:{addEventListener:(name,fn)=>winHandlers[name]=fn}};
 vm.runInNewContext(source,ctx);
 const menu=header.children.find(x=>x.tag==='details');
 return {menu,summary:menu.children[0],content:menu.children[1],header,language,data,handlers,winHandlers};
}
test('language stays visible in header rather than moved into settings',()=>{const f=fixture();assert.equal(f.language.parent,f.header);assert.equal(f.data.parent,f.content)});
test('outside pointer closes settings, inside pointer does not',()=>{const f=fixture();f.menu.open=true;f.handlers.pointerdown({target:f.data});assert.equal(f.menu.open,true);f.handlers.pointerdown({target:f.language});assert.equal(f.menu.open,false)});
test('Escape closes settings and restores keyboard focus',()=>{const f=fixture();f.menu.open=true;let prevented=false;f.handlers.keydown({key:'Escape',preventDefault:()=>prevented=true});assert.equal(f.menu.open,false);assert.ok(f.summary.focused);assert.ok(prevented)});
test('tab and language switches dismiss stale settings',()=>{const f=fixture();for(const event of ['asaf:tab','asaf:language']){f.menu.open=true;f.winHandlers[event]();assert.equal(f.menu.open,false)}});
test('menu actions close menu, repeated closing is safe',()=>{const f=fixture();f.menu.open=true;f.content.handlers.click({target:{closest:()=>f.data}});assert.equal(f.menu.open,false);f.winHandlers['asaf:tab']();assert.equal(f.menu.open,false)});
test('mobile layout uses flow settings and natural chat scroll, not an offscreen absolute menu',()=>{const css=readFileSync(new URL('../display-polish.css',import.meta.url),'utf8');assert.match(css,/\.display-settings-content\{position:static;inset:auto;width:100%;max-width:100%/);assert.match(css,/#chatLog\{height:auto;max-height:none;min-height:0;overflow:visible/);assert.match(css,/header>\.interface-language-picker\{grid-column:1\/-1;grid-row:2/)});
