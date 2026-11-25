import test from 'node:test';
import assert from 'node:assert/strict';
import {screenWithMethodology} from '../server/asaf-methodology.mjs';
import {ventureScanRecord} from '../server/venture-presentation.mjs';
import {rankedScannerCandidates} from '../scanner-candidates.mjs';
import {scannerOpportunityKeys,scannerOpportunityTranslations} from '../scanner-opportunity-copy.mjs';
import {createTranslator} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {asafScannerPreset} from '../scanner-presets.mjs';
const now=Date.now();
function sample(side='long',symbol='QA'){
 const short=side==='short',close=short?98:102;
 const bars=Array.from({length:21},(_,i)=>({date:new Date(Date.UTC(2026,9,i+1)).toISOString().slice(0,10),open:100,high:104,low:96,close:i===20?close:100,volume:i===20?200:100}));
 return {symbol,bars,interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,
  receivedAt:new Date(now).toISOString(),summary:{date:bars.at(-1).date,close,sma20:100,aboveMA20:!short,aboveMA150:null,volumeRatio:2,atrPercent:4},
  fundamentals:{status:'available',source:'Twelve Data',currency:'USD',symbol,marketCap:1e9,receivedAt:new Date(now).toISOString()},
  volumeComparison:{status:'verified',coverage:'consolidated',aboveAverage:true},
  research:{available:true,support20:99,candidates:[{kind:short?'doubleTop':'doubleBottom',label:'Pattern',stage:'waiting',scenario:{side,entry:short?99:103,stop:90,target:short?80:125}}]}};
}
const filters={scenarioSide:'any',above20:true,risingVolume:true,minMeasuredMove:15,minMarketCap:1e9};
function projected(input,f=filters){const {record,screen,methodology,opportunities}=screenWithMethodology(input,f,{now});return ventureScanRecord(record,screen,methodology,opportunities);}
test('default discovery examines both sides and keeps candidates visible',()=>{
 const preset=asafScannerPreset();assert.equal(preset.scanScenarioSide,'any');assert.equal(preset.scanOnlyMatches,false);assert.equal(preset.scanMinMeasuredMove,15);assert.equal(preset.scanMinMarketCap,1e9);
});
for(const side of ['long','short'])test('either-side mode can fully qualify '+side+' without applying the opposite trend rules',()=>{
 const source=sample(side),result=screenWithMethodology(source,filters,{now});
 assert.equal(result.screen.matches,true);assert.equal(result.methodology.side,side);
 const scenario=result.record.research.candidates[0].scenario;assert.equal(Math.abs(scenario.entry-scenario.stop),16);
 assert.equal(side==='short'?scenario.stop>scenario.entry:scenario.stop<scenario.entry,true);
 assert.equal(projected(source).opportunities.find(o=>o.side===side).status,'match');
 const wrong=screenWithMethodology(source,{...filters,scenarioSide:side==='short'?'long':'short'},{now});assert.equal(wrong.screen.matches,false);
});
test('shorts cannot retain old target potential after the decline is largely complete',()=>{
 const source=sample('short');source.summary.close=84;Object.assign(source.bars.at(-1),{open:84,high:86,low:82,close:84});
 const result=screenWithMethodology(source,{scenarioSide:'short'},{now});
 assert.equal(result.screen.matches,false);assert.equal(result.record.research.candidates[0].scenario.entry,84);assert.ok(result.record.research.candidates[0].scenario.movePercent<15);
});
test('unknown cap and volume create labelled watch candidates; no full matches or invented patterns',()=>{
 const stocks=[sample('long','BULL'),sample('short','BEAR')].map(r=>({...r,fundamentals:null,volumeComparison:{status:'unverifiable'},research:{available:true,candidates:[]}}));
 const records=stocks.map(r=>projected(r));assert.ok(records.every(r=>!r.screen.matches));
 const candidates=rankedScannerCandidates(records);assert.equal(candidates.length,2);
 assert.deepEqual(new Set(candidates.map(c=>c.opportunity.side)),new Set(['long','short']));
 for(const {record,opportunity} of candidates){assert.equal(opportunity.status,'watch');assert.ok(opportunity.reasons.some(r=>r.includes('שווי שוק')));assert.deepEqual(record.patterns,[]);assert.equal(record.bars,undefined);assert.equal(record.summary,undefined);}
});
test('known ineligible company size, invalid closed bars and sub-$5 stocks never become watch candidates',()=>{
 for(const change of [r=>r.fundamentals.marketCap=1e8,r=>r.latestBarMayBePartial=true,r=>r.summary.close=5,r=>r.bars[3].high=0]){
  const source=sample();change(source);assert.deepEqual(rankedScannerCandidates([projected(source)]),[]);
 }
});
test('ranking keeps full matches first, obeys explicit direction, deduplicates and never fabricates rows',()=>{
 const long=projected(sample('long','BULL')),short=projected(sample('short','BEAR'));
 const watch=sample('long','WATCH');watch.fundamentals=null;
 const candidates=rankedScannerCandidates([projected(watch),short,long,long]);
 assert.equal(candidates.length,3);assert.equal(candidates.at(-1).record.symbol,'WATCH');
 assert.equal(rankedScannerCandidates([short,long],{side:'long'}).every(c=>c.opportunity.side==='long'),true);
 assert.deepEqual(rankedScannerCandidates([]),[]);assert.equal(rankedScannerCandidates([long],{limit:0}).length,0);
 assert.deepEqual(rankedScannerCandidates([{...long,opportunities:[]}, {...short,presentation:'raw'}]),[]);
});
test('short-only scans retain selected advanced filters and require a downside break when requested',()=>{
 const source=sample('short');source.summary.macd=-1;source.summary.macdSignal=-.5;
 assert.equal(screenWithMethodology(source,{...filters,scenarioSide:'short',macdPositive:true},{now}).screen.matches,false);
 source.research.support20=97;
 assert.equal(screenWithMethodology(source,{...filters,scenarioSide:'short',breakout20:true},{now}).screen.matches,false);
 assert.equal(screenWithMethodology(source,{scenarioSide:'invalid'},{now}).screen.matches,false);
});
for(const code of Object.keys(scannerOpportunityTranslations))test('watch and short messages have complete localized copy: '+code,()=>{
 const tr=createTranslator(launchTranslations[code]);
 for(const key of scannerOpportunityKeys){assert.equal(typeof scannerOpportunityTranslations[code][key],'string',key);assert.doesNotMatch(tr(key),/[\u0590-\u05ff]/,key);}
});
