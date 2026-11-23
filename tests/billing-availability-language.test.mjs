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
  for(const amount of [22,30,46,145])assert.ok(t(terms).includes(String(amount)),lang);
  assert.doesNotMatch(t(terms),/\b(?:55|75|115|359)\b/,lang+': terms still advertise old prices');
  assert.doesNotMatch(t(CREDIT_PLANS_NOTICE),/\b(?:30|50|55|100)\b/,lang+': generic dialog must not imply a personal balance');
  for(const limit of [30,50,55,100]){
   const localized=t(limit+' הקרדיטים החינמיים נוצלו. הם אינם מתחדשים. אפשר לשדרג למנוי.');
   assert.match(localized,new RegExp(String(limit)),lang);
   if(lang!=='he')assert.doesNotMatch(localized,/\p{Script=Hebrew}/u,lang);
  }
 }
});

test('the exhausted-credit dialog exposes canonical labels and retains plan figures in every interface language',async()=>{
 const {showCreditPlans}=await import('../exhausted-credits-ui.mjs');
 const {launchTranslations}=await import('../launch-translations.mjs');
 const node=tag=>({tag,children:[],style:{},append(...children){this.children.push(...children)},addEventListener(){},setAttribute(key,value){this[key]=value},showModal(){}});
 const previous=globalThis.document;
 try{
  globalThis.document={documentElement:{lang:'ar'},getElementById:()=>null,createElement:node,body:node('body')};
  showCreditPlans();
  const [dialog]=document.body.children;
  const [head,notice,...rest]=dialog.children,close=rest.pop();
  assert.equal(dialog['aria-labelledby'],head.id);
  assert.equal(head.textContent,'בחר מסלול להמשך השימוש');assert.equal(close.textContent,'חזרה לשיחה');
  const labels=[head.textContent,notice.textContent,close.textContent];
  for(const [i,[id,price,amount]] of [['starter',22,150],['plus',30,300],['pro',46,600],['premium',145,2500]].entries()){
   const a=rest[i], [quoted,,interval,,allowance,,period]=a.children;
   assert.equal(a.href,'/subscription.html?plan='+id+'#billingAccount');
   assert.equal(quoted.textContent,id.toUpperCase()+' · $'+price);
   assert.equal(allowance.textContent,String(amount));
   labels.push(interval.textContent,period.textContent);
  }
  for(const lang of Object.keys(languageNames).filter(l=>l!=='he')){
   const phrases=createTranslator(launchTranslations[lang]);
   for(const label of labels)assert.doesNotMatch(phrases(label),/\p{Script=Hebrew}/u,lang+': '+label);
   if(lang!=='en')assert.notEqual(phrases(head.textContent),'Choose a plan to continue',lang);
  }
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
});
