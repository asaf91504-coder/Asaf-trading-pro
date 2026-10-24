import test from 'node:test';
import assert from 'node:assert/strict';
import {patternResearch,measuredScenario} from '../pattern-research.mjs';
import {scanBars,screenResult} from '../scanner-core.mjs';
import {planPosition} from '../risk-planner.mjs';
const toBars=closes=>closes.map((close,i)=>({date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:close-.2,high:close+1,low:close-1,close,volume:i===closes.length-1?200:100}));
export function doubleBottomFixture(){const knots=[[0,130],[8,115],[12,100],[18,120],[24,101],[28,116],[29,123]],closes=[];for(let i=0;i<30;i++){const right=knots.findIndex(k=>k[0]>=i);if(right===0)closes.push(knots[0][1]);else{const [a,x]=knots[right-1],[b,y]=knots[right];closes.push(x+(y-x)*(i-a)/(b-a))}}return toBars(closes)}
test('range levels exclude the latest candle and breakout targets are geometry, not forecast prices',()=>{
 const input=toBars(Array(20).fill(100).concat(110)),before=JSON.stringify(input),r=patternResearch(input),c=r.candidates.find(c=>c.kind==='breakout20');
 assert.equal(r.support20,99);assert.equal(r.resistance20,101);assert.equal(c.stage,'crossed');assert.equal(c.scenario,null); // target 103 is already below current close 110.
 assert.equal(JSON.stringify(input),before);assert.ok(r.limitations.some(t=>t.includes('not predictions')));
});
test('double bottom retains both confirmed pivot dates, neckline and a measured scenario',()=>{
 const r=patternResearch(doubleBottomFixture()),c=r.candidates.find(c=>c.kind==='doubleBottom');assert.ok(c);assert.equal(c.firstLowDate,'2025-01-13');assert.equal(c.secondLowDate,'2025-01-25');assert.equal(c.trigger,121);assert.equal(c.support,99);assert.equal(c.stage,'crossed');assert.equal(c.targetFromHeight,143);assert.equal(c.scenario.entry,123);assert.equal(c.scenario.stop,98.01);assert.ok(c.scenario.movePercent>15);
 const waiting=patternResearch(doubleBottomFixture().slice(0,-1)).candidates.find(c=>c.kind==='doubleBottom');assert.equal(waiting.stage,'waiting');assert.equal(waiting.scenario.entry,121);
});
test('patterns never use unconfirmed lows or later bars and invalidate broken support',()=>{
 const input=doubleBottomFixture();assert.ok(!patternResearch(input.slice(0,26)).candidates.some(c=>c.kind==='doubleBottom'));
 const broken=input.map(b=>({...b}));broken.at(-1).low=90;broken.at(-1).close=92;broken.at(-1).open=92;assert.ok(!patternResearch(broken).candidates.some(c=>c.kind==='doubleBottom'));
 assert.equal(patternResearch(input).candidates.find(c=>c.kind==='doubleBottom').stage,'crossed');
});
test('squeeze ranks current Bollinger width against 60 prior values and needs full warmup',()=>{
 const input=toBars(Array.from({length:80},(_,i)=>i<60?100+(i%2?10:-10):100)),r=patternResearch(input);assert.equal(r.bollingerWidthPercent,0);assert.equal(r.bollingerWidthPercentile,0);assert.ok(r.candidates.some(c=>c.kind==='squeeze'));assert.equal(patternResearch(input.slice(0,79)).bollingerWidthPercentile,null);
});
test('opening gap uses the opening price, remains unavailable without it, and is not labelled a breakout',()=>{
 const input=toBars(Array(21).fill(100));input.at(-1).open=103;input.at(-1).high=104;const r=patternResearch(input),gap=r.candidates.find(c=>c.kind==='gapUp');assert.ok(Math.abs(gap.gapPercent-3)<1e-10);assert.equal(gap.stage,'observed');assert.equal(gap.scenario,null);input.at(-1).open=null;assert.equal(patternResearch(input).gapOpenPercent,null);assert.ok(!patternResearch(input).candidates.some(c=>c.kind==='gapUp'));
});
test('insufficient, intraday, unsorted and impossible-date inputs fail without inventing levels',()=>{
 const input=toBars(Array(21).fill(100));for(const bars of [[],input.slice(0,20),[{...input[0],date:'2025-01-01 09:30:00'},...input.slice(1)],input.toReversed(),[{...input[0],date:'2025-02-30'},...input.slice(1)]]){const r=patternResearch(bars);assert.equal(r.available,false);assert.deepEqual(r.candidates,[])}
});
test('scenario filters apply to the selected candidate and reject invalid or absent targets',()=>{
 const r=scanBars('QA.PATTERN',doubleBottomFixture());assert.equal(screenResult(r,{pattern:'doubleBottom',crossedOnly:true,minMeasuredMove:15}).matches,true);
 assert.equal(screenResult(r,{pattern:'doubleBottom',crossedOnly:true,minScenarioRR:2}).matches,false);assert.equal(screenResult(r,{pattern:'gapUp',minMeasuredMove:15}).matches,false);assert.equal(screenResult(r,{pattern:'unknown'}).matches,false);assert.equal(screenResult(r,{minMeasuredMove:NaN}).matches,false);
 assert.equal(measuredScenario('short',90,95,100,80).target,80);assert.equal(measuredScenario('short',90,95,100,-5),null);assert.equal(measuredScenario('unknown',90,95,100,80),null);
});

test('scanner never fabricates a 15 percent target when no measured scenario exists',()=>{
 const flat=scanBars('QA.FLAT',toBars(Array(80).fill(100)));assert.equal(screenResult(flat,{above20:false,pattern:'squeeze'}).matches,true);assert.equal(screenResult(flat,{above20:false,pattern:'squeeze',minMeasuredMove:15}).matches,false);assert.equal(screenResult(flat,{above20:false,pattern:'consolidation',crossedOnly:true}).matches,false);
});
test('selecting a gap cannot borrow a measured target from another candidate on the same stock',()=>{
 const input=doubleBottomFixture();input.at(-1).open=125;input.at(-1).high=126;const record=scanBars('QA.MULTI',input);
 assert.ok(record.research.candidates.some(c=>c.kind==='gapUp'));assert.equal(screenResult(record,{pattern:'gapUp'}).matches,true);assert.equal(screenResult(record,{pattern:'gapUp',minMeasuredMove:15}).matches,false);assert.equal(screenResult(record,{pattern:'doubleBottom',minMeasuredMove:15}).matches,true);
});
test('a measured scenario passes unchanged into the existing capital-bounded risk planner',()=>{
 const scenario=patternResearch(doubleBottomFixture()).candidates.find(c=>c.kind==='doubleBottom').scenario,result=planPosition({...scenario,account:10000,riskPercent:1,budget:10000});
 assert.equal(result.shares,4);assert.ok(result.actualRisk<=100);assert.ok(result.positionValue<=10000);assert.ok(Math.abs(result.ratio-scenario.riskReward)<1e-10);assert.ok(result.ratio<1);
});
