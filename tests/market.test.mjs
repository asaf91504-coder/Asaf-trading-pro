import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/market.mjs";

const access="local_test_access_code_long_1234";
const sample=()=>({
 status:"ok",meta:{exchange:"NASDAQ",currency:"USD",exchange_timezone:"America/New_York"},
 values:Array.from({length:200},(_,i)=>({
   datetime:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),
   open:String(100+i),high:String(102+i),low:String(99+i),
   close:String(101+i),volume:"1000"
 }))
});
const request=(symbol="AAPL",interval="1day",password=access)=>new Request("https://example.netlify.app/.netlify/functions/market",{
 method:"POST",
 headers:{"Content-Type":"application/json","x-asaf-market-access":password},
 body:JSON.stringify({symbol,interval})
});
const envKeys=["ASAF_PUBLIC_AUTH_ENABLED","ASAF_MARKET_ENABLED","ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED","ASAF_MARKET_ACCESS_CODE","TWELVE_DATA_API_KEY","ASAF_MARKET_ALLOWED_SYMBOLS"];
async function harness(values,run){
 const oldEnv=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;
 let called=0;
 try{
  for(const key of envKeys)delete process.env[key];
  Object.assign(process.env,values);
  globalThis.fetch=async()=>{called++;return {ok:true,json:async()=>sample()}};
  await run(()=>called);
 }finally{
  globalThis.fetch=originalFetch;
  for(const key of envKeys){
   if(oldEnv[key]===undefined)delete process.env[key];
   else process.env[key]=oldEnv[key];
  }
 }
}
const enabled={
 ASAF_MARKET_ENABLED:"true",
 ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:"true",
 ASAF_MARKET_ACCESS_CODE:access,
 TWELVE_DATA_API_KEY:"test_placeholder_not_real",
 ASAF_MARKET_ALLOWED_SYMBOLS:"AAPL,NVDA"
};
test("market connection fails closed by default",async()=>{
 await harness({},async called=>{
  const r=await handler(request());
  assert.equal(r.status,503);assert.equal(called(),0);
 });
});
test("license confirmation required before fetching",async()=>{
 await harness({ASAF_MARKET_ENABLED:"true"},async called=>{
  const r=await handler(request());
  assert.equal(r.status,503);assert.equal(called(),0);
 });
});
test("wrong access code cannot use provider",async()=>{
 await harness(enabled,async called=>{
  const r=await handler(request("AAPL","1day","wrong"));
  assert.equal(r.status,401);assert.equal(called(),0);
 });
});
test("ticker allowlist blocks quota abuse",async()=>{
 await harness(enabled,async called=>{
  const r=await handler(request("TSLA"));
  assert.equal(r.status,403);assert.equal(called(),0);
 });
});
test("bad interval rejected",async()=>{
 await harness(enabled,async called=>{
  const r=await handler(request("AAPL","7seconds"));
  assert.equal(r.status,400);assert.equal(called(),0);
 });
});
test("provider response normalizes bars and hides secrets",async()=>{
 await harness(enabled,async called=>{
  const r=await handler(request("NVDA"));
  assert.equal(r.status,200);
  const payload=await r.json();
  assert.equal(payload.bars.length,200);
  assert.equal(payload.latestBarTime,payload.bars.at(-1).date);
  assert.equal(payload.source,"Twelve Data");
  assert.equal(called(),1);
  assert.ok(!JSON.stringify(payload).includes("test_placeholder_not_real"));
 });
});
test("repeated request uses cache without another provider call",async()=>{
 await harness(enabled,async called=>{
  const first=await handler(request("AAPL","15min"));
  const second=await handler(request("AAPL","15min"));
  assert.equal(first.status,200);
  assert.equal(second.status,200);
  assert.equal((await second.json()).cached,true);
  assert.equal(called(),1);
 });
});

test("legacy owner connector cannot bypass member-mode quotas even with its old passcode",async()=>{
 await harness({...enabled,ASAF_PUBLIC_AUTH_ENABLED:'true'},async called=>{const r=await handler(request());assert.equal(r.status,410);assert.equal(called(),0)});
});
