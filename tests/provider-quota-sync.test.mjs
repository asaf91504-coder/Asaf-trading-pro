import test from 'node:test';
import assert from 'node:assert/strict';
import {providerQuotaKey,readProviderQuota,syncProviderQuota,verifiedQuota} from '../server/provider-quota.mjs';
import {reserveMarketCredits} from '../server/market-feed.mjs';
import {fixture} from './identity-fixture.mjs';
const now=Date.parse('2026-11-27T10:00:00Z');
const env={CONTEXT:'production',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_HOURLY_SCANNER_ENABLED:'true',ASAF_SCANNER_UNIVERSE:'us10000',TWELVE_DATA_API_KEY:'fixture-secret',ASAF_MARKET_REQUESTS_PER_MINUTE:'610',ASAF_MARKET_REQUESTS_PER_DAY:'100000'};
function setup(){
 const f=fixture(),commands=[];
 const run=async args=>{
  commands.push(args);
  if(args[1]?.includes('-- provider-quota-probe')){
   const [minute,day,probe,limit]=args.slice(3);
   if(f.db.has(probe)||Number(f.db.get(minute)||0)>=Number(limit))return 0;
   f.db.set(probe,'1');f.db.set(minute,String(Number(f.db.get(minute)||0)+1));f.db.set(day,String(Number(f.db.get(day)||0)+1));return 1;
  }
  return f.run(args);
 };
 return {...f,run,commands};
}
test('verified paid plan recovers the internal daily stop while preserving global minute accounting',async()=>{
 const f=setup();f.db.set('asaf:production:market:provider-day:2026-11-27','100000');let calls=0;
 const synced=await syncProviderQuota({env,run:f.run,now,fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.twelvedata.com/api_usage');assert.equal(options.headers.Authorization,'apikey fixture-secret');
  return Response.json({plan_category:'venture',plan_limit:610,current_usage:0});
 }});
 assert.equal(synced.status,'verified');assert.equal(synced.dailyCredits,878400);assert.equal(calls,1);
 assert.equal(f.db.get('asaf:production:market:provider-day:2026-11-27'),'100001');
 await reserveMarketCredits({env,run:f.run,now,cost:50});
 assert.equal(f.db.get('asaf:production:market:provider-day:2026-11-27'),'100051');
 assert.equal((await syncProviderQuota({env,run:f.run,now,fetcher:()=>assert.fail('cached lease')})).status,'current');
 assert.doesNotMatch(f.db.get(providerQuotaKey(env)),/fixture-secret|Authorization|current_usage/);
});
test('verification cannot raise minute limits, ignore explicit daily caps, or infer paid access from absent fields',()=>{
 assert.equal(verifiedQuota({plan_category:'pro',plan_limit:1000},env,now).minuteCredits,610);
 assert.equal(verifiedQuota({plan_category:'basic',plan_limit:8,plan_daily_limit:800},env,now).dailyCredits,800);
 assert.equal(verifiedQuota({plan_category:'pro',plan_limit:610,plan_daily_limit:50000},env,now).dailyCredits,50000);
 for(const data of [{plan_limit:610},{plan_category:'unknown',plan_limit:610},{plan_category:'basic',plan_limit:8},{plan_category:'pro',plan_limit:610,daily_usage:0},{plan_category:'pro',plan_limit:610,plan_daily_limit:null},{plan_category:'pro',plan_limit:0}])assert.equal(verifiedQuota(data,env,now),null);
});
test('failed introspection remains hourly bounded and never unlocks credits',async()=>{
 for(const response of [()=>Response.json({plan_limit:610}),()=>new Response('',{status:403}),()=>{throw Error('timeout')}]){
  const f=setup();let calls=0;
  await syncProviderQuota({env,run:f.run,now,fetcher:()=>{calls++;return response()}});
  assert.equal((await readProviderQuota({env,run:f.run,now})).dailyCredits,100000);
  assert.equal((await syncProviderQuota({env,run:f.run,now,fetcher:()=>assert.fail('probe retried too early')})).status,'waiting');assert.equal(calls,1);
 }
});
test('expiry, changed API credentials, preview and disabled service preserve the original boundaries',async()=>{
 const f=setup();f.db.set(providerQuotaKey(env),JSON.stringify({minuteCredits:610,dailyCredits:878400,paidUnlimited:true,verifiedAt:now}));
 assert.equal((await readProviderQuota({env,run:f.run,now:now+12*3600000})).dailyCredits,100000);
 assert.equal((await readProviderQuota({env:{...env,TWELVE_DATA_API_KEY:'rotated'},run:f.run,now})).dailyCredits,100000);
 for(const patch of [{CONTEXT:'deploy-preview'},{ASAF_EXTERNAL_SERVICES_APPROVED:'false'},{ASAF_HOURLY_SCANNER_ENABLED:'false'},{ASAF_SCANNER_UNIVERSE:'invalid'}])assert.equal((await syncProviderQuota({env:{...env,...patch},run:()=>assert.fail('no store call'),fetcher:()=>assert.fail('no provider call'),now})).status,'disabled');
});
test('a valid quota lease still rejects exhausted minute credits',async()=>{
 const f=setup();f.db.set(providerQuotaKey(env),JSON.stringify({minuteCredits:610,dailyCredits:878400,paidUnlimited:true,verifiedAt:now}));
 f.db.set('asaf:production:market:provider-minute:'+Math.floor(now/60000),'610');
 await assert.rejects(reserveMarketCredits({env,run:f.run,now,cost:1}),e=>e.status===429);
});
