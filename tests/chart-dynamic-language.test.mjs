import test from 'node:test';
import assert from 'node:assert/strict';
import {createTranslator} from '../interface-language.mjs';
import {catalogAuditTranslations} from '../catalog-audit-translations.mjs';
const samples=[
 ['הגרף המקורי והצ׳אט מציגים כעת את אותם 240 נרות. אפשר לבקש בצ׳אט ניתוח וסימונים.',['240']],
 ['📡 קיבלתי 240 נרות של AAPL בטווח 1day. נר אחרון: 2026-11-17.',['240','AAPL','1day','2026-11-17']],
 ['נתוני AAPL נטענו מחדש מהלשונית הנוכחית, עד 2026-11-17.',['AAPL','2026-11-17']],
 ['נפתחה תמונת המחקר של AAPL. ניתוח וסימונים מחושבים בשרת.',['AAPL']],
 ['תמונת גרף מהשרת · AAPL · 1day · נר אחרון 2026-11-17 · EOD',['AAPL','1day','2026-11-17','EOD']],
 ['⚠️ נתוני AAPL אינם תואמים לגרף NVDA. בקש בצ׳אט לפתוח את המניה הרצויה.',['AAPL','NVDA']],
 ['⚠️ הנתונים שייכים לסימול AAPL שהוזן, אבל הגרף הנבחר הוא NVDA. הנתונים לא ישמשו לניתוח הסימול האחר.',['AAPL','NVDA']],
 ['הגרף של AAPL מוכן: 240 נרות בשרת · Twelve Data · 1day · נר אחרון: 2026-11-17.',['AAPL','240','Twelve Data','1day','2026-11-17']],
 ['נפתחה תמונת מחקר מהשרת עבור NVDA.',['NVDA']],
 ['נבחרה המניה NASDAQ:AAPL.',['NASDAQ:AAPL']],
 ['המניה הפעילה: MSFT.',['MSFT']],
 ['הופעל MA150.',['MA150']],
 ['הוסתר RSI14.',['RSI14']],
 ['נשמרה העדפה להצגת MA20; אין עדיין נרות להצגה.',['MA20']],
 ['נשמרה העדפה להסתרת EMA50; אין עדיין נרות להצגה.',['EMA50']],
 ['סגנון הגרף עודכן ל־candles.',['candles']],
 ['נשמרה העדפת סגנון heikin; אין עדיין נרות להצגה.',['heikin']],
 ['סומנו 3 סימוני מחקר על הגרף. תבניות הן מועמדות לבדיקה, לא אישור לפריצה או תחזית.',['3']],
 ['שירות ה-AI החזיר שגיאת חיבור (HTTP 503). השאלה נשמרה; אפשר לנסות שוב.',['503']],
 ['נתוני NVDA נטענו לגרף ולצ׳אט.',['NVDA']],
];
for(const [lang,catalog] of Object.entries(catalogAuditTranslations))test(`dynamic chart message translation / ${lang}`,()=>{
 const tr=createTranslator(catalog);
 for(const [source,values] of samples){const result=tr(source);assert.ok(!/[א-ת]/u.test(result),`${lang}: ${result}`);for(const value of values)assert.ok(result.includes(value),`${lang}: missing ${value}`)}
 for(const [key,value] of Object.entries(catalog)){assert.deepEqual([...key.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort(),[...value.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort(),`${lang}: ${key}`)}
});
