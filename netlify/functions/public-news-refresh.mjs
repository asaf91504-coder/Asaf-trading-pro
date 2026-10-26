import {command,storageKey,storeConfigured} from '../../server/storage.mjs';
import {refreshPublicNews} from '../../server/public-news-service.mjs';
export default async function handler(){try{const result=await refreshPublicNews();if(result.status!=='disabled'&&storeConfigured())await command(['SET',storageKey('news:public:scheduled'),JSON.stringify({at:new Date().toISOString(),status:result.status}),'EX','172800']);return Response.json(result,{status:200})}catch{return Response.json({status:'unavailable'},{status:503})}}
// Schedule is declared explicitly in netlify.toml.
