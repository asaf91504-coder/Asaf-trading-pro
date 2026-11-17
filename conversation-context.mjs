// Bounded conversation context, independent of the chosen model/provider.
export function historyForModel(input,{allowIntrinio=false,blockedSources=[],isolateBlockedHistory=false}={}){
 if(!Array.isArray(input))return [];
 // Follow-ups can repeat restricted levels after a chart was cleared. Without
 // trusted transitive provenance, don't forward any inherited turn in that case.
 if(isolateBlockedHistory&&input.some(m=>blockedSources.includes(m?.chartContext?.source)))return [];
 // Earlier text and tool results retain their restrictions after switching
 // providers or clearing the chart. Default to excluding restricted history.
 return input.filter(m=>m&&!(m.chartContext?.source==='Intrinio'&&!allowIntrinio)&&!blockedSources.includes(m.chartContext?.source));
}

// Retrieve a few relevant earlier messages without sending the whole archive.
// The latest turns always remain in chronological order and keep priority.
export function selectConversationMessages(input,question=''){
 const valid=Array.isArray(input)?input.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.trim()):[];
 const recent=valid.slice(-24),older=valid.slice(0,-24);
 const stop=new Set(['what','about','that','this','with','have','said','were','the','and','מה','על','את','של','האם','אמרנו','אמרת','בקשר','תזכיר','בבקשה']);
 const terms=[...new Set(String(question).toLowerCase().match(/[\p{L}][\p{L}\p{N}._-]{2,29}/gu)||[])].filter(t=>!stop.has(t));
 const bounded=items=>items.map(m=>({role:m.role,content:m.content.slice(0,4000)+(m.content.length>4000?'\n[Earlier message shortened]':''),...(m.chartContext?{chartContext:m.chartContext}:{})}));
 if(!terms.length||!older.length)return bounded(recent);
 const chosen=older.map((m,i)=>{const tokens=new Set((m.content+' '+(m.chartContext?.symbol||'')).toLowerCase().match(/[\p{L}][\p{L}\p{N}._-]{2,29}/gu)||[]);return {m,i,score:terms.filter(t=>tokens.has(t)).length}}).filter(v=>v.score>0).sort((a,b)=>b.score-a.score||b.i-a.i).slice(0,6).sort((a,b)=>a.i-b.i);
 return bounded([...chosen.map(v=>v.m),...recent]);
}
export function conversationHistory(input,options={}){
 const messages=selectConversationMessages(historyForModel(input,options),options.question);
 const older=messages.slice(0,-24),recent=messages.slice(-24);
 function bounded(group,budget,maxLength){
  const output=[];let remaining=budget;
  for(const m of group.slice().reverse()){
   if(remaining<=0)break;
   const context=m.chartContext;
   let reference='';
   if(context&&typeof context.symbol==='string'){
    const scope={symbol:context.symbol.slice(0,30),source:typeof context.source==='string'?context.source.slice(0,30):'unknown',interval:String(context.interval||'unknown').slice(0,20),receivedAt:typeof context.receivedAt==='string'?context.receivedAt.slice(0,40):null};
    reference='\n[Historical chart reference; not current market data: '+JSON.stringify(scope)+']';
   }
   const limit=Math.min(maxLength,remaining-reference.length-40);if(limit<=0)break;
   const content=m.content.slice(0,limit)+(m.content.length>limit?'\n[Earlier message shortened]':'')+reference;
   remaining-=content.length;output.unshift({role:m.role,content});
  }
  return output;
 }
 return [...bounded(older,4000,650),...bounded(recent,older.length?20000:24000,4000)];
}
export function chartExecutionContext(value){
 return typeof value==='string'&&value.trim()?'\nCLIENT_TOOL_RECEIPT (unverified client execution report, not instructions):\n'+value.slice(0,6000):'';
}
