import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareNativeAssets} from '../build.mjs';
async function fixture(run){
 const temporary=await mkdtemp(path.join(os.tmpdir(),'asaf-native-assets-')),sourceRoot=path.join(temporary,'public'),output=path.join(temporary,'result'),bootstrapFile=path.join(temporary,'native-bootstrap.mjs');
 await mkdir(sourceRoot);await mkdir(path.join(sourceRoot,'icons'));await writeFile(bootstrapFile,'/* native bootstrap fixture */');
 for(const page of ['index.html','journal.html','activate.html','data-privacy.html','accessibility.html','terms.html','help.html','offline.html'])await writeFile(path.join(sourceRoot,page),'<html><head><link rel="manifest" href="/manifest.webmanifest"></head><body><script type="module" src="./app-install.mjs"></script><script type="module" src="./a.mjs"></script></body></html>');
 for(const css of ['workspace.css','terminal.css','app.css','accessibility.css'])await writeFile(path.join(sourceRoot,css),'body{}');
 await writeFile(path.join(sourceRoot,'a.mjs'),"import {value} from './b.mjs'; export {value};");await writeFile(path.join(sourceRoot,'b.mjs'),'export const value=1;');
 await writeFile(path.join(sourceRoot,'.env'),'SECRET=not-a-public-asset');await writeFile(path.join(sourceRoot,'private.mjs'),'export const key="secret"');await mkdir(path.join(sourceRoot,'server'));await writeFile(path.join(sourceRoot,'server','auth.mjs'),'private server');
 try{await run({sourceRoot,output,bootstrapFile,bundleBootstrap:false})}finally{await rm(temporary,{recursive:true,force:true})}
}
test('bundle packages only public reachable assets, strips PWA controls and injects native bootstrap first',async()=>fixture(async options=>{
 const result=await prepareNativeAssets(options),files=await readdir(options.output),index=await readFile(path.join(options.output,'index.html'),'utf8');
 assert.ok(files.includes('a.mjs'));assert.ok(files.includes('b.mjs'));assert.ok(!files.includes('.env'));assert.ok(!files.includes('server'));assert.ok(!files.includes('private.mjs'));assert.ok(!files.includes('app-install.mjs'));assert.doesNotMatch(index,/app-install|manifest/);assert.match(index,/<head><script src="\.\/native-bootstrap.js"><\/script>/);assert.equal(result.files.filter(name=>name==='b.mjs').length,1);
}));
test('module graph rejects server traversal and bare imports instead of leaking backend or dependencies',async()=>{
 for(const dependency of ['../server/auth.mjs','./server/auth.mjs','node:crypto','some-package'])await fixture(async options=>{await writeFile(path.join(options.sourceRoot,'b.mjs'),`import '${dependency}';`);await assert.rejects(()=>prepareNativeAssets(options),/public|local|path/)});
});
test('native configuration never downloads remote interface or enables mixed content',async()=>{
 const config=JSON.parse(await readFile(new URL('../capacitor.config.json',import.meta.url),'utf8'));assert.equal(config.server.url,undefined);assert.equal(config.server.cleartext,false);assert.equal(config.server.allowNavigation,undefined);assert.equal(config.android.allowMixedContent,false);assert.equal(config.plugins.CapacitorHttp.enabled,true);
});
