import {readFile,writeFile,copyFile,mkdir,rm,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const directory=path.dirname(fileURLToPath(import.meta.url));
const pages=['index.html','journal.html','activate.html','data-privacy.html','accessibility.html','terms.html','help.html','offline.html'];
const styles=['workspace.css','terminal.css','app.css','accessibility.css'];
const imports=source=>[...source.matchAll(/(?:\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?|\bimport\s*\()\s*['"]([^'"]+)['"]/g)].map(match=>match[1]);
function localFile(value){
 const clean=value.split(/[?#]/)[0].replace(/^\.\//,'').replace(/^\//,'');
 if(!/^[A-Za-z0-9._-]+\.(?:mjs|css|html)$/.test(clean)||clean.includes('..'))throw Error('Native build rejected a non-public path.');
 return clean;
}
export async function prepareNativeAssets({sourceRoot=path.resolve(directory,'..'),output=path.join(directory,'www'),bundleBootstrap=true,bootstrapFile=path.join(directory,'native-bootstrap.mjs')}={}){
 // Never package a repository directory wholesale: it contains server source,
 // tests and local environment files that do not belong in an app binary.
 await readFile(bootstrapFile,'utf8');
 await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
 const copied=new Set(),modules=[];
 const copy=async name=>{if(copied.has(name))return;const stat=await lstat(path.join(sourceRoot,name));if(!stat.isFile()||stat.isSymbolicLink())throw Error('Native asset must be a regular public file.');await copyFile(path.join(sourceRoot,name),path.join(output,name));copied.add(name)};
 for(const name of pages){
  let html=await readFile(path.join(sourceRoot,name),'utf8');
  html=html.replace(/<script\b[^>]*\bsrc=["'](?:\.\/|\/)?app-install\.mjs["'][^>]*><\/script>/gi,'').replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>/gi,'');
  html=html.replace(/<head>/i,'<head><script src="./native-bootstrap.js"></script>');
  // Capacitor serves bundled files, not the production host's extension aliases.
  html=html.replace(/href="\/activate(?=["#?])/g,'href="/activate.html');
  for(const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.mjs)["']/gi))modules.push(localFile(match[1]));
  await writeFile(path.join(output,name),html);copied.add(name);
 }
 for(const name of styles)await copy(name);
 while(modules.length){
  const name=modules.shift();if(copied.has(name))continue;
  if(name==='app-install.mjs')throw Error('Web installation/service worker code cannot be bundled natively.');
  const source=await readFile(path.join(sourceRoot,name),'utf8');
  for(const dependency of imports(source)){
   if(!dependency.startsWith('./'))throw Error('Native public modules may only import local public modules: '+name);
   const child=localFile(dependency);if(!child.endsWith('.mjs'))throw Error('Unexpected native public module type.');modules.push(child);
  }
  await copy(name);
 }
 await mkdir(path.join(output,'icons'),{recursive:true});
 for(const entry of await readdir(path.join(sourceRoot,'icons'),{withFileTypes:true})){
  if(!entry.isFile()||!/^app-(?:icon\.svg|192\.png|512\.png|maskable-512\.png)$|^apple-touch-icon\.png$/.test(entry.name))continue;
  const name='icons/'+entry.name;await copyFile(path.join(sourceRoot,name),path.join(output,name));copied.add(name);
 }
 if(bundleBootstrap){
  const {build}=await import('esbuild');await build({entryPoints:[bootstrapFile],outfile:path.join(output,'native-bootstrap.js'),bundle:true,format:'iife',platform:'browser',target:['safari15','chrome100'],minify:false,sourcemap:false,legalComments:'none'});
 }
 copied.add('native-bootstrap.js');
 await writeFile(path.join(output,'native-assets.json'),JSON.stringify({application:'ASAF Trading Pro',type:'bundled-native-assets',files:[...copied].sort()},null,2)+'\n');
 return {files:[...copied].sort(),output};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await prepareNativeAssets();console.log('Prepared '+result.files.length+' public assets at '+result.output+'. This does not compile or sign a native binary.');
}
