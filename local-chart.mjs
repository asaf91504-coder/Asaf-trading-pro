// Original candlestick chart: local CSV bars only, no external API or paid data.
export function initLocalChart() {
 const panel=document.getElementById("localChartPanel");
 const canvas=document.getElementById("localChartCanvas");
 const select=document.getElementById("localChartRange");
 const title=document.getElementById("localChartTitle");
 const tooltip=document.getElementById("localChartTooltip");
 const ctx=canvas.getContext("2d");
 let bars=[],symbol="";
 const colors={background:"#0b1b2b",grid:"#263f53",text:"#94b4c9",up:"#42dbc4",down:"#f17b90",ma20:"#eacb72",ma150:"#a18ffc",volume:"#365c70"};
 function meanAt(end,length){
  if(end<length-1)return null;
  let total=0;for(let j=end-length+1;j<=end;j++)total+=bars[j].close;
  return total/length;
 }
 const label=(v)=>Number(v).toLocaleString("en-US",{maximumFractionDigits:2});
 function draw(){
  if(!bars.length||panel.hidden)return;
  const bounds=canvas.getBoundingClientRect();
  const width=Math.max(320,Math.floor(bounds.width)||320),height=360,dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle=colors.background;ctx.fillRect(0,0,width,height);
  const padLeft=12,padRight=60,top=26,priceBottom=257,volTop=282,volBottom=325;
  const count=Math.min(bars.length,Number(select.value)||60),start=bars.length-count;
  const visible=bars.slice(start);
  const lows=visible.map(b=>b.low),highs=visible.map(b=>b.high);
  let min=Math.min(...lows),max=Math.max(...highs);
  for(let i=start;i<bars.length;i++)for(const period of [20,150]){const ma=meanAt(i,period);if(ma!==null){min=Math.min(min,ma);max=Math.max(max,ma)}}
  const extra=Math.max((max-min)*.08,Math.max(0.01,max*.002));min-=extra;max+=extra;
  const plotWidth=width-padLeft-padRight,step=plotWidth/visible.length;
  const x=i=>padLeft+(i+.5)*step,y=val=>top+(max-val)/(max-min)*(priceBottom-top);
  ctx.font="11px system-ui";ctx.textAlign="left";ctx.textBaseline="middle";
  for(let j=0;j<=4;j++){const price=min+(max-min)*j/4,py=y(price);ctx.strokeStyle=colors.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padLeft,py);ctx.lineTo(width-padRight,py);ctx.stroke();ctx.fillStyle=colors.text;ctx.fillText(label(price),width-padRight+6,py)}
  const volumeMax=Math.max(1,...visible.map(b=>b.volume||0));
  for(let i=0;i<visible.length;i++){
   const b=visible[i],px=x(i),color=(b.open===null||b.open===undefined||b.close>=b.open)?colors.up:colors.down;
   const candleWidth=Math.max(1,Math.min(13,step*.65));
   ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,Math.min(2,step*.12));
   ctx.beginPath();ctx.moveTo(px,y(b.high));ctx.lineTo(px,y(b.low));ctx.stroke();
   const yo=y(b.open??b.close),yc=y(b.close);
   ctx.fillStyle=color;ctx.fillRect(px-candleWidth/2,Math.min(yo,yc),candleWidth,Math.max(1,Math.abs(yo-yc)));
   if(b.volume!==null){ctx.fillStyle=color;ctx.globalAlpha=.38;ctx.fillRect(px-candleWidth/2,volBottom-(b.volume/volumeMax)*(volBottom-volTop),candleWidth,Math.max(1,(b.volume/volumeMax)*(volBottom-volTop)));ctx.globalAlpha=1}
  }
  for(const [period,color] of [[20,colors.ma20],[150,colors.ma150]]){
   ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();let started=false;
   for(let i=start;i<bars.length;i++){const avg=meanAt(i,period);if(avg===null)continue;const px=x(i-start),py=y(avg);if(!started){ctx.moveTo(px,py);started=true}else ctx.lineTo(px,py)}
   if(started)ctx.stroke();
  }
  ctx.font="12px system-ui";ctx.fillStyle=colors.text;ctx.textAlign="left";ctx.fillText(visible[0].date,padLeft,346);
  ctx.textAlign="right";ctx.fillText(visible.at(-1).date,width-padRight,346);
  ctx.textAlign="left";ctx.fillStyle=colors.ma20;ctx.fillText("MA20",padLeft+10,12);
  ctx.fillStyle=colors.ma150;ctx.fillText("MA150",padLeft+67,12);
  canvas.dataset.start=String(start);canvas.dataset.step=String(step);canvas.dataset.offset=String(padLeft);
 }
 canvas.addEventListener("pointermove",event=>{
  if(!bars.length||panel.hidden)return;
  const rect=canvas.getBoundingClientRect(),start=Number(canvas.dataset.start),step=Number(canvas.dataset.step),offset=Number(canvas.dataset.offset);
  const i=Math.min(bars.length-1,Math.max(start,start+Math.floor((event.clientX-rect.left-offset)/step)));
  const b=bars[i];if(!b)return;
  tooltip.textContent=b.date+" | O "+(b.open===null?"—":label(b.open))+" H "+label(b.high)+" L "+label(b.low)+" C "+label(b.close)+" | Vol "+(b.volume===null?"—":label(b.volume));
 });
 select.addEventListener("change",draw);
 window.addEventListener("resize",draw,{passive:true});
 return {
  snapshot(){
    if(!bars.length||panel.hidden)throw Error("אין גרף מקורי ליצירת תמונה");
    draw();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const poster=document.createElement("canvas");
    poster.width=canvas.width;poster.height=canvas.height+Math.round(90*dpr);
    const p=poster.getContext("2d");
    p.fillStyle=colors.background;p.fillRect(0,0,poster.width,poster.height);
    p.fillStyle="#e8f3ff";p.font="bold "+Math.round(17*dpr)+"px system-ui";
    p.textAlign="left";p.fillText("ASAF TRADING PRO | "+symbol,Math.round(12*dpr),Math.round(27*dpr));
    p.fillStyle=colors.text;p.font=Math.round(12*dpr)+"px system-ui";
    p.fillText("Data: "+bars.at(-1).date+" | Uploaded/provider candles, not TradingView screenshot",Math.round(12*dpr),Math.round(51*dpr));
    p.drawImage(canvas,0,Math.round(62*dpr));
    p.fillStyle=colors.text;p.font=Math.round(11*dpr)+"px system-ui";
    p.fillText("Educational chart · Always check source/exchange timestamp",Math.round(12*dpr),poster.height-Math.round(9*dpr));
    return poster.toDataURL("image/png");
  },
  setData(nextSymbol,nextBars){
   symbol=String(nextSymbol||"");
   bars=Array.isArray(nextBars)?nextBars:[];
   panel.hidden=!bars.length;
   title.textContent="גרף מקורי לניתוח · "+symbol+" · נר אחרון "+(bars.at(-1)?.date||"");
   tooltip.textContent="העבר את האצבע או הסמן על נר כדי לראות OHLC ומחזור.";
   if(bars.length)requestAnimationFrame(draw);
  },
  redraw:draw,
  clear(){bars=[];panel.hidden=true}
 };
}
