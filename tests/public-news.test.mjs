import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePublicRSS,mergePublicArticles,publicNewsEnabled,PUBLIC_NEWS_FEEDS} from '../server/public-news.mjs';
import {refreshPublicNews,readPublicNews,isMarketHeadline} from '../server/public-news-service.mjs';
const now=Date.parse('2026-10-26T10:00:00Z'),feed=PUBLIC_NEWS_FEEDS[0],env={CONTEXT:'production',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'mock'};
const rss=(title='Apple reports earnings',url='https://news.example/report',source='News')=>`<rss><channel><item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>Mon, 26 Oct 2026 09:00:00 GMT</pubDate><source url="https://news.example">${source}</source><description>Full text must not be copied</description></item></channel></rss>`;
function state(){const db=new Map();return {db,run:async args=>{if(args[0]==='GET')return db.get(args[1])||null;if(args.includes('NX')&&db.has(args[1]))return null;db.set(args[1],args[2]);return 'OK'}}}
test('RSS parser returns only attribution, timestamp, safe link and named ticker hints',()=>{const [a]=parsePublicRSS(rss(),feed,now);assert.equal(a.title,'Apple reports earnings');assert.deepEqual(a.symbols,['AAPL']);assert.equal(a.description,undefined);assert.equal(a.source,'News')});
test('RSS rejects DTD/entity declarations and unbounded feeds',()=>{assert.throws(()=>parsePublicRSS('<!DOCTYPE rss>'+rss(),feed,now));assert.throws(()=>parsePublicRSS('x'.repeat(1000001),feed,now))});
test('unsafe URLs and future or expired stories never appear',()=>{assert.equal(parsePublicRSS(rss('x','javascript:alert(1)'),feed,now).length,0);assert.equal(parsePublicRSS(rss().replace('26 Oct','27 Oct'),feed,now).length,0);assert.equal(parsePublicRSS(rss().replace('26 Oct','01 Oct'),feed,now).length,0)});
test('XML entities become plain text without executing markup',()=>{const a=parsePublicRSS(rss('Stocks &amp; bonds &lt;tag&gt;'),feed,now)[0];assert.equal(a.title,'Stocks & bonds <tag>')});
test('X query does not mislabel ordinary articles as social posts',()=>{assert.equal(parsePublicRSS(rss(),{id:"x-index"},now).length,0);assert.equal(parsePublicRSS(rss().replace('url="https://news.example"','url="https://x.com"'),{id:'x-index'},now)[0].source,'X · מאונדקס ולא מאומת')});
test('duplicate titles and links are merged and bounded to fifty',()=>{const a=parsePublicRSS(rss(),feed,now)[0];assert.equal(mergePublicArticles([[a],[{...a,url:'https://other.example'}]]).length,1);assert.equal(mergePublicArticles([Array.from({length:80},(_,i)=>({...a,title:'story '+i,url:'https://news.example/'+i}))]).length,50)});
test('no external calls before approved storage or in preview deployments',async()=>{let calls=0;const options={now,run:async()=>{calls++},fetcher:async()=>{calls++}};assert.equal((await refreshPublicNews({...options,env:{}})).status,'disabled');assert.equal((await refreshPublicNews({...options,env:{...env,CONTEXT:'deploy-preview'}})).status,'disabled');assert.equal(calls,0);assert.equal(publicNewsEnabled({...env,ASAF_PUBLIC_NEWS_ENABLED:'false'}),false)});
test('one refresh per quarter-hour across callers with explicit per-source states',async()=>{const s=state();let calls=0;const fetcher=async()=>{calls++;return new Response(rss(),{headers:{'content-type':'application/rss+xml'}})};assert.equal((await refreshPublicNews({env,now,run:s.run,fetcher})).status,'updated');assert.equal((await refreshPublicNews({env,now,run:s.run,fetcher})).status,'cached');assert.equal(calls,3);const snapshot=await readPublicNews({env,now,run:s.run});assert.equal(snapshot.articles.length,1);assert.equal(snapshot.sources[2].status,'ok');assert.equal(snapshot.stale,false)});
test('all failed sources preserve old articles and original refresh timestamp',async()=>{const s=state();await refreshPublicNews({env,now,run:s.run,fetcher:async()=>new Response(rss())});const before=await readPublicNews({env,now,run:s.run});const result=await refreshPublicNews({env,now:now+900000,run:s.run,fetcher:async()=>new Response('down',{status:503})});assert.equal(result.status,'unavailable');assert.equal((await readPublicNews({env,now:now+900000,run:s.run})).updatedAt,before.updatedAt)});
test('a broken source does not discard successful public feeds',async()=>{const s=state();const result=await refreshPublicNews({env,now,run:s.run,fetcher:async url=>url.includes('federalreserve')?new Response('down',{status:503}):new Response(rss())});assert.equal(result.status,'updated');assert.equal((await readPublicNews({env,now,run:s.run})).sources[1].status,'unavailable')});

test('market feed drops unrelated entertainment and general politics while retaining financial headlines',()=>{
 assert.equal(isMarketHeadline({id:'major-news:1',title:'Review: Johnny Depp plays Scrooge'}),false);
 assert.equal(isMarketHeadline({id:'major-news:2',title:'Kim Jong Un redesigns national flag'}),false);
 assert.equal(isMarketHeadline({id:'markets:3',title:'Nvidia shares climb after earnings'}),true);
 assert.equal(isMarketHeadline({id:'economy:4',title:'Federal Reserve Board announces a decision'}),true);
});

test('new quarter replaces a prior snapshot with newly published headlines and a new time',async()=>{
 const s=state();
 const refresh=(at,title)=>refreshPublicNews({env,now:at,run:s.run,fetcher:async()=>new Response(rss(title))});
 await refresh(now,'Apple reports earnings');const first=await readPublicNews({env,now,run:s.run});
 await refresh(now+900000,'Apple announces higher dividend');const second=await readPublicNews({env,now:now+900000,run:s.run});
 assert.equal(Date.parse(second.updatedAt)-Date.parse(first.updatedAt),900000);assert.deepEqual(second.articles.map(a=>a.title),['Apple announces higher dividend']);
});

test('simultaneous callers reserve one quarter-hour source refresh',async()=>{
 const s=state();let hits=0;const options={env,now,run:s.run,fetcher:async()=>{hits++;return new Response(rss())}};
 const results=await Promise.all(Array.from({length:8},()=>refreshPublicNews(options)));
 assert.equal(hits,PUBLIC_NEWS_FEEDS.length);assert.equal(results.filter(x=>x.status==='updated').length,1);assert.equal(results.filter(x=>x.status==='cached').length,7);
});

test('repeated failures eventually make old headlines stale without destroying them',async()=>{
 const s=state();await refreshPublicNews({env,now,run:s.run,fetcher:async()=>new Response(rss())});
 const failure=async()=>new Response('',{status:503});
 await refreshPublicNews({env,now:now+15*60000,run:s.run,fetcher:failure});
 await refreshPublicNews({env,now:now+30*60000,run:s.run,fetcher:failure});
 const snapshot=await readPublicNews({env,now:now+30*60000+1,run:s.run});
 assert.equal(snapshot.stale,true);assert.equal(snapshot.articles.length,1);assert.equal(snapshot.updatedAt,new Date(now).toISOString());
});

test('recovering source after a failed quarter replaces stale content and resets freshness',async()=>{
 const s=state();const refresh=(at,fetcher)=>refreshPublicNews({env,now:at,run:s.run,fetcher});
 await refresh(now,async()=>new Response(rss()));
 await refresh(now+15*60000,async()=>new Response('',{status:503}));
 const at=now+45*60000;await refresh(at,async()=>new Response(rss('New Apple market update')));
 const snapshot=await readPublicNews({env,now:at,run:s.run});assert.equal(snapshot.stale,false);assert.equal(snapshot.updatedAt,new Date(at).toISOString());assert.equal(snapshot.articles[0].title,'New Apple market update');
});

test('a recent scheduler execution marker does not make an old snapshot fresh',async()=>{
 const s=state();await refreshPublicNews({env,now,run:s.run,fetcher:async()=>new Response(rss())});
 const at=now+45*60000;await s.run(['SET','asaf:production:news:public:scheduled',JSON.stringify({at:new Date(at).toISOString(),status:'unavailable'})]);
 const snapshot=await readPublicNews({env,now:at,run:s.run});assert.equal(snapshot.lastScheduledAt,new Date(at).toISOString());assert.equal(snapshot.updatedAt,new Date(now).toISOString());assert.equal(snapshot.stale,true);
});
