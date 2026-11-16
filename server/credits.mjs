import {randomUUID} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
import {billingIdentity,readBilling} from './billing.mjs';
import {creditWindow,creditsEnabled,creditsForCost} from './plans.mjs';
const RESERVE=`-- weekly-credit-reserve
local n=tonumber(redis.call('GET',KEYS[1]) or '0')
if n+tonumber(ARGV[1])>tonumber(ARGV[2]) then return -1 end
redis.call('INCRBY',KEYS[1],ARGV[1]);redis.call('EXPIRE',KEYS[1],2678400)
redis.call('SET',KEYS[2],ARGV[1],'EX',2678400)
return n+tonumber(ARGV[1])`;
const REFUND=`-- weekly-credit-refund
local n=redis.call('GET',KEYS[2]);if not n then return 0 end
redis.call('DEL',KEYS[2]);redis.call('DECRBY',KEYS[1],n);return 1`;
export async function creditStatus(memberId,{env=process.env,run=command,now=Date.now()}={}){
 if(!creditsEnabled(env))return null;
 const identity=await billingIdentity(memberId,{env,run}),record=await readBilling(identity,{env,run}),window=creditWindow(record,now);
 if(!window)return null;
 const key=storageKey(`credits:${identity}:${window.key}`,env),used=Number(await run(['GET',key],{env})||0);
 if(!Number.isSafeInteger(used)||used<0)throw Error('Invalid credit balance');
 return {...window,used,remaining:Math.max(0,window.limit-used)};
}
export async function reserveCredits(memberId,maxCostUsd,{env=process.env,run=command,now=Date.now()}={}){
 if(!creditsEnabled(env))return null;
 const identity=await billingIdentity(memberId,{env,run}),record=await readBilling(identity,{env,run});
 if(record?.paidUntil>now&&!record.planId)return null;
 const window=creditWindow(record,now);if(!window)throw Error('No credit entitlement');
 const cost=creditsForCost(maxCostUsd),key=storageKey(`credits:${identity}:${window.key}`,env),reservation=key+':request:'+randomUUID();
 const used=await run(['EVAL',RESERVE,'2',key,reservation,String(cost),String(window.limit)],{env});
 if(used===-1){const error=Error('מכסת הקרדיטים השבועית נוצלה. אפשר לשדרג או להמתין לחידוש.');error.status=402;throw error;}
 if(!Number.isSafeInteger(used)||used<cost)throw Error('Credit reservation failed');
 return {credits:cost,remaining:Math.max(0,window.limit-used),resetsAt:window.resetsAt,refund:()=>run(['EVAL',REFUND,'2',key,reservation],{env})};
}
