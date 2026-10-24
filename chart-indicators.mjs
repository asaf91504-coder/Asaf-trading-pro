// Indicators are calculated once per loaded dataset, never per pointer movement.
import {trendIndicators} from './trend-indicators.mjs';
export function chartIndicators(bars){
 const closes=bars.map(b=>b.close),length=closes.length;
 function sma(period){let sum=0;return closes.map((value,i)=>{sum+=value;if(i>=period)sum-=closes[i-period];return i<period-1?null:sum/period})}
 function ema(period){const values=Array(length).fill(null);if(length<period)return values;let value=closes.slice(0,period).reduce((a,b)=>a+b,0)/period;values[period-1]=value;const alpha=2/(period+1);for(let i=period;i<length;i++){value+=(closes[i]-value)*alpha;values[i]=value}return values}
 // Wilder RSI: 14 price changes seed the averages; flat windows read 50.
 const rsi14=Array(length).fill(null);let gains=0,losses=0;
 const rsi=(gain,loss)=>gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);
 for(let i=1;i<length;i++){const change=closes[i]-closes[i-1];if(i<=14){gains+=Math.max(change,0);losses+=Math.max(-change,0);if(i===14){gains/=14;losses/=14;rsi14[i]=rsi(gains,losses)}}else{gains=(gains*13+Math.max(change,0))/14;losses=(losses*13+Math.max(-change,0))/14;rsi14[i]=rsi(gains,losses)}}
 const ma20=sma(20),bbUpper=Array(length).fill(null),bbLower=Array(length).fill(null);
 // Population standard deviation; centered differences avoid cancellation at high prices.
 for(let i=19;i<length;i++){const variance=closes.slice(i-19,i+1).reduce((sum,v)=>sum+(v-ma20[i])**2,0)/20,spread=2*Math.sqrt(variance);bbUpper[i]=ma20[i]+spread;bbLower[i]=ma20[i]-spread}
 const fast=ema(12),slow=ema(26),macd=closes.map((_,i)=>slow[i]===null?null:fast[i]-slow[i]);
 const macdSignal=Array(length).fill(null),macdHistogram=Array(length).fill(null);
 // Nine defined MACD values seed the signal, then EMA smoothing begins.
 if(length>=34){let value=macd.slice(25,34).reduce((a,b)=>a+b,0)/9;macdSignal[33]=value;macdHistogram[33]=macd[33]-value;for(let i=34;i<length;i++){value+=(macd[i]-value)*.2;macdSignal[i]=value;macdHistogram[i]=macd[i]-value}}
 const atr14=Array(length).fill(null);let total=0,valid=true,value=null;
 // Seed from 14 changes, matching the scanner's Wilder ATR convention.
 for(let i=1;i<length;i++){const b=bars[i],tr=Math.max(b.high-b.low,Math.abs(b.high-closes[i-1]),Math.abs(b.low-closes[i-1]));if(!Number.isFinite(tr)){valid=false;continue}if(!valid)continue;if(i<=14){total+=tr;if(i===14)value=total/14}else value=(value*13+tr)/14;atr14[i]=value}
 // Slow Stochastic 14/3/3: fast %K over high/low, then SMA3 %K and SMA3 %D.
 // A zero range or missing OHLC has no defined ratio and stays null.
 const fastK=Array(length).fill(null);
 for(let i=13;i<length;i++){const window=bars.slice(i-13,i+1);if(window.some(b=>!Number.isFinite(b.high)||!Number.isFinite(b.low)||b.high<b.low))continue;const high=Math.max(...window.map(b=>b.high)),low=Math.min(...window.map(b=>b.low));if(high>low)fastK[i]=100*(closes[i]-low)/(high-low)}
 const smooth3=values=>values.map((_,i)=>{const window=values.slice(Math.max(0,i-2),i+1);return window.length===3&&window.every(Number.isFinite)?window.reduce((a,b)=>a+b,0)/3:null});
 const stochasticK=smooth3(fastK),stochasticD=smooth3(stochasticK);
 // OBV starts at zero for the loaded history; missing volume breaks continuity.
 const obv=Array(length).fill(null);let cumulative=0,volumeValid=true;
 for(let i=0;i<length;i++){const volume=bars[i].volume;if(!Number.isFinite(volume)||volume<0)volumeValid=false;if(!volumeValid)continue;if(i)cumulative+=Math.sign(closes[i]-closes[i-1])*volume;obv[i]=cumulative}
 return {ma20,ma50:sma(50),ma100:sma(100),ma150:sma(150),ma200:sma(200),ema50:ema(50),rsi14,bbUpper,bbLower,macd,macdSignal,macdHistogram,atr14,stochasticK,stochasticD,obv,...trendIndicators(bars)};
}

export function indicatorSnapshot(bars){const all=chartIndicators(bars),last=key=>all[key].at(-1)??null;return {ma50:last('ma50'),ma100:last('ma100'),ma200:last('ma200'),ema50:last('ema50'),rsi14:last('rsi14'),atr14:last('atr14'),dmi14:{adx:last('adx14'),plusDI:last('plusDI14'),minusDI:last('minusDI14')},supertrend103:{value:last('supertrend'),direction:last('supertrendDirection'),atrPeriod:10,multiplier:3},stochastic1433:{k:last('stochasticK'),d:last('stochasticD')},obv:last('obv'),obvPrevious:all.obv.at(-2)??null,bollinger20:{middle:last('ma20'),upper:last('bbUpper'),lower:last('bbLower'),deviations:2},macd12269:{line:last('macd'),signal:last('macdSignal'),histogram:last('macdHistogram')},methods:'EMA uses an SMA seed; RSI/ATR use Wilder smoothing; ATR seed excludes the first bar; Bollinger uses population standard deviation; Slow Stochastic is 14/3/3 with null for zero range; OBV starts at zero at the first loaded bar and becomes unavailable after missing volume. DMI14 uses Wilder smoothing of 14 changes; ADX first appears after 28 bars and measures strength, not direction; flat TR/DX are zero. Supertrend uses Wilder ATR10 seeded by the first 10 TRs including high-low on the first bar, multiplier 3, initial direction down, strict close crossings; malformed OHLC breaks continuity. All depend on the first loaded bar and may differ from a longer history.'}}
