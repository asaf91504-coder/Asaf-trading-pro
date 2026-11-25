import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewInstrument,readUSMarketOverview} from '../server/us-market-overview.mjs';
import {priceResearchLevels} from '../price-research-levels.mjs';
import {chatAnswerText} from '../chat-answer-presentation.mjs';
import {marketSnapshotKey} from '../server/market-feed.mjs';
import handler,{marketDataContext} from '../netlify/functions/free-chat.mjs';
import {fixture,seed,env as authEnv,request} from './identity-fixture.mjs';

const now=Date.parse('2026-11-25T18:00:00Z'),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const env={...authEnv,ASAF_AI_PROVIDER:'openai',ASAF_OPENAI_ENABLED:'true',OPENAI_API_KEY:'fixture',ASAF_CHAT_OWNER_MEMBER_ID:id,ASAF_ADMIN_MEMBER_IDS:id,
 ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',TWELVE_DATA_API_KEY:'fixture',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'SPY,QQQ,DIA',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED:'true'};
function intraday(symbol='SPY'){
 const bars=[];
 for(const day of [24,25])for(let i=0;i<(day===24?26:14);i++){
  const close=day===24?100:105+i*5/13;
  bars.push({date:new Date(Date.UTC(2026,10,day,14,30+i*15)).toISOString().slice(0,19).replace('T',' '),open:close,high:close+1,low:close-1,close,volume:1000});
 }
 return {source:'Twelve Data',symbol,interval:'15min',bars,receivedAt:new Date(now).toISOString(),delayMinutes:0};
}
function daily(symbol='SPY'){
 const bars=Array.from({length:30},(_,i)=>({date:new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10),open:100+i,high:102+i,low:98+i,close:101+i,volume:1000}));
 return {source:'Twelve Data',symbol,interval:'1day',bars,receivedAt:new Date(now).toISOString(),delayMinutes:0};
}
test('day move is versus a completed prior session, not the preceding intraday candle; ETF levels stay distinct from index points',()=>{
 const result=overviewInstrument(intraday(),{now});
 assert.equal(result.symbol,'SPY');assert.equal(result.price,110);assert.ok(Math.abs(result.changePercent-10)<1e-10);
 assert.equal(result.previousCloseDate,'2026-11-24 20:45:00');assert.equal(result.asOf,'2026-11-25 17:45:00');
 assert.equal(result.timing,'completed-intraday-bar');assert.equal(result.sessionDate,'2026-11-25');assert.match(result.instrumentType,/ETF/);
 assert.ok(result.levels.support.every(x=>x<result.price));assert.ok(result.levels.resistance.every(x=>x>result.price));
});
test('unfinished, extended-hours and future bars cannot become the price or daily-change baseline',()=>{
 const snapshot=intraday();snapshot.bars.push({date:'2026-11-25 18:00:00',open:999,high:1000,low:998,close:999});
 assert.equal(overviewInstrument(snapshot,{now}).price,110);
 const noClose=intraday();noClose.bars.splice(25,1); // prior session has no closing bar
 assert.equal(overviewInstrument(noClose,{now}).changePercent,null);
 const noPrior=intraday();noPrior.bars=noPrior.bars.filter(b=>b.date.startsWith('2026-11-25'));
 assert.equal(overviewInstrument(noPrior,{now}),null);
 const delayed=overviewInstrument({...intraday(),delayMinutes:30},{now});
 assert.equal(delayed.asOf,'2026-11-25 17:15:00');
});
test('malformed, duplicate, wrong-source and wrong-instrument snapshots are rejected',()=>{
 for(const change of [s=>s.bars.reverse(),s=>s.bars[4].low=0,s=>s.bars[4].date='2026-02-30 14:30:00',s=>s.bars[4].date=s.bars[3].date,s=>s.source='CSV',s=>s.symbol='AAPL',s=>s.interval='1week']){
  const snapshot=intraday();change(snapshot);assert.equal(overviewInstrument(snapshot,{now}),null);
 }
});
test('prior-session data and old intraday data are never labelled as a current move',()=>{
 const previous=overviewInstrument(daily(),{now});assert.equal(previous.timing,'previous-session');assert.equal(previous.asOf,'2026-10-30');
 const old=overviewInstrument(intraday(),{now:now+86400000});assert.equal(old.timing,'historical-or-delayed');
});
test('price zones respect the current side and leave broken resistance unavailable rather than fabricate a higher target',()=>{
 const snapshot=daily(),bars=snapshot.bars;bars.at(-1).close=200;bars.at(-1).high=201;
 const levels=priceResearchLevels(bars);assert.deepEqual(levels.resistance,[]);assert.ok(levels.brokenRangeHigh<200);
 assert.equal(marketDataContext('SPY',bars,{source:'Twelve Data',provenance:'server-provider-cache',interval:'1day'}).priceLevels.brokenRangeHigh,levels.brokenRangeHigh);
 assert.equal(marketDataContext('SPY',bars,{source:'CSV'}).priceLevels,null);
});
test('existing AI permissions and trial identity/expiry gate every broad-market read',async()=>{
 let reads=0;const readSnapshot=async()=>{reads++;return intraday()};
 for(const e of [{...env,ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED:'false'},{...env,ASAF_MARKET_AI_LICENSE_CONFIRMED:'false'},{...env,ASAF_MARKET_ENABLED:'false'},{...env,ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:id,ASAF_TWELVE_TRIAL_ENDS_AT:'2026-11-24T00:00:00Z'},{...env,ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:id,ASAF_TWELVE_TRIAL_ENDS_AT:'2026-11-28T00:00:00Z'}]){
  assert.equal((await readUSMarketOverview({env:e,now,memberId:null,readSnapshot})).status,'unavailable');
 }
 assert.equal(reads,0);
});
test('each ETF is isolated, partial coverage is explicit, and failed intraday reads fall back to labelled daily data',async()=>{
 const calls=[];
 const result=await readUSMarketOverview({env,now,readSnapshot:async args=>{
  calls.push(args);assert.equal(args.maxAgeMs,60000);
  if(args.selected==='DIA')throw Error('unavailable');
  if(args.selected==='QQQ'&&args.interval!=='1day')throw Error('intraday unavailable');
  return args.interval==='1day'?daily(args.selected):intraday(args.selected);
 }});
 assert.equal(result.status,'partial');assert.deepEqual(result.missingSymbols,['DIA']);
 assert.equal(result.instruments.find(r=>r.symbol==='QQQ').timing,'previous-session');assert.equal(calls.length,5);
});
test('citations and source appendices are removed on new and reopened answers without removing prices, conditions or formatting',()=>{
 const text='**SPY**: $110 (+1.25%). תמיכה 108, התנגדות 112; פריצה רק מעל 112 [1].\n\nמקורות שנמצאו בחיפוש:\n[1] Example https://example.org';
 assert.equal(chatAnswerText(text),'**SPY**: $110 (+1.25%). תמיכה 108, התנגדות 112; פריצה רק מעל 112.');
 assert.equal(chatAnswerText('נתון citeturn1search0 [2]'),'נתון');
 assert.equal(chatAnswerText('Support 10\n\nSources\n[1] Link'),'Support 10');
});
test('authenticated handler sends verified market numbers to the existing single AI call, strips citations and preserves source isolation',async()=>{
 const previousEnv=process.env,previousFetch=globalThis.fetch,previousNow=Date.now,state=fixture();let modelCalls=0,providerCalls=0;
 process.env={...env};Date.now=()=>now;const owner=seed(state,'owner@example.test',id);
 for(const symbol of ['SPY','QQQ','DIA'])state.db.set(marketSnapshotKey(symbol,'15min',env),JSON.stringify(intraday(symbol)));
 globalThis.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);
  if(url==='https://test.upstash.io'){
   if(body[0]==='EVAL'&&body[1].includes('owner-chat-burst'))return Response.json({result:1});
   return Response.json({result:await state.run(body)});
  }
  if(url!=='https://api.openai.com/v1/responses'){providerCalls++;throw Error('unexpected provider request')}
  modelCalls++;assert.match(body.instructions,/MARKET_OVERVIEW/);assert.match(body.instructions,/candidate support\/resistance/);
  const text=JSON.stringify(body.input);assert.match(text,/changePercent/);assert.match(text,/110/);assert.match(text,/previousCloseDate/);
  assert.doesNotMatch(text,/PRIVATE_HISTORY|FAKE_CLIENT_PRICE|SELECTED_CHART/);
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'SPY עלה 10%, תמיכה משוערת 99 [1].'}]}]});
 };
 try{
  const response=await handler(request('free-chat',{message:'מה אתה חושב על השוק היום',language:'he',webSearch:true,symbol:'AAPL',bars:['FAKE_CLIENT_PRICE'],history:[{role:'user',content:'PRIVATE_HISTORY'}]},owner.cookie));
  const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.answer,'SPY עלה 10%, תמיכה משוערת 99.');assert.equal(data.source,'Twelve Data');assert.equal(data.actions,undefined);
  assert.equal(modelCalls,1);assert.equal(providerCalls,0);
 }finally{process.env=previousEnv;globalThis.fetch=previousFetch;Date.now=previousNow}
});
