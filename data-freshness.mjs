// Receipt age is not provider quote age. Never describe a recent receipt as live.
export function dataFreshness(data,now=Date.now()){
 const timestamp=typeof data?.receivedAt==='string'?Date.parse(data.receivedAt):NaN;
 const age=now-timestamp;
 if(!Number.isFinite(age)||age<0)return 'זמן קבלת הנתונים אינו ידוע';
 const minutes=Math.floor(age/60000);
 return (minutes<1?'הנתונים התקבלו לפני פחות מדקה':'הנתונים התקבלו לפני '+minutes+' דקות')+(age>=60000?' · עותק שמור — רענן לקבלת נתונים חדשים':'')+' · אינו אישור למחיר חי';
}
export function quoteSummary(data){
 const quote=data?.quote;
 if(data?.source!=='CoinLore'||!Number.isFinite(quote?.price)||quote.price<=0)return '';
 return 'ציטוט נפרד: $'+quote.price.toLocaleString('en-US',{maximumFractionDigits:4})+' · אינו סגירת הנר · זמן העסקה אינו ידוע';
}
