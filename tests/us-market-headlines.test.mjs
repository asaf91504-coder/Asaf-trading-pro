import test from 'node:test';
import assert from 'node:assert/strict';
import {readUSMarketHeadlines} from '../server/us-market-headlines.mjs';

const now=Date.parse('2026-11-23T16:00:00.000Z');
const minsAgo=m=>new Date(now-m*60_000).toISOString();
const env={ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'fixture'};
const row=(prefix,key,title,mins=30)=>({id:prefix+':'+key,url:'https://example.test/'+key,title,publishedAt:minsAgo(mins),source:'Fixture News',symbols:['AAPL']});
const source=({articles=[],at=minsAgo(3),calls=[]}={})=>async command=>{
 calls.push(command);
 if(command[1].endsWith(':scheduled'))return null;
 return JSON.stringify({articles,updatedAt:at});
};
test('review uses only recent broad US headlines and at most one Fed catalyst, not stock-only, future or lagged results',async()=>{
 const calls=[];
 const articles=[
  row('markets','aapl','Apple announces new iPhone'),
  row('markets','nasdaq-listed','New Nasdaq listing details'),
  row('major-news','futures','Nasdaq-100 futures decline ahead of data'),
  row('markets','dup','NASDAQ-100 futures decline ahead of data',31),
  row('economy','fed','Federal Reserve issues monetary policy statement',33),
  row('economy','fed2','Federal Reserve announces interest rates',35),
  row('markets','old','Wall Street rises',1441),
  row('markets','future','Dow Jones rises',-1),
 ];
 const out=await readUSMarketHeadlines({now,env,run:source({articles,calls})});
 assert.equal(out.status,'available');
 assert.equal(out.updatedAt,minsAgo(3));
 assert.deepEqual(out.articles.map(x=>x.url),['https://example.test/futures','https://example.test/fed']);
 assert.deepEqual(Object.keys(out.articles[0]).sort(),['publishedAt','source','title','url']);
 assert.ok(calls.every(([op])=>op==='GET'));
});
test('a stale or future snapshot, no matching market articles, or outage cannot generate a current brief',async()=>{
 const articles=[row('markets','a','Wall Street rises')];
 for(const run of [source({articles,at:minsAgo(31)}),source({articles,at:minsAgo(-.5)}),source({articles:[row('economy','fed','Federal Reserve releases statement')]}),async()=>{throw Error('offline')}])
  assert.deepEqual(await readUSMarketHeadlines({now,env,run}),{status:'unavailable',articles:[],updatedAt:null});
});
test('does not read unapproved or disabled sources',async()=>{
 let calls=0;
 for(const e of [{...env,ASAF_PUBLIC_NEWS_ENABLED:'false'},{...env,ASAF_EXTERNAL_SERVICES_APPROVED:'false'},{}])
  assert.equal((await readUSMarketHeadlines({now,env:e,run:async()=>{calls++}})).status,'unavailable');
 assert.equal(calls,0);
});
