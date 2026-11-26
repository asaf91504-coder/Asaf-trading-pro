export function newsRefreshInterval(snapshot){
 const unfinished=snapshot?.enabled&&['pending','partial','unavailable'].includes(snapshot.translation)&&snapshot.translationReason!=='not_configured';
 return unfinished?45000:15*60*1000;
}
