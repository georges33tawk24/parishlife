/* Administration → Plans. A parish priest switches modules on or off for a parish the parish manages
   itself, or asks the diocese when the diocese covers it; a bishop or diocesan admin covers several
   parishes with one arrangement and decides change requests; a super admin sets the options on offer.
   A plan never gives anyone access, no prices are set, and nothing is charged. */
import { api } from '../api.js';
import { t, fmtDate } from '../i18n.js';
import { bus } from '../store.js';
import { panel, esc, pill, openDrawer, openModal, closeOverlays, toast } from '../ui.js';
import { icon } from '../icons.js';

const L = (en, ar) => t(en, ar);
const plans = { data: null, loading: false, error: '' };
export const plansAvailable = d => d.parishes.some(p => (p.perms || []).includes('plans.manage')) ||
  d.dioceses.some(x => (x.perms || []).includes('plans.sponsor')) || (d.system || []).includes('plans.configure');

async function load(force = false) {
  if (plans.loading || (plans.data && !force)) return;
  plans.loading = true;
  try { plans.data = await api('plans'); plans.error = ''; }
  catch (e) { plans.error = e.message; }
  finally { plans.loading = false; bus.refresh(); }
}
async function act(body, success) {
  const result = await api('plans', 'POST', body);
  await load(true);
  await bus.reloadSession?.();
  if (success) toast(success, '', 'success');
  return result;
}

const P = () => plans.data;
const moduleName = id => { const m = P().modules.find(x => x.id === id); return m ? L(m.en, m.ar) : id; };
const bundleName = id => { const b = P().bundles.find(x => x.id === id); return b ? L(b.name, b.nameAr || b.name) : id ? L('A bundle no longer offered', 'باقة لم تعد معروضة') : L('Modules chosen one by one', 'وحدات مختارة واحدةً واحدة'); };
const demoPill = b => b.demo ? pill(L('Demonstration configuration', 'إعداد للعرض'), 'warning', false) : '';
const when = at => at ? fmtDate(String(at).slice(0, 10)) : '—';
const chips = modules => `<div class="plan-chips">${P().modules.map(m => `<span class="plan-chip ${modules.includes(m.id) ? 'on' : 'off'}">${icon(modules.includes(m.id) ? 'check' : 'close', 13)}${esc(L(m.en, m.ar))}</span>`).join('')}</div>`;
const modeLine = (p, d) => {
  if (p.plan.mode === 'unchosen') return L('No plan chosen yet — every module stays on, as before.', 'لم تُختر خطة بعد — تبقى كل الوحدات مفعّلة كما كانت.');
  if (p.plan.mode === 'sponsored') {
    const a = d.dioceses.flatMap(x => x.arrangements).find(x => x.id === p.plan.arrangement);
    return L('Covered by the diocese', 'تغطّيها الأبرشية') + (a ? ` · ${esc(a.name)}` : '') + ' — ' + L('changes are requested from the diocese.', 'تُطلب التغييرات من الأبرشية.');
  }
  return L('Managed by the parish.', 'تديرها الرعية.');
};
const presenceLine = v => v === 'included' ? L('Public Presence includes document requests.', 'الحضور العام يشمل طلبات الوثائق.')
  : v === 'separate' ? L('Document requests are a separate module, not part of Public Presence.', 'طلبات الوثائق وحدة منفصلة وليست جزءاً من الحضور العام.')
  : L('Not decided yet whether Public Presence includes document requests. Until it is, every parish keeps taking them, as before.', 'لم يُحسم بعد إن كان الحضور العام يشمل طلبات الوثائق. وإلى أن يُحسم، تبقى كل الرعايا تستقبلها كما كانت.');

export function plansTab() {
  load();
  if (plans.error) return `<div class="alert alert-danger" role="alert">${icon('warn', 18)}<span>${esc(plans.error)}</span></div>`;
  if (!P()) return `<p role="status" class="dim">${L('Loading plans…', 'جارٍ تحميل الخطط…')}</p>`;
  const d = P();
  return `<div class="alert alert-info" role="note">${icon('info', 18)}<span><b>${L('Plans decide which modules a parish has switched on.', 'تحدّد الخطط الوحدات المفعّلة لدى الرعية.')}</b>
      ${L('They never give anyone access — people still need their role’s permissions. No prices or billing periods are set, and nothing is charged: billing is not live. Switching a module off keeps all its records and waiting requests.',
        'لا تمنح أحداً وصولاً — يبقى كل شخص بحاجة إلى صلاحيات دوره. لم تُحدَّد أسعار ولا فترات فوترة، ولا يُحتسب أي مبلغ: الفوترة غير مفعّلة. وإيقاف وحدة يُبقي كل سجلّاتها وطلباتها المنتظرة.')}</span></div>
    ${d.parishes.length ? panel(L('Parish plans', 'خطط الرعايا'), `<div class="plan-list">${d.parishes.map(p => parishCard(p, d)).join('')}</div>`) : ''}
    ${d.dioceses.map(x => dioceseCard(x, d)).join('')}
    ${d.configure ? options(d) : ''}
    ${panel(L('What each option includes', 'ما يشمله كل خيار'), matrix(d), { tight: true })}`;
}

function parishCard(p, d) {
  const pending = p.requests.find(r => r.status === 'pending');
  return `<article class="plan-card"><header><h3>${esc(L(p.name, p.ar || p.name))}</h3>${p.plan.bundle ? `<span class="dim">${esc(bundleName(p.plan.bundle))}</span>` : ''}</header>
    <p class="help">${modeLine(p, d)}</p>${chips(p.plan.modules)}
    ${pending ? `<div class="plan-request"><b>${L('Change request waiting for the diocese', 'طلب تغيير ينتظر الأبرشية')}</b> · ${when(pending.createdAt)} · ${esc(pending.requestedByName)}
      <div>${chips(pending.modules)}</div>${pending.note ? `<p>${esc(pending.note)}</p>` : ''}
      <div class="row" style="gap:8px;flex-wrap:wrap">${p.sponsor ? `<button class="btn btn-primary btn-dense" data-plan-decide="${esc(p.id)}:${esc(pending.id)}:approve">${L('Approve', 'موافقة')}</button><button class="btn btn-secondary btn-dense" data-plan-decide="${esc(p.id)}:${esc(pending.id)}:decline">${L('Decline', 'رفض')}</button>` : ''}
      ${p.manage ? `<button class="btn btn-secondary btn-dense" data-plan-withdraw="${esc(p.id)}:${esc(pending.id)}">${L('Withdraw request', 'سحب الطلب')}</button>` : ''}</div></div>` : ''}
    ${p.manage && !pending ? `<button class="btn btn-secondary btn-dense" data-plan-change="${esc(p.id)}">${p.plan.mode === 'sponsored' ? L('Request a change', 'طلب تغيير') : L('Change plan', 'تغيير الخطة')}</button>` : ''}
    ${p.history.length ? `<details class="plan-history"><summary>${L('History', 'السجلّ')}</summary><ul>${p.history.map(h => `<li>${when(h.at)} · ${esc(h.action)}${h.detail.removed?.length ? ` · ${L('switched off', 'أُوقفت')}: ${h.detail.removed.map(m => esc(moduleName(m))).join(', ')}` : ''}${h.detail.added?.length ? ` · ${L('switched on', 'فُعّلت')}: ${h.detail.added.map(m => esc(moduleName(m))).join(', ')}` : ''}</li>`).join('')}</ul></details>` : ''}</article>`;
}

function dioceseCard(x, d) {
  return panel(L('Diocesan arrangements', 'الترتيبات الأبرشية') + ' · ' + esc(x.name), `<p class="help">${L('One arrangement covers several parishes. Covered parishes ask the diocese for changes; leaving or ending an arrangement keeps each parish’s modules.', 'يغطّي الترتيب الواحد عدة رعايا. تطلب الرعايا المشمولة التغييرات من الأبرشية؛ ومغادرة الترتيب أو إنهاؤه يُبقي وحدات كل رعية.')}</p>
    ${x.arrangements.length ? `<div class="plan-list">${x.arrangements.map(a => `<article class="plan-card"><header><h3>${esc(a.name)}</h3>${a.status === 'active' ? pill(L('Active', 'نشط'), 'success') : pill(L('Ended', 'منتهٍ'), '', false)}</header>
      <p class="help">${esc(bundleName(a.bundle))} · ${a.parishes.length} ${L('parishes', 'رعايا')} · ${L('since', 'منذ')} ${when(a.createdAt)}${a.note ? ' · ' + esc(a.note) : ''}</p>${chips(a.modules)}
      <p class="dim">${a.parishes.map(pid => esc(L(d.parishes.find(p => p.id === pid)?.name || pid, d.parishes.find(p => p.id === pid)?.ar || pid))).join(' · ')}</p>
      ${a.status === 'active' ? `<div class="row" style="gap:8px"><button class="btn btn-secondary btn-dense" data-plan-arrangement="${esc(x.id)}:${esc(a.id)}">${L('Edit', 'تعديل')}</button><button class="btn btn-secondary btn-dense" data-plan-end="${esc(a.id)}">${L('End arrangement', 'إنهاء الترتيب')}</button></div>` : ''}</article>`).join('')}</div>`
      : `<p class="dim">${L('No arrangement yet.', 'لا ترتيب بعد.')}</p>`}
    <button class="btn btn-secondary" data-plan-arrangement="${esc(x.id)}:">${icon('plus', 16)}${L('New arrangement', 'ترتيب جديد')}</button>`);
}

function options(d) {
  return panel(L('Options offered to parishes', 'الخيارات المعروضة على الرعايا'), `
    <div class="formrow"><label class="label" for="plan-presence-docs">${L('Does Public Presence include document requests?', 'هل يشمل الحضور العام طلبات الوثائق؟')}</label>
      <select class="select" id="plan-presence-docs">${[['undecided', 'Not decided yet', 'لم يُحسم بعد'], ['included', 'Yes — included in Public Presence', 'نعم — ضمن الحضور العام'], ['separate', 'No — a separate module', 'لا — وحدة منفصلة']]
        .map(([v, en, ar]) => `<option value="${v}" ${d.presenceDocuments === v ? 'selected' : ''}>${L(en, ar)}</option>`).join('')}</select>
      <p class="help">${presenceLine(d.presenceDocuments)}</p></div>
    <div class="plan-list">${d.bundles.map(b => `<article class="plan-card"><header><h3>${esc(L(b.name, b.nameAr || b.name))}</h3>${demoPill(b)}${b.status === 'retired' ? pill(L('No longer offered', 'لم تعد معروضة'), '', false) : ''}</header>
      <p class="help">${esc(L(b.description, b.descriptionAr || b.description))}</p>${chips(b.modules)}
      <div class="row" style="gap:8px"><button class="btn btn-secondary btn-dense" data-plan-bundle="${esc(b.id)}">${L('Edit', 'تعديل')}</button>
      <button class="btn btn-secondary btn-dense" data-plan-retire="${esc(b.id)}" data-retire="${b.status !== 'retired'}">${b.status === 'retired' ? L('Offer again', 'عرضها مجدداً') : L('Stop offering', 'إيقاف عرضها')}</button></div></article>`).join('')}</div>
    <button class="btn btn-secondary" data-plan-bundle="">${icon('plus', 16)}${L('New bundle', 'باقة جديدة')}</button>`);
}

export function matrix(d) {
  const bundles = d.bundles.filter(b => b.status !== 'retired');
  return `<div class="tablewrap"><table class="tbl plan-matrix"><caption class="sr-only">${L('Modules in each bundle', 'الوحدات في كل باقة')}</caption>
    <thead><tr><th scope="col">${L('Module', 'الوحدة')}</th>${bundles.map(b => `<th scope="col">${esc(L(b.name, b.nameAr || b.name))}${b.demo ? `<small class="dim" style="display:block">${L('Demonstration', 'للعرض')}</small>` : ''}</th>`).join('')}</tr></thead>
    <tbody>${d.modules.map(m => `<tr><th scope="row"><b>${esc(L(m.en, m.ar))}</b><small class="dim" style="display:block">${esc(L(m.about, m.aboutAr))}</small></th>${bundles.map(b => {
      const on = b.modules.includes(m.id);
      if (m.id === 'documents' && !on && b.modules.length === 1 && b.modules[0] === 'presence')
        return `<td>${d.presenceDocuments === 'included' ? `${icon('check', 15)}<span class="sr-only">${L('Included', 'مشمول')}</span>` : d.presenceDocuments === 'separate' ? `<span aria-label="${L('Not included', 'غير مشمول')}">—</span>` : `<small>${L('Not decided yet', 'لم يُحسم بعد')}</small>`}</td>`;
      return `<td>${on ? `${icon('check', 15)}<span class="sr-only">${L('Included', 'مشمول')}</span>` : `<span aria-label="${L('Not included', 'غير مشمول')}">—</span>`}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* Choosing modules: a bundle's modules are fixed; anything else can be added one by one. */
function moduleForm(prefix, bundleId, modules) {
  const d = P(), offered = d.bundles.filter(b => b.status === 'active' || b.id === bundleId);
  return `<fieldset class="formrow"><legend class="label">${L('Bundle', 'الباقة')}</legend>
      <label class="check"><input type="radio" name="${prefix}-bundle" value="" ${!bundleId ? 'checked' : ''}><span>${L('No bundle — choose modules one by one', 'دون باقة — اختر الوحدات واحدةً واحدة')}</span></label>
      ${offered.map(b => `<label class="check"><input type="radio" name="${prefix}-bundle" value="${esc(b.id)}" ${bundleId === b.id ? 'checked' : ''}><span>${esc(L(b.name, b.nameAr || b.name))} ${b.demo ? `<small class="dim">${L('(demonstration configuration)', '(إعداد للعرض)')}</small>` : ''}</span></label>`).join('')}</fieldset>
    <fieldset class="formrow"><legend class="label">${L('Modules', 'الوحدات')}</legend>
      ${d.modules.map(m => `<label class="check"><input type="checkbox" name="${prefix}-module" value="${esc(m.id)}" ${modules.includes(m.id) ? 'checked' : ''} ${m.always ? 'disabled' : ''}><span>${esc(L(m.en, m.ar))} <small class="dim">${esc(L(m.about, m.aboutAr))}</small></span></label>`).join('')}</fieldset>`;
}
function wireModuleForm(el, prefix) {
  const sync = () => {
    const bid = el.querySelector(`[name=${prefix}-bundle]:checked`)?.value, fixed = new Set(P().bundles.find(b => b.id === bid)?.modules || ['presence']);
    el.querySelectorAll(`[name=${prefix}-module]`).forEach(x => { if (fixed.has(x.value)) x.checked = true; x.disabled = fixed.has(x.value); });
  };
  el.querySelectorAll(`[name=${prefix}-bundle]`).forEach(r => r.addEventListener('change', sync)); sync();
  return () => ({ bundle: el.querySelector(`[name=${prefix}-bundle]:checked`)?.value || null,
    modules: [...el.querySelectorAll(`[name=${prefix}-module]:checked`)].map(x => x.value) });
}

function changePlan(pid) {
  const p = P().parishes.find(x => x.id === pid), sponsored = p.plan.mode === 'sponsored';
  openDrawer({ title: sponsored ? L('Request a plan change', 'طلب تغيير الخطة') : L('Change the parish plan', 'تغيير خطة الرعية'), sub: L(p.name, p.ar || p.name),
    body: moduleForm('pc', p.plan.bundle, p.plan.modules) + (sponsored ? `<div class="formrow"><label class="label" for="pc-note">${L('Note for the diocese (optional)', 'ملاحظة للأبرشية (اختياري)')}</label><textarea class="textarea" id="pc-note" rows="3" maxlength="500"></textarea></div>` : '') +
      `<div id="pc-preview" aria-live="polite"></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="pc-next">${L('Review the change', 'مراجعة التغيير')}</button>`,
    onMount(el) {
      const read = wireModuleForm(el, 'pc'), next = el.querySelector('#pc-next'), box = el.querySelector('#pc-preview');
      let reviewed = null;   // the choice the reader has seen the consequences of
      const reset = () => { reviewed = null; box.innerHTML = ''; next.textContent = L('Review the change', 'مراجعة التغيير'); };
      el.querySelectorAll('[name=pc-bundle],[name=pc-module]').forEach(x => x.addEventListener('change', reset));
      next.addEventListener('click', async () => {
        const choice = read();
        next.disabled = true;
        try {
          if (reviewed) {
            if (sponsored) await act({ op: 'request', parish: pid, ...reviewed, note: el.querySelector('#pc-note').value.trim() }, L('Request sent to the diocese', 'أُرسل الطلب إلى الأبرشية'));
            else await act({ op: 'activate', parish: pid, ...reviewed, confirmRemoval: true }, L('Plan changed', 'تغيّرت الخطة'));
            closeOverlays(); return;
          }
          const preview = await api('plans', 'POST', { op: 'preview', parish: pid, ...choice });
          const pending = Object.entries(preview.pending);
          box.innerHTML = `<div class="alert ${preview.removed.length ? 'alert-warning' : 'alert-info'}">${icon(preview.removed.length ? 'warn' : 'info', 18)}<span>
            ${preview.added.length ? `<b>${L('Switched on', 'تُفعَّل')}:</b> ${preview.added.map(moduleName).map(esc).join(', ')}<br>` : ''}
            ${preview.removed.length ? `<b>${L('Switched off', 'تُوقَف')}:</b> ${preview.removed.map(moduleName).map(esc).join(', ')}<br>${L('Their records stay, and nothing waiting is cancelled.', 'تبقى سجلّاتها، ولا يُلغى شيء منتظر.')}` : ''}
            ${pending.length ? `<br>${L('Still waiting and kept', 'ما زال ينتظر ويبقى')}: ${pending.map(([m, n]) => `${esc(moduleName(m))} (${n})`).join(', ')}` : ''}
            ${!preview.added.length && !preview.removed.length ? L('Nothing changes.', 'لا شيء يتغيّر.') : ''}</span></div>`;
          reviewed = choice;
          next.textContent = sponsored ? L('Send the request', 'إرسال الطلب') : L('Confirm the change', 'تأكيد التغيير');
        } catch (err) { toast(L('Not done', 'لم يتمّ'), err.message, 'danger'); }
        finally { next.disabled = false; }
      });
    } });
}

function arrangementDrawer(did, aid) {
  const d = P(), x = d.dioceses.find(y => y.id === did), a = x.arrangements.find(y => y.id === aid);
  const parishes = d.parishes.filter(p => p.diocese === did && p.sponsor);
  openDrawer({ title: a ? L('Edit arrangement', 'تعديل الترتيب') : L('New diocesan arrangement', 'ترتيب أبرشي جديد'), sub: x.name,
    body: `<div class="formrow"><label class="label" for="pa-name">${L('Name', 'الاسم')} <span class="req">*</span></label><input class="input" id="pa-name" maxlength="120" value="${esc(a?.name || '')}"></div>
      ${moduleForm('pa', a?.bundle || null, a?.modules || ['presence'])}
      <fieldset class="formrow"><legend class="label">${L('Parishes covered', 'الرعايا المشمولة')}</legend>${parishes.map(p => `<label class="check"><input type="checkbox" name="pa-parish" value="${esc(p.id)}" ${a?.parishes.includes(p.id) ? 'checked' : ''}><span>${esc(L(p.name, p.ar || p.name))}${p.plan.arrangement && p.plan.arrangement !== aid ? ` <small class="dim">${L('(in another arrangement)', '(ضمن ترتيب آخر)')}</small>` : ''}</span></label>`).join('')}</fieldset>
      <div class="formrow"><label class="label" for="pa-note">${L('Note (optional)', 'ملاحظة (اختياري)')}</label><textarea class="textarea" id="pa-note" rows="2" maxlength="500">${esc(a?.note || '')}</textarea></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="pa-save">${L('Save', 'حفظ')}</button>`,
    onMount(el) {
      const read = wireModuleForm(el, 'pa');
      const save = async (confirmRemoval = false) => {
        const body = { op: 'arrangementSave', diocese: did, id: aid || undefined, name: el.querySelector('#pa-name').value.trim(), note: el.querySelector('#pa-note').value.trim(),
          parishes: [...el.querySelectorAll('[name=pa-parish]:checked')].map(i => i.value), ...read(), confirmRemoval };
        try { await act(body, L('Arrangement saved', 'حُفظ الترتيب')); closeOverlays(); }
        catch (err) {
          if (!confirmRemoval && /Confirm switching/.test(err.message)) openModal({ title: L('Switch modules off for some parishes?', 'إيقاف وحدات لبعض الرعايا؟'),
            body: `<p>${L('Some of these parishes have modules this arrangement does not include. Those modules will be switched off for them; their records and waiting requests are kept.', 'لدى بعض هذه الرعايا وحدات لا يشملها هذا الترتيب. ستُوقف لديها؛ وتبقى سجلّاتها وطلباتها المنتظرة.')}</p>`,
            foot: `<button class="btn btn-secondary" data-close>${L('Go back', 'رجوع')}</button><button class="btn btn-primary" id="pa-confirm">${L('Switch them off', 'إيقافها')}</button>`,
            onMount(m) { m.querySelector('#pa-confirm').addEventListener('click', () => save(true)); } });
          else toast(L('Not saved', 'لم يُحفظ'), err.message, 'danger');
        }
      };
      el.querySelector('#pa-save').addEventListener('click', () => save());
    } });
}

function bundleDrawer(bid) {
  const b = P().bundles.find(x => x.id === bid);
  openDrawer({ title: b ? L('Edit bundle', 'تعديل الباقة') : L('New bundle', 'باقة جديدة'),
    sub: L('No prices, limits or billing periods are set here.', 'لا تُحدَّد هنا أسعار ولا حدود ولا فترات فوترة.'),
    body: `<div class="formgrid"><div class="formrow"><label class="label" for="pb-name">${L('Name', 'الاسم')} <span class="req">*</span></label><input class="input" id="pb-name" maxlength="80" value="${esc(b?.name || '')}"></div>
      <div class="formrow"><label class="label" for="pb-name-ar">${L('Arabic name', 'الاسم بالعربية')}</label><input class="input" id="pb-name-ar" dir="rtl" maxlength="80" value="${esc(b?.nameAr || '')}"></div></div>
      <div class="formrow"><label class="label" for="pb-desc">${L('Description', 'الوصف')}</label><textarea class="textarea" id="pb-desc" rows="2" maxlength="400">${esc(b?.description || '')}</textarea></div>
      <div class="formrow"><label class="label" for="pb-desc-ar">${L('Arabic description', 'الوصف بالعربية')}</label><textarea class="textarea" id="pb-desc-ar" dir="rtl" rows="2" maxlength="400">${esc(b?.descriptionAr || '')}</textarea></div>
      <fieldset class="formrow"><legend class="label">${L('Modules', 'الوحدات')}</legend>${P().modules.map(m => `<label class="check"><input type="checkbox" name="pb-module" value="${esc(m.id)}" ${m.always || b?.modules.includes(m.id) ? 'checked' : ''} ${m.always ? 'disabled' : ''}><span>${esc(L(m.en, m.ar))}</span></label>`).join('')}</fieldset>
      <label class="check"><input type="checkbox" id="pb-demo" ${!b || b.demo ? 'checked' : ''}><span>${L('Demonstration configuration (shown as such everywhere)', 'إعداد للعرض (يظهر هكذا في كل مكان)')}</span></label>
      <p class="help">${L('Leave this ticked until the bundle is an approved package.', 'أبقِ هذا محدداً إلى أن تصبح الباقة معتمدة.')}</p>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="pb-save">${L('Save', 'حفظ')}</button>`,
    onMount(el) {
      el.querySelector('#pb-save').addEventListener('click', async () => {
        try {
          await act({ op: 'bundleSave', id: bid || undefined, name: el.querySelector('#pb-name').value.trim(), nameAr: el.querySelector('#pb-name-ar').value.trim(),
            description: el.querySelector('#pb-desc').value.trim(), descriptionAr: el.querySelector('#pb-desc-ar').value.trim(),
            modules: [...el.querySelectorAll('[name=pb-module]:checked')].map(x => x.value), demo: el.querySelector('#pb-demo').checked }, L('Bundle saved', 'حُفظت الباقة'));
          closeOverlays();
        } catch (err) { toast(L('Not saved', 'لم يُحفظ'), err.message, 'danger'); }
      });
    } });
}

export function mountPlans(host) {
  const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(L('Not done', 'لم يتمّ'), e.message, 'danger'); } };
  host.querySelectorAll('[data-plan-change]').forEach(b => b.addEventListener('click', () => changePlan(b.dataset.planChange)));
  host.querySelectorAll('[data-plan-withdraw]').forEach(b => b.addEventListener('click', guard(async () => {
    const [parish, id] = b.dataset.planWithdraw.split(':'); await act({ op: 'withdrawRequest', parish, id }, L('Request withdrawn', 'سُحب الطلب'));
  })));
  host.querySelectorAll('[data-plan-decide]').forEach(b => b.addEventListener('click', () => {
    const [parish, id, decision] = b.dataset.planDecide.split(':');
    openModal({ title: decision === 'approve' ? L('Approve this change?', 'الموافقة على هذا التغيير؟') : L('Decline this change?', 'رفض هذا التغيير؟'),
      body: `<div class="formrow"><label class="label" for="pd-note">${L('Note to the parish (optional)', 'ملاحظة للرعية (اختياري)')}</label><textarea class="textarea" id="pd-note" rows="3" maxlength="500"></textarea></div>`,
      foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="pd-go">${decision === 'approve' ? L('Approve', 'موافقة') : L('Decline', 'رفض')}</button>`,
      onMount(el) { el.querySelector('#pd-go').addEventListener('click', guard(async () => {
        await act({ op: 'decideRequest', parish, id, decision, note: el.querySelector('#pd-note').value.trim() }, decision === 'approve' ? L('Approved', 'تمت الموافقة') : L('Declined', 'رُفض'));
        closeOverlays();
      })); } });
  }));
  host.querySelectorAll('[data-plan-arrangement]').forEach(b => b.addEventListener('click', () => { const [did, aid] = b.dataset.planArrangement.split(':'); arrangementDrawer(did, aid || null); }));
  host.querySelectorAll('[data-plan-end]').forEach(b => b.addEventListener('click', () => openModal({ title: L('End this arrangement?', 'إنهاء هذا الترتيب؟'),
    body: `<p>${L('Each parish keeps its current modules and manages its plan itself from now on.', 'تحتفظ كل رعية بوحداتها الحالية وتدير خطتها بنفسها من الآن.')}</p>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="pe-go">${L('End arrangement', 'إنهاء الترتيب')}</button>`,
    onMount(el) { el.querySelector('#pe-go').addEventListener('click', guard(async () => { await act({ op: 'arrangementEnd', id: b.dataset.planEnd }, L('Arrangement ended', 'انتهى الترتيب')); closeOverlays(); })); } })));
  host.querySelectorAll('[data-plan-bundle]').forEach(b => b.addEventListener('click', () => bundleDrawer(b.dataset.planBundle || null)));
  host.querySelectorAll('[data-plan-retire]').forEach(b => b.addEventListener('click', guard(async () => {
    await act({ op: 'bundleRetire', id: b.dataset.planRetire, retire: b.dataset.retire === 'true' }, L('Saved', 'حُفظ'));
  })));
  host.querySelector('#plan-presence-docs')?.addEventListener('change', guard(async e => {
    await act({ op: 'setPresenceDocuments', value: e.target.value }, L('Decision saved', 'حُفظ القرار'));
  }));
}
