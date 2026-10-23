import test from 'node:test';
import assert from 'node:assert/strict';
import {personalData,tradeProfit,mergePersonal,personalBackup,parsePersonalBackup} from '../personal-data.mjs';
const trade=(id='trade-1')=>({id,symbol:'NVDA',date:'2026-10-23',side:'long',entry:100,exit:110,qty:10,fees:2,setup:'פריצה',quality:'A',note:'בדיקה'});
test('journal keeps IDs and net long/short arithmetic through a backup round trip',()=>{
 const t=trade();assert.equal(tradeProfit(t),98);assert.equal(tradeProfit({...t,side:'short',entry:110,exit:100}),98);
 assert.deepEqual(parsePersonalBackup(JSON.stringify(personalBackup('journal',[t])),'journal'),[t]);
 assert.equal(personalData('journal',[{...t,admin:true}])[0].admin,undefined);
});
test('journal rejects invalid calendars, duplicate IDs, numeric strings and unbounded records',()=>{
 for(const patch of [{date:'2026-02-30'},{side:'wrong'},{fees:-1},{qty:Infinity},{entry:'100'},{quality:'D'},{note:'x'.repeat(1001)}])assert.throws(()=>personalData('journal',[{...trade(),...patch}]));
 assert.throws(()=>personalData('journal',[trade(),trade()]));assert.throws(()=>personalData('journal',Array.from({length:301},(_,i)=>trade('id-'+i))));
});
test('merge has explicit remote priority and refuses to silently drop entries at the limit',()=>{
 const local=[trade(),trade('local')],remote=[{...trade(),note:'remote'},trade('remote')],before=JSON.stringify(local);
 const merged=mergePersonal('journal',local,remote);assert.equal(merged.length,3);assert.equal(merged[0].note,'remote');assert.equal(JSON.stringify(local),before);
 assert.throws(()=>mergePersonal('journal',Array.from({length:300},(_,i)=>trade('id-'+i)),[trade('extra')]));
});
test('research only stores bounded links with safe protocols and no embedded credentials',()=>{
 const item={id:'r1',title:'דוח',symbol:'AAPL',note:'הערות',saved:'2026-10-23T00:00:00Z',url:'https://example.com/report'};
 assert.deepEqual(personalData('research',[item]),[item]);for(const url of ['javascript:alert(1)','https://secret:key@example.com/','data:text/html,test'])assert.throws(()=>personalData('research',[{...item,url}]));
});
test('preferences only admit implemented styles and boolean indicator switches',()=>{
 assert.deepEqual(personalData('chartPreferences',{style:'line',chartMACD:true,admin:true}),{style:'line',chartMACD:true});
 assert.throws(()=>personalData('chartPreferences',{chartMACD:'false'}));assert.throws(()=>personalData('chartPreferences',{style:'fake'}));
});
test('drawings retain date anchors, merge per symbol and reject bad prices and excessive symbols',()=>{
 const a={savedAt:1,lines:[[{date:'2025-01-01',price:100},{date:'2025-01-02',price:102}]]},b={savedAt:2,lines:[]};
 assert.deepEqual(mergePersonal('drawings',{AAPL:a,NVDA:a},{AAPL:b}),{AAPL:b,NVDA:a});
 assert.throws(()=>personalData('drawings',{AAPL:{...a,lines:[[{date:'2025-01-01',price:-10},{date:'2025-01-02',price:102}]]}}));
 assert.throws(()=>personalData('drawings',Object.fromEntries(Array.from({length:31},(_,i)=>['S'+i,a]))));
});
test('backup type and UTF-8 byte boundaries reject incompatible or oversized imports',()=>{
 assert.throws(()=>parsePersonalBackup(JSON.stringify(personalBackup('journal',[trade()])),'research'));
 assert.throws(()=>parsePersonalBackup('א'.repeat(400000),'journal'));
 assert.throws(()=>personalData('__proto__',{}));
});
