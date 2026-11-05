import test from 'node:test';
import assert from 'node:assert/strict';
import {dataFreshness,quoteSummary} from '../data-freshness.mjs';
const now=Date.parse('2026-11-06T00:00:00Z');
test('recent receipt never implies a live provider timestamp',()=>{
 assert.match(dataFreshness({receivedAt:new Date(now-1000).toISOString()},now),/אינו אישור למחיר חי/);
 assert.match(dataFreshness({receivedAt:new Date(now-120000).toISOString()},now),/2 דקות.*עותק שמור/);
});
test('missing, invalid and future receipts remain unknown',()=>{
 for(const receivedAt of [null,'invalid',new Date(now+1000).toISOString()])assert.match(dataFreshness({receivedAt},now),/אינו ידוע/);
});
test('aggregate quote is distinct from the candle and invalid values are omitted',()=>{
 assert.match(quoteSummary({source:'CoinLore',quote:{price:75610}}),/75,610.*אינו סגירת הנר.*זמן העסקה אינו ידוע/);
 for(const price of [null,NaN,-1,'75610'])assert.equal(quoteSummary({source:'CoinLore',quote:{price}}),'');
 assert.equal(quoteSummary({source:'CSV',quote:{price:75610}}),'');
});
