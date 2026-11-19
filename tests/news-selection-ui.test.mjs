import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {filterCachedNews} from '../news-search.mjs';
import {normalizeSymbol} from '../workspace-core.mjs';
const source=readFileSync(new URL('../workspace-tools.mjs',import.meta.url),'utf8');
function fixture({responses=[]}={}){
 const nodes=new Map();let requests=0,now=Date.parse('2026-11-10T08:00:00Z'),timer,interval;
 class FakeDate extends Date{static now(){return now}}
 function element(){const events={};return {children:[],value:'',checked:false,textContent:'',append(...items){this.children.push(...items)},before(){},replaceChildren(){this.children=[]},setAttribute(){},addEventListener(type,fn){(events[type]??=[]).push(fn)},emit(type){return Promise.all((events[type]||[]).map(fn=>fn()))}}}
 const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 const tab=element(),doc=element();tab.active=true;tab.getAttribute=()=>String(tab.active);doc.hidden=false;$('symbol').value='NASDAQ:AAPL';$('newsForSymbol').checked=true;
 const ctx={$,normalizeSymbol,filterCachedNews,document:Object.assign(doc,{createElement:element,querySelector:()=>tab}),window:{dispatchEvent(){}},URL,AbortSignal,Date:FakeDate,setTimeout:(fn,ms)=>{timer=fn;interval=ms;return 1},clearTimeout:()=>{timer=null},location:{href:'https://example.test/'},fetch:async()=>{const next=responses[requests++];if(next)return next;return {ok:true,json:async()=>({enabled:true,updatedAt:'2026-11-10T08:00:00Z',articles:[{id:'apple',title:'Apple headline',url:'https://example.test/apple',symbols:['AAPL'],source:'Test',publishedAt:'2026-11-10T07:00:00Z'},{id:'nvidia',title:'Nvidia headline',url:'https://example.test/nvidia',symbols:['NVDA'],source:'Test',publishedAt:'2026-11-10T07:00:00Z'}]})}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('let newsLoaded='),source.indexOf('// Explicit account copies:')),ctx);
 return {ctx,$,tab,doc,advance:ms=>{now+=ms},tick:()=>{const due=timer;timer=null;return due?.()},delay:()=>interval,requests:()=>requests,titles:()=> $('newsFeed').children.map(card=>card.children[0]?.textContent)};
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

test('open news refreshes on the scheduled 15-minute tick',async()=>{
 const s=fixture();await s.ctx.loadNews();assert.equal(s.delay(),900000);
 s.advance(900000);await s.tick();assert.equal(s.requests(),2);
});
test('automatic refresh skips hidden documents',async()=>{
 const s=fixture();await s.ctx.loadNews();s.doc.hidden=true;
 s.advance(900000);await s.tick();assert.equal(s.requests(),1);
});
test('automatic refresh skips other workspace tabs',async()=>{
 const s=fixture();await s.ctx.loadNews();s.tab.active=false;
 s.advance(900000);await s.tick();assert.equal(s.requests(),1);
});
test('returning to visible news after 15 minutes refreshes immediately',async()=>{
 const s=fixture();await s.ctx.loadNews();s.doc.hidden=true;
 s.advance(900000);await s.tick();s.doc.hidden=false;await s.doc.emit('visibilitychange');assert.equal(s.requests(),2);
});
test('returning before a full interval does not duplicate a fresh request',async()=>{
 const s=fixture();await s.ctx.loadNews();s.advance(899999);
 await s.doc.emit('visibilitychange');assert.equal(s.requests(),1);
});
test('reopening the news workspace tab after 15 minutes refreshes immediately',async()=>{
 const s=fixture();await s.ctx.loadNews();s.tab.active=false;
 s.advance(900000);await s.tick();s.tab.active=true;await s.tab.emit('click');assert.equal(s.requests(),2);
});
test('manual Retry remains immediate and ignores the automatic cooldown',async()=>{
 const s=fixture({responses:[{ok:false}]});await s.ctx.loadNews();
 assert.match(s.$('newsFeedStatus').textContent,/לא ניתן/);await s.$('newsRefresh').onclick();assert.equal(s.requests(),2);
});
test('concurrent automatic and manual refresh do not duplicate an in-flight request',async()=>{
 let unblock;const s=fixture({responses:[new Promise(resolve=>{unblock=resolve})]});const initial=s.ctx.loadNews();s.advance(900000);
 await s.tick();await s.doc.emit('visibilitychange');await s.$('newsRefresh').onclick();assert.equal(s.requests(),1);
 unblock({ok:false});await initial;assert.equal(s.$('newsRefresh').disabled,false);
});
test('another quarterly refresh can replace the prior headlines',async()=>{
 const updated={ok:true,json:async()=>({enabled:true,updatedAt:'2026-11-10T08:15:00Z',articles:[{id:'new',title:'New Apple headline',url:'https://example.test/new',symbols:['AAPL'],source:'Test',publishedAt:'2026-11-10T08:14:00Z'}]})};
 const s=fixture({responses:[Promise.resolve(null).then(()=>({ok:true,json:async()=>({enabled:true,articles:[]})})),updated]});
 await s.ctx.loadNews();s.advance(900000);await s.tick();assert.deepEqual(s.titles(),['New Apple headline']);
});
test('stale feed is displayed as stale instead of claiming a valid fresh update',async()=>{
 const s=fixture({responses:[{ok:true,json:async()=>({enabled:true,articles:[],stale:true})}]});
 await s.ctx.loadNews();assert.match(s.$('newsFeedStatus').textContent,/אין עדכון תקין.*המידע ישן/);
});

test('manual refresh resets the next due time rather than waiting for the page-load clock',async()=>{
 const s=fixture();await s.ctx.loadNews();s.advance(894000);await s.$('newsRefresh').onclick();
 assert.equal(s.delay(),900000);s.advance(6000);await s.doc.emit('visibilitychange');assert.equal(s.requests(),2);
 s.advance(894000);await s.tick();assert.equal(s.requests(),3);
});
