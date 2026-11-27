import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accessibleResearchLevels,createVentureChartView} from '../venture-chart-view.mjs';

test('subscription has a first keyboard bypass link and a focusable target',()=>{
 const html=readFileSync(new URL('../subscription.html',import.meta.url),'utf8');
 assert.match(html,/<body[^>]*><nav class="skip-links"[^>]*><a href="#mainContent">/);
 assert.match(html,/<main id="mainContent" tabindex="-1">/);
});
test('chart text equivalent accepts only bounded, positive derived horizontal research levels',()=>{
 const levels=accessibleResearchLevels([
  {kind:'support',price:123.45,bars:[1],points:[{date:'secret'}]},
  {kind:'support',price:123.45},{kind:'resistance',price:150},
  {kind:'entry',price:140},{kind:'stop',price:120},{kind:'target',price:170},
  {kind:'close',price:140},{kind:'trendline',price:140},{kind:'support',price:NaN},
  {kind:'support',price:Infinity},{kind:'support',price:-1},{kind:'support',price:'123'},null
 ]);
 assert.deepEqual(levels,[{kind:'support',price:123.45},{kind:'resistance',price:150},{kind:'entry',price:140},{kind:'stop',price:120},{kind:'target',price:170}]);
 assert.equal(accessibleResearchLevels(Array.from({length:30},(_,price)=>({kind:'support',price:price+1}))).length,12);
 assert.deepEqual(accessibleResearchLevels(null),[]);
});
test('normal and fullscreen raster images describe semantic level lists, refreshed per symbol',()=>{
 const nodes=[];
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.style={setProperty(){}};nodes.push(this)}
  append(...children){this.children.push(...children)}
  after(){}
  replaceChildren(...children){this.children=children}
  setAttribute(name,value){this.attributes[name]=value}
  removeAttribute(name){delete this.attributes[name]}
  showModal(){this.open=true}
  close(){this.open=false}
 }
 const previousDocument=globalThis.document,previousWindow=globalThis.window;
 try{
  const panel=new Node('section'),empty=new Node('div');
  globalThis.document={documentElement:{lang:'he'},body:new Node('body'),createElement:tag=>new Node(tag),getElementById:id=>id==='localChartPanel'?panel:empty};
  globalThis.window={addEventListener(){}};
  const view=createVentureChartView({clear(){}});
  const snapshot={presentation:'server-raster',image:'data:image/png;base64,AAAA',symbol:'AAPL',interval:'1day',latestBarTime:'2026-11-25',accessibleLevels:[{kind:'support',price:123.45}]};
  view.setSnapshot(snapshot);
  const lists=nodes.filter(node=>node.tag==='dl'),images=nodes.filter(node=>node.tag==='img');
  assert.equal(lists.length,2);
  for(let i=0;i<2;i++){
   assert.equal(images[i].attributes['aria-describedby'],lists[i].id);
   assert.deepEqual(lists[i].children.map(node=>[node.tag,node.textContent]),[['dt','תמיכה'],['dd','123.45']]);
  }
  view.setSnapshot({...snapshot,symbol:'NVDA',accessibleLevels:[]});
  for(const list of lists){assert.equal(list.children.length,0);assert.equal(list.hidden,true)}
 }finally{globalThis.document=previousDocument;globalThis.window=previousWindow}
});
