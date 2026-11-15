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
