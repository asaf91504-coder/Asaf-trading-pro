import {languageNames,languageCode,languageDirection,savedLanguage,saveLanguage,createTranslator} from './interface-language.mjs';
const originals=new WeakMap(),attributeOriginals=new WeakMap(),canonicalPrompts=new Map();
const excluded='script,style,noscript,code,pre,[contenteditable], [translate="no"],.bubble.user,#newsFeed .source-card a,.conversation-archive-preview,#researchRows .source-card a,#researchRows .source-card p,#journalRows td:last-child,#communityFeed h3,#communityFeed .setup-thesis,#communityFeed small';
let translate=text=>text,selected='he',revision=0;
const nativeConfirm=window.confirm.bind(window),nativePrompt=window.prompt.bind(window);
window.confirm=message=>nativeConfirm(translate(String(message)));
window.prompt=(message,value)=>nativePrompt(translate(String(message)),value);
const label=document.createElement('label');label.className='interface-language-picker';label.translate=false;
const caption=document.createElement('span');caption.textContent='🌐';caption.setAttribute('aria-hidden','true');
const select=document.createElement('select');select.id='interfaceLanguage';select.setAttribute('aria-label','Language / שפה');
for(const [code,name] of Object.entries(languageNames)){const option=document.createElement('option');option.value=code;option.textContent=name;option.lang=code;select.append(option)}
label.append(caption,select);(document.querySelector('header')||document.body).append(label);
const status=document.createElement('span');status.className='language-status';status.setAttribute('role','status');status.translate=false;label.append(status);
function eligible(node){return !node.closest(excluded)}
function updateText(node){if(!node.parentElement||node.parentElement.tagName?.toLowerCase()==='textarea'||!eligible(node.parentElement))return;const previous=originals.get(node),current=node.nodeValue;const source=previous&&current===previous.rendered?previous.source:current;const rendered=translate(source);originals.set(node,{source,rendered});if(current!==rendered)node.nodeValue=rendered}
function updateAttributes(el){if(!eligible(el))return;let records=attributeOriginals.get(el);if(!records){records={};attributeOriginals.set(el,records)}for(const name of ['placeholder','title','aria-label','alt']){if(!el.hasAttribute(name))continue;const current=el.getAttribute(name),previous=records[name],source=previous&&current===previous.rendered?previous.source:current,rendered=translate(source);records[name]={source,rendered};if(current!==rendered)el.setAttribute(name,rendered)}}
function scan(root){if(root.nodeType===3){updateText(root);return}if(root.nodeType!==1)return;if(!eligible(root))return;updateAttributes(root);if(root.tagName?.toLowerCase()==='textarea')return;for(const child of root.childNodes)scan(child)}
const observer=new MutationObserver(records=>{observer.disconnect();for(const record of records){if(record.type==='characterData')updateText(record.target);else if(record.type==='attributes')updateAttributes(record.target);else for(const node of record.addedNodes)scan(node)}observe()});
function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt']})}
async function applyLanguage(value){const code=languageCode(value),request=++revision;select.disabled=true;status.textContent='';try{
 let catalog={};if(code!=='he'){const response=await fetch('./locales/'+code+'.json',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('language');catalog=await response.json();if(!catalog||Array.isArray(catalog)||typeof catalog!=='object')throw Error('catalog')}
 if(request!==revision)return;translate=createTranslator(catalog);for(const [source,translated] of Object.entries(catalog))canonicalPrompts.set(translated,source);window.asafCanonicalPrompt=question=>canonicalPrompts.get(question)||question;window.asafTranslate=translate;selected=code;document.documentElement.lang=code;document.documentElement.dir=languageDirection(code);try{saveLanguage(window.localStorage,code)}catch{};select.value=code;observer.disconnect();scan(document.body);observe();window.dispatchEvent(new CustomEvent('asaf:language',{detail:{language:code}}));window.dispatchEvent(new Event('asaf:layout'));
 }catch{if(request===revision){select.value=selected;status.textContent='Language unavailable. Try again. / טעינת השפה נכשלה; נסה שוב.'}}finally{if(request===revision)select.disabled=false}}
select.addEventListener('change',()=>applyLanguage(select.value));
let initial='he';try{initial=savedLanguage(window.localStorage)}catch{}observe();applyLanguage(initial);
