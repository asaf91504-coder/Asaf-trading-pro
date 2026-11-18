// Reorganize existing controls without duplicating forms, chat or account state.
const header=document.querySelector('body.terminal-app > header');
if(header){
 const menu=document.createElement('details');menu.className='display-settings';
 const summary=document.createElement('summary');summary.textContent='הגדרות ועזרה';
 const content=document.createElement('div');content.className='display-settings-content';menu.append(summary,content);
 for(const selector of ['.terminal-data-button','.terminal-layouts','#appInstallButton','.terminal-accessibility-button','a[href="/setups.html"]','.subscription-link']){
  const control=header.querySelector(selector);if(control)content.append(control);
 }
 header.append(menu);
 // Close dismissible settings without trapping the page behind an overlay.
 const closeMenu=(restoreFocus=false)=>{if(!menu.open)return;menu.open=false;if(restoreFocus)summary.focus()};
 document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))closeMenu()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){event.preventDefault();closeMenu(true)}});
 window.addEventListener('asaf:language',()=>closeMenu());
 window.addEventListener('asaf:tab',()=>closeMenu());
 content.addEventListener('click',event=>{if(event.target.closest('a,button'))closeMenu()});

 const chat=document.getElementById('chat'),history=chat?.querySelector('.chat-history');
 if(history){const drawer=document.createElement('details');drawer.className='conversation-history-drawer';const title=document.createElement('summary');title.textContent='השיחות השמורות שלי';history.before(drawer);drawer.append(title,history)}
 // On mobile use ordinary page flow: neither navigation nor composer covers messages.
 const input=document.getElementById('chatInput');
 input?.addEventListener('focus',()=>document.body.classList.add('composer-focused'));
 input?.addEventListener('blur',()=>document.body.classList.remove('composer-focused'));
 const returnButtons=chat?.querySelectorAll('.terminal-conversation-nav button');
 if(returnButtons?.length>2)returnButtons[1].textContent='הצג גרף';
}
