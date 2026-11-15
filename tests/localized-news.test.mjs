import test from 'node:test';
import assert from 'node:assert/strict';
import {localizedFeedUrl,readLocalizedNews,newsLocales} from '../server/localized-news.mjs';
test('each supported interface language has a fixed regional feed; no arbitrary upstream URLs',()=>{
 assert.equal(Object.keys(newsLocales).length,10);
 for(const lang of Object.keys(newsLocales)){const url=new URL(localizedFeedUrl(lang));assert.equal(url.hostname,'news.google.com');assert.ok(url.searchParams.get('hl'));}
 assert.throws(()=>localizedFeedUrl('https://evil.test'));
});
test('regional news preserves source links, marks native language, and reuses the shared cache',async()=>{
 const cache=new Map();let calls=0;const now=Date.now(),date=new Date(now).toUTCString();
 const run=async a=>{if(a[0]==='GET')return cache.get(a[1]);cache.set(a[1],a[2]);return 'OK'};
 const fetcher=async()=>{calls++;return new Response('<rss><channel><item><title>מניות וול סטריט עולות</title><link>https://example.test/article</link><pubDate>'+date+'</pubDate><source>מקור</source></item></channel></rss>')};
 const result=await readLocalizedNews('he',{run,fetcher,now});assert.equal(result.translation,'native');assert.equal(result.articles[0].titleLanguage,'he');assert.equal(result.articles[0].url,'https://example.test/article');
 await readLocalizedNews('he',{run,fetcher,now});assert.equal(calls,1);
});
