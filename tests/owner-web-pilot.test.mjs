import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerWebPilotLimit,ownerWebPilotQuestion,requestOwnerWebPilot,hostedAnswer} from '../server/owner-web-pilot.mjs';
const id='12345678-1234-1234-1234-123456789abc',member={id};
const env={ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://fixture.upstash.io',ASAF_REDIS_REST_TOKEN:'redis',ASAF_CHAT_OWNER_MEMBER_ID:id,ASAF_ADMIN_MEMBER_IDS:id,ASAF_PUBLIC_AUTH_ENABLED:'true',ASAF_AI_PROVIDER:'openai',ASAF_OPENAI_ENABLED:'true',OPENAI_API_KEY:'mock',ASAF_OWNER_OPENAI_WEB_PILOT_APPROVED:'true',ASAF_OWNER_OPENAI_WEB_PILOT_TOTAL:'10'};
const text='דוח חדש [2]';
const citation={type:'url_citation',start_index:0,end_index:7,url:'https://www.sec.gov/filings/123',title:'Source'};
const response=(annotations=[citation])=>({status:'completed',output:[{type:'web_search_call',status:'completed'},{type:'message',role:'assistant',content:[{type:'output_text',text,annotations}]}]});
test('pilot is disabled by default and accepts only a finite explicit total capped at ten',()=>{
 for(const v of [undefined,'0','11','1e1',' 1','1.1'])assert.equal(ownerWebPilotLimit({...env,ASAF_OWNER_OPENAI_WEB_PILOT_TOTAL:v}),0);
 assert.equal(ownerWebPilotLimit({...env,ASAF_OWNER_OPENAI_WEB_PILOT_APPROVED:undefined}),0);
 assert.equal(ownerWebPilotLimit(env),10);
});
test('supports bounded public broad market, equities and crypto research, not private or price requests',()=>{
 for(const q of ['מה אתה חושב על השוק היום','What did Nvidia report in its latest earnings?','מה חדש בשוק הקריפטו?','What is the latest Bitcoin ETF news?'])assert.equal(ownerWebPilotQuestion(q),true,q);
 for(const q of ['tell me a joke','What is the current price?','כמה נסחרת NVDA עכשיו?','Earnings for me@example.com','מחיר המניה אחרי הדוח','earnings password=example','earnings '.repeat(1000)])assert.equal(ownerWebPilotQuestion(q),false,q);
});
test('only verified links from valid annotations become numbered citations',()=>{
 assert.deepEqual(hostedAnswer(response()).sources,[{id:1,url:'https://www.sec.gov/filings/123',title:'Source'}]);
 assert.match(hostedAnswer(response()).answer,/\[1\]/);
 assert.doesNotMatch(hostedAnswer(response()).answer,/\[2\]/);
 for(const url of ['https://127.0.0.1/a','javascript:alert(1)','https://user:password@sec.gov/a','https://private.internal','https://www.sec.gov:9000/a'])assert.equal(hostedAnswer(response([{...citation,url}])),null,url);
 assert.equal(hostedAnswer(response([{...citation,end_index:999} ])),null);
 assert.equal(hostedAnswer({...response(),status:'incomplete'}),null);
});
test('eligibility and exhausted distributed allowance fail before any hosted search',async()=>{
 const unexpected=()=>assert.fail('unexpected outbound');
 assert.equal((await requestOwnerWebPilot({member:{id:'wrong'},env,run:unexpected,fetcher:unexpected})).status,503);
 assert.equal((await requestOwnerWebPilot({member,env,question:'personal advice',run:unexpected,fetcher:unexpected})).status,422);
 const cmds=[];const out=await requestOwnerWebPilot({member,env,question:'מה אתה חושב על השוק היום',run:async args=>{cmds.push(args);return cmds.length===1?1:0},fetcher:unexpected});
 assert.equal(out.status,429);
 assert.match(cmds[0][1],/owner-chat-burst/);
 assert.match(cmds[1][1],/owner-web-pilot/);
 assert.match(cmds[1][3],/ai:owner-web-pilot:v1$/);
});
test('one billed attempt is pre-reserved and carries only current question plus constrained instructions',async()=>{
 const calls=[],question='What did NVDA say in its latest earnings?';
 const result=await requestOwnerWebPilot({question,language:'he',member,env,run:async()=>1,fetcher:async(url,init)=>{
  calls.push({url,body:JSON.parse(init.body)});return Response.json(response());
 },chart:'LICENSED_CHART',history:'PRIVATE_HISTORY',symbol:'AAPL'});
 assert.equal(result.status,200);assert.equal(calls.length,1);
 const {url,body}=calls[0];
 assert.equal(url,'https://api.openai.com/v1/responses');
 assert.equal(body.input,question);
 assert.match(body.instructions,/Hebrew/);
 assert.equal(body.max_tool_calls,1);
 assert.equal(body.max_output_tokens,700);
 assert.deepEqual(body.tools,[{type:'web_search',search_context_size:'low'}]);
 assert.equal(body.store,false);
 assert.doesNotMatch(JSON.stringify(body),/LICENSED_CHART|PRIVATE_HISTORY|AAPL|12345678/);
});
import chat from '../netlify/functions/free-chat.mjs';
import auth from '../netlify/functions/auth.mjs';
import {fixture,seed,request,env as identityEnv,origin} from './identity-fixture.mjs';
import {renderChatText} from '../chat-text.mjs';

test('configured owner uses isolated hosted route and non-owner never gets access or provider calls',async()=>{
 const previous=process.env,originalFetch=globalThis.fetch,state=fixture(),calls=[];
 const owner=seed(state,'owner@example.test',id,'d'.repeat(64));
 const other=seed(state,'other@example.test','fedcbafe-fedc-fedc-fedc-fedcbafedcba','e'.repeat(64));
 process.env={...identityEnv,...env,ASAF_ADMIN_MEMBER_IDS:id+',fedcbafe-fedc-fedc-fedc-fedcbafedcba'};
 let allocated=0;
 globalThis.fetch=async (url,options)=>{
  const body=JSON.parse(options.body);
  if(url==='https://fixture.upstash.io'){
   if(body[0]==='EVAL'&&body[1].includes('owner-chat-burst'))return Response.json({result:1});
   if(body[0]==='EVAL'&&body[1].includes('owner-web-pilot'))return Response.json({result:++allocated===1?1:0});
   return Response.json({result:await state.run(body)});
  }
  assert.equal(url,'https://api.openai.com/v1/responses');
  calls.push(body);
  return Response.json(response());
 };
 try{
  for(const [account,wants] of [[owner,true],[other,false]]){
   const result=await auth(new Request(origin+'/.netlify/functions/auth',{headers:{cookie:account.cookie}}));
   assert.equal((await result.json()).ownerHostedSearch===true,wants);
  }
  const payload={message:'מה חדש בשוק הקריפטו?',language:'he',webSearch:true,chartControl:true,symbol:'AAPL',source:'Twelve Data',useServerMarket:true,history:[{role:'user',content:'LICENSED_SECRET'}]};
  assert.notEqual((await chat(request('free-chat',payload,other.cookie))).status,200);
  const result=await chat(request('free-chat',payload,owner.cookie));
  assert.equal(result.status,200);
  const answer=await result.json();assert.equal(answer.webSearch.kind,'owner-hosted-search');assert.equal(answer.actions,undefined);assert.equal(answer.credits,undefined);
  assert.equal((await chat(request('free-chat',payload,owner.cookie))).status,429);
  assert.equal(calls.length,1);
  assert.doesNotMatch(JSON.stringify(calls),/AAPL|LICENSED_SECRET|Twelve Data/);
 }finally{process.env=previous;globalThis.fetch=originalFetch;}
});
test('cited answer renders an inline link, rejecting model-written or unsafe links',()=>{
 const doc={createTextNode:text=>({text}),createElement:tag=>({tag})};
 const target={children:[],replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)}};
 renderChatText(target,'Answer [1] and [2] https://example.org [3]',doc,[{id:1,url:'https://sec.gov/filing'},{id:2,url:'javascript:alert(1)'}]);
 const anchors=target.children.filter(x=>x.tag==='a');
 assert.deepEqual(anchors,[{tag:'a',href:'https://sec.gov/filing',target:'_blank',rel:'noopener noreferrer',textContent:'[1]'}]);
 assert.ok(target.children.some(x=>x.text==='[3]'));
});
