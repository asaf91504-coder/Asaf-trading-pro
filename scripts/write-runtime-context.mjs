import {writeFile} from 'node:fs/promises';
const context=process.env.CONTEXT;
if(!['production','deploy-preview','branch-deploy','dev'].includes(context))throw Error('Unknown deployment context; refusing to build functions.');
const namespace=context==='production'?'production':'preview';
await writeFile(new URL('../server/runtime-context.mjs',import.meta.url),`// Generated at build time; no credentials.\nexport default '${namespace}';\n`);
console.log('Configured function storage namespace: '+namespace);
