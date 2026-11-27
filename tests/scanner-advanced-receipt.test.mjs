import {scannerScenarioFilters} from '../scanner-scenario-filters.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {screenWithMethodology,selectMethodologyCandidate} from '../server/asaf-methodology.mjs';
import {readChatScanner} from '../server/chat-scanner.mjs';
import {scannerChartContext} from '../server/scanner-chart.mjs';
import {sharedScannerKey} from '../server/shared-scanner.mjs';
import {scannerDailyVolumeBasis} from '../server/scanner-market-data.mjs';
import {closedSetupAtr14} from '../server/setup-atr.mjs';
import {fixture,env as authEnv} from './identity-fixture.mjs';

const now=Date.parse('2026-11-26T20:00:00Z');
const env={...authEnv,ASAF_MARKET_ENABLED:'true',ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'TEST',TWELVE_DATA_API_KEY:'fixture',ASAF_SCANNER_DAILY_VOLUME_ENABLED:'true'};
function recordFor(side){
 const bars=Array.from({length:30},(_,i)=>{const close=side==='long'?71+i:129-i;return {date:new Date(now-(31-i)*86400000).toISOString().slice(0,10),open:close-.25,high:close+1,low:close-2,close,volume:i===29?30000:10000}});
 const good=side==='long'?{kind:'breakout20',scenario:{side,entry:100,stop:94,target:120}}:{kind:'breakdown20',scenario:{side,entry:50,stop:56,target:40}};
 const attractiveButFails=side==='long'?{kind:'doubleBottom',scenario:{side,entry:200,stop:194,target:225}}:{kind:'doubleTop',scenario:{side,entry:100,stop:106,target:88}};
 const record={symbol:'TEST',source:'Twelve Data',bars,interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,receivedAt:new Date(now).toISOString(),volumeBasis:scannerDailyVolumeBasis(env),
  summary:{date:bars.at(-1).date,close:100,sma20:side==='long'?90:110,aboveMA20:side==='long',aboveMA150:true,atrPercent:3,volumeRatio:3},
  volumeComparison:{status:'verified',coverage:'consolidated',aboveAverage:true,ratio:3},
  fundamentals:{status:'available',source:'Twelve Data',symbol:'TEST',currency:'USD',marketCap:2e9,receivedAt:new Date(now).toISOString()},
  research:{available:true,candidates:[{...good,label:'qualifying setup',stage:'waiting'},{...attractiveButFails,label:'higher RR, insufficient percentage',stage:'waiting'}]}};
 return record;
}
function cached(record){
 const f=fixture();f.db.set(sharedScannerKey(env)+':snapshot',JSON.stringify({records:[record],errors:[],completedAt:new Date(now).toISOString(),nextUpdateAt:now+3600000,total:1}));
 return f;
}

test('advanced potential, pattern, crossed stage and RR constrain the exact server chart scenario',async()=>{
 const r=recordFor('long');r.research.candidates=[{kind:'doubleBottom',label:'A',stage:'waiting',scenario:{side:'long',entry:200,stop:194,target:250}},{kind:'breakout20',label:'B',stage:'crossed',scenario:{side:'long',entry:100,stop:94,target:140}}];
 for(const filters of [{minMeasuredMove:30},{pattern:'breakout20',crossedOnly:true},{pattern:'breakout20',minScenarioRR:6}]){
  const reviewed=screenWithMethodology(r,{...filters,scenarioSide:'long'},{now});assert.equal(reviewed.screen.matches,true);
  const f=cached(r),context={asOf:r.summary.date,receivedAt:r.receivedAt,side:'long',filters};
  const chart=await scannerChartContext({selected:'TEST',context,env,run:f.run,now});
  assert.equal(chart.tradeScenario.entry,100);assert.equal(chart.tradeScenario.target,140);assert.equal(chart.tradeScenario.movePercent,40);assert.equal(chart.tradeScenario.watchOnly,false);assert.deepEqual(chart.context.filters,scannerScenarioFilters(filters));
 }
 const f=cached(r),chart=await scannerChartContext({selected:'TEST',context:{asOf:r.summary.date,receivedAt:r.receivedAt,side:'long',filters:{minMeasuredMove:50}},env,run:f.run,now});assert.equal(chart.tradeScenario,null);assert.ok(!chart.actions.some(a=>a.type==='tradelevels'));
});
test('advanced receipt rejects forged fields and invalid bounds before storage reads',async()=>{
 const r=recordFor('long');for(const filters of [{minMeasuredMove:-1},{minMeasuredMove:1001},{minScenarioRR:101},{crossedOnly:'yes'},{pattern:'fake'},{entry:123},{minPrice:10}]){
  let reads=0;await assert.rejects(scannerChartContext({selected:'TEST',context:{asOf:r.summary.date,receivedAt:r.receivedAt,side:'long',filters},env,now,run:async()=>{reads++;throw Error('must not read')}}),e=>e.status===400);assert.equal(reads,0);
 }
});
