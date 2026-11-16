export const twelveIntervals=['1min','5min','15min','30min','1h','1day','1week'];
function integer(env,key,fallback,min,max){const value=env[key]??String(fallback);if(!/^\d+$/.test(value)||Number(value)<min||Number(value)>max)throw Error('Invalid '+key);return Number(value)}
export function twelveSettings(env=process.env){
 const intervals=[...new Set((env.ASAF_MARKET_INTERVALS||twelveIntervals.join(',')).split(',').map(x=>x.trim()))];
 if(!intervals.length||intervals.some(x=>!twelveIntervals.includes(x)))throw Error('Invalid ASAF_MARKET_INTERVALS');
 const volumeCoverage=env.ASAF_MARKET_VOLUME_COVERAGE||'unconfirmed';
 if(!['unconfirmed','partial','consolidated'].includes(volumeCoverage))throw Error('Invalid ASAF_MARKET_VOLUME_COVERAGE');
 return {intervals,historyBars:integer(env,'ASAF_MARKET_HISTORY_BARS',500,200,2000),minuteCredits:integer(env,'ASAF_MARKET_REQUESTS_PER_MINUTE',8,1,10000),dailyCredits:integer(env,'ASAF_MARKET_REQUESTS_PER_DAY',800,1,10000000),volumeCoverage};
}
