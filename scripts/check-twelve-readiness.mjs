// Offline preflight: never calls Twelve Data and never prints credential values.
import {twelveSettings} from '../server/twelve-config.mjs';
import {approvedMarketSymbols,publicMarketConfigured} from '../server/market-feed.mjs';
import {publicAuthConfigured} from '../server/auth-core.mjs';
const env=process.env,missing=[];
for(const key of ['TWELVE_DATA_API_KEY','ASAF_MARKET_DELAY_MINUTES'])if(!env[key])missing.push(key);
for(const key of ['ASAF_MARKET_ENABLED','ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED','ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED','ASAF_MARKET_AI_LICENSE_CONFIRMED'])if(env[key]!=='true')missing.push(key);
if(!publicAuthConfigured(env))missing.push('Authenticated account storage');
if(!approvedMarketSymbols(env).length)missing.push('ASAF_MARKET_ALLOWED_SYMBOLS');
let settings=null;try{settings=twelveSettings(env)}catch(e){missing.push(e.message)}
const chartReady=publicMarketConfigured(env),aiDataReady=chartReady&&env.ASAF_MARKET_AI_LICENSE_CONFIRMED==='true';
console.log(JSON.stringify({provider:'Twelve Data',offlineCheck:true,chartConfigurationReady:chartReady,aiDataConfigurationReady:aiDataReady,symbolCount:approvedMarketSymbols(env).length,settings,missing,note:'Configuration only. Provider credentials, entitlements, latency and data quality require an authorized live smoke test. AI model availability is a separate prerequisite.'},null,2));
if(!chartReady||!aiDataReady)process.exitCode=2;
