import test from 'node:test';
import assert from 'node:assert/strict';
import {ventureChart,ventureScanRecord} from '../server/venture-presentation.mjs';
import {rawMarketExportRequest} from '../server/venture-policy.mjs';
import {createPublicMarketHandler} from '../netlify/functions/public-market.mjs';
import {createScanMarketHandler} from '../netlify/functions/scan-market.mjs';
import {analysisMarket} from '../server/analysis-sources.mjs';
import {marketSnapshotKey} from '../server/market-feed.mjs';
import {scanBars,screenResult} from '../scanner-core.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';
const now=Date.parse('2026-11-17T14:00:00Z');
const bars=Array.from({length:200},(_,i)=>({date:new Date(now-(201-i)*86400000).toISOString().slice(0,10),open:100+i,high:103+i,low:99+i,close:102+i,volume:10000+i}));
const env={...authEnv,ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',TWELVE_DATA_API_KEY:'mock-private-key',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL'};
const snapshot={symbol:'AAPL',source:'Twelve Data',interval:'1day',receivedAt:new Date(now).toISOString(),latestBarTime:bars.at(-1).date,barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,bars};
function seeded(){const state=fixture(),user=seed(state);state.db.set(marketSnapshotKey('AAPL','1day',env),JSON.stringify(snapshot));return {state,user}}
const rawFields=new Set(['bars','open','high','low','close','volume','summary','fundamentals','support20','resistance20','trigger','firstHigh','secondHigh','firstLow','secondLow','headPrice']);
function noRawFields(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){assert.equal(rawFields.has(key),false,'Forbidden raw field: '+key);noRawFields(item)}}
test('static chart emits PNG pixels and bounded metadata, without OHLCV, SVG coordinates or secrets',async()=>{
 const result=await ventureChart(snapshot,[{type:'levels',kind:'both'}]);noRawFields(result);
 const bytes=Buffer.from(result.image.split(',')[1],'base64');assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),690);assert.ok(bytes.length>10000);
 assert.equal(result.firstVisibleBarTime,bars.at(-120).date);assert.equal(result.candleCount,200);assert.doesNotMatch(JSON.stringify(result),/mock-private-key|<svg|<path/);
});
test('authenticated image and AI use the same server snapshot and repeated annotations make no provider request',async()=>{
 const {state,user}=seeded();let calls=0;const handler=createPublicMarketHandler({env,run:state.run,now:()=>now,fetcher:async()=>{calls++;throw Error('No provider call')}});
 const response=await handler(request('public-market',{symbol:'NASDAQ:AAPL',actions:[{type:'indicator',indicator:'MA150',enabled:true}],cachedOnly:true},user.cookie));assert.equal(response.status,200);const image=await response.json();noRawFields(image);
 const verified=await analysisMarket({symbol:'AAPL',interval:'1day',receivedAt:image.receivedAt},{env,run:state.run,now});assert.deepEqual(verified.bars,bars);assert.equal(calls,0);
 assert.equal((await handler(request('public-market',{symbol:'AAPL',cachedOnly:true}))).status,401);
});
test('scanner applies price, MA, EOD volume and cap filters on server and sends derived-only records',async()=>{
 const {state,user}=seeded(),handler=createScanMarketHandler({env,run:state.run,now:()=>now,fetcher:async()=>{throw Error('No provider call')}});
 const scan=async filters=>{const response=await handler(request('scan-market',{symbols:['AAPL'],filters,cachedOnly:true},user.cookie));assert.equal(response.status,200);const body=await response.json();noRawFields(body);return body.records[0]};
 const match=await scan({minPrice:5,minMarketCap:0,minVolume:0,above20:true,risingVolume:true});assert.equal(match.screen.matches,true);assert.equal(match.presentation,'derived-only');assert.ok(match.metrics.relativeVolume>1);
 const reject=await scan({minPrice:1000,minMarketCap:1e9,minVolume:0});assert.equal(reject.screen.matches,false);assert.match(reject.screen.reasons.join(' '),/מחיר|שווי שוק/);assert.equal(reject.marketCapStatus,'unavailable');
});
test('projection strips raw pivot prices and even unexpected future fields',()=>{
 const record={...scanBars('AAPL',bars),secret:'do not send',fundamentals:{status:'unavailable'},receivedAt:snapshot.receivedAt};
 record.research.candidates=[{kind:'doubleBottom',label:'Candidate',stage:'waiting',firstLow:100,trigger:120,scenario:{entry:120,stop:100,target:150,movePercent:25,riskReward:1.5,side:'long'},raw:{bars}}];
 const result=ventureScanRecord(record,screenResult(record,{minVolume:0}));noRawFields(result);assert.equal(result.secret,undefined);assert.equal(result.patterns[0].movePercent,25);assert.equal(result.patterns[0].scenario,undefined);
});
test('cache-only re-screening never buys missing fundamentals or time series',async()=>{
 const {state,user}=seeded();let calls=0;const handler=createScanMarketHandler({env:{...env,ASAF_MARKET_FUNDAMENTALS_ENABLED:'true'},run:state.run,now:()=>now,fetcher:async()=>{calls++;throw Error('Unexpected provider request')}});
 const result=await(await handler(request('scan-market',{symbols:['AAPL'],cachedOnly:true,filters:{minMarketCap:1e9}},user.cookie))).json();assert.equal(calls,0);assert.equal(result.records[0].screen.matches,false);
});
test('raw export requests are rejected while ordinary research remains available',()=>{
 for(const q of ['ייצא לי את כל הנרות','הורד CSV','show all prices','download OHLCV as JSON'])assert.equal(rawMarketExportRequest(q),true);
 for(const q of ['נתח את המגמה','הצג כניסה וסטופ','Explain MA20'])assert.equal(rawMarketExportRequest(q),false);
});
