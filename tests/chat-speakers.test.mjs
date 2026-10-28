import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../stock-chat-ui.mjs',import.meta.url),'utf8');
const saySource=source.slice(source.indexOf('function say('),source.indexOf('function currentContext('));

test('chat speaker groups expose labels without replacing message content or update behavior',()=>{
 const items=[];
 const context={document:{createElement:()=>({attributes:{},setAttribute(name,value){this.attributes[name]=value}})},log:{append(item){items.push(item)},scrollHeight:100,scrollTop:0}};
 vm.createContext(context);vm.runInContext(saySource,context);
 const user=context.say('user','שאלה');
 const reply=context.say('bot','כותב תשובה…');
 assert.equal(user.attributes.role,'group');assert.equal(user.attributes['aria-label'],'אתה');assert.equal(user.textContent,'שאלה');
 assert.equal(reply.attributes.role,'group');assert.equal(reply.attributes['aria-label'],'ASAF AI');
 reply.textContent='תשובה';assert.equal(reply.attributes['aria-label'],'ASAF AI');assert.equal(reply.textContent,'תשובה');
 assert.equal(items.length,2);assert.equal(context.log.scrollTop,100);
});
