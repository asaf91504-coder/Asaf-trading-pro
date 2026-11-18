const sourceLabels=new Map();
function label(node,text){sourceLabels.set(node,text);node.textContent=globalThis.window?.asafTranslate?.(text)||text}
if(globalThis.window?.addEventListener)window.addEventListener('asaf:language',()=>{for(const [node,text] of sourceLabels){if(!node.isConnected){sourceLabels.delete(node);continue}node.textContent=window.asafTranslate?.(text)||text}});
export function renderSearchSources(parent,research,doc=parent.ownerDocument){
 if(research?.status!=='available'||!Array.isArray(research.sources))return;
 const section=doc.createElement('section');section.setAttribute('aria-label','מקורות מהחיפוש באינטרנט');
 const heading=doc.createElement('p');label(heading,'מקורות מהחיפוש באינטרנט');section.append(heading);
 for(const source of research.sources.slice(0,5)){
  try{const u=new URL(source.url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)continue;
   const row=doc.createElement('p'),a=doc.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='['+source.id+'] '+String(source.title||u.hostname);row.append(a);section.append(row);
  }catch{}
 }
 const stamp=doc.createElement('small');label(stamp,'מועד החיפוש: '+String(research.searchedAt||'')+' · אינו מועד פרסום המקורות');section.append(stamp);parent.append(section);
}
