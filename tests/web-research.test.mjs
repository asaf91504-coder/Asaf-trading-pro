import test from 'node:test';
import assert from 'node:assert/strict';
import {searchWeb,webSources} from '../server/web-research.mjs';
const env={ASAF_WEB_SEARCH_APPROVED:'true',ASAF_WEB_SEARCH_MONTHLY_LIMIT:'100',OPENROUTER_API_KEY:'mock',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://mock.upstash.io',ASAF_REDIS_REST_TOKEN:'mock'};
const annotation=(url='https://company.example/earnings',content='Revenue increased.')=>({type:'url_citation',url_citation:{url,title:'Quarterly results',content}});
test('search is fail closed before billable request without owner opt-in, quota or storage',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('must not call')};
 for(const override of [{ASAF_WEB_SEARCH_APPROVED:'false'},{ASAF_WEB_SEARCH_MONTHLY_LIMIT:''},{ASAF_WEB_SEARCH_MONTHLY_LIMIT:'1001'},{ASAF_EXTERNAL_SERVICES_APPROVED:'false'}])await assert.rejects(searchWeb({question:'news',env:{...env,...override},fetcher,run:async()=>1}));
 await assert.rejects(searchWeb({question:'news',env,fetcher,run:async()=>0}),e=>e.status===429);
 await assert.rejects(searchWeb({question:'news',env,fetcher,run:async()=>{throw Error('offline')}}));assert.equal(calls,0);
});
test('one bounded search sends only question and symbol, preserves provenance, ignores generated summary',async()=>{
 const calls=[];let quota;
 const result=await searchWeb({question:'What did Apple report?',symbol:'NASDAQ:AAPL',history:[{content:'SECRET_HISTORY'}],bars:[{close:123}],env,now:Date.UTC(2026,10,13),run:async args=>{quota=args;return 1},fetcher:async(url,init)=>{calls.push(JSON.parse(init.body));return Response.json({choices:[{message:{content:'UNSUPPORTED_MODEL_CLAIM',annotations:[annotation()]}}]})}});
 assert.equal(calls.length,1);assert.deepEqual(calls[0].plugins,[{id:'web',engine:'parallel',mode:'basic',max_results:5}]);
 assert.doesNotMatch(JSON.stringify(calls),/SECRET_HISTORY|123/);assert.doesNotMatch(JSON.stringify(result),/UNSUPPORTED_MODEL_CLAIM/);
 assert.equal(result.sources[0].excerpt,'Revenue increased.');assert.equal(result.searchedAt,'2026-11-13T00:00:00.000Z');assert.match(quota[3],/web-search:month:2026-11/);
});
test('unsafe URLs, duplicates and oversized snippets are bounded',()=>{
 const sources=webSources([annotation('javascript:alert(1)'),annotation('https://user:pass@example.com'),annotation('http://127.0.0.1'),annotation(),annotation(),annotation('https://second.example','x'.repeat(9000))]);
 assert.equal(sources.length,2);assert.equal(sources[1].excerpt.length,2400);assert.equal(sources[1].id,2);
});
test('search errors and missing citations never masquerade as successful web research',async()=>{
 for(const fetcher of [async()=>Response.json({}, {status:429}),async()=>{throw Error('timeout')},async()=>Response.json({choices:[{message:{content:'I searched'}}]})])await assert.rejects(searchWeb({question:'news',env,run:async()=>1,fetcher}));
});
