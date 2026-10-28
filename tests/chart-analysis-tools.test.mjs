import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeChartTools,cupHandleCandidate} from '../chart-analysis-tools.mjs';

function series(knots){return Array.from({length:knots.at(-1)[0]+1},(_,i)=>{const k=knots.findIndex(([index])=>index>=i),close=k===0?knots[0][1]:knots[k-1][1]+(knots[k][1]-knots[k-1][1])*(i-knots[k-1][0])/(knots[k][0]-knots[k-1][0]);return {date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:close,close,high:close+1,low:close-1,volume:1000};});}
const shoulders=()=>series([[0,80],[10,100],[17,90],[25,115],[32,90],[40,101],[45,96],[46,87]]);
const cup=()=>series([[0,80],[10,100],[20,82],[28,76],[36,75],[44,77],[52,84],[62,100],[68,93],[72,98]]);
const assertSafe=(result,bars)=>{assert.ok(result.annotations.length<=12);for(const a of result.annotations){assert.equal(a.candidate,true);assert.ok(a.points.length>=2&&a.points.length<=9);assert.ok(a.label.length<=160);assert.equal(a.probability,undefined);for(const p of a.points){assert.ok(bars.some(b=>b.date===p.date));assert.ok(Number.isFinite(p.price)&&p.price>0);}}assert.ok(result.limitations.length);};

test('support and resistance exclude the latest potentially incomplete candle',()=>{
 const bars=series([[0,90],[29,119]]);bars.at(-1).high=1000;bars.at(-1).low=1;
 const r=analyzeChartTools({bars,kind:'supportResistance'});assert.equal(r.annotations.length,2);
 assert.equal(r.annotations[0].points[0].price,98);assert.equal(r.annotations[1].points[0].price,119);assertSafe(r,bars);
});
test('three confirmed descending peaks form a bounded native trend line',()=>{
 const bars=series([[0,85],[5,110],[10,90],[15,105],[20,85],[25,100],[30,82],[35,95],[40,80]]),r=analyzeChartTools({bars,kind:'trendlines'});
 assert.ok(r.annotations.some(a=>a.kind==='trendline'));assertSafe(r,bars);
 // Newest two candles cannot manufacture confirmed pivot points.
 assert.ok(r.annotations.every(a=>a.points.every(p=>p.date<bars.at(-3).date)));
});
test('existing head-and-shoulders geometry becomes candidate polyline plus neckline',()=>{
 const bars=shoulders(),r=analyzeChartTools({bars,kind:'headShoulders'});
 assert.deepEqual(r.annotations.map(a=>a.kind),['headShoulders','neckline']);assert.equal(r.annotations[0].points.length,5);assertSafe(r,bars);
 const inverse=bars.map(b=>({...b,open:220-b.open,close:220-b.close,high:220-b.low,low:220-b.high})),ir=analyzeChartTools({bars:inverse,kind:'inverseHeadShoulders'});
 assert.equal(ir.annotations[0].kind,'inverseHeadShoulders');assertSafe(ir,inverse);
});
test('double top and bottom annotate the two pivots and actual intervening neckline point',()=>{
 const bars=series([[0,130],[8,115],[12,100],[18,120],[24,101],[28,116],[29,123]]),bottom=analyzeChartTools({bars,kind:'doubleBottom'});
 assert.equal(bottom.annotations[0].kind,'doubleBottom');assert.equal(bottom.annotations[0].points.length,3);assert.equal(bottom.annotations[0].points[1].price,121);assertSafe(bottom,bars);
 const mirror=bars.map(b=>({...b,open:250-b.open,close:250-b.close,high:250-b.low,low:250-b.high})),top=analyzeChartTools({bars:mirror,kind:'doubleTop'});
 assert.equal(top.annotations[0].kind,'doubleTop');assert.equal(top.annotations[0].points[1].price,129);assertSafe(top,mirror);
});
test('conservative rounded cup with recovering shallow handle is a candidate, never certainty',()=>{
 const bars=cup(),candidate=cupHandleCandidate(bars);assert.ok(candidate);assert.equal(candidate.kind,'cupHandle');assert.equal(candidate.stage,'waiting');
 const r=analyzeChartTools({bars,kind:'cupHandle'});assert.equal(r.annotations.length,1);assert.equal(r.annotations[0].points.length,7);assertSafe(r,bars);assert.match(r.summary,/לא מדובר באישור לתבנית/);
});
test('V-shaped recovery and a handle deeper than half the cup are rejected',()=>{
 const v=series([[0,80],[10,100],[28,96],[36,75],[44,96],[62,100],[68,93],[72,98]]);assert.equal(cupHandleCandidate(v),null);
 const deep=cup();for(let i=64;i<71;i++){deep[i].low=80;deep[i].high=Math.max(deep[i].high,deep[i].close);}assert.equal(cupHandleCandidate(deep),null);
});
test('flat/no-match and intraday pattern data produce an explicit no-result instead of invented marks',()=>{
 const bars=series([[0,100],[70,100]]),r=analyzeChartTools({bars,kind:'patterns'});assert.deepEqual(r.annotations,[]);assert.match(r.summary,/לא נמצאה/);
 const intraday=cup().map(b=>({...b,date:b.date+' 10:00'})),i=analyzeChartTools({bars:intraday,kind:'cupHandle'});assert.deepEqual(i.annotations,[]);assert.match(i.summary,/דורש נרות יומיים/);
});
test('data validation rejects disorder, invalid prices, unsupported tools and excessive input',()=>{
 const bars=cup();assert.throws(()=>analyzeChartTools({bars,kind:'execute'}));
 const duplicate=structuredClone(bars);duplicate[1].date=duplicate[0].date;assert.throws(()=>analyzeChartTools({bars:duplicate,kind:'patterns'}));
 const bad=structuredClone(bars);bad[3].low=-1;assert.throws(()=>analyzeChartTools({bars:bad,kind:'patterns'}));
 assert.throws(()=>analyzeChartTools({bars:Array(2001).fill(bars[0]),kind:'patterns'}));assert.throws(()=>analyzeChartTools({bars:[],kind:'patterns'}));
});
test('analysis does not mutate source candles and outputs point dates within trailing 200 bars',()=>{
 const bars=series([[0,80],[250,120]]),original=structuredClone(bars),r=analyzeChartTools({bars,kind:'supportResistance'});
 assert.deepEqual(bars,original);assertSafe(r,bars.slice(-200));
});
