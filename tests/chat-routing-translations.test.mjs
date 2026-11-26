import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {chatRoutingTranslations} from '../chat-routing-translations.mjs';

for(const code of Object.keys(languageNames).filter(code=>code!=='he')){
 test(`${code}: new chat routing states translate as complete messages and preserve the requested ticker`,()=>{
  const catalog={...JSON.parse(readFileSync(new URL(`../locales/${code}.json`,import.meta.url),'utf8')),...launchTranslations[code]};
  const translate=createTranslator(catalog),messages=chatRoutingTranslations[code];
  assert.equal(Object.keys(messages).length,11);
  assert.ok(Object.hasOwn(messages,'הבקשה כוללת מסננים שעדיין אינם נתמכים בצ׳אט. אפשר להגדיר אותם בסורק המניות.'));
  for(const [source,expected] of Object.entries(messages)){
   const input=source.replace('{symbol}','NASDAQ:TSLA'),actual=translate(input);
   assert.equal(actual,expected.replace('{symbol}','NASDAQ:TSLA'));
   assert.doesNotMatch(actual,/[\u0590-\u05ff]/u,source);
   if(source.includes('{symbol}'))assert.match(actual,/NASDAQ:TSLA/);
   if(source.startsWith('ניתוח נתוני '))assert.equal(translate('⚠️ '+source),'⚠️ '+expected);
  }
 });
}
test('Hebrew chat routing copy stays unchanged in the source locale',()=>{
 const source='לא התקבלו נתונים למניה שהתבקשה; לא ייעשה שימוש בנתוני המניה הקודמת.';
 assert.equal(createTranslator()(source),source);
});
