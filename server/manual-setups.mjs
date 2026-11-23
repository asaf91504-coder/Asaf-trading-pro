import {randomBytes,randomUUID} from 'node:crypto';
import {MarketError} from './market-feed.mjs';
import {storageKey} from './storage.mjs';
import {isChatOwner} from './owner-chat.mjs';
import {canReviewSetups,draftText} from './setup-review.mjs';
import {exactTwoAtrStop} from './setup-atr.mjs';

const DAY=86400000, LIMIT=60;
const SYMBOL=/^(?:[A-Z0-9]{2,12}:)?[A-Z0-9][A-Z0-9.-]{0,19}$/;
const fields=['entry','target','title','analysis'];
const invalid=()=>new MarketError('שדות הסטאפ הידני אינם תקינים.',400);
const conflict=()=>new MarketError('טיוטת הסטאפ השתנתה. רענן את העמוד ונסה שוב.',409);
export const canAuthorSetup=(user,env)=>isChatOwner(user,env)&&canReviewSetups(user,env);
export const MANUAL_COMMIT=`-- manual-setup-cas
if (redis.call('GET',KEYS[1]) or '')~=ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2])
return 1`;

const isRecent=(at,now)=>{const age=now-Date.parse(at);return age>=0&&age<DAY};
const isPublished=(record,now)=>record.status==='approved'&&isRecent(record.at,now);
export async function manualSetupBook({env,run}){
 const key=storageKey('setups:owner-authored:v1',env);
 const raw=await run(['GET',key],{env})||'';
 const records=raw?JSON.parse(raw):{};
 if(!records||typeof records!=='object'||Array.isArray(records))throw new Error('Invalid manual setup book');
 return {key,raw,records};
}
function publicRecord(record){
 const {id,symbol,scenario,title,analysis,createdAt}=record.item;
 return {id,symbol,scenario,title,analysis,createdAt,manual:true,pattern:'רעיון ידני של אסף',approvedAt:record.at};
}
export function manualSetupView(book,owner,now){
 return {published:Object.values(book.records).filter(r=>isPublished(r,now)).map(publicRecord),
  ...(owner?{manualQueue:Object.values(book.records).filter(r=>r.status==='pending'||isRecent(r.at,now)).sort((a,b)=>b.at.localeCompare(a.at)).map(r=>
   ({...r.item,manual:true,pattern:'רעיון ידני של אסף',status:r.status,...(r.status==='approved'?{approvedAt:r.at}:{}),draft:{revision:r.revision,
    title:r.item.title,analysis:r.item.analysis,entry:r.item.scenario.entry,stop:r.item.scenario.stop,target:r.item.scenario.target}}))}:{})};
}
function values(data,keys,side,atr14){
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==keys.length||!keys.every(k=>Object.hasOwn(data,k)))throw invalid();
 if(!['long','short'].includes(side)||![data.entry,data.target,atr14].every(n=>Number.isFinite(n)&&n>0&&n<=1e12))throw invalid();
 const scenario=exactTwoAtrStop({side,entry:data.entry,target:data.target},atr14);
 if(!scenario||(side==='long'?!(scenario.stop<scenario.entry&&scenario.entry<scenario.target):!(scenario.target<scenario.entry&&scenario.entry<scenario.stop))||scenario.stop>1e12)throw invalid();
 const title=draftText(data.title,80,false),analysis=draftText(data.analysis,400,true);
 if(!analysis)throw invalid();
 return {scenario,title,analysis};
}
export async function writeManualSetup(body,{user,env,run,now}){
 if(!canAuthorSetup(user,env))throw new MarketError('רק בעל החשבון יכול ליצור ולשנות סטאפים ידניים.',403);
 const creating=body.action==='create-manual-draft';
 const editing=body.action==='edit-manual-draft';
 const deciding=body.action==='decide-manual';
 if(creating&&(Object.keys(body).length!==2||!Object.hasOwn(body,'idea'))||
    editing&&(Object.keys(body).length!==4||!Object.hasOwn(body,'edits'))||
    deciding&&(Object.keys(body).length!==4||!['approved','rejected'].includes(body.decision))||
    !creating&&(!/^[a-f0-9]{64}$/.test(body.id||'')||typeof body.revision!=='string'))throw invalid();
 const {key,raw,records}=await manualSetupBook({env,run});
 const at=new Date(now).toISOString(),id=creating?randomBytes(32).toString('hex'):body.id,revision=randomUUID();
 const existing=records[id];
 let record;
 if(creating){
  const idea=body.idea;
  if(!idea||typeof idea.symbol!=='string'||!SYMBOL.test(idea.symbol.trim().toUpperCase())||idea.ownAnalysis!==true)throw invalid();
  const details=values(idea,[...fields,'symbol','side','atr14','ownAnalysis'],idea.side,idea.atr14);
  record={status:'pending',at,revision,item:{id,symbol:idea.symbol.trim().toUpperCase(),atr14:idea.atr14,createdAt:at,...details}};
 }else{
  if(!existing||existing.revision!==body.revision)throw conflict();
  if(editing){
   if(existing.status!=='pending')throw conflict();
   const details=values(body.edits,fields,existing.item.scenario.side,existing.item.atr14);
   record={status:'pending',at,revision,item:{...existing.item,...details}};
  }else{
   if((body.decision==='approved'&&existing.status!=='pending')||
      (body.decision==='rejected'&&!['pending','approved'].includes(existing.status)))throw conflict();
   record={...existing,revision,status:body.decision,at};
  }
 }
 const retained=Object.fromEntries(Object.entries(records).filter(([,r])=>r.status==='pending'||isRecent(r.at,now)));
 // Pending drafts are persistent; confirmed rejection frees their slot immediately.
 const active=Object.values(retained).filter(r=>r.status!=='rejected').length;
 if(creating&&active>=LIMIT)throw new MarketError('תור הרעיונות הידניים מלא. אפשר להסיר טיוטה ישנה ולנסות שוב.',429);
 const updated={...retained,[id]:record};
 const rejected=Object.entries(updated).filter(([,r])=>r.status==='rejected').sort(([,a],[,b])=>b.at.localeCompare(a.at));
 for(const [oldId] of rejected.slice(LIMIT))delete updated[oldId];
 if(await run(['EVAL',MANUAL_COMMIT,'1',key,raw,JSON.stringify(updated)],{env})!==1)throw conflict();
 return {id,revision,status:record.status};
}
