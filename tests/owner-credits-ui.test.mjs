import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ownerCreditCopy} from '../owner-credit-copy.mjs';
const source=readFileSync(new URL('../owner-credits-ui.mjs',import.meta.url),'utf8').replace(/^import .*\n/gm,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function element(tag){return {tag,children:[],disabled:false,hidden:false,textContent:'',value:'',append(...nodes){this.children.push(...nodes)},setAttribute(){},checkValidity(){return true},reportValidity(){},get elements(){return this.children.flatMap(n=>['input','button'].includes(n.tag)?[n]:n.children.flatMap(c=>c.tag==='input'?[c]:[]));}};}
async function page({owner=true,failFirst=false}={}){
 const host=element('div'),events={},bodies=[];let calls=0;
 const authState={authenticated:true,memberId:'owner-id'},ctx={authState,ownerCreditCopy,crypto:{randomUUID},AbortSignal,document:{documentElement:{lang:'he'},getElementById:()=>host,createElement:element},window:{addEventListener:(type,fn)=>events[type]=fn},fetch:async(url,options)=>{
  if(url.endsWith('/account'))return {ok:true,json:async()=>({owner,memberId:authState.memberId})};
  bodies.push(JSON.parse(options.body));if(failFirst&&calls++===0)throw Error('Offline');
  return {ok:true,json:async()=>({granted:50,bonusRemaining:50,access:true})};
 }};
 vm.runInNewContext(source,ctx);await tick();
 const section=host.children[0],form=section.children.find(n=>n.tag==='form'),status=section.children.at(-1),find=id=>form.elements.find(n=>n.id===id);
 return {ctx,events,bodies,section,form,status,email:find('creditAdminEmail'),amount:find('creditAdminAmount')};
}
test('non-owner cannot expose or submit credit management even when the parent admin panel exists',async()=>{
 const p=await page({owner:false});assert.equal(p.section.hidden,true);p.form.onsubmit({preventDefault(){}});await tick();assert.equal(p.bodies.length,0);
});
test('owner grant retries retain one request ID and re-enable controls after a network failure',async()=>{
 const p=await page({failFirst:true});assert.equal(p.section.hidden,false);p.email.value=' Friend@Example.test ';p.amount.value='50';
 p.form.onsubmit({preventDefault(){}});await tick();assert.match(p.status.textContent,/Offline/);assert.ok(p.form.elements.every(n=>!n.disabled));
 p.form.onsubmit({preventDefault(){}});await tick();assert.equal(p.bodies.length,2);assert.equal(p.bodies[0].requestId,p.bodies[1].requestId);assert.equal(p.bodies[1].email,'friend@example.test');assert.equal(p.bodies[1].credits,50);assert.match(p.status.textContent,/נוספו 50/);
 p.ctx.authState.authenticated=false;p.events['asaf:auth']();assert.equal(p.section.hidden,true);assert.equal(p.email.value,'');
});
