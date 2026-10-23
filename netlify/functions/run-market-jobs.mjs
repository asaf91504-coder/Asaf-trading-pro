import {currentUser} from '../../server/auth-core.mjs';
import {runMarketCycle} from '../../server/background-jobs.mjs';
export default async function handler(request){
 if(request.method!=='POST')return Response.json({error:'POST only'},{status:405});if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origin mismatch'},{status:403});
 try{const user=await currentUser(request);if(!user||!(process.env.ASAF_ADMIN_MEMBER_IDS||'').split(',').map(x=>x.trim()).includes(user.id))return Response.json({error:'נדרשת הרשאת מנהל.'},{status:403});return Response.json(await runMarketCycle(),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'מחזור הנתונים נכשל; לא בוצעה עקיפה של המכסות.'},{status:503})}
}
