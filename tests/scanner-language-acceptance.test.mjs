import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
const samples=[
 'הצג גרף','בחר שיחה',
 'החל הגדרות על הנרות שכבר נטענו. אין כאן פנייה לספק. תבנית אסף: מחיר מעל $5, מעל MA20, סגירה עולה במחזור מוגבר, תרחיש לונג עם יעד מדוד של לפחות 15% ומיון ATR. נדרש שווי שוק של מיליארד דולר לפחות; נתון חסר אינו עובר את התנאי. יעד מדוד אינו הבטחת תשואה.',
 'מצא לי מניות', '1 · מצא לי מניות','2 · תנאים עיקריים','מסננים מתקדמים',
 'סוף יום · חישוב בשרת','1 = המחזור הממוצע; 1.5 = פי אחד וחצי.',
 'לחץ על מצא לי מניות. נתוני המקור נשארים בשרת.',
 'נבדקו 0 מניות · יש לעדכן מסננים · מחקר על ימים שהסתיימו',
 'נבדקו 10 מניות · 3 התאמות · מחקר על ימים שהסתיימו',
 'בודק 1–10 מתוך 50…',
 'מאגר חיפוש: {total} מניות · עצירה אחרי 50 התאמות שונות.',
 'הסריקה נעצרה לאחר 50 התאמות שונות.',
 'החיפוש בנתונים הזמינים הסתיים; נמצאו פחות מ־50 התאמות.',
 'תוצאות נגזרות בלבד · Data provided by Twelve Data · ללא מחירי מקור או נתוני נרות להורדה.',
 'הסריקה הסתיימה: התקבלו 8 תוצאות נגזרות. החישוב בשרת; נפח יומי EOD, ללא מחירי מקור להורדה.',
 'ATR 4.5% · מחזור יחסי EOD 1.5× · בסיס 2026-11-17',
 '24 מתוך 2462 תוצאות בקטלוג','NASDAQ:AAPL · 1day · עד 2026-11-17'
];
for(const code of Object.keys(languageNames))test(`scanner screenshot regression / ${code}`,()=>{
 const catalog=code==='he'?{}:{...JSON.parse(readFileSync(new URL('../locales/'+code+'.json',import.meta.url))),...launchTranslations[code]};
 const tr=createTranslator(catalog);
 for(const source of samples){const translated=tr(source);if(code==='he')assert.equal(translated,source);else assert.doesNotMatch(translated,/[\u0590-\u05ff]/,`${code}: ${source} => ${translated}`)}
 assert.equal(tr('NASDAQ:NVDA 123.45'),'NASDAQ:NVDA 123.45');
});

test('both workspace entry points omit the provider CSV export, and terms forbid scraping and sharing',()=>{
 const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
 for(const entry of ['index.html','finlogix-trial.html'])assert.doesNotMatch(read(entry),/id="scanExport"/);
 assert.doesNotMatch(read('venture-scanner-ui.mjs'),/scanExport|asaf-analysis\.csv|text\/csv/);
 const terms=read('terms.html');
 assert.match(terms,/אין להשתמש בכלים אוטומטיים כדי לגרד/);
 assert.match(terms,/אין לשתף או להפיץ הלאה נתוני שוק או תוצאות סריקה/);
 assert.match(read('launch-translations.mjs'),/Do not scrape or automatically collect market data or screener results/);
 assert.match(read('launch-translations.mjs'),/Do not share or redistribute third-party market data or screener results/);
});
