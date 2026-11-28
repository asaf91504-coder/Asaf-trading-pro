import {authState} from './auth-ui.mjs';
import {ownerCreditCopy} from './owner-credit-copy.mjs';
const host=document.getElementById('adminActions');
if(host){
 const section=document.createElement('section');section.className='panel';section.hidden=true;host.append(section);
 const heading=document.createElement('h3'),ownerNote=document.createElement('p'),note=document.createElement('p'),form=document.createElement('form'),emailLabel=document.createElement('label'),emailText=document.createElement('span'),email=document.createElement('input'),amountLabel=document.createElement('label'),amountText=document.createElement('span'),amount=document.createElement('input'),grant=document.createElement('button'),inspect=document.createElement('button'),status=document.createElement('p');
 section.id='ownerCreditManagement';email.id='creditAdminEmail';email.type='email';email.required=true;email.maxLength=250;email.dir='ltr';amount.id='creditAdminAmount';amount.type='number';amount.min='1';amount.max='100000';amount.step='1';amount.value='50';amount.required=true;grant.type='submit';inspect.type='button';status.setAttribute('role','status');form.className='row';form.append(emailLabel,amountLabel,grant,inspect);emailLabel.append(emailText,email);amountLabel.append(amountText,amount);section.append(ownerNote,heading,note,form,status);
 let revision=0,busy=false,pending=null,last=null,ownerMember=null,identity=null;
 const copy=(key,count)=>ownerCreditCopy(document.documentElement.lang,key,count);
 function render(){ownerNote.textContent=copy('unlimited');heading.textContent=copy('title');note.textContent=copy('note');emailText.textContent=copy('email');amountText.textContent=copy('amount');grant.textContent=copy('grant');inspect.textContent=copy('check');if(last)status.textContent=(last.duplicate?copy('duplicate'):last.granted?copy('added',last.granted):'')+' '+copy('balance',last.bonusRemaining)+(last.access?'':' '+copy('inactive'));}
 async function refresh(){const current=++revision,member=authState.authenticated?authState.memberId:null;if(identity!==member){identity=member;pending=null;last=null;email.value='';}section.hidden=true;ownerMember=null;status.textContent='';if(!authState.authenticated||!member)return;try{const r=await fetch('/.netlify/functions/account',{cache:'no-store',credentials:'same-origin'});const info=await r.json();if(current!==revision||member!==authState.memberId)return;if(r.ok&&info.owner===true&&info.memberId===member){ownerMember=member;section.hidden=false;render();}}catch{}}
 async function perform(action){
  if(busy||ownerMember!==authState.memberId||!authState.authenticated)return;
  if(!email.checkValidity()||!amount.checkValidity()){form.reportValidity();return;}
  const selection={email:email.value.trim().toLowerCase(),credits:Number(amount.value)};
  if(!pending||pending.email!==selection.email||pending.credits!==selection.credits)pending={...selection,requestId:crypto.randomUUID()};
  const current=revision,member=ownerMember;busy=true;for(const node of form.elements)node.disabled=true;status.textContent=copy('busy');
  try{const r=await fetch('/.netlify/functions/credit-admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...pending}),signal:AbortSignal.timeout(15000)}),data=await r.json();if(current!==revision||member!==authState.memberId)return;if(!r.ok)throw Error(data.error||copy('error'));last=data;render();if(action==='grant')pending=null;}
  catch(e){if(current===revision)status.textContent=e.message||copy('error');}
  finally{busy=false;for(const node of form.elements)node.disabled=false;}
 }
 form.onsubmit=e=>{e.preventDefault();perform('grant')};inspect.onclick=()=>perform('inspect');window.addEventListener('asaf:auth',refresh);window.addEventListener('asaf:language',render);render();refresh();
}
