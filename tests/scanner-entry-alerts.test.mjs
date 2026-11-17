import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scannerEntryStatus,saveScannerEntry,SCANNER_ENTRY_SAVE} from '../server/scanner-entry-alerts.mjs';
const now=Date.parse('2026-11-15T12:00:00Z');
const record=()=>({symbol:'AAPL',interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,source:'Twelve Data',bars:Array.from({length:21},(_,i)=>({date:i===20?'2026-11-13':'2026-10-'+String(i+1).padStart(2,'0'),close:i===20?50:48})),summary:{date:'2026-11-13',close:50,sma20:49,sma150:60,aboveMA20:true,volumeRatio:1.2,atr14:2,atrPercent:4},fundamentals:{status:'available',source:'Twelve Data',currency:'USD',symbol:'AAPL',marketCap:1e9,receivedAt:new Date(now).toISOString()},research:{available:true,candidates:[{kind:'double-bottom',stage:'crossed',scenario:{side:'long'}}]}});
test('scanner entry boundaries and existing rising-volume definition',()=>{
 const r=record();assert.equal(scannerEntryStatus(r,now),'pass');r.fundamentals.marketCap--;assert.equal(scannerEntryStatus(r,now),'fail');r.fundamentals.marketCap=1e9;
 for(const value of [5,4]){r.summary.close=value;assert.equal(scannerEntryStatus(r,now),'fail')};r.summary.close=50;
 r.summary.aboveMA20=false;assert.equal(scannerEntryStatus(r,now),'fail');r.summary.aboveMA20=true;
 r.summary.volumeRatio=1;assert.equal(scannerEntryStatus(r,now),'fail');
});
test('missing data is unknown, MA150 and ATR optional, no pattern is failure',()=>{
 const r=record();r.summary.sma150=null;r.summary.atr14=null;assert.equal(scannerEntryStatus(r,now),'pass');
 r.research.candidates=[];assert.equal(scannerEntryStatus(r,now),'fail');r.research.available=false;assert.equal(scannerEntryStatus(r,now),'unknown');
 for(const patch of [{latestBarMayBePartial:true},{interval:'1h'},{fundamentals:null}])assert.equal(scannerEntryStatus({...record(),...patch},now),'unknown');
 assert.equal(scannerEntryStatus(record(),now+8*86400000),'unknown');
});
test('unknown performs no writes; valid snapshot uses atomic member-guarded inbox transaction',async()=>{
 let calls=[];const run=async args=>{calls.push(args);return 1};const user={id:'test',memberRaw:'{"enabled":true}'};
 await saveScannerEntry({...record(),fundamentals:null},user,{run,now});assert.equal(calls.length,0);
 assert.equal((await saveScannerEntry(record(),user,{run,now})).added,1);
 assert.equal(calls[0][1],SCANNER_ENTRY_SAVE);assert.equal(calls[0][2],'3');assert.equal(JSON.parse(calls[0].at(-1)).evidence.atrPercent,4);
 await assert.rejects(saveScannerEntry(record(),user,{run:async()=>-1,now}),/Account changed/);
});
