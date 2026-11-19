import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {languageNames,createTranslator} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('index.html');
const label='סטאפים מאושרים';

test('approved setups is an ordinary standalone link above workspace tabs, not hidden in settings',()=>{
 const start=html.indexOf('<main');
 const link=html.match(/<a class="workspace-setups-link" href="\/setups\.html"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg><span>([^<]+)<\/span><\/a>/);
 assert.ok(link);
 assert.equal(link[1],label);
 assert.ok(start<link.index&&link.index<html.indexOf('<div class="tabs">'));
 assert.equal((html.match(/href="\/setups\.html"/g)||[]).length,1);
 assert.doesNotMatch(read('display-polish.mjs'),/setups/);
});

test('approved setups link localizes in all ten languages',()=>{
 for(const code of Object.keys(languageNames)){
  const catalog=code==='he'?{}:JSON.parse(read('locales/'+code+'.json'));
  const localized=createTranslator({...catalog,...launchTranslations[code]})(label);
  assert.ok(localized);
  if(code!=='he')assert.doesNotMatch(localized,/[\u0590-\u05ff]/,code);
 }
});

test('setups has a 48px target and wraps as a full-width link on narrow screens',()=>{
 const css=read('display-polish.css');
 assert.match(css,/\.workspace-setups-link\{[^}]*min-block-size:48px/);
 assert.match(css,/\.workspace-setups-link span\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/@media\(max-width:600px\)\{\.terminal-app \.workspace-setups-link\{[^}]*inline-size:100%/);
});
