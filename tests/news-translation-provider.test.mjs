import test from 'node:test';
import assert from 'node:assert/strict';
import {translateNews} from '../server/news-language.mjs';
import {queueTranslationJob,validTranslationJob,newsTranslationSecret} from '../server/news-translation-job.mjs';
import {reserveNewsTranslation} from '../server/news-translation-budget.mjs';
import {newsRefreshInterval} from '../news-refresh-policy.mjs';
const env={CONTEXT:'production',ASAF_AI_PROVIDER:'openai',ASAF_OPENAI_ENABLED:'true',OPENAI_API_KEY:'fixture-not-real',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'fixture'};
function cache(){const db=new Map();return {db,run:async a=>{if(a[0]==='MGET')return a.slice(1).map(k=>db.get(k)||null);if(a[0]==='GET')return db.get(a[1])||null;if(a[0]==='SET'){if(a.includes('NX')&&db.has(a[1]))return null;db.set(a[1],a[2]);return 'OK'}if(a[0]==='DEL'){db.delete(a[1]);return 1}if(a[0]==='EVAL')return 1;throw Error('unexpected storage call')}}}
const items=Array.from({length:13},(_,i)=>({id:'article-'+i,title:'Company '+i+' earnings rise 10%',url:'https://example.test/'+i,source:'Fixture'}));
const response=titles=>Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({titles})}]}]});
test('news uses the configured AI without a legacy free key and caches bounded batches across visitors',async()=>{
 const f=cache();let calls=0;
 const fetcher=async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(init.body);const input=JSON.parse(body.input.at(-1).content);assert.ok(input.length<=10);assert.equal(body.store,false);assert.equal(body.max_output_tokens,1800);assert.match(body.instructions,/natural headline language/);calls++;return response(input.map(title=>'רווחי חברה '+title.match(/Company (\d+)/)[1]+' עולים ב־10%'))};
 const options={env,run:f.run,fetcher};
 assert.equal((await translateNews(items,'he',options)).translation,'partial');
 assert.equal((await translateNews(items,'he',options)).translation,'translated');assert.equal(calls,2);
 assert.equal((await translateNews([...items].reverse(),'he',options)).translation,'translated');assert.equal(calls,2);
});
test('one invalid translated title no longer discards the valid titles from its batch',async()=>{
 const f=cache();let first=true;
 const fetcher=async(_url,init)=>{const input=JSON.parse(JSON.parse(init.body).input.at(-1).content);const titles=input.map((t,i)=>first&&i===0?t:'רווחי חברה '+t.match(/Company (\d+)/)[1]+' עולים ב־10%');first=false;return response(titles)};
 const options={env,run:f.run,fetcher};const partial=await translateNews(items.slice(0,3),'he',options);assert.equal(partial.translation,'partial');assert.equal(partial.articles.filter(a=>a.titleLanguage==='he').length,2);
 const completed=await translateNews(items.slice(0,3),'he',options);assert.equal(completed.translation,'translated');
});
test('OpenAI-only translation jobs are signed, deduplicated and use the existing connection',async()=>{
 const f=cache();let calls=0;
 const options={env,run:f.run,fetcher:async(url,init)=>{calls++;assert.equal(String(url),'https://example.test/.netlify/functions/news-translate-background');assert.equal(validTranslationJob(init.body,init.headers['X-ASAF-Job-Signature'],newsTranslationSecret(env)),true);return new Response(null,{status:202})}};
 assert.equal(await queueTranslationJob('he','https://example.test',options),'pending');assert.equal(await queueTranslationJob('he','https://example.test',options),'pending');assert.equal(calls,1);
});
test('translation quota is global, bounded and independent of customer chat credits',async()=>{
 let calls=0;const run=async a=>{assert.equal(a[0],'EVAL');assert.match(a[1],/news-translation-budget-v1/);assert.match(a[3],/:news:translation:day:/);assert.doesNotMatch(JSON.stringify(a),/credits|ai:member|ai:day/);assert.equal(a.at(-2),'96');return ++calls===1?1:0};
 assert.equal(await reserveNewsTranslation({env,run}),true);assert.equal(await reserveNewsTranslation({env,run}),false);
 assert.equal(await reserveNewsTranslation({env:{...env,ASAF_NEWS_TRANSLATION_DAILY_LIMIT:'0'},run:async()=>{throw Error('must not call')}}),false);
 assert.equal(newsRefreshInterval({enabled:true,translation:'unavailable',translationReason:'quota'}),45000);assert.equal(newsRefreshInterval({enabled:true,translation:'translated'}),900000);assert.equal(newsRefreshInterval({enabled:true,translation:'unavailable',translationReason:'not_configured'}),900000);
});
