// Raster presentation only: no provider OHLCV is received or reconstructed here.
const markLabels={support:'תמיכה',resistance:'התנגדות',trendline:'קווי המגמה',neckline:'קו צוואר',headShoulders:'ראש וכתפיים',inverseHeadShoulders:'ראש וכתפיים הפוך',doubleTop:'דאבל טופ',doubleBottom:'דאבל בוטום',cupHandle:'ספל וידית',entry:'כניסה',stop:'סטופ',target:'יעד'};
export function accessibleResearchLevels(value){
 const levels=[];
 for(const level of Array.isArray(value)?value:[]){
  if(!['support','resistance','entry','stop','target'].includes(level?.kind)||!Number.isFinite(level.price)||level.price<=0||levels.some(item=>item.kind===level.kind&&item.price===level.price))continue;
  levels.push({kind:level.kind,price:level.price});if(levels.length===12)break;
 }
 return levels;
}
export function createVentureChartView(local){
 const panel=document.getElementById('localChartPanel'),empty=document.getElementById('chartEmpty');
 const host=document.createElement('section');host.className='panel venture-chart';host.hidden=true;
 const title=document.createElement('h3'),note=document.createElement('p'),image=document.createElement('img'),legend=document.createElement('ul'),missing=document.createElement('p');
 const levels=document.createElement('dl'),largeLevels=document.createElement('dl');levels.id='ventureChartLevels';largeLevels.id='ventureChartLargeLevels';image.setAttribute('aria-describedby',levels.id);
 const toolbar=document.createElement('div'),expand=document.createElement('button');toolbar.className='venture-chart-toolbar';expand.type='button';toolbar.append(title,expand);
 image.style.cssText='display:block;width:100%;height:auto;border-radius:12px';legend.className='venture-chart-legend';missing.className='muted';
 const source=document.createElement('a');source.href='https://twelvedata.com';source.target='_blank';source.rel='noopener noreferrer';source.textContent='Data provided by Twelve Data';host.append(toolbar,note,image,legend,levels,missing,source);panel.after(host);
 const dialog=document.createElement('dialog'),close=document.createElement('button'),largeTitle=document.createElement('h3'),largeImage=document.createElement('img'),frame=document.createElement('div');
 dialog.className='venture-chart-dialog';close.type='button';frame.className='venture-chart-wide';frame.append(largeImage);largeImage.setAttribute('aria-describedby',largeLevels.id);dialog.append(close,largeTitle,frame,largeLevels);document.body.append(dialog);
 let snapshot=null;
 const translate=value=>window.asafTranslate?.(value)??value;
 function paint(){
  expand.textContent=translate('מסך מלא');close.textContent=translate('סגור מסך מלא');dialog.setAttribute('aria-label',translate('גרף מסומן מהסורק'));
  if(!snapshot)return;
  const heading=snapshot.symbol+' · '+snapshot.interval+' · '+snapshot.latestBarTime;title.textContent=largeTitle.textContent=heading;
  image.alt=largeImage.alt=heading+(snapshot.scannerContext?' · '+translate('גרף מסומן מהסורק'):'');
  for(const list of [levels,largeLevels]){
   list.replaceChildren();
   for(const level of accessibleResearchLevels(snapshot.accessibleLevels)){
    const label=document.createElement('dt'),value=document.createElement('dd');label.textContent=translate(markLabels[level.kind]);value.textContent=new Intl.NumberFormat(document.documentElement.lang||'he',{maximumFractionDigits:level.price>=1?2:8}).format(level.price);value.dir='ltr';value.translate=false;list.append(label,value);
   }
   list.hidden=!list.children.length;
  }
  note.textContent=translate(snapshot.scannerContext?'הסימונים מחושבים אוטומטית מנתוני הסריקה. תבניות וקווי מגמה מוצגים רק כאשר זוהו.':'תמונת מחקר מהשרת. אפשר לבקש סימונים בצ׳אט ולפתוח תצוגה רחבה.');
  legend.replaceChildren();
  const indicators=snapshot.indicatorLegend||[...snapshot.chartSettings?.indicators||[]].map((id,i)=>({id,color:i?'#fbbf24':'#38bdf8',available:true}));
  for(const mark of [...indicators.filter(m=>m.available),...(snapshot.researchLegend||[])]){
   const text=mark.id||markLabels[mark.kind];if(!text)continue;
   const item=document.createElement('li');item.textContent=translate(text);item.translate=false;
   if(/^#[a-f0-9]{6}$/i.test(mark.color||''))item.style.setProperty('--mark-color',mark.color);
   legend.append(item);
  }
  const kinds=new Set((snapshot.researchLegend||[]).map(m=>m.kind)),messages=[];
  if(snapshot.scannerContext&&!kinds.has('trendline'))messages.push(translate('לא זוהה קו מגמה שעומד בתנאי הניתוח.'));
  if(snapshot.scannerContext&&!Object.keys(markLabels).some(k=>!['support','resistance','trendline','neckline','entry','stop','target'].includes(k)&&kinds.has(k)))messages.push(translate('לא זוהתה תבנית שעומדת בתנאי הניתוח.'));
  missing.textContent=messages.join(' ');missing.hidden=!messages.length;
 }
 function hide(){snapshot=null;host.hidden=true;image.removeAttribute('src');largeImage.removeAttribute('src');if(dialog.open)dialog.close();}
 expand.onclick=()=>{if(!snapshot)return;largeImage.src=snapshot.image;paint();dialog.showModal();};close.onclick=()=>dialog.close();
 window.addEventListener('asaf:language',paint);
 return {setSnapshot(value){if(value.presentation!=='server-raster'||typeof value.image!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value.image)||value.image.length>2000000)throw Error('תמונת הגרף מהשרת אינה תקינה.');local.clear();snapshot=value;panel.hidden=true;empty.hidden=true;host.hidden=false;image.src=value.image;if(dialog.open)largeImage.src=value.image;paint();},
  setData(...args){hide();return local.setData(...args)},clear(){hide();local.clear()},redraw(){if(!snapshot)local.redraw()},snapshot(){return snapshot?snapshot.image:local.snapshot()},settings(){return snapshot?snapshot.chartSettings:local.settings()},applyActions(actions){if(snapshot)throw Error('הסימונים בתמונת המחקר מחושבים בשרת.');return local.applyActions(actions)},clearAnnotations(){if(!snapshot)local.clearAnnotations()}};
}
