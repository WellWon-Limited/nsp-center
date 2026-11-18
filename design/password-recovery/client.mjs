// Local interaction preview only. No API requests, email delivery or password storage.
import {customerEmailError} from './contact-fields.mjs';
import {registrationPasswordError} from './password-rules.mjs';

const header=document.querySelector('.site-header');
let headerFrame=0;
const measureHeader=()=>{const value=header.getBoundingClientRect().height+'px';if(document.documentElement.style.getPropertyValue('--site-header-height')!==value)document.documentElement.style.setProperty('--site-header-height',value);};
measureHeader();new ResizeObserver(()=>{cancelAnimationFrame(headerFrame);headerFrame=requestAnimationFrame(measureHeader);}).observe(header);
const savedEmail=sessionStorage.getItem('nsp-recovery-preview-email');
const emailLabel=document.querySelector('.recovery-email');
if(savedEmail&&emailLabel)emailLabel.textContent=savedEmail;
const email=document.getElementById('email');
const password=document.getElementById('password');
const confirmation=document.getElementById('confirmation');
const form=document.querySelector('.auth-form');
const submit=form?.querySelector('.auth-submit');
let emailTouched=false,confirmationTouched=false,submitting=false;
if(email&&savedEmail)email.value=savedEmail;

function showError(field,id,message){
 const hint=document.getElementById(id);
 if(!field||!hint)return;
 hint.textContent=message;hint.hidden=!message;
 field.setAttribute('aria-invalid',String(Boolean(message)));
 if(message)field.setAttribute('aria-describedby',id);
 else field.removeAttribute('aria-describedby');
}
function formError(){
 return email?customerEmailError(email.value):password?registrationPasswordError(password.value,confirmation.value):'';
}
function updateForm(){
 if(!submit)return;
 submit.disabled=submitting||Boolean(formError());
 if(email)showError(email,'email-error',emailTouched?customerEmailError(email.value):'');
 if(confirmation)showError(confirmation,'password-error',confirmationTouched?registrationPasswordError(password.value,confirmation.value):'');
}
email?.addEventListener('input',()=>{email.value=email.value.replace(/\s/g,'');updateForm();});
email?.addEventListener('blur',()=>{emailTouched=true;updateForm();});
password?.addEventListener('input',updateForm);
confirmation?.addEventListener('input',()=>{confirmationTouched=true;updateForm();});
confirmation?.addEventListener('blur',()=>{confirmationTouched=true;updateForm();});
form?.addEventListener('change',updateForm);
window.addEventListener('pageshow',()=>{submitting=false;updateForm();});
updateForm();

document.querySelectorAll('[data-toggle]').forEach(button=>button.addEventListener('click',()=>{
 const field=document.getElementById(button.dataset.toggle),shown=field.type==='password';
 field.type=shown?'text':'password';button.setAttribute('aria-pressed',String(shown));button.setAttribute('aria-label',shown?'Скрыть пароль':'Показать пароль');
 button.querySelector('[data-eye-open]').toggleAttribute('hidden',shown);
 button.querySelector('[data-eye-closed]').toggleAttribute('hidden',!shown);
}));
const cooldownKey=email=>'nsp-recovery-preview-resend-at:'+email.trim().toLowerCase();
function startCooldown(email){const key=cooldownKey(email),until=Number(sessionStorage.getItem(key));if(!Number.isFinite(until)||until<=Date.now())sessionStorage.setItem(key,String(Date.now()+60000));}
form?.addEventListener('submit',event=>{
 event.preventDefault();emailTouched=confirmationTouched=true;updateForm();
 if(submitting||formError())return;
 if(email){sessionStorage.setItem('nsp-recovery-preview-email',email.value);startCooldown(email.value);}
 submitting=true;updateForm();
 // Passwords only exist in these inputs; do not retain them in storage or the URL.
 if(password){password.value='';confirmation.value='';}
 location.assign('/__preview/password-recovery/step-'+form.dataset.next+'/index.html');
});
const resend=document.getElementById('resend');
if(resend){
 const recipient=savedEmail||'anna@mail.ru',key=cooldownKey(recipient);
 if(sessionStorage.getItem(key)===null)startCooldown(recipient);
 const render=()=>{const seconds=Math.max(0,Math.ceil((Number(sessionStorage.getItem(key))-Date.now())/1000));resend.disabled=seconds>0;resend.textContent=seconds>0?'Отправить повторно через '+seconds+' с':'Отправить ссылку ещё раз';};
 render();setInterval(render,250);
 resend.addEventListener('click',()=>{if(Number(sessionStorage.getItem(key))>Date.now())return;startCooldown(recipient);render();});
 window.addEventListener('pageshow',render);document.addEventListener('visibilitychange',render);
}
