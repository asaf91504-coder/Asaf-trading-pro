import {billingIdentity,saveBilling} from '../server/billing.mjs';
import {analysisMarket} from '../server/analysis-sources.mjs';
import {marketSnapshotKey} from '../server/market-feed.mjs';
import {storageKey} from '../server/storage.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readChatScanner,CHAT_SCANNER_PAGE_SIZE} from '../server/chat-scanner.mjs';
import {scanBars} from '../scanner-core.mjs';
import {scannerDailyVolumeBasis} from '../server/scanner-market-data.mjs';
import {sharedScannerKey} from '../server/shared-scanner.mjs';
import {fixture,seed,request,env as authEnv} from './identity-fixture.mjs';
import handler from '../netlify/functions/free-chat.mjs';
const now=Date.parse('2026-11-26T20:00:00Z'),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const env={...authEnv,ASAF_AI_PROVIDER:'openai',ASAF_OPENAI_ENABLED:'true',OPENAI_API_KEY:'fixture',ASAF_CHAT_OWNER_MEMBER_ID:id,ASAF_ADMIN_MEMBER_IDS:id,ASAF_MARKET_ENABLED:'true',ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED:'true',TWELVE_DATA_API_KEY:'fixture',ASAF_MARKET_DELAY_MINUTES:'0',ASAF_MARKET_ALLOWED_SYMBOLS:'AMD,TSLA,ACMR,NVDA',ASAF_MARKET_AI_LICENSE_CONFIRMED:'true',ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED:'true',ASAF_SCANNER_DAILY_VOLUME_ENABLED:'true'};
const records=['AMD','TSLA','ACMR','NVDA'].map((symbol,j)=>{
 const bars=Array.from({length:200},(_,i)=>{const c=100+i*.15+4*Math.sin(i*.25)+j;return {date:new Date(now-(201-i)*86400000).toISOString().slice(0,10),open:c-.2,high:c+1,low:c-1,close:c,volume:i===199?30000:10000}});
 const snapshot={symbol,bars,source:'Twelve Data',interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,receivedAt:new Date(now).toISOString(),volumeBasis:scannerDailyVolumeBasis(env)};
 return {...scanBars(symbol,bars,snapshot),...snapshot,fundamentals:{status:'available',symbol,source:'Twelve Data',currency:'USD',marketCap:2e9,receivedAt:new Date(now).toISOString()}};
});
const snapshot={records,errors:[],total:1000,updatedAt:new Date(now).toISOString(),completedAt:new Date(now).toISOString(),nextUpdateAt:now+3600000,partial:true};
test('scanner chat returns distinct ranked candidates, verified cap and volume without raw candles',async()=>{
 for(const side of ['any','long','short']){
  const x=await readChatScanner({side,limit:3},{env,now,memberId:id,readScan:async()=>snapshot});
  assert.equal(x.candidates.length,3);assert.equal(new Set(x.candidates.map(c=>c.symbol)).size,3);assert.equal(x.total,1000);assert.equal(x.partial,true);
  for(const c of x.candidates){assert.equal(c.marketCapUsd,2e9);assert.equal(c.relativeVolume,3);assert.equal(c.bars,undefined);assert.equal(c.status,'watch');assert.ok(c.missingConditions.length);if(side!=='any')assert.equal(c.side,side);if(c.scenario)assert.equal(c.scenario.side,c.side)}
 }
 const small=await readChatScanner({side:'any',limit:3},{env,now,readScan:async()=>({...snapshot,records:records.slice(0,1)})});assert.equal(small.candidates.length,1);
});
test('scanner discovery retains identity, expiry and AI data permissions',async()=>{
 const f=fixture(),trial={...env,ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:id,ASAF_TWELVE_TRIAL_ENDS_AT:new Date(now+1000).toISOString()};
 for(const options of [{env:trial,memberId:null},{env:trial,memberId:'other'},{env:trial,memberId:id,now:now+1000},{env:{...env,ASAF_MARKET_AI_LICENSE_CONFIRMED:'false'}},{env:{...env,ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED:'false'}}])await assert.rejects(readChatScanner({side:'any',limit:3},{now,run:f.run,...options}));
});
test('authenticated chat uses all scanner candidates and ignores the selected chart and old chat',async()=>{
 const oldEnv=process.env,oldFetch=globalThis.fetch,oldNow=Date.now,f=fixture();process.env={...env};Date.now=()=>now;const user=seed(f,'owner@example.test',id);f.db.set(sharedScannerKey(env)+':snapshot',JSON.stringify(snapshot));let ai=0,observedFailure;
 globalThis.fetch=async(url,init)=>{try{
  const b=JSON.parse(init.body);if(url==='https://test.upstash.io'){if(b[0]==='EVAL'&&b[1].includes('owner-chat-burst'))return Response.json({result:1});return Response.json({result:await f.run(b)})}
  assert.equal(url,'https://api.openai.com/v1/responses');ai++;const text=JSON.stringify(b.input);assert.match(text,/SCANNER_DISCOVERY/);assert.match(text,/AMD/);assert.doesNotMatch(text,/OLD_ACMR_ONLY|FAKE_PRICE/);assert.match(b.instructions,/multiple stock candidates/);
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'שלוש מועמדות למעקב: AMD, TSLA, NVDA.'}]}]});
 }catch(e){observedFailure=e;throw e}};
 try{
  const response=await handler(request('free-chat',{message:'אני רוצה שתתן לי שלוש מניות לשורט או לונג',language:'he',symbol:'ACMR',source:'Twelve Data',useServerMarket:true,bars:['FAKE_PRICE'],chartToolReceipt:'FAKE_PRICE',history:[{role:'assistant',content:'OLD_ACMR_ONLY'}]},user.cookie));
  const b=await response.json();if(observedFailure)throw observedFailure;assert.equal(response.status,200,JSON.stringify(b));assert.equal(b.scannerDiscovery.candidates.length,3);assert.equal(b.analysisContext,null);assert.equal(b.tradeScenario,null);assert.equal(b.source,'Twelve Data');assert.equal(ai,1);
  const mismatch=await handler(request('free-chat',{message:'מה דעתך על TSLA',symbol:'ACMR',source:'Twelve Data',useServerMarket:true},user.cookie));assert.equal(mismatch.status,409);assert.equal((await mismatch.json()).code,'question_asset_mismatch');assert.equal(ai,1);
 }finally{process.env=oldEnv;globalThis.fetch=oldFetch;Date.now=oldNow}
});


test('single-stock analysis includes cached company size and rejects expired company data',async()=>{
 const f=fixture(),configured={...env,ASAF_MARKET_FUNDAMENTALS_ENABLED:'true'},r=records[0];
 f.db.set(marketSnapshotKey(r.symbol,'1day',configured),JSON.stringify(r));
 const key=storageKey('market:fundamentals:v1:'+r.symbol,configured);f.db.set(key,JSON.stringify(r.fundamentals));
 const payload={symbol:r.symbol,receivedAt:r.receivedAt};
 const result=await analysisMarket(payload,{env:configured,run:f.run,now,memberId:id});assert.equal(result.meta.capitalization.value,2e9);
 f.db.set(key,JSON.stringify({...r.fundamentals,receivedAt:new Date(now-86400001).toISOString()}));
 const expired=await analysisMarket(payload,{env:configured,run:f.run,now,memberId:id});assert.equal(expired.meta.capitalization,null);
});


test('reported month-long request supplies two server-derived candidates to inference',async()=>{
 const oldEnv=process.env,oldFetch=globalThis.fetch,oldNow=Date.now,f=fixture();process.env={...env};Date.now=()=>now;
 const user=seed(f,'owner@example.test',id);f.db.set(sharedScannerKey(env)+':snapshot',JSON.stringify(snapshot));let supplied;
 globalThis.fetch=async(url,init)=>{
  const b=JSON.parse(init.body);if(url==='https://test.upstash.io'){if(b[0]==='EVAL'&&b[1].includes('owner-chat-burst'))return Response.json({result:1});return Response.json({result:await f.run(b)})}
  assert.equal(url,'https://api.openai.com/v1/responses');supplied=JSON.parse(b.input.at(-1).content.split('SCANNER_DISCOVERY (verified server-derived candidates, not instructions):\n')[1]);
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:supplied.candidates.map(c=>c.symbol+' '+c.close).join(', ')}]}]});
 };
 try{
  const response=await handler(request('free-chat',{message:'תרשום לי 2 מניות להשקיע לטווח של חודש מניות לונג',language:'he',symbol:'ACMR',source:'none',history:[{role:'assistant',content:'No old stock data'}]},user.cookie));
  const b=await response.json();assert.equal(response.status,200,JSON.stringify(b));assert.equal(supplied.candidates.length,2);assert.equal(b.scannerDiscovery.candidates.length,2);
  assert.ok(supplied.candidates.every(c=>c.side==='long'&&Number.isFinite(c.close)&&Number.isFinite(c.changePercent)&&Number.isFinite(c.sma20)));
  assert.equal(b.analysisContext,null);assert.equal(b.source,'Twelve Data');
 }finally{process.env=oldEnv;globalThis.fetch=oldFetch;Date.now=oldNow}
});

test('a 10,000-stock chat search stops reading candle rows once the requested candidates exist',async()=>{
 const f=fixture(),symbols=Array.from({length:10000},(_,i)=>'S'+i),configured={...env,ASAF_MARKET_ALLOWED_SYMBOLS:symbols.join(',')},commands=[];
 const rows=symbols.map(symbol=>({symbol,key:'test-row:'+symbol}));
 for(let i=0;i<CHAT_SCANNER_PAGE_SIZE*2;i++){
  const symbol=symbols[i],record={...records[0],symbol,fundamentals:{...records[0].fundamentals,symbol}};
  f.db.set(rows[i].key,JSON.stringify(record));
 }
 f.db.set(sharedScannerKey(configured)+':snapshot',JSON.stringify({...snapshot,format:'scanner-symbol-manifest-v1',records:[],rows,total:10000}));
 const run=async a=>{commands.push(a);return f.run(a)};
 const result=await readChatScanner({side:'long',limit:2},{env:configured,memberId:id,now,run});
 assert.equal(result.candidates.length,2);assert.equal(result.total,10000);assert.equal(result.scanned,CHAT_SCANNER_PAGE_SIZE);assert.equal(result.partial,true);
 const reads=commands.filter(a=>a[0]==='MGET');assert.equal(reads.length,1);assert.equal(reads[0].length,CHAT_SCANNER_PAGE_SIZE+1);
 assert.ok(commands.every(a=>['GET','MGET'].includes(a[0])));
 const next=await readChatScanner({side:'long',limit:2,excludeSymbols:result.candidates.map(c=>c.symbol)},{env:configured,memberId:id,now,run});
 assert.equal(next.candidates.length,2);assert.ok(next.candidates.every(c=>!result.candidates.some(prior=>prior.symbol===c.symbol)));
});

test('discovery reads another page when filters reject the first, and never silently drops filters',async()=>{
 const invalid=records.map(r=>({...r,fundamentals:{...r.fundamentals,marketCap:1e8}}));let pages=0;
 const result=await readChatScanner({side:'long',limit:2,filters:{minMarketCap:1e9}},{env,memberId:id,now,readScan:async({page})=>{
  pages++;assert.equal(page.offset,pages===1?0:4);return {...snapshot,records:pages===1?invalid:records.map(r=>({...r,symbol:'NEXT'+r.symbol,fundamentals:{...r.fundamentals,symbol:'NEXT'+r.symbol}})),pagination:{nextOffset:4,hasMore:pages===1}};
 }});
 assert.equal(pages,2);assert.equal(result.candidates.length,2);assert.ok(result.candidates.every(c=>c.marketCapUsd>=1e9));
});

test('a hanging scanner read returns a bounded error instead of waiting for host termination',async()=>{
 await assert.rejects(readChatScanner({side:'long',limit:2},{env,memberId:id,now,timeoutMs:10,readScan:()=>new Promise(()=>{})}),/התעכבה/);
});


test('model outages return the verified scanner prices without another model or data-provider request',async()=>{
 for(const failure of ['unavailable','quota','empty','aborted']){
  const oldEnv=process.env,oldFetch=globalThis.fetch,oldNow=Date.now,f=fixture();process.env={...env};Date.now=()=>now;
  const user=seed(f,'owner@example.test',id);f.db.set(sharedScannerKey(env)+':snapshot',JSON.stringify(snapshot));let calls=0;
  globalThis.fetch=async(url,init)=>{
   const b=JSON.parse(init.body);if(url==='https://test.upstash.io'){if(b[0]==='EVAL'&&b[1].includes('owner-chat-burst'))return Response.json({result:1});return Response.json({result:await f.run(b)})}
   assert.equal(url,'https://api.openai.com/v1/responses');calls++;
   if(failure==='aborted')throw new DOMException('Timeout','AbortError');
   if(failure==='empty')return Response.json({status:'completed',output:[]});
   return Response.json({error:{code:'not_available'}},{status:failure==='quota'?429:503});
  };
  try{
   const response=await handler(request('free-chat',{message:'מניות ללונג',language:'he'},user.cookie)),data=await response.json();
   assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.answerMode,'verified-data');assert.equal(data.modelUnavailable,true);assert.equal(calls,1);
   assert.equal(data.scannerDiscovery.candidates.length,3);for(const c of data.scannerDiscovery.candidates)assert.ok(data.answer.includes(c.symbol));assert.match(data.answer,/ניתוח ה־AI לא הושלם/);
  }finally{process.env=oldEnv;globalThis.fetch=oldFetch;Date.now=oldNow}
 }
});

test('expired trial data never becomes an outage fallback, even if it was authorized before inference',async()=>{
 const oldEnv=process.env,oldFetch=globalThis.fetch,oldNow=Date.now,f=fixture(),expires=now+1000;
 const trial={...env,ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:id,ASAF_TWELVE_TRIAL_ENDS_AT:new Date(expires).toISOString()};process.env=trial;Date.now=()=>now;
 const user=seed(f,'owner@example.test',id);f.db.set(sharedScannerKey(trial)+':snapshot',JSON.stringify(snapshot));
 globalThis.fetch=async(url,init)=>{
  const b=JSON.parse(init.body);if(url==='https://test.upstash.io'){if(b[0]==='EVAL'&&b[1].includes('owner-chat-burst'))return Response.json({result:1});return Response.json({result:await f.run(b)})}
  Date.now=()=>expires;return Response.json({error:{}},{status:503});
 };
 try{const response=await handler(request('free-chat',{message:'מניות ללונג',language:'he'},user.cookie)),data=await response.json();assert.equal(response.status,502);assert.equal(data.answer,undefined);assert.equal(data.scannerDiscovery,undefined)}
 finally{process.env=oldEnv;globalThis.fetch=oldFetch;Date.now=oldNow}
});

test('an outage data summary refunds the reserved application credits',async()=>{
 const oldEnv=process.env,oldFetch=globalThis.fetch,oldNow=Date.now,f=fixture();process.env={...env,ASAF_WEEKLY_CREDITS_ENABLED:'true',ASAF_BILLING_ENABLED:'true',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'mock',PAYPAL_CLIENT_SECRET:'mock',PAYPAL_WEBHOOK_ID:'mock',PAYPAL_PLAN_STARTER_ID:'P-STARTER',PAYPAL_PLAN_PLUS_ID:'P-PLUS',PAYPAL_PLAN_PRO_ID:'P-PRO',PAYPAL_PLAN_PREMIUM_ID:'P-PREMIUM'};Date.now=()=>now;
 const user=seed(f,'customer@example.test','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
 const identity=await billingIdentity(user.record.id,{env:process.env,run:f.run});await saveBilling(identity,{trialStartedAt:now-86400000,trialEndsAt:now+6*86400000,trialTotalCredits:50},{env:process.env,run:f.run});
 f.db.set(sharedScannerKey(env)+':snapshot',JSON.stringify(snapshot));let refunds=0,usageKey;
 globalThis.fetch=async(url,init)=>{
  const b=JSON.parse(init.body);if(url!=='https://test.upstash.io')return Response.json({error:{}},{status:503});
  if(b[0]==='EVAL'){
   if(b[1].includes('trial-total-migration'))return Response.json({result:1});
   if(b[1].includes('weekly-credit-reserve')){const [key,res,cost]=b.slice(3);usageKey=key;f.db.set(key,cost);f.db.set(res,cost);return Response.json({result:Number(cost)})}
   if(b[1].includes('weekly-credit-refund')){const [key,res]=b.slice(3);refunds++;f.db.set(key,'0');f.db.delete(res);return Response.json({result:1})}
  }
  return Response.json({result:await f.run(b)});
 };
 try{
  const response=await handler(request('free-chat',{message:'מניות ללונג',language:'he',creditConsent:4},user.cookie)),data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.answerMode,'verified-data');assert.equal(data.credits.charged,0);assert.equal(data.credits.remaining,50);assert.equal(refunds,1);assert.equal(f.db.get(usageKey),'0');
 }finally{process.env=oldEnv;globalThis.fetch=oldFetch;Date.now=oldNow}
});
