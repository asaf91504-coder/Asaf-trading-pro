import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareChartData,recentAIBars} from '../chart-data.mjs';
const csv=(count=2200,mixed=false)=>'Date,Open,High,Low,Close,Volume,Symbol\n'+Array.from({length:count},(_,i)=>[new Date(Date.UTC(2015,0,i+1)).toISOString().slice(0,10),100,102,99,101,1000,mixed&&i===0?'WRONG':'TEST'].join(',')).join('\n');
test('chart keeps 2000 historical bars but AI payload remains at 200',()=>{const data=prepareChartData(csv(),'TEST');assert.equal(data.bars.length,2000);assert.equal(data.context.bars,2000);assert.equal(recentAIBars(data.bars).length,200);assert.equal(recentAIBars(data.bars).at(-1),data.bars.at(-1));assert.equal(data.interval,'1day')});
test('mixed tickers in earlier history cannot evade validation by truncation',()=>{assert.throws(()=>prepareChartData(csv(2200,true),'TEST'),/כמה מניות/)});
test('wrong selected stock and insufficient history are rejected',()=>{assert.throws(()=>prepareChartData(csv(30),'OTHER'));assert.throws(()=>prepareChartData(csv(10),'TEST'));assert.equal(recentAIBars(null),null)});
