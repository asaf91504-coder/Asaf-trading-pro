import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeChartTools} from '../chart-analysis-tools.mjs';
import {createTranslator,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {localizedChatReply} from '../chat-reply-ui.mjs';
import {cleanChatMessage} from '../chat-history-core.mjs';
const bars=Array.from({length:40},(_,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:100,high:105+Math.sin(i)*3,low:95+Math.sin(i)*3,close:100,volume:1000}));
const result=analyzeChartTools({bars,kind:'supportResistance'});
assert.equal(result.annotations.length,2);
const receipt=['תמונת המחקר עודכנה בשרת.',result.summary,...result.limitations,'הופעל MA20.','הופעל MA150.','סומנו 2 סימוני מחקר על הגרף. תבניות הן מועמדות לבדיקה, לא אישור לפריצה או תחזית.'].join('\n');
for(const language of Object.keys(languageNames))test('real generated multiline tool receipt / '+language,()=>{
 const catalog=language==='he'?{}:{...JSON.parse(readFileSync(new URL('../locales/'+language+'.json',import.meta.url))),...launchTranslations[language]};
 const tr=createTranslator(catalog),translated=tr(receipt);
 if(language==='he')assert.equal(translated,receipt);else assert.doesNotMatch(translated,/[\u0590-\u05ff]/);
 assert.equal(translated.split('\n').length,receipt.split('\n').length);
 assert.ok(translated.includes('MA20'));assert.ok(translated.includes('MA150'));assert.ok(translated.includes('2'));
 assert.equal(tr(receipt.replaceAll('\n','\r\n')),translated.replaceAll('\n','\r\n'));
 assert.equal(localizedChatReply({before:receipt,answer:'Untouched model prose בעברית'},tr),translated+'\n\nUntouched model prose בעברית');
});
test('only explicitly typed deterministic receipts opt into saved-history translation',()=>{
 assert.equal(cleanChatMessage({role:'assistant',content:receipt,uiReceipt:true},'assistant').uiReceipt,true);
 assert.equal(cleanChatMessage({role:'assistant',content:receipt},'assistant').uiReceipt,undefined);
 assert.equal(cleanChatMessage({role:'assistant',content:'Model prose',uiReceipt:'true'},'assistant').uiReceipt,undefined);
});
test('whole multiline catalog entries retain priority and unknown content remains intact',()=>{
 const tr=createTranslator({'line one\nline two':'complete translation','יש {count} תוצאות':'Found {count} results'});
 assert.equal(tr('line one\nline two'),'complete translation');
 assert.equal(tr('יש 2 תוצאות\n\nUnknown $5'),'Found 2 results\n\nUnknown $5');
});
