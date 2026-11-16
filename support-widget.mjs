if(!document.getElementById('asaf-support-dialog')){
 const link=document.createElement('link');link.rel='stylesheet';link.href='/support-widget.css';document.head.append(link);
 const lang=document.documentElement.lang||'he';
 const label=({he:'שירות לקוחות',en:'Customer support',ar:'خدمة العملاء',es:'Atención al cliente',fr:'Service client',de:'Kundenservice',pt:'Atendimento',ru:'Поддержка',zh:'客户支持',ja:'サポート'})[lang]||'Customer support';
 const launcher=document.createElement('a');launcher.className='asaf-support-launcher';launcher.textContent=label;launcher.href='mailto:asaf91504@gmail.com?subject=ASAF%20Trading%20Pro%20Support';document.body.append(launcher);
}
