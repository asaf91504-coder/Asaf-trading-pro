import runtimeContext from './runtime-context.mjs';
// Server only. Never called until the owner separately approves external services.
export function storeConfigured(env=process.env){
 try{const u=new URL(env.ASAF_REDIS_REST_URL);return env.ASAF_EXTERNAL_SERVICES_APPROVED==='true'&&u.protocol==='https:'&&u.hostname.endsWith('.upstash.io')&&u.pathname==='/'&&!u.username&&!u.password&&!u.search&&!u.hash&&!!env.ASAF_REDIS_REST_TOKEN}catch{return false}
}
export async function command(args,{env=process.env,fetcher=fetch}={}){
 if(!storeConfigured(env))throw Error('Persistent storage is not approved or configured');
 const r=await fetcher(env.ASAF_REDIS_REST_URL,{method:'POST',headers:{Authorization:'Bearer '+env.ASAF_REDIS_REST_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw Error('Persistent storage unavailable');const body=await r.json();if(body.error)throw Error('Persistent storage rejected command');return body.result;
}
export const storageKey=(name,env=process.env)=>'asaf:'+(env.CONTEXT?(env.CONTEXT==='production'?'production':'preview'):runtimeContext)+':'+name;
const QUOTA=`for i=1,#KEYS do local n=tonumber(redis.call('GET',KEYS[i]) or '0'); if n>=tonumber(ARGV[i]) then return 0 end end; for i=1,#KEYS do redis.call('INCR',KEYS[i]); redis.call('EXPIRE',KEYS[i],i==2 and 120 or 172800) end; return 1`;
export async function reserveAIRequest({env=process.env,now=Date.now(),run=command,memberId=null}={}){
 const configured=Number(env.ASAF_FREE_AI_DAILY_LIMIT||40),limit=Math.min(40,configured);
 if(!Number.isInteger(limit)||limit<1)throw Error('Invalid daily quota');
 const day=new Date(now).toISOString().slice(0,10),minute=Math.floor(now/60000);
 const keys=[storageKey('ai:day:'+day,env),storageKey('ai:minute:'+minute,env)],limits=[String(limit),'6'];
 if(memberId){if(!/^[a-f0-9-]{36}$/.test(memberId))throw Error('Invalid member');keys.push(storageKey('ai:member:'+memberId+':'+day,env));limits.push(String(Math.min(10,limit)))}
 return await run(['EVAL',QUOTA,String(keys.length),...keys,...limits],{env})===1;
}
