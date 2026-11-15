const copies={
he:['שירות לקוחות','כותבים לאסף · התשובה תגיע למייל שלך','איך אפשר לעזור? כתבו כאן ונחזור אליכם במייל. זה אינו צ׳אט בזמן אמת.','שם','מייל לקבלת תשובה','במה אפשר לעזור?','השם, המייל וההודעה יועברו לאסף דרך Netlify לצורך טיפול בפנייה. אין לשלוח סיסמאות או פרטי תשלום.','שלח לאסף','פרטיות','אפשר גם לפנות במייל','שולח…','הפנייה התקבלה. התשובה תגיע למייל שמסרת.','לא הצלחנו לאשר שהפנייה התקבלה. הטקסט נשאר כאן; אפשר לנסות שוב או לפנות במייל.'],
en:['Customer support','Message Asaf · Replies arrive by email','How can we help? Send a message and we will reply by email. This is not live chat.','Name','Reply email','How can we help?','Your name, email and message are sent to Asaf through Netlify for support. Do not send passwords or payment details.','Send to Asaf','Privacy','Contact by email','Sending…','Your request was received. We will reply to the email you provided.','We could not confirm receipt. Your message is still here; retry or contact us by email.']};
// Keep essential controls usable in every supported interface language.
const labels={es:['Atención al cliente','Nombre','Correo para la respuesta','¿Cómo podemos ayudarte?','Enviar a Asaf'],fr:['Service client','Nom','Adresse e-mail de réponse','Comment pouvons-nous vous aider ?','Envoyer à Asaf'],de:['Kundenservice','Name','E-Mail für die Antwort','Wie können wir helfen?','An Asaf senden'],pt:['Atendimento ao cliente','Nome','E-mail para resposta','Como podemos ajudar?','Enviar para Asaf'],ru:['Поддержка','Имя','Эл. почта для ответа','Чем мы можем помочь?','Отправить Асафу'],ar:['خدمة العملاء','الاسم','البريد الإلكتروني للرد','كيف يمكننا مساعدتك؟','إرسال إلى آساف'],zh:['客户支持','姓名','回复邮箱','需要什么帮助？','发送给 Asaf'],ja:['カスタマーサポート','名前','返信先メール','どのようなご用件ですか？','Asaf に送信']};
let lang='he';try{lang=localStorage.getItem('asaf_interface_language_v1')||'he'}catch{}
const text=[...(copies[lang]||copies.en)];if(labels[lang])for(const [i,n] of [0,3,4,5,7].entries())text[n]=labels[lang][i];
document.documentElement.lang=lang;document.documentElement.dir=['he','ar'].includes(lang)?'rtl':'ltr';
const keys=['title','intro','greeting','name','email','message','privacy','send','privacyLink','alternative'];
for(const el of document.querySelectorAll('[data-copy]'))el.textContent=text[keys.indexOf(el.dataset.copy)];
const form=document.forms['customer-support'],status=document.getElementById('support-status'),button=form.querySelector('button');
form.elements.language.value=lang;form.elements['request-id'].value=crypto.randomUUID();
form.addEventListener('submit',async event=>{
 event.preventDefault();if(button.disabled||!form.reportValidity())return;
 if(!form.elements.message.value.trim()||!form.elements.name.value.trim()){form.elements.message.focus();return}
 button.disabled=true;status.textContent=text[10];
 try{
  const response=await fetch('/support-received.html',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form)).toString(),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Submission failed');
  status.textContent=text[11];form.elements.message.value='';form.elements['request-id'].value=crypto.randomUUID();
 }catch{status.textContent=text[12]}
 finally{button.disabled=false}
});
