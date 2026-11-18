import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../health-ui.mjs',import.meta.url),'utf8');
const functionSource=source.slice(source.indexOf('function configuredMarketLabel'),source.indexOf('const status='));
const label=vm.runInNewContext(functionSource+';configuredMarketLabel');
test('health stock badge describes configuration, never asserts current provider or access',()=>{
 for(const flags of [
  {publicMarketDataEnabled:true},
  {marketDataEnabled:true},
  {intrinioResearchEnabled:true},
  {publicMarketDataEnabled:true,intrinioResearchEnabled:true},
  {publicMarketDataEnabled:false,intrinioResearchEnabled:true,cryptoResearchEnabled:true},
 ]){
  assert.equal(label(flags),'ספק נתונים מוגדר · טען גרף לאימות');
  assert.doesNotMatch(label(flags),/Intrinio|Twelve Data/);
 }
});
test('unconfigured and crypto-only states preserve existing scoped messages',()=>{
 assert.equal(label({}),'נתוני שוק: ממתינים למנוי ולחיבור');
 assert.equal(label({cryptoResearchEnabled:true}),'מניות: ממתינים לספק · בדיקת קריפטו למנהל בלבד');
});
test('both automatic badge and explicit health results use source-neutral configuration label',()=>{
 assert.match(source,/if\(market\)market.textContent=configuredMarketLabel\(data\)/);
 assert.match(source,/נתוני שוק: "\+configuredMarketLabel\(body\)/);
 assert.doesNotMatch(source,/intrinioResearchEnabled\?/);
});

test('configuration badge is translated in all nine additional languages',async()=>{
 const {launchTranslations}=await import('../launch-translations.mjs');
 for(const catalog of Object.values(launchTranslations)){
  const translated=catalog['ספק נתונים מוגדר · טען גרף לאימות'];
  assert.ok(translated);assert.doesNotMatch(translated,/[\u0590-\u05ff]|Intrinio|Twelve Data/u);
 }
});
