import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/payment-test.mjs';
test('retired payment test rejects reads, creation and capture',async()=>{for(const method of ['GET','POST']){const response=await handler(new Request('https://example.test/.netlify/functions/payment-test',{method}));assert.equal(response.status,410);}});
