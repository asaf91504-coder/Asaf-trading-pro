const SYSTEM="You are ASAF AI, a helpful Hebrew-first stock research assistant. You do not have live market data or screening tools. Never invent current prices, news, indicators, results, or guarantees. Explain how to screen stocks, analyze risk and earnings; avoid personalized trading instructions. Keep answers practical and concise.";
export default async (request)=>{
 if(request.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
 const gate=process.env.ASAF_CHAT_ACCESS_CODE;
 if(!gate)return Response.json({error:"יש להגדיר ASAF_CHAT_ACCESS_CODE ב-Netlify"},{status:503});
 if(request.headers.get("x-asaf-access-code")!==gate)return Response.json({error:"קוד גישה שגוי"},{status:401});
 const key=process.env.OPENAI_API_KEY;
 if(!key)return Response.json({error:"OPENAI_API_KEY אינו מוגדר"},{status:503});
 let body;try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
 const message=typeof body.message==="string"?body.message.trim():"";
 if(!message||message.length>1500)return Response.json({error:"הודעה לא תקינה"},{status:400});
 const history=Array.isArray(body.history)?body.history.slice(-6).filter(x=>x&&["user","assistant"].includes(x.role)&&typeof x.content==="string").map(x=>({role:x.role,content:x.content.slice(0,1500)})):[];
 try{
 const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",messages:[{role:"system",content:SYSTEM},...history,{role:"user",content:message}],max_completion_tokens:650})});
 if(!r.ok)return Response.json({error:r.status===429?"חריגה ממכסה או תקציב":"OpenAI API error "+r.status},{status:r.status===429?429:502});
 const data=await r.json();return Response.json({answer:data.choices?.[0]?.message?.content||"לא התקבלה תשובה"});
 }catch{return Response.json({error:"שגיאת תקשורת עם OpenAI"},{status:502})}
};