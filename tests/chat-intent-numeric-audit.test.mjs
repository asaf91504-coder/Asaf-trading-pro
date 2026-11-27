import test from 'node:test';
import assert from 'node:assert/strict';
import {stockDiscoveryIntent,questionAsset} from '../chat-asset-intent.mjs';
test('complete grouped amounts preserve the requested screening threshold',()=>{
 for(const [amount,expected] of [['1,000,000,000',1e9],['10,000,000,000',1e10],['1 000 000 000',1e9],['1\u202f000\u202f000',1e6],['1.5 billion',1.5e9],['2.75 מיליון',2.75e6],['1 trillion',1e12]]){
  const q='give me 3 stocks with market cap above '+amount;assert.equal(stockDiscoveryIntent(q).filters?.minMarketCap,expected,q);
 }
 for(const [amount,expected] of [['1,000',1000],['1,000.50',1000.5],['20.25',20.25],['1 000.50',1000.5]])assert.equal(stockDiscoveryIntent('תן לי 3 מניות עם מחיר מעל $'+amount).filters?.minPrice,expected);
});
test('malformed and unsupported localized amounts cannot silently become tiny prefix thresholds',()=>{
 for(const amount of ['1,00,000','1,5','1.000,50','1e3','1..25','-100','100xyz','1,000,000,000junk']){
  for(const field of ['price','market cap']){const intent=stockDiscoveryIntent('find 3 stocks with '+field+' above '+amount);assert.equal(intent.unsupportedCriteria,true,field+': '+amount);assert.equal(intent.filters?.[field==='price'?'minPrice':'minMarketCap'],undefined);}
 }
});
test('known lowercase follow-ups select the requested asset, unknown names stay unresolved',()=>{
 assert.equal(questionAsset('ומה עם iren?'),'NASDAQ:IREN');assert.equal(questionAsset('מה קורה עם crwv?'),'NASDAQ:CRWV');assert.equal(questionAsset('ומה עם nonexistentcompany?'),null);
});
test('explicit exclusions become controlled symbols rather than silently ignored prose',()=>{
 assert.deepEqual(stockDiscoveryIntent('give me two stocks excluding AAPL').excludeSymbols,['AAPL']);
 assert.deepEqual(stockDiscoveryIntent('find 3 stocks except AAPL and TSLA with market cap above 10 billion').excludeSymbols,['AAPL','TSLA']);
 assert.deepEqual(stockDiscoveryIntent('תן לי שלוש מניות למעט טסלה ואפל').excludeSymbols,['TSLA','AAPL']);
 assert.equal(stockDiscoveryIntent('give me stocks excluding nonexistentcompany').unsupportedCriteria,true);
 assert.equal(stockDiscoveryIntent('תן לי שלוש מניות לשורט בלי לונג').excludeSymbols,undefined);
});


test('unsupported currency/scale units and compound direction plus exclusions cannot be silently ignored',()=>{
 for(const q of ['give me stocks with market cap above 1000 crore','give me stocks with price above 100 EUR'])assert.equal(stockDiscoveryIntent(q).unsupportedCriteria,true);
 assert.deepEqual(stockDiscoveryIntent('תן לי שלוש מניות בלי שורט למעט AAPL').excludeSymbols,['AAPL']);
 assert.deepEqual(stockDiscoveryIntent('give me stocks without short except TSLA').excludeSymbols,['TSLA']);
});
