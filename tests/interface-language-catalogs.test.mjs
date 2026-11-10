import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {languageNames,createTranslator} from '../interface-language.mjs';
test('every shipped language has complete matching UI keys and preserves chart quick actions',()=>{
 const english=JSON.parse(readFileSync(new URL('../locales/en.json',import.meta.url),'utf8'));
 assert.ok(Object.keys(english).length>1400);
 for(const code of Object.keys(languageNames).filter(code=>code!=='he')){
  const catalog=JSON.parse(readFileSync(new URL('../locales/'+code+'.json',import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(catalog).sort(),Object.keys(english).sort());
  for(const [key,value] of Object.entries(catalog)){assert.equal(typeof value,'string');assert.ok(value.trim(),`${code}: ${key}`)}
  const translate=createTranslator(catalog);
  for(const key of ['שלח','נתח את הגרף עם נקודת כניסה וסטופ־לוס','סמן תמיכות והתנגדויות'])assert.notEqual(translate(key),key,`${code}: ${key}`);
  assert.equal(translate('NASDAQ:NVDA 123.45'),'NASDAQ:NVDA 123.45');
 }
});
