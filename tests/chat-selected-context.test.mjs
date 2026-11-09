import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/free-chat.mjs';

test('without candles, the model receives the current selection separately from historical conversation prices',async()=>{
 const keys=['ASAF_FREE_AI_ENABLED','OPENROUTER_API_KEY','ASAF_FREE_AI_ACCESS_CODE','ASAF_PUBLIC_AUTH_ENABLED','ASAF_FREE_AI_DURABLE_QUOTA'];
 const old=keys.map(k=>process.env[k]),originalFetch=globalThis.fetch;
 const pass='test_only_conversation_context_pass';let calls=0,sent;
 try{
  keys.forEach(k=>delete process.env[k]);Object.assign(process.env,{ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'test_only',ASAF_FREE_AI_ACCESS_CODE:pass});
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');calls++;sent=JSON.parse(options.body);
   return {ok:true,json:async()=>({choices:[{message:{content:'No current market data is available.'}}]})};
  };
  const response=await handler(new Request('https://site.test/.netlify/functions/free-chat',{method:'POST',headers:{'content-type':'application/json','x-asaf-free-ai-code':pass},body:JSON.stringify({
   message:'ומה לגבי המניה שבחרתי עכשיו?',symbol:'NVDA',interval:'1week',source:'none',bars:null,
   history:[{role:'user',content:'Explain AAPL'},{role:'assistant',content:'AAPL historical example: 100',chartContext:{symbol:'AAPL',interval:'1day',receivedAt:'2026-10-01T10:00:00Z'}}]
  })}));
  assert.equal(response.status,200);assert.equal(calls,1);assert.equal(sent.model,'openrouter/free');
  assert.match(sent.messages[0].content,/ההתמחות המרכזית שלך היא שוקי ההון/);
  assert.match(sent.messages[0].content,/גם בנושאים אחרים/);
  assert.doesNotMatch(sent.messages[0].content,/אל תספק עצות בנושאים שאינם שוק ההון/);
  const current=sent.messages.at(-1).content;
  assert.match(current,/SELECTED_CHART.*client selection only/s);assert.match(current,/"symbol":"NVDA"/);assert.match(current,/"interval":"1week"/);
  assert.match(current,/No verified OHLCV/);assert.doesNotMatch(current,/AAPL|100/);
  assert.match(sent.messages.at(-2).content,/AAPL.*Historical chart reference/s);
  assert.equal((await response.json()).analysisContext,null);
 }finally{globalThis.fetch=originalFetch;keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i])}
});
