// Server-only provider selection; never accept a provider/model/key from a browser.
export const OPENAI_MODEL = 'gpt-4.1-mini-2025-04-14';
export const directOpenAI = (env=process.env) => env.ASAF_CHAT_PROVIDER === 'openai';
export function openAIBlock(member, payload=null, env=process.env) {
 if(!directOpenAI(env))return null;
 const block=(code,error,status=503)=>({code,error,status});
 if(env.ASAF_PUBLIC_AUTH_ENABLED!=='true'||!member)return block('openai_auth_required','OpenAI requires an authenticated account.',401);
 const owner=env.ASAF_OPENAI_MEMBER_ID;
 if(!/^[a-f0-9-]{36}$/.test(owner||'')||member.id!==owner)return block('openai_owner_only','OpenAI is restricted to the verified owner account.',403);
 if(env.ASAF_OPENAI_ENABLED!=='true'||env.ASAF_OPENAI_FUNDING_VERIFIED!=='true'||!(Date.parse(env.ASAF_OPENAI_FUNDING_EXPIRES_AT||'')>Date.now())||!env.OPENAI_API_KEY)return block('openai_not_configured','OpenAI activation, API key and no-charge funding verification are required.');
 if(!payload)return null;
 // No provenance claim from the browser can authorize a new data processor.
 // Until approved, reject all attachments and history, including unlabelled legacy
 // history: an earlier assistant answer can contain derived licensed prices.
 const approved=env.ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED==='true'&&env.ASAF_TWELVE_TRIAL_MEMBER_ID===owner&&Date.parse(env.ASAF_TWELVE_TRIAL_ENDS_AT||'')>Date.now();
 if(!approved&&(payload.source==='Twelve Data'||payload.useServerMarket===true||payload.bars!=null||payload.image!=null||payload.chartToolReceipt||payload.history?.length))return block('openai_data_approval_required','OpenAI data approval is pending. Start a new text-only conversation without chart attachments or previous history.',403);
 // Intrinio permission for the prior processor does not authorize OpenAI.
 if(payload.source==='Intrinio'||payload.useServerIntrinio===true||payload.history?.some?.(m=>m?.chartContext?.source==='Intrinio'))return block('openai_intrinio_approval_required','Intrinio is not approved for direct OpenAI.',403);
 return null;
}
export function openAIRequest(messages) {
 // GPT-4.1 mini standard pricing: $0.40/M input, $1.60/M output.
 // UTF-8 bytes conservatively bound text tokens. Add framing + max image patches.
 // 28,000 + 1,024 + 10,000 input tokens and 1,800 output < $0.02.
 // Re-review these limits/prices before changing the pinned model.
 let images=0;
 const text=messages.map(m=>({...m,content:Array.isArray(m.content)?m.content.map(p=>{
  if(p.type==='image_url'){images++;return {type:'image_url'};}return p;
 }):m.content}));
 if(images>1||Buffer.byteLength(JSON.stringify(text),'utf8')>28000)throw Object.assign(Error('Conversation exceeds the one-credit input limit. Start a shorter conversation.'),{status:413,code:'model_input_limit'});
 return {model:OPENAI_MODEL,messages,max_completion_tokens:1800,temperature:0.35,stream:false,store:false};
}
