import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketFeedClient} from '../market-feed-client.mjs';

test('signing in activates the private provider without reloading the page',async()=>{
 let signedIn=false,calls=0;const updates=[];
 const client=createMarketFeedClient({onChange:c=>updates.push(c),fetcher:async path=>{calls++;return Response.json({enabled:path.endsWith('/public-market')?signedIn:true})}});
 await client.refresh('anonymous');assert.equal((await client.get()).publicMarket.enabled,false);
 signedIn=true;await client.refresh('owner');assert.equal((await client.get()).publicMarket.enabled,true);
 await client.refresh('owner');assert.equal(calls,4,'unchanged auth checks reuse the current request');
 signedIn=false;await client.refresh('anonymous');assert.equal((await client.get()).publicMarket.enabled,false);assert.equal(updates.length,3);
});
test('an earlier anonymous response cannot replace the owner configuration',async()=>{
 const deferred=[],updates=[];
 const client=createMarketFeedClient({onChange:c=>updates.push(c),fetcher:()=>new Promise(resolve=>deferred.push(resolve))});
 const anonymous=client.refresh('anonymous'),waiting=client.get();
 const owner=client.refresh('owner');
 deferred[2](Response.json({enabled:true}));deferred[3](Response.json({enabled:true,privateTrial:true}));await owner;
 deferred[0](Response.json({enabled:true}));deferred[1](Response.json({enabled:false}));await anonymous;
 assert.equal((await waiting).publicMarket.privateTrial,true);assert.equal(updates.length,1);assert.equal(updates[0].publicMarket.enabled,true);
});
test('provider configuration errors disable availability without exposing error content',async()=>{
 const client=createMarketFeedClient({fetcher:async()=>{throw Error('sensitive transport error')}});
 await client.refresh('owner');assert.deepEqual(await client.get(),{intrinio:{enabled:false},publicMarket:{enabled:false}});
});
