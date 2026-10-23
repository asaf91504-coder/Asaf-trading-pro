// Indicators are calculated once per loaded dataset, never per pointer movement.
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
 return {ma20,ma150:sma(150),ema50:ema(50),rsi14,bbUpper,bbLower,macd,macdSignal,macdHistogram,atr14};
}

export function indicatorSnapshot(bars){const all=chartIndicators(bars),last=key=>all[key].at(-1)??null;return {ema50:last('ema50'),rsi14:last('rsi14'),atr14:last('atr14'),bollinger20:{middle:last('ma20'),upper:last('bbUpper'),lower:last('bbLower'),deviations:2},macd12269:{line:last('macd'),signal:last('macdSignal'),histogram:last('macdHistogram')},methods:'EMA uses an SMA seed; RSI/ATR use Wilder smoothing; ATR seed excludes the first bar; Bollinger uses population standard deviation.'}}
