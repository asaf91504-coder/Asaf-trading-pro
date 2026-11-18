import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
const pages=['index.html','subscription.html','journal.html','help.html','terms.html','data-privacy.html','accessibility.html','support.html','support-received.html','setups.html','setup.html','analyzer.html','offline.html','mobile-connect.html','activate.html'];
function texts(page){return readFileSync(new URL('../'+page,import.meta.url),'utf8').replace(/<head\b[\s\S]*?<\/head>/gi,'').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,'').split(/<[^>]*>/).map(s=>s.replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim()).filter(s=>/[\u0590-\u05ff]/.test(s))}
for(const code of Object.keys(languageNames).filter(c=>c!=='he'))test(`full static page coverage / ${code}`,()=>{
 const tr=createTranslator({...JSON.parse(readFileSync(new URL('../locales/'+code+'.json',import.meta.url))),...launchTranslations[code]});
 const missing=[];for(const page of pages)for(const source of texts(page))if(/[\u0590-\u05ff]/.test(tr(source)))missing.push(page+': '+source.slice(0,100));
 assert.deepEqual(missing,[]);
});
