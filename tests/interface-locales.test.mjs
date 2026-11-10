import test from 'node:test';
import assert from 'node:assert/strict';
import {interfaceLocales,resolveInterfaceLocale,interfaceText} from '../interface-locales.mjs';
test('all ten catalogs provide the same complete navigation keys',()=>{
 assert.equal(Object.keys(interfaceLocales).length,10);
 const keys=Object.keys(interfaceLocales.he.messages).sort();
 for(const [code,locale] of Object.entries(interfaceLocales)){
  assert.deepEqual(Object.keys(locale.messages).sort(),keys);
  for(const key of keys)assert.ok(interfaceText(code,key).trim());
  assert.equal(locale.direction,['he','ar'].includes(code)?'rtl':'ltr');
 }
});
test('regional locale tags resolve without allowing prototype or unknown keys',()=>{
 for(const [input,expected] of [['en-US','en'],['es_MX','es'],['zh-Hans','zh'],['AR-sa','ar'],['constructor','he'],['__proto__','he'],['unknown','he'],[null,'he']])assert.equal(resolveInterfaceLocale(input),expected);
 assert.equal(interfaceText('en','news'),'News');
 assert.equal(interfaceText('unknown','news'),'חדשות');
});
