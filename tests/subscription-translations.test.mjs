import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launchTranslations} from '../launch-translations.mjs';
import {createTranslator} from '../interface-language.mjs';
import {subscriptionCopy} from '../subscription-copy.mjs';
test('all nine non-Hebrew languages translate every pricing-card text without mixed Hebrew',()=>{
 const html=readFileSync(new URL('../subscription.html',import.meta.url),'utf8');
 const cards=html.match(/<section class="plan-grid"[\s\S]*?<\/section>/)[0];
 const texts=[...cards.matchAll(/>([^<>]+)</g)].map(x=>x[1]).filter(x=>/[\u0590-\u05ff]/.test(x));
 for(const lang of ['en','es','ar','fr','de','pt','ru','zh','ja']){
  const catalog=JSON.parse(readFileSync(new URL('../locales/'+lang+'.json',import.meta.url),'utf8'));
  const tr=createTranslator({...catalog,...launchTranslations[lang]});
  for(const text of texts)assert.doesNotMatch(tr(text),/[\u0590-\u05ff]/,lang+': '+text);
  for(const key of ['summary','consent','checkout','balance'])assert.doesNotMatch(subscriptionCopy(lang,key,{price:115,credits:600,bonus:20,remaining:500,limit:600,date:'2026-11-23'}),/[{}\u0590-\u05ff]/);
 }
});
