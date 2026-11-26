import {readMarketSnapshot} from './market-feed.mjs';
import {marketCoverage} from '../market-quality.mjs';
import {comparableDailyVolume} from '../comparable-volume.mjs';

export const scannerDailyVolumeEnabled=env=>env.ASAF_SCANNER_DAILY_VOLUME_ENABLED==='true';
// US historical EOD is consolidated, unlike the default intraday feed:
// https://support.twelvedata.com/en/articles/9935903-us-equities-market-data
// Request a separate adjust=none series so the volume basis is explicit and
// never change the split-adjusted candles used by charts, ATR or patterns.
export const scannerDailyVolumeBasis=env=>scannerDailyVolumeEnabled(env)?{
 feed:'twelve-data:us-equities',session:'regular',coverage:'consolidated',
 basis:'us-consolidated-eod',adjustment:'unadjusted',verifiedFrom:'1980-01-01'
}:null;

export async function readScannerSnapshot(options={}){
 const env=options.env||process.env,prices=await readMarketSnapshot({...options,interval:'1day'});
 if(!scannerDailyVolumeEnabled(env))return prices;
 // A volume outage leaves the price research available, without passing the gate.
 try{
  const daily=await readMarketSnapshot({...options,interval:'1day',unadjustedVolume:true});
  if(daily.currency!=='USD'||daily.exchangeTimezone!=='America/New_York')throw Error('Unexpected US equity metadata');
  const volumes=new Map(daily.bars.map(b=>[b.date,b.volume]));
  const bars=prices.bars.map(b=>({...b,volume:volumes.get(b.date)??null}));
  const result={...prices,bars,volumeBasis:scannerDailyVolumeBasis(env),volumeConflictDates:[...new Set([...(prices.volumeConflictDates||[]),...(daily.volumeConflictDates||[])])],receivedAt:daily.receivedAt};
  result.coverage=marketCoverage('1day',comparableDailyVolume(bars,result).coverage||'unconfirmed');
  return result;
 }catch{return {...prices,volumeBasis:null,coverage:marketCoverage('1day')};}
}
