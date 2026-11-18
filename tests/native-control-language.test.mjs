import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {extraTranslations} from '../extra-translations.mjs';
const root=new URL('../',import.meta.url);
test('journal date uses an OS-independent ISO field with real calendar validation',()=>{
 const html=readFileSync(new URL('journal.html',root),'utf8'),source=readFileSync(new URL('journal-ui.mjs',root),'utf8');
 assert.match(html,/<input id="date" type="text"[^>]*dir="ltr"/);
 assert.match(html,/aria-describedby="journalDateHelp"/);
 assert.doesNotMatch(html,/<input id="date" type="date"/);
 const functionSource=source.match(/function validDate\(value\)\{[^\n]+\}/)[0],context={Date,Number};
 vm.createContext(context);vm.runInContext(functionSource,context);
 for(const date of ['2024-02-29','2026-11-18','2000-02-29'])assert.equal(context.validDate(date),true,date);
 for(const date of ['2026-02-29','2026-04-31','2026-13-01','18/11/2026','2026-1-1','','2026-11-18T00:00:00Z'])assert.equal(context.validDate(date),false,date);
 assert.match(source,/if\(!dateValidation\(\)\)/);
});
test('file chooser preserves native file access without browser-language button or filename translation',async()=>{
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.style={};this.value='';this.handlers={};this.disabled=false}
  append(...children){this.children.push(...children);for(const child of children)child.parent=this}
  setAttribute(k,v){this.attributes[k]=v}
  addEventListener(k,v){this.handlers[k]=v}
  click(){this.clicked=(this.clicked||0)+1}
 }
 const host=new Element('section'),events=new Map();let observedFilename;
 const context={document:{getElementById:()=>null,createElement:t=>new Element(t)},authState:{authenticated:false,memberId:null},personalSections:['journal'],window:{addEventListener:(n,f)=>events.set(n,f),confirm:()=>true},prepareFileRestore:async()=>{observedFilename=find(host,x=>x.translate===false).textContent;return null}};
 const find=(node,fn)=>fn(node)?node:node.children.map(c=>find(c,fn)).find(Boolean);
 vm.createContext(context);vm.runInContext(readFileSync(new URL('personal-sync-ui.mjs',root),'utf8').replace(/^import .*;\n/gm,'').replace('export function mountPersonalSync','function mountPersonalSync'),context);
 context.mountPersonalSync(host,{only:'journal'});
 const file=find(host,x=>x.type==='file'),button=find(host,x=>x.textContent==='בחר קובץ גיבוי'),label=find(host,x=>x.textContent==='לא נבחר קובץ');
 assert.equal(file.hidden,true);assert.equal(file.accept,'.json,application/json');assert.equal(button.type,'button');button.onclick();assert.equal(file.clicked,1);
 file.files=[{name:'דוח אישי.json'}];await file.onchange();
 assert.equal(observedFilename,'דוח אישי.json');assert.equal(label.translate,true);assert.equal(label.textContent,'לא נבחר קובץ');assert.equal(file.value,'');assert.equal(button.disabled,false);
});
for(const code of ['en','es','fr','de','pt','ru','ar','zh','ja'])test(`${code}: site-rendered native control labels are translated`,()=>{
 for(const key of ['בחר קובץ גיבוי','לא נבחר קובץ','שנה-חודש-יום (YYYY-MM-DD)','יש להזין תאריך תקין במבנה YYYY-MM-DD.']){
  assert.ok(extraTranslations[code][key]);assert.doesNotMatch(extraTranslations[code][key],/[\u0590-\u05ff]/);
 }
 assert.match(extraTranslations[code]['יש להזין תאריך תקין במבנה YYYY-MM-DD.'],/YYYY-MM-DD/);
});
