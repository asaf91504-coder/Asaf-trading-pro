const sourceLabels=new Map();
function translateLabel(text){return globalThis.window?.asafTranslate?.(text)||text}
function applyLabel(node,text,attribute){if(attribute)node.setAttribute(attribute,translateLabel(text));else node.textContent=translateLabel(text)}
export function labelChatSource(node,text,attribute=null){sourceLabels.set(node,{text,attribute});applyLabel(node,text,attribute)}
if(globalThis.window?.addEventListener)window.addEventListener('asaf:language',()=>{for(const [node,{text,attribute}] of sourceLabels){if(!node.isConnected){sourceLabels.delete(node);continue}applyLabel(node,text,attribute)}});
export function renderSearchSources(parent,research,doc=parent.ownerDocument){
 if(research?.status!=='available'||!Array.isArray(research.sources))return;
 const section=doc.createElement('section');labelChatSource(section,'מקורות מהחיפוש באינטרנט','aria-label');
 const heading=doc.createElement('p');labelChatSource(heading,'מקורות מהחיפוש באינטרנט');section.append(heading);
 for(const source of research.sources.slice(0,5)){
  try{const u=new URL(source.url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)continue;
   const row=doc.createElement('p'),a=doc.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='['+source.id+'] '+String(source.title||u.hostname);row.append(a);section.append(row);
  }catch{}
 }
 const stamp=doc.createElement('small');labelChatSource(stamp,'מועד החיפוש: '+String(research.searchedAt||'')+' · אינו מועד פרסום המקורות');section.append(stamp);parent.append(section);
}
