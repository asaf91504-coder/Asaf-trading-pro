import {screenResult} from '../scanner-core.mjs';
import {marketCapAvailable} from '../market-quality.mjs';
import {closedSetupAtr14,exactTwoAtrStop} from './setup-atr.mjs';

// Executable subset of the reviewed educational methods. User rules win;
// unsupported patterns, earnings dates and current news are never inferred.
export const ASAF_ANALYSIS_POLICY=`\nApply the ASAF Pro analysis framework: first establish data source, date, timeframe and completed/open candle status; then trend and MA20 with MA150 as context, support/resistance, pattern and its stage, comparable volume, and a conditional trigger/invalidation. Distinguish a waiting pattern, a latest-candle crossing and an already extended move; do not encourage chasing or claim a bottom is confirmed without evidence. Use server-calculated entry/stop and exactly 2×ATR risk where supplied. Explain measured potential and reward/risk without promising returns. Missing/full-market-unverified volume, company size, earnings or chart information stays unknown. Stock screening baseline: USD market cap at least1 billion, price strictly above5, verified above-average market-wide volume and valid ATR and a supported directional pattern with at least15% measured potential. Longs require above MA20 and a rising close. Shorts use the mirrored conditions: below MA20 and a falling close, with verified above-average volume and a supported short pattern. In either-side mode evaluate both directions independently. Unconfirmed watch candidates are not full matches. MA150 is never an extra mandatory gate. These screening gates are not a requirement that every educational or short-side chart question describe a qualifying stock.\n`;

const supported={long:new Set(['breakout20','doubleBottom','downtrendBreak','inverseHeadShoulders']),short:new Set(['breakdown20','doubleTop','headShoulders'])};
const stages={long:['waiting','crossed','above'],short:['waiting','crossed','below']};
const candidateQualifies=(candidate,side)=>supported[side]?.has(candidate.kind)&&stages[side]?.includes(candidate.stage)&&candidate.scenario?.side===side&&candidate.scenario.movePercent>=15;

// Bind every presentation to the same candidate that justifies the pattern
// check. A more attractive RR from a different, failing setup is not that match.
export function selectMethodologyCandidate(record,{side='long',fullMatch=false}={}){
 const candidates=(record.research?.candidates||[]).filter(c=>
  supported[side]?.has(c.kind)&&stages[side]?.includes(c.stage)&&c.scenario?.side===side&&
  [c.scenario.entry,c.scenario.stop,c.scenario.target].every(v=>Number.isFinite(v)&&v>0)&&
  (side==='long'?c.scenario.stop<c.scenario.entry&&c.scenario.target>c.scenario.entry:c.scenario.stop>c.scenario.entry&&c.scenario.target<c.scenario.entry));
 const ordered=candidates.sort((a,b)=>(b.scenario.riskReward||0)-(a.scenario.riskReward||0));
 const candidate=ordered.find(c=>candidateQualifies(c,side))||(!fullMatch?ordered[0]:null)||null;
 return {candidate,qualified:!!candidate&&candidateQualifies(candidate,side),watchOnly:!fullMatch};
}
export function reviewScannerMethodology(record,{now=Date.now(),side='long'}={}){
 const atr=closedSetupAtr14(record),s=record.summary||{},prior=record.bars?.at(-2),short=side==='short';
 const candidates=(record.research?.candidates||[]).map(c=>{
  // Recalculate potential remaining from the current close on either side.
  const priced=c.scenario&&Number.isFinite(s.close)?{...c.scenario,entry:c.scenario.side==='short'?Math.min(c.scenario.entry,s.close):Math.max(c.scenario.entry,s.close)}:c.scenario;
  const scenario=exactTwoAtrStop(priced,atr);
  if(!scenario)return {...c,scenario:null};
  const reward=scenario.side==='long'?scenario.target-scenario.entry:scenario.entry-scenario.target,risk=Math.abs(scenario.entry-scenario.stop);
  if(!Number.isFinite(reward)||reward<=0)return {...c,scenario:null};
  return {...c,scenario:{...scenario,movePercent:reward/scenario.entry*100,riskReward:reward/risk,method:'Conditional measured target; stop exactly 2× daily ATR14. No fill or return guarantee.'}};
 });
 const directional=candidates.filter(c=>candidateQualifies(c,side));
 const volume=record.volumeComparison;
 const checks=[
  ['closedDaily',atr!==null,'נדרשים נרות יומיים שהושלמו ו־ATR14 תקין'],
  ['marketCap',marketCapAvailable(record,now)&&record.fundamentals.marketCap>=1e9,'שווי שוק של מיליארד דולר לפחות לא אומת'],
  ['price',Number.isFinite(s.close)&&s.close>5,'המחיר אינו מעל $5'],
  ['ma20',short?Number.isFinite(s.sma20)&&s.close<s.sma20:s.aboveMA20===true,short?'המחיר אינו מתחת MA20':'המחיר אינו מעל MA20'],
  ['risingClose',Number.isFinite(prior?.close)&&(short?s.close<prior.close:s.close>prior.close),short?'אין סגירה מתחת לסגירה הקודמת':'אין סגירה מעל הסגירה הקודמת'],
  ['volume',volume?.status==='verified'&&volume.coverage==='consolidated'&&volume.aboveAverage===true,'נדרש מחזור שוק מאוחד ומאומת מעל ממוצע 20 הימים'],
  ['pattern',record.research?.available===true&&directional.length>0,short?'אין תבנית שורט תקינה עם פוטנציאל מדוד של 15% לפחות':'אין תבנית לונג תקינה עם פוטנציאל מדוד של 15% לפחות']
 ];
 const eligible=checks.every(([,pass])=>pass),stage=eligible?(directional.some(c=>c.stage==='crossed')?'crossed':directional.some(c=>c.stage==='waiting')?'waiting':short?'below':'above'):'incomplete';
 const label={crossed:'חצייה בנר האחרון — תרחיש מותנה',waiting:'מועמד למעקב — ממתין לחצייה',above:'כבר מעל הרמה — לבדוק מרחק מהכניסה',below:'כבר מתחת לרמה — לבדוק מרחק מהכניסה',incomplete:'אינו עומד בכללי השיטה'}[stage];
 const warnings=['יעד מדוד אינו תחזית; ביצוע סטופ במחיר שנקבע אינו מובטח.','מועדי דוחות, חדשות וסיכון אירוע לא נבדקו בסריקה זו.'];
 if(short)warnings.push('זמינות השאלה ועלות השורט לא נבדקו; הפסד בשורט עלול לעלות על ההשקעה.');
 if(Math.abs(record.research?.gapOpenPercent)>=2)warnings.push('פער פתיחה של 2% לפחות; יש לבדוק סיכון פערים לפני החלטה.');
 return {record:{...record,research:{...record.research,candidates}},methodology:{version:'asaf-method-v3',side,eligible,stage,label,checks:checks.map(([key,passed,reason])=>({key,passed,reason})),warnings,ma150Context:s.aboveMA150??null,stopAtrMultiple:2}};
}
function reviewSide(input,filters,side,options){
 const {record,methodology}=reviewScannerMethodology(input,{...options,side});
 // Basic direction rules mirror for shorts; explicitly selected advanced
 // indicators retain their stated meaning. The original bars are never altered.
 const selected=screenResult({...record,research:{...record.research,candidates:record.research.candidates.filter(c=>supported[side].has(c.kind))}},
  {...filters,scenarioSide:side,...(side==='short'?{above20:false,risingVolume:false,breakout20:false}:{})});
 if(side==='short'&&filters.breakout20===true&&!(record.summary.close<record.research.support20))selected.reasons.push('אין סגירה מתחת לשפל 20 הימים הקודמים');
 const reasons=[...new Set([...selected.reasons,...methodology.checks.filter(c=>!c.passed).map(c=>c.reason)])];
 return {record,methodology,screen:{matches:!reasons.length,reasons}};
}
export function screenWithMethodology(input,filters={},options={}){
 const requested=filters.scenarioSide??'long',sides=requested==='any'?['long','short']:[requested==='short'?'short':'long'];
 const reviews=sides.map(side=>reviewSide(input,filters,side,options));
 if(!['any','long','short'].includes(requested))for(const review of reviews){review.screen.matches=false;review.screen.reasons.push('כיוון תרחיש אינו תקין');}
 const opportunities=reviews.map(({record,methodology,screen})=>{
  const valid=methodology.checks.find(c=>c.key==='closedDaily').passed&&record.summary.close>5;
  const capKnown=marketCapAvailable(record,options.now??Date.now());
  const baseAllowed=valid&&(!capKnown||record.fundamentals.marketCap>=1e9);
  const pattern=methodology.checks.find(c=>c.key==='pattern').passed;
  // Deterministic ordering only, never a success probability or recommendation.
  const rank=methodology.checks.filter(c=>c.passed).length*10+(pattern?20:0)+(methodology.checks.find(c=>c.key==='ma20').passed?10:0)+(screen.matches?1000:0);
  return {side:methodology.side,status:screen.matches?'match':'watch',eligible:baseAllowed,rank,reasons:screen.reasons};
 });
 const best=reviews.map((review,i)=>({review,opportunity:opportunities[i]})).sort((a,b)=>b.opportunity.rank-a.opportunity.rank)[0].review;
 return {...best,opportunities};
}
