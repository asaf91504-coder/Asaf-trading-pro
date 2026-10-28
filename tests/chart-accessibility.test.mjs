import test from 'node:test';
import assert from 'node:assert/strict';
import {chartAccessibleLabel} from '../local-chart.mjs';

const bars=[
 {date:'2026-10-23',open:100,high:105,low:98,close:104,volume:1000},
 {date:'2026-10-26',open:104,high:110,low:103,close:109,volume:2000},
 {date:'2026-10-27',open:109,high:112,low:105,close:106,volume:3000}
];
test('description names selected indicators without claiming unchecked indicators are shown',()=>{
 const description=chartAccessibleLabel({symbol:'AAPL',bars,style:'line',indicators:['MA20','VolumeProfile']});
 assert.match(description,/AAPL/);assert.match(description,/תצוגה: קו/);
 assert.match(description,/MA20, פרופיל מחזור משוער/);assert.doesNotMatch(description,/RSI14|MACD|MA150/);
 assert.match(description,/רק כשיש מספיק נתונים/);assert.match(description,/אינם מובטחים בזמן אמת/);
});
test('historical viewport describes visible raw candle rather than latest loaded candle',()=>{
 const description=chartAccessibleLabel({bars,start:0,end:2,style:'heikin',indicators:[]});
 assert.match(description,/2 נרות מוצגים מתוך 3/);assert.match(description,/2026-10-23 עד 2026-10-26/);
 assert.doesNotMatch(description,/2026-10-27/);assert.match(description,/סגירה 109, מחזור 2,000/);
 assert.match(description,/Heikin Ashi — מחירים ממוצעים/);assert.match(description,/נתוני הנר המקורי/);
 assert.match(description,/לתצוגה: ללא/);
});
test('missing OHLC or volume stays explicitly unavailable, never zero',()=>{
 const description=chartAccessibleLabel({bars:[{date:'2026-10-27',open:null,high:112,low:105,close:106}]});
 assert.match(description,/פתיחה לא זמין/);assert.match(description,/מחזור לא זמין/);
});
test('empty and cleared chart has no stale symbol, price or indicator description',()=>{
 assert.equal(chartAccessibleLabel(), 'גרף מקורי. לא נטענו נתונים.');
 assert.equal(chartAccessibleLabel({symbol:'AAPL',indicators:['RSI14']}),'גרף מקורי. לא נטענו נתונים.');
});
