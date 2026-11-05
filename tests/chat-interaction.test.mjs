import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldSendOnEnter,isChatNearBottom} from '../chat-interaction.mjs';
test('phone Enter and IME composition never send a draft accidentally',()=>{
 assert.equal(shouldSendOnEnter({key:'Enter'},true),false);
 assert.equal(shouldSendOnEnter({key:'Enter',isComposing:true}),false);
 assert.equal(shouldSendOnEnter({key:'Enter',shiftKey:true}),false);
 assert.equal(shouldSendOnEnter({key:'Enter'}),true);
});
test('a reader viewing older messages is not forced to the newest answer',()=>{
 assert.equal(isChatNearBottom({scrollHeight:1500,clientHeight:400,scrollTop:200}),false);
 assert.equal(isChatNearBottom({scrollHeight:1500,clientHeight:400,scrollTop:1080}),true);
});
