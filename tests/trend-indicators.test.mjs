import test from 'node:test';
import assert from 'node:assert/strict';
import {trendIndicators} from '../trend-indicators.mjs';
import {chartIndicators,indicatorSnapshot} from '../chart-indicators.mjs';
import {scanBars,screenResult} from '../scanner-core.mjs';
import {personalData,personalBackup,parsePersonalBackup} from '../personal-data.mjs';
const series=(n=50,direction=1)=>Array.from({length:n},(_,i)=>{const close=100+direction*i;return {date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:close-.1,high:close+1,low:close-1,close,volume:100}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('ADX14 warms up with 14 directional changes and 14 DXs, independently from direction',()=>{
 for(const d of [1,-1]){const all=trendIndicators(series(50,d));assert.equal(all.plusDI14[13],null);assert.equal(all.adx14[26],null);near(all.adx14[27],100);near(all.adx14[49],100);near(all[d===1?'plusDI14':'minusDI14'][14],50);assert.equal(all[d===1?'minusDI14':'plusDI14'][14],0)}
});
test('flat prices have zero directional movement and zero ADX after full warmup',()=>{
 const all=trendIndicators(series(40,0).map(b=>({...b,high:100,low:100})));assert.equal(all.adx14[27],0);assert.equal(all.plusDI14[14],0);assert.equal(all.minusDI14[14],0);assert.ok(all.supertrend.every(x=>x===null||x===100));
});
test('equal positive high/low extensions cancel both directional movements',()=>{
 const input=series(15,0).map((b,i)=>({...b,high:101+i,low:99-i})),all=trendIndicators(input);assert.equal(all.plusDI14[14],0);assert.equal(all.minusDI14[14],0);assert.equal(all.dx14[14],0);
});
test('Supertrend10/3 uses first-bar TR, initial down direction and strict close crossings',()=>{
 const input=series(10,0),all=trendIndicators(input);assert.equal(all.supertrend[8],null);assert.equal(all.supertrend[9],106);assert.equal(all.supertrendDirection[9],'down');
 input.push({...input[0],high:111,low:109,close:110});const flip=trendIndicators(input);near(flip.supertrend[10],101.3);assert.equal(flip.supertrendDirection[10],'up');assert.equal(flip.supertrendDown[10],null);
 input.push({...input[0],high:116,low:114,close:115},{...input[0],high:91,low:89,close:90});const reverse=trendIndicators(input);near(reverse.supertrend[11],105.37);near(reverse.supertrend[12],106.467);assert.equal(reverse.supertrendDirection[12],'down');assert.equal(reverse.supertrendUp[12],null);
 const tied=series(10,0);tied.push({...tied[0],high:107,low:105,close:106});assert.equal(trendIndicators(tied).supertrendDirection[10],'down');
});
test('trend indicators never look ahead, mutate candles or bridge missing OHLC',()=>{
 const input=series(),before=JSON.stringify(input),short=trendIndicators(input.slice(0,30)),all=trendIndicators(input);for(const key of Object.keys(short))assert.deepEqual(short[key],all[key].slice(0,30));assert.equal(JSON.stringify(input),before);
 input[20].high=null;const broken=trendIndicators(input);for(const values of Object.values(broken))assert.ok(values.slice(20).every(x=>x===null));assert.ok(trendIndicators([{close:100}]).supertrend.every(x=>x===null));assert.deepEqual(trendIndicators([]).adx14,[]);
});
test('chart, scanner and AI snapshot expose identical trend calculations',()=>{
 const bars=series(),chart=chartIndicators(bars),snapshot=indicatorSnapshot(bars),scan=scanBars('QA.TREND',bars).summary;
 assert.equal(snapshot.dmi14.adx,chart.adx14.at(-1));assert.equal(scan.adx14,snapshot.dmi14.adx);assert.equal(scan.plusDI14,snapshot.dmi14.plusDI);assert.equal(scan.supertrend,snapshot.supertrend103.value);assert.equal(scan.supertrendDirection,snapshot.supertrend103.direction);
});
test('scanner ADX threshold is inclusive and rising/falling DMI and Supertrend remain separate',()=>{
 const up=scanBars('QA.UP',series()),down=scanBars('QA.DOWN',series(50,-1)),base={above20:false,minVolume:0};
 assert.equal(screenResult(up,{...base,adxEnabled:true,minADX:100,diDirection:'up',supertrendDirection:'up'}).matches,true);
 assert.equal(screenResult(down,{...base,adxEnabled:true,minADX:100,diDirection:'down',supertrendDirection:'down'}).matches,true);
 assert.equal(screenResult(down,{...base,diDirection:'up'}).matches,false);assert.equal(screenResult(up,{...base,supertrendDirection:'down'}).matches,false);
});
test('scanner rejects invalid ADX/direction choices, insufficient warmup and equal DMI',()=>{
 const base={above20:false,minVolume:0},up=scanBars('QA.UP',series()),short=scanBars('QA.SHORT',series(21));
 for(const minADX of [NaN,-1,101])assert.equal(screenResult(up,{...base,adxEnabled:true,minADX}).matches,false);
 assert.equal(screenResult(short,{...base,adxEnabled:true,minADX:0}).matches,false);
 for(const key of ['diDirection','supertrendDirection'])assert.equal(screenResult(up,{...base,[key]:'invalid'}).matches,false);
 assert.equal(screenResult(scanBars('QA.FLAT',series(40,0)),{...base,diDirection:'up'}).matches,false);
});
test('trend visibility preferences survive bounded backup/schema round trips',()=>{
 const prefs={chartADX14:true,chartSupertrend:false};assert.deepEqual(personalData('chartPreferences',prefs),prefs);assert.deepEqual(parsePersonalBackup(JSON.stringify(personalBackup('chartPreferences',prefs)),'chartPreferences'),prefs);assert.throws(()=>personalData('chartPreferences',{chartADX14:'true'}));
});
