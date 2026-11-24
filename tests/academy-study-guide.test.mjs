import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {retrieveMichaKnowledge,withMichaKnowledge,MICHA_KNOWLEDGE_INFO,ACADEMY_STUDY_GUIDE_INFO} from '../server/micha-knowledge.mjs';
import {asafScannerPreset} from '../scanner-presets.mjs';
import {planPosition} from '../risk-planner.mjs';
const guide=JSON.parse(readFileSync(new URL('../server/knowledge/academy-study-guide.json',import.meta.url)));
const retrieved=q=>retrieveMichaKnowledge(q).trim().split('\n').slice(1).map(line=>JSON.parse(line));
const cases=[
 ['מה זו ריבית דריבית','compounding',/25,937|1\+r/],
 ['What is compound interest?','compounding',/נומינלי|דריבית/],
 ['מה ההבדל בין מדד לקרן סל','index-etf',/אינו מדד עולמי|אינו מוצר/],
 ['איך קונים מניה בפעם הראשונה','account-first-purchase',/ביצוע חלקי|ביצוע בפועל/],
 ['מה ההבדל בין Limit ל Market','orders',/אינו מבטיח ביצוע/],
 ['מה זה Volume Profile','volume-profile',/אומדן|קירוב/],
 ['איך עובד סטופ נגרר','trailing-profits',/115|נגרר/],
 ['איך מחשבים גודל פוזיציה לפי ATR','atr-sizing',/62 מניות|כמות מניות/],
 ['תן צ׳ק ליסט לפני כניסה למניה','pretrade-checklist',/מידע|חסר|לא ניתן לבדוק/],
 ['האם חייבים להיות מעל ממוצע 150','liquidity-ma',/לא תנאי חובה|בלי שינוי מפורש/]
];
for(const [q,id,content] of cases)test('study guide retrieval: '+q,()=>{
 const notes=retrieved(q),topic=notes.find(r=>r.id==='academy-guide-'+id);
 assert.ok(topic,id);assert.match(topic.summary+' '+topic.details,content);
 assert.equal(topic.reviewType,'user_provided_study_guide');
 assert.equal(topic.coverage.fullVideoReviewed,false);assert.equal(topic.coverage.transcriptRange,null);
 assert.doesNotMatch(JSON.stringify(notes),/(?<![\p{L}\p{N}])מיכה(?![\p{L}\p{N}])|\bmicha\b|youtube\.com/iu);
 assert.ok(Buffer.byteLength(retrieveMichaKnowledge(q))<=7000);
});
test('outline adds topics without inventing completed source reviews or timestamps',()=>{
 assert.equal(guide.lessonCount,11);assert.equal(guide.lessons.length,11);assert.equal(guide.newVideoReviews,0);
 assert.equal(guide.fullAcademyCoverageClaimVerified,false);assert.equal(guide.topicCount,guide.records.length);
 assert.equal(MICHA_KNOWLEDGE_INFO.sources,286);assert.equal(MICHA_KNOWLEDGE_INFO.academy,118);
 assert.equal(ACADEMY_STUDY_GUIDE_INFO.newVideoReviews,0);
 for(const lesson of guide.lessons){assert.equal(lesson.newlyWatched,false);assert.equal(lesson.transcriptRange,null);assert.ok(lesson.url.endsWith(lesson.id));}
 for(const topic of guide.records){assert.deepEqual(topic.timestamps,[]);assert.ok(topic.sourceVideoIds.every(id=>guide.lessons.some(l=>l.id===id)));}
});
test('guide precedence preserves user filters, hypothetical sizing and source limitations',()=>{
 const preset=asafScannerPreset();assert.equal(preset.scanMinMarketCap,1e9);assert.equal(preset.scanMinPrice,5);assert.equal(preset.scanAbove20,true);
 const context=withMichaKnowledge([{role:'system',content:'Existing ASAF filters and verified server prices.'},{role:'user',content:'תן צ׳ק ליסט'}],'תן צ׳ק ליסט');
 assert.match(context[0].content,/not a replacement/);assert.match(context[0].content,/stop-limit can remain unfilled/);
 assert.match(context[0].content,/not actual trade-at-price/);assert.match(context[0].content,/not full transcripts/);
 const example=planPosition({account:25000,riskPercent:1,entry:100,stop:96,budget:25000,side:'long'});
 assert.equal(example.shares,62);assert.equal(example.actualRisk,248);
 const original=[{role:'system',content:'base'},{role:'user',content:'א'.repeat(23990)}];assert.deepEqual(withMichaKnowledge(original,'צקליסט'),original);
});
