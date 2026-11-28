import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionAccessError} from '../subscription-access.mjs';
test('only explicit subscription denials are classified as billing access errors',()=>{
 for(const code of ['subscription_required','paid_subscription_required'])assert.equal(subscriptionAccessError({status:402},{code}).subscriptionRequired,true);
 for(const status of [200,401,403,429,503])assert.equal(subscriptionAccessError({status},{code:'subscription_required'}),null);
 for(const code of ['credits_exhausted','provider_unavailable',undefined])assert.equal(subscriptionAccessError({status:402},{code}),null);
});
