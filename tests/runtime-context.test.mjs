import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('bundled production/preview namespace survives absence of runtime CONTEXT; unknown builds fail',async()=>{
 const root=await mkdtemp(join(tmpdir(),'asaf-context-'));try{
 await mkdir(join(root,'scripts'));await mkdir(join(root,'server'));
 await copyFile(new URL('../scripts/write-runtime-context.mjs',import.meta.url),join(root,'scripts/write-runtime-context.mjs'));
 await copyFile(new URL('../server/storage.mjs',import.meta.url),join(root,'server/storage.mjs'));
 for(const context of ['production','deploy-preview','branch-deploy']){
  const env={PATH:process.env.PATH,CONTEXT:context};const built=spawnSync(process.execPath,['scripts/write-runtime-context.mjs'],{cwd:root,env,encoding:'utf8'});assert.equal(built.status,0,built.stderr);
  const result=spawnSync(process.execPath,['--input-type=module','-e',"import {storageKey} from './server/storage.mjs';process.stdout.write(storageKey('auth:invite:test',{}));"],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'asaf:'+(context==='production'?'production':'preview')+':auth:invite:test');
 }
 const before=await readFile(join(root,'server/runtime-context.mjs'),'utf8');const invalid=spawnSync(process.execPath,['scripts/write-runtime-context.mjs'],{cwd:root,env:{PATH:process.env.PATH,CONTEXT:'unknown'},encoding:'utf8'});assert.notEqual(invalid.status,0);assert.equal(await readFile(join(root,'server/runtime-context.mjs'),'utf8'),before);
 }finally{await rm(root,{recursive:true,force:true})}
});
