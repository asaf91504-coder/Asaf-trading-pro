import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {planPosition,positionInputErrors} from '../risk-planner.mjs';
import {alertRules,alertCandidate,alertSignature} from '../alert-core.mjs';
import {crossing,watchRecords,parseWorkspaceBackup} from '../workspace-core.mjs';
import {searchAssets,manualSymbol} from '../asset-search.mjs';

// Risk planner: result values, whole-share boundaries, short geometry and field-level recovery.
const base={account:10000,riskPercent:2,entry:100,stop:95,target:115,budget:10000};
const plans=[
 ['fractional risk share rounds down',{riskPercent:.11},[2,10,200,30,3,false]],
 ['risk smaller than per-share loss returns zero',{riskPercent:.01},[0,0,0,0,3,false]],
 ['precise one-share capital threshold',{budget:100},[1,5,100,15,3,true]],
 ['sub-threshold capital returns no position',{budget:99.999},[0,0,0,0,3,true]],
 ['ties leave capital limiting flag false',{budget:4000},[40,200,4000,600,3,false]],
 ['short target profit uses distance from entry',{side:'short',stop:120,target:40},[10,200,1000,600,3,false]],
 ['short without target preserves unknown reward',{side:'short',stop:110,target:undefined,budget:250},[2,20,200,null,null,true]],
 ['position budget above account cannot bypass capital cap',{riskPercent:100,budget:20000},[100,500,10000,1500,3,true]],
 ['fractional asset prices retain position units',{entry:12.5,stop:10,target:17.5,budget:27.25},[2,5,25,10,2,true]],
 ['zero reward is not manufactured for absent target',{target:null,riskPercent:.01},[0,0,0,null,null,false]],
 ['target profit and ratio need not be whole numbers',{entry:100.5,stop:98.5,target:103.5,budget:300},[2,4,201,6,1.5,true]],
 ['100-percent boundary remains valid',{riskPercent:100,stop:75,target:150},[100,2500,10000,5000,2,true]],
];
for(const [label,patch,expected] of plans)test('workspace risk: '+label,()=>{
 const r=planPosition({...base,...patch});assert.deepEqual([r.shares,r.actualRisk,r.positionValue,r.targetProfit,r.ratio,r.capitalLimited],expected);
});
const fieldCases=[
 ['blank account and valid other fields',{account:undefined},['account']],
 ['negative percent',{riskPercent:-1},['riskPercent']],
 ['zero entry suppresses directional warnings',{entry:0,stop:500,target:1},['entry']],
 ['string entry is not numeric',{entry:'100'},['entry']],
 ['string stop is not numeric',{stop:'95'},['stop']],
 ['empty target cannot masquerade as omitted',{target:''},['target']],
 ['string target is not numeric',{target:'115'},['target']],
 ['null allocation remains required in core',{budget:null},['budget']],
 ['zero allocation is not treated as unlimited',{budget:0},['budget']],
 ['invalid direction does not misdiagnose stop or target',{side:'flat',stop:110,target:90},['side']],
 ['both invalid price relationships are surfaced in a short',{side:'short',stop:99,target:101},['stop','target']],
 ['incomplete short with omitted target only flags invalid stop',{side:'short',stop:0,target:null},['stop']],
 ['repairing both invalid values clears all field warnings',{entry:104,stop:105,target:90,side:'short'},[]],
];
for(const [label,patch,keys] of fieldCases)test('workspace risk validation: '+label,()=>assert.deepEqual(Object.keys(positionInputErrors({...base,...patch})),keys));

// Daily account alerts: validate rule boundaries, evaluate only complete synthetic bars.
const now=Date.parse('2026-11-19T12:00:00Z');
const rule={id:'14345678-1234-1234-1234-123456789abc',symbol:'NASDAQ:AAPL',kind:'price-up',level:100,enabled:true,quiet:false,quietStart:22,quietEnd:7,createdAt:Date.parse('2026-11-16')};
const ruleCases=[
 ['exchange-qualified symbol retained',{symbol:'NYSE:BRK.B'},true],
 ['maximum equity symbol size accepted',{symbol:'ABCDEFGHIJKLMNOPQRST'},true],
 ['symbol beyond size limit rejected',{symbol:'ABCDEFGHIJKLMNOPQRSTZ'},false],
 ['unknown alert kind rejected',{kind:'momentum'},false],
 ['numeric enabled flag rejected',{enabled:1},false],
 ['quiet start must be a whole hour',{quietStart:6.5},false],
 ['quiet end cannot be midnight as hour 24',{quietEnd:24},false],
 ['equal quiet endpoints allowed while quiet mode disabled',{quietStart:8,quietEnd:8},true],
 ['equal quiet endpoints rejected while quiet mode enabled',{quiet:true,quietStart:8,quietEnd:8},false],
 ['maximum price threshold accepted',{level:1e9},true],
 ['RSI exactly 100 accepted',{kind:'rsi-up',level:100},true],
 ['indicator-level-independent rule discards leftover price',{kind:'ma20-up',level:900},true,null],
];
for(const [label,patch,valid,expectedLevel] of ruleCases)test('workspace alert validation: '+label,()=>{
 const input={...rule,...patch};
 if(!valid)return assert.throws(()=>alertRules([input]));
 const [saved]=alertRules([input]);assert.equal(saved.symbol,input.symbol);assert.equal(saved.level,expectedLevel===undefined?input.level:expectedLevel);assert.equal(saved.createdAt,undefined);
});
const bar=(d,close)=>({date:d,high:close+1,low:close-1,close});
const two=(a,b)=>[bar('2026-11-17',a),bar('2026-11-18',b)];
const eventCases=[
 ['upward hit precisely at level',{},{},two(98,100),100],
 ['downward hit precisely at level',{kind:'price-down'},{},two(102,100),100],
 ['starting exactly at upper threshold is not a new crossing',{},{},two(100,103),null],
 ['starting exactly at lower threshold is not a new crossing',{kind:'price-down'},{},two(100,97),null],
 ['quiet window includes start hour',{quiet:true,quietStart:12,quietEnd:14},{},two(99,101),null],
 ['quiet window excludes end hour',{quiet:true,quietStart:8,quietEnd:12},{},two(99,101),101],
 ['duplicate session candle invalidates evaluation',{},{},[bar('2026-11-18',99),bar('2026-11-18',101)],null],
 ['daily source label stays attached to event',{},{source:'Offline test data'},two(99,101),101],
 ['valid intraday candle is ignored when the last closed daily bars crossed',{},{},[...two(99,101),bar('2026-11-19 10:30:00',98)],101],
 ['end of candle before creation cannot backfire',{createdAt:Date.parse('2026-11-19T01:00Z')},{},two(99,101),null],
 ['identical candle produces stable account event identity',{},{},two(97,103),103],
];
for(const [label,patch,options,bars,expected] of eventCases)test('workspace alert timing: '+label,()=>{
 const item={...rule,...patch};
 const event=alertCandidate(item,bars,now,options);
 if(expected===null)return assert.equal(event,null);
 assert.equal(event.close,expected);assert.equal(event.barTime,'2026-11-18');assert.equal(event.source,options.source||'Twelve Data');
 assert.equal(event.key,item.id+':2026-11-18:'+alertSignature(item));
});

// Watchlist: backup contract and local threshold event behavior.
const wrap=watch=>JSON.stringify({kind:'asaf-workspace',version:1,watch});
const watchChecks=[
 ['one malformed slot does not remove valid neighbor',()=>assert.deepEqual(watchRecords([null,{symbol:'msft',note:'earnings'}]),[{symbol:'MSFT',note:'earnings',level:null}])],
 ['keeps notes with line breaks',()=>assert.equal(watchRecords([{symbol:'TSLA',note:'earnings\nvolume'}])[0].note,'earnings\nvolume')],
 ['long note truncated independently of price',()=>assert.deepEqual(watchRecords([{symbol:'QQQ',note:'X'.repeat(1200),level:400.25}])[0],{symbol:'QQQ',note:'X'.repeat(1000),level:400.25})],
 ['non-string note cannot become rendered junk',()=>assert.equal(watchRecords([{symbol:'SPY',note:['check']}])[0].note,'')],
 ['exact duplicate with same exchange keeps first note',()=>assert.equal(watchRecords([{symbol:'NASDAQ:msft',note:'first'},{symbol:'NASDAQ:MSFT',note:'later'}])[0].note,'first')],
 ['distinct exchange qualifiers remain distinct',()=>assert.equal(watchRecords(['NASDAQ:ABC','NYSE:ABC']).length,2)],
 ['decimal note level from backup round-trips exactly',()=>assert.equal(parseWorkspaceBackup(wrap([{symbol:'ETHUSD',note:'price',level:3456.125}]))[0].level,3456.125)],
 ['backup with unsupported version rejected',()=>assert.throws(()=>parseWorkspaceBackup('{"kind":"asaf-workspace","version":2,"watch":[]}'))],
 ['empty backup yields no phantom watchlist entries',()=>assert.deepEqual(parseWorkspaceBackup(wrap([])),[])],
 ['threshold crossed upward at exact endpoint',()=>assert.equal(crossing(98,100,100),'up')],
 ['threshold touched while starting at same price does not refire',()=>assert.equal(crossing(100,100,100),null)],
 ['non-finite cached quote cannot create a watch alert',()=>assert.equal(crossing(100,Infinity,101),null)],
];
for(const [label,run] of watchChecks)test('workspace watchlist: '+label,run);

// Search: catalogue market filters plus deterministic open/close/reopen races.
const checks=[
 ['provider symbol beyond local catalogue is still discoverable',()=>assert.equal(searchAssets('QAXYZ','stock',['QAXYZ'])[0].symbol,'QAXYZ')],
 ['provider stock restriction does not hide available crypto shortcuts',()=>assert.equal(searchAssets('Bitcoin','crypto',[])[0].symbol,'BTCUSD')],
 ['index-only stock filter excludes crypto even with exact symbol',()=>assert.deepEqual(searchAssets('BTCUSD','all',null,{group:'sp500'}),[])],
 ['manual ticker limit accepts exactly 30 characters',()=>assert.equal(manualSymbol('S'.repeat(30)),'S'.repeat(30))],
 ['manual ticker rejects exchange separator as first character',()=>assert.equal(manualSymbol(':AAPL'),null)],
 ['pagination offsets use consistent ordering',()=>{const all=searchAssets('','stock',null,{limit:4});assert.deepEqual(searchAssets('','stock',null,{offset:2,limit:2}),all.slice(2))}],
];
for(const [label,run] of checks)test('workspace asset search: '+label,run);
const src=readFileSync(new URL('../asset-search-ui.mjs',import.meta.url),'utf8');
const handler=src.slice(src.indexOf('trigger.onclick=async()=>'),src.indexOf(";dialog.addEventListener('close'"));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
const success=symbol=>({ok:true,json:async()=>({enabled:true,symbols:[symbol]})});
function openTwice(){
 const requests=[deferred(),deferred()],history=[];
 const d={open:false,showModal(){this.open=true}};
 const f={trigger:{},dialog:d,input:{focus(){}},availableSymbols:null,availabilityAttempt:0,AbortSignal,status:{textContent:''},
  render(){history.push(f.availableSymbols);f.status.textContent='catalogue'},reset(){f.render()},fetch:()=>requests.shift().promise};
 vm.createContext(f);vm.runInContext(handler,f);
 const [older,newer]=requests;const old=f.trigger.onclick();d.open=false;const latest=f.trigger.onclick();
 return {older,newer,old,latest,f,history};
}
test('workspace asset search: stale success cannot replace newer server availability',async()=>{
 const x=openTwice();x.newer.resolve(success('NVDA'));await x.latest;x.older.resolve(success('AAPL'));await x.old;
 assert.deepEqual(x.f.availableSymbols,['NVDA']);assert.deepEqual(x.history,[null,null,['NVDA']]);
});
test('workspace asset search: stale failure cannot clear newer server availability',async()=>{
 const x=openTwice();x.newer.resolve(success('NVDA'));await x.latest;x.older.reject(Error('obsolete'));await x.old;
 assert.deepEqual(x.f.availableSymbols,['NVDA']);assert.equal(x.f.status.textContent,'catalogue');
});
test('workspace asset search: stale success cannot hide current availability failure',async()=>{
 const x=openTwice();x.newer.reject(Error('current connection error'));await x.latest;x.older.resolve(success('AAPL'));await x.old;
 assert.equal(x.f.availableSymbols,null);assert.match(x.f.status.textContent,/לא ניתן/);
});
test('workspace asset search: older response while newer request is pending cannot redraw active results',async()=>{
 const x=openTwice();x.older.resolve(success('AAPL'));await x.old;
 assert.equal(x.history.length,2);x.newer.resolve(success('NVDA'));await x.latest;
 assert.deepEqual(x.history,[null,null,['NVDA']]);
});
