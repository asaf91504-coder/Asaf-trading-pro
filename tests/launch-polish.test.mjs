import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {launchTranslations} from '../launch-translations.mjs';import {createTranslator} from '../interface-language.mjs';
import {encryptBackup,decryptBackup,collectBackup,backupKey} from '../scripts/account-backup.mjs';
import {isMarketHeadline} from '../server/public-news-service.mjs';
test('help content and subscription public copy translate completely in all nine languages',()=>{
 const help=readFileSync(new URL('../help.html',import.meta.url),'utf8');
 const sub=readFileSync(new URL('../subscription.html',import.meta.url),'utf8');
 const fragment=help+sub.slice(sub.indexOf('<main'),sub.indexOf('<section id="billingAccount"'))+sub.slice(sub.indexOf('<section class="subscription-faq"'),sub.indexOf('<footer>'));
 const texts=[...fragment.matchAll(/>([^<>]+)</g)].map(x=>x[1]).filter(t=>/[\u0590-\u05ff]/.test(t));
 for(const lang of Object.keys(launchTranslations)){const catalog=JSON.parse(readFileSync(new URL('../locales/'+lang+'.json',import.meta.url)));const tr=createTranslator({...catalog,...launchTranslations[lang]});for(const t of texts)assert.doesNotMatch(tr(t),/[\u0590-\u05ff]/,lang+': '+t);}
 assert.doesNotMatch(help,/CoinLore|תפריטי האינדיקטורים והציור/);
});
test('encrypted backup round-trip, wrong key and tampering',()=>{
 const key=backupKey('11'.repeat(32)),records=[{key:'asaf:production:workspace:member:'+'a'.repeat(36),value:JSON.stringify({note:'private note'})}];const text=encryptBackup(records,key);assert.ok(!text.includes('private note'));assert.deepEqual(decryptBackup(text,key).records,records);assert.throws(()=>decryptBackup(text,backupKey('22'.repeat(32))));const bad=JSON.parse(text);bad.tag=Buffer.alloc(16).toString('base64');assert.throws(()=>decryptBackup(JSON.stringify(bad),key));assert.throws(()=>backupKey('short'));assert.throws(()=>decryptBackup(encryptBackup([...records,...records],key),key));
});
test('personal export excludes secrets, financial state, rate limits and duplicate scan keys',async()=>{
 const key='asaf:production:conversations:member:'+'a'.repeat(36);const calls=[];const records=await collectBackup({run:async args=>{calls.push(args);return args[0]==='SCAN'?['0',[key,key,'asaf:production:auth:session:secret','asaf:production:billing:account:x','asaf:production:conversations:rate:x']]:JSON.stringify({messages:[]});}});assert.equal(records.length,1);assert.equal(calls.filter(a=>a[0]==='GET').length,1);await assert.rejects(collectBackup({run:async()=>['0',[]]}));
});
test('generic print edition pages are not market headlines',()=>{assert.equal(isMarketHeadline({id:'markets:1',title:'Print Edition | Wall Street Journal - WSJ'}),false);assert.equal(isMarketHeadline({id:'markets:2',title:'Nvidia earnings rise - Reuters'}),true);});
