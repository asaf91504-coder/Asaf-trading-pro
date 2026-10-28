import test from 'node:test';
import assert from 'node:assert/strict';
import {executeChartActions} from '../chart-command-controller.mjs';

const candles=Array.from({length:40},(_,i)=>({date:new Date(Date.UTC(2026,7,i+1)).toISOString().slice(0,10),open:100+i,high:102+i,low:98+i,close:100+i,volume:1000}));
function fixture({missing=false,fetchFailure=false,stale=false}={}){
 let symbol='AAPL',data=missing?null:{symbol,bars:candles},fetches=0;const rendered=[];
 const tools={getSymbol:()=>symbol,getData:()=>data,selectSymbol(value){symbol=value;data=null},async fetchData(){fetches++;if(fetchFailure)throw Error('אין ספק');data={symbol,bars:candles}},applyRender(actions){rendered.push(...actions)},isCurrent:()=>!stale};
 return {tools,rendered,symbol:()=>symbol,fetches:()=>fetches};
}
test('one request selects stock, fetches once and calculates real support/resistance before render',async()=>{
 const f=fixture();const result=await executeChartActions([{type:'symbol',symbol:'MSFT'},{type:'indicator',indicator:'MA20',enabled:true},{type:'levels',kind:'both'}],f.tools);
 assert.equal(f.symbol(),'MSFT');assert.equal(f.fetches(),1);assert.equal(result.changed,true);
 const items=f.rendered.find(a=>a.type==='annotations').items;assert.equal(items.length,2);assert.equal(items[0].points[0].price,117);assert.equal(items[1].points[0].price,140);
});
test('support request excludes resistance geometry',async()=>{
 const f=fixture();await executeChartActions([{type:'levels',kind:'support'}],f.tools);assert.equal(f.fetches(),0);assert.deepEqual(f.rendered[0].items.map(a=>a.kind),['support']);
});
test('unavailable provider reports no annotations while indicator preference still works',async()=>{
 const f=fixture({missing:true,fetchFailure:true});const result=await executeChartActions([{type:'symbol',symbol:'AAPL'},{type:'levels',kind:'both'},{type:'indicator',indicator:'MA150',enabled:true}],f.tools);
 assert.equal(f.fetches(),1);assert.equal(f.rendered.length,1);assert.equal(f.rendered[0].type,'indicator');assert.match(result.messages.join(' '),/אין ספק/);assert.match(result.messages.join(' '),/לא בוצע סימון/);
});
test('invalid action anywhere rejects whole plan before selecting or changing display',async()=>{
 const f=fixture();await assert.rejects(()=>executeChartActions([{type:'symbol',symbol:'MSFT'},{type:'annotations',items:[]}],f.tools));assert.equal(f.symbol(),'AAPL');assert.equal(f.rendered.length,0);assert.equal(f.fetches(),0);
});
test('multiple stock plan cannot silently execute on last stock',async()=>{
 const f=fixture();const result=await executeChartActions([{type:'symbol',symbol:'MSFT'},{type:'symbol',symbol:'NVDA'}],f.tools);assert.equal(result.changed,false);assert.equal(f.symbol(),'AAPL');assert.equal(f.fetches(),0);
});
test('cancelled/stale request cannot change chart, including after pending provider fetch',async()=>{
 const f=fixture({stale:true});await assert.rejects(()=>executeChartActions([{type:'indicator',indicator:'MA20',enabled:true}],f.tools),{name:'AbortError'});assert.equal(f.rendered.length,0);
 const controller=new AbortController(),g=fixture({missing:true});g.tools.signal=controller.signal;g.tools.fetchData=async()=>{controller.abort()};await assert.rejects(()=>executeChartActions([{type:'levels',kind:'both'}],g.tools),{name:'AbortError'});assert.equal(g.rendered.length,0);
});
test('clear AI marks does not fetch data or request manual drawing deletion',async()=>{
 const f=fixture({missing:true});await executeChartActions([{type:'clear_annotations'}],f.tools);assert.equal(f.fetches(),0);assert.deepEqual(f.rendered,[{type:'clear_annotations'}]);
});
test('clear after analysis discards pending AI marks instead of adding them again',async()=>{
 const f=fixture();await executeChartActions([{type:'levels',kind:'both'},{type:'clear_annotations'}],f.tools);assert.deepEqual(f.rendered,[{type:'clear_annotations'}]);
});
