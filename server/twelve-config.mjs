import {validCandleTime} from '../candle-time.mjs';
export const twelveIntervals=['1min','5min','15min','30min','1h','1day','1week'];
function integer(env,key,fallback,min,max){const value=env[key]??String(fallback);if(!/^\d+$/.test(value)||Number(value)<min||Number(value)>max)throw Error('Invalid '+key);return Number(value)}
export function twelveSettings(env=process.env){
 const intervals=[...new Set((env.ASAF_MARKET_INTERVALS||twelveIntervals.join(',')).split(',').map(x=>x.trim()))];
 if(!intervals.length||intervals.some(x=>!twelveIntervals.includes(x)))throw Error('Invalid ASAF_MARKET_INTERVALS');
 const volumeCoverage=env.ASAF_MARKET_VOLUME_COVERAGE||'unconfirmed';
 if(!['unconfirmed','partial','consolidated'].includes(volumeCoverage))throw Error('Invalid ASAF_MARKET_VOLUME_COVERAGE');
 const dailyCoverage=env.ASAF_MARKET_DAILY_VOLUME_COVERAGE||'unconfirmed';
 const dailyBasis=env.ASAF_MARKET_DAILY_VOLUME_BASIS||'';
 const dailyAdjustment=env.ASAF_MARKET_DAILY_VOLUME_ADJUSTMENT||'';
 const verifiedFrom=env.ASAF_MARKET_DAILY_VOLUME_VERIFIED_FROM||'';
 // Feed identity, venue/consolidated basis and volume adjustment must be explicitly verified.
 // A specific basis must not be inferred from timeframe or intraday coverage settings.
 const dailyVolumeBasis=['partial','consolidated'].includes(dailyCoverage)&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,95}$/.test(dailyBasis)&&
   ['unadjusted','splits','splits-and-dividends'].includes(dailyAdjustment)&&verifiedFrom.length===10&&validCandleTime(verifiedFrom)
   ?{feed:'twelve-data:us-equities',session:'regular',coverage:dailyCoverage,basis:dailyBasis,adjustment:dailyAdjustment,verifiedFrom}:null;
 return {intervals,dailyVolumeBasis,historyBars:integer(env,'ASAF_MARKET_HISTORY_BARS',500,200,2000),minuteCredits:integer(env,'ASAF_MARKET_REQUESTS_PER_MINUTE',8,1,10000),dailyCredits:integer(env,'ASAF_MARKET_REQUESTS_PER_DAY',800,1,10000000),volumeCoverage};
}
