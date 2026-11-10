import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {filterCachedNews} from '../news-search.mjs';
import {normalizeSymbol} from '../workspace-core.mjs';
const source=readFileSync(new URL('../workspace-tools.mjs',import.meta.url),'utf8');
function fixture(){
 const nodes=new Map();let requests=0;
 function element(){const events={};return {children:[],value:'',checked:false,textContent:'',append(...items){this.children.push(...items)},before(){},replaceChildren(){this.children=[]},setAttribute(){},addEventListener(type,fn){(events[type]??=[]).push(fn)},emit(type){for(const fn of events[type]||[])fn()}}}
 const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 const tab=element();$('symbol').value='NASDAQ:AAPL';$('newsForSymbol').checked=true;
 const ctx={$,normalizeSymbol,filterCachedNews,document:{createElement:element,querySelector:()=>tab},window:{dispatchEvent(){}},URL,AbortSignal,location:{href:'https://example.test/'},fetch:async()=>{requests++;return {ok:true,json:async()=>({enabled:true,updatedAt:'2026-11-10T08:00:00Z',articles:[{id:'apple',title:'Apple headline',url:'https://example.test/apple',symbols:['AAPL'],source:'Test',publishedAt:'2026-11-10T07:00:00Z'},{id:'nvidia',title:'Nvidia headline',url:'https://example.test/nvidia',symbols:['NVDA'],source:'Test',publishedAt:'2026-11-10T07:00:00Z'}]})}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('let newsLoaded='),source.indexOf('// Explicit account copies:')),ctx);
 return {ctx,$,tab,requests:()=>requests,titles:()=> $('newsFeed').children.map(card=>card.children[0]?.textContent)};
}
test('changing the selected stock immediately refilters cached headlines without another request',async()=>{
 const s=fixture();await s.ctx.loadNews();assert.deepEqual(s.titles(),['Apple headline']);
 s.$('symbol').value='NASDAQ:NVDA';s.$('symbol').emit('input');assert.deepEqual(s.titles(),['Nvidia headline']);assert.equal(s.requests(),1);
 s.$('symbol').value='NASDAQ:MSFT';s.$('symbol').emit('input');assert.match(s.$('newsFeed').children[0].textContent,/MSFT/);assert.equal(s.requests(),1);
});
test('reopening news reconciles the active selection and preserves the text filter',async()=>{
 const s=fixture();await s.ctx.loadNews();s.$('symbol').value='NASDAQ:NVDA';s.tab.emit('click');assert.deepEqual(s.titles(),['Nvidia headline']);
 vm.runInContext("newsSearch.value='Apple';newsSearch.oninput()",s.ctx);s.tab.emit('click');assert.match(s.$('newsFeed').children[0].textContent,/לא נמצאו/);assert.equal(s.requests(),1);
});
