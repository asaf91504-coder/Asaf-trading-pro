import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChatText} from '../chat-text.mjs';

function fixture(){
 const doc={createElement:tag=>new Node(tag),createTextNode:text=>new Node('#text',text)};
 class Node{
  constructor(tag,text=''){this.tag=tag;this.children=[];this.value=text;this.ownerDocument=doc}
  get textContent(){return this.value+this.children.map(c=>c.textContent).join('')}
  set textContent(text){this.value=text;this.children=[]}
  set innerHTML(_){throw Error('Model text must never be parsed as HTML')}
  replaceChildren(){this.value='';this.children=[]}
  append(child){this.children.push(child)}
 }
 return {root:doc.createElement('div')};
}
test('Hebrew emphasis, inline code and paragraph breaks remain readable without visible delimiters',()=>{
 const {root}=fixture();renderChatText(root,'**ניתוח הגרף**\n\n1. ממוצע `MA20`\n2. מחזור מסחר');
 assert.equal(root.textContent,'ניתוח הגרף\n\n1. ממוצע MA20\n2. מחזור מסחר');assert.equal(root.children.find(n=>n.tag==='strong').textContent,'ניתוח הגרף');assert.equal(root.children.find(n=>n.tag==='code').textContent,'MA20');
});
test('HTML, image markup and hostile links stay inert text, including inside emphasis',()=>{
 const {root}=fixture();const text='<img src=x onerror=alert(1)> **<script>attack()</script>** [link](javascript:alert(1))';
 renderChatText(root,text);assert.equal(root.textContent,text.replaceAll('**',''));assert.ok(root.children.every(n=>['#text','strong','code'].includes(n.tag)));
});
test('unclosed delimiters remain intact and rerendering replaces rather than duplicates content',()=>{
 const {root}=fixture();renderChatText(root,'**not closed\n`unfinished');assert.equal(root.textContent,'**not closed\n`unfinished');
 renderChatText(root,'`**literal**`');assert.equal(root.textContent,'**literal**');assert.equal(root.children[0].tag,'code');renderChatText(root,'');assert.equal(root.textContent,'');
});
