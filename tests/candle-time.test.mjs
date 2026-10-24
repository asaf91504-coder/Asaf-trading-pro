import test from 'node:test';
import assert from 'node:assert/strict';
import {validCandleTime} from '../candle-time.mjs';
import {parseCSV} from '../analyzer.mjs';
import {validateBar} from '../netlify/functions/market.mjs';
import {personalData} from '../personal-data.mjs';

test('candle timestamps validate actual calendar days and clock boundaries',()=>{
 for(const v of ['2000-02-29','2024-02-29','2025-12-31 23:59:59','2025-01-01T00:00'])assert.equal(validCandleTime(v),true,v);
 for(const v of ['1900-02-29','2100-02-29','2025-02-30','2025-13-01','2025-01-00','2025-01-01 24:00','2025-01-01 12:60','2025-01-01 12:00:60',null,{},'2025-01-01T00:00:00Z'])assert.equal(validCandleTime(v),false,String(v));
});
test('CSV drops impossible calendar dates before offset conversion without rolling into another day',()=>{
 const dates=['2025-02-30','2025/02/29','2025-02-30T12:00:00+03:00','2025-01-01 24:00','2024-02-29','2025-01-01T12:00:00+03:00'];
 const bars=parseCSV('Date,Open,High,Low,Close\n'+dates.map(d=>`${d},10,12,9,11`).join('\n'));
 assert.deepEqual(bars.map(b=>b.date),['2024-02-29','2025-01-01 09:00:00']);
});
test('provider normalization rejects impossible timestamps and malformed rows',()=>{
 const bar={open:10,high:12,low:9,close:11,datetime:'2024-02-29'};assert.ok(validateBar(bar));
 for(const datetime of ['2025-02-29','2025-01-01 25:00:00'])assert.equal(validateBar({...bar,datetime}),null);
 assert.equal(validateBar(null),null);
});
test('drawing backups reject impossible calendar anchors',()=>{
 const drawing=date=>({'QA.TEST':{savedAt:1,lines:[[{date,price:10},{date:'2025-03-01',price:11}]]}});
 assert.throws(()=>personalData('drawings',drawing('2025-02-30')));
 assert.ok(personalData('drawings',drawing('2024-02-29')));
});
