import {randomUUID} from 'node:crypto';
import {currentUser,publicAuthConfigured,cookieToken,digest} from '../../server/auth-core.mjs';
import {command,storageKey} from '../../server/storage.mjs';
import {watchRecords} from '../../workspace-core.mjs';
import {personalSections,personalData} from '../../personal-data.mjs';
const LIMIT=750000;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const SAVE=`-- workspace-authenticated-save
if redis.call('GET',KEYS[2])~=ARGV[3] or redis.call('GET',KEYS[3])~=ARGV[4] then return -1 end
local session=cjson.decode(ARGV[3]);local clock=redis.call('TIME');if session.expires<=tonumber(clock[1])*1000+tonumber(clock[2])/1000 then return -1 end
local old=redis.call('GET',KEYS[1]);if old then local ok,v=pcall(cjson.decode,old);if not ok or v.revision~=ARGV[1] then return 0 end elseif ARGV[1]~='' then return 0 end
redis.call('SET',KEYS[1],ARGV[2]);return 1`;
function readSaved(raw){if(!raw)return {revision:'',watch:[],updatedAt:null};const value=JSON.parse(raw);if(typeof value.revision!=='string'||!Array.isArray(value.watch))throw Error('Invalid workspace');const result={revision:value.revision,watch:watchRecords(value.watch),updatedAt:value.updatedAt};for(const section of personalSections)if(value[section]!==undefined)result[section]=personalData(section,value[section]);return result}
export default async function handler(request){
 if(!['GET','PUT'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(!publicAuthConfigured())return reply({error:'שמירה לחשבון אינה זמינה.'},503);
 if(request.method==='PUT'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin mismatch'},403);
 try{
  const user=await currentUser(request,{includeRecords:true});if(!user)return reply({error:'יש להיכנס לחשבון לפני סנכרון.'},401);
  const allowed=await command(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0');if n>=30 then return 0 end;redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120);return 1",'1',storageKey('workspace:attempt:'+user.id+':'+Math.floor(Date.now()/60000))]);
  if(allowed!==1)return reply({error:'יותר מדי פעולות סנכרון. נסה בעוד דקה.'},429);
  const key=storageKey('workspace:member:'+user.id);
  if(request.method==='GET')return reply(readSaved(await command(['GET',key])));
  if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON only'},415);
  if(Number(request.headers.get('content-length')||0)>LIMIT)return reply({error:'Request too large'},413);
  const raw=await request.text();if(Buffer.byteLength(raw)>LIMIT)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!body||typeof body.revision!=='string'||(body.revision!==''&&!/^[a-f0-9-]{36}$/.test(body.revision)))return reply({error:'נתוני השמירה אינם תקינים.'},400);
  if(body.memberId!==user.id)return reply({error:'החשבון השתנה או שהעמוד ישן. רענן את העמוד והתחבר מחדש.'},409);
  const patch={};try{
   if(body.section!==undefined){if(!personalSections.includes(body.section))throw Error('סוג נתונים לא מוכר');patch[body.section]=personalData(body.section,body.data)}
   else{if(!Array.isArray(body.watch)||body.watch.length>100)throw Error('רשימת מעקב אינה תקינה');patch.watch=watchRecords(body.watch)}
  }catch(e){return reply({error:e.message},400)}
  const previous=readSaved(await command(['GET',key]));
  if(previous.revision!==body.revision)return reply({error:'החשבון עודכן במכשיר אחר. טען ומזג לפני שמירה נוספת.'},409);
  const saved={...previous,...patch,revision:randomUUID(),updatedAt:new Date().toISOString()},encoded=JSON.stringify(saved);
  if(Buffer.byteLength(encoded)>LIMIT)return reply({error:'העותק בחשבון גדול מ־750KB. גבה וצמצם רשומות לפני השמירה.'},413);
  const result=await command(['EVAL',SAVE,'3',key,storageKey('auth:session:'+digest(cookieToken(request))),storageKey('auth:member:'+user.id),body.revision,encoded,user.sessionRaw,user.memberRaw]);
  if(result===-1)return reply({error:'הכניסה פגה או שהגישה השתנתה. היכנס מחדש.'},401);
  if(result!==1)return reply({error:'החשבון עודכן במכשיר אחר. טען ומזג לפני שמירה נוספת.'},409);
  return reply(saved);
 }catch{return reply({error:'הסנכרון אינו זמין. העותק המקומי לא שונה.'},503)}
}
