import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const terminal=readFileSync(new URL('../terminal-ui.mjs',import.meta.url),'utf8');
test('shared stock search lives outside panels and is available from the default chat',()=>{
 assert.match(terminal,/main\.querySelector\('\.tabs'\)\.before\(searchBar\)/);
 assert.match(terminal,/mountAssetSearch\(\{host:searchBar/);
 assert.doesNotMatch(terminal,/mountAssetSearch\(\{host:command/);
 assert.match(terminal,/emptySearch\.onclick=\(\)=>searchBar\.querySelector\('button'\)\.click\(\)/);
});
test('signed-out provider status does not advertise an inaccessible legacy provider',()=>{
 const source=readFileSync(new URL('../stock-chat-ui.mjs',import.meta.url),'utf8');
 assert.match(source,/if\(!loaded\)marketStatus\.textContent=!authState\.authenticated\?/);
});
