import test from 'node:test';
import assert from 'node:assert/strict';
import {launchTranslations} from '../launch-translations.mjs';
import {languageNames} from '../interface-language.mjs';
test('new journal and search labels cover every non-Hebrew interface language',()=>{
 const languages=Object.keys(languageNames).filter(code=>code!=='he');
 assert.deepEqual(Object.keys(launchTranslations).sort(),languages.sort());
 const keys=Object.keys(launchTranslations.en).sort();
 for(const catalog of Object.values(launchTranslations)){
  assert.deepEqual(Object.keys(catalog).sort(),keys);
  for(const value of Object.values(catalog))assert.ok(typeof value==='string'&&value.trim());
 }
});
test('dynamic translation templates preserve every named value',()=>{
 const variables=s=>[...s.matchAll(/\{([A-Za-z]+)\}/g)].map(m=>m[1]).sort();
 for(const [code,catalog] of Object.entries(launchTranslations))for(const [key,value] of Object.entries(catalog))assert.deepEqual(variables(value),variables(key),`${code}: ${key}`);
});
