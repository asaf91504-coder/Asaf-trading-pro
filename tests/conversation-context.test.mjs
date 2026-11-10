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
