import {Resvg} from '@resvg/resvg-js';
import {resolve} from 'node:path';
import {chartIndicators} from '../chart-indicators.mjs';
import {executeChartActions} from '../chart-command-controller.mjs';
import {validateChartActions} from '../chat-chart-actions.mjs';
import {MarketError} from './market-feed.mjs';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const number=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
// Bundle a small licensed ASCII font: Lambda runtimes need not have system fonts.
export function rasterFontOptions(){return {loadSystemFonts:false,fontFiles:[resolve(process.env.LAMBDA_TASK_ROOT||process.cwd(),'server-assets/chart-sans.ttf')],defaultFontFamily:'DejaVu Sans'}}
// This SVG stays on the server. Only rasterized PNG pixels cross the boundary.
export async function ventureChart(snapshot,input=[]){
 const actions=validateChartActions(input);
 if(actions.some(a=>a.type==='symbol'))throw new MarketError('בחר מניה בשדה הסימול.',400);
 const bars=snapshot.bars,indicators=new Set(['MA20','MA150']);let annotations=[],style='candles';
 const supported=new Set(['MA20','MA150','MA50','MA100','MA200','EMA50']);
 if(actions.some(a=>a.type==='indicator'&&!supported.has(a.indicator)))throw new MarketError('בתמונת המחקר נתמכים MA20/50/100/150/200 ו־EMA50. מדדים נוספים זמינים בניתוח הצ׳אט.',400);
 if(actions.some(a=>a.type==='style'&&!['candles','line'].includes(a.style)))throw new MarketError('בתמונת המחקר זמינים נרות וקו.',400);
 const receipt=await executeChartActions(actions,{getSymbol:()=>snapshot.symbol,getData:()=>snapshot,applyRender(items){for(const a of items){if(a.type==='indicator')a.enabled?indicators.add(a.indicator):indicators.delete(a.indicator);if(a.type==='style')style=a.style;if(a.type==='clear_annotations')annotations=[];if(a.type==='annotations')annotations=a.items}},fetchData(){throw Error('Unexpected data load')}});
 const W=1200,H=690,left=70,right=90,top=85,bottom=510,visible=bars.slice(-120),start=bars.length-visible.length;
 const computed=chartIndicators(bars),series={MA20:computed.sma20,MA50:computed.sma50,MA100:computed.sma100,MA150:computed.sma150,MA200:computed.sma200,EMA50:computed.ema50};
 // Some indicator implementations use ma instead of sma; compute SMA directly.
 for(const id of indicators)if(id.startsWith('MA')){const period=Number(id.slice(2));series[id]=bars.map((_,i)=>i+1<period?null:bars.slice(i+1-period,i+1).reduce((sum,b)=>sum+b.close,0)/period)}
 const prices=visible.flatMap(b=>[b.low,b.high]);for(const id of indicators)prices.push(...series[id].slice(start).filter(Number.isFinite));
 let low=Math.min(...prices),high=Math.max(...prices);const pad=(high-low||high*.05)*.08;low-=pad;high+=pad;
 const step=(W-left-right)/visible.length,x=i=>left+(i+.5)*step,y=p=>bottom-(p-low)/(high-low)*(bottom-top);
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="1200" height="690" fill="#101b2a"/><g font-family="DejaVu Sans,Arial,sans-serif" fill="#d9e8fa"><text x="25" y="32" font-size="22">ASAF PRO | ${escape(snapshot.symbol)} | ${escape(snapshot.interval)}</text><text x="25" y="57" font-size="14">Last bar: ${escape(snapshot.latestBarTime)} | Received: ${escape(snapshot.receivedAt)}</text>`;
 for(let i=0;i<=5;i++){const py=top+(bottom-top)*i/5,p=high-(high-low)*i/5;svg+=`<path d="M${left} ${py}H${W-right}" stroke="#29384b"/><text x="${W-right+8}" y="${py+5}" font-size="13">${number(p)}</text>`}
 svg+='<defs><clipPath id="plot"><rect x="70" y="85" width="1040" height="425"/></clipPath></defs><g clip-path="url(#plot)">';
 if(style==='line')svg+=`<polyline points="${visible.map((b,i)=>x(i)+','+y(b.close)).join(' ')}" fill="none" stroke="#5eead4" stroke-width="2"/>`;
 else visible.forEach((b,i)=>{const px=x(i),color=b.close>=b.open?'#42dbc0':'#fb7185',w=Math.max(2,step*.6);svg+=`<path d="M${px} ${y(b.high)}V${y(b.low)}" stroke="${color}"/><rect x="${px-w/2}" y="${Math.min(y(b.open),y(b.close))}" width="${w}" height="${Math.max(1,Math.abs(y(b.open)-y(b.close)))}" fill="${color}"/>`});
 const colors=['#38bdf8','#fbbf24','#c084fc','#fb923c','#a3e635','#f472b6'];let legend=[];
 [...indicators].forEach((id,j)=>{const points=series[id].slice(start).map((v,i)=>Number.isFinite(v)?x(i)+','+y(v):null).filter(Boolean);if(points.length)svg+=`<polyline points="${points.join(' ')}" fill="none" stroke="${colors[j]}" stroke-width="2"/>`;legend.push(`<text x="${25+j*140}" y="620" fill="${colors[j]}" font-size="14">${id}${points.length?'':' (no history)'}</text>`)});
 const positions=new Map(visible.map((b,i)=>[b.date,i]));
 for(const a of annotations){const points=a.points.filter(p=>positions.has(p.date)).map(p=>x(positions.get(p.date))+','+y(p.price));if(points.length>1)svg+=`<polyline points="${points.join(' ')}" fill="none" stroke="${a.kind==='support'?'#a3e635':'#fbbf24'}" stroke-width="2" stroke-dasharray="6 4"/>`}
 svg+='</g>';
 const maxVolume=Math.max(0,...visible.map(b=>b.volume||0));
 if(maxVolume>0)visible.forEach((b,i)=>{if(!Number.isFinite(b.volume))return;const height=b.volume/maxVolume*48;svg+=`<rect x="${x(i)-step*.3}" y="${580-height}" width="${Math.max(2,step*.6)}" height="${height}" fill="${b.close>=b.open?'#42dbc0':'#fb7185'}" opacity=".6"/>`});
 svg+='<text x="25" y="540" font-size="10">VOL</text>';
 for(const i of [0,Math.floor(visible.length/2),visible.length-1])svg+=`<text x="${x(i)}" y="595" text-anchor="middle" font-size="12">${escape(visible[i].date.slice(0,16))}</text>`;
 svg+=legend.join('')+`<text x="25" y="650" font-size="14">Data provided by Twelve Data | Static research image | No raw data export</text><text x="25" y="674" font-size="12">${snapshot.interval==='1day'?'Previous daily sessions only. EOD volume; not live intraday volume.':'Intraday volume is not consolidated. Latest candle may be incomplete.'} Conditional research, not a trade order.</text></g></svg>`;
 const png=new Resvg(svg,{font:rasterFontOptions()}).render().asPng();
 return {presentation:'server-raster',source:'Twelve Data',symbol:snapshot.symbol,interval:snapshot.interval,receivedAt:snapshot.receivedAt,latestBarTime:snapshot.latestBarTime,candleCount:bars.length,chartSettings:{style,indicators:[...indicators],visibleRange:{start:visible[0].date,end:snapshot.latestBarTime}},firstVisibleBarTime:visible[0].date,exchangeTimezone:snapshot.exchangeTimezone,coverage:snapshot.coverage,barPolicy:snapshot.barPolicy,latestBarMayBePartial:snapshot.latestBarMayBePartial,delayMinutes:snapshot.delayMinutes,cached:snapshot.cached===true,image:'data:image/png;base64,'+Buffer.from(png).toString('base64'),messages:receipt.messages};
}

// Explicit allowlist: never spread a scan record, summary or pattern candidate.
export function ventureScanRecord(record,screen){
 const s=record.summary;
 return {presentation:'derived-only',source:'Twelve Data',symbol:record.symbol,receivedAt:record.receivedAt,asOf:s.date,coverage:record.coverage,barPolicy:record.barPolicy,
  metrics:{aboveMA20:s.aboveMA20,aboveMA150:s.aboveMA150,atrPercent:s.atrPercent,relativeVolume:s.volumeRatio,rsi14:s.rsi14,adx14:s.adx14,supertrendDirection:s.supertrendDirection},
  marketCapStatus:record.fundamentals?.status==='available'?'available':'unavailable',
  patterns:(record.research?.candidates||[]).map(c=>({kind:c.kind,label:c.label,stage:c.stage,movePercent:c.scenario?.movePercent??null,riskReward:c.scenario?.riskReward??null,side:c.scenario?.side??null})),
  screen:{matches:screen.matches,reasons:screen.reasons}};
}
