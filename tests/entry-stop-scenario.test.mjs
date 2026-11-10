import test from 'node:test';
import assert from 'node:assert/strict';
import {entryStopScenario,entryStopText,scenarioSide} from '../entry-stop-scenario.mjs';
import {requestsChartAnalysis} from '../chart-analysis-request.mjs';
const bars=Array.from({length:40},(_,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:100,high:102,low:99,close:101,volume:1000}));
const meta={provenance:'server-provider-cache',source:'Twelve Data',interval:'1day',latestBarMayBePartial:false};

test('long and short scenarios use actual range and ATR with opposite invalidation edges',()=>{
 const original=JSON.stringify(bars),long=entryStopScenario(bars,meta),short=entryStopScenario(bars,meta,'short');
 assert.equal(long.available,true);assert.equal(long.atr14,3);assert.equal(long.entry,102.75);assert.equal(long.stop,98.25);
 assert.equal(short.entry,98.25);assert.equal(short.stop,102.75);assert.equal(long.stage,'waiting');
 assert.equal(JSON.stringify(bars),original);assert.equal(long.asOf,bars.at(-1).date);
 assert.match(entryStopText(long),/נקודת כניסה מותנית: 102.75/);assert.match(entryStopText(long),/סטופ־לוס לתרחיש: 98.25/);
 assert.match(entryStopText(short),/סגירת נר מתחת/);assert.match(entryStopText(long),/לא מהתיק/);
});
test('a possibly open last candle cannot move entry/stop or the scenario timestamp',()=>{
 const partial={...bars.at(-1),open:100,high:999999,low:1,close:999999};
 const plan=entryStopScenario([...bars.slice(0,-1),partial],{...meta,latestBarMayBePartial:true});
 assert.equal(plan.entry,102.75);assert.equal(plan.stop,98.25);assert.equal(plan.asOf,bars.at(-2).date);assert.equal(plan.excludedLatest,true);
 assert.equal(entryStopScenario(bars.slice(0,21),{...meta,latestBarMayBePartial:undefined}).available,false);
});
test('missing, browser supplied, malformed or flat data never produce invented prices',()=>{
 const cases=[entryStopScenario(bars,{}),entryStopScenario(null,meta),entryStopScenario(bars.slice(0,20),meta),entryStopScenario(bars,meta,'both'),entryStopScenario(bars.map(b=>({...b,open:null})),meta),entryStopScenario([...bars].reverse(),meta),entryStopScenario(bars.map(b=>({...b,open:100,high:100,low:100,close:100})),meta)];
 for(const plan of cases){assert.equal(plan.available,false);assert.equal(plan.entry,undefined);assert.equal(plan.stop,undefined);assert.match(entryStopText(plan),/נקודת כניסה: לא זמינה/);assert.match(entryStopText(plan),/סטופ־לוס: לא זמין/)}
});
test('an already crossed level requires a retest instead of an immediate entry claim',()=>{
 const last={...bars.at(-1),open:103,high:105,low:102,close:104};
 const plan=entryStopScenario([...bars.slice(0,-1),last],meta);
 assert.equal(plan.stage,'already-crossed');assert.match(entryStopText(plan),/אין כאן הנחיית כניסה מיידית/);
});
test('entry/stop requests prepare chart analysis while lessons and general chat do not',()=>{
 for(const text of ['נתח','איפה נקודת כניסה וסטופ לוס?','נתח את הגרף עם סטופ־לוס','entry price and stop loss','מה נקודת הכניסה והסטופ לוס לגרף?'])assert.equal(requestsChartAnalysis(text),true,text);
 for(const text of ['מה זה סטופ לוס?','איך קובעים נקודת כניסה?','what is a stop loss?','שלום'])assert.equal(requestsChartAnalysis(text),false,text);
 assert.equal(scenarioSide('נתח את הגרף'),'long');assert.equal(scenarioSide('נתח תרחיש שורט'),'short');
});
