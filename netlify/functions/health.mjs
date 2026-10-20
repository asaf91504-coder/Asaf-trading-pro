import {publicAuthConfigured} from "../../server/auth-core.mjs";
import {storeConfigured} from "../../server/storage.mjs";
import {newsConfigured} from "../../server/news-core.mjs";
// No network access, provider request, billing, or secrets are involved in this health check.
const VERSION="2026-10-20-workspace-4";
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
export default async function handler(request) {
  if(request.method!=="GET")return Response.json({error:"Method not allowed"},{status:405,headers});
  return Response.json({
    application:"ASAF TRADING PRO",
    version:VERSION,
    status:"ok",
    marketProvider:"Twelve Data (optional)",
    marketDataEnabled:process.env.ASAF_MARKET_ENABLED==="true"&&process.env.ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED==="true"&&!!process.env.TWELVE_DATA_API_KEY&&!!process.env.ASAF_MARKET_ACCESS_CODE,
    paidAIEnabled:process.env.ASAF_CHAT_ENABLED==="true"&&!!process.env.OPENAI_API_KEY,
    freeAIEnabled:process.env.ASAF_FREE_AI_ENABLED==="true"&&!!process.env.OPENROUTER_API_KEY&&(process.env.ASAF_PUBLIC_AUTH_ENABLED==='true'?publicAuthConfigured():!!process.env.ASAF_FREE_AI_ACCESS_CODE&&process.env.ASAF_FREE_AI_ACCESS_CODE.length>=24),
    publicAuthEnabled:publicAuthConfigured(),
    durableQuotaEnabled:storeConfigured()&&(process.env.ASAF_PUBLIC_AUTH_ENABLED==='true'||process.env.ASAF_FREE_AI_DURABLE_QUOTA==='true'),
    newsEnabled:newsConfigured()&&storeConfigured(),
    freeAIModel:"openrouter/free",
    info:"No API calls or financial charges are performed by this check."
  },{status:200,headers});
}

