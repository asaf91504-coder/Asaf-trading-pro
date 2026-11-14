import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/free-chat.mjs';
const request=payload=>new Request('https://app.test/.netlify/functions/free-chat',{method:'POST',headers:{'content-type':'application/json','x-asaf-free-ai-code':'owner-test-secret-at-least-24'},body:JSON.stringify(payload)});
test('web research is grounded in citations and isolated from chart context in the complete handler',async()=>{
 const old={...process.env},original=global.fetch,calls=[];
 Object.assign(process.env,{ASAF_FREE_AI_ENABLED:'true',ASAF_PUBLIC_AUTH_ENABLED:'false',ASAF_FREE_AI_DURABLE_QUOTA:'false',ASAF_FREE_AI_ACCESS_CODE:'owner-test-secret-at-least-24',OPENROUTER_API_KEY:'mock',ASAF_WEB_SEARCH_APPROVED:'true',ASAF_WEB_SEARCH_MONTHLY_LIMIT:'100',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'mock'});
 global.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);calls.push({url,body});
  if(url.includes('upstash.io'))return Response.json({result:1});
  if(body.plugins)return Response.json({choices:[{message:{content:'DO_NOT_USE_GENERATED_SUMMARY',annotations:[{type:'url_citation',url_citation:{url:'https://investor.example/results',title:'Results',content:'Sales increased 10%.'}}]}}]});
  return Response.json({choices:[{message:{content:'המכירות עלו ב־10% [1].'},finish_reason:'stop'}]});
 };
 try{
  const response=await handler(request({message:'בדוק את הדוח',symbol:'AAPL',webSearch:true,history:[{role:'user',content:'PRIVATE_OLD_MESSAGE'}]}));
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.webSearch.sources[0].url,'https://investor.example/results');assert.equal('excerpt' in result.webSearch.sources[0],false);
  const search=calls.find(c=>c.body.plugins);assert.doesNotMatch(JSON.stringify(search),/PRIVATE_OLD_MESSAGE/);
  const answer=calls.at(-1).body;assert.match(JSON.stringify(answer),/Sales increased 10%/);assert.doesNotMatch(JSON.stringify(answer),/DO_NOT_USE_GENERATED_SUMMARY/);assert.equal(answer.plugins,undefined);
  process.env.ASAF_WEB_SEARCH_APPROVED='false';calls.length=0;
  const blocked=await handler(request({message:'בדוק חדשות',webSearch:true}));assert.equal(blocked.status,503);assert.equal(calls.length,0);
 }finally{process.env=old;global.fetch=original}
});
