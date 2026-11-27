import test from 'node:test';
import assert from 'node:assert/strict';
import {beginnerTranslations} from '../beginner-translations.mjs';
import {createTranslator} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {scannerStageText} from '../scanner-result-copy.mjs';
import {chartLoadState} from '../chart-load-state.mjs';

test('new beginner, coverage, stage and error messages translate in all secondary languages',()=>{
 for(const [lang,copy] of Object.entries(beginnerTranslations)){
  const tr=createTranslator(launchTranslations[lang]);
  for(const [key,value] of Object.entries(copy)){
   assert.equal(tr(key),value,lang+': '+key);assert.doesNotMatch(value,/[\u0590-\u05ff]/);
   assert.deepEqual(value.match(/\{\w+\}/g)||[],key.match(/\{\w+\}/g)||[]);
  }
 }
});
test('filter match and pending entry remain separate statements',()=>{
 assert.match(scannerStageText('waiting'),/טרם התקיים/);assert.match(scannerStageText('crossed'),/מותנה/);
 assert.match(scannerStageText('unknown'),/אין תרחיש/);
});
test('a selected stock with a quota failure has one explanation and a retry, while a valid chart survives refresh failure',()=>{
 const previous=globalThis.document;
 const heading={},description={},panel={hidden:true,children:[],querySelector:s=>s==='h2'?heading:s==='p'?description:panel.children[0]||null,append:node=>panel.children.push(node)};let clicks=0;
 globalThis.document={getElementById:id=>id==='chartEmpty'?panel:{click:()=>clicks++},createElement:()=>({dataset:{}})};
 try{
  chartLoadState({phase:'loading'});assert.match(heading.textContent,/נבחרה/);assert.equal(panel.hidden,false);
  chartLoadState({phase:'error',error:'מכסת הקרדיטים של ספק הנתונים אינה מספיקה לבקשה'});
  assert.match(heading.textContent,/מכסת/);assert.doesNotMatch(heading.textContent,/בחר מניה/);assert.match(description.textContent,/הסורק/);
  assert.equal(panel.children[0].hidden,false);panel.children[0].onclick();assert.equal(clicks,1);
  chartLoadState({phase:'ready',hasChart:true});assert.equal(panel.hidden,true);
  chartLoadState({phase:'error',error:'quota',hasChart:true});assert.equal(panel.hidden,true);assert.equal(panel.children[0].hidden,true);
 }finally{globalThis.document=previous;}
});
