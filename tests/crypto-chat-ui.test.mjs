import {questionAsset,sameChatAsset,stockDiscoveryIntent} from '../chat-asset-intent.mjs';
import {chatAnswerText} from '../chat-answer-presentation.mjs';
import {isLearningQuestion} from '../chat-request-intent.mjs';
import {currentUSMarketIntent} from '../chat-market-intent.mjs';
import {chatThrottleDisplay} from '../chat-throttle-copy.mjs';
import {languageCode} from '../interface-language.mjs';
import {entryStopText,compactEntryStopText,withoutScenarioText} from '../entry-stop-scenario.mjs';
import {localizedChatReply} from '../chat-reply-ui.mjs';
import {journalIntent} from '../journal-chat-core.mjs';
import {renderSearchSources} from '../web-search-ui.mjs';
import {marketSnapshotMetadata} from '../market-quality.mjs';
import test from 'node:test';
import {requestsChartAnalysis,hasAnalysisCandles} from '../chart-analysis-request.mjs';
import {historyForModel,selectConversationMessages} from '../conversation-context.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {isChatNearBottom} from '../chat-interaction.mjs';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../stock-chat-ui.mjs',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('const cryptoIntervals='),source.indexOf('function currentContext('));
const loader=source.slice(source.indexOf('async function loadMarketData('),source.indexOf('marketButton.addEventListener("click"'));
const installer=source.slice(source.indexOf('function installVentureSnapshot('),source.indexOf('async function runVentureActions('));
const restore=source.slice(source.indexOf('function restore('),source.indexOf('// The free AI endpoint'));
const bars=Array.from({length:30},(_,i)=>({date:new Date(Date.UTC(2026,8,i+1)).toISOString().slice(0,10),open:100+i,high:102+i,low:98+i,close:101+i,volume:1000}));
function fixture({symbol='BTCUSD',interval='1day',authenticated=true,status=200,resultPatch={},duringFetch}={}){
 const nodes=new Map(),requests=[],saved=[],ready=[],rendered=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='symbol'?symbol:id==='marketInterval'?interval:'',textContent:'',disabled:false});return nodes.get(id)};
 const context={marketSnapshotMetadata,CHART_HISTORY_LIMIT:2000,URLSearchParams,location:{search:''},Event,DOMException,Map,Set,Date,cryptoIntervals:undefined,authState:{enabled:true,authenticated},$:node,chartSymbol:node('symbol'),normSymbol:()=>node('symbol').value,marketStatus:node('marketFetchStatus'),marketButton:node('marketFetch'),privateAccessKey:'private',key:'cache',loaded:null,chartRevision:0,lastVisibleChart:null,ventureActions:[],lastFetchBySymbol:new Map(),status:node('chatStatus'),
  stockContext:(symbol,rows,meta)=>({symbol,bars:rows.length,date:rows.at(-1).date,source:'CSV',interval:meta.interval}),
  localChart:{setData(...args){rendered.push(args)},setSnapshot(value){rendered.push(value)}},sessionStorage:{removeItem(){},setItem(_key,value){saved.push(JSON.parse(value))},getItem(){return null}},renderStatus(){},datasetReady(){ready.push(context.loaded)},rememberSymbol(){},say(){},window:{prompt(){throw Error('Unexpected private-code prompt')}},document:{querySelector(){return {click(){}}}},
  intrinioFeed:Promise.resolve({enabled:false}),
  publicFeed:{then(){throw Error('Stock feed gating must not be consulted for crypto')}},
  fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body),options});if(duringFetch)duringFetch(context);return {ok:status<400,status,json:async()=>({symbol:'COINLORE:BTCUSD',bars,source:'CoinLore',interval,receivedAt:'2026-10-29T10:00:00Z',latestBarTime:bars.at(-1).date,quote:{price:222.5,receivedAt:'2026-10-29T10:00:00Z',quoteTime:null},internalResearchOnly:true,coverage:'CoinLore aggregated crypto data',latestBarMayBePartial:true,...resultPatch})}}
 };
 context.refreshProviderFeed=async()=>{};
 context.providerFeed={get:async()=>({intrinio:await context.intrinioFeed,publicMarket:await context.publicFeed})};
 // Lexical declarations belong to the exact source under test.
 delete context.cryptoIntervals;vm.createContext(context);vm.runInContext(helpers+installer+loader+restore,context);return {context,nodes,requests,saved,ready,rendered};
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
 Object.assign(c,{chatHistory:{complete(){}},isChatNearBottom,log:{scrollTop:0,scrollHeight:0},setTimeout,clearTimeout,AbortController,Event,chartAttachment:()=>null,recentAIBars:value=>value,currentContext:()=>c.loaded.context,refreshAuth:async()=>{},requestsChartControl:()=>false,parseChartCommand:()=>({recognized:false,actions:[]}),chatBusy:false,conversationEpoch:0,conversation:[],requestController:null,pendingImage:null,imageInput:null,imageStatus:null,freeAiAccessKey:'ai',message:{value:'',dispatchEvent(){},focus(){}},form:{querySelector:()=>({disabled:false})},setAiStatus(){},say(_role,content){const item={textContent:content,append(){}};bubbles.push(item);return item}});
 c.localChart.settings=()=>({style:'candles',indicators:['MA20']});
 c.fetch=async(url,options)=>{assert.equal(url,'/.netlify/functions/free-chat');payload=JSON.parse(options.body);return {ok:true,json:async()=>({answer:'ניתוח נתוני CoinLore'})}};
 Object.assign(c,{renderSearchSources,requestsChartAnalysis,hasAnalysisCandles,historyForModel,renderChatText:(el,text)=>{el.textContent=text}});c.window.dispatchEvent=()=>{};
 c.questionAsset=questionAsset;c.sameChatAsset=sameChatAsset;c.stockDiscoveryIntent=stockDiscoveryIntent;c.chatAnswerText=chatAnswerText;c.isLearningQuestion=isLearningQuestion;c.currentUSMarketIntent=currentUSMarketIntent;c.languageCode=languageCode;c.entryStopText=entryStopText;c.compactEntryStopText=compactEntryStopText;c.withoutScenarioText=withoutScenarioText;c.analysisReceipts=new Map();c.appendScenario=()=>{};c.chatThrottleDisplay=chatThrottleDisplay;c.localizedChatReply=localizedChatReply;c.renderChatReply=(el,parts)=>c.renderChatText(el,localizedChatReply(parts,c.window.asafTranslate));
 c.journalIntent=journalIntent;c.selectConversationMessages=selectConversationMessages;
 vm.runInContext(source.slice(source.indexOf('async function ask('),source.indexOf("$('clearConversation')")),c);await c.ask('explain this chart');
 assert.equal(payload.useServerCrypto,true);assert.equal(payload.useServerMarket,false);assert.equal(payload.source,'CoinLore');assert.equal(payload.symbol,'COINLORE:BTCUSD');assert.equal(payload.receivedAt,'2026-10-29T10:00:00Z');assert.match(bubbles.at(-1).textContent,/CoinLore/);
});

test('chart and AI retain the same provider history beyond 200 candles',async()=>{
 const longer=Array.from({length:365},(_,i)=>({...bars[0],date:new Date(Date.UTC(2025,9,1+i)).toISOString().slice(0,10)}));
 const f=fixture({resultPatch:{bars:longer}});await f.context.loadMarketData({fromChat:true});
 assert.equal(f.context.loaded.bars.length,365);assert.equal(f.rendered[0][1].length,365);assert.equal(f.saved[0].bars.length,365);
});

test('stock load and session restore preserve daily policy, timezone and coverage',async()=>{
 const f=fixture({symbol:'AAPL',resultPatch:{symbol:'AAPL',source:'Twelve Data',presentation:'server-raster',candleCount:30,image:'data:image/png;base64,test',exchangeTimezone:'America/New_York',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,coverage:'Prior daily sessions'}});
 f.context.publicFeed=Promise.resolve({enabled:true});await f.context.loadMarketData();
 assert.equal(f.context.loaded.context.latestBarMayBePartial,false);assert.equal(f.context.loaded.exchangeTimezone,'America/New_York');assert.equal(f.saved.length,0);assert.equal(f.context.loaded.bars,undefined);
 const restored=fixture({symbol:'AAPL'});restored.context.sessionStorage.getItem=()=>JSON.stringify({source:'Twelve Data',bars});restored.context.restore();assert.equal(restored.context.loaded,null);
});

test('old provider sessions are removed instead of restoring raw weekly candles',()=>{
 const f=fixture({symbol:'SPY',interval:'1day'});let removed=0;f.context.sessionStorage.removeItem=()=>removed++;f.context.sessionStorage.getItem=()=>JSON.stringify({symbol:'SPY',source:'Twelve Data',interval:'1week',bars});f.context.restore();assert.equal(f.context.loaded,null);assert.equal(removed,1);assert.equal(f.rendered.length,0);
});

test('stock loader rejects wrong intervals and late responses after selection changes',async()=>{
 for(const options of [
  {resultPatch:{symbol:'AAPL',source:'Twelve Data',interval:'1h'}},
  {resultPatch:{symbol:'AAPL',source:'Twelve Data'},duringFetch:ctx=>{ctx.$('marketInterval').value='1week';}}
 ]){
  const f=fixture({symbol:'AAPL',...options});f.context.publicFeed=Promise.resolve({enabled:true});
  await assert.rejects(()=>f.context.loadMarketData(),/טווח/);
  assert.equal(f.rendered.length,0);assert.equal(f.saved.length,0);assert.equal(f.context.loaded,null);
 }
});


test('Intrinio daily trial routes through authenticated owner endpoint and is never labeled Twelve Data or saved in session storage',async()=>{
 const f=fixture({symbol:'AAPL',resultPatch:{source:'Intrinio',symbol:'AAPL',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,coverage:'Intrinio adjusted EOD'}});
 f.context.intrinioFeed=Promise.resolve({enabled:true});f.context.publicFeed=Promise.resolve({enabled:false});
 await f.context.loadMarketData({fromChat:true});assert.equal(f.requests[0].url,'/.netlify/functions/intrinio-research');assert.equal(f.context.loaded.source,'Intrinio');assert.equal(f.context.loaded.context.source,'Intrinio');assert.equal(f.context.loaded.context.latestBarMayBePartial,false);assert.match(f.context.marketStatus.textContent,/Intrinio/);assert.doesNotMatch(f.context.marketStatus.textContent,/Twelve Data/);assert.equal(f.saved.length,0);
});
test('Intrinio trial rejects unsupported intervals and untrusted source without changing chart',async()=>{
 for(const options of [{interval:'1week'},{resultPatch:{source:'Twelve Data',symbol:'AAPL'}}]){
 const f=fixture({symbol:'AAPL',...options});f.context.intrinioFeed=Promise.resolve({enabled:true});f.context.publicFeed=Promise.resolve({enabled:false});await assert.rejects(()=>f.context.loadMarketData());assert.equal(f.rendered.length,0);
 }
});


test('licensed public stock feed takes priority over owner-only trial, including intraday',async()=>{
 const f=fixture({symbol:'AAPL',interval:'1h',resultPatch:{symbol:'AAPL',source:'Twelve Data',interval:'1h',internalResearchOnly:false,presentation:'server-raster',candleCount:30,image:'data:image/png;base64,test'}});
 f.context.publicFeed=Promise.resolve({enabled:true});f.context.intrinioFeed=Promise.resolve({enabled:true});
 await f.context.loadMarketData({fromChat:true});
 assert.equal(f.requests[0].url,'/.netlify/functions/public-market');
 assert.equal(f.context.loaded.source,'Twelve Data');assert.equal(f.rendered.length,1);
});

test('scanner chart preserves its receipt and automatic actions while bypassing provider refresh throttling',async()=>{
 const scannerContext={asOf:'2026-11-25',receivedAt:'2026-11-26T12:00:00Z',side:'short'};
 const actions=[{type:'levels',kind:'both'},{type:'trendlines'}];
 const f=fixture({symbol:'AMD',resultPatch:{symbol:'AMD',source:'Twelve Data',presentation:'server-raster',interval:'1day',candleCount:200,image:'data:image/png;base64,AAAA',chartSettings:{indicators:['MA20','MA150']},scannerContext,researchActions:actions}});
 f.context.publicFeed=Promise.resolve({enabled:true});f.context.lastFetchBySymbol.set('AMD|1day',Date.now());
 await f.context.loadMarketData({fromChat:true,scannerContext});
 assert.deepEqual(f.requests[0].body.scannerContext,scannerContext);assert.equal(f.requests[0].body.cachedOnly,true);assert.equal(f.requests[0].body.bars,undefined);
 assert.deepEqual(f.context.loaded.scannerContext,scannerContext);assert.deepEqual(f.context.ventureActions,actions);assert.equal(f.context.loaded.bars,undefined);
});

test('two overlapping marked chart loads for the same ticker cannot let the older image win',async()=>{
 const scannerContext={asOf:'2026-11-25',receivedAt:'2026-11-26T12:00:00Z',side:'long'};
 const f=fixture({symbol:'AMD'});f.context.publicFeed=Promise.resolve({enabled:true});const pending=[];
 f.context.fetch=()=>new Promise(resolve=>pending.push(resolve));
 const response=image=>({ok:true,json:async()=>({symbol:'AMD',source:'Twelve Data',presentation:'server-raster',interval:'1day',candleCount:200,image,latestBarTime:'2026-11-25',scannerContext})});
 const older=f.context.loadMarketData({fromChat:true,scannerContext});await new Promise(r=>setImmediate(r));
 const newer=f.context.loadMarketData({fromChat:true,scannerContext});await new Promise(r=>setImmediate(r));
 pending[1](response('NEW'));await newer;pending[0](response('OLD'));await assert.rejects(older,{name:'AbortError'});
 assert.equal(f.rendered.length,1);assert.equal(f.rendered[0].image,'NEW');
});
