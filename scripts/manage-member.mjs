// Admin-only CLI. Receives {action,email,password?} as JSON on stdin.
// Never run in a frontend, include passwords in shell arguments or commit credentials.
import {randomUUID} from 'node:crypto';
import {command,storeConfigured,storageKey} from '../server/storage.mjs';
import {normalizeEmail,digest,passwordRecord} from '../server/auth-core.mjs';
try{
 if(process.env.CONTEXT!=='production'||!storeConfigured())throw Error();
 let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>4096)throw Error()}
 const input=JSON.parse(raw),email=normalizeEmail(input.email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['save','disable'].includes(input.action))throw Error();
 const userKey=storageKey('auth:user:'+digest(email)),existing=await command(['GET',userKey]);let old=null;try{old=JSON.parse(existing||'null')}catch{}
 if(input.action==='disable'&&!old?.id)throw Error();
 const id=old?.id||randomUUID(),enabled=input.action==='save',version=randomUUID();
 const record=enabled?{id,version,enabled:true,...await passwordRecord(input.password)}:{...old,version,enabled:false};
 await command(['EVAL',"redis.call('SET',KEYS[1],ARGV[1]); redis.call('SET',KEYS[2],ARGV[2]); return 1",'2',userKey,storageKey('auth:member:'+id),JSON.stringify(record),JSON.stringify({id,enabled,version})]);
 process.stdout.write(JSON.stringify({saved:true,enabled})+'\n');
}catch{process.stderr.write('Member update failed. Check approved storage configuration and input. No credentials were printed.\n');process.exitCode=1}
