export function chartWindow(total, count, offset=0) {
 const size=Math.min(total,Math.max(1,Math.round(count)||60));
 const end=total-Math.max(0,Math.min(Math.round(offset)||0,total-size));
 return {start:Math.max(0,end-size),end,count:size};
}
export function zoomWindow(total,count,offset,factor,anchor=.5){
 const old=chartWindow(total,count,offset);
 const next=Math.min(total,Math.max(Math.min(12,total),Math.round(old.count*factor)));
 const end=old.end+Math.round((next-old.count)*(1-Math.max(0,Math.min(1,anchor))));
 return {count:next,offset:Math.max(0,Math.min(total-next,total-end))};
}
