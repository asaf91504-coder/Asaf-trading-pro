import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {command} from '../server/storage.mjs';
// Only durable personal workspaces/conversations. Never export sessions, credentials,
// billing or credits: financial state needs the database provider's consistent backup.
const allowed=/^asaf:production:(workspace|conversations):member:[a-f0-9-]{36}$/;
export function backupKey(raw){if(!/^[a-f0-9]{64}$/i.test(raw||''))throw Error('A separate 32-byte hex backup key is required');return Buffer.from(raw,'hex');}
export function encryptBackup(records,key){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from('ASAF-PERSONAL-BACKUP-V1'));const body=Buffer.concat([cipher.update(JSON.stringify({version:1,at:new Date().toISOString(),records})),cipher.final()]);return JSON.stringify({version:1,nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),body:body.toString('base64')});}
export function decryptBackup(text,key){const v=JSON.parse(text);if(v.version!==1)throw Error('Unsupported backup');const dec=createDecipheriv('aes-256-gcm',key,Buffer.from(v.nonce,'base64'));dec.setAAD(Buffer.from('ASAF-PERSONAL-BACKUP-V1'));dec.setAuthTag(Buffer.from(v.tag,'base64'));const data=JSON.parse(Buffer.concat([dec.update(Buffer.from(v.body,'base64')),dec.final()]).toString());if(data.version!==1||!Array.isArray(data.records)||data.records.length>50000)throw Error('Invalid backup');const seen=new Set();for(const r of data.records){if(!allowed.test(r.key)||seen.has(r.key)||typeof r.value!=='string')throw Error('Invalid record');JSON.parse(r.value);seen.add(r.key);}return data;}
export async function collectBackup({run=command,env=process.env}={}){
 const records=[],seen=new Set();let cursor='0',pages=0;
 do{if(++pages>1000)throw Error('Backup scan limit');const result=await run(['SCAN',cursor,'MATCH','asaf:production:*','COUNT','200'],{env});cursor=String(result[0]);for(const key of result[1]){if(!allowed.test(key)||seen.has(key))continue;seen.add(key);const value=await run(['GET',key],{env});if(value===null)continue;if(typeof value!=='string')throw Error('Unsupported record');JSON.parse(value);records.push({key,value});if(records.length>50000)throw Error('Backup size limit');}}while(cursor!=='0');
 if(!records.length)throw Error('No personal records found; refusing an empty backup');return records;
}
async function main(){const [mode,file]=process.argv.slice(2);if(!file||!['export','verify'].includes(mode))throw Error('Use export|verify and a file path');const key=backupKey(process.env.ASAF_BACKUP_KEY);
 if(mode==='export'){const records=await collectBackup();const encrypted=encryptBackup(records,key);decryptBackup(encrypted,key);await writeFile(file,encrypted,{mode:0o600,flag:'wx'});console.log('Encrypted personal-data export verified. Records: '+records.length);}
 else {const data=decryptBackup(await readFile(file,'utf8'),key);console.log('Decryption and schema verified. Records: '+data.records.length);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Backup failed. Check configuration or file integrity; no record contents were logged.');process.exitCode=1;});
