import test from 'node:test';
import assert from 'node:assert/strict';
import {isMarketHeadline,readPublicNews} from '../server/public-news-service.mjs';

test('quote and publisher landing templates are excluded before ticker tagging',()=>{
 for(const title of [
  'SK hynix Stock Price, News, Quote & History - Yahoo Finance',
  'NVIDIA Corporation (NVDA) Stock Price, News, Quote & History',
  'Apple Inc. (AAPL) Stock Price News Quote & History - Yahoo Finance',
  'Yahoo Finance - Stock Market Live Quotes, Business & Finance News',
  'Yahoo Finance - Stock Market Live, Quotes, Business & Finance News - Yahoo Finance',
 ])for(const id of ['markets:page','major-news:page','economy:page'])assert.equal(isMarketHeadline({id,title}),false,title);
});

test('actual stock-price and historical-quote reporting remains eligible',()=>{
 for(const title of [
  'Nvidia stock price hits record after earnings',
  'Apple stock price history: what investors should know',
  'Yahoo Finance reports Nvidia shares rose after earnings',
  'AMD jumps',
 ])assert.equal(isMarketHeadline({id:'markets:story',title}),true,title);
});

test('existing cached landing pages disappear without changing snapshot freshness',async()=>{
 const now=Date.parse('2026-11-27T02:30:00Z');
 const titles=['NVIDIA Corporation (NVDA) Stock Price, News, Quote & History - Yahoo Finance','Nvidia shares rise after earnings'];
 const value={updatedAt:new Date(now).toISOString(),articles:titles.map((title,i)=>({id:'markets:'+i,title,url:'https://example.test/'+i,source:'Example',publishedAt:new Date(now-60000).toISOString(),symbols:['NVDA']}))};
 const calls=[];
 const result=await readPublicNews({env:{CONTEXT:'production'},now,run:async args=>{calls.push(args);return args[1].endsWith('news:public:us:snapshot')?JSON.stringify(value):null}});
 assert.deepEqual(result.articles.map(a=>a.title),[titles[1]]);
 assert.equal(result.updatedAt,value.updatedAt);
 assert.equal(value.articles.length,2);
 assert.ok(calls.every(args=>args[0]==='GET'));
});
