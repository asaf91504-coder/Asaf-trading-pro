import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../stock-chat-ui.mjs',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('const cryptoIntervals='),source.indexOf('function currentContext('));
const loader=source.slice(source.indexOf('async function loadMarketData('),source.indexOf('marketButton.addEventListener("click"'));
const restore=source.slice(source.indexOf('function restore('),source.indexOf('// The free AI endpoint'));
const bars=Array.from({length:30},(_,i)=>({date:new Date(Date.UTC(2026,8,i+1)).toISOString().slice(0,10),open:100+i,high:102+i,low:98+i,close:101+i,volume:1000}));
function fixture({symbol='BTCUSD',interval='1day',authenticated=true,status=200,resultPatch={},duringFetch}={}){
 const nodes=new Map(),requests=[],saved=[],ready=[],rendered=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='symbol'?symbol:id==='marketInterval'?interval:'',textContent:'',disabled:false});return nodes.get(id)};
 const context={CHART_HISTORY_LIMIT:2000,URLSearchParams,location:{search:''},Event,DOMException,Map,Set,Date,cryptoIntervals:undefined,authState:{enabled:true,authenticated},$:node,chartSymbol:node('symbol'),normSymbol:()=>node('symbol').value,marketStatus:node('marketFetchStatus'),marketButton:node('marketFetch'),privateAccessKey:'private',key:'cache',loaded:null,chartRevision:0,lastVisibleChart:null,lastFetchBySymbol:new Map(),status:node('chatStatus'),
  stockContext:(symbol,rows,meta)=>({symbol,bars:rows.length,date:rows.at(-1).date,source:'CSV',interval:meta.interval}),
  localChart:{setData(...args){rendered.push(args)}},sessionStorage:{setItem(_key,value){saved.push(JSON.parse(value))},getItem(){return null}},renderStatus(){},datasetReady(){ready.push(context.loaded)},rememberSymbol(){},say(){},window:{prompt(){throw Error('Unexpected private-code prompt')}},document:{querySelector(){return {click(){}}}},
  publicFeed:{then(){throw Error('Stock feed gating must not be consulted for crypto')}},
  fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body),options});if(duringFetch)duringFetch(context);return {ok:status<400,status,json:async()=>({symbol:'COINLORE:BTCUSD',bars,source:'CoinLore',interval,receivedAt:'2026-10-29T10:00:00Z',latestBarTime:bars.at(-1).date,quote:{price:222.5,receivedAt:'2026-10-29T10:00:00Z',quoteTime:null},internalResearchOnly:true,coverage:'CoinLore aggregated crypto data',latestBarMayBePartial:true,...resultPatch})}}
 };
 // Lexical declarations belong to the exact source under test.
 delete context.cryptoIntervals;vm.createContext(context);vm.runInContext(helpers+loader+restore,context);return {context,nodes,requests,saved,ready,rendered};
}
test('owner crypto load bypasses stock feed, canonicalizes symbol and retains CoinLore research provenance',async()=>{
 const f=fixture();await f.context.loadMarketData({fromChat:true});assert.equal(f.requests.length,1);assert.equal(f.requests[0].url,'/.netlify/functions/crypto-research');assert.equal(f.requests[0].body.symbol,'COINLORE:BTCUSD');assert.equal(f.context.chartSymbol.value,'COINLORE:BTCUSD');assert.equal(f.context.loaded.source,'CoinLore');assert.equal(f.context.loaded.context.source,'CoinLore');assert.equal(f.context.loaded.internalResearchOnly,true);assert.equal(f.saved[0].source,'CoinLore');assert.equal(f.saved[0].latestBarMayBePartial,true);assert.equal(f.saved[0].internalResearchOnly,true);assert.equal(f.context.loaded.quote.price,222.5);assert.notEqual(f.context.loaded.quote.price,bars.at(-1).close);assert.match(f.context.marketStatus.textContent,/222.5/);assert.equal(f.rendered.length,1);assert.match(f.context.marketStatus.textContent,/REST/);assert.doesNotMatch(f.context.marketStatus.textContent,/CSV|Twelve Data|ארה״ב/);
});
test('crypto login and unsupported interval fail before endpoint or private code prompts',async()=>{
 const anon=fixture({authenticated:false});await assert.rejects(()=>anon.context.loadMarketData(),/להיכנס לחשבון בעל הפרויקט/);assert.equal(anon.requests.length,0);
 const wrong=fixture({interval:'30min'});await assert.rejects(()=>wrong.context.loadMarketData(),/לא שונה אוטומטית/);assert.equal(wrong.nodes.get('marketInterval').value,'30min');assert.equal(wrong.requests.length,0);
});
test('owner rejection, wrong symbol, wrong source and public-scope response never replace chart',async()=>{
 for(const options of [{status:403,resultPatch:{error:'Owner only'}},{resultPatch:{symbol:'COINLORE:ETHUSD'}},{resultPatch:{source:'Twelve Data'}},{resultPatch:{internalResearchOnly:false}},{resultPatch:{interval:'5min'}}]){
  const f=fixture(options);await assert.rejects(()=>f.context.loadMarketData());assert.equal(f.context.loaded,null);assert.equal(f.rendered.length,0);assert.equal(f.saved.length,0);assert.equal(f.context.marketButton.disabled,false);
 }
});
test('cancelled or changed crypto request cannot apply late candles or save cache',async()=>{
 const controller=new AbortController(),aborted=fixture({duringFetch(){controller.abort()}});await assert.rejects(()=>aborted.context.loadMarketData({signal:controller.signal}),{name:'AbortError'});assert.equal(aborted.rendered.length,0);assert.equal(aborted.saved.length,0);
 const stale=fixture({duringFetch(ctx){ctx.chartSymbol.value='COINLORE:ETHUSD'}});await assert.rejects(()=>stale.context.loadMarketData(),/השתנו/);assert.equal(stale.rendered.length,0);
});
test('successful crypto load enforces explicit refresh budget and restore preserves source',async()=>{
 const f=fixture();await f.context.loadMarketData();await assert.rejects(()=>f.context.loadMarketData(),/פעם בדקה/);assert.equal(f.requests.length,1);
 const cached=f.saved[0],restored=fixture({symbol:'COINLORE:BTCUSD'});restored.context.sessionStorage.getItem=()=>JSON.stringify(cached);restored.context.restore();assert.equal(restored.context.loaded.source,'CoinLore');assert.equal(restored.context.loaded.context.source,'CoinLore');assert.equal(restored.context.loaded.internalResearchOnly,true);
 const bad=fixture();bad.context.sessionStorage.getItem=()=>JSON.stringify({...cached,internalResearchOnly:false});bad.context.restore();assert.equal(bad.context.loaded,null);
});
test('AI receives a server-crypto request flag rather than a stock-provider or unverified-CSV claim',async()=>{
 const f=fixture();await f.context.loadMarketData({fromChat:true});const c=f.context,bubbles=[];let payload;
 Object.assign(c,{setTimeout,clearTimeout,AbortController,Event,chartAttachment:()=>null,recentAIBars:value=>value,currentContext:()=>c.loaded.context,refreshAuth:async()=>{},parseChartCommand:()=>({recognized:false,actions:[]}),chatBusy:false,conversationEpoch:0,conversation:[],requestController:null,pendingImage:null,imageInput:null,imageStatus:null,freeAiAccessKey:'ai',message:{value:'',dispatchEvent(){},focus(){}},form:{querySelector:()=>({disabled:false})},setAiStatus(){},say(_role,content){const item={textContent:content,append(){}};bubbles.push(item);return item}});
 c.localChart.settings=()=>({style:'candles',indicators:['MA20']});
 c.fetch=async(url,options)=>{assert.equal(url,'/.netlify/functions/free-chat');payload=JSON.parse(options.body);return {ok:true,json:async()=>({answer:'ניתוח נתוני CoinLore'})}};
 vm.runInContext(source.slice(source.indexOf('async function ask('),source.indexOf("$('clearConversation')")),c);await c.ask('explain this chart');
 assert.equal(payload.useServerCrypto,true);assert.equal(payload.useServerMarket,false);assert.equal(payload.source,'CoinLore');assert.equal(payload.symbol,'COINLORE:BTCUSD');assert.equal(payload.receivedAt,'2026-10-29T10:00:00Z');assert.match(bubbles.at(-1).textContent,/CoinLore/);
});
