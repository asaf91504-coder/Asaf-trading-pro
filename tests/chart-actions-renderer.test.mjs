import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChartRenderActions,initLocalChart} from '../local-chart.mjs';
const bars=Array.from({length:70},(_,index)=>({date:new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10),open:100+index,high:103+index,low:98+index,close:101+index,volume:1000+index}));
const annotation={kind:'support',label:'תמיכה אפשרית',points:[{date:bars[0].date,price:100},{date:bars.at(-1).date,price:100}]};

test('renderer accepts only declarative allowlisted actions and copies bounded annotations',()=>{
 const source=[{type:'indicator',indicator:'MA20',enabled:true},{type:'style',style:'line'},{type:'annotations',items:[annotation]}];
 const clean=validateChartRenderActions(source,bars);
 assert.equal(clean.length,3);assert.equal(clean[2].items[0].candidate,true);
 clean[2].items[0].points[0].price=50;assert.equal(annotation.points[0].price,100);
 for(const invalid of [[],Array(25).fill({type:'clear_annotations'}),[{type:'execute',code:'alert(1)'}],[{type:'indicator',indicator:'constructor',enabled:true}],[{type:'indicator',indicator:'MA20',enabled:'true'}],[{type:'style',style:'javascript'}]])assert.throws(()=>validateChartRenderActions(invalid,bars));
});
test('annotations must refer to current exact dates and positive finite prices, with bounded text/point counts',()=>{
 for(const item of [
  {...annotation,points:[{date:'2099-01-01',price:100},annotation.points[1]]},
  {...annotation,points:[{date:bars[0].date,price:Infinity},annotation.points[1]]},
  {...annotation,points:[{date:bars[0].date,price:0},annotation.points[1]]},
  {...annotation,label:'x'.repeat(161)}, {...annotation,label:'bad\nlabel'},
  {...annotation,points:[annotation.points[0]]}, {...annotation,points:Array(81).fill(annotation.points[0])}
 ])assert.throws(()=>validateChartRenderActions([{type:'annotations',items:[item]}],bars));
 assert.throws(()=>validateChartRenderActions([{type:'annotations',items:[annotation]}],[]));
 assert.throws(()=>validateChartRenderActions([{type:'annotations',items:Array(31).fill(annotation)}],bars));
 assert.throws(()=>validateChartRenderActions([{type:'style',style:'heikin'}],bars.map(bar=>({...bar,open:null}))));
});

function chartFixture(){
 const nodes=new Map(),storage=new Map(),painted=[];
 const ctx=new Proxy({measureText:text=>({width:text.length*5}),fillText:text=>painted.push(text)}, {get:(target,key)=>key in target?target[key]:(()=>{})});
 function element(){return {value:'',checked:false,hidden:false,children:[],style:{},dataset:{},options:[{value:'60',dataset:{}},{value:'120',dataset:{}}],classList:{contains:()=>false},setAttribute(name,value){this[name]=value},addEventListener(){},append(...children){this.children.push(...children)},replaceChildren(){this.children=[]},closest(){return {hidden:false}},querySelector(){return null},remove(){},getBoundingClientRect(){return {width:800,left:0,top:0}},getContext(){return ctx}}}
 const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 $('chartStyle').value='candles';$('chartDrawingTool').value='trend';$('localChartRange').value='60';
 const prior={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,requestAnimationFrame:globalThis.requestAnimationFrame};
 globalThis.document={getElementById:$,createElement:element};globalThis.window={addEventListener(){},devicePixelRatio:1,innerHeight:900};
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};globalThis.requestAnimationFrame=()=>{};
 const chart=initLocalChart();
 return {chart,$,storage,painted,restore(){for(const [key,value] of Object.entries(prior))if(value===undefined)delete globalThis[key];else globalThis[key]=value}};
}
test('chat actions synchronize controls atomically and do not store candidate annotations as user drawings',()=>{
 const fixture=chartFixture();try{
  const {chart,$,storage,painted}=fixture;chart.setData('NASDAQ:AAPL',bars);
  const result=chart.applyActions([{type:'indicator',indicator:'MA20',enabled:true},{type:'style',style:'line'},{type:'annotations',items:[annotation]}]);
  assert.equal($('chartMA20').checked,true);assert.equal($('chartStyle').value,'line');assert.equal(result.annotationCount,1);
  assert.ok(painted.some(text=>text==='AI · מועמד · תמיכה אפשרית'));
  assert.match($('localChartCanvas')['aria-label'],/סימוני AI זמניים/);
  assert.ok(storage.has('asaf_chart_preferences_v1'));assert.equal(storage.has('asaf_chart_drawings_v1'),false);
  assert.throws(()=>chart.applyActions([{type:'indicator',indicator:'MA20',enabled:false},{type:'annotations',items:[{...annotation,points:[{date:'bad',price:1},annotation.points[1]]}]}]));
  assert.equal($('chartMA20').checked,true,'invalid annotation rejects entire batch before indicator mutation');
  assert.equal(chart.clearAnnotations().annotationCount,0);assert.doesNotMatch($('localChartCanvas')['aria-label'],/סימוני AI זמניים/);
  chart.applyActions([{type:'annotations',items:[annotation]}]);chart.setData('NASDAQ:MSFT',bars);chart.redraw();assert.doesNotMatch($('localChartCanvas')['aria-label'],/תמיכה אפשרית/);
  chart.applyActions([{type:'annotations',items:[annotation]}]);chart.clear();assert.doesNotMatch($('localChartCanvas')['aria-label'],/תמיכה אפשרית/);
 }finally{fixture.restore()}
});


test('a new analysis fits every annotation date into one padded viewport without changing loaded data',()=>{
 const fixture=chartFixture();try{
  const {chart,$,painted}=fixture;
  const history=Array.from({length:200},(_,index)=>({...bars[0],date:new Date(Date.UTC(2025,0,index+1)).toISOString().slice(0,10),close:100+index/10,high:104+index/10}));
  const points=[10,40,70,110].map(index=>({date:history[index].date,price:history[index].close}));
  chart.setData('NASDAQ:AAPL',history);chart.redraw();
  assert.match($('localChartCanvas')['aria-label'],new RegExp(history[140].date+' עד '+history[199].date));
  chart.applyActions([{type:'annotations',items:[{kind:'cupHandle',label:'ספל וידית אפשריים',points}]}]);
  const description=$('localChartCanvas')['aria-label'],match=description.match(/טווח מוצג: ([\d-]+) עד ([\d-]+)/);
  assert.ok(match);assert.ok(match[1]<points[0].date,'left padding remains when earlier history exists');assert.ok(match[2]>points.at(-1).date,'right padding remains when later history exists');
  for(const point of points)assert.ok(point.date>=match[1]&&point.date<=match[2]);
  assert.match(description,/מתוך 200/);assert.ok(painted.some(text=>text==='AI · מועמד · ספל וידית אפשריים'));
  const fittedRange=match[0];chart.applyActions([{type:'indicator',indicator:'MA20',enabled:true}]);assert.ok($('localChartCanvas')['aria-label'].includes(fittedRange),'indicator-only action preserves viewport');
  chart.applyActions([{type:'annotations',items:[{...annotation,points:[{date:history[0].date,price:100},{date:history.at(-1).date,price:100}]}]}]);
  assert.match($('localChartCanvas')['aria-label'],/200 נרות מוצגים מתוך 200/);assert.match($('localChartCanvas')['aria-label'],new RegExp(history[0].date+' עד '+history.at(-1).date));
 }finally{fixture.restore()}
});
