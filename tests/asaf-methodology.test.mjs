import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewScannerMethodology,screenWithMethodology} from '../server/asaf-methodology.mjs';
const now=Date.now();
function fixture(){
 const bars=Array.from({length:21},(_,i)=>({date:new Date(Date.UTC(2026,9,i+1)).toISOString().slice(0,10),open:100,high:104,low:96,close:i===20?102:100,volume:i===20?200:100}));
 return {symbol:'QA',bars,interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,
  summary:{date:bars.at(-1).date,close:102,aboveMA20:true,aboveMA150:false,volumeRatio:2},
  fundamentals:{status:'available',source:'Twelve Data',currency:'USD',symbol:'QA',marketCap:1e9,receivedAt:new Date(now).toISOString()},
  volumeComparison:{status:'verified',coverage:'consolidated',aboveAverage:true},research:{available:true,candidates:[{kind:'doubleBottom',stage:'waiting',scenario:{side:'long',entry:103,stop:90,target:125,movePercent:21.36,riskReward:99}}]}};
}
test('methodology requires user gates, treats MA150 as context and uses exact ATR risk',()=>{
 const r=fixture(),before=JSON.stringify(r),out=screenWithMethodology(r,{}, {now});
 assert.equal(out.screen.matches,true);assert.equal(out.methodology.stage,'waiting');assert.equal(out.methodology.ma150Context,false);
 const scenario=out.record.research.candidates[0].scenario;
 assert.equal(scenario.stop,87);assert.equal(scenario.riskReward,22/16);assert.equal(JSON.stringify(r),before);
 assert.equal(screenWithMethodology(r,{minScenarioRR:2},{now}).screen.matches,false);
});
test('missing cap, partial volume, open candles and unsupported targets never pass even with permissive filters',()=>{
 for(const patch of [{fundamentals:null},{volumeComparison:{status:'verified',coverage:'partial',aboveAverage:true}},{latestBarMayBePartial:true},{summary:{...fixture().summary,close:5}},{research:{available:true,candidates:[]}},{research:{available:true,candidates:[{stage:'crossed',scenario:{side:'long',entry:103,target:110}}]}}]){
  const out=screenWithMethodology({...fixture(),...patch},{minPrice:0,minMarketCap:0,minVolume:0,above20:false},{now});
  assert.equal(out.screen.matches,false);assert.ok(out.screen.reasons.length);
 }
});
test('waiting, new crossing and extended moves remain distinct and gap/earnings risks are explicit',()=>{
 for(const stage of ['waiting','crossed','above']){
  const r=fixture();r.research.candidates[0].stage=stage;r.research.gapOpenPercent=3;
  const {methodology}=reviewScannerMethodology(r,{now});assert.equal(methodology.stage,stage);assert.equal(methodology.eligible,true);
  assert.match(methodology.warnings.join(' '),/פער פתיחה/);assert.match(methodology.warnings.join(' '),/דוחות/);
 }
 const r=fixture();r.research.candidates[0].scenario.side='short';assert.equal(reviewScannerMethodology(r,{now}).methodology.eligible,false);
});

test('a cached pattern cannot retain old potential after price has moved near or past its target',()=>{
 for(const close of [120,125,130]){
  const r=fixture();r.summary.close=close;r.research.candidates[0].stage='above';
  const out=screenWithMethodology(r,{}, {now});assert.equal(out.screen.matches,false,close);
  assert.equal(out.methodology.checks.find(x=>x.key==='pattern').passed,false);
  const scenario=out.record.research.candidates[0].scenario;
  if(scenario){assert.equal(scenario.entry,close);assert.equal(scenario.entry-scenario.stop,16);assert.equal(scenario.movePercent,(125-close)/close*100);}
 }
});

test('only implemented long-pattern geometry qualifies, without inventing cup-and-handle detection',()=>{
 for(const kind of ['breakout20','doubleBottom','downtrendBreak','inverseHeadShoulders']){
  const r=fixture();r.research.candidates[0].kind=kind;assert.equal(reviewScannerMethodology(r,{now}).methodology.eligible,true,kind);
 }
 for(const kind of ['cupAndHandle','gapUp','squeeze','unknown']){
  const r=fixture();r.research.candidates[0].kind=kind;assert.equal(reviewScannerMethodology(r,{now}).methodology.eligible,false,kind);
 }
});
