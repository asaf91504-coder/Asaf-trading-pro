import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {personalData,tradeProfit} from '../personal-data.mjs';
import {journalStorageKey} from '../journal-chat-core.mjs';
test('journal edits stay in the known account during auth outage and clear on confirmed account switch',()=>{
 const source=readFileSync(new URL('../journal-ui.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const nodes=new Map(),db=new Map(),listeners=new Map();
 const node=()=>({value:'',textContent:'',hidden:false,children:[],append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},reset(){for(const n of nodes.values())n.value=''},focus(){}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
 const authState={authenticated:true,checkAvailable:true,memberId:'member-a'};
 const record={id:'a1',symbol:'NVDA',date:'2026-11-15',side:'long',entry:100,exit:null,qty:10,fees:0,setup:'',quality:'',note:''};
 db.set(journalStorageKey('member-a'),JSON.stringify([record]));
 const ctx={authState,journalStorageKey,personalData,tradeProfit,mountPersonalSync(){},crypto:{randomUUID:()=> 'new'},Date,Intl,JSON,Number,URL,Blob,setTimeout,document:{getElementById:get,createElement:node},window:{confirm:()=>true,addEventListener:(name,fn)=>listeners.set(name,fn)},localStorage:{getItem:key=>db.get(key)||null,setItem:(key,value)=>db.set(key,value)}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 assert.equal(get('count').textContent,1);
 Object.assign(authState,{authenticated:false,checkAvailable:false});
 listeners.get('asaf:auth')();
 // Edit an already visible trade while the network cannot confirm auth.
 get('rows').children[0].children.at(-1).children[0].onclick();
 get('exit').value='110';get('form').onsubmit({preventDefault(){}});
 assert.equal(JSON.parse(db.get(journalStorageKey('member-a')))[0].exit,110);
 assert.equal(db.has(journalStorageKey(null)),false);
 Object.assign(authState,{authenticated:true,checkAvailable:true,memberId:'member-b'});
 listeners.get('asaf:auth')();
 assert.equal(get('count').textContent,0);assert.equal(get('symbol').value,'');
 assert.equal(db.has(journalStorageKey('member-b')),false);
});
