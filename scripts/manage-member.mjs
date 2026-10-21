// Private operator CLI. JSON on stdin only. No tokens, passwords, email addresses
// or password hashes are ever printed. Deliver links separately through an approved channel.
import {randomUUID} from 'node:crypto';
import {command,storeConfigured,storageKey} from '../server/storage.mjs';
import {normalizeEmail,digest} from '../server/auth-core.mjs';
try{
 if(process.env.CONTEXT!=='production'||!storeConfigured())throw Error();
 let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>4096)throw Error()}
 const input=JSON.parse(raw),email=normalizeEmail(input.email);if(!/^[^\s@]{1,100}@[^\s@]{1,150}\.[^\s@]{2,50}$/.test(email)||!['invite','reset','disable','status'].includes(input.action))throw Error();
 const userKey=storageKey('auth:user:'+digest(email)),existing=await command(['GET',userKey]);let old=null;try{old=JSON.parse(existing||'null')}catch{}
 let result;
 if(input.action==='status')result={exists:!!old,enabled:old?.enabled===true};
 else if(input.action==='disable'){
  if(!old?.id)throw Error();const version=randomUUID(),record={...old,version,enabled:false};
  const saved=await command(['EVAL',"if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); redis.call('SET',KEYS[2],ARGV[3]); return 1",'2',userKey,storageKey('auth:member:'+old.id),existing,JSON.stringify(record),JSON.stringify({id:old.id,enabled:false,version})]);if(saved!==1)throw Error();result={disabled:true};
 }else{
  if(!/^[a-f0-9]{64}$/.test(input.token||''))throw Error();const reset=input.action==='reset';if(reset?(!old||old.enabled!==true):!!old)throw Error();
  const ttl=reset?900:86400,payload={emailHash:digest(email),expires:Date.now()+ttl*1000,...(reset?{version:old.version}:{})};
  const saved=await command(['SET',storageKey('auth:'+(reset?'reset:':'invite:')+digest(input.token)),JSON.stringify(payload),'EX',String(ttl),'NX']);if(saved!=='OK')throw Error();result={issued:true,purpose:input.action,expiresInSeconds:ttl};
 }
 process.stdout.write(JSON.stringify(result)+'\n');
}catch{process.stderr.write('Member operation failed. Check approved storage and input. No credentials were printed.\n');process.exitCode=1}
