import {useEffect,useState,type FormEvent} from 'react';
import {ADMIN_PATH} from '../../packages/presentation/admin-path.mjs';
import {Field,PasswordInput} from '../../packages/presentation/form-fields';
import {Icon} from '../../packages/presentation/ui';
import {emailError} from '../../packages/presentation/contact-fields.mjs';
import {registrationPasswordError} from '../../packages/presentation/auth-password';

export type RecoveryStep=''|'request'|'sent'|'email'|'reset'|'done';
const steps:RecoveryStep[]=['request','sent','email','reset','done'];
export const localRecovery=()=>['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const readStep=():RecoveryStep=>{const value=new URLSearchParams(location.search).get('recovery') as RecoveryStep;return localRecovery()&&steps.includes(value)?value:'';};
/** Staff-only routes and storage. Preview does not request or change credentials on the API. */
export function useStaffRecovery(){
 const [step,setStep]=useState<RecoveryStep>(readStep);
 useEffect(()=>{const update=()=>setStep(readStep());window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
 const go=(next:RecoveryStep)=>{history.pushState(null,'',ADMIN_PATH+(next?'?recovery='+next:''));setStep(next);window.scrollTo({top:0,behavior:'instant'});};
 return {step,go};
}
const emailKey='nsp-staff-recovery-preview-email';
const deadlineKey=(email:string)=>'nsp-staff-recovery-preview-until:'+email.trim().toLowerCase();
function begin(email:string){const key=deadlineKey(email),until=Number(sessionStorage.getItem(key));if(!until||until<=Date.now())sessionStorage.setItem(key,String(Date.now()+60000));}

export function StaffRecovery({step,go,initialEmail}:{step:Exclude<RecoveryStep,''>;go:(step:RecoveryStep)=>void;initialEmail:string}){
 const [email,setEmail]=useState(()=>sessionStorage.getItem(emailKey)||initialEmail);
 const [touched,setTouched]=useState(false),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
 const [confirmationTouched,setConfirmationTouched]=useState(false),[now,setNow]=useState(Date.now);
 const passwordError=registrationPasswordError(password,confirmation);
 useEffect(()=>{if(step!=='sent')return;const key=deadlineKey(email);if(!sessionStorage.getItem(key))begin(email);setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[step,email]);
 useEffect(()=>{setPassword('');setConfirmation('');setConfirmationTouched(false);},[step]);
 const seconds=Math.max(0,Math.ceil((Number(sessionStorage.getItem(deadlineKey(email)))-now)/1000));
 const request=(event:FormEvent)=>{event.preventDefault();setTouched(true);if(emailError(email))return;sessionStorage.setItem(emailKey,email);begin(email);go('sent');};
 const save=(event:FormEvent)=>{event.preventDefault();setConfirmationTouched(true);if(passwordError)return;setPassword('');setConfirmation('');go('done');};
 const back=<button type="button" className="auth-link recovery-back" onClick={()=>go('')}><Icon name="chevron-left" size={18}/>Вернуться ко входу</button>;
 return <section className="auth admin-auth" data-auth-mode="recovery" data-ds-id={'staff-recovery-'+step}>
  {step==='request'&&<><h1>Восстановление пароля</h1><p className="auth-switch">Введите email учётной записи сотрудника.</p><form className="auth-form" onSubmit={request}>
   <Field label="Email">{id=><><input id={id} className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={120} placeholder="Введите email" value={email} onChange={e=>setEmail(e.target.value.replace(/\s/g,''))} onBlur={()=>setTouched(true)} aria-invalid={touched&&Boolean(emailError(email))} aria-describedby={touched&&emailError(email)?id+'-error':undefined} required/>{touched&&emailError(email)&&<p id={id+'-error'} className="auth-hint auth-password-error" role="status">{emailError(email)}</p>}</>}</Field>
   <button className="btn btn--primary auth-submit" disabled={Boolean(emailError(email))}>Отправить ссылку</button></form>{back}</>}
  {step==='sent'&&<><div className="recovery-symbol"><Icon name="message" size={28}/></div><h1>Проверьте почту</h1><p className="auth-switch">Если учётная запись сотрудника с такой почтой существует, мы отправим ссылку для смены пароля.</p><p className="recovery-email">{email}</p><p className="auth-hint recovery-help">Письмо может прийти не сразу. Если его нет, проверьте папку «Спам».</p><div className="recovery-actions"><button className="auth-link" type="button" disabled={seconds>0} onClick={()=>{begin(email);setNow(Date.now());}}>{seconds>0?`Отправить повторно через ${seconds} с`:'Отправить ссылку ещё раз'}</button><button className="auth-link" type="button" onClick={()=>go('request')}>Изменить email</button>{back}</div></>}
  {step==='email'&&<><p className="auth-hint email-meta">От: NSP Center<br/>Тема: Восстановление доступа сотрудника</p><h1>Создайте новый пароль</h1><p className="auth-switch">Вы запросили восстановление доступа к админке NSP Center.</p><button className="btn btn--primary auth-submit recovery-email-button" onClick={()=>go('reset')}>Создать новый пароль</button><p className="auth-hint recovery-help">Ссылка действует 30 минут и может быть использована один раз.</p><div className="email-divider"/><p className="auth-hint recovery-help">Если вы не запрашивали смену пароля, проигнорируйте это письмо. Ваш пароль останется прежним.</p></>}
  {step==='reset'&&<><h1>Новый пароль</h1><p className="auth-switch">Используйте пароль, который вы не вводите на других сайтах.</p><form className="auth-form" onSubmit={save}><Field label="Новый пароль" hint="Не меньше 8 символов.">{id=><PasswordInput id={id} autoComplete="new-password" value={password} onChange={setPassword}/>}</Field><Field label="Повторите пароль">{id=><PasswordInput id={id} autoComplete="new-password" value={confirmation} onChange={v=>{setConfirmation(v);setConfirmationTouched(true);}} onBlur={()=>setConfirmationTouched(true)} error={confirmationTouched?passwordError:undefined}/>}</Field><button className="btn btn--primary auth-submit" disabled={Boolean(passwordError)}>Сохранить пароль</button></form></>}
  {step==='done'&&<><div className="recovery-symbol"><Icon name="check" size={28}/></div><h1>Пароль изменён</h1><p className="auth-switch">Войдите в админку с новым паролем.</p><button className="btn btn--primary auth-submit recovery-email-button" onClick={()=>go('')}>Войти</button></>}
 </section>;
}
