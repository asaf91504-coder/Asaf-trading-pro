import {createHash,randomUUID} from 'node:crypto';
import {sharedScannerKey,readSharedScan} from './shared-scanner.mjs';
import {MarketError} from './market-feed.mjs';
import {closedSetupAtr14,stopWithinSetupAtr,exactTwoAtrStop} from './setup-atr.mjs';
const atrError='מרחק הסטופ ממחיר הכניסה חייב להיות בדיוק 2 ATR יומי.';
export function canReviewSetups(user,env){const owner=env.ASAF_SETUPS_REVIEWER_MEMBER_ID;return !!user&&/^[a-f0-9-]{36}$/.test(owner||'')&&user.id===owner}
const PRICE_FIELDS=['entry','stop','target'];
function ordered(s){
 return PRICE_FIELDS.every(k=>Number.isFinite(s?.[k])&&s[k]>0)
  &&(s.side==='long'?s.stop<s.entry&&s.entry<s.target:s.side==='short'&&s.target<s.entry&&s.entry<s.stop);
}
export function draftText(value,max,allowLines){
 if(typeof value!=='string')throw new MarketError('הכותרת או הניתוח אינם תקינים.',400);
 const normalized=value.replace(/\r\n/g,'\n').trim();
 const single=allowLines?normalized.replace(/\n/g,''):normalized;
 if([...normalized].length>max||/[\p{Cc}\p{Cs}\u202a-\u202e\u2066-\u2069]/u.test(single))throw new MarketError('הכותרת או הניתוח אינם תקינים.',400);
 return normalized;
}
function applyDraft(item,draft){
 return {...item,scenario:{side:item.scenario.side,...Object.fromEntries(PRICE_FIELDS.map(k=>[k,draft[k]]))},
  ...(draft.title?{title:draft.title}:{}),...(draft.analysis?{analysis:draft.analysis}:{}),edited:true};
}
function publishedItem(item,approvedAt){
 const {id,symbol,pattern,stage,candleDate,source,receivedAt,scanAt,scenario:{side,entry,stop,target}}=item;
 return {id,symbol,pattern,stage,candleDate,source,receivedAt,scanAt,scenario:{side,entry,stop,target},approvedAt,
  ...(item.edited===true?{edited:true,...(item.title?{title:item.title}:{}),...(item.analysis?{analysis:item.analysis}:{})}:{})};
}
export function setupCandidates(scan){return scan.records.flatMap(r=>{
 const atr14=closedSetupAtr14(r);
 if(atr14===null)return [];
 return (r.research?.candidates||[]).flatMap(c=>{
  if(!c.scenario)return [];
  const {side,entry,target}=c.scenario;
  const scenario=exactTwoAtrStop({side,entry,target},atr14);
  if(!ordered(scenario))return [];
  // Version the candidate identity so an old visible card cannot approve
  // a scenario after a release changes its underlying stop.
  const id=createHash('sha256').update(JSON.stringify(['atr14-exact-2:v2',scan.startedAt,r.symbol,c.kind,scenario,atr14])).digest('hex');
  return [{id,symbol:r.symbol,pattern:c.label||c.kind,stage:c.stage,scenario,atr14,candleDate:r.summary.date,source:r.source,receivedAt:r.receivedAt,scanAt:scan.completedAt}];
 });
}).slice(0,200)}
export const REVIEW_COMMIT=`-- setup-review-cas
if (redis.call('GET',KEYS[1]) or '')~=ARGV[1] then return 0 end
if (redis.call('GET',KEYS[2]) or '')~=ARGV[2] then return 0 end
redis.call('SET',KEYS[2],ARGV[3],'EX',172800)
return 1`;
export async function setupReviewContext({env,run,now,memberId}){
 const scan=await readSharedScan({env,run,now,memberId});
 const key=sharedScannerKey(env),snapshot=await run(['GET',key+':snapshot'],{env});
 // Do not approve an entry from a scan that was replaced between reads.
 if(!snapshot||JSON.parse(snapshot).completedAt!==scan.completedAt)throw new MarketError('הסריקה עודכנה. רענן את העמוד.',409);
 const raw=await run(['GET',key+':reviews'],{env})||'';
 const book=raw?JSON.parse(raw):{};
 return {scan,key,snapshot,raw,book,candidates:setupCandidates(scan)};
}
function freshApproval(v,now){return v.status==='approved'&&now-Date.parse(v.item.scanAt)<86400000}
export function visibleSetups(context,reviewer,now){
 const {scan,book,candidates}=context;
 const published=Object.values(book).filter(v=>freshApproval(v,now)).map(v=>publishedItem(v.item,v.at));
 return {reviewer,published,completedAt:scan.completedAt,nextUpdateAt:scan.nextUpdateAt,stale:scan.stale,partial:scan.partial,...(reviewer?{queue:candidates.map(item=>{
  const entry=book[item.id],draft=entry?.draft;
  if(entry?.status==='approved'&&entry.original)return {...publishedItem(entry.item,entry.at),status:'approved',originalScenario:item.scenario};
  return {...item,status:entry?.status||'pending',...(entry?.status!=='approved'&&draft?{draft:{revision:draft.revision,title:draft.title,analysis:draft.analysis,...Object.fromEntries(PRICE_FIELDS.map(k=>[k,draft[k]]))}}:{})};
 })}:{})};
}
function checkRevision(expected,stored){
 if((expected??null)!==(stored??null))throw new MarketError('הטיוטה השתנתה. רענן את העמוד לפני שמירה או אישור.',409);
}
async function writeReview(context,id,record,{env,run,now}){
 // Keep reviews for this scan and still-published items only. A new scan never inherits a draft.
 const ids=new Set(context.candidates.map(c=>c.id));
 const book=Object.fromEntries(Object.entries(context.book).filter(([key,v])=>ids.has(key)||freshApproval(v,now)));
 if(!Object.hasOwn(book,id)&&Object.keys(book).length>=1000)throw new MarketError('תור האישור מלא. נסה לאחר פקיעת הסטאפים הישנים.',429);
 book[id]=record;
 const committed=await run(['EVAL',REVIEW_COMMIT,'2',context.key+':snapshot',context.key+':reviews',context.snapshot,context.raw,JSON.stringify(book)],{env});
 if(committed!==1)throw new MarketError('הנתונים השתנו בזמן השמירה. רענן ונסה שוב.',409);
}
export async function saveSetupDraft(context,{id,edits,revision,user,env,run,now}){
 if(!canReviewSetups(user,env))throw new MarketError('רק בעל הרשאת האישור יכול לשנות סטאפים.',403);
 const original=context.candidates.find(c=>c.id===id),existing=context.book[id];
 if(!original||existing&&existing.status!=='pending'||context.scan.stale)throw new MarketError('אפשר לערוך רק מועמד שממתין לאישור בסריקה המעודכנת.',409);
 checkRevision(revision,existing?.draft?.revision);
 if(!edits||typeof edits!=='object'||Array.isArray(edits)||Object.keys(edits).length!==5||!['title','analysis',...PRICE_FIELDS].every(k=>Object.hasOwn(edits,k)))throw new MarketError('שדות הטיוטה אינם תקינים.',400);
 const scenario={side:original.scenario.side,...Object.fromEntries(PRICE_FIELDS.map(k=>[k,edits[k]]))};
 if(!ordered(scenario)||PRICE_FIELDS.some(k=>scenario[k]>1e12))throw new MarketError('בלונג הסטופ נמוך מהכניסה והיעד גבוה ממנה. בשורט הסדר הפוך. הזן רמות חיוביות שונות.',400);
 if(!stopWithinSetupAtr(scenario,original.atr14))throw new MarketError(atrError,400);
 const draft={revision:randomUUID(),title:draftText(edits.title,80,false),analysis:draftText(edits.analysis,400,true),...Object.fromEntries(PRICE_FIELDS.map(k=>[k,scenario[k]]))};
 await writeReview(context,id,{status:'pending',at:new Date(now).toISOString(),reviewer:user.id,item:original,draft},{env,run,now});
 return {status:'pending',id,revision:draft.revision};
}
export async function decideSetup(context,{id,decision,revision,user,env,run,now}){
 if(!canReviewSetups(user,env))throw new MarketError('רק בעל הרשאת האישור יכול לשנות סטאפים.',403);
 if(!['approved','rejected'].includes(decision))throw new MarketError('בחירה לא תקינה.',400);
 const existing=context.book[id];
 const item=context.candidates.find(c=>c.id===id)||(decision==='rejected'&&existing?.status==='approved'?existing.item:null);
 if(!item)throw new MarketError('המועמד כבר אינו בסריקה הנוכחית. רענן את העמוד.',409);
 if(context.scan.stale&&decision==='approved')throw new MarketError('הסריקה אינה מעודכנת. המתן לרענון לפני אישור.',409);
 if(decision==='approved'&&existing?.status==='approved')return {status:decision,id};
 const draft=existing?.draft;
 if(decision==='approved')checkRevision(revision,draft?.revision);
 // Keep the generated scenario and exact approved edit separately. A rejected
 // draft cannot accidentally be reapproved from a stale screen.
 const original=existing?.original||item;
 const effective=decision==='approved'&&draft?applyDraft(original,draft):item;
 if(decision==='approved'&&!stopWithinSetupAtr(effective.scenario,item.atr14))throw new MarketError(atrError,400);
 await writeReview(context,id,{status:decision,at:new Date(now).toISOString(),reviewer:user.id,item:effective,...(draft?{draft,original}:{})},{env,run,now});
 return {status:decision,id};
}
