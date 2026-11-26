import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {accessibilityStatementTranslations} from '../accessibility-statement-translations.mjs';
const root=new URL('../',import.meta.url),html=readFileSync(new URL('accessibility.html',root),'utf8');
const keys=Object.keys(accessibilityStatementTranslations.en);
test('accessibility statement separates local Canvas capabilities from server image limitations',()=>{
 assert.equal(keys.length,5);
 for(const key of keys)assert.ok(html.includes(key),key);
 assert.match(keys[0],/כאשר מופעל גרף Canvas מקומי/);
 assert.match(keys[0],/200/);
 assert.match(keys[1],/Twelve Data/);
 assert.match(keys[1],/אין במצב זה טבלת נרות מקוריים, זום או גלילה בתוך הגרף או ציור ידני/);
 assert.match(keys[3],/קיצורים אלה אינם פעילים בתמונת השרת/);
 assert.doesNotMatch(html,/הגרף מצויר ב־Canvas\./);
 assert.doesNotMatch(html,/כשהגרף ממוקד:/);
 assert.doesNotMatch(html,/לשם כך ניתן להשתמש בזום ובמסך מלא/);
 // Scope remains accurate to the implementation, without exposing raw provider data.
 const raster=readFileSync(new URL('venture-chart-view.mjs',root),'utf8');
 assert.match(raster,/panel.hidden=true/);
 assert.match(keys[1],/תמונה רחבה עם גלילה אופקית/);
});
for(const code of ['en','es','fr','de','pt','ru','ar','zh','ja'])test(`${code}: conditional chart accessibility claims are translated completely`,()=>{
 const catalog={...JSON.parse(readFileSync(new URL(`locales/${code}.json`,root),'utf8')),...launchTranslations[code]};
 const translate=createTranslator(catalog);
 for(const key of keys){
  const expected=accessibilityStatementTranslations[code][key];
  assert.ok(expected);assert.equal(translate(key),expected);assert.doesNotMatch(expected,/[\u0590-\u05ff]/u);
 }
 assert.match(translate(keys[0]),/Canvas/);assert.match(translate(keys[0]),/200/);
 assert.match(translate(keys[1]),/Twelve Data/);assert.match(translate(keys[3]),/Canvas/);assert.match(translate(keys[3]),/Twelve Data/);
});
test('Hebrew conditional statements remain unchanged',()=>{
 const translate=createTranslator({});for(const key of keys)assert.equal(translate(key),key);
});
