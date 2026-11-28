// Billing denials are distinct from provider/network failures. Never trust a
// server-supplied navigation URL or start a payment from an error handler.
export function subscriptionAccessError(response,data){
 if(response?.status!==402||!['subscription_required','paid_subscription_required'].includes(data?.code))return null;
 return Object.assign(Error(data.error||'תקופת הניסיון הסתיימה. בחר מסלול להמשך השימוש.'),{code:data.code,status:402,subscriptionRequired:true});
}
