import {languageCode} from './interface-language.mjs';
// This is an email link, not a live support chat. Keep one launcher per page.
if(!document.querySelector('.asaf-support-launcher')&&!document.getElementById('asaf-support-dialog')){
 const link=document.createElement('link');link.rel='stylesheet';link.href='/support-widget.css';document.head.append(link);
 const labels={he:'שירות לקוחות',en:'Customer support',ar:'خدمة العملاء',es:'Atención al cliente',fr:'Service client',de:'Kundenservice',pt:'Atendimento',ru:'Поддержка',zh:'客户支持',ja:'サポート'};
 const launcher=document.createElement('a');launcher.className='asaf-support-launcher';launcher.setAttribute('translate','no');launcher.href='mailto:asaf91504@gmail.com?subject=ASAF%20Trading%20Pro%20Support';
 const render=()=>{launcher.textContent=labels[languageCode(document.documentElement.lang)];};
 render();document.body.append(launcher);window.addEventListener('asaf:language',render);
}
