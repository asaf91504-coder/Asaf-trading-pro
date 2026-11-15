import {screenResult} from '../scanner-core.mjs';
import {marketCapAvailable,newYorkDate} from '../market-quality.mjs';
import {command,storageKey} from './storage.mjs';
export const SCANNER_RULE_VERSION='scanner-entry-v1';
export const SCANNER_ENTRY_FILTERS=Object.freeze({minMarketCap:1e9,minPrice:5,above20:true,risingVolume:true,crossedOnly:true,scenarioSide:'long'});
export function scannerEntryStatus(record,now=Date.now()) {
 const a=record?.summary,bars=record?.bars;
 if(record?.interval!=='1day'||record?.barPolicy!=='previous-daily-sessions'||record?.latestBarMayBePartial!==false||
 !Array.isArray(bars)||bars.length<21||!marketCapAvailable(record,now)||!record.research?.available||
 ![a?.close,a?.sma20,a?.volumeRatio].every(Number.isFinite)||!a?.date||a.date!==bars.at(-1)?.date||a.date>=newYorkDate(now)||now-Date.parse(a.date)>7*86400000) return 'unknown';
 // marketCapAvailable was checked with injected time above; screenResult's default
 // wall clock is avoided here by checking its already-validated threshold explicitly.
 return record.fundamentals.marketCap>=1e9&&screenResult(record,{...SCANNER_ENTRY_FILTERS,minMarketCap:0}).matches?'pass':'fail';
}
export const SCANNER_ENTRY_SAVE=`-- scanner-entry-save
if redis.call('GET',KEYS[1])~=ARGV[1] then return -1 end
local member=cjson.decode(ARGV[1]);if member.enabled~=true then return -1 end
local state=cjson.decode(redis.call('GET',KEYS[2]) or '{}')
local s=cjson.decode(ARGV[2]);local key='scanner-entry:'..s.symbol
local old=state[key]
if old and old.version==s.version and old.date>=s.date then return 0 end
local added=0
if old and old.version==s.version and old.status=='fail' and s.status=='pass' then
 local inbox=cjson.decode(redis.call('GET',KEYS[3]) or '[]')
 table.insert(inbox,1,cjson.decode(ARGV[3]));while #inbox>100 do table.remove(inbox) end
 redis.call('SET',KEYS[3],cjson.encode(inbox));added=1
end
state[key]=s;redis.call('SET',KEYS[2],cjson.encode(state));return added`;
export async function saveScannerEntry(record,user,{env=process.env,run=command,now=Date.now()}={}) {
 const status=scannerEntryStatus(record,now);if(status==='unknown')return {status,added:0};
 if(!user?.memberRaw)throw Error('Verified member record required');
 const a=record.summary,version=SCANNER_RULE_VERSION;
 const evidence={close:a.close,ma20:a.sma20,ma150:a.sma150,atr14:a.atr14,atrPercent:a.atrPercent,volumeRatio:a.volumeRatio,marketCap:record.fundamentals.marketCap,patterns:record.research.candidates.filter(c=>c.stage==='crossed'&&c.scenario?.side==='long').map(c=>({kind:c.kind,stage:c.stage})),coverage:record.coverage};
 const event={key:JSON.stringify([version,record.symbol,a.date]),symbol:record.symbol,kind:'scanner-entry',barTime:a.date,close:a.close,source:record.source,createdAt:new Date(now).toISOString(),evidence,message:record.symbol+' · נכנסה לתנאי הסריקה · נר סגור '+a.date+' · מחיר '+a.close+' · MA20 '+a.sma20+' · MA150 '+(a.sma150??'לא זמין')+' · ATR% '+(a.atrPercent??'לא זמין')+' · מחזור יחסי '+a.volumeRatio};
 const added=await run(['EVAL',SCANNER_ENTRY_SAVE,'3',storageKey('auth:member:'+user.id,env),storageKey('alerts:state:'+user.id,env),storageKey('alerts:inbox:'+user.id,env),user.memberRaw,JSON.stringify({symbol:record.symbol,date:a.date,status,version}),JSON.stringify(event)],{env});
 if(added<0)throw Error('Account changed');return {status,added};
}
