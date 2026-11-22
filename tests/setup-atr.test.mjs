import test from 'node:test';
import assert from 'node:assert/strict';
import {closedSetupAtr14,exactTwoAtrStop,stopWithinSetupAtr} from '../server/setup-atr.mjs';
import {setupCandidates} from '../server/setup-review.mjs';
import {indicatorSnapshot} from '../chart-indicators.mjs';
import {setupReviewTranslations} from '../setup-review-locales.mjs';

const dates=Array.from({length:15},(_,i)=>new Date(Date.UTC(2026,10,i+1)).toISOString().slice(0,10));
const bars=dates.map(date=>({date,open:100,high:102,low:98,close:100,volume:1000}));
const record={symbol:'EXAMPLE',interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,bars,summary:{date:dates.at(-1),atr14:50}};
const long=(stop)=>({side:'long',entry:100,stop,target:120});
const short=(stop)=>({side:'short',entry:100,stop,target:80});
test('uses full-precision Wilder ATR from closed daily bars, never the display approximation',()=>{
 const varied=bars.map((b,i)=>({...b,high:b.high+i*.012,low:b.low-i*.02}));
 assert.equal(closedSetupAtr14(record),4);
 assert.equal(closedSetupAtr14({...record,bars:varied}),indicatorSnapshot(varied).atr14);
 for(const diff of [{latestBarMayBePartial:true},{interval:'1h'},{volumeConflictDates:[dates[1]]},{bars:bars.slice(1)},{bars:[...bars.slice(0,-1),bars.at(-2)]},{bars:bars.map(b=>({...b,high:100,low:100}))}]){
  assert.equal(closedSetupAtr14({...record,...diff}),null);
 }
});
test('all long and short setups get exactly 2 ATR from entry independent of the previous stop',()=>{
 for(const old of [99,96,94,92,91.99,101,undefined])assert.deepEqual(exactTwoAtrStop(long(old),4),long(92));
 for(const old of [101,104,106,108,108.01,99,undefined])assert.deepEqual(exactTwoAtrStop(short(old),4),short(108));
 assert.equal(exactTwoAtrStop({side:'long',entry:2,target:5},3),null);
 assert.equal(stopWithinSetupAtr(long(92),4),true);
 assert.equal(stopWithinSetupAtr(long(94),4),false);
});
test('setups wider than 2 ATR in the previous algorithm stay in the queue with computed stops',()=>{
 const candidates=[long(99),long(91.99),short(103),short(110)].map((scenario,i)=>({kind:'case'+i,scenario}));
 const scan={records:[{...record,research:{candidates}}]};
 const queue=setupCandidates(scan);
 assert.deepEqual(queue.map(x=>x.scenario),[long(92),long(92),short(108),short(108)]);
 assert.equal(queue.every(x=>x.atr14===4),true);
 assert.deepEqual(setupCandidates({records:[{...scan.records[0],latestBarMayBePartial:true}]}),[]);
});
test('the manual stop validation message is localized in every non-Hebrew interface language',()=>{
 for(const locale of ['en','es','ar','fr','de','pt','ru','zh','ja']){
  assert.ok(setupReviewTranslations[locale]['מרחק הסטופ ממחיר הכניסה חייב להיות בדיוק 2 ATR יומי.']);
 }
});
