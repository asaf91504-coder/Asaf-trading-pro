import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {createTranslator} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('interface-language-ui.mjs',root),'utf8');
const original=source.match(/const originalTitle=document.title;/)?.[0];
const update=source.match(/document.title=translate\(originalTitle\);/)?.[0];
const pages=readdirSync(root).filter(f=>f.endsWith('.html')).map(file=>({file,html:readFileSync(new URL(file,root),'utf8')})).filter(p=>p.html.includes('interface-language-ui.mjs')).map(p=>({file:p.file,title:p.html.match(/<title>(.*?)<\/title>/)?.[1]}));
function translator(code){return createTranslator(code==='he'?{}:{...JSON.parse(readFileSync(new URL(`locales/${code}.json`,root),'utf8')),...launchTranslations[code]})}
for(const code of ['he','en','es','fr','de','pt','ru','ar','zh','ja'])test(`${code}: document titles follow the selected interface language`,()=>{
 assert.ok(original);assert.ok(update);
 for(const page of pages){
  const context=vm.createContext({document:{title:page.title},translate:translator(code)});
  vm.runInContext(original+update,context);
  assert.equal(context.document.title,translator(code)(page.title),page.file);
  if(code==='he')assert.equal(context.document.title,page.title,page.file);
  else assert.doesNotMatch(context.document.title,/[\u0590-\u05ff]/u,page.file);
 }
});
test('title switches use original source, preserve branding, and restore Hebrew',()=>{
 const expectations={
  'ASAF PRO | יומן מסחר':'ASAF PRO | Trading journal',
  'עזרה ויצירת קשר | ASAF Trading Pro':'Help and contact | ASAF Trading Pro',
  'מנוי | ASAF Pro':'Your subscription · ASAF Pro',
  'ASAF Trading Pro':'ASAF Trading Pro'
 };
 for(const [title,expected] of Object.entries(expectations)){
  const context=vm.createContext({document:{title},translate:translator('en')});vm.runInContext(original+update,context);
  assert.equal(context.document.title,expected);
  for(const code of ['ar','ja','he']){context.translate=translator(code);vm.runInContext(update,context)}
  assert.equal(context.document.title,title);
 }
});
test('title only updates after the latest language request has a valid catalog',()=>{
 const guard=source.indexOf('if(request!==revision)return;');
 const compile=source.indexOf('translate=createTranslator(catalog);',guard);
 const title=source.indexOf(update,compile);
 assert.ok(guard>=0&&compile>guard&&title>compile);
 assert.ok(source.indexOf(original)<source.indexOf('async function applyLanguage'));
});
