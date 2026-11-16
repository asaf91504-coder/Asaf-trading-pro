import {randomUUID} from 'node:crypto';
import {currentUser} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {billingReady,withBillingLock} from '../../server/billing.mjs';
import {createPayPal,approvalLink} from '../../server/paypal.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function validateTestOrder(order,id,member){
 const units=order?.purchase_units,u=units?.[0];
 if(order?.id!==id||order.intent!=='CAPTURE'||units?.length!==1||u.custom_id!==member||u.amount?.currency_code!=='USD'||Number(u.amount.value)!==1)throw Error('Unexpected test order');
 if(order.status==='COMPLETED'){
  const captures=u.payments?.captures;
  if(captures?.length!==1||captures[0].status!=='COMPLETED'||captures[0].amount?.currency_code!=='USD'||Number(captures[0].amount.value)!==1)throw Error('Payment not completed');
 }
 return order.status==='COMPLETED';
}
export function createPaymentTestHandler({env=process.env,run=command,api=createPayPal({env}),now=()=>Date.now()}={}){return async request=>{
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 try{
  const user=await currentUser(request,{env,run});
  if(!user)return reply({error:'יש להתחבר לחשבון המנהל.'},401);
  if(!(env.ASAF_ADMIN_MEMBER_IDS||'').split(',').map(x=>x.trim()).includes(user.id))return reply({error:'בדיקה למנהל בלבד.'},403);
  if(!billingReady(env))return reply({error:'התשלום אינו זמין.'},503);
  const key=storageKey('payment-test:'+user.id,env);
  if(request.method==='GET')return reply({allowed:true,sandbox:env.PAYPAL_ENVIRONMENT==='sandbox',record:JSON.parse(await run(['GET',key],{env})||'null')});
  if(!(request.headers.get('content-type')||'').includes('application/json'))return reply({error:'JSON only'},415);
  const raw=await request.text();if(raw.length>512)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!['create','capture'].includes(body.action)||body.consent!=='USD1_ONCE_TEST')return reply({error:'נדרש אישור לחיוב חד־פעמי של דולר.'},400);
  return await withBillingLock('test:'+user.id,async()=>{
   if((await currentUser(request,{env,run}))?.id!==user.id)return reply({error:'יש להתחבר שוב.'},401);
   let record=JSON.parse(await run(['GET',key],{env})||'null');
   const save=()=>run(['SET',key,JSON.stringify(record)],{env});
   // A single persisted test order per admin. Retries never create another charge.
   if(body.action==='create'){
    if(!record){record={requestId:randomUUID(),createdAt:now()};await save();}
    if(record.status==='COMPLETED')return reply({completed:true});
    if(record.approvalUrl)return reply({approvalUrl:record.approvalUrl});
    if(now()-record.createdAt>5*3600000)return reply({error:'הבדיקה פגה. יש לבדוק את העסקה לפני פתיחת בדיקה נוספת.'},409);
    const origin=new URL(request.url).origin;
    const order=await api('/v2/checkout/orders',{method:'POST',requestId:record.requestId,body:{intent:'CAPTURE',purchase_units:[{description:'ASAF Pro — בדיקה בשבילי',custom_id:user.id,amount:{currency_code:'USD',value:'1.00'}}],application_context:{shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:origin+'/subscription.html?testPayment=return#paymentTest',cancel_url:origin+'/subscription.html?testPayment=cancel#paymentTest'}}});
    if(!/^[A-Z0-9]+$/.test(order.id||''))throw Error('Invalid order');
    record={...record,orderId:order.id,approvalUrl:approvalLink(order,env)};if(!record.approvalUrl)throw Error('No approval URL');await save();return reply({approvalUrl:record.approvalUrl});
   }
   if(!record?.orderId)return reply({error:'לא נמצאה עסקת בדיקה.'},409);
   const path='/v2/checkout/orders/'+record.orderId;
   let order=await api(path);let completed=validateTestOrder(order,record.orderId,user.id);
   if(!completed&&order.status==='APPROVED'){
    order=await api(path+'/capture',{method:'POST',requestId:record.requestId+'-capture',body:{}});
    completed=validateTestOrder(order,record.orderId,user.id);
   }
   if(completed){record={...record,status:'COMPLETED',approvalUrl:null};await save();}
   return reply({completed,status:order.status});
  },{env,run});
 }catch{return reply({error:'לא ניתן להשלים את הבדיקה כרגע. לחץ על בדיקת התשלום לפני ניסיון נוסף.'},503)}
};}
export default request=>createPaymentTestHandler()(request);
