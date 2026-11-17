// Preparation only: no provider calls, endpoint, credentials or licence switches.
// Provider prices stay in server memory; the output is an opaque RGB PNG.
import {deflateSync} from 'node:zlib';

function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc])}
const glyphs={
 '0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001111',
 'A':'010101111101101','B':'110101110101110','C':'111100100100111','D':'110101101101110','E':'111100110100111','F':'111100110100100','G':'111100101101111','H':'101101111101101','I':'111010010010111','J':'001001001101111','K':'101101110101101','L':'100100100100111','M':'101111111101101','N':'101111111111101','O':'111101101101111','P':'111101111100100','Q':'111101101111001','R':'110101110101101','S':'111100111001111','T':'111010010010010','U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101','Y':'101101010010010','Z':'111001010100111','/':'001001010100100','_':'000000000000111',
 '.':'000000000000010','-':'000000111000000',':':'000010000010000',' ':'000000000000000'
};
export function renderMarketRaster(bars,{width=960,height=540,label=null}={}){
 if(!Number.isInteger(width)||width<320||width>1920||!Number.isInteger(height)||height<240||height>1080)throw Error('Invalid raster dimensions');
 if(!Array.isArray(bars)||bars.length<2||bars.length>2000)throw Error('Invalid raster history');
 let previous='';for(const b of bars){if(!b||typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(b.date)||!Number.isFinite(Date.parse(b.date.replace(' ','T')+(b.date.length>10?'Z':'')))||b.date<=previous||!['open','high','low','close'].every(k=>typeof b[k]==='number'&&Number.isFinite(b[k])&&b[k]>0)||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||(b.volume!=null&&(!Number.isFinite(b.volume)||b.volume<0)))throw Error('Invalid raster candle');previous=b.date}
 const data=Buffer.alloc(width*height*3),bg=[10,20,34],grid=[37,51,67],ink=[185,202,219];for(let p=0;p<data.length;p+=3){data[p]=bg[0];data[p+1]=bg[1];data[p+2]=bg[2]}
 const pixel=(x,y,color)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=width||y>=height)return;const p=(y*width+x)*3;data[p]=color[0];data[p+1]=color[1];data[p+2]=color[2]};
 const rect=(x,y,w,h,c)=>{for(let yy=Math.floor(y);yy<Math.ceil(y+h);yy++)for(let xx=Math.floor(x);xx<Math.ceil(x+w);xx++)pixel(xx,yy,c)};
 const text=(s,x,y)=>{for(const ch of s){const glyph=glyphs[ch]||glyphs[' '];for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(glyph[row*3+col]==='1')rect(x+col*2,y+row*2,2,2,ink);x+=8}};
 const left=16,right=width-112,top=label?88:24,bottom=Math.floor(height*.72),volTop=bottom+24,volBottom=height-35,span=right-left;
 if(label){
  const {symbol,interval,delayMinutes,synthetic=false}=label;
  if(!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(symbol||'')||!['1day','1min'].includes(interval)||!Number.isInteger(delayMinutes)||delayMinutes<0||delayMinutes>15||width<640||height<400)throw Error('Invalid raster attribution');
  text((synthetic?'SYNTHETIC DEMO':'TWELVE DATA')+' - '+symbol+' - '+interval.toUpperCase(),left,12);
  text('OWNER TRIAL - DECLARED DELAY '+delayMinutes+' MIN',left,30);
  text('VOLUME UNCONFIRMED - HISTORY '+bars.length+' BARS',left,48);
  text(interval==='1day'?'PRIOR DAILY SESSIONS - NOT LIVE':'UTC - LAST CANDLE MAY BE INCOMPLETE',left,66);
 }
 const low=Math.min(...bars.map(b=>b.low)),high=Math.max(...bars.map(b=>b.high)),padding=Math.max((high-low)*.06,high*.001),min=low-padding,max=high+padding;
 const y=price=>top+(max-price)/(max-min)*(bottom-top),step=span/bars.length;
 const maxVolume=Math.max(0,...bars.map(b=>b.volume??0));
 for(let i=0;i<=4;i++){const price=min+(max-min)*i/4,py=y(price);rect(left,py,span,1,grid);text(price.toFixed(price<1000?2:0),right+10,py-5)}
 bars.forEach((b,i)=>{const x=left+(i+.5)*step,color=b.close>=b.open?[55,208,164]:[242,102,112];rect(x,y(b.high),1,Math.max(1,y(b.low)-y(b.high)),color);rect(x-Math.max(1,step*.65)/2,Math.min(y(b.open),y(b.close)),Math.max(1,step*.65),Math.max(1,Math.abs(y(b.close)-y(b.open))),color);if(b.volume!=null&&maxVolume>0){const h=b.volume/maxVolume*(volBottom-volTop);rect(x-Math.max(1,step*.65)/2,volBottom-h,Math.max(1,step*.65),h,color)}});
 text(bars[0].date.slice(0,10),left,height-20);text(bars.at(-1).date.slice(0,10),right-80,height-20);
 const rows=Buffer.alloc(height*(1+width*3));for(let row=0;row<height;row++)data.copy(rows,row*(1+width*3)+1,row*width*3,(row+1)*width*3);
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
