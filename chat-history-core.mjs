// Stored text is historical context, never a replacement for current chart data.
export const CHAT_STORE_LIMIT=2000000;
export const validChatId=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value);
export function cleanChatMessage(value,role){
 if(!value||value.role!==role||typeof value.content!=='string'||!value.content.trim()||value.content.length>30000)throw Error('הודעה אינה תקינה או ארוכה מדי לשמירה.');
 const result={role,content:value.content};
 if(value.chartContext){const c=value.chartContext;result.chartContext={symbol:String(c.symbol||'').slice(0,30),source:String(c.source||'unknown').slice(0,30),interval:String(c.interval||'').slice(0,20),receivedAt:typeof c.receivedAt==='string'?c.receivedAt.slice(0,40):null}}
 return result;
}
export function updateChatStore(previous,body,now=new Date().toISOString()){
 const store=previous||{revision:'',conversations:[]};
 if(!validChatId(body.id))throw Error('מזהה שיחה אינו תקין.');
 let conversations=store.conversations.slice(),deletedIds=store.deletedIds||[];
 if(body.action==='delete'){conversations=conversations.filter(c=>c.id!==body.id);deletedIds=[...new Set([...deletedIds,body.id])]}
 else if(body.action==='append'){
  if(deletedIds.includes(body.id))throw Error('השיחה נמחקה במכשיר אחר. פתח שיחה חדשה.');
  if(!validChatId(body.turnId)||!Array.isArray(body.messages)||body.messages.length!==2)throw Error('נדרש זוג של שאלה ותשובה.');
  const pair=[cleanChatMessage(body.messages[0],'user'),cleanChatMessage(body.messages[1],'assistant')];
  const old=conversations.find(c=>c.id===body.id);
  if(old?.turnIds.includes(body.turnId))return store;
  if(!old&&conversations.length>=100)throw Error('נשמרו 100 שיחות. יצא ומחק שיחה לפני פתיחת שיחה נוספת.');
  if(old&&old.messages.length>=400)throw Error('השיחה מלאה. פתח שיחה חדשה כדי להמשיך לשמור.');
  const item={id:body.id,title:old?.title||pair[0].content.slice(0,100),createdAt:old?.createdAt||now,updatedAt:now,turnIds:[...(old?.turnIds||[]),body.turnId],messages:[...(old?.messages||[]),...pair]};
  conversations=[item,...conversations.filter(c=>c.id!==body.id)];
 }else throw Error('פעולה אינה תקינה.');
 const result={revision:store.revision,conversations,deletedIds};
 if(new TextEncoder().encode(JSON.stringify(result)).length>CHAT_STORE_LIMIT)throw Error('אחסון השיחות מלא. יצא ומחק שיחות כדי לפנות מקום.');
 return result;
}
