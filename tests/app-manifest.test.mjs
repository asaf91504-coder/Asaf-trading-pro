import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',root),'utf8'));
test('installed app has a stable identity and opens actual chat within HTTPS site scope',()=>{
 assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.dir,'rtl');
 const start=new URL(manifest.start_url,'https://example.test');assert.equal(start.origin,'https://example.test');assert.equal(start.pathname,'/');assert.equal(start.searchParams.get('tab'),'chat');assert.deepEqual([...start.searchParams.keys()],['tab']);
});
test('all advertised icons are real matching size PNG assets, including maskable and Apple icons',()=>{
 for(const icon of [...manifest.icons,{src:'/icons/apple-touch-icon.png',sizes:'180x180'}]){
  const buffer=readFileSync(new URL(icon.src.slice(1),root));assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');const [w,h]=icon.sizes.split('x').map(Number);assert.equal(buffer.readUInt32BE(16),w);assert.equal(buffer.readUInt32BE(20),h);
 }
 assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'&&icon.sizes==='512x512'));
});
test('main application wires manifest, Apple icon, app module, safe viewport and service worker headers',()=>{
 const html=readFileSync(new URL('index.html',root),'utf8'),config=readFileSync(new URL('netlify.toml',root),'utf8');
 assert.match(html,/rel="manifest" href="\/manifest.webmanifest"/);assert.match(html,/rel="apple-touch-icon"/);assert.match(html,/viewport-fit=cover/);assert.match(html,/src="\.\/app-install.mjs"/);assert.match(config,/for = "\/sw.js"/);assert.match(config,/Service-Worker-Allowed = "\/"/);
});
