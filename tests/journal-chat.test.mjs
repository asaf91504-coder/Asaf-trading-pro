import test from 'node:test';
import assert from 'node:assert/strict';
import {journalIntent,journalDraft,validatedJournalTrade,journalStorageKey,appendCloudTrade} from '../journal-chat-core.mjs';
import {tradeProfit,personalData} from '../personal-data.mjs';
const draft={symbol:'NVDA',date:'2026-11-15',side:'long',entry:'100',exit:'',qty:'10',fees:'0',setup:'',quality:'B',note:''};
test('journal requests create drafts only from explicit text, not selected chart or assistant suggestions',()=>{
 assert.equal(journalIntent('תרשום ביומן מניה NVDA כניסה 100 כמות 10'),true);
 assert.equal(journalIntent('save to journal symbol AAPL entry 200 qty 5'),true);
 assert.equal(journalIntent('נתח NVDA כניסה וסטופ'),false);
 assert.equal(journalIntent('מה זה יומן מסחר?'),false);
 const t=journalDraft('תרשום ביומן NVDA כניסה 100 כמות 10',{today:'2026-11-15'});
 assert.equal(t.symbol,'NVDA');assert.equal(t.entry,100);assert.equal(t.qty,10);assert.equal(t.exit,'');
 assert.equal(journalDraft('add to journal symbol NVDA entry 1,000.50 qty 5').entry,1000.5);
 assert.equal(journalDraft('add to journal entry 1,20').entry,'');
});
test('open trades have no realized profit and round-trip through journal validation',()=>{
 const t=validatedJournalTrade(draft,'trade-1');assert.equal(t.exit,null);assert.equal(tradeProfit(t),null);
 assert.deepEqual(personalData('journal',[t]),[t]);
 assert.equal(tradeProfit({...t,exit:110}),100);
 for(const changes of [{entry:''},{qty:0},{exit:-1},{date:'2026-02-30'},{symbol:'<script>'}])assert.throws(()=>validatedJournalTrade({...draft,...changes},'trade-1'));
 assert.notEqual(journalStorageKey('member-a'),journalStorageKey('member-b'));
 assert.notEqual(journalStorageKey(null),journalStorageKey('member-a'));
});
test('cloud append preserves other workspace data and retries conflicts without duplicating trades',async()=>{
 const trade=validatedJournalTrade(draft,'trade-1'),other={...trade,id:'other'};let calls=0,puts=0,stored=[other],revision='r1';
 const fetcher=async(url,init)=>{
  calls++;if(init.method!=='PUT')return Response.json({revision,journal:stored,watch:[{symbol:'AAPL'}]});
  const body=JSON.parse(init.body);assert.equal(body.section,'journal');assert.equal(body.memberId,'member-a');assert.equal(body.watch,undefined);
  if(++puts===1){stored=[{...other,id:'concurrent'},...stored];revision='r2';return Response.json({error:'conflict'},{status:409});}
  assert.equal(body.revision,'r2');stored=body.data;return Response.json({revision:'r3'});
 };
 await appendCloudTrade(trade,{memberId:'member-a',getMember:()=> 'member-a',fetcher});
 assert.equal(stored.length,3);assert.equal(puts,2);
 await appendCloudTrade(trade,{memberId:'member-a',getMember:()=> 'member-a',fetcher});assert.equal(stored.length,3);assert.equal(puts,2);
});
test('account changes and unauthorized reads prevent a cloud write',async()=>{
 const trade=validatedJournalTrade(draft,'trade-1');let member='a',writes=0;
 await assert.rejects(appendCloudTrade(trade,{memberId:'a',getMember:()=>member,fetcher:async(u,i)=>{if(i.method==='PUT')writes++;member='b';return Response.json({revision:'',journal:[]})}}));
 assert.equal(writes,0);
 await assert.rejects(appendCloudTrade(trade,{memberId:'a',getMember:()=> 'a',fetcher:async()=>Response.json({error:'login expired'},{status:401})}),e=>e.status===401);
});
