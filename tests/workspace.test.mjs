import test from 'node:test';
import assert from 'node:assert/strict';
import {chartWindow,zoomWindow} from '../chart-view.mjs';
import {scanFile,screenResult,safeSourceUrl} from '../scanner-core.mjs';
import {indicatorSnapshot} from '../chart-indicators.mjs';
const csv=(ticker='AAPL',volume='100')=>'Date,Open,High,Low,Close,Volume,Symbol\n'+Array.from({length:160},(_,i)=>{const price=100+i;return [new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),price,price+2,price-2,price+1,volume,ticker].join(',')}).join('\n');
test('chart view clamps at both history edges',()=>{assert.deepEqual(chartWindow(200,60,500),{start:0,end:60,count:60});assert.deepEqual(chartWindow(200,60,-30),{start:140,end:200,count:60})});
test('zoom never reads outside candles, including short series',()=>{for(const total of [1,5,21,200])for(const offset of [0,5,500])for(const factor of [.001,.8,1.25,100]){const z=zoomWindow(total,60,offset,factor,1),w=chartWindow(total,z.count,z.offset);assert.ok(w.start>=0&&w.end<=total&&w.end>w.start)}});
test('scanner uses symbol column and daily historical indicators',()=>{const r=scanFile('other.csv',csv());assert.equal(r.symbol,'AAPL');assert.equal(r.symbolFrom,'column');assert.equal(r.summary.aboveMA20,true);assert.equal(r.summary.sma150,185.5);assert.equal(screenResult(r).matches,true)});
test('scanner rejects mixed tickers and intraday screening',()=>{assert.throws(()=>scanFile('x.csv',csv().replace(',AAPL',',NVDA')),/כמה מניות/);assert.throws(()=>scanFile('x.csv',csv().replace('2025-01-01','2025-01-01 12:00')),/יומיים/)});
test('missing volume cannot silently pass the screen',()=>{const r=scanFile('a.csv',csv('AAPL',''));assert.equal(screenResult(r).matches,false);assert.ok(screenResult(r).reasons.includes('מחזור חסר'))});
test('unsafe article links and embedded credentials are rejected',()=>{for(const x of ['javascript:alert(1)','data:text/html,test','https://user:secret@example.com/'])assert.throws(()=>safeSourceUrl(x));assert.equal(safeSourceUrl('https://example.com/report'),'https://example.com/report')});

test('scanner filters ATR and confirmed daily breakout independently',()=>{
 const r=scanFile('AAPL.csv',csv());
 assert.equal(screenResult(r,{minATR:r.summary.atrPercent}).matches,true);
 assert.equal(screenResult(r,{minATR:r.summary.atrPercent+.01}).matches,false);
 assert.equal(screenResult(r,{breakout20:true}).matches,false);
 const bars=r.bars.map(b=>({...b}));bars.at(-1).close=270;bars.at(-1).high=271;
 const text='Date,Open,High,Low,Close,Volume,Symbol\n'+bars.map(b=>[b.date,b.open,b.high,b.low,b.close,b.volume,'AAPL'].join(',')).join('\n');
 assert.equal(screenResult(scanFile('AAPL.csv',text),{breakout20:true}).matches,true);
});
test('rising volume requires both a higher close and strictly above-average volume',()=>{
 const base=scanFile('AAPL.csv',csv());
 assert.equal(screenResult(base,{risingVolume:true}).matches,false);
 const increased=scanFile('AAPL.csv',csv().replace(/100,AAPL$/, '200,AAPL'));
 assert.equal(screenResult(increased,{risingVolume:true}).matches,true);
 const falling={...increased,bars:increased.bars.map(b=>({...b}))};
 falling.bars.at(-1).close=falling.bars.at(-2).close;
 assert.equal(screenResult(falling,{risingVolume:true}).matches,false);
 assert.equal(screenResult(scanFile('AAPL.csv',csv('AAPL','')),{risingVolume:true}).matches,false);
});
test('scanner shares chart RSI/MACD formulas and RSI bounds are inclusive',()=>{
 const r=scanFile('AAPL.csv',csv()),snapshot=indicatorSnapshot(r.bars);assert.equal(r.summary.rsi14,snapshot.rsi14);assert.equal(r.summary.macd,snapshot.macd12269.line);assert.equal(r.summary.macdSignal,snapshot.macd12269.signal);
 assert.equal(screenResult(r,{rsiEnabled:true,minRSI:100,maxRSI:100}).matches,true);
 assert.ok(screenResult(r,{rsiEnabled:true,maxRSI:99}).reasons.includes('RSI14 מחוץ לטווח שנבחר'));
 for(const range of [{minRSI:80,maxRSI:20},{minRSI:-1},{maxRSI:101},{minRSI:NaN}])assert.ok(screenResult(r,{rsiEnabled:true,...range}).reasons.includes('טווח RSI אינו תקין'));
 assert.equal(screenResult(r,{rsiEnabled:false,minRSI:NaN}).matches,true);
});
test('MACD filters reject insufficient warmup, equality and zero, while accepting positive momentum',()=>{
 const make=(count,impulse=0)=>scanFile('QA.TEST.csv','Date,Open,High,Low,Close,Volume\n'+Array.from({length:count},(_,i)=>{const c=100+(i===count-1?impulse:0);return [new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),100,c+1,99,c,100].join(',')}).join('\n'));
 assert.ok(screenResult(make(21),{above20:false,macdPositive:true}).reasons.includes('אין מספיק נרות ל-MACD'));
 assert.ok(screenResult(make(33),{above20:false,macdAboveSignal:true}).reasons.includes('אין מספיק נרות לקו איתות MACD'));
 assert.ok(screenResult(make(34),{above20:false,macdAboveSignal:true}).reasons.includes('MACD אינו מעל קו האיתות'));
 assert.ok(screenResult(make(35),{above20:false,macdPositive:true}).reasons.includes('MACD אינו חיובי'));
 assert.equal(screenResult(make(35,10),{macdAboveSignal:true,macdPositive:true,rsiEnabled:true,minRSI:50,maxRSI:100}).matches,true);
});

test('scanner Stochastic and OBV filters use shared source data and reject equality or missing volume history',()=>{
 const make=({impulse=10,gap=false,volume=100,count=40}={})=>scanFile('QA.TEST.csv','Date,Open,High,Low,Close,Volume\n'+Array.from({length:count},(_,i)=>{const c=100+(i===count-1?impulse:0);return [new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),100,c+1,99,c,gap&&i===10?'':i===count-1?volume:100].join(',')}).join('\n'));
 const up=make(),snapshot=indicatorSnapshot(up.bars);assert.equal(up.summary.stochasticK,snapshot.stochastic1433.k);assert.equal(up.summary.obv,snapshot.obv);assert.equal(screenResult(up,{stochasticAboveSignal:true,obvRising:true}).matches,true);
 assert.ok(screenResult(make({impulse:0}),{above20:false,stochasticAboveSignal:true}).reasons.includes('Stochastic %K אינו מעל %D'));
 assert.ok(screenResult(make({volume:0}),{minVolume:0,obvRising:true}).reasons.includes('OBV אינו עולה בנר האחרון'));
 assert.ok(screenResult(make({gap:true}),{obvRising:true}).reasons.includes('אין רצף מחזורים מלא לחישוב OBV'));
});
