import test from 'node:test';
import assert from 'node:assert/strict';
import {advancedIndicators} from '../advanced-indicators.mjs';
import {chartIndicators} from '../chart-indicators.mjs';
import {drawingFromAnchors,drawingTradePlan} from '../chart-styles.mjs';
import {patternResearch} from '../pattern-research.mjs';
import {personalData,personalBackup,parsePersonalBackup,mergePersonal} from '../personal-data.mjs';
import {alertRules,alertCandidate} from '../alert-core.mjs';
import {createAlertsHandler} from '../netlify/functions/alerts.mjs';
import {fixture,env,request,seed} from './identity-fixture.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const bars=(n=100)=>Array.from({length:n},(_,i)=>({date:new Date(Date.UTC(2026,5,i+1)).toISOString().slice(0,10),open:100+i-.2,high:101+i,low:99+i,close:100+i,volume:100}));
test('session VWAP weights actual volume and resets on supplied intraday date, never on daily bars',()=>{
 const input=[{date:'2026-10-22 09:30',high:12,low:9,close:9,volume:10},{date:'2026-10-22 09:31',high:24,low:18,close:18,volume:30},{date:'2026-10-23 09:30',high:33,low:27,close:30,volume:20}];
 assert.deepEqual(advancedIndicators(input).vwap,[10,17.5,30]);assert.ok(advancedIndicators(bars()).vwap.every(x=>x===null));
 input[1].volume=null;input.splice(2,0,{...input[0],date:'2026-10-22 09:32',volume:100});assert.deepEqual(advancedIndicators(input).vwap,[10,null,null,30]);
 input[0].volume=0;assert.equal(advancedIndicators(input).vwap[0],null);
});
test('Ichimoku uses high/low midpoints and displaces cloud exactly 26 candles within loaded data',()=>{
 const all=advancedIndicators(bars());assert.equal(all.tenkan[7],null);assert.equal(all.tenkan[8],104);assert.equal(all.kijun[24],null);assert.equal(all.kijun[25],112.5);assert.equal(all.cloudA[50],null);assert.equal(all.cloudA[51],(121+112.5)/2);assert.equal(all.cloudB[76],null);assert.equal(all.cloudB[77],125.5);
 const short=advancedIndicators(bars(80));for(const key of Object.keys(short))assert.deepEqual(short[key],all[key].slice(0,80));
});
test('new drawing tools preserve exact anchors, user text and positive long/short reference geometry',()=>{
 const b=bars(2),long=drawingFromAnchors(b,'long',{date:b[0].date,price:100,rr:3},{date:b[1].date,price:95});assert.deepEqual(drawingTradePlan(...long),{side:'long',entry:100,stop:95,target:115,rr:3,risk:5});
 const short=drawingFromAnchors(b,'short',{date:b[0].date,price:100,rr:2},{date:b[1].date,price:105});assert.equal(drawingTradePlan(...short).target,90);
 const text=drawingFromAnchors(b,'text',{date:b[0].date,price:100,text:'רמת בדיקה'},null);assert.equal(text[0].text,'רמת בדיקה');assert.equal(text[1].index,text[0].index);
 assert.throws(()=>drawingFromAnchors(b,'long',{date:b[0].date,price:100,rr:2},{date:b[1].date,price:105}));assert.throws(()=>drawingFromAnchors(b,'short',{date:b[0].date,price:1,rr:100},{date:b[1].date,price:2}));assert.throws(()=>drawingFromAnchors(b,'text',{date:b[0].date,price:100,text:' '},null));
});
test('account drawing backups keep text and target ratio without introducing execution instructions',()=>{
 const value={'QA.TEST':{savedAt:1,lines:[[{date:'2026-10-01',price:100,tool:'long',rr:3},{date:'2026-10-02',price:95,tool:'long',rr:3}],[{date:'2026-10-01',price:100,tool:'text',text:'מבחן'},{date:'2026-10-01',price:100,tool:'text',text:'מבחן'}]]}};
 assert.deepEqual(parsePersonalBackup(JSON.stringify(personalBackup('drawings',value)),'drawings'),value);
 const bad=structuredClone(value);bad['QA.TEST'].lines[0][0].rr=1000;assert.throws(()=>personalData('drawings',bad));
});
function knots(values){return bars(values.at(-1)[0]+1).map((b,i)=>{const k=values.findIndex(([j])=>j>=i);const close=k===0?values[0][1]:(()=>{const [x,a]=values[k-1],[y,z]=values[k];return a+(z-a)*(i-x)/(y-x)})();return {...b,close,open:close-.2,high:close+1,low:close-1}})}
test('double top is a checked bearish scenario, with known neckline and measured target',()=>{
 const original=knots([[0,130],[8,115],[12,100],[18,120],[24,101],[28,116],[29,123]]),mirrored=original.map(b=>({...b,close:250-b.close,open:250-b.open,high:250-b.low,low:250-b.high})),research=patternResearch(mirrored),candidate=research.candidates.find(c=>c.kind==='doubleTop');
 assert.equal(candidate.stage,'crossed');assert.equal(candidate.trigger,129);assert.equal(candidate.resistance,151);assert.equal(candidate.scenario.side,'short');assert.equal(candidate.scenario.target,107);near(candidate.scenario.stop,152.51);
 mirrored.at(-1).high=160;assert.equal(patternResearch(mirrored).candidates.some(c=>c.kind==='doubleTop'),false);
});
test('descending trend break requires three confirmed falling pivots and a fresh close crossing',()=>{
 const input=knots([[0,140],[10,149],[15,110],[20,139],[25,105],[30,129],[34,120],[35,127]]),c=patternResearch(input).candidates.find(c=>c.kind==='downtrendBreak');assert.ok(c);assert.equal(c.trigger,125);assert.equal(c.slopePerBar,-1);assert.equal(c.pivotDates.length,3);assert.equal(c.scenario.side,'long');
 input.at(-1).close=124;input.at(-1).low=123;assert.equal(patternResearch(input).candidates.some(c=>c.kind==='downtrendBreak'),false);
});
const layout=(id='layout-1')=>({id,name:'גרף יומי',symbol:'NASDAQ:AAPL',interval:'1day',range:120,preferences:{style:'line',chartVWAP:false,chartIchimoku:true},saved:'2026-10-24T12:00:00Z'});
test('layouts round trip through account schema, backup and merge with explicit remote priority',()=>{
 const local=layout(),remote={...layout(),name:'מהחשבון'};assert.deepEqual(parsePersonalBackup(JSON.stringify(personalBackup('layouts',[local])),'layouts'),[local]);const merged=mergePersonal('layouts',[local,layout('local')],[remote]);assert.equal(merged.length,2);assert.equal(merged[0].name,'מהחשבון');
});
test('layouts reject duplicate IDs, excessive records, unknown periods and unsafe indicator values',()=>{
 for(const patch of [{interval:'fake'},{range:100000},{name:''},{symbol:'<script>'},{preferences:{chartVWAP:'true'}}])assert.throws(()=>personalData('layouts',[{...layout(),...patch}]));assert.throws(()=>personalData('layouts',[layout(),layout()]));assert.throws(()=>personalData('layouts',Array.from({length:11},(_,i)=>layout('id-'+i))));
});
const rule=(kind='macd-up')=>({id:'11111111-1111-1111-1111-111111111111',symbol:'AAPL',kind,level:null,enabled:true,quiet:false,quietStart:22,quietEnd:7,createdAt:0});
test('MACD alerts trigger on a real new crossover from equality without replay on unchanged bars',()=>{
 const input=bars(40).map(b=>({...b,high:101,low:99,open:100,close:100}));input.at(-1).high=111;input.at(-1).close=110;const now=Date.parse(input.at(-1).date)+86400000+1000;
 const event=alertCandidate(rule(),input,now);assert.ok(event);assert.equal(event.kind,'macd-up');assert.equal(alertCandidate({...rule(),enabled:false},input,now),null);assert.equal(alertCandidate(rule('macd-down'),input,now),null);assert.equal(alertCandidate(rule(),input.slice(0,-1),now),null);
});
test('Supertrend alerts use flips, not repeated above-band status; bad calendars never fire',()=>{
 const input=bars(21).map(b=>({...b,high:101,low:99,open:100,close:100}));input.at(-1).high=111;input.at(-1).low=109;input.at(-1).close=110;const now=Date.parse(input.at(-1).date)+86400000+1000;
 assert.ok(alertCandidate(rule('supertrend-up'),input,now));assert.equal(alertCandidate(rule('supertrend-down'),input,now),null);input[1].date='2026-02-30';assert.equal(alertCandidate(rule('supertrend-up'),input,now),null);
});
test('expanded alert kinds validate bounded ADX levels and normalize indicator-only levels',()=>{
 assert.equal(alertRules([{...rule('ma20-down'),level:55}])[0].level,null);assert.equal(alertRules([{...rule('adx-up'),level:25}])[0].level,25);assert.throws(()=>alertRules([{...rule('adx-up'),level:101}]));
});
test('users can save inactive alert drafts before a provider exists, without provider requests',async()=>{
 const state=fixture(),user=seed(state),handler=createAlertsHandler({env:{...env,ASAF_MARKET_ENABLED:'false',ASAF_MARKET_ALLOWED_SYMBOLS:''},run:state.run});const saved=await handler(request('alerts',{memberId:user.record.id,revision:'',rules:[rule('supertrend-up')]},user.cookie,'PUT'));assert.equal(saved.status,200);const read=await(await handler(request('alerts',undefined,user.cookie))).json();assert.equal(read.pendingMarket,true);assert.equal(read.backgroundEnabled,false);assert.equal(read.rules.length,1);
});
