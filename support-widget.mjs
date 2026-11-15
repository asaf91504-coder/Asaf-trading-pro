if(!document.getElementById('asaf-support-dialog')){
 const link=document.createElement('link');link.rel='stylesheet';link.href='/support-widget.css';document.head.append(link);
 const lang=document.documentElement.lang||'he';
 const label=({he:'שירות לקוחות',en:'Customer support',ar:'خدمة العملاء',es:'Atención al cliente',fr:'Service client',de:'Kundenservice',pt:'Atendimento',ru:'Поддержка',zh:'客户支持',ja:'サポート'})[lang]||'Customer support';
 const launcher=document.createElement('button');launcher.className='asaf-support-launcher';launcher.textContent=label;launcher.setAttribute('aria-haspopup','dialog');
 const dialog=document.createElement('dialog');dialog.id='asaf-support-dialog';dialog.setAttribute('aria-label',label);
 const close=document.createElement('button');close.className='asaf-support-close';close.textContent='×';close.setAttribute('aria-label',lang==='he'?'סגירה':'Close');
 const frame=document.createElement('iframe');frame.title=label;
 dialog.append(close,frame);document.body.append(launcher,dialog);
 launcher.onclick=()=>{if(!frame.getAttribute('src'))frame.src='/support.html';dialog.showModal();close.focus()};
 close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>launcher.focus());
}
