import {createHash} from 'node:crypto';
import {sharedScannerKey,readSharedScan} from './shared-scanner.mjs';
import {MarketError} from './market-feed.mjs';
export function canReviewSetups(user,env){const owner=env.ASAF_SETUPS_REVIEWER_MEMBER_ID;return !!user&&/^[a-f0-9-]{36}$/.test(owner||'')&&user.id===owner}
export function setupCandidates(scan){return scan.records.flatMap(r=>(r.research?.candidates||[]).filter(c=>c.scenario&&['long','short'].includes(c.scenario.side)&&['entry','stop','target'].every(k=>Number.isFinite(c.scenario[k])&&c.scenario[k]>0)).map(c=>{
 const scenario={side:c.scenario.side,entry:c.scenario.entry,stop:c.scenario.stop,target:c.scenario.target};
 const id=createHash('sha256').update(JSON.stringify([scan.startedAt,r.symbol,c.kind,scenario])).digest('hex');
 return {id,symbol:r.symbol,pattern:c.label||c.kind,stage:c.stage,scenario,candleDate:r.summary.date,source:r.source,receivedAt:r.receivedAt,scanAt:scan.completedAt};
})).slice(0,200)}
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
export function visibleSetups(context,reviewer,now){
 const {scan,book,candidates}=context;
 const published=Object.values(book).filter(v=>v.status==='approved'&&now-Date.parse(v.item.scanAt)<86400000).map(v=>({...v.item,approvedAt:v.at}));
 return {reviewer,published,completedAt:scan.completedAt,nextUpdateAt:scan.nextUpdateAt,stale:scan.stale,partial:scan.partial,...(reviewer?{queue:candidates.map(item=>({...item,status:book[item.id]?.status||'pending'}))}:{})};
}
export async function decideSetup(context,{id,decision,user,env,run,now}){
 if(!canReviewSetups(user,env))throw new MarketError('רק בעל הרשאת האישור יכול לשנות סטאפים.',403);
 if(!['approved','rejected'].includes(decision))throw new MarketError('בחירה לא תקינה.',400);
 const item=context.candidates.find(c=>c.id===id)||(decision==='rejected'&&context.book[id]?.status==='approved'?context.book[id].item:null);
 if(!item)throw new MarketError('המועמד כבר אינו בסריקה הנוכחית. רענן את העמוד.',409);
 if(context.scan.stale&&decision==='approved')throw new MarketError('הסריקה אינה מעודכנת. המתן לרענון לפני אישור.',409);
 // Keep current decisions and recent published entries; never auto-approve a new scan.
 const ids=new Set(context.candidates.map(c=>c.id));
 const book=Object.fromEntries(Object.entries(context.book).filter(([key,v])=>ids.has(key)||(v.status==='approved'&&now-Date.parse(v.item.scanAt)<86400000)));
 if(!book[id]&&Object.keys(book).length>=1000)throw new MarketError('תור האישור מלא. נסה לאחר פקיעת הסטאפים הישנים.',429);
 book[id]={status:decision,at:new Date(now).toISOString(),reviewer:user.id,item};
 const committed=await run(['EVAL',REVIEW_COMMIT,'2',context.key+':snapshot',context.key+':reviews',context.snapshot,context.raw,JSON.stringify(book)],{env});
 if(committed!==1)throw new MarketError('הנתונים השתנו בזמן האישור. רענן ונסה שוב.',409);
 return {status:decision,id};
}
