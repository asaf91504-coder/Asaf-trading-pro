import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {extraTranslations} from '../extra-translations.mjs';
const messages=[
 'נגישות','נגישות ונוחות קריאה','ההעדפות נשמרות במכשיר זה. אפשר גם להשתמש בזום של הדפדפן.',
 'סגור הגדרות נגישות','סגור ✕','איפוס העדפות','הצהרת נגישות ודיווח על קושי',
 'טקסט מוגדל בממשק','ניגודיות גבוהה בממשק','הדגשת קישורים בקו תחתון',
 'הפחתת תנועה וגלילה מונפשת','ביטול קיצורי המקשים / ו־?',
 'ההעדפות נשמרו במכשיר.','ההעדפות הופעלו לביקור הנוכחי; הדפדפן אינו מאפשר שמירה.'
];
for(const code of ['en','es','fr','de','pt','ru','ar','zh','ja'])test(`${code}: accessibility dialog has no mixed Hebrew UI`,()=>{
 const base=JSON.parse(readFileSync(new URL(`../locales/${code}.json`,import.meta.url),'utf8'));
 const translate=createTranslator({...base,...launchTranslations[code]});
 for(const message of messages){
  const rendered=translate(message);
  assert.notEqual(rendered,message,message);
  assert.doesNotMatch(rendered,/[\u0590-\u05ff]/u,message);
 }
 for(const message of ['ההעדפות נשמרות במכשיר זה. אפשר גם להשתמש בזום של הדפדפן.','איפוס העדפות','הצהרת נגישות ודיווח על קושי','ההעדפות נשמרו במכשיר.']){
  assert.equal(translate(message),extraTranslations[code][message]);
  assert.equal(translate(' '+message+' '),' '+extraTranslations[code][message]+' ');
 }
});
test('Hebrew accessibility messages remain unchanged',()=>{
 const translate=createTranslator({});
 for(const message of messages)assert.equal(translate(message),message);
});
