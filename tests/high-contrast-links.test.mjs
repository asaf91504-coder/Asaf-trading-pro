import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../accessibility.css',import.meta.url),'utf8');
function luminance(hex){let raw=hex.replace('#','');if(raw.length===3)raw=[...raw].map(x=>x+x).join('');const rgb=raw.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb.reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)}
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
test('high contrast link rule replaces light backgrounds as well as foreground',()=>{
 const block=css.match(/html\[data-contrast=true\] a\{([^}]+)\}/)[1];
 const foreground=block.match(/(?:^|;)color:(#[0-9a-f]+)!important/)[1];
 const background=block.match(/background:(#[0-9a-f]+)!important/)[1];
 assert.ok(contrast(foreground,background)>=7);
 // Without the background override the focused skip link is cyan on white.
 assert.ok(contrast(foreground,'#fff')<1.5);
 assert.match(block,/text-decoration:underline/);
});
test('keyboard skip links preserve visible focused position and focus outline',()=>{
 assert.match(css,/\.skip-links a:focus\{transform:none\}/);
 assert.match(css,/:where\(a,button,input,textarea,select,summary,\[tabindex\]\):focus-visible\{outline:3px solid #7fffe3!important/);
});
test('default primary button CSS retains AA text contrast',()=>{
 const workspace=readFileSync(new URL('../workspace.css',import.meta.url),'utf8');
 const block=workspace.match(/button\.primary,\.primary\{([^}]+)\}/)[1];
 const background=block.match(/background:(#[0-9a-f]+)/)[1],foreground=block.match(/(?:^|;)color:(#[0-9a-f]+)/)[1];
 assert.ok(contrast(foreground,background)>=4.5);
});
