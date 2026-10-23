import test from 'node:test';
import assert from 'node:assert/strict';
import {chartLayout} from '../chart-layout.mjs';
test('price, volume, oscillators and labels retain separate space at phone and desktop widths',()=>{
 for(const width of [180,320,390,1100])for(const names of [[],['rsi'],['macd','atr'],['rsi','macd','atr'],['rsi','macd','atr','stochastic','obv']]){
  const l=chartLayout(width,names);assert.ok(l.plotWidth>0);assert.ok(l.top<l.bottom&&l.bottom<l.volTop&&l.volTop<l.volBottom);
  let bottom=l.volBottom;for(const p of Object.values(l.panes)){assert.ok(p.top-bottom>=20);assert.ok(p.bottom-p.top>=70);bottom=p.bottom}assert.ok(l.height-bottom>=20);
 }
});
