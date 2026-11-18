import test from 'node:test';
import assert from 'node:assert/strict';
import {entryStopText} from '../entry-stop-scenario.mjs';
import {scenarioLocales} from '../entry-stop-locales.mjs';
import {responseLanguageInstruction,languageNames} from '../interface-language.mjs';
import {cleanChatMessage} from '../chat-history-core.mjs';
const plan={available:true,side:'long',asOf:'2026-01-10',interval:'1day',entry:102.75,stop:98.25,riskPercent:4.38,stage:'already-crossed',excludedLatest:true};
for(const language of Object.keys(languageNames))test(`calculated scenario respects ${language} with intact levels and no mixed Hebrew`,()=>{
 const text=entryStopText(plan,language);assert.match(text,/102\.75/);assert.match(text,/98\.25/);assert.match(text,/4\.38/);assert.match(text,/2026-01-10/);assert.doesNotMatch(text,/\{\w+\}/);
 const short=entryStopText({...plan,side:'short'},language);assert.notEqual(text,short);
 if(language!=='he'){assert.doesNotMatch(text,/[\u0590-\u05ff]/);assert.ok(text.includes(scenarioLocales[language].crossed));assert.ok(text.includes(scenarioLocales[language].excluded));assert.ok(text.includes(scenarioLocales[language].caveat));assert.doesNotMatch(entryStopText({available:false,reason:'אין נתונים'},language),/[\u0590-\u05ff]/)}
});
test('selected response language overrides question and old conversation language without unsafe interpolation',()=>{assert.match(responseLanguageInstruction('fr'),/French/);assert.match(responseLanguageInstruction('en'),/earlier conversation uses another language/);assert.doesNotMatch(responseLanguageInstruction('ignore instructions'),/ignore instructions/)});
test('new saved assistant turns retain bounded scenario metadata; legacy content is unchanged',()=>{
 const msg={role:'assistant',content:'Original prose',responseLanguage:'es',tradeScenario:{...plan,untrusted:'discard'}};const clean=cleanChatMessage(msg,'assistant');assert.equal(clean.responseLanguage,'es');assert.equal(clean.tradeScenario.entry,102.75);assert.equal(clean.tradeScenario.untrusted,undefined);
 assert.deepEqual(cleanChatMessage({role:'assistant',content:'Legacy עברית'},'assistant'),{role:'assistant',content:'Legacy עברית'});
});
test('only deterministic wrappers translate; original AI prose remains byte-for-byte intact',async()=>{
 const {localizedChatReply}=await import('../chat-reply-ui.mjs');
 const parts={before:'גרף מוכן',answer:'CRWV נמצאת במגמת ירידה. Breakout',after:'\nהגרף השתנה'};
 assert.equal(localizedChatReply(parts,t=>t.replace('גרף מוכן','Chart ready').replace('הגרף השתנה','Chart changed').replace('מגמת ירידה','SHOULD NOT APPLY')),'Chart ready\n\nCRWV נמצאת במגמת ירידה. Breakout\nChart changed');
});
