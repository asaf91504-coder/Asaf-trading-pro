import test from 'node:test';
import assert from 'node:assert/strict';
import {signTranslationJob,validTranslationJob} from '../server/news-translation-job.mjs';
test('background jobs reject forged signatures, expired jobs and unsupported languages',()=>{
 const now=Date.now(),body=JSON.stringify({language:'he',at:now}),secret='test-secret';
 assert.equal(validTranslationJob(body,signTranslationJob(body,secret),secret,now),true);
 assert.equal(validTranslationJob(body,signTranslationJob(body,'wrong'),secret,now),false);
 assert.equal(validTranslationJob(body,signTranslationJob(body,secret),secret,now+61000),false);
 const invalid=JSON.stringify({language:'bad',at:now});assert.equal(validTranslationJob(invalid,signTranslationJob(invalid,secret),secret,now),false);
});
