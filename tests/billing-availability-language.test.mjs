import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {polishTranslations} from '../launch-polish-translations.mjs';
import {extraTranslations} from '../extra-translations.mjs';
import {createTranslator,languageNames} from '../interface-language.mjs';

const copy='7 ימי ניסיון עם 55 קרדיטים בסך הכול, ללא חידוש אוטומטי. רכישת מנוי כפופה לזמינות התשלום בחשבון שלך.';
for(const page of ['help','subscription'])test(page+' conditions checkout on account availability',()=>{
 const html=readFileSync(new URL('../'+page+'.html',import.meta.url),'utf8');
 assert.ok(html.includes(copy));
 assert.ok(!html.includes('אפשר לשדרג בכל עת'));
});
for(const lang of Object.keys(languageNames))test(lang+' retains localized checkout-availability copy without changing trial amount',()=>{
 const translate=createTranslator(polishTranslations[lang]);
 const localized=translate(copy);
 assert.match(localized,/55/);
 if(lang!=='he'){
  assert.ok(polishTranslations[lang][copy]);
  assert.doesNotMatch(localized,/[\u0590-\u05ff]/u);
 }
});
test('English terms preserve separation between explanatory text and subscription link',()=>{
 const html=readFileSync(new URL('../terms.html',import.meta.url),'utf8');
 const match=html.match(/<p>([^<]+)<a href="\/subscription\.html">([^<]+)<\/a>/);
 assert.ok(match);
 const translate=createTranslator(extraTranslations.en);
 assert.match(translate(match[1])+translate(match[2]),/appear on the subscription page$/);
});
