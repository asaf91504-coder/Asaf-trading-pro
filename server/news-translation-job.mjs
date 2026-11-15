import {createHmac,timingSafeEqual} from 'node:crypto';
import {command,storageKey} from './storage.mjs';
import {languageNames} from '../interface-language.mjs';
export function signTranslationJob(body,secret){return createHmac('sha256',secret).update('news-translation:'+body).digest('hex')}
export function validTranslationJob(body,signature,secret,now=Date.now()){
 if(!secret||!/^[a-f0-9]{64}$/.test(signature||''))return false;
 try{const value=JSON.parse(body);return Object.hasOwn(languageNames,value.language)&&Number.isFinite(value.at)&&Math.abs(now-value.at)<60000&&timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(signTranslationJob(body,secret),'hex'))}catch{return false}
}
export async function queueTranslationJob(language,origin,{env=process.env,run=command,fetcher=fetch}={}){
 const key=storageKey('news:translation:job:'+language,env);
 const state=await run(['GET',key],{env});if(state)return state==='running'?'pending':'unavailable';
 if(!env.OPENROUTER_API_KEY)return 'unavailable';
 if(await run(['SET',key,'running','NX','EX','840'],{env})!=='OK')return 'pending';
 const body=JSON.stringify({language,at:Date.now()});
 try{const response=await fetcher(new URL('/.netlify/functions/news-translate-background',origin),{method:'POST',headers:{'Content-Type':'application/json','X-ASAF-Job-Signature':signTranslationJob(body,env.OPENROUTER_API_KEY)},body,signal:AbortSignal.timeout(8000),redirect:'error'});if(response.status===202)return 'pending'}catch{}
 await run(['SET',key,'failed','EX','90'],{env});return 'unavailable';
}
