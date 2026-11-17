// Raster presentation only: no provider OHLCV is received or reconstructed here.
export function createVentureChartView(local){
 const panel=document.getElementById('localChartPanel'),empty=document.getElementById('chartEmpty');
 const host=document.createElement('section');host.className='panel venture-chart';host.hidden=true;
 const title=document.createElement('h3'),note=document.createElement('p'),image=document.createElement('img');
 image.style.cssText='display:block;width:100%;height:auto;border-radius:12px';image.alt='תמונת גרף מחקר שנוצרה בשרת; MA20 ו־MA150 מסומנים בצבעים.';
 note.textContent='תמונת מחקר מהשרת · בחירת מניה וטווח יוצרת תמונה חדשה. ניתוח וסימונים דרך הצ׳אט. אין זום, גלילה או טבלת נתוני נרות.';
 const source=document.createElement('a');source.href='https://twelvedata.com';source.target='_blank';source.rel='noopener noreferrer';source.textContent='Data provided by Twelve Data';host.append(title,note,image,source);panel.after(host);
 let snapshot=null;
 function hide(){snapshot=null;host.hidden=true;image.removeAttribute('src')}
 return {setSnapshot(value){if(value.presentation!=='server-raster'||typeof value.image!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value.image)||value.image.length>2000000)throw Error('תמונת הגרף מהשרת אינה תקינה.');local.clear();snapshot=value;panel.hidden=true;empty.hidden=true;host.hidden=false;title.textContent=value.symbol+' · '+value.interval+' · עד '+value.latestBarTime;image.src=value.image;},
  setData(...args){hide();return local.setData(...args)},clear(){hide();local.clear()},redraw(){if(!snapshot)local.redraw()},snapshot(){return snapshot?snapshot.image:local.snapshot()},settings(){return snapshot?snapshot.chartSettings:local.settings()},applyActions(actions){if(snapshot)throw Error('הסימונים בתמונת המחקר מחושבים בשרת.');return local.applyActions(actions)},clearAnnotations(){if(!snapshot)local.clearAnnotations()}};
}
