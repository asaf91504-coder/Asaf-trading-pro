// Indicators are calculated once per loaded dataset, never per pointer movement.
export function chartIndicators(bars){
 const closes=bars.map(b=>b.close),length=closes.length;
 function sma(period){let sum=0;return closes.map((value,i)=>{sum+=value;if(i>=period)sum-=closes[i-period];return i<period-1?null:sum/period})}
 function ema(period){const values=Array(length).fill(null);if(length<period)return values;let value=closes.slice(0,period).reduce((a,b)=>a+b,0)/period;values[period-1]=value;const alpha=2/(period+1);for(let i=period;i<length;i++){value+=(closes[i]-value)*alpha;values[i]=value}return values}
 // Wilder RSI: 14 price changes seed the averages; flat windows read 50.
 const rsi14=Array(length).fill(null);let gains=0,losses=0;
 const rsi=(gain,loss)=>gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);
 for(let i=1;i<length;i++){const change=closes[i]-closes[i-1];if(i<=14){gains+=Math.max(change,0);losses+=Math.max(-change,0);if(i===14){gains/=14;losses/=14;rsi14[i]=rsi(gains,losses)}}else{gains=(gains*13+Math.max(change,0))/14;losses=(losses*13+Math.max(-change,0))/14;rsi14[i]=rsi(gains,losses)}}
 return {ma20:sma(20),ma150:sma(150),ema50:ema(50),rsi14};
}
