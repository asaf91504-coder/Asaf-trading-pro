import test from 'node:test';
import assert from 'node:assert/strict';
import news from '../netlify/functions/news.mjs';
import background from '../netlify/functions/news-translate-background.mjs';
import {filterCachedNews} from '../news-search.mjs';
import {translationJobKey,validTranslationJob} from '../server/news-translation-job.mjs';
test('a public headline set queues one signed free translation and subsequent reads return translated versions of the same articles',async()=>{
 const previousEnv=process.env,previousFetch=globalThis.fetch,db=new Map(),queued=[];let inference=0;
 process.env={CONTEXT:'production',ASAF_FREE_AI_ENABLED:'true',OPENROUTER_API_KEY:'fixture',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'fixture',URL:'https://example.test'};
 const articles=[{id:'markets:apple',title:'Apple earnings rise 15%',source:'Fixture',url:'https://example.test/apple',publishedAt:new Date(Date.now()-60000).toISOString(),symbols:['AAPL']},
  {id:'markets:nvidia',title:'Nvidia shares fall 4%',source:'Fixture',url:'https://example.test/nvidia',publishedAt:new Date(Date.now()-120000).toISOString(),symbols:['NVDA']}];
 const translations={'Apple earnings rise 15%':'רווחי אפל עולים ב־15%','Nvidia shares fall 4%':'מניית אנבידיה יורדת ב־4%'};
 db.set('asaf:production:news:public:us:snapshot',JSON.stringify({articles,updatedAt:new Date().toISOString()}));
 globalThis.fetch=async(url,options)=>{
  url=String(url);const args=JSON.parse(options.body);
  if(url==='https://test.upstash.io'){
   if(args[0]==='GET')return Response.json({result:db.get(args[1])||null});
   if(args[0]==='MGET')return Response.json({result:args.slice(1).map(key=>db.get(key)||null)});
   if(args[0]==='SET'){if(args.includes('NX')&&db.has(args[1]))return Response.json({result:null});db.set(args[1],args[2]);return Response.json({result:'OK'})}
   if(args[0]==='DEL'){db.delete(args[1]);return Response.json({result:1})}
   if(args[0]==='EVAL')return Response.json({result:1});
   throw Error('Unexpected storage operation');
  }
  if(url==='https://example.test/.netlify/functions/news-translate-background'){
   assert.equal(validTranslationJob(options.body,options.headers['X-ASAF-Job-Signature'],'fixture'),true);
   queued.push(new Request(url,options));return new Response(null,{status:202});
  }
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(args.model,'openrouter/free');assert.equal(args.models,undefined);assert.deepEqual(args.response_format,{type:'json_object'});
  inference++;return Response.json({choices:[{message:{content:JSON.stringify({titles:JSON.parse(args.messages[1].content).map(title=>translations[title])})},finish_reason:'stop'}]});
 };
 try{
  const request=language=>new Request('https://example.test/.netlify/functions/news?lang='+language);
  const first=await(await news(request('he'))).json();assert.equal(first.translation,'pending');assert.equal(inference,0);assert.equal(queued.length,1);
  await news(request('he'));assert.equal(queued.length,1);
  assert.match(translationJobKey('he'),/:job:v2:he$/);
  await background(queued[0]);assert.equal(inference,1);
  const result=await(await news(request('he'))).json();assert.equal(result.translation,'translated');
  for(const item of result.articles){const original=articles.find(a=>a.id===item.id);assert.equal(item.title,translations[original.title]);assert.equal(item.titleLanguage,'he');assert.equal(item.originalTitle,original.title);for(const key of ['id','url','source','publishedAt'])assert.equal(item[key],original[key]);}
  assert.equal(filterCachedNews(result.articles,{query:'Nvidia'})[0].id,'markets:nvidia');
  assert.equal(filterCachedNews(result.articles,{query:'אנבידיה'})[0].id,'markets:nvidia');
  const english=await(await news(request('en'))).json();assert.equal(english.translation,'original');assert.deepEqual(english.articles.map(a=>a.title),articles.map(a=>a.title));assert.equal(inference,1);
 }finally{process.env=previousEnv;globalThis.fetch=previousFetch}
});
