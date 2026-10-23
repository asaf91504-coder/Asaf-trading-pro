import {command,storageKey} from './storage.mjs';
import {publicMarketConfigured,approvedMarketSymbols,marketSelection,readMarketSnapshot} from './market-feed.mjs';
import {alertCandidate} from '../alert-core.mjs';
export const ALERT_APPEND=`-- alert-inbox-append
if redis.call('GET',KEYS[1])~=ARGV[1] or redis.call('GET',KEYS[2])~=ARGV[2] then return 0 end
local seen=cjson.decode(redis.call('GET',KEYS[3]) or '{}');local inbox=cjson.decode(redis.call('GET',KEYS[4]) or '[]');local events=cjson.decode(ARGV[3]);local added=0
for _,e in ipairs(events) do if seen[e.ruleId]~=e.key then seen[e.ruleId]=e.key;table.insert(inbox,1,e);added=added+1 end end
while #inbox>100 do table.remove(inbox) end
redis.call('SET',KEYS[3],cjson.encode(seen));redis.call('SET',KEYS[4],cjson.encode(inbox));return added`;
export async function runMarketCycle({env=process.env,run=command,fetcher=fetch,now=()=>Date.now()}={}){
 if(env.ASAF_BACKGROUND_REFRESH_ENABLED!=='true'||!publicMarketConfigured(env)||!storageKey('x',env).startsWith('asaf:production:'))return {enabled:false,refreshed:0,notifications:0};
 const time=now(),slot=Math.floor(time/900000);if(await run(['SET',storageKey('market:background-slot:'+slot,env),'reserved','NX','EX','1800'],{env})!=='OK')return {enabled:true,duplicate:true,refreshed:0,notifications:0};
 const symbols=approvedMarketSymbols(env);for(const s of symbols)marketSelection(s,'1day',env);
 const cursorKey=storageKey('market:background-cursor',env),cursor=Number(await run(['GET',cursorKey],{env})||0)%symbols.length,selected=Array.from({length:Math.min(2,symbols.length)},(_,i)=>symbols[(cursor+i)%symbols.length]);
 const snapshots=new Map(),failures=[];await Promise.all(selected.map(async symbol=>{try{snapshots.set(symbol,await readMarketSnapshot({selected:symbol,env,run,fetcher,now:time}))}catch{failures.push(symbol)}}));await run(['SET',cursorKey,String((cursor+selected.length)%symbols.length)],{env});
 const members=(await run(['SMEMBERS',storageKey('alerts:members',env)],{env})||[]).filter(id=>/^[a-f0-9-]{36}$/.test(id)).sort().slice(0,100);let notifications=0;
 if(now()-time>20000)return {enabled:true,refreshed:snapshots.size,notifications,partial:true};
 const all=members.length?await run(['MGET',...members.flatMap(id=>[storageKey('auth:member:'+id,env),storageKey('alerts:rules:'+id,env)])],{env}):[];
 await Promise.all(members.map(async (id,index)=>{try{const memberKey=storageKey('auth:member:'+id,env),rulesKey=storageKey('alerts:rules:'+id,env),[memberRaw,rulesRaw]=[all[index*2],all[index*2+1]];if(!memberRaw||!rulesRaw||JSON.parse(memberRaw).enabled!==true)return;const rules=JSON.parse(rulesRaw).rules;if(!Array.isArray(rules))return;const events=rules.slice(0,20).flatMap(rule=>{const snapshot=snapshots.get(rule.symbol.split(':').at(-1));const e=snapshot?alertCandidate(rule,snapshot.bars,time):null;return e?[e]:[]});if(!events.length||now()-time>23000)return;notifications+=await run(['EVAL',ALERT_APPEND,'4',memberKey,rulesKey,storageKey('alerts:state:'+id,env),storageKey('alerts:inbox:'+id,env),memberRaw,rulesRaw,JSON.stringify(events)],{env})}catch{}}));
 return {enabled:true,refreshed:snapshots.size,failed:failures,notifications,scope:'עד שתי מניות ועד 100 חשבונות במחזור; רוטציית מניות; התראות נרות יומיים סגורים בלבד.'};
}
