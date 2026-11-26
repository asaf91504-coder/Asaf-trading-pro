import test from 'node:test';
import assert from 'node:assert/strict';
import {currentUSMarketIntent} from '../chat-market-intent.mjs';
import handler from '../netlify/functions/free-chat.mjs';
test('broad market examples match without swallowing stock or chart requests',()=>{
 for(const question of ['מה אתה חושב על השוק היום','מה דעתך על השוק היום?','איך השוק היום?','איך המסחר בשוק האמריקאי עכשיו','סקירת השוק היום','how is the stock market doing today?','what do you think about the U.S. market today?','¿Cómo va el mercado hoy?'])assert.equal(currentUSMarketIntent(question),true,question);
 for(const question of ['מה אתה חושב על AAPL היום','מה אתה חושב על השוק היום ותוסיף MA20','איך השוק היום ביפן','סכם לי את הגרף על השוק היום','tell me how the market works','what about the market today and delete overlays?'])assert.equal(currentUSMarketIntent(question),false,question);
});
test('screenshot question isolates market context from chart, history, tools and ancillary licenses',async()=>{
 const oldEnv=process.env,oldFetch=globalThis.fetch;
 const key='test-market-intent-qwerty-asdf';
 process.env={ASAF_FREE_AI_ENABLED:'true',ASAF_FREE_AI_ACCESS_CODE:key,OPENROUTER_API_KEY:'fake',ASAF_TWELVE_PRIVATE_TRIAL:'true'};
 let calls=0;
 globalThis.fetch=async(url,init)=>{
  calls++;
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
  const {messages}=JSON.parse(init.body);
  assert.equal(messages.length,2);
  assert.match(messages[0].content,/U\.S\. stock market, not an individual stock/);
  assert.match(messages[1].content,/Question: מה אתה חושב על השוק היום/);
  assert.match(messages[1].content,/MARKET_HEADLINES.*\n\[\]/);
  assert.doesNotMatch(JSON.stringify(messages.slice(1)),/AAPL|PRIVATE-HISTORY|LICENSED-NUMBER|CLIENT_TOOL_RECEIPT|SELECTED_CHART/);
  return {ok:true,json:async()=>({choices:[{message:{content:'אין כרגע כותרות מאומתות, וכדאי להשוות את המדדים המובילים.'}}]})};
 };
 try{
  const res=await handler(new Request('https://example.test/.netlify/functions/free-chat',{method:'POST',headers:{'Content-Type':'application/json','x-asaf-free-ai-code':key},body:JSON.stringify({
   message:'מה אתה חושב על השוק היום',language:'he',chartControl:true,symbol:'AAPL',source:'Twelve Data',useServerMarket:true,
   bars:[['LICENSED-NUMBER']],image:'data:image/png;base64,abcd',chartToolReceipt:'LICENSED-NUMBER',history:[{role:'user',content:'PRIVATE-HISTORY'}]
  })}));
  assert.equal(res.status,200);const body=await res.json();assert.equal(body.responseLanguage,'he');assert.equal(body.analysisContext,null);assert.equal(body.webSearch,undefined);assert.equal(body.actions,undefined);assert.equal(calls,1);
 }finally{process.env=oldEnv;globalThis.fetch=oldFetch;}
});
test('a fresh cache becomes numbered, dated sources while leaving interface language intact',async()=>{
 const oldEnv=process.env,oldFetch=globalThis.fetch;
 const key='test-market-intent-qwerty-asdf',publishedAt=new Date(Date.now()-5000).toISOString();
 process.env={ASAF_FREE_AI_ENABLED:'true',ASAF_FREE_AI_ACCESS_CODE:key,OPENROUTER_API_KEY:'fake',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://fixture.upstash.io',ASAF_REDIS_REST_TOKEN:'fake'};
 let chartOrPaidSearch=false;
 globalThis.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);
  if(url==='https://fixture.upstash.io'){
   if(body[1].endsWith(':scheduled'))return Response.json({result:null});
   return Response.json({result:JSON.stringify({updatedAt:publishedAt,articles:[{id:'markets:fixture',url:'https://news.example.test/market',title:'Nasdaq-100 futures decline ahead of data',publishedAt,source:'Public source'},{id:'markets:aapl',url:'https://news.example.test/aapl',title:'Apple announces new iPhone',publishedAt,source:'Public source'}]})});
  }
  if(url!=='https://openrouter.ai/api/v1/chat/completions'||body.plugins){chartOrPaidSearch=true;throw Error('Unexpected call')}
  assert.match(body.messages[0].content,/Spanish/);
  assert.match(body.messages.at(-1).content,/Nasdaq-100 futures decline/);
  assert.doesNotMatch(body.messages.at(-1).content,/iPhone|SELECTED_CHART/);
  return Response.json({choices:[{message:{content:'Los futuros bajaron antes de los datos [1].'}}]});
 };
 try{
  const r=await handler(new Request('https://example.test/.netlify/functions/free-chat',{method:'POST',headers:{'Content-Type':'application/json','x-asaf-free-ai-code':key},body:JSON.stringify({message:'What do you think about the market today?',language:'es',symbol:'AAPL'})}));
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.responseLanguage,'es');
  assert.equal(body.webSearch.kind,'cached-market-headlines');
  assert.deepEqual(body.webSearch.sources,[{id:1,url:'https://news.example.test/market',title:'Nasdaq-100 futures decline ahead of data',publishedAt}]);
  assert.equal(chartOrPaidSearch,false);
 }finally{process.env=oldEnv;globalThis.fetch=oldFetch;}
});


test('market overview accepts a second sentence requesting index changes and technical zones',()=>{
 for(const q of ['מה קורה בשוק היום? תן שינוי באחוזים במדדים, תמיכות והתנגדויות בקצרה.','מה אתה חושב על השוק היום? הצג תמיכות והתנגדויות'])assert.equal(currentUSMarketIntent(q),true);
 for(const q of ['מה קורה בשוק היום? תן ניתוח AAPL','מה קורה בשוק היום? תן שינוי באחוזים ביפן','מה קורה בשוק היום? תן שינוי באחוזים במדדים ותוסיף MA20'])assert.equal(currentUSMarketIntent(q),false);
});
