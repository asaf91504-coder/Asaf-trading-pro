import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{parseChartToolResponse} from '../netlify/functions/free-chat.mjs';

test('chart plans are declarative allowlisted data and ordinary replies can have no tools',()=>{
 const planned=parseChartToolResponse(JSON.stringify({answer:'אבדוק את הממוצע ואת התמיכות.',actions:[{type:'indicator',indicator:'MA50',enabled:true},{type:'levels',kind:'both'}]}));
 assert.equal(planned.chartActionStatus,'planned');
 assert.deepEqual(planned.actions,[{type:'indicator',indicator:'MA50',enabled:true},{type:'levels',kind:'both'}]);
 const plain=parseChartToolResponse('```json\n{"answer":"נדרש מידע נוסף.","actions":[]}\n```');
 assert.equal(plain.chartActionStatus,'none');assert.deepEqual(plain.actions,[]);assert.equal(plain.answer,'נדרש מידע נוסף.');
});
test('malformed, unsupported and truncated chart plans never execute a partial action list',()=>{
 for(const actions of [[{type:'script',code:'alert(1)'}],[{type:'indicator',indicator:'MA50',enabled:true},{type:'broker_order',side:'buy'}],null]){
  const result=parseChartToolResponse(JSON.stringify({answer:'בוצע!',actions}));
  assert.equal(result.chartActionStatus,'unavailable');assert.deepEqual(result.actions,[]);assert.doesNotMatch(result.answer,/בוצע!/);
 }
 const truncated=parseChartToolResponse('{"answer":"בוצע!","actions":[', {truncated:true});
 assert.deepEqual(truncated.actions,[]);assert.match(truncated.answer,/נקטעה/);
 const text=parseChartToolResponse('אני מציע לבדוק תמיכות.');
 assert.deepEqual(text.actions,[]);assert.match(text.answer,/לא בוצעה פעולת גרף/);
});
test('chart control is opt-in, uses a single free-model call and exposes validated plans only',async()=>{
 const previous={...process.env},original=global.fetch;
 Object.assign(process.env,{ASAF_FREE_AI_ENABLED:'true',ASAF_PUBLIC_AUTH_ENABLED:'false',ASAF_FREE_AI_DURABLE_QUOTA:'false',ASAF_FREE_AI_ACCESS_CODE:'test-owner-passcode-at-least-24',OPENROUTER_API_KEY:'mock-only'});
 let calls=[];
 global.fetch=async(url,init)=>{assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');calls.push(JSON.parse(init.body));return Response.json({choices:[{message:{content:JSON.stringify({answer:'אבדוק את הממוצע.',actions:[{type:'indicator',indicator:'MA20',enabled:true}]})},finish_reason:'stop'}]})};
 const request=chartControl=>new Request('https://app.test/.netlify/functions/free-chat',{method:'POST',headers:{'content-type':'application/json','x-asaf-free-ai-code':process.env.ASAF_FREE_AI_ACCESS_CODE},body:JSON.stringify({message:'הוסף MA20',symbol:'AAPL',chartControl})});
 try{
  const result=await handler(request(true));assert.equal(result.status,200);const body=await result.json();
  assert.equal(body.chartActionStatus,'planned');assert.deepEqual(body.actions,[{type:'indicator',indicator:'MA20',enabled:true}]);assert.equal(calls.length,1);assert.equal(calls[0].model,'openrouter/free');assert.match(calls[0].messages[0].content,/מצב כלי גרף/);
  const defaultResult=await handler(request(false));assert.equal(defaultResult.status,200);const defaultBody=await defaultResult.json();assert.equal('actions' in defaultBody,false);assert.equal(calls.length,2);assert.doesNotMatch(calls[1].messages[0].content,/מצב כלי גרף/);
 }finally{process.env=previous;global.fetch=original}
});
test('handler suppresses the entire model plan when any generated action is unsupported',async()=>{
 const previous={...process.env},original=global.fetch;
 Object.assign(process.env,{ASAF_FREE_AI_ENABLED:'true',ASAF_PUBLIC_AUTH_ENABLED:'false',ASAF_FREE_AI_DURABLE_QUOTA:'false',ASAF_FREE_AI_ACCESS_CODE:'test-owner-passcode-at-least-24',OPENROUTER_API_KEY:'mock-only'});
 let calls=0;
 global.fetch=async()=>{calls++;return Response.json({choices:[{message:{content:JSON.stringify({answer:'בוצע!',actions:[{type:'indicator',indicator:'MA20',enabled:true},{type:'script',code:'fetch("https://attacker.invalid")'}]})},finish_reason:'stop'}]})};
 try{
  const request=new Request('https://app.test/.netlify/functions/free-chat',{method:'POST',headers:{'content-type':'application/json','x-asaf-free-ai-code':process.env.ASAF_FREE_AI_ACCESS_CODE},body:JSON.stringify({message:'הוסף ממוצע',symbol:'AAPL',chartControl:true})});
  const response=await handler(request),body=await response.json();assert.equal(response.status,200);assert.equal(calls,1);assert.deepEqual(body.actions,[]);assert.equal(body.chartActionStatus,'unavailable');assert.match(body.answer,/לא בוצעה פעולת גרף/);assert.doesNotMatch(body.answer,/בוצע!|attacker/);
 }finally{process.env=previous;global.fetch=original}
});
