import test from 'node:test';import assert from 'node:assert/strict';
import {searchAssets,manualSymbol} from '../asset-search.mjs';
test('search supports company names, Hebrew names and ticker fragments',()=>{assert.equal(searchAssets('אפל')[0].symbol,'NASDAQ:AAPL');assert.equal(searchAssets('btc')[0].symbol,'BTCUSD');assert.equal(searchAssets('Ethereum')[0].symbol,'ETHUSD')});
test('asset filters do not mix crypto and equities',()=>{assert.equal(searchAssets('BTC','stock').length,0);assert.ok(searchAssets('','crypto').every(a=>a.type==='crypto'))});
test('unknown symbols may be requested without claiming provider coverage',()=>{assert.equal(manualSymbol(' nyse:xyz '),'NYSE:XYZ');assert.equal(manualSymbol('<script>'),null);assert.equal(manualSymbol('ביטקוין'),null);assert.deepEqual(searchAssets('not-a-company'),[])});
