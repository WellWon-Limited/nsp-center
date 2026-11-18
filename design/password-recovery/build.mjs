/** Review-only screens. Run after npm run build:web: node design/password-recovery/build.mjs.
 * Writes to ignored dist, never public or application routes; makes no API calls.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
import ts from 'typescript';
const $=load(await readFile('dist/profile/index.html','utf8'));
// Reuse the website appearance bootstrap, so preview backgrounds follow site changes.
const appearance=$('script').toArray().map(el=>$(el).html()).find(text=>text?.includes('de.homeDesign='));
if(!appearance) throw new Error('Website appearance bootstrap missing');
const stylesheet=$('link[rel=stylesheet]').attr('href');
const header=$('.site-header').first().prop('outerHTML');
const navigation=$('.bottom-nav').first().prop('outerHTML')||'';
const backdrop=$('.ambient').first().prop('outerHTML');
const href=n=>`/__preview/password-recovery/step-${n}/index.html`;
const arrow='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>';
const mail='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>';
const check='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const back='<a class="auth-link recovery-back" href="/profile/">'+arrow+'Вернуться ко входу</a>';
const password=(id,label)=>`<div class="auth-field"><label for="${id}">${label}</label><div class="auth-password"><input class="field" id="${id}" type="password" autocomplete="new-password" placeholder="Введите пароль" minlength="8" maxlength="200" required/><button class="auth-eye" type="button" data-toggle="${id}" aria-label="Показать пароль" aria-pressed="false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><g data-eye-open><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></g><g data-eye-closed hidden><path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/></g></svg></button></div>${id==='password'?'<p class="auth-hint">Не меньше 8 символов.</p>':'<p id="password-error" class="auth-hint auth-password-error" role="status" hidden></p>'}</div>`;
const screens=[
 {title:'1 · Введите email',body:`<h1>Восстановление пароля</h1><p class="auth-switch recovery-intro">Введите email, указанный при регистрации.</p><form class="auth-form" data-next="2"><div class="auth-field"><label for="email">Email</label><input class="field" id="email" type="text" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="120" placeholder="name@mail.ru" required/><p id="email-error" class="auth-hint auth-password-error" role="status" hidden></p></div><button class="btn btn--primary auth-submit" disabled>Отправить ссылку</button></form>${back}`},
 {title:'2 · Проверьте почту',body:`<div class="recovery-symbol">${mail}</div><h1>Проверьте почту</h1><p class="auth-switch recovery-intro">Если аккаунт с такой почтой существует, мы отправим ссылку для смены пароля.</p><p class="recovery-email">anna@mail.ru</p><p class="auth-hint recovery-help">Письмо может прийти не сразу. Если его нет, проверьте папку «Спам».</p><div class="recovery-actions"><button class="auth-link" type="button" id="resend" disabled>Отправить повторно через <span id="seconds">60</span> с</button><a class="auth-link" href="${href(1)}">Изменить email</a>${back}</div>`},
 {title:'3 · Письмо со ссылкой',email:true,body:`<div class="email-envelope"><p class="auth-hint email-meta">От: NSP Center<br/><span>Тема: Восстановление пароля</span></p><article class="auth email-letter" data-auth-mode="recovery"><a class="email-brand" href="/"> <img src="/icons/icon.svg" alt="" width="36" height="36"/> NSP Center</a><h1>Создайте новый пароль</h1><p class="auth-switch recovery-intro">Вы запросили восстановление доступа к аккаунту NSP Center. Нажмите кнопку, чтобы создать новый пароль.</p><a class="btn btn--primary auth-submit recovery-email-button" href="${href(4)}">Создать новый пароль</a><p class="auth-hint recovery-help">Ссылка действует 30 минут и может быть использована один раз.</p><div class="email-divider"></div><p class="auth-hint recovery-help">Если вы не запрашивали смену пароля, просто проигнорируйте это письмо. Ваш пароль останется прежним.</p></article></div>`},
 {title:'4 · Новый пароль',body:`<h1>Новый пароль</h1><p class="auth-switch recovery-intro">Используйте пароль, который вы не вводите на других сайтах.</p><form class="auth-form" data-next="5">${password('password','Новый пароль')}${password('confirmation','Повторите пароль')}<button class="btn btn--primary auth-submit" disabled>Сохранить пароль</button></form>`},
 {title:'5 · Пароль изменён',body:`<div class="recovery-symbol">${check}</div><h1>Пароль изменён</h1><p class="auth-switch recovery-intro">Войдите с новым паролем.</p><a class="btn btn--primary auth-submit recovery-email-button" href="/profile/">Войти</a>`}
];
// Browser previews import the same validators used by customer registration.
const base='dist/__preview/password-recovery';
await mkdir(base,{recursive:true});
await writeFile(base+'/client.js',(await readFile('design/password-recovery/client.mjs','utf8')).replaceAll('./contact-fields.mjs','./contact-fields.js').replaceAll('./password-rules.mjs','./password-rules.js'));
await writeFile(base+'/contact-fields.js',await readFile('packages/domain/contact-fields.mjs','utf8'));
await writeFile(base+'/password-rules.js',ts.transpileModule(await readFile('packages/presentation/auth-password.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
for(const [i,s] of screens.entries()){
 const dir='dist'+href(i+1).replace(/index.html$/,'');await mkdir(dir,{recursive:true});
 await writeFile(dir+'index.html',`<!doctype html><html lang="ru"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex,nofollow"/><title>${s.title} — NSP Center</title><link rel="stylesheet" href="${stylesheet}"/><script>${appearance}</script></head><body><div id="root">${backdrop}${header}<main class="site-main site-main--account-route recovery-main">${s.email?s.body:`<section class="auth" data-auth-mode="recovery" data-ds-id="password-recovery-${i+1}">${s.body}</section>`}</main>${navigation}</div><script type="module" src="/__preview/password-recovery/client.js?v=auth-form-3"></script></body></html>`);
 console.log(href(i+1));
}
