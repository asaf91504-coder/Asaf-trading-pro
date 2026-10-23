// One shared x axis, independent vertical scales, enough space on narrow screens.
export function chartLayout(width,panels=[],priceHeight=270){
 const left=8,right=width<450?57:73,top=28,bottom=top+Math.max(180,priceHeight),volTop=bottom+20,volBottom=volTop+53;
 let cursor=volBottom+30;const panes={};
 for(const name of panels){panes[name]={top:cursor,bottom:cursor+70};cursor+=105}
 return {left,right,top,bottom,volTop,volBottom,panes,height:cursor+6,plotWidth:Math.max(1,width-left-right)};
}
