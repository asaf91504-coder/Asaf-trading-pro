import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDeployment,deploymentOrigin} from '../scripts/check-deployment.mjs';

function mock({leak=false,paid=false,outage=false}={}){
 const calls=[];return {calls,fetcher:async (url,init)=>{calls.push({url,init});if(outage)throw Error('private-secret-in-error');const path=new URL(url).pathname,headers={'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'SAMEORIGIN'};
  if(path.endsWith('/health'))return Response.json({application:'ASAF TRADING PRO',status:'ok',version:'test',publicAuthEnabled:true,durableQuotaEnabled:true,paidAIEnabled:paid,secret:'never report'}, {headers});
  const status=init.method==='PUT'?403:path==='/'||path==='/data-privacy.html'?200:path.endsWith('/free-chat')||path.endsWith('/run-market-jobs')?405:leak?200:401;
  return new Response('private body must never appear in report',{status,headers});
 }};
}
test('anonymous launch checks preserve disabled capabilities and never invoke providers or authenticated writes',async()=>{
 const m=mock(),report=await checkDeployment('https://example.test',{fetcher:m.fetcher});assert.equal(report.operational,true);assert.equal(report.checks.length,9);assert.equal(report.configuration.publicMarketDataEnabled,false);
 assert.equal(m.calls.filter(x=>x.init.method==='PUT').length,1);assert.equal(m.calls.find(x=>x.init.method==='PUT').init.headers.origin,'https://foreign-origin.invalid');assert.ok(m.calls.every(x=>!x.init.headers?.cookie&&!x.init.headers?.authorization));
 assert.ok(m.calls.every(x=>!x.url.includes('public-market')&&!x.url.includes('scan-market')));assert.doesNotMatch(JSON.stringify(report),/never report|private body/);
});
test('anonymous data exposure, unexpected paid AI and network outages fail visibly without response/error leaks',async()=>{
 for(const options of [{leak:true},{paid:true},{outage:true}]){const m=mock(options),report=await checkDeployment('https://example.test',{fetcher:m.fetcher});assert.equal(report.operational,false);assert.doesNotMatch(JSON.stringify(report),/private-secret|never report|private body/)}
});
test('deployment check rejects credentials, query strings and non-HTTPS destinations',()=>{
 for(const value of ['http://example.test','https://key:secret@example.test','https://example.test/?token=secret','https://example.test/path','https://example.test/#secret'])assert.throws(()=>deploymentOrigin(value));assert.equal(deploymentOrigin('https://example.test/'),'https://example.test');
});
