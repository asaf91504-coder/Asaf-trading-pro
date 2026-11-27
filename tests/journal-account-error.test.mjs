import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {personalData,tradeProfit} from '../personal-data.mjs';
import {journalStorageKey} from '../journal-chat-core.mjs';
const source=readFileSync(new URL('../journal-ui.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function fixture(){
 const nodes=new Map(),db=new Map(),listeners=new Map(),writes=[];
 const node=()=>({value:'',textContent:'',hidden:false,children:[],append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},reset(){for(const n of nodes.values())n.value=''},focus(){}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
 const authState={authenticated:true,checkAvailable:true,memberId:'member-a'};
 const record={id:'a1',symbol:'NVDA',date:'2026-11-15',side:'long',entry:100,exit:null,qty:10,fees:0,setup:'',quality:'',note:'private A'};
 db.set(journalStorageKey('member-a'),JSON.stringify([record]));
 let readError=false;
 const context={authState,journalStorageKey,personalData,tradeProfit,mountPersonalSync(){},crypto:{randomUUID:()=> 'new'},Date,Intl,JSON,Number,URL,Blob,setTimeout,document:{getElementById:get,createElement:node},window:{confirm:()=>true,addEventListener:(name,fn)=>listeners.set(name,fn)},localStorage:{getItem:key=>{if(readError)throw Error('storage blocked');return db.get(key)||null},setItem:(key,value)=>{writes.push(key);db.set(key,value)}}};
 vm.createContext(context);vm.runInContext(source,context);
 get('rows').children[0].children.at(-1).children[0].onclick();
 return {get,db,listeners,writes,authState,failRead(){readError=true}};
}
for(const mode of ['malformed','unavailable'])test('account switch clears previous journal and draft when next storage is '+mode,()=>{
 const f=fixture(),key=journalStorageKey('member-b');f.db.set(key,'{broken');if(mode==='unavailable')f.failRead();
 f.authState.memberId='member-b';f.listeners.get('asaf:auth')();
 assert.equal(f.get('count').textContent,0);assert.equal(f.get('symbol').value,'');assert.equal(f.get('note').value,'');assert.equal(f.get('cancelEdit').hidden,true);
 assert.equal(f.get('rows').children.length,1);assert.match(f.get('rows').children[0].children[0].textContent,/עדיין אין עסקאות/);assert.match(f.get('journalStatus').textContent,/לא ניתן לקרוא/);
 assert.equal(f.db.get(key),'{broken');assert.deepEqual(f.writes,[]);
});
test('same-account storage failure preserves the visible journal and unsaved edit',()=>{
 const f=fixture();f.failRead();f.listeners.get('storage')({key:journalStorageKey('member-a')});
 assert.equal(f.get('count').textContent,1);assert.equal(f.get('symbol').value,'NVDA');assert.equal(f.get('note').value,'private A');assert.equal(f.get('cancelEdit').hidden,false);assert.match(f.get('journalStatus').textContent,/לא ניתן לקרוא/);assert.deepEqual(f.writes,[]);
});
