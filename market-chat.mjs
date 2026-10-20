import {analyze, parseCSV} from "./analyzer.mjs";

export {parseCSV};

const n=v=>Number(v).toLocaleString("en-US",{maximumFractionDigits:2});
const yes=v=>v===null?"לא ניתן לחשב":v?"כן":"לא";
const fmt=v=>v===null?"אין נתונים":n(v);
const includes=(q,list)=>list.some(s=>q.includes(s));
export function stockContext(symbol,bars,meta={}) {
  if (!Array.isArray(bars)||bars.length<21) throw Error("נדרשים 21 נרות לפחות");
  const m=analyze(bars),last=bars.at(-1),prev=bars.at(-2);
  const last20=bars.slice(-20),prior20=bars.slice(-21,-1);
  const rangeLow=Math.min(...last20.map(b=>b.low)),priorHigh=Math.max(...prior20.map(b=>b.high));
  const last50=bars.slice(-50),rangeHigh50=Math.max(...last50.map(b=>b.high)),rangeLow50=Math.min(...last50.map(b=>b.low));
  const changePct=prev.close>0?(last.close-prev.close)/prev.close*100:null;
  const candleRange=last.high-last.low,body=Math.abs(last.close-(last.open??last.close));
  return {
    ...m,symbol:String(symbol||"לא ידוע").slice(0,30),lastBar:last,source:meta.source==="Twelve Data"?"Twelve Data":"CSV",interval:typeof meta.interval==="string"?meta.interval:"1day",receivedAt:meta.receivedAt||null,exchangeTimezone:meta.exchangeTimezone||null,
    dailyChangePercent:changePct===null?null:Math.round(changePct*100)/100,
    rangeLow20:rangeLow,priorHigh20:priorHigh,rangeHigh50,rangeLow50,
    candleDirection:last.open==null?"לא ידוע":last.close>last.open?"עולה":last.close<last.open?"יורד":"דוג'י",
    bodyFraction:last.open==null||candleRange<=0?null:body/candleRange,
    hasVolume:typeof last.volume==="number"
  };
}
const subjectGuide=`אני מנתח שוק ההון בלבד: מניות, מדדים, קריפטו, מט"ח, תבניות טכניות, דוחות, נפח מסחר וניהול סיכונים. לניתוח גרף ספציפי צריך לטעון CSV של נרות OHLC; אני לא רואה את גרף TradingView מתוך המסגרת שלו.`;
export function answerStockQuestion(question, context=null) {
  const q=String(question||"").trim().toLowerCase();
  if (!q) return "שאל אותי על מגמה, פריצה, תמיכה, התנגדות, מחזור, ATR או ניתוח מלא של מניה.";
  if(includes(q,["מזג אוויר","מתכון","בדיחה","בישול","סרט","כדורגל","אהבה","football","recipe","weather"])) return "אני מתמחה בשוק ההון בלבד. אפשר לשאול על גרפים, מניות, מחזורים, אינדיקטורים, דוחות או ניהול סיכונים.";
  if(!context) {
    const prefix="אין עדיין נתוני גרף מחוברים. לא ניתן לקבוע מה קורה במניה רק מסימול או מהתצוגה של TradingView. העלה CSV עם Date, Open, High, Low, Close, Volume (לפחות 21 ימים; ל-MA150 דרושים 150 ימים).";
    if(includes(q,["מה זה atr","atr?","atr מה","atr14 מה"])) return "ATR14 מודד את טווח התנועה היומי הממוצע תוך התחשבות בפערים בין ימים. ATR אינו חוזה כיוון; משתמשים בו להערכת תנודתיות ומרחק סטופ.\n\n"+prefix;
    if(includes(q,["כוס וידית","cup and handle"])) return "כוס וידית היא תבנית אפשרית של בסיס מעוגל ותיקון קצר באזור השיא. נדרש מבנה מחיר, מחזור ואישור פריצה. בלי היסטוריית נרות לא ניתן לזהות אותה.\n\n"+prefix;
    if(includes(q,["דאבל בוטום","תחתית כפולה","double bottom"])) return "תחתית כפולה דורשת שתי נקודות שפל דומות, שיא ביניהן ופריצת קו הצוואר לאישור. אין להסיק שהמבנה קיים בלי נתוני גרף.\n\n"+prefix;
    if(includes(q,["סיכון","פוזיציה","סטופ"])) return "גודל פוזיציה = סכום כסף שמוכנים לסכן ÷ מרחק בין כניסה לסטופ. חשוב להביא בחשבון עמלות והחלקה.\n\n"+prefix;
    return subjectGuide+"\n"+prefix;
  }
  const c=context;
  const fromProvider=c.source==="Twelve Data";
  const isIntraday=!["1day","1week","1month"].includes(c.interval);
  const sourceText=fromProvider?"Twelve Data, נתונים שעשויים להיות מעוכבים":"קובץ CSV שהועלה";
  const timeframe=isIntraday?" (טווח "+c.interval+"; הממוצעים ופריצת 20 מתייחסים לנרות, לא לימים)":"";
  const title=`📈 ${c.symbol} | נר אחרון ${c.date} | ${c.bars} נרות | מקור: ${sourceText}${timeframe}`;
  const trend=`מגמה: סגירה ${fmt(c.close)}, MA20 ${fmt(c.sma20)} (${c.aboveMA20?"מעליו":"מתחתיו"}), MA150 ${fmt(c.sma150)} (${yes(c.aboveMA150)} מעליו).`;
  const levels=`רמות מחושבות: שפל 20 הנרות האחרונים ${fmt(c.rangeLow20)}; שיא 20 הנרות הקודמים ${fmt(c.priorHigh20)}; טווח 50 נרות ${fmt(c.rangeLow50)}–${fmt(c.rangeHigh50)}. אלה רמות היסטוריות, לא קווי תמיכה/התנגדות מאומתים.`;
  const breakout=`פריצה: סגירה מעל השיא של 20 הנרות הקודמים — ${yes(c.breakout20)}. ${c.breakout20?"צריך לבדוק המשכיות והאם הפריצה נשמרת.":"לא התקבלה פריצה לפי התנאי הזה."}`;
  const volume=`נפח מסחר: ${c.volumeRatio===null?"אין נתוני מחזור ל-20 הנרות הקודמים":fmt(c.volumeRatio)+"× ממוצע מחזור 20 הנרות הקודמים"}.`;
  const risk=`תנודתיות: ATR14 ${fmt(c.atr14)} (${c.atrPercent===null?"לא זמין":fmt(c.atrPercent)+"%"} מהמחיר). ATR מודד תנועה, לא את הכיוון שלה. הנר האחרון עשוי להיות חלקי.`;
  const daily=`יום המסחר האחרון: ${c.dailyChangePercent===null?"לא ניתן לחשב שינוי":fmt(c.dailyChangePercent)+"%"} לעומת הסגירה הקודמת; נר ${c.candleDirection}.`;
  const caution="⚠️ הנר האחרון עשוי להיות בתהליך היווצרות, ולכן מחזורו והאינדיקטורים עליו עשויים להשתנות. עדכניות הנתונים תלויה במקור ובזמן הנר האחרון. איני קורא את חלון TradingView ולא מאמת תבניות מורכבות מתמונת הגרף. כוס וידית, ראש וכתפיים ותחתית כפולה דורשות בדיקה נוספת.";
  if(includes(q,["דוח","earnings","רווחיות","חדשות","המלצות אנליסטים","forecast","תחזית אנליסטים","שווי שוק","market cap"])) return title+"\nאין לי כאן גישה לדוחות, חדשות או תחזיות בזמן אמת. המקור הנוכחי מספק נרות מחיר בלבד, ולכן לא אמציא מידע על דוחות או המלצות.\n"+trend+"\n"+caution;
  if(includes(q,["נפח","מחזור","ווליום","volume"])) return title+"\n"+volume+"\n"+breakout+"\n"+caution;
  if(includes(q,["תמיכה","התנגדות","רמות","support","resistance","סטופ","סיכון"])) return title+"\n"+levels+"\n"+risk+"\nלניהול סיכון, חשב את המרחק בין כניסה לסטופ ואת הכמות לפי גודל התיק. רמות אלה אינן המלצה להצבת הוראה.\n"+caution;
  if(includes(q,["פריצה","breakout","גבהים יורדים","cup","כוס","דאבל","תחתית כפולה","ראש וכתפיים","תבנית"])) return title+"\n"+breakout+"\n"+volume+"\n"+levels+"\n"+caution;
  if(includes(q,["atr","תנודתיות","וולאטיליות"])) return title+"\n"+risk+"\n"+daily+"\n"+caution;
  if(includes(q,["ממוצע","ma20","ma150","מגמה","trend"])) return title+"\n"+trend+"\n"+daily+"\n"+breakout+"\n"+caution;
  return [title,trend,daily,breakout,volume,risk,levels,caution].join("\n");
}
