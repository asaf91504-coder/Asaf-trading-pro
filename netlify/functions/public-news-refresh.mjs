import {refreshPublicNews} from '../../server/public-news-service.mjs';
export default async function handler(){try{const result=await refreshPublicNews();return Response.json(result,{status:200})}catch{return Response.json({status:'unavailable'},{status:503})}}
export const config={schedule:'*/15 * * * *'};
