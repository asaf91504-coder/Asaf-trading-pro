// Render only emphasis and inline code. Model text is never HTML, executable
// markup, embedded media, or an automatically followed link.
export function renderChatText(element,value,doc=element.ownerDocument){
 const text=String(value??'');
 element.replaceChildren();
 let offset=0;
 for(const match of text.matchAll(/`[^`\n]+`|\*\*[^*\n]+\*\*/g)){
  if(match.index>offset)element.append(doc.createTextNode(text.slice(offset,match.index)));
  const code=match[0].startsWith('`'),node=doc.createElement(code?'code':'strong');
  node.textContent=match[0].slice(code?1:2,code?-1:-2);element.append(node);
  offset=match.index+match[0].length;
 }
 if(offset<text.length)element.append(doc.createTextNode(text.slice(offset)));
}
