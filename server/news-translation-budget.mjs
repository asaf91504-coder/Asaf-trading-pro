import {command,storageKey} from './storage.mjs';
// Shared translation work, never a per-viewer/model request. At most 96 bounded
// calls per UTC day across all languages; each uses the existing AI connection.
export async function reserveNewsTranslation({env=process.env,run=command,now=Date.now()}={}){
 const configured=Number(env.ASAF_NEWS_TRANSLATION_DAILY_LIMIT||96),limit=Math.min(96,configured);
 if(!Number.isInteger(limit)||limit<1)return false;
 const day=new Date(now).toISOString().slice(0,10),minute=Math.floor(now/60000);
 const script="-- news-translation-budget-v1\nfor i=1,#KEYS do if tonumber(redis.call('GET',KEYS[i]) or '0')>=tonumber(ARGV[i]) then return 0 end end;for i=1,#KEYS do redis.call('INCR',KEYS[i]);redis.call('EXPIRE',KEYS[i],i==1 and 172800 or 120) end;return 1";
 return await run(['EVAL',script,'2',storageKey('news:translation:day:'+day,env),storageKey('news:translation:minute:'+minute,env),String(limit),'6'],{env})===1;
}
