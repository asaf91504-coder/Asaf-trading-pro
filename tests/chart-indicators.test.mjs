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

test('MA50, MA100 and MA200 need their full periods and share stable history seeds',()=>{
 const input=bars(Array.from({length:205},(_,i)=>i+1)),all=chartIndicators(input);
 for(const n of [50,100,200]){assert.equal(all['ma'+n][n-2],null);assert.equal(all['ma'+n][n-1],(n+1)/2);assert.equal(all['ma'+n][204],205-(n-1)/2)}
});
test('Slow Stochastic 14/3/3 smooths twice, with independent K and D warmup',()=>{
 const input=Array.from({length:18},(_,i)=>({high:110,low:90,close:i===14?105:i===16?95:i===17?110:100})),all=chartIndicators(input);
 assert.equal(all.stochasticK[14],null);assert.equal(all.stochasticD[16],null);
 assert.ok(Math.abs(all.stochasticK[15]-(50+75+50)/3)<1e-10);assert.equal(all.stochasticK[16],50);
 assert.ok(Math.abs(all.stochasticD[17]-(((50+75+50)/3)+50+((50+25+100)/3))/3)<1e-10);
});
test('Stochastic leaves zero ranges and missing OHLC unavailable instead of fabricating values',()=>{
 const flat=Array.from({length:25},()=>({high:100,low:100,close:100}));assert.ok(chartIndicators(flat).stochasticK.every(v=>v===null));
 flat[24]={high:102,low:99,close:101};assert.equal(chartIndicators(flat).stochasticD[24],null);
 const absent=Array.from({length:25},()=>({close:100}));assert.ok(chartIndicators(absent).stochasticK.every(v=>v===null));
});
test('OBV uses close direction, includes zero volume and stops after a missing volume gap',()=>{
 const input=[{close:100,volume:100},{close:101,volume:20},{close:101,volume:50},{close:99,volume:10},{close:102,volume:0},{close:103,volume:5}];
 assert.deepEqual(chartIndicators(input).obv,[0,20,20,10,10,15]);const before=JSON.stringify(input);input[3].volume=null;assert.deepEqual(chartIndicators(input).obv,[0,20,20,null,null,null]);input[3].volume=10;assert.equal(JSON.stringify(input),before);
});
