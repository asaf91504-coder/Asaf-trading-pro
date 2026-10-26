// OHLCV cannot recover executions by price. This is an explicitly approximate,
// uniform allocation of each bar's volume across its high-low range.
export function estimatedVolumeProfile(bars,{bins=24,valueArea=.7}={}){
 const unavailable=reason=>({available:false,reason,method:'uniform-OHLCV-estimate'});
 if(!Number.isInteger(bins)||bins<4||bins>100||!Number.isFinite(valueArea)||valueArea<=0||valueArea>1)throw Error('פרמטרי פרופיל אינם תקינים');
 if(!Array.isArray(bars)||!bars.length)return unavailable('אין נרות בטווח');
 if(bars.some(b=>!b||![b.low,b.high,b.volume].every(Number.isFinite)||b.low<=0||b.high<b.low||b.volume<0))return unavailable('נדרש רצף מלא של מחירים ומחזורים תקינים');
 const low=Math.min(...bars.map(b=>b.low)),high=Math.max(...bars.map(b=>b.high)),totalVolume=bars.reduce((s,b)=>s+b.volume,0);
 if(!Number.isFinite(totalVolume)||totalVolume<=0)return unavailable('אין מחזור חיובי בטווח');
 if(low===high)return {available:true,method:'uniform-OHLCV-estimate',totalVolume,bins:[{low,high,volume:totalVolume}],poc:low,valueAreaLow:low,valueAreaHigh:high,valueAreaVolume:totalVolume};
 const step=(high-low)/bins,levels=Array.from({length:bins},(_,i)=>({low:low+i*step,high:i===bins-1?high:low+(i+1)*step,volume:0}));
 for(const bar of bars){if(bar.high===bar.low){levels[Math.min(bins-1,Math.max(0,Math.floor((bar.low-low)/step)))].volume+=bar.volume;continue}for(const bucket of levels){const overlap=Math.max(0,Math.min(bucket.high,bar.high)-Math.max(bucket.low,bar.low));bucket.volume+=bar.volume*(overlap/(bar.high-bar.low))}}
 let pocIndex=0;for(let i=1;i<bins;i++)if(levels[i].volume>levels[pocIndex].volume)pocIndex=i;
 let a=pocIndex,b=pocIndex,sum=levels[pocIndex].volume;while(sum<totalVolume*valueArea&&(a>0||b<bins-1)){if(a>0&&(b===bins-1||levels[a-1].volume>=levels[b+1].volume))sum+=levels[--a].volume;else sum+=levels[++b].volume}
 return {available:true,method:'uniform-OHLCV-estimate',totalVolume,bins:levels,poc:(levels[pocIndex].low+levels[pocIndex].high)/2,valueAreaLow:levels[a].low,valueAreaHigh:levels[b].high,valueAreaVolume:sum};
}
