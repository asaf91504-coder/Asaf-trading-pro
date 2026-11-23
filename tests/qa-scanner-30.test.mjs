import assert from 'node:assert/strict';
import test from 'node:test';
import {screenResult,scanFile} from '../scanner-core.mjs';
import {readFileSync} from 'node:fs';
import {createTranslator,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {mountVentureScanner} from '../venture-scanner-ui.mjs';

function record(change = {}, extra = {}) {
 const summary={close:15,aboveMA20:true,volumeRatio:2,atrPercent:4,breakout20:true,rsi14:58,macd:0.8,macdSignal:0.3,stochasticK:65,stochasticD:51,obv:200,obvPrevious:100,adx14:32,plusDI14:30,minusDI14:18,supertrend:13,supertrendDirection:'up',...change};
 return {symbol:'QA',summary,bars:[{close:14},{close:summary.close}],fundamentals:{status:'available',source:'Twelve Data',currency:'USD',symbol:'QA',marketCap:1e9,receivedAt:new Date().toISOString()},research:{available:true,candidates:[{kind:'doubleBottom',stage:'crossed',scenario:{side:'long',movePercent:15,riskReward:2}}]},...extra};
}
const filterCases=[
 ['passes defaults',{},{},null],
 ['excludes price equal to threshold',{close:5},{},/מחיר/],
 ['accepts market-cap equality',{},{minMarketCap:1e9},null],
 ['rejects stale fundamentals',{},{minMarketCap:1e9},/פג תוקף/,{fundamentals:{...record().fundamentals,receivedAt:'2026-01-01T00:00:00.000Z'}}],
 ['reports below-threshold cap',{},{minMarketCap:1000000001},/מתחת ל/],
 ['excludes close equal to or under MA20',{aboveMA20:false},{},/MA20/],
 ['does not treat missing relative volume as zero',{volumeRatio:null},{minVolume:0},/מחזור חסר/],
 ['requires relative volume strictly above average for rising-volume rule',{volumeRatio:1},{risingVolume:true},/ממוצע 20/],
 ['reports missing ATR',{atrPercent:null},{minATR:4},/ATR/],
 ['requires a completed closing breakout when requested',{breakout20:false},{breakout20:true},/שיא 20/],
 ['rejects reversed RSI bounds',{},{rsiEnabled:true,minRSI:75,maxRSI:20},/טווח RSI/],
 ['rejects MACD equal to its signal',{macdSignal:0.8},{macdAboveSignal:true},/MACD/],
 ['reports missing stochastic data',{stochasticD:null},{stochasticAboveSignal:true},/Stochastic/],
 ['rejects unchanged OBV',{obvPrevious:200},{obvRising:true},/OBV/],
 ['reports insufficient ADX history',{adx14:null},{adxEnabled:true},/ADX14/],
 ['rejects a DMI tie',{minusDI14:30},{diDirection:'up'},/DMI/],
 ['rejects the opposite Supertrend direction',{},{supertrendDirection:'down'},/Supertrend/],
 ['accepts an exact 15% measured move and 2R when already crossed',{},{scenarioSide:'long',crossedOnly:true,minMeasuredMove:15,minScenarioRR:2},null],
];
for(const [label,delta,filters,rejection,extra] of filterCases)test('scanner filter: '+label,()=>{
 const out=screenResult(record(delta,extra),filters);
 assert.equal(out.matches,!rejection);
 if(rejection){assert.equal(out.reasons.length,1);assert.match(out.reasons[0],rejection);}
 else assert.deepEqual(out.reasons,[]);
});

class Elem extends EventTarget {
 constructor(tag=''){super();this.tagName=tag;this.children=[];this.textContent='';this.hidden=false;this.disabled=false;this.checked=false;this.value='';}
 append(...kids){this.children.push(...kids);}
 replaceChildren(...kids){this.children=kids;}
 closest(kind){return this[kind]??=new Elem(kind);}
 querySelectorAll(){return [];}
 before(node){this.previous=node;}
 click(){return this.onclick?.();}
}
const json=(data,ok=true)=>({ok,json:async()=>data});
const derived=(symbol='QA',matches=true,metrics={})=>({symbol,asOf:'2026-11-18',presentation:'derived-only',metrics:{atrPercent:4,relativeVolume:2,aboveMA20:true,...metrics},patterns:[],screen:{matches,reasons:matches?[]:['filtered']},marketCapStatus:'available'});
function fixture(fetcher=async()=>json({records:[derived()]})){
 const elements=new Map();const calls=[],open=[];
 const $=id=>{if(!elements.has(id))elements.set(id,new Elem(id));return elements.get(id);};
 const document=new EventTarget();document.getElementById=$;document.createElement=tag=>new Elem(tag);
 document.documentElement={lang:'he'};
 const headings=Array.from({length:15},()=>new Elem('th'));
 $('scanRows').closest('table').querySelectorAll=()=>headings;
 const window=new EventTarget();
 const prev={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};
 Object.assign(globalThis,{document,window,fetch:async(url,options)=>{calls.push({url,options,body:options.body&&JSON.parse(options.body)});return fetcher(calls.at(-1),calls.length);}});
 let selected={minPrice:5};$('scanProviderSymbols').value=' QA ';$('scanSort').value='atr';
 mountVentureScanner({filters:()=>selected,openCharts:()=>open.push('chart')});
 window.addEventListener('asaf:open-provider-chart',event=>open.push(event.detail.symbol));
 function clickDoc(id){let ev=new Event('click');Object.defineProperty(ev,'target',{value:$(id)});document.dispatchEvent(ev);}
 return {$,window,calls,open,headings,setLanguage:(code,tr)=>{document.documentElement.lang=code;window.asafTranslate=tr;window.dispatchEvent(new Event('asaf:language'));},clickDoc,scan:()=>$('scanProvider').click(),update:()=>$('scanClear').previous.click(),status:()=>$('scanDiscoverStatus').textContent,rows:()=>$('scanRows').children,filters:v=>{selected=v;$('scanner').dispatchEvent(new Event('input'));},restore:()=>Object.assign(globalThis,prev)};
}
function ui(name,setup,body){test('scanner UI: '+name,async()=>{const f=fixture(setup);try{await body(f);}finally{f.restore();}});}
ui('initial empty state makes no provider request',undefined,async f=>{assert.match(f.rows()[0].children[0].textContent,/מצא לי מניות/);assert.equal(f.rows()[0].children[0].colSpan,15);assert.equal(f.calls.length,0);});
ui('manual scanner strips whitespace and posts only chosen symbols',undefined,async f=>{f.$('scanProviderSymbols').value=' QA,  , SECOND , ';await f.scan();assert.deepEqual(f.calls[0].body,{symbols:['QA','SECOND'],filters:{minPrice:5},cachedOnly:false});assert.equal(f.calls[0].options.credentials,'same-origin');});
ui('over-limit manual selection rejects before network',undefined,async f=>{f.$('scanProviderSymbols').value=Array.from({length:11},(_,i)=>'QA'+i).join(',');await f.scan();assert.equal(f.calls.length,0);assert.match(f.status(),/1 עד 10/);assert.equal(f.$('scanProvider').disabled,false);});
ui('ignores unexpected raw provider row rather than rendering it',async()=>json({records:[{...derived('RAW'),presentation:'raw'},derived('QA')]}),async f=>{await f.scan();assert.equal(f.rows().length,1);assert.match(f.rows()[0].children[0].textContent,/^QA /);});
ui('match-only view hides rejected results and explains empty selection',async()=>json({records:[derived('QA',false)]}),async f=>{f.$('scanOnlyMatches').checked=true;await f.scan();assert.match(f.rows()[0].children[0].textContent,/אין התאמות/);assert.match(f.$('scanSummary').textContent,/0 התאמות/);});
ui('relative-volume sort ranks results rather than arrival order',async()=>json({records:[derived('LOW',true,{relativeVolume:1}),derived('HIGH',true,{relativeVolume:8})]}),async f=>{f.$('scanSort').value='volume';await f.scan();assert.match(f.rows()[0].children[0].textContent,/^HIGH /);});
ui('selected scanner result opens its exact symbol in chart',undefined,async f=>{await f.scan();f.rows()[0].children.at(-1).children[0].click();assert.deepEqual(f.open,['chart','QA']);});
ui('manual request failure re-enables controls and the next run succeeds',async(q,n)=>n===1?json({error:'OFFLINE'},false):json({records:[derived()]}),async f=>{await f.scan();assert.equal(f.status(),'OFFLINE');assert.equal(f.$('scanProvider').disabled,false);await f.scan();assert.match(f.status(),/1 תוצאות/);});
ui('failed cached refilter retains previous rows and can retry cache-only',async(q,n)=>n===2?json({error:'CACHE_UNAVAILABLE'},false):json({records:[derived()]}),async f=>{await f.scan();f.filters({minPrice:10});await f.update();assert.equal(f.status(),'CACHE_UNAVAILABLE');assert.match(f.rows()[0].children[0].textContent,/^QA /);await f.update();assert.equal(f.calls.length,3);assert.equal(f.calls[2].body.cachedOnly,true);assert.deepEqual(f.calls[2].body.symbols,['QA']);});
ui('changed filters during a slow result flag refresh as required',async()=>{await new Promise(resolve=>setImmediate(resolve));return json({records:[derived()]});},async f=>{const pending=f.scan();f.filters({minPrice:21});await pending;assert.match(f.status(),/המסננים השתנו/);});
ui('logout discards a delayed in-flight response',async()=>{await new Promise(resolve=>setImmediate(resolve));return json({records:[derived()]});},async f=>{const pending=f.scan();f.window.dispatchEvent(new Event('asaf:logout'));await pending;assert.match(f.rows()[0].children[0].textContent,/מצא לי מניות/);assert.equal(f.$('scanProvider').disabled,false);});
test('scanner CSV: rejects intraday input instead of calculating daily filters on short candles',()=>{
 const csv=['Date,Open,High,Low,Close,Volume',...Array.from({length:25},(_,i)=>'2026-01-'+String(i+1).padStart(2,'0')+'T10:30:00,10,12,9,11,100')].join('\n');
 assert.throws(()=>scanFile('QA.csv',csv),/נרות יומיים בלבד/);
});


const localizedSample={...derived('QA',false,{aboveMA150:false,atrPercent:null,relativeVolume:null,supertrendDirection:'up'}),coverage:'נרות יומיים קודמים בלבד. כיסוי נפח המסחר טרם אומת; אין להניח שזהו מחזור השוק המלא.',screen:{matches:false,reasons:['מתחת ל-MA20 או שווה לו','מחזור חסר']},patterns:[{label:'מועמד לדאבל בוטום',stage:'crossed',side:'long',movePercent:15,riskReward:2},{label:'מועמד לדאבל טופ',stage:'waiting',side:'short'}]};
for(const code of Object.keys(languageNames))ui('rendered states use production translation pipeline / '+code,async()=>json({records:[localizedSample],shared:true,stale:true,completedAt:'2026-11-19T11:00:00.000Z',nextUpdateAt:'2026-11-19T14:00:00.000Z'}),async f=>{
 const catalog=code==='he'?{}:{...JSON.parse(readFileSync(new URL('../locales/'+code+'.json',import.meta.url))),...launchTranslations[code]};
 const tr=createTranslator(catalog);
 const liveText=node=>node.translate===false?node.textContent:tr(node.textContent); // mirrors the observer's translate=no boundary
 f.setLanguage(code,tr);
 const samples=f.headings.map(liveText).concat(liveText(f.rows()[0].children[0]),liveText(f.$('scanSummary')),liveText(f.$('scanStatus')));
 await f.scan();
 const row=f.rows()[0];
 const card=f.$('scanShortlist').children[0];
 const cells=row.children.slice(0,-1).map(liveText),status=liveText(f.$('scanDiscoverStatus'));
 samples.push(...cells,liveText(card.children[0]),liveText(card.children[1]),status,liveText(f.$('scanSummary')));
 assert.equal(cells[2],tr('כן')+' / '+tr('לא'));
 assert.equal(cells[5],code==='he'?'עולה':tr('up'));
 assert.equal(cells[11],code==='he'?'לונג / שורט':tr('long')+' / '+tr('short'));
 assert.match(cells[0],/^QA · 2026-11-18$/);assert.match(status,/2026-11-19T11:00:00.000Z/);
 row.children.at(-1).children[1].click();
 const details=f.$('scanResearchDetails');
 const description=liveText(details.children[1]);
 samples.push(...details.children.map(liveText));
 assert.equal(details.hidden,false);assert.match(description,/2026-11-18/);
 f.filters({minPrice:10});samples.push(liveText(f.$('scanSummary')),liveText(f.$('scanStatus')),liveText(f.rows()[0].children[1]));
 if(code==='he'){assert.match(status,/ממתין לרענון/);assert.match(description,/כיסוי נפח המסחר/);}
 else {
  for(const sample of samples)assert.doesNotMatch(sample,/[\u0590-\u05ff]/,code+': '+sample);
  f.setLanguage('he',createTranslator());assert.equal(liveText(f.rows()[0].children[2]),'כן / לא');assert.match(details.children[1].textContent,/כיסוי נפח המסחר/);
 }
});
