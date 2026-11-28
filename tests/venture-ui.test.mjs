import {subscriptionAccessError} from '../subscription-access.mjs';
import {mergeResearchActions} from '../chat-request-intent.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {marketSnapshotMetadata} from '../market-quality.mjs';
const source=readFileSync(new URL('../stock-chat-ui.mjs',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function installVentureSnapshot('),source.indexOf('async function ask('));
function fixture(){
 const nodes=new Map(),images=[],requests=[],events=[];const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='marketInterval'?'1day':'AAPL',textContent:''});return nodes.get(id)};
 const image={symbol:'AAPL',source:'Twelve Data',presentation:'server-raster',interval:'1day',receivedAt:'2026-11-17T14:00:00Z',latestBarTime:'2026-11-16',candleCount:500,image:'data:image/png;base64,test',chartSettings:{style:'candles',indicators:['MA20','MA150']},messages:['Server annotations applied']};
 const c={subscriptionAccessError,mergeResearchActions,key:'cache',Event,DOMException,CustomEvent:class extends Event{constructor(name,o){super(name);this.detail=o?.detail}},marketSnapshotMetadata,chartRevision:0,lastVisibleChart:null,loaded:null,ventureActions:[],conversationEpoch:0,$:node,chartSymbol:node('symbol'),normSymbol:()=>node('symbol').value,cryptoResearchSymbol:s=>s.startsWith('COINLORE:')?s:null,localChart:{clear(){},setSnapshot:s=>images.push(s)},sessionStorage:{removeItem(){}},renderStatus(){},datasetReady(){},rememberSymbol(){},window:{dispatchEvent:e=>events.push(e.type)},executeChartActions:async()=>({changed:true,messages:['native-crypto']}),fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({...image,symbol:node('symbol').value.split(':').at(-1)})}}};
 vm.createContext(c);vm.runInContext(code,c);c.loadMarketData=async()=>{c.installVentureSnapshot({...image,symbol:node('symbol').value.split(':').at(-1)},node('symbol').value);return c.loaded};
 return {c,images,requests,events,image};
}
test('chat chart actions request a server image, never download or compute provider bars locally',async()=>{
 const f=fixture();const result=await f.c.runChatActions([{type:'symbol',symbol:'NASDAQ:AAPL'},{type:'indicator',indicator:'MA20',enabled:true},{type:'levels',kind:'both'}],{epoch:0});
 assert.equal(result.changed,true);assert.ok(result.messages.includes('Server annotations applied'));assert.equal(f.requests.length,1);assert.equal(f.requests[0].url,'/.netlify/functions/public-market');assert.equal(f.requests[0].body.cachedOnly,true);assert.equal(f.requests[0].body.bars,undefined);assert.equal(f.c.loaded.bars,undefined);assert.equal(f.c.loaded.context.bars,500);assert.equal(f.images.length,2);assert.ok(f.events.includes('asaf:chart-actions'));
});
test('late image/tool results cannot replace a new symbol or a cancelled conversation',async()=>{
 for(const change of ['symbol','conversation']){const f=fixture();f.c.fetch=async()=>{if(change==='symbol')f.c.chartSymbol.value='NVDA';else f.c.conversationEpoch++;return {ok:true,json:async()=>f.image}};
 await assert.rejects(f.c.runChatActions([{type:'levels',kind:'both'}],{epoch:0}),{name:'AbortError'});assert.equal(f.images.length,1);}
});
test('opening crypto from a stock chart preserves the separate owner-only crypto implementation',async()=>{
 const f=fixture();const result=await f.c.runChatActions([{type:'symbol',symbol:'COINLORE:BTCUSD'}],{epoch:0});assert.equal(result.messages[0],'native-crypto');assert.equal(f.requests.length,0);assert.equal(f.images.length,0);
});

test('chat changes to a scanner chart keep the same scan receipt and respect explicit annotation clearing',async()=>{
 const f=fixture(),context={asOf:'2026-11-16',receivedAt:f.image.receivedAt,side:'long'};
 f.c.installVentureSnapshot(f.image,'AAPL');f.c.loaded.scannerContext=context;
 await f.c.runChatActions([{type:'clear_annotations'}],{epoch:0});
 assert.deepEqual(f.requests[0].body.scannerContext,{...context,autoAnnotate:false});assert.deepEqual(f.requests[0].body.actions,[{type:'clear_annotations'}]);
});

test('server-image commands propagate expired subscription instead of fabricating a candle failure',async()=>{
 const f=fixture(),denied=subscriptionAccessError({status:402},{code:'subscription_required',error:'Trial ended'});
 f.c.loadMarketData=async()=>{throw denied};
 await assert.rejects(f.c.runChatActions([{type:'levels',kind:'both'}],{epoch:0}),e=>e===denied);
 assert.equal(f.images.length,0);assert.equal(f.requests.length,0);
});
test('annotating an existing server image preserves an explicit paid-access denial',async()=>{
 const f=fixture();f.c.installVentureSnapshot(f.image,'AAPL');
 f.c.fetch=async()=>Response.json({code:'paid_subscription_required',error:'Choose a plan'},{status:402});
 await assert.rejects(f.c.runChatActions([{type:'levels',kind:'both'}],{epoch:0}),e=>e.subscriptionRequired===true);
 assert.equal(f.images.length,1);
});
