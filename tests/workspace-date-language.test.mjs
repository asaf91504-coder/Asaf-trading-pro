import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const research=readFileSync(new URL('../research-workspace.mjs',import.meta.url),'utf8');
const news=readFileSync(new URL('../workspace-tools.mjs',import.meta.url),'utf8');
const date='2026-11-18T14:35:00Z';
const languages=['he','en','es','ar','fr','de','pt','ru','zh','ja'];
test('saved research timestamps use selected language in all ten interfaces',()=>{
 const expression=research.match(/new Date\(n.saved\)\.toLocaleString\([^;]+?\)(?=;)/)?.[0];
 assert.ok(expression,'timestamp expression exists');
 for(const lang of [...languages,'']){
  const actual=vm.runInNewContext(expression,{Date,n:{saved:date},document:{documentElement:{lang}}});
  assert.equal(actual,new Date(date).toLocaleString(lang||'he'),lang);
 }
});
test('news article timestamps use the same locale as news controls',()=>{
 const expression=news.match(/new Date\(item.publishedAt\)\.toLocaleString\(newsLanguage\(\)\)/)?.[0];
 assert.ok(expression,'timestamp expression exists');
 for(const lang of languages){
  const actual=vm.runInNewContext(expression,{Date,item:{publishedAt:date},newsLanguage:()=>lang});
  assert.equal(actual,new Date(date).toLocaleString(lang),lang);
 }
});
test('language events re-render saved research cards without hardcoded date locales',()=>{
 let handler;
 const registration=research.match(/window.addEventListener\('asaf:language',renderNotes\);/)[0];
 const renderNotes=()=>{};
 vm.runInNewContext(registration,{window:{addEventListener:(event,fn)=>{assert.equal(event,'asaf:language');handler=fn}},renderNotes});
 assert.equal(handler,renderNotes);
 assert.doesNotMatch(research,/toLocaleString\('he-IL'\)/);
 assert.doesNotMatch(news,/toLocaleString\('he-IL'\)/);
});
