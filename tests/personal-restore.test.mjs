import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePersonalRestore,completePersonalRestore} from '../personal-restore.mjs';
import {personalBackup} from '../personal-data.mjs';
const trade=(id,note='local')=>({id,symbol:'QA.RESTORE',date:'2026-10-24',side:'long',entry:100,exit:112,qty:10,fees:2,setup:'בדיקה',quality:'A',note});
const encoded=(section,value)=>JSON.stringify(personalBackup(section,value));
test('restore preview counts overlapping records and preserves local-only rows with backup priority',()=>{
 const local=[trade('a'),trade('local')],before=JSON.stringify(local),text=encoded('journal',[trade('a','backup'),trade('remote')]),plan=preparePersonalRestore('journal',local,text);
 assert.deepEqual(plan.counts,{current:2,incoming:2,merged:3,overlapping:1});assert.equal(JSON.stringify(local),before);
 const result=completePersonalRestore(plan,'journal',local,text);assert.equal(result.find(x=>x.id==='a').note,'backup');assert.ok(result.some(x=>x.id==='local'));
});
test('re-importing the same journal backup does not duplicate trade IDs',()=>{
 const text=encoded('journal',[trade('a')]),first=preparePersonalRestore('journal',[],text),restored=completePersonalRestore(first,'journal',[],text),second=preparePersonalRestore('journal',restored,text);
 assert.equal(second.counts.merged,1);assert.equal(second.counts.overlapping,1);assert.deepEqual(completePersonalRestore(second,'journal',restored,text),restored);
});
test('changes to local records, pasted text or chosen section invalidate a preview',()=>{
 const local=[trade('a')],text=encoded('journal',[trade('b')]),plan=preparePersonalRestore('journal',local,text);
 assert.throws(()=>completePersonalRestore(plan,'journal',[trade('a','changed')],text));assert.throws(()=>completePersonalRestore(plan,'journal',local,text+' '));assert.throws(()=>completePersonalRestore(plan,'research',[],text));assert.throws(()=>completePersonalRestore(null,'journal',local,text));
});
test('malformed, wrong-type and oversized backups fail without mutating local data',()=>{
 const local=[trade('a')],before=JSON.stringify(local);for(const text of ['{',encoded('research',[]),'א'.repeat(400000),JSON.stringify({kind:'asaf-personal',version:1,section:'journal',data:[trade('b'),trade('b')]})])assert.throws(()=>preparePersonalRestore('journal',local,text));assert.equal(JSON.stringify(local),before);
});
test('drawing and preference previews merge at their documented symbol and preference-key boundaries',()=>{
 const local={AAPL:{savedAt:1,lines:[]}},incoming={AAPL:{savedAt:2,lines:[]},NVDA:{savedAt:2,lines:[]}},text=encoded('drawings',incoming),plan=preparePersonalRestore('drawings',local,text);
 assert.deepEqual(plan.counts,{current:1,incoming:2,merged:2,overlapping:1});assert.deepEqual(completePersonalRestore(plan,'drawings',local,text),incoming);
 const preferences=preparePersonalRestore('chartPreferences',{style:'line',chartRSI14:true},encoded('chartPreferences',{style:'candles'}));assert.deepEqual(preferences.data,{style:'candles',chartRSI14:true});
});
