import test from 'node:test';
import assert from 'node:assert/strict';
import {comparableDailyVolume,partialVolumeReason,volumeUnavailableReason} from '../comparable-volume.mjs';
import {scanBars,screenResult} from '../scanner-core.mjs';
import {marketDataContext} from '../netlify/functions/free-chat.mjs';
import {readMarketSnapshot,marketSnapshotKey} from '../server/market-feed.mjs';
import {ventureScanRecord} from '../server/venture-presentation.mjs';
import {sharedScannerKey,readSharedScan} from '../server/shared-scanner.mjs';
import {env as authEnv,fixture} from './identity-fixture.mjs';

const basis={feed:'twelve-data:us-equities',session:'regular',coverage:'partial',basis:'verified-test-venue-a',adjustment:'unadjusted',verifiedFrom:'2025-01-01'};
const meta={interval:'1day',source:'Twelve Data',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,receivedAt:'2026-11-20T15:00:00Z',volumeBasis:basis,provenance:'server-provider-cache'};
const sample=()=>Array.from({length:25},(_,i)=>({date:new Date(Date.UTC(2026,9,i+1)).toISOString().slice(0,10),open:100+i,high:102+i,low:99+i,close:101+i,volume:i===24?2400:1000}));
const commonEnv={...authEnv,ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL',TWELVE_DATA_API_KEY:'fixture-never-fetched',ASAF_HOURLY_SCANNER_ENABLED:'true'};
const env={...commonEnv,ASAF_MARKET_DAILY_VOLUME_COVERAGE:basis.coverage,ASAF_MARKET_DAILY_VOLUME_BASIS:basis.basis,ASAF_MARKET_DAILY_VOLUME_ADJUSTMENT:basis.adjustment,ASAF_MARKET_DAILY_VOLUME_VERIFIED_FROM:basis.verifiedFrom};
const volumeFilters={minMarketCap:0,risingVolume:true};

for(const coverage of ['partial','consolidated'])test('consistent '+coverage+' daily series yields the same scoped scanner and chat result',()=>{
 const input=sample(),m={...meta,volumeBasis:{...basis,coverage}},summary=comparableDailyVolume(input,m);
 assert.deepEqual(summary,{status:'verified',reason:null,coverage,ratio:2.4,aboveAverage:true,abovePreviousVolume:true,rising:true});
 const record=scanBars('AAPL',input,m),context=marketDataContext('AAPL',input,m),marketWide=coverage==='consolidated';
 const display=ventureScanRecord(record,screenResult(record,volumeFilters));
 assert.equal(display.screen.matches,marketWide);
 assert.deepEqual(display.screen.reasons,marketWide?[]:[partialVolumeReason]);
 assert.equal(display.metrics.relativeVolume,2.4);assert.equal(display.metrics.volumeCoverage,coverage);
 assert.equal(context.relativeVolume20,record.summary.volumeRatio);
 assert.equal(context.technicalEvidence.risingVolume,marketWide?true:null);
 assert.equal(context.volumeComparison.observedRisingVolume,true);
 assert.equal(context.volumeComparison.canConfirmMarketVolumeRule,marketWide);
 assert.equal(context.volumeComparison.coverage,coverage);
 for(const filters of [{minVolume:1},{minVolume:0,risingVolume:true},{minVolume:0,obvRising:true}]){
  assert.equal(screenResult(record,filters).matches,marketWide);
 }
 assert.equal(screenResult(record,{minVolume:0,risingVolume:false,obvRising:false}).matches,true);
});
test('equal volumes remain exactly flat even on rising price closes; equal closes do not qualify',()=>{
 const full={...meta,volumeBasis:{...basis,coverage:'consolidated'}};
 for(const volume of [101,999999]){
  const b=sample().map(bar=>({...bar,volume}));
  const result=comparableDailyVolume(b,full);
  assert.equal(result.status,'verified');assert.equal(result.ratio,1);
  assert.equal(result.aboveAverage,false);assert.equal(result.rising,false);
  assert.equal(screenResult(scanBars('AAPL',b,full),volumeFilters).matches,false);
 }
 const b=sample();b.at(-1).close=b.at(-2).close;
 assert.equal(comparableDailyVolume(b,full).rising,false);
 assert.equal(screenResult(scanBars('AAPL',b,full),volumeFilters).matches,false);
});

test('unknown, mixed, invalid, open and incomplete windows stay unknown (not low, flat or a pass)',()=>{
 const fixtures=[
  [sample(),{...meta,volumeBasis:null}],
  [sample(),{...meta,volumeBasis:{...basis,basis:''}}],
  [sample(),{...meta,volumeBasis:{...basis,adjustment:'unknown'}}],
  [sample(),{...meta,volumeBasis:{...basis,verifiedFrom:'2026-10-09'}}],
  [sample(),{...meta,interval:'5min'}],
  [sample(),{...meta,latestBarMayBePartial:true}],
  [sample(),{...meta,receivedAt:'2026-10-25T19:00:00Z'}],
  [sample().slice(-20),meta],
 ];
 for(const patch of [{volume:0},{volume:null},{volume:NaN},{volume:-1},{complete:false},{volumeBasis:{...basis,coverage:'consolidated'}},{volumeBasis:{...basis,session:'extended'}},{volumeBasis:{...basis,adjustment:'splits'}},{volumeBasis:{...basis,feed:'another-feed'}},{volumeBasis:{...basis,basis:'different-venues'}}]){
  const b=sample();Object.assign(b[10],patch);fixtures.push([b,meta]);
 }
 for(const [b,m] of fixtures){
  const unavailable=comparableDailyVolume(b,m);
  assert.equal(unavailable.status,'unverifiable');assert.equal(unavailable.ratio,null);assert.equal(unavailable.rising,null);
  if(b.length<21)continue;
  const result=screenResult(scanBars('AAPL',b,m),volumeFilters);
  const chat=marketDataContext('AAPL',b,m);
  assert.equal(result.matches,false);assert.ok(result.reasons.includes(volumeUnavailableReason));assert.ok(!result.reasons.includes('מחזור יחסי נמוך'));
  assert.equal(chat.relativeVolume20,null);assert.equal(chat.technicalEvidence.risingVolume,null);assert.ok(chat.last30Candles.every(row=>row[5]===null));
 }
});
test('unknown volume does not disable an explicitly price-only screen',()=>{
 const record=scanBars('AAPL',sample(),{...meta,volumeBasis:null});
 assert.equal(screenResult(record).matches,false);
 assert.equal(screenResult(record,{minMarketCap:0,minVolume:0,risingVolume:false,obvRising:false}).matches,true);
 assert.equal(record.volumeComparison.status,'unverifiable');
});
test('provider-declared conflict/partial/duplicate bars preserve price chart but downgrade comparable volume',async()=>{
 for(const modify of [
  v=>v.push({...v.at(-1),volume:2500}),
  v=>{v.at(-1).is_partial=true;},
  v=>{v.at(-1).volumeBasis={...basis,basis:'different-venues'};},
 ]){
  const values=sample().map(b=>({...b,datetime:b.date}));modify(values);
  const f=fixture(),snapshot=await readMarketSnapshot({selected:'AAPL',env,run:f.run,now:Date.parse(meta.receivedAt),
   fetcher:async()=>Response.json({meta:{symbol:'AAPL',interval:'1day'},values})});
  assert.equal(snapshot.bars.length,25);assert.equal(snapshot.bars.at(-1).close,125);
  assert.equal(snapshot.volumeCoverage,'unconfirmed');assert.deepEqual(snapshot.volumeConflictDates,['2026-10-25']);
  assert.equal(comparableDailyVolume(snapshot.bars,snapshot).status,'unverifiable');
 }
});
test('legacy shared scanner/review key is stable; old records cannot reintroduce volume',async()=>{
 const now=Date.parse(meta.receivedAt),f=fixture(),key=sharedScannerKey(commonEnv);
 assert.equal(sharedScannerKey(env),key);assert.notEqual(marketSnapshotKey('AAPL','1day',env),marketSnapshotKey('AAPL','1day',commonEnv));
 const record={...scanBars('AAPL',sample()),receivedAt:meta.receivedAt};
 assert.ok(record.summary.volumeRatio>0);
 f.db.set(key+':snapshot',JSON.stringify({records:[record],completedAt:meta.receivedAt,nextUpdateAt:now+3600000,errors:[]}));
 f.db.set(key+':reviews','unchanged');
 const result=await readSharedScan({env,run:f.run,now});
 assert.equal(result.records[0].summary.volumeRatio,null);
 assert.equal(result.records[0].volumeComparison.status,'unverifiable');
 assert.equal(f.db.get(key+':reviews'),'unchanged');
});
