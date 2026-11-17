// Server-only inference. An API credit grant belongs to the key's organization;
// the application never claims/reloads credits or silently changes providers.
export const OPENAI_MODEL='gpt-6.1-terra';
export const OPENAI_MAX_OUTPUT_TOKENS=1800;
export const OPENAI_MAX_TEXT_BYTES=48000;
// Conservative reservation at standard US pricing reviewed 2026-11-17:
// <=48k UTF-8 bytes + 2k framing + 4k low-detail image tokens, 1,800 output
// tokens. Includes cache-write/rate margin; no hosted tools or automatic retry.
// This is a request reservation, NOT a guarantee about account credit balance.
export const OPENAI_REQUEST_CEILING_USD=0.08;
export class AIProviderError extends Error{
 constructor(message,code='model_unavailable',status=502){super(message);this.code=code;this.status=status;}
}
export function aiProviderConfig(env=process.env){
 const provider=env.ASAF_AI_PROVIDER||'openrouter';
 if(provider==='openrouter')return {provider,model:'openrouter/free',enabled:env.ASAF_FREE_AI_ENABLED==='true'&&!!env.OPENROUTER_API_KEY};
 if(provider==='openai')return {provider,model:OPENAI_MODEL,enabled:env.ASAF_OPENAI_ENABLED==='true'&&!!env.OPENAI_API_KEY&&(!env.OPENAI_MODEL||env.OPENAI_MODEL===OPENAI_MODEL)};
 return {provider:'invalid',model:null,enabled:false};
}
export function openaiDataAllowed(source,env=process.env){
 const flag={'Twelve Data':'ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED',Intrinio:'ASAF_INTRINIO_OPENAI_LICENSE_CONFIRMED',CoinLore:'ASAF_CRYPTO_OPENAI_LICENSE_CONFIRMED'}[source];
 return !flag||env[flag]==='true';
}
const textBytes=value=>Buffer.byteLength(value,'utf8');
export function openaiRequestBody(messages){
 const system=messages[0],current=messages.at(-1),history=messages.slice(1,-1);
 const convert=message=>({role:message.role,content:typeof message.content==='string'?message.content:message.content.map(part=>part.type==='text'?{type:'input_text',text:part.text}:{type:'input_image',image_url:part.image_url.url,detail:'low'})});
 const size=message=>typeof message.content==='string'?textBytes(message.content):message.content.reduce((n,p)=>n+(p.type==='text'?textBytes(p.text):0),0);
 let bytes=size(system)+size(current);const selected=[];
 if(bytes>OPENAI_MAX_TEXT_BYTES)throw new AIProviderError('הקשר הגרף גדול מדי לבקשה אחת. צמצם את הנתונים המצורפים.','model_input_too_large',413);
 for(const message of history.slice().reverse()){
  const count=size(message);if(bytes+count>OPENAI_MAX_TEXT_BYTES)break;
  selected.unshift(message);bytes+=count;
 }
 return {model:OPENAI_MODEL,instructions:system.content,input:[...selected,current].map(convert),store:false,stream:false,service_tier:'default',reasoning:{effort:'low'},max_output_tokens:OPENAI_MAX_OUTPUT_TOKENS};
}
export async function requestAI({messages,signal,env=process.env,fetcher=fetch}){
 const config=aiProviderConfig(env);
 if(!config.enabled)throw new AIProviderError('חיבור ה-AI טרם הוגדר בשרת.','model_not_configured',503);
 const openai=config.provider==='openai';
 const body=openai?openaiRequestBody(messages):{model:config.model,messages,max_tokens:1800,temperature:0.35,provider:{sort:'latency',data_collection:'deny',zdr:true},stream:false};
 const response=await fetcher(openai?'https://api.openai.com/v1/responses':'https://openrouter.ai/api/v1/chat/completions',{
  method:'POST',signal,headers:{Authorization:'Bearer '+(openai?env.OPENAI_API_KEY:env.OPENROUTER_API_KEY),'Content-Type':'application/json',...(!openai?{'X-Title':'ASAF Trading Pro'}:{})},body:JSON.stringify(body)
 });
 if(!response.ok){
  let errorCode;try{errorCode=(await response.json())?.error?.code}catch{}
  if(response.status===429&&['credit_balance_exhausted','insufficient_quota'].includes(errorCode))throw new AIProviderError('יתרת הקרדיטים של שירות ה-AI אינה זמינה. לא בוצעה טעינה או בקשה חוזרת.','provider_credits_exhausted',429);
  throw new AIProviderError(response.status===429?'מכסת הבקשות של שירות ה-AI נוצלה. נסה מאוחר יותר.':'שירות ה-AI אינו זמין כרגע.','model_unavailable',response.status===429?429:502);
 }
 const output=await response.json();
 let answer,truncated;
 if(openai){
  if(!['completed','incomplete'].includes(output?.status))throw new AIProviderError('שירות ה-AI לא השלים את התשובה.');
  answer=(output.output||[]).filter(item=>item.type==='message'&&item.role==='assistant').flatMap(item=>item.content||[]).filter(part=>part.type==='output_text').map(part=>part.text).join('\n');
  truncated=output.status==='incomplete';
 }else{
  const raw=output?.choices?.[0]?.message?.content;
  answer=typeof raw==='string'?raw:Array.isArray(raw)?raw.filter(p=>p?.type==='text').map(p=>p.text).join('\n'):'';
  truncated=output?.choices?.[0]?.finish_reason==='length';
 }
 if(!answer)throw new AIProviderError('שירות ה-AI לא החזיר תשובה.');
 return {...config,answer,truncated:truncated||answer.length>7500};
}
