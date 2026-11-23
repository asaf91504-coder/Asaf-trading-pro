// Only explicitly validated search metadata can become inline links. Model text
// is never HTML, embedded media, or an automatically followed link.
export function renderChatText(element,value,doc=element.ownerDocument,citationSources){
 element.translate=false;
 element.dir='auto';
 const text=String(value??'');
 element.replaceChildren();
 const links=new Map();
 for(const source of Array.isArray(citationSources)?citationSources.slice(0,5):[]){
  try{
   const u=new URL(source.url);
   if(!Number.isInteger(source.id)||source.id<1||source.id>5||u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||u.hostname.includes(':')||/^[0-9.]+$/.test(u.hostname)||/\.(?:local|localhost|internal|invalid|test)$/i.test(u.hostname))continue;
   links.set(source.id,u.href);
  }catch{}
 }
 let offset=0;
 for(const match of text.matchAll(/`[^`\n]+`|\*\*[^*\n]+\*\*|\[[1-5]\]/g)){
  if(match.index>offset)element.append(doc.createTextNode(text.slice(offset,match.index)));
  if(match[0].startsWith('[')){
   const url=links.get(Number(match[0][1]));
   if(!url)element.append(doc.createTextNode(match[0]));
   else{const a=doc.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=match[0];element.append(a);}
  }else{
   const code=match[0].startsWith('`'),node=doc.createElement(code?'code':'strong');
   node.textContent=match[0].slice(code?1:2,code?-1:-2);element.append(node);
  }
  offset=match.index+match[0].length;
 }
 if(offset<text.length)element.append(doc.createTextNode(text.slice(offset)));
}
