import test from 'node:test';import assert from 'node:assert/strict';
import {searchAssets,manualSymbol,resolveAssetQuery} from '../asset-search.mjs';
test('submit resolves company names and Hebrew names to their listed symbols',()=>{assert.equal(resolveAssetQuery('אפל'),'NASDAQ:AAPL');assert.equal(resolveAssetQuery(' Apple '),'NASDAQ:AAPL');assert.equal(resolveAssetQuery('ביטקוין','crypto'),'BTCUSD');assert.equal(resolveAssetQuery('aapl'),'NASDAQ:AAPL')});
test('submit avoids ambiguous matches and respects selected asset type',()=>{assert.equal(resolveAssetQuery('holdings'),null);assert.equal(resolveAssetQuery('a'),'A');assert.equal(resolveAssetQuery('BTCUSD','stock'),null);assert.equal(resolveAssetQuery('אפל','crypto'),null);assert.equal(resolveAssetQuery(''),null);assert.equal(resolveAssetQuery('NYSE:XYZ'),'NYSE:XYZ')});
test('search supports company names, Hebrew names and ticker fragments',()=>{assert.equal(searchAssets('אפל')[0].symbol,'NASDAQ:AAPL');assert.equal(searchAssets('btc')[0].symbol,'BTCUSD');assert.equal(searchAssets('Ethereum')[0].symbol,'ETHUSD')});
test('asset filters do not mix crypto and equities',()=>{assert.equal(searchAssets('BTC','stock').length,0);assert.ok(searchAssets('','crypto').every(a=>a.type==='crypto'))});
test('unknown symbols may be requested without claiming provider coverage',()=>{assert.equal(manualSymbol(' nyse:xyz '),'NYSE:XYZ');assert.equal(manualSymbol('<script>'),null);assert.equal(manualSymbol('ביטקוין'),null);assert.deepEqual(searchAssets('not-a-company'),[])});

test('exact company aliases outrank unrelated names containing that substring',()=>{
 assert.deepEqual(searchAssets('Apple').map(a=>a.symbol),['NASDAQ:AAPL','APLE','MLP']);
 assert.equal(searchAssets(' apple ')[0].symbol,'NASDAQ:AAPL');
 assert.equal(searchAssets('NVIDIA')[0].symbol,'NASDAQ:NVDA');
 assert.equal(searchAssets('Google')[0].symbol,'NASDAQ:GOOGL');
 assert.equal(searchAssets('אפל')[0].symbol,'NASDAQ:AAPL');
});
test('company word prefixes precede matches in the middle of another word',()=>{
 const result=searchAssets('appl').map(a=>a.symbol);
 assert.ok(result.indexOf('NASDAQ:AAPL')<result.indexOf('MLP'));
 assert.ok(result.indexOf('APLE')<result.indexOf('MLP'));
});
test('exact tickers remain first and ordering is applied before pagination',()=>{
 assert.equal(searchAssets('META')[0].symbol,'NASDAQ:META');
 assert.equal(searchAssets('A')[0].symbol,'A');
 assert.equal(searchAssets('NASDAQ:AAPL')[0].symbol,'NASDAQ:AAPL');
 assert.deepEqual(searchAssets('Apple','all',null,{offset:1,limit:1}).map(a=>a.symbol),['APLE']);
});
test('name ranking does not bypass provider availability, type or group filtering',()=>{
 assert.deepEqual(searchAssets('Apple','stock',['APLE','MLP']).map(a=>a.symbol),['APLE','MLP']);
 assert.deepEqual(searchAssets('Apple','stock',['AAPL']).map(a=>a.symbol),['NASDAQ:AAPL']);
 assert.deepEqual(searchAssets('Apple','crypto'),[]);
 assert.deepEqual(searchAssets('Apple','stock',null,{group:'sp500'}).map(a=>a.symbol),['NASDAQ:AAPL']);
});
