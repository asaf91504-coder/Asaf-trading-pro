import test from 'node:test';
import assert from 'node:assert/strict';
import {translateNews,translatedTitleValid} from '../server/news-language.mjs';
const env={ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'test',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'test',CONTEXT:'production'};
const articles=[{id:'one',title:'Apple earnings rise',url:'https://example.test',source:'Test'}];
test('translation preserves source and caches titles per language without repeating model requests',async()=>{
 const cache=new Map();let calls=0;
 const run=async args=>{if(args[0]==='GET')return cache.get(args[1]);if(args[0]==='MGET')return args.slice(1).map(key=>cache.get(key)||null);if(args[0]==='SET'){cache.set(args[1],args[2]);return 'OK'}};
 const fetcher=async(_,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.model,'openrouter/free');assert.equal(body.models,undefined);assert.deepEqual(body.response_format,{type:'json_object'});return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify([body.messages[0].content.includes('Spanish')?'Los beneficios de Apple aumentan':'רווחי אפל עולים'])},finish_reason:'stop'}]})}};
 const options={env,run,fetcher,reserve:async()=>true};
 const result=await translateNews(articles,'he',options);assert.equal(result.translation,'translated');assert.equal(result.articles[0].originalTitle,articles[0].title);assert.equal(result.articles[0].url,articles[0].url);
 await translateNews(articles,'he',options);assert.equal(calls,1);
 const spanish=await translateNews(articles,'es',options);assert.equal(spanish.translation,'translated');assert.equal(spanish.articles[0].title,'Los beneficios de Apple aumentan');assert.equal(calls,2);
});
test('quota exhaustion or malformed output preserves original headlines explicitly',async()=>{
 let called=false;const run=async args=>args[0]==='SET'?'OK':null;
 const result=await translateNews(articles,'he',{env,run,reserve:async()=>false,fetcher:async()=>{called=true}});assert.equal(called,false);assert.equal(result.translation,'unavailable');assert.deepEqual(result.articles,articles);
 const malformed=await translateNews(articles,'he',{env,run,reserve:async()=>true,fetcher:async()=>({ok:true,json:async()=>({choices:[{message:{content:'[]'}}]})})});assert.equal(malformed.translation,'unavailable');
});
test('small batches preserve completed translations across headline refreshes',async()=>{
 const cache=new Map();let calls=0;
 const run=async args=>{if(args[0]==='MGET')return args.slice(1).map(k=>cache.get(k)||null);if(args[0]==='GET')return cache.get(args[1]);if(args[0]==='SET'){cache.set(args[1],args[2]);return 'OK'}};
 const fetcher=async(_,options)=>{calls++;const input=JSON.parse(JSON.parse(options.body).messages[1].content);assert.ok(input.length<=25);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({titles:input.map(t=>'תרגום '+t)})},finish_reason:'stop'}]})}};
 const options={env,run,fetcher,reserve:async()=>true},items=Array.from({length:30},(_,i)=>({...articles[0],id:String(i),title:'Title '+i}));
 const first=await translateNews(items,'he',options);assert.equal(first.translation,'partial');assert.equal(first.articles.filter(a=>a.originalTitle).length,25);
 const second=await translateNews(items,'he',options);assert.equal(second.translation,'translated');assert.equal(calls,2);
 const third=await translateNews([...items].reverse(),'he',options);assert.equal(third.translation,'translated');assert.equal(calls,2);
});
test('cache-only reads never call a model or consume quota',async()=>{
 const result=await translateNews(articles,'he',{env,cacheOnly:true,run:async()=>[null],reserve:async()=>{throw Error('must not reserve')},fetcher:async()=>{throw Error('must not fetch')}});
 assert.equal(result.translation,'pending');assert.deepEqual(result.articles,articles);
});
test('cached translations remain readable when inference is disabled, and wrong-language cache entries are not accepted',async()=>{
 let value='רווחי אפל עולים',calls=0;
 const run=async()=>[value],fetcher=async()=>{calls++;throw Error('no inference')};
 const cached=await translateNews(articles,'he',{env:{...env,ASAF_FREE_AI_ENABLED:'false',OPENROUTER_API_KEY:undefined},run,fetcher,cacheOnly:true});
 assert.equal(cached.translation,'translated');assert.equal(cached.articles[0].title,value);
 value=articles[0].title;
 const invalid=await translateNews(articles,'he',{env,run,fetcher,cacheOnly:true});
 assert.equal(invalid.translation,'pending');assert.equal(invalid.articles[0].titleLanguage,undefined);assert.equal(calls,0);
});
test('English passthrough is rejected instead of being marked as translated Hebrew',async()=>{
 const result=await translateNews(articles,'he',{env,run:async args=>args[0]==='SET'?'OK':null,reserve:async()=>true,
  fetcher:async()=>Response.json({choices:[{message:{content:JSON.stringify({titles:[articles[0].title]})},finish_reason:'stop'}]})});
 assert.equal(result.translationReason,'invalid_output');assert.equal(result.translation,'unavailable');assert.equal(result.articles[0].originalTitle,undefined);
 for(const [language,title] of [['he','רווחי אפל עולים'],['ar','ارتفاع أرباح أبل'],['ru','Прибыль Apple растёт'],['zh','苹果利润上升'],['ja','Appleの利益が上昇']]){
  assert.equal(translatedTitleValid(title,articles[0].title,language),true);
  assert.equal(translatedTitleValid(articles[0].title,articles[0].title,language),false);
 }
});
