import test from 'node:test';
import assert from 'node:assert/strict';
import {indexStocks} from '../index-stock-catalogue.mjs';
import {publicHeadlineSymbols,parsePublicRSS} from '../server/public-news.mjs';
import {readPublicNews,isMarketHeadline} from '../server/public-news-service.mjs';
import {filterCachedNews} from '../news-search.mjs';
const now=Date.parse('2026-11-27T10:00:00Z');

test('every catalogue ticker can be tagged explicitly, with no unknown tickers',()=>{
 for(const {symbol}of indexStocks)assert.ok(publicHeadlineSymbols('$'+symbol).includes(symbol),symbol);
 assert.deepEqual(publicHeadlineSymbols('$ZZZZUNKNOWN AMDish XAMD AMD_thing'),[]);
 assert.deepEqual(publicHeadlineSymbols('AMD and PLTR jump'),['AMD','PLTR']);
 assert.equal(isMarketHeadline({id:'markets:amd',title:'AMD jumps'}),true);
 assert.equal(isMarketHeadline({id:'markets:ordinary',title:'A report ON IT spending'}),false);
 assert.deepEqual(publicHeadlineSymbols('$BRK.B gains'),['BRK.B']);
});

test('ambiguous ordinary words require explicit stock context',()=>{
 assert.deepEqual(publicHeadlineSymbols('A report ON IT spending is GOOD for ALL'),[]);
 assert.deepEqual(publicHeadlineSymbols('On it: a report on home care and cold weather'),[]);
 for(const symbol of ['A','ON','IT','ALL','GOOD']){
  assert.ok(publicHeadlineSymbols('$'+symbol+' gains').includes(symbol));
  assert.ok(publicHeadlineSymbols('NYSE: '+symbol+' gains').includes(symbol));
  assert.ok(publicHeadlineSymbols(symbol+' shares rise').includes(symbol));
 }
 assert.deepEqual(publicHeadlineSymbols('AMDhood and antiAMD articles'),[]);
});

test('company aliases beyond the seven original tickers preserve token boundaries',()=>{
 assert.ok(publicHeadlineSymbols('Advanced Micro Devices reports earnings').includes('AMD'));
 assert.ok(publicHeadlineSymbols('Palantir Technologies beats forecasts').includes('PLTR'));
 assert.ok(publicHeadlineSymbols('ON Semiconductor raises guidance').includes('ON'));
 assert.ok(publicHeadlineSymbols('ACM Research announces results').includes('ACMR'));
 assert.deepEqual(publicHeadlineSymbols('Appleton Microsoftish Nvidiaish'),[]);
 assert.deepEqual(publicHeadlineSymbols('Apple reports earnings'),['AAPL']);
});

test('RSS tags AMD so selected-stock filtering finds its headline',()=>{
 const xml='<rss><channel><item><title>AMD shares rise after earnings</title><link>https://example.test/amd</link><pubDate>'+new Date(now).toUTCString()+'</pubDate></item></channel></rss>';
 const articles=parsePublicRSS(xml,{id:'markets',name:'Example'},now);
 assert.equal(filterCachedNews(articles,{symbol:'AMD'}).length,1);
 assert.deepEqual(articles[0].symbols,['AMD']);
});

test('already cached public titles are retagged immediately without writes or provider calls',async()=>{
 const article={id:'markets:amd',title:'AMD shares rise after earnings',url:'https://example.test/amd',source:'Example',publishedAt:new Date(now-60000).toISOString(),symbols:[]};
 const stored=JSON.stringify({articles:[article],updatedAt:new Date(now).toISOString()});
 const calls=[];
 const result=await readPublicNews({env:{CONTEXT:'production'},now,run:async args=>{calls.push(args);return args[1].endsWith('news:public:us:snapshot')?stored:null}});
 assert.deepEqual(result.articles[0].symbols,['AMD']);
 assert.equal(filterCachedNews(result.articles,{symbol:'AMD'}).length,1);
 assert.equal(result.articles[0].title,article.title);
 assert.equal(result.articles[0].publishedAt,article.publishedAt);
 assert.equal(result.updatedAt,new Date(now).toISOString());
 assert.deepEqual(article.symbols,[]);
 assert.ok(calls.every(args=>args[0]==='GET'));
 assert.equal(calls.length,2);
});
