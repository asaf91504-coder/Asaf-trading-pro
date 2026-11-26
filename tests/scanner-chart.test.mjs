import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicMarketHandler} from '../netlify/functions/public-market.mjs';
import {sharedScannerKey} from '../server/shared-scanner.mjs';
import {marketSnapshotKey} from '../server/market-feed.mjs';
import {scanBars} from '../scanner-core.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
const now=Date.parse('2026-11-26T12:00:00Z'),owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const env={...authEnv,ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AMD,TSLA',TWELVE_DATA_API_KEY:'not-a-real-key',ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:owner,ASAF_TWELVE_TRIAL_ENDS_AT:'2026-11-28T22:00:00Z'};
const bars=Array.from({length:200},(_,i)=>{const c=50+i*.08+3*Math.sin(i*.25);return {date:new Date(Date.UTC(2026,3,1+i)).toISOString().slice(0,10),open:c-.2,high:c+1,low:c-1,close:c,volume:10000+i};});
const snapshot={symbol:'AMD',source:'Twelve Data',interval:'1day',bars,receivedAt:new Date(now).toISOString(),latestBarTime:bars.at(-1).date,barPolicy:'previous-daily-sessions',latestBarMayBePartial:false};
function setup(config=env,manifest=false){
 const f=fixture(),user=seed(f,'owner@test.test',owner),record={...scanBars('AMD',bars,snapshot),...snapshot};
 const scan={records:[record],errors:[],startedAt:new Date(now-60000).toISOString(),completedAt:new Date(now).toISOString(),nextUpdateAt:now+10800000};
 if(manifest){scan.format='scanner-symbol-manifest-v1';scan.rows=[{symbol:'AMD',key:'private-server-row'}];scan.records=[];scan.updatedAt=scan.completedAt;f.db.set('private-server-row',JSON.stringify(record));}
 f.db.set(sharedScannerKey(config)+':snapshot',JSON.stringify(scan));f.db.set(marketSnapshotKey('AMD','1day',config),JSON.stringify(snapshot));
 const h=createPublicMarketHandler({env:config,run:f.run,now:()=>now,fetcher:()=>assert.fail('opening scanner chart must not call provider')});
 return {f,user,h,record,context:{asOf:bars.at(-1).date,receivedAt:snapshot.receivedAt,side:'long'}};
}
test('scanner chart is automatically marked from exactly the selected cached record, including 1,000-stock manifests',async()=>{
 for(const manifest of [false,true]){
  const {h,user,context}=setup(env,manifest),response=await h(request('public-market',{symbol:'AMD',interval:'1day',scannerContext:context},user.cookie));
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.symbol,'AMD');assert.equal(body.latestBarTime,context.asOf);assert.equal(body.receivedAt,context.receivedAt);
  assert.ok(body.annotationCount>=3);assert.deepEqual(body.chartSettings.indicators,['MA20','MA150']);
  assert.ok(body.researchLegend.some(x=>x.kind==='support'));assert.ok(body.researchLegend.some(x=>x.kind==='resistance'));assert.ok(body.researchLegend.some(x=>x.kind==='trendline'));
  assert.equal(body.firstVisibleBarTime,bars[0].date);assert.deepEqual(body.scannerContext,context);
  assert.ok(body.researchActions.some(a=>a.type==='pattern'&&a.pattern==='all'));
  assert.match(body.image,/^data:image\/png;base64,/);assert.doesNotMatch(JSON.stringify(body),/"bars"|private-server-row|not-a-real-key|<svg|"points"/);
 }
});
test('old receipts, another ticker and client-supplied coordinates never open a different chart silently',async()=>{
 const {h,user,context}=setup();
 for(const [symbol,patch,status] of [['AMD',{receivedAt:new Date(now-60000).toISOString()},409],['AMD',{asOf:'2026-01-01'},409],['TSLA',{},409],['AMD',{prices:[1,2]},400],['AMD',{side:'buy'},400]]){
  const response=await h(request('public-market',{symbol,scannerContext:{...context,...patch}},user.cookie));assert.equal(response.status,status);assert.equal((await response.json()).image,undefined);
 }
 assert.equal((await h(request('public-market',{symbol:'AMD',interval:'1h',scannerContext:context},user.cookie))).status,400);
});
test('owner restriction remains in place for scanner-derived images',async()=>{
 const {h,f,user,context}=setup(),other=seed(f,'other@test.test','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','e'.repeat(64));
 for(const cookie of ['',other.cookie])assert.equal((await h(request('public-market',{symbol:'AMD',scannerContext:context},cookie))).status,503);
 assert.equal((await h(request('public-market',{symbol:'AMD',scannerContext:context},user.cookie))).status,200);
});
test('clear annotations and normal chart loads retain their explicit behavior',async()=>{
 const {h,user,context}=setup();
 const cleared=await(await h(request('public-market',{symbol:'AMD',scannerContext:{...context,autoAnnotate:false},actions:[{type:'clear_annotations'}]},user.cookie))).json();
 assert.equal(cleared.annotationCount,0);assert.deepEqual(cleared.researchLegend,[]);
 const plain=await(await h(request('public-market',{symbol:'AMD',cachedOnly:true},user.cookie))).json();assert.equal(plain.annotationCount,0);assert.equal(plain.scannerContext,undefined);
});
test('manual scanner results can open the same cached daily series without a shared refresh',async()=>{
 const {h,user,context}=setup({...env,ASAF_HOURLY_SCANNER_ENABLED:'false'}),response=await h(request('public-market',{symbol:'AMD',scannerContext:context},user.cookie));assert.equal(response.status,200);assert.equal((await response.json()).scannerContext.asOf,context.asOf);
});

test('short chart marks the server-derived entry, exact two-ATR stop and measured target only when available',async()=>{
 const {h,user,context}=setup();const body=await(await h(request('public-market',{symbol:'AMD',scannerContext:{...context,side:'short'}},user.cookie))).json();
 for(const kind of ['entry','stop','target'])assert.ok(body.researchLegend.some(m=>m.kind===kind));
 assert.equal(body.scannerContext.side,'short');
});
