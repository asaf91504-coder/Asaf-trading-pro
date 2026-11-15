import test from 'node:test';
import assert from 'node:assert/strict';
const tick=()=>new Promise(r=>setImmediate(r));
test('chat history autosaves completed pairs, retries the same turn and clears another account’s view',async()=>{
 const original=Object.fromEntries(['document','window','fetch','sessionStorage','CustomEvent'].map(k=>[k,globalThis[k]]));
 const events=new Map(),all=[],storage=new Map();
 function node(){const n={children:[],value:'',style:{},textContent:'',append(...c){this.children.push(...c)},before(c){this.panel=c},replaceChildren(){this.children=[]},setAttribute(){}};all.push(n);return n}
 globalThis.document={createElement:node,getElementById:()=>null,addEventListener(){}};
 globalThis.window={addEventListener(type,fn){events.set(type,[...(events.get(type)||[]),fn])},dispatchEvent(e){for(const f of events.get(e.type)||[])f(e)},confirm:()=>true};
 globalThis.CustomEvent=class extends Event{constructor(t,o){super(t);this.detail=o?.detail}};
 globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const posts=[];let fail=true,clears=0;const opened=[];let cloud=[];
 globalThis.fetch=async(url,options)=>{if(url.includes('/auth'))return Response.json({enabled:true,authenticated:true,memberId:'member-a'});if(options.method==='POST'){posts.push(JSON.parse(options.body));return Response.json(fail?{error:'offline'}:{saved:true},{status:fail?503:200})}return Response.json({conversations:cloud})};
 try{
  const {authState,refreshAuth}=await import('../auth-ui.mjs');await refreshAuth();
  const {mountChatHistory}=await import('../conversation-history-ui.mjs');
  const history=mountChatHistory({host:node(),isBusy:()=>false,onNew:()=>clears++,onOpen(messages){opened.push(messages)}});await tick();
  history.complete([{role:'user',content:'hello'},{role:'assistant',content:'answer'}]);await tick();
  assert.equal(posts.length,1);assert.equal(posts[0].memberId,'member-a');assert.ok(storage.get('asaf_pending_chat_v1:member-a').includes('answer'));
  fail=false;await all.find(n=>n.textContent==='נסה לשמור שוב').onclick();assert.equal(posts.length,2);assert.equal(posts[0].turnId,posts[1].turnId);assert.equal(storage.get('asaf_pending_chat_v1:member-a'),'[]');
  assert.equal(history.newConversation(),true);history.complete([{role:'user',content:'next'},{role:'assistant',content:'new'}]);await tick();assert.notEqual(posts[2].id,posts[0].id);
  Object.assign(authState,{authenticated:true,memberId:'member-b',checkAvailable:true});window.dispatchEvent(new Event('asaf:auth'));await tick();assert.ok(clears>=3);assert.equal(storage.get('asaf_pending_chat_v1:member-a'),'[]');
  history.complete([{role:'user',content:'B'},{role:'assistant',content:'B answer'}]);await tick();assert.equal(posts.at(-1).memberId,'member-b');assert.notEqual(posts.at(-1).id,posts[0].id);
  // Expired login must not erase the only copy of an unsaved completed turn.
  fail=true;history.complete([{role:'user',content:'offline question'},{role:'assistant',content:'offline answer'}]);await tick();
  const pendingB=JSON.parse(storage.get('asaf_pending_chat_v1:member-b'));
  assert.equal(pendingB.length,1);
  Object.assign(authState,{authenticated:false,memberId:null});window.dispatchEvent(new Event('asaf:auth'));await tick();
  assert.equal(JSON.parse(storage.get('asaf_pending_chat_v1:member-b')).length,1);
  Object.assign(authState,{authenticated:true,memberId:'member-a'});window.dispatchEvent(new Event('asaf:auth'));await tick();
  assert.equal(opened.length,0,'another account must not see pending B messages');
  Object.assign(authState,{authenticated:true,memberId:'member-b'});window.dispatchEvent(new Event('asaf:auth'));await tick();await tick();
  assert.deepEqual(opened.at(-1),pendingB[0].messages,'pending messages restore before retry');
  assert.equal(posts.at(-1).turnId,pendingB[0].turnId,'recovery retries idempotently');
  fail=false;await all.find(n=>n.textContent==='נסה לשמור שוב').onclick();
  assert.equal(storage.get('asaf_pending_chat_v1:member-b'),'[]');
  // Server accepted the turn but the acknowledgement was lost before refresh.
  storage.set('asaf_pending_chat_v1:member-b',JSON.stringify(pendingB));
  cloud=[{id:pendingB[0].id,turnIds:[pendingB[0].turnId],messages:pendingB[0].messages,title:'Recovered'}];
  Object.assign(authState,{authenticated:false,memberId:null});window.dispatchEvent(new Event('asaf:auth'));await tick();
  Object.assign(authState,{authenticated:true,memberId:'member-b'});window.dispatchEvent(new Event('asaf:auth'));await tick();await tick();
  assert.deepEqual(opened.at(-1),pendingB[0].messages,'acknowledgement loss must not duplicate displayed turns');


 }finally{Object.assign(globalThis,original)}
});
