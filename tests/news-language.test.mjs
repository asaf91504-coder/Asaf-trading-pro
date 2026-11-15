import test from 'node:test';
import assert from 'node:assert/strict';
import {translateNews} from '../server/news-language.mjs';
const env={ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'test',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'test',CONTEXT:'production'};
const articles=[{id:'one',title:'Apple earnings rise',url:'https://example.test',source:'Test'}];
test('translation preserves source and caches titles per language without repeating model requests',async()=>{
 const cache=new Map();let calls=0;
 const run=async args=>{if(args[0]==='GET')return cache.get(args[1]);if(args[0]==='MGET')return args.slice(1).map(key=>cache.get(key)||null);if(args[0]==='SET'){cache.set(args[1],args[2]);return 'OK'}};
 const fetcher=async(_,options)=>{calls++;const body=JSON.parse(options.body);assert.ok(body.models.every(model=>model.endsWith(':free')));return {ok:true,json:async()=>({choices:[{message:{content:'["רווחי אפל עולים"]'},finish_reason:'stop'}]})}};
 const options={env,run,fetcher,reserve:async()=>true};
 const result=await translateNews(articles,'he',options);assert.equal(result.translation,'translated');assert.equal(result.articles[0].originalTitle,articles[0].title);assert.equal(result.articles[0].url,articles[0].url);
 await translateNews(articles,'he',options);assert.equal(calls,1);
 await translateNews(articles,'es',options);assert.equal(calls,2);
});
test('quota exhaustion or malformed output preserves original headlines explicitly',async()=>{
 let called=false;const run=async args=>args[0]==='SET'?'OK':null;
 const result=await translateNews(articles,'he',{env,run,reserve:async()=>false,fetcher:async()=>{called=true}});assert.equal(called,false);assert.equal(result.translation,'unavailable');assert.deepEqual(result.articles,articles);
 const malformed=await translateNews(articles,'he',{env,run,reserve:async()=>true,fetcher:async()=>({ok:true,json:async()=>({choices:[{message:{content:'[]'}}]})})});assert.equal(malformed.translation,'unavailable');
});
test('small batches preserve completed translations across headline refreshes',async()=>{
 const cache=new Map();let calls=0;
 const run=async args=>{if(args[0]==='MGET')return args.slice(1).map(k=>cache.get(k)||null);if(args[0]==='GET')return cache.get(args[1]);if(args[0]==='SET'){cache.set(args[1],args[2]);return 'OK'}};
 const fetcher=async(_,options)=>{calls++;const input=JSON.parse(JSON.parse(options.body).messages[1].content);assert.ok(input.length<=8);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({titles:input.map(t=>'תרגום '+t)})},finish_reason:'stop'}]})}};
 const options={env,run,fetcher,reserve:async()=>true},items=Array.from({length:10},(_,i)=>({...articles[0],id:String(i),title:'Title '+i}));
 const first=await translateNews(items,'he',options);assert.equal(first.translation,'partial');assert.equal(first.articles.filter(a=>a.originalTitle).length,8);
 const second=await translateNews(items,'he',options);assert.equal(second.translation,'translated');assert.equal(calls,2);
 const third=await translateNews([...items].reverse(),'he',options);assert.equal(third.translation,'translated');assert.equal(calls,2);
});
