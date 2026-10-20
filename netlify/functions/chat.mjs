// Paid AI is disabled by default. Shared passcode alone is not a public-launch security solution.
const SYSTEM="You are ASAF AI, an educational Hebrew-first stock research assistant. You do not have real-time market data, news or screening API. Do not invent prices, indicators, or earnings. Keep responses concise.";
const json=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export default async function handler(request){
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(process.env.ASAF_CHAT_ENABLED!=="true")return json({error:"ASAF AI כבוי למניעת חיובים לא צפויים"},503);
 const code=process.env.ASAF_CHAT_ACCESS_CODE;
 if(!code||code.length<16)return json({error:"Private access code of at least 16 characters required"},503);
 if(request.headers.get("x-asaf-access-code")!==code)return json({error:"קוד גישה שגוי"},401);
 const key=process.env.OPENAI_API_KEY;
 if(!key)return json({error:"AI service key not configured"},503);
 if(!(request.headers.get("content-type")||"").toLowerCase().includes("application/json"))return json({error:"Expected application/json"},415);
 if(Number(request.headers.get("content-length")||0)>16000)return json({error:"Request too large"},413);
 let body;try{const raw=await request.text();if(raw.length>16000)return json({error:"Request too large"},413);body=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400)}
 const message=typeof body?.message==="string"?body.message.trim():"";
 if(!message||message.length>1500)return json({error:"Invalid message"},400);
 const history=Array.isArray(body.history)?body.history.slice(-6).filter(x=>x&&["user","assistant"].includes(x.role)&&typeof x.content==="string").map(x=>({role:x.role,content:x.content.slice(0,1000)})):[];
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",messages:[{role:"system",content:SYSTEM},...history,{role:"user",content:message}],max_completion_tokens:400}),signal:controller.signal});
 if(!r.ok)return json({error:r.status===429?"AI quota exceeded":"AI provider unavailable"},r.status===429?429:502);
 const data=await r.json();return json({answer:typeof data?.choices?.[0]?.message?.content==="string"?data.choices[0].message.content:"No answer returned"});
 }catch{return json({error:"AI request failed"},502)}finally{clearTimeout(timer)}
}