import {createHash} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
import {twelveSettings} from './twelve-config.mjs';

const AGE=12*3600000;
export const providerQuotaKey=env=>storageKey('market:verified-quota:v1:'+createHash('sha256').update(env.TWELVE_DATA_API_KEY||'').digest('hex').slice(0,24),env);
export function verifiedQuota(data,env,now){
 const settings=twelveSettings(env),minute=Number(data?.plan_limit),category=String(data?.plan_category||'').toLowerCase();
 if(!Number.isSafeInteger(minute)||minute<1||minute>10000)return null;
 const perMinute=Math.min(settings.minuteCredits,minute);
 const daily=data.plan_daily_limit;
 if(daily!==undefined){
  if(!Number.isSafeInteger(daily)||daily<1)return null;
  return {minuteCredits:perMinute,dailyCredits:Math.min(settings.dailyCredits,daily),verifiedAt:now,paidUnlimited:false};
 }
 // The provider documents the absence of daily fields for paid plans. Require
 // a recognized paid category too; missing fields alone never increase a cap.
 if(!/^(venture|grow|pro|ultra|enterprise|business)(?:[ _-].*)?$/.test(category)||Object.hasOwn(data,'daily_usage'))return null;
 return {minuteCredits:perMinute,dailyCredits:Math.min(10000000,perMinute*1440),verifiedAt:now,paidUnlimited:true};
}
export async function readProviderQuota({env=process.env,run=command,now=Date.now()}={}){
 const settings=twelveSettings(env),fallback={minuteCredits:settings.minuteCredits,dailyCredits:settings.dailyCredits};
 try{
  const value=JSON.parse(await run(['GET',providerQuotaKey(env)],{env})||'null');
  if(!value||!Number.isFinite(value.verifiedAt)||now-value.verifiedAt<0||now-value.verifiedAt>=AGE||!Number.isSafeInteger(value.minuteCredits)||value.minuteCredits<1||!Number.isSafeInteger(value.dailyCredits)||value.dailyCredits<1||value.dailyCredits>10000000)return fallback;
  const minuteCredits=Math.min(settings.minuteCredits,value.minuteCredits);
  return {minuteCredits,dailyCredits:value.paidUnlimited===true?Math.min(value.dailyCredits,minuteCredits*1440):Math.min(settings.dailyCredits,value.dailyCredits),verifiedAt:value.verifiedAt,paidUnlimited:value.paidUnlimited===true};
 }catch{return fallback;}
}
// A single bounded account-introspection request can recover from our old daily
// cap. It still consumes the SAME global minute credit and daily usage counter.
// At most one attempt/hour; it cannot unlock data, a plan, or an entitlement.
const PROBE=`-- provider-quota-probe
if redis.call('EXISTS',KEYS[3])==1 then return 0 end
if tonumber(redis.call('GET',KEYS[1]) or '0')>=tonumber(ARGV[1]) then return 0 end
redis.call('SET',KEYS[3],'1','EX',3600)
redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120)
redis.call('INCR',KEYS[2]);redis.call('EXPIRE',KEYS[2],172800)
return 1`;
export async function syncProviderQuota({env=process.env,run=command,fetcher=fetch,now=Date.now()}={}){
 if(env.ASAF_EXTERNAL_SERVICES_APPROVED!=='true'||env.ASAF_MARKET_ENABLED!=='true'||env.ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED!=='true'||env.ASAF_HOURLY_SCANNER_ENABLED!=='true'||!['us1000','us10000'].includes(env.ASAF_SCANNER_UNIVERSE)||!env.TWELVE_DATA_API_KEY||(env.CONTEXT&&env.CONTEXT!=='production'))return {status:'disabled'};
 const existing=await readProviderQuota({env,run,now});if(existing.verifiedAt)return {status:'current',...existing};
 const minute=Math.floor(now/60000),day=new Date(now).toISOString().slice(0,10),settings=twelveSettings(env);
 const reserved=await run(['EVAL',PROBE,'3',storageKey('market:provider-minute:'+minute,env),storageKey('market:provider-day:'+day,env),providerQuotaKey(env)+':probe',String(settings.minuteCredits)],{env});
 if(reserved!==1)return {status:'waiting'};
 try{
  const response=await fetcher('https://api.twelvedata.com/api_usage',{headers:{Authorization:'apikey '+env.TWELVE_DATA_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!response.ok)return {status:'unavailable'};
  const data=await response.json(),quota=verifiedQuota(data,env,now);
  if(data.status==='error'||!quota)return {status:'unverified'};
  await run(['SET',providerQuotaKey(env),JSON.stringify(quota),'EX',String(AGE/1000)],{env});return {status:'verified',...quota};
 }catch{return {status:'unavailable'};}
}
