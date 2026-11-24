import {screenResult} from '../scanner-core.mjs';
import {marketCapAvailable} from '../market-quality.mjs';
import {closedSetupAtr14,exactTwoAtrStop} from './setup-atr.mjs';

// Executable subset of the reviewed educational methods. User rules win;
// unsupported patterns, earnings dates and current news are never inferred.
export const ASAF_ANALYSIS_POLICY=`\nApply the ASAF Pro analysis framework: first establish data source, date, timeframe and completed/open candle status; then trend and MA20 with MA150 as context, support/resistance, pattern and its stage, comparable volume, and a conditional trigger/invalidation. Distinguish a waiting pattern, a latest-candle crossing and an already extended move; do not encourage chasing or claim a bottom is confirmed without evidence. Use server-calculated entry/stop and exactly 2×ATR risk where supplied. Explain measured potential and reward/risk without promising returns. Missing/full-market-unverified volume, company size, earnings or chart information stays unknown. Stock screening baseline: USD market cap at least1 billion, price strictly above5, above MA20, rising close and verified above-average market-wide volume, valid ATR and a long pattern with at least15% measured potential. MA150 is never an extra mandatory gate. These screening gates are not a requirement that every educational or short-side chart question describe a qualifying stock.\n`;

export function reviewScannerMethodology(record,{now=Date.now()}={}){
 const atr=closedSetupAtr14(record),s=record.summary||{},prior=record.bars?.at(-2);
 const supportedLong=new Set(['breakout20','doubleBottom','downtrendBreak','inverseHeadShoulders']);
 const candidates=(record.research?.candidates||[]).map(c=>{
  // Re-evaluate remaining potential at the latest closed price. A cached pattern
  // cannot keep an obsolete cheaper entry after the move has already happened.
  const priced=c.scenario?.side==='long'&&Number.isFinite(s.close)?{...c.scenario,entry:Math.max(c.scenario.entry,s.close)}:c.scenario;
  const scenario=exactTwoAtrStop(priced,atr);
  if(!scenario)return {...c,scenario:null};
  const reward=scenario.side==='long'?scenario.target-scenario.entry:scenario.entry-scenario.target;
  const risk=Math.abs(scenario.entry-scenario.stop);
  if(!Number.isFinite(reward)||reward<=0)return {...c,scenario:null};
  return {...c,scenario:{...scenario,movePercent:reward/scenario.entry*100,riskReward:reward/risk,method:'Conditional measured target; stop exactly 2× daily ATR14. No fill or return guarantee.'}};
 });
 const long=candidates.filter(c=>supportedLong.has(c.kind)&&['waiting','crossed','above'].includes(c.stage)&&c.scenario?.side==='long'&&c.scenario.movePercent>=15);
 const volume=record.volumeComparison;
 const checks=[
  ['closedDaily',atr!==null,'נדרשים נרות יומיים שהושלמו ו־ATR14 תקין'],
  ['marketCap',marketCapAvailable(record,now)&&record.fundamentals.marketCap>=1e9,'שווי שוק של מיליארד דולר לפחות לא אומת'],
  ['price',Number.isFinite(s.close)&&s.close>5,'המחיר אינו מעל $5'],
  ['ma20',s.aboveMA20===true,'המחיר אינו מעל MA20'],
  ['risingClose',Number.isFinite(prior?.close)&&s.close>prior.close,'אין סגירה מעל הסגירה הקודמת'],
  ['volume',volume?.status==='verified'&&volume.coverage==='consolidated'&&volume.aboveAverage===true,'נדרש מחזור שוק מאוחד ומאומת מעל ממוצע 20 הימים'],
  ['pattern',record.research?.available===true&&long.length>0,'אין תבנית לונג תקינה עם פוטנציאל מדוד של 15% לפחות']
 ];
 const eligible=checks.every(([,pass])=>pass),stage=eligible?(long.some(c=>c.stage==='crossed')?'crossed':long.some(c=>c.stage==='waiting')?'waiting':'above'):'incomplete';
 const label={crossed:'חצייה בנר האחרון — תרחיש מותנה',waiting:'מועמד למעקב — ממתין לחצייה',above:'כבר מעל הרמה — לבדוק מרחק מהכניסה',incomplete:'אינו עומד בכללי השיטה'}[stage];
 const warnings=['יעד מדוד אינו תחזית; ביצוע סטופ במחיר שנקבע אינו מובטח.','מועדי דוחות, חדשות וסיכון אירוע לא נבדקו בסריקה זו.'];
 if(Math.abs(record.research?.gapOpenPercent)>=2)warnings.push('פער פתיחה של 2% לפחות; יש לבדוק סיכון פערים לפני החלטה.');
 return {record:{...record,research:{...record.research,candidates}},methodology:{version:'asaf-method-v2',eligible,stage,label,checks:checks.map(([key,passed,reason])=>({key,passed,reason})),warnings,ma150Context:s.aboveMA150??null,stopAtrMultiple:2}};
}

export function screenWithMethodology(input,filters,options){
 const {record,methodology}=reviewScannerMethodology(input,options),selected=screenResult(record,filters);
 const reasons=[...new Set([...selected.reasons,...methodology.checks.filter(c=>!c.passed).map(c=>c.reason)])];
 return {record,methodology,screen:{matches:selected.matches&&methodology.eligible,reasons}};
}
