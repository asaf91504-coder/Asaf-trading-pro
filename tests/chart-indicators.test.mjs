import test from 'node:test';
import assert from 'node:assert/strict';
import {chartIndicators} from '../chart-indicators.mjs';
const bars=closes=>closes.map(close=>({close}));
test('Bollinger bands use a 20-close population deviation and preserve warmup',()=>{
 const values=chartIndicators(bars(Array.from({length:20},(_,i)=>i+1)));
 assert.equal(values.bbUpper[18],null);assert.equal(values.bbLower[18],null);
 assert.ok(Math.abs(values.bbUpper[19]-(10.5+2*Math.sqrt(33.25)))<1e-10);
 assert.ok(Math.abs(values.bbLower[19]-(10.5-2*Math.sqrt(33.25)))<1e-10);
 const flat=chartIndicators(bars(Array(25).fill(100)));assert.equal(flat.bbUpper[24],100);assert.equal(flat.bbLower[24],100);
});
test('MACD alignment, signal warmup and a final impulse follow independent EMA arithmetic',()=>{
 const input=Array.from({length:40},(_,i)=>100+i),values=chartIndicators(bars(input));
 assert.equal(values.macd[24],null);assert.equal(values.macd[25],7);assert.equal(values.macdSignal[32],null);assert.equal(values.macdSignal[33],7);assert.equal(values.macdHistogram[39],0);
 input[39]+=10;const changed=chartIndicators(bars(input)),delta=10*(2/13-2/27);
 assert.ok(Math.abs(changed.macd[39]-(7+delta))<1e-10);assert.ok(Math.abs(changed.macdSignal[39]-(7+delta*.2))<1e-10);assert.ok(Math.abs(changed.macdHistogram[39]-delta*.8)<1e-10);
 assert.deepEqual(changed.macd.slice(0,39),values.macd.slice(0,39));
});
test('Wilder ATR captures a gap and agrees with the existing scanner convention',async()=>{
 const input=Array.from({length:15},()=>({high:101,low:99,close:100}));input.push({high:131,low:129,close:130});
 const values=chartIndicators(input);assert.equal(values.atr14[13],null);assert.equal(values.atr14[14],2);assert.ok(Math.abs(values.atr14[15]-57/14)<1e-10);
 const {analyze}=await import('../analyzer.mjs');while(input.length<35)input.push({high:131,low:129,close:130});
 const actual=chartIndicators(input).atr14.at(-1);assert.equal(Math.round(actual*10000)/10000,analyze(input).atr14);
});
test('short histories never fabricate indicator readiness or mutate source bars',()=>{
 const input=bars([100,101,102]),before=JSON.stringify(input),values=chartIndicators(input);
 for(const key of ['macd','macdSignal','macdHistogram','atr14','bbUpper','bbLower'])assert.deepEqual(values[key],[null,null,null]);
 assert.equal(JSON.stringify(input),before);
});
test('averages align with candles and EMA uses an SMA seed',()=>{const values=chartIndicators(bars(Array.from({length:160},(_,i)=>i+1)));assert.equal(values.ma20[18],null);assert.equal(values.ma20[19],10.5);assert.equal(values.ma150[149],75.5);assert.equal(values.ema50[48],null);assert.equal(values.ema50[49],25.5);assert.equal(values.ema50[50],26.5);assert.equal(values.ma150[159],85.5)});
test('Wilder RSI matches the reference price sequence including smoothing',()=>{const values=chartIndicators(bars([44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46.00,46.03,46.41,46.22,45.64]));assert.equal(values.rsi14[13],null);assert.ok(Math.abs(values.rsi14[14]-70.464135)<.00001);assert.ok(Math.abs(values.rsi14[19]-57.915021)<.00001)});
test('RSI handles flat, one-way, empty and short histories without artificial early values',()=>{assert.equal(chartIndicators(bars(Array(20).fill(100))).rsi14[14],50);assert.equal(chartIndicators(bars(Array.from({length:20},(_,i)=>i))).rsi14[14],100);assert.equal(chartIndicators(bars(Array.from({length:20},(_,i)=>30-i))).rsi14[14],0);assert.deepEqual(chartIndicators([]).rsi14,[]);assert.deepEqual(chartIndicators(bars([1,2,3])).rsi14,[null,null,null])});
