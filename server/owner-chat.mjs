// Never infer the owner from the first administrator, vendor settings,
// request payload, browser storage, or a legacy access code.
import {randomUUID} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isChatOwner(member,env=process.env){
 const id=env.ASAF_CHAT_OWNER_MEMBER_ID;
 return typeof id==='string'&&uuid.test(id)&&member?.id===id&&(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').some(admin=>admin.trim()===id);
}
// Four requests in any rolling 15 seconds, independent of the customer's
// application quota. One atomically enforced counter for all instances.
const BURST=`-- owner-chat-burst
local now=tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now-15000)
if redis.call('ZCARD', KEYS[1])>=4 then return 0 end
redis.call('ZADD', KEYS[1], now, ARGV[2])
redis.call('EXPIRE', KEYS[1], 30)
return 1`;
export async function reserveOwnerChatBurst(member,{env=process.env,run=command,now=Date.now()}={}){
 if(!isChatOwner(member,env))return false;
 return await run(['EVAL',BURST,'1',storageKey('ai:owner-burst:'+member.id,env),String(now),randomUUID()],{env})===1;
}
