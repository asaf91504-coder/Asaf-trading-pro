import {digest} from '../server/auth-core.mjs';
export const env={CONTEXT:'production',ASAF_PUBLIC_AUTH_ENABLED:'true',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'mock-only',ASAF_GOOGLE_AUTH_ENABLED:'true',ASAF_GOOGLE_SIGNUP_ENABLED:'true',GOOGLE_CLIENT_ID:'123-test.apps.googleusercontent.com'};
export const origin='https://example.test',prefix='asaf:production:';
export function fixture(){
 const db=new Map(),sets=new Map();let online=true,allowed=true;
 const run=async a=>{
  if(!online)throw Error('offline');
  const op=a[0];if(op==='GET')return db.get(a[1])||null;if(op==='SET'){if(a.includes('NX')&&db.has(a[1]))return null;db.set(a[1],a[2]);return 'OK'}if(op==='DEL'){for(const k of a.slice(1))db.delete(k);return 1}
  if(op==='SMEMBERS')return [...(sets.get(a[1])||[])];if(op==='MGET')return a.slice(1).map(k=>db.get(k)||null);
  if(op!=='EVAL')throw Error('Unknown command');
  const script=a[1],n=Number(a[2]),k=a.slice(3,3+n),v=a.slice(3+n);
  if(script.includes('alert-rules-save')){if(db.get(k[1])!==v[2]||db.get(k[2])!==v[3]||JSON.parse(v[2]).expires<=Date.now())return -1;const old=db.get(k[0]);if(old?JSON.parse(old).revision!==v[0]:v[0]!=='')return 0;db.set(k[0],v[1]);const members=sets.get(k[3])||new Set();if(v[5]==='0')members.delete(v[4]);else members.add(v[4]);sets.set(k[3],members);return 1}
  if(script.includes('alert-inbox-append')){if(db.get(k[0])!==v[0]||db.get(k[1])!==v[1])return 0;const seen=JSON.parse(db.get(k[2])||'{}'),inbox=JSON.parse(db.get(k[3])||'[]');let count=0;for(const e of JSON.parse(v[2]))if(seen[e.ruleId]!==e.key){seen[e.ruleId]=e.key;inbox.unshift(e);count++}db.set(k[2],JSON.stringify(seen));db.set(k[3],JSON.stringify(inbox.slice(0,100)));return count}
  if(script.includes('google-identity-commit')){
   if(db.get(k[0])!==v[0]||(db.get(k[1])||'')!==v[1]||(db.get(k[2])||'')!==v[2]||(db.get(k[3])||'')!==v[3])return 0;
   const members=sets.get(k[6])||new Set();if(v[2]===''&&members.size>=Number(v[8]))return -1;
   db.set(k[1],v[4]);db.set(k[2],v[5]);db.set(k[3],v[6]);db.set(k[4],v[7]);db.set(k[5],v[4]);members.add(v[9]);sets.set(k[6],members);db.delete(k[0]);return 1;
  }
  if(script.includes('account-version-change')){if(db.get(k[0])!==v[0]||db.get(k[1])!==v[1])return 0;db.set(k[0],v[2]);db.set(k[1],v[3]);return 1}
  if(script.includes('account-self-delete')){if(db.get(k[0])!==v[0]||db.get(k[1])!==v[1])return 0;if(v[2]==='1'&&db.get(k[4])===v[3])db.delete(k[4]);for(const i of [0,1,2,3,5,7,8,9])db.delete(k[i]);sets.get(k[6])?.delete(v[4]);sets.get(k[10])?.delete(v[4]);return 1}
  if(script.startsWith('for i=1,#KEYS')){if(!allowed||k.some((key,i)=>Number(db.get(key)||0)>=Number(v[i])))return 0;for(const key of k)db.set(key,String(Number(db.get(key)||0)+1));return 1}
  if(script.includes("then return redis.call('DEL'")){if(db.get(k[0])===v[0]){db.delete(k[0]);return 1}return 0}
  if(script.includes('local n=tonumber'))return allowed?1:0;
  throw Error('Unknown Lua');
 };
 return {db,sets,run,set online(v){online=v},set allowed(v){allowed=v}};
}
export const request=(path,body,cookie='',method)=>new Request(origin+'/.netlify/functions/'+path,{method:method||(body?'POST':'GET'),headers:{origin,'content-type':'application/json',cookie},...(body?{body:JSON.stringify(body)}:{})});
export function seed(state,email='member@example.test',id='12345678-1234-1234-1234-123456789abc',session='d'.repeat(64)){
 const record={id,version:'v1',enabled:true,salt:'0'.repeat(32),hash:'0'.repeat(64)};
 state.db.set(prefix+'auth:user:'+digest(email),JSON.stringify(record));state.db.set(prefix+'auth:member:'+id,JSON.stringify({id,version:'v1',enabled:true}));state.db.set(prefix+'auth:index:'+id,digest(email));state.db.set(prefix+'auth:session:'+digest(session),JSON.stringify({id,version:'v1',expires:Date.now()+600000}));return {record,cookie:'asaf_session='+session};
}
