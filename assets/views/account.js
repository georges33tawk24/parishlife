/* My account: the person's own ParishLife account, whatever parish (or none) is open.
   Name, email addresses and phone numbers and whether each is verified, the password,
   two-step verification, and Google / Apple / Microsoft sign-in. Every state shown here
   comes from the server; a code is only described as sent when a delivery service took it. */
import { api, session } from '../api.js';
import { t, lang, setLang, fmtDate } from '../i18n.js';
import { bus, ROLES } from '../store.js';
import { pageHead, panel, esc, pill, openModal, closeOverlays, toast } from '../ui.js';
import { icon } from '../icons.js';

const L = (en, ar) => t(en, ar);
const state = { data: null, loading: false, error: '', open: {} };

async function load() {
  if (state.loading) return;
  state.loading = true;
  try { state.data = await api('account'); state.error = ''; }
  catch (e) { state.error = e.message; }
  finally { state.loading = false; bus.refresh(); }
}
export const reloadAccount = () => { state.data = null; };

async function act(body, done = '') {
  const result = await api('account', 'POST', body);
  state.data = await api('account');
  if (done) toast(done, '', 'success');
  bus.refresh();
  return result;
}

/* ---------- words for what really happened to a code ---------- */
const CHANNEL_NAME = kind => kind === 'email' ? L('Email', 'البريد الإلكتروني') : L('Text message', 'الرسائل النصية');
export function deliveryWords(delivery, kind) {
  const noun = kind === 'email' ? L('email', 'البريد الإلكتروني') : L('text message', 'الرسائل النصية');
  return {
    'not-configured': L(`No code was sent: ${noun} delivery is not set up on this server yet.`, `لم يُرسل أي رمز: خدمة ${noun} غير مفعّلة على هذا الخادم بعد.`),
    sending: L('The code was handed over for sending, but the delivery service has not confirmed it.', 'سُلّم الرمز للإرسال، لكن خدمة الإرسال لم تؤكّد ذلك.'),
    sent: L('Code sent. It is valid for 15 minutes.', 'أُرسل الرمز. صالح لمدة ١٥ دقيقة.'),
    failed: L('The code could not be sent. Try again later.', 'تعذّر إرسال الرمز. حاول لاحقاً.'),
    console: L('Development server: the code was printed in the server console. It was not sent to anyone.', 'خادم تطوير: طُبع الرمز في نافذة الخادم ولم يُرسل إلى أحد.'),
    verified: L('Verified by your sign-in provider.', 'تحقّق منه مزوّد تسجيل الدخول.')
  }[delivery] || '';
}
const deliveryTone = d => ({ sent: 'success', verified: 'success', failed: 'danger', 'not-configured': 'warning', console: 'info', sending: 'warning' }[d] || '');

/* ---------- page ---------- */
export function account(section = '') {
  if (!state.data && !state.loading && !state.error) load();
  const head = pageHead({ title: L('My account', 'حسابي'),
    sub: L('Your ParishLife account belongs to you, not to a parish. Parishes you join or follow appear under Your places.',
      'حسابك في ParishLife ملكك، لا ملك رعية. الرعايا التي تنتمي إليها أو تتابعها تظهر في «أماكنك».') });
  if (state.error) return head + `<div class="alert alert-danger" role="alert">${icon('warn', 18)}<span>${esc(state.error)}</span></div>`;
  if (!state.data) return head + `<p class="dim">${L('Loading your account…', 'جارٍ تحميل حسابك…')}</p>`;
  const a = state.data;
  return head + welcome(a) + `<div class="grid g2 account-grid">
      ${panel(L('Your name', 'اسمك'), nameForm(a))}
      ${panel(L('Your places', 'أماكنك'), places())}
    </div>
    <div id="acct-profile">${panel(L('Your profile', 'ملفك'), profileForm(a))}</div>
    ${panel(L('Email addresses and phone numbers', 'البريد الإلكتروني وأرقام الهاتف'), contacts(a))}
    <div class="grid g2 account-grid">
      ${panel(L('Password', 'كلمة المرور'), password(a))}
      ${panel(L('Language', 'اللغة'), `<div class="langswap" role="group" aria-label="${L('Language', 'اللغة')}">
        <button type="button" data-acct-lang="en" aria-pressed="${lang === 'en'}">English</button>
        <button type="button" data-acct-lang="ar" aria-pressed="${lang === 'ar'}" lang="ar">العربية</button></div>`)}
    </div>
    ${panel(L('Two-step verification', 'التحقّق بخطوتين'), twoStep(a))}
    ${panel(L('Google, Apple and Microsoft', 'Google وApple وMicrosoft'), providers(a))}`;
}

function welcome(a) {
  const unverified = a.contacts.filter(k => !k.verified), notes = [];
  if (unverified.length) notes.push(`<div class="alert alert-info">${icon('info', 18)}<span><b>${L('Some of your contact details are not verified yet', 'بعض بياناتك غير مُتحقَّق منها بعد')}</b>
    ${L('You can still sign in with them and your password. Verifying proves they are yours, so a parish office can rely on them.',
      'يمكنك تسجيل الدخول بها وبكلمة المرور. التحقّق يثبت أنها لك، فيعتمد عليها مكتب الرعية.')}</span></div>`);
  return notes.join('');
}

function nameForm(a) {
  return `<form class="stack account-name" data-acct-form="name" novalidate>
    <div class="grid g2" style="gap:12px">
      <div class="formrow"><label class="label" for="acct-first">${L('First name', 'الاسم')}</label>
        <input class="input" id="acct-first" name="firstName" autocomplete="given-name" maxlength="60" value="${esc(a.firstName)}" required></div>
      <div class="formrow"><label class="label" for="acct-last">${L('Last name', 'الشهرة')}</label>
        <input class="input" id="acct-last" name="lastName" autocomplete="family-name" maxlength="60" value="${esc(a.lastName)}" required></div>
    </div>
    <dl class="dl"><dt>${L('Username', 'اسم المستخدم')}</dt><dd dir="ltr">${esc(a.username)}</dd>
      ${a.birthDate ? `<dt>${L('Date of birth', 'تاريخ الولادة')}</dt><dd>${esc(fmtDate(a.birthDate))}</dd>` : ''}</dl>
    <div><button class="btn btn-primary" type="submit">${L('Save name', 'حفظ الاسم')}</button></div>
  </form>`;
}

function places() {
  const au = session.authority || {};
  const list = [
    ...(au.superadmin ? [[L('Super admin', 'المدير العام'), L('All of ParishLife', 'كامل ParishLife')]] : []),
    ...(au.dioceses || []).map(x => [ROLES[x.role] ? L(ROLES[x.role].en, ROLES[x.role].ar) : x.role, L(x.name, x.nameAr || x.name)]),
    ...session.parishes.map(p => [L(p.role, p.roleAr), L(p.name, p.ar)])];
  return (list.length ? `<ul class="admin-list">${list.map(([r, p]) => `<li>${icon('portal', 16, 'dimmer')}<span><b>${esc(p)}</b><small>${esc(r)}</small></span></li>`).join('')}</ul>`
    : `<p class="dim">${L('You are not connected to a parish yet.', 'لست مرتبطاً برعية بعد.')}</p>`) +
    `<p style="margin-top:12px"><a class="btn btn-secondary" href="#/home">${icon('portal', 16)}${L('Manage your parishes', 'إدارة رعاياك')}</a></p>`;
}

/* The profile a parishioner keeps themselves: the same details a parish office records, without the office's own.
   Every field is optional. Sending it to a parish asks the office to update its record; it does not change it. */
const RITES = [['Maronite', 'ماروني'], ['Melkite', 'روم كاثوليك'], ['Greek Orthodox', 'روم أرثوذكس'], ['Armenian', 'أرمني'],
  ['Roman Catholic', 'لاتيني'], ['Syriac', 'سرياني']];
function profileForm(a) {
  const x = a.details || {};
  const text = (id, label, value, attrs = '', help = '') => `<div class="formrow"><label class="label" for="pf-${id}">${label}</label>
    <input class="input" id="pf-${id}" name="${id}" value="${esc(value || '')}" ${attrs}>${help ? `<span class="help">${help}</span>` : ''}</div>`;
  const choice = (id, label, value, options) => `<div class="formrow"><label class="label" for="pf-${id}">${label}</label>
    <select class="select" id="pf-${id}" name="${id}"><option value="">${L('Not given', 'غير محدّد')}</option>${options.map(([v, en, ar]) =>
      `<option value="${esc(v)}" ${value === v ? 'selected' : ''}>${esc(L(en, ar || en))}</option>`).join('')}</select></div>`;
  return `<form class="stack" data-acct-form="profile" novalidate>
    <p class="dim">${L('Fill in what you like, now or later. Nothing here is required, and a parish office never sees it unless you send it or ask to become a member.',
      'أدخل ما تشاء الآن أو لاحقاً. لا شيء هنا إلزامي، ولا يراه مكتب الرعية إلا إذا أرسلته أو طلبت الانتساب.')}</p>
    <div class="formgrid">
      ${text('arabicName', L('Name in Arabic', 'الاسم بالعربية'), x.arabicName, 'dir="rtl" maxlength="120" autocomplete="off"')}
      <div class="formrow"><label class="label" for="pf-birthDate">${L('Date of birth', 'تاريخ الولادة')}</label>
        <input class="input" id="pf-birthDate" name="birthDate" type="date" value="${esc(a.birthDate || '')}" max="${esc(new Date().toISOString().slice(0, 10))}"></div>
      ${choice('rite', L('Rite', 'الطقس'), x.rite, RITES.map(([en, ar]) => [en, en, ar]))}
      ${text('town', L('Town', 'البلدة'), x.town, 'maxlength="120" autocomplete="address-level2"')}
      ${text('address', L('Address', 'العنوان'), x.address, 'maxlength="300" autocomplete="street-address"')}
      ${text('occupation', L('Line of work', 'المهنة'), x.occupation, 'maxlength="120" autocomplete="organization-title"')}
      ${text('skills', L('Skills', 'المهارات'), (x.skills || []).join(', '), 'maxlength="800"', L('Separate them with commas, for example: singing, accounting, first aid.', 'افصل بينها بفواصل، مثلاً: ترتيل، محاسبة، إسعافات أولية.'))}
      ${choice('language', L('Preferred language', 'اللغة المفضّلة'), x.language, [['ar', 'Arabic', 'العربية'], ['en', 'English', 'الإنكليزية']])}
      ${choice('channel', L('Reach me on', 'تواصلوا معي عبر'), x.channel, [['whatsapp', 'WhatsApp'], ['sms', 'Text message', 'رسالة نصية'], ['email', 'Email', 'البريد الإلكتروني']])}
      ${choice('bloodType', L('Blood type', 'زمرة الدم'), x.bloodType, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => [v, v]))}
      ${text('emergencyName', L('Emergency contact', 'جهة الاتصال في حالات الطوارئ'), x.emergencyName, 'maxlength="120" autocomplete="off"')}
      ${text('emergencyPhone', L('Emergency contact’s phone', 'هاتف جهة الاتصال في الطوارئ'), x.emergencyPhone, 'type="tel" dir="ltr" maxlength="40" autocomplete="off"')}
    </div>
    <label class="check"><input type="checkbox" name="directory" ${x.directory ? 'checked' : ''}><span>${L('List me in the parish directory that other members can see', 'أدرجني في دليل الرعية الذي يراه الأعضاء الآخرون')}</span></label>
    ${a.memberParishes.length ? `<fieldset class="stack" style="border:0;padding:0;margin:0"><legend class="label">${L('Also ask these parish offices to update their records', 'واطلب من مكاتب هذه الرعايا تحديث سجلّاتها')}</legend>
      ${a.memberParishes.map(p => `<label class="check"><input type="checkbox" name="sendTo" value="${esc(p.id)}"><span>${esc(L(p.name, p.ar || p.name))}</span></label>`).join('')}
      <span class="help">${L('Only what you changed is sent. The office reviews it before changing its record.', 'يُرسل ما غيّرته فقط. يراجعه المكتب قبل تعديل سجلّه.')}</span></fieldset>` : ''}
    <p class="si-error" id="pf-error" role="alert" hidden></p>
    <div><button class="btn btn-primary" type="submit">${L('Save profile', 'حفظ الملف')}</button></div>
  </form>`;
}

function contacts(a) {
  const rows = a.contacts.map(k => {
    const id = `${k.kind}:${k.value}`, open = state.open[id];
    const channel = k.kind === 'email' ? 'email' : 'sms';
    const mode = a.config.delivery[channel];
    let status = '', form = '';
    if (k.verified) status = `<small class="dim">${esc(L(`Verified ${fmtDate(k.verifiedAt)}`, `مُتحقَّق منه في ${fmtDate(k.verifiedAt)}`))}</small>`;
    else if (k.code) {
      status = `<small class="acct-delivery tone-${deliveryTone(k.code.delivery)}">${esc(deliveryWords(k.code.delivery, k.kind))}
        ${k.code.delivery === 'sent' ? esc(k.code.open ? '' : L(' This code has expired; ask for a new one.', ' انتهت صلاحية هذا الرمز؛ اطلب رمزاً جديداً.')) : ''}</small>`;
    } else status = `<small class="acct-delivery tone-warning">${esc(mode === 'none' ? deliveryWords('not-configured', k.kind) : L('No code has been sent yet.', 'لم يُرسل أي رمز بعد.'))}</small>`;
    if (!k.verified && (k.code?.open || open)) form = `<form class="admin-inline-form" data-acct-form="verify" data-kind="${esc(k.kind)}" data-value="${esc(k.value)}" novalidate>
        <label class="label" for="code-${esc(id)}">${L('Code', 'الرمز')}</label>
        <input class="input mono" id="code-${esc(id)}" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" dir="ltr" style="max-width:9em">
        <button class="btn btn-primary btn-dense" type="submit">${L('Verify', 'تحقّق')}</button></form>`;
    const canSend = !k.verified && mode !== 'none';
    return `<li class="acct-contact">${icon(k.kind === 'email' ? 'mail' : 'phone', 18, 'dimmer')}
      <span class="grow"><b dir="ltr">${esc(k.value)}</b>
        ${k.verified ? pill(L('Verified', 'مُتحقَّق منه'), 'success') : pill(L('Not verified', 'غير مُتحقَّق منه'), 'warning')}
        ${k.username ? pill(L('Username', 'اسم المستخدم'), '', false) : ''}
        <span class="acct-status">${status}</span>${form}</span>
      <span class="acct-acts">
        ${canSend ? `<button class="btn btn-secondary btn-dense" type="button" data-acct-send="${esc(id)}">${k.code ? L('Send a new code', 'أرسل رمزاً جديداً') : L('Send a code', 'أرسل رمزاً')}</button>` : ''}
        ${!k.verified && !k.code?.open && mode !== 'none' ? `<button class="btn btn-ghost btn-dense" type="button" data-acct-have="${esc(id)}">${L('I have a code', 'لديّ رمز')}</button>` : ''}
        ${k.username ? '' : `<button class="btn btn-ghost btn-dense" type="button" data-acct-remove="${esc(id)}" aria-label="${esc(L(`Remove ${k.value}`, `إزالة ${k.value}`))}">${icon('trash', 16)}</button>`}
      </span></li>`;
  }).join('');
  return `<p class="dim" style="margin-bottom:12px">${L('Sign in with any of these and your password. A parish office only relies on verified ones.',
      'سجّل الدخول بأيّ منها مع كلمة المرور. لا يعتمد مكتب الرعية إلا على المُتحقَّق منها.')}</p>
    <ul class="admin-list acct-contacts">${rows || `<li class="dim">${L('No email address or phone number yet.', 'لا بريد إلكتروني أو رقم هاتف بعد.')}</li>`}</ul>
    <form class="admin-inline-form acct-add" data-acct-form="add" novalidate>
      <label class="label" for="acct-add-kind">${L('Add', 'إضافة')}</label>
      <select class="select" id="acct-add-kind" name="kind" style="max-width:12em">
        <option value="email">${L('Email address', 'بريد إلكتروني')}</option><option value="phone">${L('Phone number', 'رقم هاتف')}</option></select>
      <input class="input" name="value" aria-label="${L('Email address or phone number', 'البريد الإلكتروني أو رقم الهاتف')}" dir="ltr" maxlength="120" autocomplete="off">
      <button class="btn btn-secondary" type="submit">${icon('plus', 16)}${L('Add', 'إضافة')}</button></form>`;
}

function password(a) {
  return `<p class="dim" style="margin-bottom:12px">${a.hasPassword
    ? L('Changing it signs you out on every other device.', 'تغييرها يسجّل خروجك من كل الأجهزة الأخرى.')
    : L('Your account has no password yet: you sign in with a provider. You can add one.', 'لا كلمة مرور لحسابك بعد: تسجّل الدخول عبر مزوّد. يمكنك إضافة واحدة.')}</p>
    <button class="btn btn-secondary" type="button" data-acct-password>${icon('lock', 16)}${a.hasPassword ? L('Change password', 'تغيير كلمة المرور') : L('Set a password', 'تعيين كلمة مرور')}</button>`;
}

function twoStep(a) {
  const m = a.mfa;
  const row = (title, sub, on, actions) => `<li><span class="grow"><b>${esc(title)}</b> ${on ? pill(L('On', 'مفعّل'), 'success') : pill(L('Off', 'غير مفعّل'), '', false)}
    <small class="dim" style="display:block">${sub}</small></span><span class="acct-acts">${actions}</span></li>`;
  const channelRow = (method, kind) => {
    const x = m[method], name = CHANNEL_NAME(kind);
    const reason = x.delivery === 'none' ? L('Not available: this server has no delivery service for these codes yet.', 'غير متاح: لا خدمة إرسال لهذه الرموز على هذا الخادم بعد.')
      : !x.contact ? (kind === 'email' ? L('Verify an email address first.', 'تحقّق من بريد إلكتروني أولاً.') : L('Verify a phone number first.', 'تحقّق من رقم هاتف أولاً.'))
      : x.delivery === 'console' ? L('Development server: codes are printed in the server console, not sent.', 'خادم تطوير: تُطبع الرموز في نافذة الخادم ولا تُرسل.')
      : L('A code is sent each time you sign in.', 'يُرسل رمز في كل مرة تسجّل فيها الدخول.');
    const actions = x.enabled ? `<button class="btn btn-ghost btn-dense" type="button" data-acct-mfa-off="${method}">${L('Turn off', 'إيقاف')}</button>`
      : `<button class="btn btn-secondary btn-dense" type="button" data-acct-mfa-on="${method}" ${x.delivery === 'none' || !x.contact ? 'disabled' : ''}>${L('Turn on', 'تفعيل')}</button>`;
    return row(L(`${name} codes`, `رموز ${name}`), esc(reason), x.enabled, actions);
  };
  const any = m.totp.enabled || m.email.enabled || m.sms.enabled;
  return `<p class="dim" style="margin-bottom:12px">${L('After your password, ParishLife also asks for a code, so a stolen password alone is not enough.',
      'بعد كلمة المرور، يطلب ParishLife رمزاً أيضاً، فلا تكفي كلمة مرور مسروقة وحدها.')}</p>
    <ul class="admin-list">
      ${row(L('Authenticator app', 'تطبيق المصادقة'), esc(L('Google Authenticator, Microsoft Authenticator, 1Password or any app that shows six-digit codes. Works without email or text messages.',
        'Google Authenticator أو Microsoft Authenticator أو 1Password أو أي تطبيق يعرض رموزاً من ستة أرقام. يعمل دون بريد أو رسائل نصية.')), m.totp.enabled,
        m.totp.enabled ? `<button class="btn btn-ghost btn-dense" type="button" data-acct-mfa-off="totp">${L('Turn off', 'إيقاف')}</button>`
          : `<button class="btn btn-secondary btn-dense" type="button" data-acct-totp>${L('Set up', 'إعداد')}</button>`)}
      ${channelRow('email', 'email')}
      ${channelRow('sms', 'phone')}
      ${any ? row(L('Recovery codes', 'رموز الاسترداد'), esc(L(`${m.recoveryLeft} unused. Each works once, if you lose your phone.`, `${m.recoveryLeft} غير مستخدمة. كل رمز يعمل مرة واحدة إن فقدت هاتفك.`)), m.recoveryLeft > 0,
        `<button class="btn btn-secondary btn-dense" type="button" data-acct-recovery>${L('Make new codes', 'إنشاء رموز جديدة')}</button>`) : ''}
    </ul>`;
}

function providers(a) {
  const linked = Object.fromEntries(a.identities.map(i => [i.provider, i]));
  return `<p class="dim" style="margin-bottom:12px">${L('Link a provider to sign in with it. An account is never joined to another just because the email address matches.',
      'اربط مزوّداً لتسجيل الدخول به. لا يُدمج حساب بآخر لمجرّد تطابق البريد الإلكتروني.')}</p>
    <ul class="admin-list">${Object.entries(a.config.providers).map(([id, p]) => {
      const l = linked[id];
      return `<li><span class="grow"><b>${esc(p.name)}</b> ${l ? pill(L('Linked', 'مرتبط'), 'success') : p.configured ? '' : pill(L('Not set up yet', 'غير مُعدّ بعد'), 'warning')}
        <small class="dim" style="display:block">${l ? esc(L(`${l.email || 'Linked'} · since ${fmtDate(l.linkedAt)}`, `${l.email || 'مرتبط'} · منذ ${fmtDate(l.linkedAt)}`))
          : p.configured ? esc(L(`Sign in with ${p.name} after linking it.`, `سجّل الدخول عبر ${p.name} بعد ربطه.`))
          : esc(L(`${p.name} sign-in is not available on this server until its administrator configures it.`, `تسجيل الدخول عبر ${p.name} غير متاح على هذا الخادم حتى يُعدّه المسؤول.`))}</small></span>
        <span class="acct-acts">${l ? `<button class="btn btn-ghost btn-dense" type="button" data-acct-unlink="${id}">${L('Unlink', 'فكّ الربط')}</button>`
          : `<a class="btn btn-secondary btn-dense ${p.configured ? '' : 'is-disabled'}" ${p.configured ? `href="/api/auth/${id}/start?intent=link"` : 'aria-disabled="true"'}>${L('Link', 'ربط')}</a>`}</span></li>`;
    }).join('')}</ul>`;
}

/* ---------- dialogs ---------- */
function passwordDialog(a) {
  openModal({
    title: a.hasPassword ? L('Change password', 'تغيير كلمة المرور') : L('Set a password', 'تعيين كلمة مرور'),
    body: `<form id="pwform" class="stack" novalidate>
      ${a.hasPassword ? `<div class="formrow"><label class="label" for="pw-current">${L('Current password', 'كلمة المرور الحالية')}</label>
        <input class="input" id="pw-current" type="password" autocomplete="current-password" maxlength="200"></div>` : ''}
      <div class="formrow"><label class="label" for="pw-new">${L('New password', 'كلمة المرور الجديدة')}</label>
        <input class="input" id="pw-new" type="password" autocomplete="new-password" maxlength="200" aria-describedby="pw-help">
        <span class="help" id="pw-help">${L('At least 8 characters.', '٨ أحرف على الأقل.')}</span></div>
      <div class="formrow"><label class="label" for="pw-confirm">${L('Confirm new password', 'تأكيد كلمة المرور الجديدة')}</label>
        <input class="input" id="pw-confirm" type="password" autocomplete="new-password" maxlength="200"></div>
      <p class="si-error" id="pw-error" role="alert" hidden></p></form>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" form="pwform" type="submit" style="margin-inline-start:auto">${L('Save password', 'حفظ كلمة المرور')}</button>`,
    onMount(el) {
      el.querySelector('#pwform').addEventListener('submit', async e => {
        e.preventDefault();
        const error = el.querySelector('#pw-error'), password = el.querySelector('#pw-new').value, confirm = el.querySelector('#pw-confirm').value;
        const fail = message => { error.textContent = message; error.hidden = false; };
        if (password.length < 8) return fail(L('Choose a password of at least 8 characters.', 'اختر كلمة مرور من ٨ أحرف على الأقل.'));
        if (password !== confirm) return fail(L('The two passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
        try {
          await act({ op: 'changePassword', current: el.querySelector('#pw-current')?.value || '', password, confirm });
          closeOverlays(); toast(L('Password saved', 'حُفظت كلمة المرور'), L('Other devices have been signed out.', 'سُجّل الخروج من الأجهزة الأخرى.'), 'success');
        } catch (err) { fail(err.message); }
      });
    }
  });
}

/* Asks for the password (or, without one, an authenticator code) before a safeguard is weakened. */
function confirmDialog({ title, body, button, danger = false, run }) {
  const a = state.data, needCode = !a.hasPassword && a.mfa.totp.enabled;
  openModal({
    title, body: `<form id="cfform" class="stack" novalidate><p>${body}</p>
      ${a.hasPassword ? `<div class="formrow"><label class="label" for="cf-pw">${L('Your password', 'كلمة المرور')}</label>
        <input class="input" id="cf-pw" type="password" autocomplete="current-password" maxlength="200"></div>` : ''}
      ${needCode ? `<div class="formrow"><label class="label" for="cf-code">${L('Code from your authenticator app', 'رمز من تطبيق المصادقة')}</label>
        <input class="input mono" id="cf-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" dir="ltr"></div>` : ''}
      <p class="si-error" id="cf-error" role="alert" hidden></p></form>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" form="cfform" type="submit" style="margin-inline-start:auto">${esc(button)}</button>`,
    onMount(el) {
      el.querySelector('#cfform').addEventListener('submit', async e => {
        e.preventDefault();
        try { await run({ password: el.querySelector('#cf-pw')?.value || '', code: el.querySelector('#cf-code')?.value || '' }); }
        catch (err) { const box = el.querySelector('#cf-error'); box.textContent = err.message; box.hidden = false; }
      });
    }
  });
}

export function recoveryDialog(codes) {
  const text = L('ParishLife recovery codes. Each works once.', 'رموز الاسترداد في ParishLife. كل رمز يعمل مرة واحدة.') + '\n\n' + codes.join('\n') + '\n';
  openModal({
    title: L('Save your recovery codes', 'احفظ رموز الاسترداد'),
    sub: L('If you lose your phone, each of these lets you sign in once. They are shown only now.', 'إن فقدت هاتفك، يتيح لك كل رمز تسجيل الدخول مرة واحدة. لن تظهر إلا الآن.'),
    body: `<ul class="recovery-codes mono" dir="ltr">${codes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`,
    foot: `<button class="btn btn-secondary" type="button" id="rc-copy">${L('Copy', 'نسخ')}</button>
      <a class="btn btn-secondary" download="parishlife-recovery-codes.txt" href="data:text/plain;charset=utf-8,${encodeURIComponent(text)}">${icon('export', 16)}${L('Download', 'تنزيل')}</a>
      <button class="btn btn-primary" data-close style="margin-inline-start:auto">${L('I have saved them', 'حفظتها')}</button>`,
    onMount(el) {
      el.querySelector('#rc-copy').addEventListener('click', () => navigator.clipboard?.writeText(text)
        .then(() => toast(L('Copied', 'نُسخت'), '', 'success'), () => toast(L('Copy them by hand', 'انسخها يدوياً'), '', 'warning')));
    }
  });
}

async function totpDialog() {
  let setup;
  try { setup = await api('account', 'POST', { op: 'totpBegin' }); }
  catch (e) { return toast(L('Could not start', 'تعذّر البدء'), e.message, 'danger'); }
  const key = setup.secret.match(/.{1,4}/g).join(' ');
  openModal({
    title: L('Set up an authenticator app', 'إعداد تطبيق المصادقة'),
    body: `<form id="totpform" class="stack" novalidate>
      <ol class="steps-list">
        <li>${L('In your authenticator app, add an account and choose to enter a setup key.', 'في تطبيق المصادقة، أضف حساباً واختر إدخال مفتاح الإعداد.')}</li>
        <li>${L('Type this key (time-based):', 'اكتب هذا المفتاح (مبني على الوقت):')}
          <div class="totp-key mono" dir="ltr">${esc(key)}</div>
          <p class="help">${L('On this phone you can instead', 'على هذا الهاتف يمكنك بدلاً من ذلك')} <a href="${esc(setup.uri)}">${L('open it in your authenticator app', 'فتحه في تطبيق المصادقة')}</a>.
            ${L('A QR code is not shown.', 'لا يُعرض رمز QR.')}</p></li>
        <li><label class="label" for="totp-code">${L('Enter the six-digit code the app shows', 'أدخل الرمز المكوّن من ستة أرقام الذي يعرضه التطبيق')}</label>
          <input class="input mono" id="totp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" dir="ltr" style="max-width:10em"></li>
      </ol><p class="si-error" id="totp-error" role="alert" hidden></p></form>`,
    foot: `<button class="btn btn-secondary" type="button" id="totp-copy">${L('Copy key', 'نسخ المفتاح')}</button>
      <button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" form="totpform" type="submit" style="margin-inline-start:auto">${L('Turn on', 'تفعيل')}</button>`,
    onMount(el) {
      el.querySelector('#totp-copy').addEventListener('click', () => navigator.clipboard?.writeText(setup.secret).then(() => toast(L('Key copied', 'نُسخ المفتاح'), '', 'success'), () => {}));
      el.querySelector('#totpform').addEventListener('submit', async e => {
        e.preventDefault();
        try {
          const result = await act({ op: 'totpConfirm', code: el.querySelector('#totp-code').value });
          closeOverlays();
          toast(L('Two-step verification is on', 'التحقّق بخطوتين مفعّل'), L('You will be asked for a code when you sign in.', 'سيُطلب منك رمز عند تسجيل الدخول.'), 'success');
          if (result.recovery) recoveryDialog(result.recovery);
        } catch (err) { const box = el.querySelector('#totp-error'); box.textContent = err.message; box.hidden = false; }
      });
    }
  });
}

/* ---------- wiring ---------- */
account.mount = (host, section) => {
  const a = state.data;
  if (!a) return;
  if (section === 'profile') requestAnimationFrame(() => host.querySelector('#acct-profile')?.scrollIntoView({ block: 'start' }));
  host.querySelector('[data-acct-form="profile"]')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget, error = f.querySelector('#pf-error'), v = name => f.elements[name]?.value ?? '';
    const born = v('birthDate');
    if (born && (born > new Date().toISOString().slice(0, 10) || new Date(born) > new Date(new Date().setFullYear(new Date().getFullYear() - 13)))) {
      error.textContent = L('The date of birth must be at least 13 years ago.', 'يجب أن يكون تاريخ الولادة قبل ١٣ سنة على الأقل.'); error.hidden = false; return;
    }
    try {
      const result = await act({ op: 'saveProfile', firstName: a.firstName, lastName: a.lastName, birthDate: born,
        ...Object.fromEntries(['arabicName', 'town', 'address', 'rite', 'occupation', 'language', 'channel', 'bloodType', 'emergencyName', 'emergencyPhone'].map(k => [k, v(k)])),
        skills: v('skills').split(/[,،]/).map(s => s.trim()).filter(Boolean), directory: f.elements.directory.checked,
        sendTo: [...f.querySelectorAll('input[name="sendTo"]:checked')].map(i => i.value) });
      try { localStorage.setItem('pl-profile-done:' + session.user?.id, '1'); } catch { /* private mode */ }
      toast(L('Profile saved', 'حُفظ الملف'), result.sent ? L(`${result.sent} update request(s) sent to the parish office for review.`, `أُرسل ${result.sent} طلب تحديث إلى مكتب الرعية للمراجعة.`)
        : result.changed.length ? '' : L('Nothing had changed.', 'لم يتغيّر شيء.'), 'success');
    } catch (err) { error.textContent = err.message; error.hidden = false; }
  });
  const find = id => a.contacts.find(k => `${k.kind}:${k.value}` === id);
  const guard = fn => async (...args) => { try { await fn(...args); } catch (e) { toast(L('Not done', 'لم يتمّ'), e.message, 'danger'); } };
  host.querySelectorAll('[data-acct-lang]').forEach(b => b.addEventListener('click', () => { setLang(b.dataset.acctLang); bus.renderAll?.(); }));
  host.querySelector('[data-acct-form="name"]')?.addEventListener('submit', guard(async e => {
    e.preventDefault();
    const f = e.currentTarget, firstName = f.firstName.value, lastName = f.lastName.value;
    await act({ op: 'updateProfile', firstName, lastName }, L('Name saved', 'حُفظ الاسم'));
    session.user.name = state.data.name;
  }));
  host.querySelector('[data-acct-form="add"]')?.addEventListener('submit', guard(async e => {
    e.preventDefault();
    const f = e.currentTarget, kind = f.kind.value;
    const result = await act({ op: 'addContact', kind, value: f.value.value });
    toast(kind === 'email' ? L('Email address added', 'أُضيف البريد الإلكتروني') : L('Phone number added', 'أُضيف رقم الهاتف'),
      deliveryWords(result.delivery, kind), deliveryTone(result.delivery) === 'success' ? 'success' : 'warning');
  }));
  host.querySelectorAll('[data-acct-form="verify"]').forEach(f => f.addEventListener('submit', guard(async e => {
    e.preventDefault();
    await act({ op: 'verifyContact', kind: f.dataset.kind, value: f.dataset.value, code: f.code.value }, L('Verified', 'تمّ التحقّق'));
  })));
  host.querySelectorAll('[data-acct-send]').forEach(b => b.addEventListener('click', guard(async () => {
    const k = find(b.dataset.acctSend);
    const result = await act({ op: 'sendCode', kind: k.kind, value: k.value });
    state.open[b.dataset.acctSend] = true;
    toast(L('Code requested', 'طُلب الرمز'), deliveryWords(result.delivery, k.kind), deliveryTone(result.delivery) === 'success' ? 'success' : 'warning');
    bus.refresh();
  })));
  host.querySelectorAll('[data-acct-have]').forEach(b => b.addEventListener('click', () => { state.open[b.dataset.acctHave] = true; bus.refresh(); }));
  host.querySelectorAll('[data-acct-remove]').forEach(b => b.addEventListener('click', guard(async () => {
    const k = find(b.dataset.acctRemove);
    if (!confirm(L(`Remove ${k.value} from your account?`, `إزالة ${k.value} من حسابك؟`))) return;
    await act({ op: 'removeContact', kind: k.kind, value: k.value }, L('Removed', 'أُزيل'));
  })));
  host.querySelector('[data-acct-password]')?.addEventListener('click', () => passwordDialog(a));
  host.querySelector('[data-acct-totp]')?.addEventListener('click', totpDialog);
  host.querySelectorAll('[data-acct-mfa-on]').forEach(b => b.addEventListener('click', guard(async () => {
    const result = await act({ op: 'mfaEnable', method: b.dataset.acctMfaOn }, L('Two-step verification is on', 'التحقّق بخطوتين مفعّل'));
    if (result.recovery) recoveryDialog(result.recovery);
  })));
  host.querySelectorAll('[data-acct-mfa-off]').forEach(b => b.addEventListener('click', () => confirmDialog({
    title: L('Turn off this method?', 'إيقاف هذه الطريقة؟'), danger: true, button: L('Turn off', 'إيقاف'),
    body: L('Your account will be easier to break into with a stolen password.', 'سيصبح اقتحام حسابك أسهل بكلمة مرور مسروقة.'),
    run: async proof => { await act({ op: 'mfaDisable', method: b.dataset.acctMfaOff, ...proof }, L('Turned off', 'أُوقف')); closeOverlays(); }
  })));
  host.querySelector('[data-acct-recovery]')?.addEventListener('click', () => confirmDialog({
    title: L('Make new recovery codes?', 'إنشاء رموز استرداد جديدة؟'), button: L('Make new codes', 'إنشاء رموز جديدة'),
    body: L('Your old recovery codes stop working.', 'تتوقّف رموز الاسترداد القديمة عن العمل.'),
    run: async proof => { const result = await act({ op: 'recoveryCodes', ...proof }); closeOverlays(); recoveryDialog(result.recovery); }
  }));
  host.querySelectorAll('[data-acct-unlink]').forEach(b => b.addEventListener('click', guard(async () => {
    if (!confirm(L('Unlink this provider? You will no longer be able to sign in with it.', 'فكّ ربط هذا المزوّد؟ لن تتمكّن من تسجيل الدخول به بعد ذلك.'))) return;
    await act({ op: 'unlinkProvider', provider: b.dataset.acctUnlink }, L('Unlinked', 'فُكّ الربط'));
  })));
};
