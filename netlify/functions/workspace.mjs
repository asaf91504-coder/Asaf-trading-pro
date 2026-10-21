import {randomUUID} from 'node:crypto';
import {currentUser,publicAuthConfigured} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {watchRecords} from '../../workspace-core.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const SAVE="local old=redis.call('GET',KEYS[1]); if old then local ok,v=pcall(cjson.decode,old); if not ok or v.revision~=ARGV[1] then return 0 end elseif ARGV[1]~='' then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
export default async function handler(request){
 if(!['GET','PUT'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(!publicAuthConfigured())return reply({error:'שמירה לחשבון אינה זמינה.'},503);
 if(request.method==='PUT'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 try{
  const user=await currentUser(request);if(!user)return reply({error:'יש להיכנס לחשבון לפני סנכרון.'},401);
  const allowed=await command(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=30 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('workspace:attempt:'+user.id+':'+Math.floor(Date.now()/60000))]);
  if(allowed!==1)return reply({error:'יותר מדי פעולות סנכרון. נסה בעוד דקה.'},429);
  const key=storageKey('workspace:member:'+user.id);
  if(request.method==='GET'){const raw=await command(['GET',key]);if(!raw)return reply({revision:'',watch:[],updatedAt:null});const saved=JSON.parse(raw);if(typeof saved.revision!=='string'||!Array.isArray(saved.watch))throw Error();return reply({revision:saved.revision,watch:watchRecords(saved.watch),updatedAt:saved.updatedAt})}
  if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON only'},415);
  if(Number(request.headers.get('content-length')||0)>250000)return reply({error:'Request too large'},413);
  const raw=await request.text();if(raw.length>250000)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!body||!Array.isArray(body.watch)||body.watch.length>100||typeof body.revision!=='string'||(body.revision!==''&&!/^[a-f0-9-]{36}$/.test(body.revision)))return reply({error:'נתוני השמירה אינם תקינים.'},400);
  const saved={revision:randomUUID(),watch:watchRecords(body.watch),updatedAt:new Date().toISOString()};
  const result=await command(['EVAL',SAVE,'1',key,body.revision,JSON.stringify(saved)]);
  if(result!==1)return reply({error:'החשבון עודכן במכשיר אחר. טען את העותק מהחשבון ומזג לפני שמירה נוספת.'},409);
  return reply(saved);
 }catch{return reply({error:'הסנכרון אינו זמין. העותק המקומי לא שונה.'},503)}
}
