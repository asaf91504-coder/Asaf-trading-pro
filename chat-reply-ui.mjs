import {chatPresentationCopy} from './chat-presentation-copy.mjs';
import {languageCode} from './interface-language.mjs';
import {renderChatText} from './chat-text.mjs';
// Translate deterministic UI only. Never apply a dictionary to model prose.
export function localizedChatReply({before='',answer='',after=''},translate=x=>x){return (before?translate(before)+'\n\n':'')+answer+(after?translate(after):'')}
const replies=new Map();
function renderParts(body,parts){
 const translate=globalThis.window?.asafTranslate|| (x=>x),doc=body.ownerDocument;
 body.replaceChildren();
 const answer=doc.createElement('div');body.append(answer);
 renderChatText(answer,(parts.answer||'')+(parts.after?translate(parts.after):''),doc,parts.citationSources);
 if(parts.before){
  if(!parts.answer){const brief=doc.createElement('p');brief.textContent=translate(parts.before.split('\n')[0]);body.append(brief)}
  const details=doc.createElement('details'),summary=doc.createElement('summary'),content=doc.createElement('div');
  summary.textContent=(chatPresentationCopy[languageCode(doc.documentElement?.lang)]||chatPresentationCopy.en).tools;
  details.append(summary,content);body.append(details);renderChatText(content,translate(parts.before),doc);
 }
}
export function renderChatReply(parent,parts){
 const body=parent.ownerDocument.createElement('div');parent.replaceChildren(body);
 replies.set(body,parts);renderParts(body,parts);
}
if(globalThis.window?.addEventListener)window.addEventListener('asaf:language',()=>{for(const [body,parts] of replies){if(!body.isConnected){replies.delete(body);continue}renderParts(body,parts)}});
