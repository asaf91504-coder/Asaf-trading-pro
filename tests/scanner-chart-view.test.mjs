import test from 'node:test';
import assert from 'node:assert/strict';
import {createVentureChartView} from '../venture-chart-view.mjs';
class Node{
 constructor(tag){this.tag=tag;this.children=[];this.hidden=false;this.open=false;this.style={setProperty:(k,v)=>{this.styles??={};this.styles[k]=v}};}
 append(...items){this.children.push(...items)}after(n){this.afterNode=n}setAttribute(k,v){this[k]=v}removeAttribute(k){delete this[k]}replaceChildren(...items){this.children=items}showModal(){this.open=true}close(){this.open=false}click(){this.onclick?.()}
}
function fixture(){
 const before={document:globalThis.document,window:globalThis.window},panel=new Node('panel'),empty=new Node('empty'),created=[],window=new EventTarget(),body=new Node('body'),calls=[];
 globalThis.window=window;globalThis.document={body,getElementById:id=>id==='localChartPanel'?panel:empty,createElement:tag=>{const n=new Node(tag);created.push(n);return n}};
 const local={clear:()=>calls.push('clear'),setData:(...a)=>calls.push(a),snapshot:()=>null,settings:()=>({}),redraw(){},clearAnnotations(){}};
 const view=createVentureChartView(local);
 return {view,created,panel,calls,window,restore:()=>Object.assign(globalThis,before)};
}
const image={presentation:'server-raster',symbol:'AMD',interval:'1day',latestBarTime:'2026-11-25',image:'data:image/png;base64,AAAA',scannerContext:{side:'short'},chartSettings:{indicators:['MA20','MA150']},indicatorLegend:[{id:'MA20',color:'#38bdf8',available:true},{id:'MA150',color:'#fbbf24',available:true}],researchLegend:[{kind:'support',color:'#a3e635'},{kind:'resistance',color:'#fbbf24'},{kind:'trendline',color:'#60a5fa'}]};
test('marked view has a truthful colored legend and a wide phone view that follows the chosen stock',()=>{
 const f=fixture();try{
  f.view.setSnapshot(image);const host=f.panel.afterNode,dialog=f.created.find(n=>n.tag==='dialog'),legend=host.children[3];
  assert.equal(host.hidden,false);assert.equal(f.panel.hidden,true);assert.deepEqual(legend.children.map(n=>n.textContent),['MA20','MA150','תמיכה','התנגדות','קווי המגמה']);
  assert.equal(legend.children[2].styles['--mark-color'],'#a3e635');
  host.children[0].children[1].click();assert.equal(dialog.open,true);assert.equal(dialog.children[2].children[0].src,image.image);
  f.view.setSnapshot({...image,symbol:'TSLA',image:'data:image/png;base64,BBBB'});assert.match(dialog.children[1].textContent,/TSLA/);assert.equal(dialog.children[2].children[0].src,'data:image/png;base64,BBBB');
  f.view.clear();assert.equal(host.hidden,true);assert.equal(dialog.open,false);assert.equal(dialog.children[2].children[0].src,undefined);
 }finally{f.restore()}
});
test('unidentified geometry is explained rather than adding invented marks',()=>{
 const f=fixture();try{f.view.setSnapshot({...image,researchLegend:[]});const host=f.panel.afterNode;assert.equal(host.children[3].children.length,2);assert.match(host.children[4].textContent,/לא זוהה קו מגמה/);assert.match(host.children[4].textContent,/לא זוהתה תבנית/);}finally{f.restore()}
});
test('language repaint and unsafe image rejection do not alter the chart snapshot',()=>{
 const f=fixture();try{
  f.view.setSnapshot(image);f.window.asafTranslate=s=>s==='תמיכה'?'Support':s;f.window.dispatchEvent(new Event('asaf:language'));assert.equal(f.panel.afterNode.children[3].children[2].textContent,'Support');
  assert.throws(()=>f.view.setSnapshot({...image,image:'javascript:alert(1)'}));assert.equal(f.view.snapshot(),image.image);
 }finally{f.restore()}
});
