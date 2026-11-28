import {searchConfigured} from '../../server/web-research.mjs';
import {aiProviderConfig,openaiDataAllowed} from '../../server/ai-provider.mjs';
import {intrinioConfigured} from '../../server/intrinio-research.mjs';
import {fundamentalsConfigured} from '../../server/market-fundamentals.mjs';
import {publicNewsEnabled} from '../../server/public-news.mjs';
import {mobileSessionConfigured} from '../../server/mobile-session.mjs';
import {cryptoResearchConfigured} from '../../server/crypto-research.mjs';
import {publicAuthConfigured} from "../../server/auth-core.mjs";
import {storeConfigured} from "../../server/storage.mjs";
import {googleConfigured} from "../../server/google-auth.mjs";
import {publicMarketConfigured} from "./public-market.mjs";
import {newsConfigured} from "../../server/news-core.mjs";
// No network access, provider request, billing, or secrets are involved in this health check.
const VERSION="2026-11-28-chat-subscription-1";
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
export default async function handler(request) {
  if(request.method!=="GET")return Response.json({error:"Method not allowed"},{status:405,headers});
  const ai=aiProviderConfig(),access=process.env.ASAF_PUBLIC_AUTH_ENABLED==='true'?publicAuthConfigured():!!process.env.ASAF_FREE_AI_ACCESS_CODE&&process.env.ASAF_FREE_AI_ACCESS_CODE.length>=24;
  return Response.json({
    application:"ASAF TRADING PRO",
    version:VERSION,
    marketPresentation:'server-raster',
    scannerPresentation:'derived-only',
    webSearchEnabled:searchConfigured(),
    googleAuthEnabled:googleConfigured(),
    nativeAppLoginEnabled:mobileSessionConfigured(),
    intrinioResearchEnabled:intrinioConfigured(),
    intrinioResearchOwnerOnly:true,
    cryptoResearchEnabled:cryptoResearchConfigured(),
    cryptoResearchOwnerOnly:true,
    marketFundamentalsEnabled:fundamentalsConfigured(),
    marketDailyBarPolicy:'previous-daily-sessions',
    marketAnalysisEnabled:publicMarketConfigured()&&process.env.ASAF_MARKET_AI_LICENSE_CONFIRMED==='true'&&(ai.provider!=='openai'||openaiDataAllowed('Twelve Data')),
    backgroundMarketRefreshConfigured:publicMarketConfigured()&&process.env.ASAF_BACKGROUND_REFRESH_ENABLED==='true',
    newsAnalysisEnabled:(newsConfigured()&&process.env.ASAF_NEWS_AI_LICENSE_CONFIRMED==='true'||publicNewsEnabled()&&!newsConfigured())&&storeConfigured(),
    googleSignupEnabled:googleConfigured()&&process.env.ASAF_GOOGLE_SIGNUP_ENABLED==="true",
    publicMarketDataEnabled:publicMarketConfigured(),
    status:"ok",
    marketProvider:"Twelve Data (optional)",
    marketDataEnabled:process.env.ASAF_MARKET_ENABLED==="true"&&process.env.ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED==="true"&&!!process.env.TWELVE_DATA_API_KEY&&!!process.env.ASAF_MARKET_ACCESS_CODE,
    paidAIEnabled:process.env.ASAF_CHAT_ENABLED==="true"&&!!process.env.OPENAI_API_KEY,
    aiProvider:ai.provider,
    aiModel:ai.model,
    aiEnabled:ai.enabled&&access,
    openaiAIEnabled:ai.provider==='openai'&&ai.enabled&&access,
    freeAIEnabled:ai.provider==='openrouter'&&ai.enabled&&access,
    publicAuthEnabled:publicAuthConfigured(),
    durableQuotaEnabled:storeConfigured()&&(process.env.ASAF_PUBLIC_AUTH_ENABLED==='true'||process.env.ASAF_FREE_AI_DURABLE_QUOTA==='true'),
    newsEnabled:(newsConfigured()||publicNewsEnabled())&&storeConfigured(),
    newsMode:newsConfigured()?'licensed':publicNewsEnabled()&&storeConfigured()?'public-rss':'off',
    freeAIModel:"openrouter/free",
    info:"No API calls or financial charges are performed by this check."
  },{status:200,headers});
}

