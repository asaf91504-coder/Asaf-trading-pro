import {isChatOwner} from './owner-chat.mjs';
import {randomUUID} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
import {billingIdentity,readBilling} from './billing.mjs';
import {WEEK,creditWindow,creditsEnabled,creditsForCost} from './plans.mjs';
const RESERVE=`-- weekly-credit-reserve
local n=tonumber(redis.call('GET',KEYS[1]) or '0')
if n+tonumber(ARGV[1])>tonumber(ARGV[2]) then return -1 end
redis.call('INCRBY',KEYS[1],ARGV[1]);if ARGV[3]=='trial' then redis.call('PERSIST',KEYS[1]) else redis.call('EXPIRE',KEYS[1],2678400) end
redis.call('SET',KEYS[2],ARGV[1],'EX',2678400)
return n+tonumber(ARGV[1])`;
const REFUND=`-- weekly-credit-refund
local n=redis.call('GET',KEYS[2]);if not n then return 0 end
redis.call('DEL',KEYS[2]);redis.call('DECRBY',KEYS[1],n);return 1`;
const MIGRATE_TRIAL=`-- trial-total-migration
if redis.call('EXISTS',KEYS[1])==1 then return 1 end
local used=0
for i=2,#KEYS do
 local n=tonumber(redis.call('GET',KEYS[i]) or '0')
 if not n or n<0 or n~=math.floor(n) then return redis.error_reply('Invalid legacy credit usage') end
 used=used+n
end
redis.call('SET',KEYS[1],used)
return 1`;
export const bonusUsedKey=(identity,env)=>storageKey(`credits:${identity}:bonus-used`,env);
export function bonusCreditTotal(record){const total=record?.bonusCredits??0;if(!Number.isSafeInteger(total)||total<0||total>1000000000)throw Error('Invalid gift credit total');return total;}
const BONUS_RESERVE=`-- gifted-credit-reserve
local n=tonumber(redis.call('GET',KEYS[1]) or '0')
local g=tonumber(redis.call('GET',KEYS[3]) or '0')
local cost=tonumber(ARGV[1]);local limit=tonumber(ARGV[2]);local total=tonumber(ARGV[3])
if not n or not g or n<0 or g<0 or n~=math.floor(n) or g~=math.floor(g) then return redis.error_reply('Invalid credit usage') end
local base=math.min(cost,math.max(0,limit-n));local gift=cost-base
if g+gift>total then return -1 end
redis.call('INCRBY',KEYS[1],base);redis.call('INCRBY',KEYS[3],gift)
if ARGV[4]=='trial' then redis.call('PERSIST',KEYS[1]) else redis.call('EXPIRE',KEYS[1],2678400) end
redis.call('PERSIST',KEYS[3]);redis.call('SET',KEYS[2],cjson.encode({base=base,gift=gift}),'EX',2678400)
return {n+base,g+gift}`;
const BONUS_REFUND=`-- gifted-credit-refund
local raw=redis.call('GET',KEYS[2]);if not raw then return 0 end
local amount=cjson.decode(raw);redis.call('DEL',KEYS[2])
redis.call('DECRBY',KEYS[1],amount.base);redis.call('DECRBY',KEYS[3],amount.gift);return 1`;
async function initializeTrial(identity,window,{env,run,now}){
 if(window.planId!=='trial')return;
 const count=Math.floor((now-window.startsAt)/WEEK)+1;
 if(count>5200)throw Error('Invalid trial age');
 const keys=[storageKey(`credits:${identity}:${window.key}`,env),...Array.from({length:count},(_,i)=>storageKey(`credits:${identity}:trial:${window.startsAt}:${i}`,env))];
 if(await run(['EVAL',MIGRATE_TRIAL,String(keys.length),...keys],{env})!==1)throw Error('Trial migration failed');
}
// Two internal testers may receive 100 total credits on their existing
// trials. Require a complete strictly validated private configuration; never
// change a trial anchor, saved entitlement, or usage key.
function accountCreditWindow(record,identity,env,now){
 const configured=env.ASAF_INTERNAL_TESTER_BILLING_IDS?.split(',')||[];
 const window=creditWindow(record,now);
 return window?.planId==='trial'&&configured.length===2&&configured[0]!==configured[1]&&configured.every(value=>/^[a-f0-9]{64}$/.test(value))&&configured.includes(identity)
  ?{...window,limit:Math.max(window.limit,100)}:window;
}
export async function creditStatus(memberId,{env=process.env,run=command,now=Date.now()}={}){
 if(isChatOwner({id:memberId},env))return {unlimited:true,planId:'owner',limit:null,used:0,remaining:null,resetsAt:null};
 if(!creditsEnabled(env))return null;
 const identity=await billingIdentity(memberId,{env,run}),record=await readBilling(identity,{env,run}),window=accountCreditWindow(record,identity,env,now);
 if(!window)return null;
 await initializeTrial(identity,window,{env,run,now});
 const key=storageKey(`credits:${identity}:${window.key}`,env),used=Number(await run(['GET',key],{env})||0);
 if(!Number.isSafeInteger(used)||used<0)throw Error('Invalid credit balance');
 const bonusTotal=bonusCreditTotal(record),bonusUsed=Number(await run(['GET',bonusUsedKey(identity,env)],{env})||0);
 if(!Number.isSafeInteger(bonusUsed)||bonusUsed<0||bonusUsed>bonusTotal)throw Error('Invalid gift usage');
 return {...window,baseRemaining:Math.max(0,window.limit-used),baseLimit:window.limit,limit:window.limit+bonusTotal,used:used+bonusUsed,bonusRemaining:bonusTotal-bonusUsed,remaining:Math.max(0,window.limit-used)+bonusTotal-bonusUsed};
}
export async function reserveCredits(memberId,maxCostUsd,{env=process.env,run=command,now=Date.now()}={}){
 if(isChatOwner({id:memberId},env))return null;
 if(!creditsEnabled(env))return null;
 const identity=await billingIdentity(memberId,{env,run}),record=await readBilling(identity,{env,run});
 if(record?.paidUntil>now&&!record.planId)return null;
 const window=accountCreditWindow(record,identity,env,now);if(!window)throw Error('No credit entitlement');
 await initializeTrial(identity,window,{env,run,now});
 const cost=creditsForCost(maxCostUsd),key=storageKey(`credits:${identity}:${window.key}`,env),reservation=key+':request:'+randomUUID();
 const bonusTotal=bonusCreditTotal(record);
 if(bonusTotal){
  const bonusKey=bonusUsedKey(identity,env),counts=await run(['EVAL',BONUS_RESERVE,'3',key,reservation,bonusKey,String(cost),String(window.limit),String(bonusTotal),window.planId],{env});
  if(counts===-1)throw Object.assign(Error('מכסת הקרדיטים נוצלה.'),{status:402});
  if(!Array.isArray(counts)||counts.length!==2||counts.some(n=>!Number.isSafeInteger(n)||n<0)||counts[1]>bonusTotal)throw Error('Gift credit reservation failed');
  return {credits:cost,remaining:Math.max(0,window.limit-counts[0])+bonusTotal-counts[1],resetsAt:window.resetsAt,refund:()=>run(['EVAL',BONUS_REFUND,'3',key,reservation,bonusKey],{env})};
 }
 const used=await run(['EVAL',RESERVE,'2',key,reservation,String(cost),String(window.limit),window.planId],{env});
 if(used===-1){const error=Error(window.planId==='trial'?`${window.limit} הקרדיטים החינמיים נוצלו. הם אינם מתחדשים. אפשר לשדרג למנוי.`:'מכסת הקרדיטים השבועית נוצלה. אפשר לשדרג או להמתין לחידוש.');error.status=402;throw error;}
 if(!Number.isSafeInteger(used)||used<cost)throw Error('Credit reservation failed');
 return {credits:cost,remaining:Math.max(0,window.limit-used),resetsAt:window.resetsAt,refund:()=>run(['EVAL',REFUND,'2',key,reservation],{env})};
}
