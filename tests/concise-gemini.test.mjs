import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requestsDetailedAnswer,responseDepthPolicy} from '../chat-request-intent.mjs';
import {entryStopScenario,entryStopText,compactEntryStopText,withoutScenarioText} from '../entry-stop-scenario.mjs';
import {retrieveMichaKnowledge,withMichaKnowledge,MICHA_KNOWLEDGE_INFO,GEMINI_STUDY_NOTES_INFO} from '../server/micha-knowledge.mjs';
const notes=JSON.parse(readFileSync(new URL('../server/knowledge/gemini-study-notes.json',import.meta.url)));

test('answers are brief by default, including follow-ups, and explicit depth can be requested',()=>{
 for(const q of ['תנתח לי את CRWV','מה זה ATR?','למה?','Give a short answer','אל תפרט','תסביר בקצרה','Explain without detail']){
  assert.equal(requestsDetailedAnswer(q),false,q);assert.match(responseDepthPolicy(q),/RESPONSE DEPTH: BRIEF/);
 }
 for(const q of ['תסביר בהרחבה','אני רוצה ניתוח מעמיק','תפרט את החישוב','Explain in detail','Give an in-depth review','اشرح بالتفصيل','详细解释']){
  assert.equal(requestsDetailedAnswer(q),true,q);assert.match(responseDepthPolicy(q),/default word and bullet limits do not apply/);
 }
 for(const q of ['מה זה ATR?','תסביר ATR בהרחבה']){
  const prompt=withMichaKnowledge([{role:'system',content:'base'},{role:'user',content:q}],q);
  assert.ok(prompt[0].content.endsWith(responseDepthPolicy(q)));
 }
});

test('new external notes are retrievable while review counts and provenance remain accurate',()=>{
 assert.equal(notes.records.length,5);assert.equal(notes.newVideoReviews,0);
 assert.equal(GEMINI_STUDY_NOTES_INFO.topics,5);assert.equal(MICHA_KNOWLEDGE_INFO.sources,286);assert.equal(MICHA_KNOWLEDGE_INFO.academy,118);
 for(const r of notes.records){
  const text=retrieveMichaKnowledge(r.id);assert.match(text,new RegExp(r.id));
  const record=text.trim().split('\n').slice(1).map(x=>JSON.parse(x)).find(x=>x.id===r.id);
  assert.equal(record.reviewType,'user_provided_external_summary');assert.equal(record.coverage.fullVideoReviewed,false);assert.equal(record.coverage.transcriptRange,null);assert.deepEqual(record.timestamps,[]);
  assert.ok(Buffer.byteLength(text)<=7000);assert.doesNotMatch(text,/youtube\.com|\bmicha\b|(?<![\p{L}])מיכה(?![\p{L}])/iu);
 }
});

test('brief response style survives when a large chart leaves no room for study notes',()=>{
 const prompt=withMichaKnowledge([{role:'system',content:'base'},{role:'user',content:'x'.repeat(44000)}],'נתח את הגרף');
 assert.match(prompt[0].content,/at most25 words/);assert.match(prompt[0].content,/RESPONSE DEPTH: BRIEF/);
 assert.doesNotMatch(prompt.at(-1).content,/ASAF_EDUCATIONAL_NOTES/);
 assert.ok(prompt.reduce((n,m)=>n+Buffer.byteLength(m.content),0)<=48000);
});

for(const [q,id] of [
 ['מה הסיכון בתלות באיש מפתח?','fomo-key-person'],
 ['איך מחזורי קריפטו מושפעים מנזילות ורגולציה?','crypto-cycles'],
 ['מה ההבדל בין ממוצע של 50 שבועות לממוצע יומי?','moving-average-timeframe'],
 ['מה ההבדל בין תשואה נומינלית לריאלית ושינוי מטבע?','real-return-currency'],
 ['How do crypto liquidity and regulation affect cycles?','crypto-cycles']
])test('external concepts are found by a natural question: '+q,()=>{
 const text=retrieveMichaKnowledge(q);assert.ok(text.includes('"id":"gemini-guide-'+id+'"'));assert.ok(Buffer.byteLength(text)<=7000);
});

test('short scenario and legacy detailed receipts never duplicate the answer or change verified levels',()=>{
 const bars=Array.from({length:30},(_,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:100,high:102,low:99,close:101,volume:1000}));
 const plan=entryStopScenario(bars,{provenance:'server-provider-cache',interval:'1day',latestBarMayBePartial:false});
 for(const language of ['he','en','es','ar','fr','de','pt','ru','zh','ja']){
  const compact=compactEntryStopText(plan,language),full=entryStopText(plan,language);
  assert.equal(compact.split('\n').length,4);assert.ok(compact.includes('102.75'));assert.ok(compact.includes('96.75'));
  assert.equal(withoutScenarioText('Answer\n\n'+full,plan,language),'Answer');
  assert.equal(withoutScenarioText('Answer\n\n'+compact,plan,language),'Answer');
  assert.equal(withoutScenarioText('Answer\n\n'+compact+'\n\nSources: [1]',plan,language),'Answer\n\nSources: [1]');
  assert.equal(withoutScenarioText('Answer without a receipt',plan,language),'Answer without a receipt');
  assert.ok(full.includes(plan.asOf));
 }
});
