import test from 'node:test';
import assert from 'node:assert/strict';
import {googleDisplayName,welcomeMessage} from '../welcome-message.mjs';
test('welcome supports Hebrew names, returning users and unnamed profiles',()=>{
 assert.equal(welcomeMessage('אסף',true),'Welcome, אסף!');assert.equal(welcomeMessage('Asaf',false),'Welcome back, Asaf!');
 assert.equal(welcomeMessage(undefined,true),'Welcome!');assert.equal(googleDisplayName({given_name:'  ',name:'Asaf Cohen'}),'Asaf Cohen');
});
test('display names remove control/bidi characters and bound Unicode length without splitting emoji',()=>{
 assert.equal(googleDisplayName({given_name:'\u202e Asaf\n Cohen\u2066'}),'Asaf Cohen');
 const name=googleDisplayName({name:'😀'.repeat(100)});assert.equal(Array.from(name).length,80);assert.equal(name,'😀'.repeat(80));
 assert.equal(googleDisplayName({given_name:{},name:12}),'');
});
