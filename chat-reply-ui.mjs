import {renderChatText} from './chat-text.mjs';
// Translate deterministic UI only. Never apply a dictionary to model prose.
export function localizedChatReply({before='',answer='',after=''},translate=x=>x){return (before?translate(before)+'\n\n':'')+answer+(after?translate(after):'')}
const replies=new Map();
export function renderChatReply(parent,parts){
 const body=parent.ownerDocument.createElement('div');parent.replaceChildren(body);
 replies.set(body,parts);renderChatText(body,localizedChatReply(parts,globalThis.window?.asafTranslate),body.ownerDocument,parts.citationSources);
}
if(globalThis.window?.addEventListener)window.addEventListener('asaf:language',()=>{for(const [body,parts] of replies){if(!body.isConnected){replies.delete(body);continue}renderChatText(body,localizedChatReply(parts,window.asafTranslate),body.ownerDocument,parts.citationSources)}});
