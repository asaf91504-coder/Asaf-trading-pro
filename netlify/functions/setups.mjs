import {currentUser} from '../../server/auth-core.mjs';
import {subscriptionGuard} from '../../server/billing.mjs';
import {command} from '../../server/storage.mjs';
import {MarketError} from '../../server/market-feed.mjs';
import {canReviewSetups,setupReviewContext,visibleSetups,decideSetup} from '../../server/setup-review.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function createSetupsHandler({env=process.env,run=command,now=()=>Date.now()}={}){return async request=>{
 try{
  if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
  const user=await currentUser(request,{env,run});if(!user)return reply({error:'יש להתחבר לחשבון באתר כדי לצפות בסטאפים.'},401);
  const blocked=await subscriptionGuard(user,{env,run,now:now()});if(blocked)return blocked;
  if(request.method==='POST'){
   if(!canReviewSetups(user,env))return reply({error:'נדרשת הרשאת אישור של אסף.'},403);
   if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
   if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
   const raw=await request.text();if(raw.length>2048)return reply({error:'Request too large'},413);
   let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
   const context=await setupReviewContext({env,run,now:now(),memberId:user.id});
   return reply(await decideSetup(context,{id:body?.id,decision:body?.decision,user,env,run,now:now()}));
  }
  const context=await setupReviewContext({env,run,now:now(),memberId:user.id});
  return reply(visibleSetups(context,canReviewSetups(user,env),now()));
 }catch(e){return reply({error:e instanceof MarketError?e.message:'הסטאפים אינם זמינים כרגע. נסה שוב מאוחר יותר.'},e instanceof MarketError?e.status:503)}
}}
export default request=>createSetupsHandler()(request);
