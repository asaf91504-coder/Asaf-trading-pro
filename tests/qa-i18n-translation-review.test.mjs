import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {languageNames, languageDirection, languageCode, createTranslator} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {qaI18nSource} from '../qa-i18n-translations.mjs';

const catalog = code => code==='he' ? {} : {...JSON.parse(readFileSync(new URL(`../locales/${code}.json`, import.meta.url))),...launchTranslations[code]};
const textGroups = {
 workspace: ['לא חובה','גרפים','סורק מניות','חדשות','סטאפים מאושרים'],
 trialDisclosure: qaI18nSource.slice(1,4),
 setupReview: qaI18nSource.slice(4),
 setupNavigation: ['סטאפים שעברו אישור.','חזרה לסורק ←','רענן תוצאות','טוען סטאפים…','התור שלך לאישור'],
 setupEmptyStates: ['אין מועמדים במצב שנבחר.','עדיין אין סטאפים מאושרים להצגה.'],
 setupDynamic: [
   '126 סטאפים',
   'אושר לפרסום: 2026-11-19',
   'נר אחרון: 2026-11-18 · סריקה: 2026-11-19',
   'סריקה אחרונה: — · הבאה: —',
   'סריקה אחרונה: 2026-11-18 · הבאה: 2026-11-19 · העדכון מתעכב',
   'סריקה אחרונה: 2026-11-18 · הבאה: 2026-11-19 · חלק מהנתונים אינם זמינים',
   'סריקה אחרונה: 2026-11-18 · הבאה: 2026-11-19 · העדכון מתעכב · חלק מהנתונים אינם זמינים',
 ],
};
for(const code of Object.keys(languageNames)){
 const translate = createTranslator(catalog(code));
 test(`locale QA ${code}: correct script direction and regional resolution`,()=>{
   assert.equal(languageDirection(code),['he','ar'].includes(code)?'rtl':'ltr');
   assert.equal(languageCode(code.toUpperCase()+'-ZZ'),code);
 });
 for(const [category,phrases] of Object.entries(textGroups)){
  test(`locale QA ${code}: ${category}`,()=>{
   for(const phrase of phrases){
    const actual=translate(phrase);
    assert.ok(actual.trim(),phrase);
    if(code==='he') assert.equal(actual,phrase);
    else{
     assert.doesNotMatch(actual,/\p{Script=Hebrew}/u,`${phrase}: ${actual}`);
     assert.doesNotMatch(actual,/\{[A-Za-z]+\}/u,actual);
     for(const match of phrase.matchAll(/2026-11-\d{2}|126|—/g)) assert.ok(actual.includes(match[0]),actual);
    }
   }
  });
 }
}
