import test from 'node:test';
import assert from 'node:assert/strict';
import {priceTicks,chartTimeLabel} from '../chart-presentation.mjs';
test('price axis uses round ordered ticks across stock and crypto scales',()=>{
 for(const [low,high] of [[77_979,88_605],[.00012,.00019],[98,101],[-10,10]]){
  const ticks=priceTicks(low,high);assert.ok(ticks.length>=2&&ticks.length<=7);assert.ok(ticks.every((n,i)=>n>=low&&n<=high&&(!i||n>ticks[i-1])));
 }
 assert.deepEqual(priceTicks(100,100),[]);assert.deepEqual(priceTicks(NaN,200),[]);
});
test('intraday axis distinguishes times without inventing timezone conversions',()=>{
 assert.equal(chartTimeLabel('2026-11-01T14:35:00Z',true),'14:35');assert.equal(chartTimeLabel('2026-11-01',true),'11-01');assert.equal(chartTimeLabel('2026-11-01T14:35:00Z',false),'11-01');
});
