import {personalData} from './personal-data.mjs';
export const journalStorageKey=member=>member?'asaf_trades_v1:member:'+member:'asaf_trades_v1';
export function journalIntent(text){
 return /(?:יומן|journal|trade log)/iu.test(text)&&/(?:הוסף|תוסיף|תרשום|רשום|שמור|תשמור|תעד|לתעד|add|save|record|log)/iu.test(text);
}
// Only explicit user-supplied fields become a draft. Never infer a fill from
// chart prices, a recommendation, or an assistant message.
export function journalDraft(text,{today=new Date().toLocaleDateString('en-CA')}={}){
 const raw=String(text);
 const symbol=raw.match(/(?:סימול|מניה|מניית|symbol|ticker)\s*[:=]?\s*\$?([A-Z][A-Z0-9.:-]{0,29})\b/i)?.[1]||raw.match(/\b([A-Z]{1,6})\b/)?.[1]||'';
 const value=(pattern)=>{const m=raw.match(new RegExp('(?:'+pattern+')\\s*[:=@]?\\s*\\$?((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)(?![\\d.,])','iu'));return m?Number(m[1].replaceAll(',','')):''};
 return {symbol:symbol.toUpperCase(),date:raw.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]||today,side:/(?:שורט|\bshort\b)/iu.test(raw)?'short':'long',entry:value('כניסה|קניתי ב[־-]?|entry'),exit:value('יציאה|מכרתי ב[־-]?|exit'),qty:value('כמות|qty|quantity'),fees:value('עמלות|fees'),setup:'',quality:'',note:''};
}
export function validatedJournalTrade(values,id){
 const trade={...values,id};
 for(const field of ['entry','qty','fees'])trade[field]=Number(values[field]);
 trade.exit=values.exit===''||values.exit===null?null:Number(values.exit);
 trade.symbol=String(values.symbol||'').trim().toUpperCase();
 return personalData('journal',[trade])[0];
}
export async function appendCloudTrade(trade,{memberId,getMember,fetcher=fetch}){
 const read=async(init)=>{if(getMember()!==memberId)throw Error('החשבון השתנה. לא בוצעה שמירה לחשבון אחר.');
  const response=await fetcher('/.netlify/functions/workspace',{cache:'no-store',signal:AbortSignal.timeout(12000),...init});
  const data=await response.json();if(!response.ok){const error=Error(data.error||'השמירה לחשבון נכשלה.');error.status=response.status;throw error;}
  if(getMember()!==memberId)throw Error('החשבון השתנה. בדוק את השמירה בחשבון המקורי.');return data;};
 for(let attempt=0;attempt<3;attempt++){
  const current=await read();
  const rows=personalData('journal',current.journal||[]);
  if(rows.some(t=>t.id===trade.id))return;
  const data=personalData('journal',[trade,...rows]);
  try{await read({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({section:'journal',data,memberId,revision:current.revision})});return;}
  catch(e){if(e.status!==409||attempt===2)throw e;}
 }
}
