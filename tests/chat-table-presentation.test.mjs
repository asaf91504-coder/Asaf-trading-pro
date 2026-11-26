import test from 'node:test';
import assert from 'node:assert/strict';
import {chatAnswerText,readableChatTables} from '../chat-answer-presentation.mjs';

test('financial Markdown tables become labeled rows while preserving all prices, signs, percentages and conditions',()=>{
 const input='נתונים ל־25.11.2026:\n\n| תעודה | מחיר | שינוי | תמיכה | התנגדות |\n|---|---:|---:|---:|---:|\n| SPY | $716.76 | −0.28% | 715.65 | 718.18 |\n| QQQ | $633.81 | +0.67% | 631.15 | 634.89 |\n\nפריצה רק בסגירה מעל 718.18; שבירה מתחת ל־715.65 מבטלת את התרחיש.';
 const result=chatAnswerText(input);
 assert.equal(result,'נתונים ל־25.11.2026:\n\n- תעודה: SPY · מחיר: $716.76 · שינוי: −0.28% · תמיכה: 715.65 · התנגדות: 718.18\n- תעודה: QQQ · מחיר: $633.81 · שינוי: +0.67% · תמיכה: 631.15 · התנגדות: 634.89\n\nפריצה רק בסגירה מעל 718.18; שבירה מתחת ל־715.65 מבטלת את התרחיש.');
 assert.doesNotMatch(result,/\|---/);
});
test('tables without outer pipes and with escaped pipe characters keep the complete cell meaning',()=>{
 const source='Symbol | Condition\n:--- | ---:\nAMD | A \\| B, only below $402.10\n';
 assert.equal(readableChatTables(source),'- Symbol: AMD · Condition: A | B, only below $402.10\n');
});
test('malformed tables and literal examples are not rewritten or truncated',()=>{
 for(const source of ['| A | B |\n|---|---|\n| $10 | +2% | extra condition |','| A | B |\n|---|---|','A | B without a table divider','```text\n| A | B |\n|---|---|\n| $10 | +2% |\n```','~~~\nA | B\n--- | ---\n$10 | −2%\n~~~'])assert.equal(readableChatTables(source),source);
});
test('table cells remain plain text and output is stable when reopening a saved answer',()=>{
 const input='| Asset | Note |\n|---|---|\n| AMD | <img src=x onerror=alert(1)> & **conditional** |';
 const once=chatAnswerText(input);assert.equal(once,'- Asset: AMD · Note: <img src=x onerror=alert(1)> & **conditional**');assert.equal(chatAnswerText(once),once);
});
test('table conversion still removes citation appendices without removing preceding scenario conditions',()=>{
 const input='| Asset | Trigger |\n|---|---|\n| AMD | below 402.10 [1] |\nHold only while below 469.22.\n\nSources\n[1] example';
 assert.equal(chatAnswerText(input),'- Asset: AMD · Trigger: below 402.10\nHold only while below 469.22.');
});
