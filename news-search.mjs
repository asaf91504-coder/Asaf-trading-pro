// Searches cached metadata only; no network requests or claims of full coverage.
export function filterCachedNews(articles,{query='',symbol=''}={}){
 const terms=String(query).normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const ticker=String(symbol).split(':').at(-1).toUpperCase();
 return (Array.isArray(articles)?articles:[]).filter(item=>{
  if(ticker&&!(item.symbols||[]).some(s=>String(s).toUpperCase()===ticker))return false;
  const text=[item.title,item.source,...(item.symbols||[])].join(' ').normalize('NFKC').toLocaleLowerCase();
  return terms.every(term=>text.includes(term));
 });
}
