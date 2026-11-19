import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launchTranslations} from '../launch-translations.mjs';
import {createTranslator} from '../interface-language.mjs';
const html=readFileSync(new URL('../journal.html',import.meta.url),'utf8');
test('journal backup is a native collapsed disclosure before the primary entry form',()=>{
 assert.match(html,/<details><summary>גיבוי וסנכרון יומן<\/summary><div id="journalSync"><\/div><\/details>/);
 assert.equal((html.match(/id="journalSync"/g)||[]).length,1);
 assert.ok(html.indexOf('id="journalSync"')<html.indexOf('id="form"'));
 assert.match(html,/\.journal-backup summary\{[^}]*min-height:44px/);
});
test('journal backup disclosure label translates in all supported secondary languages',()=>{
 for(const [code,catalog] of Object.entries(launchTranslations)){
  const base=JSON.parse(readFileSync(new URL(`../locales/${code}.json`,import.meta.url),'utf8'));
  assert.doesNotMatch(createTranslator({...base,...catalog})('גיבוי וסנכרון יומן'),/[\u0590-\u05ff]/u,code);
 }
});
