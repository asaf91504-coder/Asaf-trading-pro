import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {polishTranslations} from '../launch-polish-translations.mjs';
import {extraTranslations} from '../extra-translations.mjs';
import {createTranslator,languageNames} from '../interface-language.mjs';

const copy='7 ימי ניסיון עם 50 קרדיטים בסך הכול, ללא חידוש אוטומטי. רכישת מנוי כפופה לזמינות התשלום בחשבון שלך.';
for(const page of ['help','subscription'])test(page+' conditions checkout on account availability',()=>{
 const html=readFileSync(new URL('../'+page+'.html',import.meta.url),'utf8');
 assert.ok(html.includes(copy));
 assert.ok(!html.includes('אפשר לשדרג בכל עת'));
});
for(const lang of Object.keys(languageNames))test(lang+' retains localized checkout-availability copy without changing trial amount',()=>{
 const translate=createTranslator(polishTranslations[lang]);
 const localized=translate(copy);
 assert.match(localized,/50/);
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

test('trial offer and exhausted-credit UI respect localized policy and prior grants',async()=>{
 const {CREDIT_PLANS_NOTICE}=await import('../exhausted-credits-ui.mjs');
 const {launchTranslations}=await import('../launch-translations.mjs');
 const terms=readFileSync(new URL('../terms.html',import.meta.url),'utf8').match(/<p>([^<]+)<a href="\/subscription\.html">/)[1];
 const chat=readFileSync(new URL('../stock-chat-ui.mjs',import.meta.url),'utf8');
 assert.match(chat,/credits_exhausted'&&typeof data.error==='string'\?window\.asafTranslate/);
 for(const lang of Object.keys(languageNames)){
  const catalog=launchTranslations[lang]||{}, t=createTranslator(catalog);
  if(lang!=='he'){
   for(const source of [terms,CREDIT_PLANS_NOTICE,copy]) assert.ok(Object.hasOwn(catalog,source),lang+': missing key');
  }
  assert.match(t(terms),/50/,lang);
  assert.equal(t(terms).match(/55/g)?.length,1,lang+': $55 Starter must be the only remaining 55 in terms');
  assert.doesNotMatch(t(CREDIT_PLANS_NOTICE),/\b(?:30|50|55|100)\b/,lang+': generic dialog must not imply a personal balance');
  for(const limit of [30,50,55,100]){
   const localized=t(limit+' הקרדיטים החינמיים נוצלו. הם אינם מתחדשים. אפשר לשדרג למנוי.');
   assert.match(localized,new RegExp(String(limit)),lang);
   if(lang!=='he')assert.doesNotMatch(localized,/\p{Script=Hebrew}/u,lang);
  }
 }
});
