import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
const html=readFileSync(new URL('../subscription.html',import.meta.url),'utf8');
for(const code of Object.keys(languageNames))test(`${code}: trial shortcut label preserves actual duration`,()=>{
 const base=code==='he'?{}:JSON.parse(readFileSync(new URL(`../locales/${code}.json`,import.meta.url),'utf8'));
 const t=createTranslator({...base,...launchTranslations[code]});
 const buttons=[...html.matchAll(/data-trial-days="(\d+)">([^<]+)<\/button>/g)];
 assert.equal(buttons.length,4);
 for(const [,days,label] of buttons){assert.equal(label.match(/\d+/)?.[0],days);assert.equal(t(label).match(/\d+/)?.[0],days);}
});
