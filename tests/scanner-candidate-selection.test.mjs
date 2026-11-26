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
for(const side of ['long','short']){
 test(side+': a full match uses the qualifying >=15% pattern even when another pattern has higher RR',async()=>{
  const original=recordFor(side),review=screenWithMethodology(original,{scenarioSide:side},{now});
  assert.equal(review.screen.matches,true);assert.equal(review.methodology.eligible,true);
  const [qualifying,failing]=review.record.research.candidates;assert.ok(qualifying.scenario.movePercent>=15);assert.ok(failing.scenario.movePercent<15);assert.ok(failing.scenario.riskReward>qualifying.scenario.riskReward);
  const selection=selectMethodologyCandidate(review.record,{side,fullMatch:true});assert.equal(selection.candidate.kind,qualifying.kind);assert.equal(selection.qualified,true);assert.equal(selection.watchOnly,false);
  const f=cached(original),chat=await readChatScanner({side,limit:1},{env,run:f.run,now});
  const chart=await scannerChartContext({selected:'TEST',context:{asOf:original.summary.date,receivedAt:original.receivedAt,side},env,run:f.run,now});
  const candidate=chat.candidates[0];assert.equal(candidate.status,'match');assert.ok(candidate.scenario.movePercent>=15);assert.equal(candidate.pattern.kind,qualifying.kind);
  for(const key of ['entry','stop','target'])assert.equal(candidate.scenario[key],Number(chart.tradeScenario[key].toFixed(2)));
  assert.equal(chart.tradeScenario.entry,qualifying.scenario.entry);assert.equal(chart.tradeScenario.methodologyQualified,true);assert.equal(chart.tradeScenario.watchOnly,false);
  assert.equal(Math.abs(chart.tradeScenario.stop-chart.tradeScenario.entry),2*closedSetupAtr14(original));
 });
 test(side+': an insufficient-potential fallback remains explicitly watch-only in chat and chart',async()=>{
  const original=recordFor(side);original.research.candidates=original.research.candidates.slice(1);
  const review=screenWithMethodology(original,{scenarioSide:side},{now});assert.equal(review.screen.matches,false);
  const strict=selectMethodologyCandidate(review.record,{side,fullMatch:true});assert.equal(strict.candidate,null);
  const fallback=selectMethodologyCandidate(review.record,{side});assert.ok(fallback.candidate);assert.equal(fallback.qualified,false);assert.equal(fallback.watchOnly,true);
  const f=cached(original),chat=await readChatScanner({side,limit:1},{env,run:f.run,now}),chart=await scannerChartContext({selected:'TEST',context:{asOf:original.summary.date,receivedAt:original.receivedAt,side},env,run:f.run,now});
  assert.equal(chat.candidates[0].status,'watch');assert.equal(chat.candidates[0].scenario.watchOnly,true);assert.equal(chat.candidates[0].scenario.methodologyQualified,false);assert.ok(chat.candidates[0].missingConditions.length);
  assert.equal(chart.tradeScenario.watchOnly,true);assert.equal(chart.tradeScenario.methodologyQualified,false);assert.ok(chart.actions.some(a=>a.type==='tradelevels'&&a.side===side));
 });
}
test('unsupported patterns and invalid stages cannot supply a trade scenario',()=>{
 const reviewed=screenWithMethodology(recordFor('long'),{scenarioSide:'long'},{now}).record;
 reviewed.research.candidates=reviewed.research.candidates.map((c,i)=>({...c,...(i===0?{kind:'unknownPattern'}:{stage:'broken'})}));
 assert.equal(selectMethodologyCandidate(reviewed,{side:'long'}).candidate,null);
});

test('explicit price and verified-company-size thresholds are hard filters for match and watch candidates',async()=>{
 const original=recordFor('long');original.research.candidates=original.research.candidates.slice(1);
 const low={...original,symbol:'LOW',fundamentals:{...original.fundamentals,symbol:'LOW',marketCap:2e9}};
 const high={...original,symbol:'HIGH',fundamentals:{...original.fundamentals,symbol:'HIGH',marketCap:12e9}};
 const missing={...original,symbol:'MISSING',fundamentals:null};
 const expired={...original,symbol:'EXPIRED',fundamentals:{...original.fundamentals,symbol:'EXPIRED',marketCap:12e9,receivedAt:new Date(now-86400001).toISOString()}};
 const readScan=async()=>({records:[low,high,missing,expired]});
 const sized=await readChatScanner({side:'long',limit:12,filters:{minMarketCap:10e9,minPrice:90}},{env,now,readScan});
 assert.deepEqual(sized.candidates.map(c=>c.symbol),['HIGH']);assert.equal(sized.candidates[0].status,'watch');assert.deepEqual(sized.appliedFilters,{minMarketCap:10e9,minPrice:90});
 const boundary=await readChatScanner({side:'long',limit:12,filters:{minPrice:100}},{env,now,readScan});assert.equal(boundary.candidates.length,0);
 const basic=await readChatScanner({side:'long',limit:12},{env,now,readScan});assert.ok(basic.candidates.some(c=>c.symbol==='MISSING'));
});
test('validated exclusions remove earlier candidates and malformed filters never read the scanner',async()=>{
 const original=recordFor('long');let reads=0;const readScan=async()=>{reads++;return {records:[original]}};
 const excluded=await readChatScanner({side:'long',limit:3,excludeSymbols:['nasdaq:test']},{env,now,readScan});assert.equal(excluded.candidates.length,0);assert.deepEqual(excluded.excludedSymbols,['TEST']);assert.equal(reads,1);
 for(const patch of [{excludeSymbols:'TEST'},{excludeSymbols:['https://example.test']},{excludeSymbols:[42]},{filters:{minPrice:NaN}},{filters:{minMarketCap:-1}},{filters:{sector:'tech'}}])await assert.rejects(readChatScanner({side:'long',limit:3,...patch},{env,now,readScan}),e=>e.status===400);
 assert.equal(reads,1);
});
