import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {retrieveMichaKnowledge,withMichaKnowledge,MICHA_KNOWLEDGE_INFO,neutralEducationalText} from '../server/micha-knowledge.mjs';
const corpus=JSON.parse(readFileSync(new URL('../server/knowledge/micha-reviewed.json',import.meta.url)));
test('all286 reviewed sources remain individually retrievable, excluding unseen sources',()=>{
 assert.equal(corpus.records.length,286);assert.equal(new Set(corpus.records.map(r=>r.id)).size,286);
 assert.equal(corpus.records.filter(r=>r.sections.includes('academy')).length,118);
 assert.equal(corpus.records.filter(r=>r.reviewType==='video_analysis_report').length,45);
 for(const record of corpus.records){const found=retrieveMichaKnowledge(record.id);assert.ok(found.includes('"id":"'+record.id+'"'),record.id);assert.ok(Buffer.byteLength(found)<=7000);}
 assert.ok(!corpus.records.some(r=>r.id==='uL7x_sEmq5k'||r.id==='NR4kvh-l6Gc'));
 assert.equal(MICHA_KNOWLEDGE_INFO.remaining,59);
});
test('retrieved source notes stay outside trusted instructions and preserve images and originals',()=>{
 const messages=[{role:'system',content:'Existing filters and quotas.'},{role:'user',content:[{type:'text',text:'מה זה VWAP?'},{type:'image_url',image_url:{url:'test-image'}}]}];
 const before=JSON.stringify(messages),result=withMichaKnowledge(messages,'VWAP');
 assert.equal(JSON.stringify(messages),before);assert.match(result[0].content,/ASAF's existing filters/);
 assert.match(result[1].content[0].text,/ASAF_EDUCATIONAL_NOTES/);assert.equal(result[1].content[1].image_url.url,'test-image');
 assert.ok(!result[0].content.includes('"summary":'));
});
test('knowledge never grows a full request past its byte ceiling',()=>{
 const messages=[{role:'system',content:'rules'},{role:'user',content:'א'.repeat(23990)}];
 assert.deepEqual(withMichaKnowledge(messages,'ATR'),messages);
 assert.equal(retrieveMichaKnowledge('ATR',{maxBytes:20}), '');
 assert.equal(retrieveMichaKnowledge(''), '');
});
test('exact source matching wins over broad keywords and preserves provenance',()=>{
 const result=retrieveMichaKnowledge('9jm0glzzOE8 שיטת25%',{limit:1});
 assert.match(result,/9jm0glzzOE8/);assert.match(result,/currentFactsVerified":false/);assert.match(result,/20%|20 %/);
});

test('customer context and replies omit creator branding while private provenance remains',()=>{
 for(const r of corpus.records){const context=retrieveMichaKnowledge(r.id);assert.equal(neutralEducationalText(context),context);assert.equal(typeof r.url,'string')}
 for(const text of ['לפי מיכה סטוקס','Micha.Stocks says','Micha Stocks','מיכה-סטוקס'])assert.doesNotMatch(neutralEducationalText(text),/מיכה|micha/i);
 const messages=withMichaKnowledge([{role:'system',content:'base'},{role:'user',content:'???'}],'???');
 assert.match(messages[0].content,/ASAF Pro analysis framework/);assert.match(messages[0].content,/Do not mention the source creator/);
});

test('creator-name filtering preserves Hebrew support terminology and normal word boundaries',()=>{
 for(const text of ['תמיכה','תמיכה והתנגדות','המחיר קרוב לתמיכה','תמיכה בממוצע'])assert.equal(neutralEducationalText(text),text);
 for(const text of ['מיכה סטוקס','למיכה','מיכה','Micha.Stocks'])assert.notEqual(neutralEducationalText(text),text);
});
