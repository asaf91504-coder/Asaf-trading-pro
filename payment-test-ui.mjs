const section=document.getElementById('paymentTest'),pay=document.getElementById('paymentTestPay'),check=document.getElementById('paymentTestCheck'),message=document.getElementById('paymentTestMessage');
let busy=false;
async function call(action){
 const r=await fetch('/.netlify/functions/payment-test',{method:action?'POST':'GET',cache:'no-store',headers:{'Content-Type':'application/json'},...(action?{body:JSON.stringify({action,consent:'USD1_ONCE_TEST'})}:{}),signal:AbortSignal.timeout(45000)});
 const data=await r.json();if(!r.ok)throw Error(data.error);return data;
}
async function perform(action){
 if(busy)return;
 if(action==='create'&&!confirm('לאשר מעבר ל־PayPal לתשלום חד־פעמי של $1 USD לבדיקה? ללא מנוי וללא חידוש.'))return;
 busy=true;pay.disabled=check.disabled=true;message.textContent='בודק…';
 try{const data=await call(action);if(data.approvalUrl){const u=new URL(data.approvalUrl);if(u.protocol!=='https:'||!['www.paypal.com','www.sandbox.paypal.com'].includes(u.hostname))throw Error('Invalid destination');location.assign(u.href);return;}
 message.textContent=data.completed?'תשלום הבדיקה בסך $1 הושלם. לא נוצר מנוי ולא נוסף חיוב מתחדש.':'טרם התקבל אישור תשלום. אפשר לבדוק שוב.';
 pay.hidden=data.completed===true;
 }catch(e){message.textContent=e.message;}finally{busy=false;pay.disabled=check.disabled=false;}
}
pay.onclick=()=>perform('create');check.onclick=()=>perform('capture');
try{const data=await call();section.hidden=false;if(data.sandbox)message.textContent='סביבת Sandbox — ללא חיוב אמיתי.';if(data.record?.status==='COMPLETED'){pay.hidden=true;message.textContent='תשלום הבדיקה כבר הושלם.';}
 if(new URLSearchParams(location.search).get('testPayment')==='return')await perform('capture');
}catch{}
