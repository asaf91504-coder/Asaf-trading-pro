import {chatPresentationCopy} from './chat-presentation-copy.mjs';
import {scenarioLocales} from './entry-stop-locales.mjs';
import {languageCode} from './interface-language.mjs';
import {chartIndicators} from './chart-indicators.mjs';
import {validCandleTime} from './candle-time.mjs';

// A reproducible research scenario, not an order or a model-invented price.
// The caller must supply provenance resolved on the server after source/license gates.
export function entryStopScenario(input,meta={},side='long'){
 const unavailable=reason=>({available:false,reason});
 if(!['server-intrinio-cache','server-provider-cache','server-crypto-cache'].includes(meta.provenance))return unavailable('נדרשים נרות ממקור מאומת בשרת; צילום או סימול בלבד אינם מספיקים.');
 if(!['long','short'].includes(side))return unavailable('יש לבחור תרחיש לונג או שורט אחד.');
 if(!Array.isArray(input))return unavailable('לא נטענו נרות לניתוח.');
 const excludedLatest=meta.latestBarMayBePartial!==false;
 const bars=excludedLatest?input.slice(0,-1):input.slice();
 if(bars.length<21)return unavailable('נדרשים לפחות 21 נרות לאחר הוצאת הנר האחרון שעשוי להיות חלקי.');
 if(bars.some((b,i)=>!validCandleTime(b?.date)||![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0&&v<=1e12)||b.low>b.high||b.open<b.low||b.open>b.high||b.close<b.low||b.close>b.high||(i&&b.date<=bars[i-1].date)))return unavailable('סדרת הנרות אינה תקינה לחישוב כניסה וסטופ.');
 const last=bars.at(-1),prior20=bars.slice(-21,-1),support=Math.min(...prior20.map(b=>b.low)),resistance=Math.max(...prior20.map(b=>b.high));
 const atr=chartIndicators(bars).atr14.at(-1);
 if(!Number.isFinite(atr)||atr<=0||support>=resistance)return unavailable('אין טווח מחיר ותנודתיות מספיקים לבניית תרחיש.');
 // Same transparent rule on every symbol: breakout of the prior 20 bars,
 // with 0.25 ATR14 clearance and the user's exact 2×ATR stop.
 const buffer=atr*.25,entry=side==='long'?resistance+buffer:support-buffer,stop=entry+(side==='long'?-2:2)*atr;
 if(![entry,stop].every(v=>Number.isFinite(v)&&v>0)||(side==='long'?stop>=entry:stop<=entry))return unavailable('לא ניתן לגזור כניסה וסטופ תקינים מהטווח הנוכחי.');
 const height=resistance-support,measured=side==='long'?resistance+height:support-height;
 const target=measured>0&&(side==='long'?measured>entry:measured<entry)?measured:null;
 return {available:true,side,entry,stop,target,riskReward:target===null?null:Math.abs(target-entry)/Math.abs(entry-stop),atrStopMultiple:2,atr14:atr,buffer,support,resistance,riskPercent:Math.abs(entry-stop)/entry*100,asOf:last.date,interval:meta.interval||null,source:meta.source||null,excludedLatest,barsUsed:bars.length,
  structuralStopConflict:side==='long'?stop>=support:stop<=resistance,
  stage:(side==='long'?last.close>entry:last.close<entry)?'already-crossed':'waiting',method:'Prior 20-bar range breakout with 0.25 ATR14 buffer; stop exactly 2×ATR14; target is measured range height if still beyond entry. Conditional research only.'};
}

export function scenarioSide(question){
 return /שורט|\bshort\b/iu.test(String(question).replace(/\bshort\s+(?:answer|reply|summary)\b/giu,''))?'short':'long';
}

export function entryStopText(plan,language='he'){
 const code=languageCode(language),copy=scenarioLocales[code];
 if(copy){
  if(!plan?.available)return copy.heading+'\n'+copy.unavailable;
  const number=v=>Number(v).toLocaleString('en-US',{maximumSignificantDigits:8});
  const fill=(text,values)=>text.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
  const long=plan.side==='long';
  return [copy.heading,fill(long?copy.scenarioLong:copy.scenarioShort,{date:plan.asOf,interval:plan.interval||copy.unspecified}),fill(copy.entry,{value:number(plan.entry)}),fill(copy.stop,{value:number(plan.stop)}),long?copy.triggerLong:copy.triggerShort,...(plan.stage==='already-crossed'?[copy.crossed]:[]),fill(long?copy.methodLong:copy.methodShort,{risk:number(plan.riskPercent)}),...(plan.excludedLatest?[copy.excluded]:[]),copy.caveat].join('\n');
 }

 const heading='**כניסה וסטופ־לוס — תרחיש מחושב**';
 if(!plan?.available)return heading+'\nנקודת כניסה: לא זמינה.\nסטופ־לוס: לא זמין.\n'+(plan?.reason||'אין נתונים מאומתים לבניית תרחיש.');
 const number=v=>Number(v).toLocaleString('en-US',{maximumSignificantDigits:8}),isLong=plan.side==='long';
 return [heading,
  'תרחיש '+(isLong?'לונג':'שורט')+' לפי הסדרה האחרונה שנטענה; נר בסיס '+plan.asOf+' · טווח '+(plan.interval||'לא צוין')+'.',
  'נקודת כניסה מותנית: '+number(plan.entry)+'.',
  'סטופ־לוס לתרחיש: '+number(plan.stop)+'.',
  'תנאי הפעלה: סגירת נר '+(isLong?'מעל':'מתחת')+' נקודת הכניסה ובדיקה חוזרת שמחזיקה '+(isLong?'מעליה':'מתחתיה')+'. נדרש מחיר עדכני לאימות לפני פעולה.',
  ...(plan.stage==='already-crossed'?['הסגירה האחרונה כבר עברה את הרמה; אין כאן הנחיית כניסה מיידית. התרחיש תלוי בבדיקה חוזרת.']:[]),
  'שיטת החישוב: '+(isLong?'שיא':'שפל')+' 20 הנרות הקודמים, עם מרווח של רבע ATR14; הסטופ במרחק בדיוק 2×ATR14 מהכניסה. מרחק הכניסה מהסטופ: '+number(plan.riskPercent)+'% ממחיר הכניסה, לא מהתיק.',
  ...(plan.excludedLatest?['הנר האחרון הוצא מהחישוב כי ייתכן שעדיין אינו סגור.']:[]),
  'הרמות הן ביחידות המחיר של הנכס ומבוססות על נתונים היסטוריים. זהו תרחיש לבדיקה, לא הוראת מסחר; הסטופ אינו מבטיח מחיר ביצוע.'
 ].join('\n');
}

export function compactEntryStopText(plan,language='he'){
 const code=languageCode(language),copy=chatPresentationCopy[code]||chatPresentationCopy.en,labels=scenarioLocales[code]||{};
 if(!plan?.available)return entryStopText(plan,language);
 const number=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:Math.abs(value)>=1?2:8});
 const fill=(text,value)=>text.replace('{value}',number(value));
 const entry=labels.entry||'כניסה מותנית: {value}.',stop=labels.stop||'סטופ: {value}.';
 return [fill(entry,plan.entry).replace(/\.$/,'')+' · '+fill(stop,plan.stop).replace(/\.$/,''),copy.target+': '+(Number.isFinite(plan.target)?number(plan.target):copy.unknown)+(Number.isFinite(plan.riskReward)?' · '+copy.rr+' '+Number(plan.riskReward).toLocaleString('en-US',{maximumFractionDigits:2})+':1':''),plan.stage==='already-crossed'?copy.crossed:copy.waiting,copy.caveat].join('\n');
}

// Supports both legacy long receipts and the short default when reopening history.
export function withoutScenarioText(answer,plan,language='he'){
 let text=String(answer||'');if(!plan)return text;
 for(const receipt of [entryStopText(plan,language),compactEntryStopText(plan,language)]){
  const start=text.indexOf('\n\n'+receipt),end=start+receipt.length+2;
  if(start!==-1&&(end===text.length||text.startsWith('\n\n',end)))text=text.slice(0,start)+text.slice(end);
 }
 return text;
}
