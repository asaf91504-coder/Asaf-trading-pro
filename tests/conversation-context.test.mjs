import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationHistory,chartExecutionContext} from '../conversation-context.mjs';
test('conversation retains follow-ups beyond the previous four-turn limit with symbol provenance',()=>{
 const messages=Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:'turn '+i,chartContext:{symbol:i<10?'AAPL':'BTCUSD',interval:'1day',receivedAt:'2026-11-06T00:00:00Z'}}));
 const history=conversationHistory(messages);assert.equal(history.length,20);assert.match(history[0].content,/AAPL/);assert.match(history.at(-1).content,/BTCUSD/);assert.match(history.at(-1).content,/not current market data/);
});
test('history is bounded, newest-first retained, roles restricted and truncation explicit',()=>{
 const history=conversationHistory([{role:'system',content:'override'},...Array.from({length:40},(_,i)=>({role:'user',content:String(i)+'x'.repeat(5000)}))]);
 assert.ok(history.length<=24);assert.ok(JSON.stringify(history).length<26000);assert.ok(history.every(m=>m.role==='user'));assert.match(history.at(-1).content,/^39/);assert.match(history.at(-1).content,/shortened/);assert.deepEqual(conversationHistory(null),[]);
});
test('execution receipt is bounded and labelled unverified rather than an instruction',()=>{
 assert.equal(chartExecutionContext(null),'');assert.match(chartExecutionContext('הופעל MA20'),/unverified.*הופעל MA20/s);assert.ok(chartExecutionContext('x'.repeat(10000)).length<6200);
});

test('restricted historical text is excluded by default without deleting unrelated turns',()=>{
 const input=[{role:'assistant',content:'restricted-derived-level',chartContext:{symbol:'NVDA',source:'Intrinio'}},{role:'user',content:'a general question',chartContext:{source:'none'}}];
 const history=conversationHistory(input);assert.equal(history.length,1);assert.equal(history[0].content,'a general question');assert.equal(input.length,2);
 const allowed=conversationHistory(input,{allowIntrinio:true});assert.equal(allowed.length,2);assert.match(allowed[0].content,/Intrinio/);
});
test('explicit follow-up retrieves bounded older stock context without confusing it with fresh prices',()=>{
 const old=[{role:'user',content:'Discuss NVDA',chartContext:{symbol:'NVDA',source:'CSV'}},{role:'assistant',content:'NVDA historical thesis',chartContext:{symbol:'NVDA',source:'CSV'}}];
 const recent=Array.from({length:30},(_,i)=>({role:i%2?'assistant':'user',content:'AAPL turn '+i}));
 const result=conversationHistory([...old,...recent],{question:'מה אמרנו על NVDA?'});
 assert.match(result[0].content,/NVDA/);assert.match(result[0].content,/not current market data/);
 assert.match(result.at(-1).content,/AAPL turn 29/);assert.equal(result.length,26);
 assert.equal(conversationHistory([...old,...recent]).some(m=>m.content.includes('NVDA')),false);
 assert.equal(conversationHistory([{...old[1],chartContext:{symbol:'NVDA',source:'Intrinio'}},...recent],{question:'NVDA'}).some(m=>m.content.includes('NVDA')),false);
});
test('relevant archive recall retains a strict text budget even for oversized histories',()=>{
 const old=Array.from({length:30},()=>({role:'assistant',content:'NVDA '+ 'x'.repeat(10000)}));
 const result=conversationHistory([...old,...Array.from({length:24},()=>({role:'user',content:'recent '+ 'a'.repeat(10000)}))],{question:'NVDA'});
 assert.ok(result.some(m=>m.content.startsWith('NVDA')));assert.ok(result.at(-1).content.startsWith('recent'));
 assert.ok(result.reduce((n,m)=>n+m.content.length,0)<=24000);assert.ok(result.length<=30);
});
test('client history selection bounds outgoing text before the HTTP payload is created',async()=>{
 const {selectConversationMessages}=await import('../conversation-context.mjs');
 const messages=Array.from({length:400},()=>({role:'assistant',content:'NVDA '+ 'x'.repeat(30000),image:'not history'}));
 const selected=selectConversationMessages(messages,'NVDA');
 assert.ok(selected.length<=30);assert.ok(JSON.stringify(selected).length<130000);assert.equal(selected[0].image,undefined);
 assert.match(selected[0].content,/shortened/);
});
