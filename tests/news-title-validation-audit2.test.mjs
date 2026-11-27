import test from 'node:test';
import assert from 'node:assert/strict';
import {validNewsTitle,newsNumbersPreserved} from '../server/news-title-validation.mjs';
test('bare compact financial quantities cannot disappear as model identifiers',()=>{
 assert.equal(validNewsTitle('החברה גייסה 2B','Company raised 1B','he'),false);
 assert.equal(validNewsTitle('החברה גייסה מיליארד','Company raised 1B','he'),true);
 assert.equal(validNewsTitle('החברה גייסה 500 מיליון','Company raised 0.5B','he'),true);
 assert.equal(validNewsTitle('מכירות שבב H100 עולות 10%','H100 chip sales rise 10%','he'),true);
});
test('currency stays bound to its financial amount without inventing a default',()=>{
 assert.equal(validNewsTitle('החברה גייסה 2 מיליון אירו','Company raised $2 million','he'),false);
 assert.equal(newsNumbersPreserved('החברה גייסה €2 מיליון ו-$1 מיליון','Company raised $2 million and €1 million','he'),false);
 assert.equal(newsNumbersPreserved('החברה גייסה CAD 2 מיליון','Company raised USD 2 million','he'),false);
 assert.equal(newsNumbersPreserved('החברה גייסה 2 מיליון','Company raised $2 million','he'),false);
 assert.equal(newsNumbersPreserved('החברה גייסה 2 מיליון דולר','Company raised 2 million','he'),false);
 assert.equal(newsNumbersPreserved('החברה גייסה 2 מיליון דולר','Company raised $2 million','he'),true);
 assert.equal(newsNumbersPreserved('החברה גייסה 2 מיליון אירו','Company raised €2 million','he'),true);
 assert.equal(newsNumbersPreserved('החברה גייסה US$2 מיליון','Company raised USD 2 million','he'),true);
});
test('localized dates and attached Hebrew number prefixes retain equivalent facts',()=>{
 for(const [title,language] of [['La empresa publicará resultados el 25 de noviembre de 2026','es'],['Die Firma meldet Zahlen am 25. November 2026','de'],['La société publiera ses résultats le 25 novembre 2026','fr'],['A empresa publicará resultados em 25 de novembro de 2026','pt']])assert.equal(validNewsTitle(title,'Company earnings on November 25, 2026',language),true,title);
 assert.equal(validNewsTitle('המניה עולה ב10%','Shares rise 10%','he'),true);
 assert.equal(validNewsTitle('המניה עולה ב90%','Shares rise 10%','he'),false);
 assert.equal(validNewsTitle('החברה גייסה כ2 מיליון דולר','Company raised $2 million','he'),true);
 assert.equal(newsNumbersPreserved('La empresa publicará resultados el 26 de noviembre de 2026','Company earnings on November 25, 2026','es'),false);
});
