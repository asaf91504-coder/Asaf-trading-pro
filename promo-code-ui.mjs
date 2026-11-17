// No promotion is active until its pricing and redemption rules are configured.
const host=document.getElementById('billingPromo');
if(host){
 const copy={he:['יש לך קוד הטבה?','קוד הטבה','בדיקת קוד','אין כרגע קודי הטבה פעילים. המחיר לא השתנה. להסרת הקוד ולהמשך במחיר הרגיל, נקה את השדה.'],en:['Have a promo code?','Promo code','Check code','No promo codes are active yet. The price has not changed. Clear the field to continue at the regular price.'],es:['¿Tienes un código promocional?','Código promocional','Comprobar código','No hay códigos activos. El precio no cambió. Borra el código para continuar al precio habitual.'],ar:['هل لديك رمز ترويجي؟','الرمز الترويجي','تحقق من الرمز','لا توجد رموز فعالة حالياً. لم يتغير السعر. امسح الرمز للمتابعة بالسعر العادي.'],fr:['Un code promotionnel ?','Code promotionnel','Vérifier le code','Aucun code actif. Le prix reste inchangé. Effacez le code pour continuer au tarif normal.'],de:['Hast du einen Gutscheincode?','Gutscheincode','Code prüfen','Keine aktiven Codes. Der Preis ist unverändert. Entferne den Code, um zum regulären Preis fortzufahren.'],pt:['Tem um código promocional?','Código promocional','Verificar código','Não há códigos ativos. O preço não mudou. Apague o código para continuar pelo preço normal.'],ru:['Есть промокод?','Промокод','Проверить код','Активных кодов пока нет. Цена не изменилась. Удалите код, чтобы продолжить по обычной цене.'],zh:['有优惠码？','优惠码','检查优惠码','目前没有有效优惠码，价格未改变。清空优惠码后可按原价继续。'],ja:['プロモーションコードをお持ちですか？','プロモーションコード','コードを確認','現在有効なコードはありません。価格は変わりません。通常価格で続行するにはコードを削除してください。']};
 const input=document.getElementById('billingPromoCode'),status=document.getElementById('billingPromoStatus');
 const words=()=>copy[(document.documentElement.lang||'he').split('-')[0]]||copy.en;
 const render=()=>{const c=words();document.getElementById('billingPromoTitle').textContent=c[0];document.getElementById('billingPromoLabel').textContent=c[1];document.getElementById('billingPromoCheck').textContent=c[2];};
 let sequence=0;
 const clear=()=>{sequence++;window.asafBillingPromotion=null;status.textContent='';document.getElementById('billingConsent').checked=false;window.dispatchEvent(new Event('asaf:promotion'));};
 input.addEventListener('input',clear);document.getElementById('billingPlan').addEventListener('change',clear);
 document.getElementById('billingPromoCheck').onclick=async()=>{
  clear();const current=sequence,code=input.value.trim(),planId=document.getElementById('billingPlan').value;
  if(!code)return;
  const hebrew=document.documentElement.lang.startsWith('he');status.textContent=hebrew?'בודק קוד…':'Checking code…';
  try{
   const response=await fetch('/.netlify/functions/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'promo-quote',promoCode:code,planId}),signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(current!==sequence)return;
   if(!response.ok)throw Error('Unavailable');
   window.asafBillingPromotion=data.promotion;
   status.textContent=hebrew?`הקוד תקף: $${data.promotion.monthlyPrice} בכל חודש, עד ביטול המנוי. האישור הסופי ב־PayPal.`:`Code applied: $${data.promotion.monthlyPrice} every month until cancellation. Final approval is in PayPal.`;
   window.dispatchEvent(new Event('asaf:promotion'));
  }catch{if(current===sequence)status.textContent=hebrew?'לא ניתן להחיל את הקוד. התחבר לחשבון ובדוק שהקוד תקף למסלול שבחרת.':'Unable to apply code. Sign in and check that the code is valid for this plan.';}
 };
 document.getElementById('billingSubscribe').addEventListener('click',event=>{if(input.value.trim()&&!window.asafBillingPromotion){event.preventDefault();event.stopImmediatePropagation();host.open=true;status.textContent=document.documentElement.lang.startsWith('he')?'בדוק את הקוד או הסר אותו לפני התשלום.':'Check or remove the code before checkout.';input.focus();}},{capture:true});
 window.addEventListener('asaf:language',()=>{clear();render();});render();
}
