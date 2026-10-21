/* Appearance: each account's own dashboard colours and light or dark mode, previewed live and saved to the
   account. Nobody else's screens change, and the public website keeps its one shared theme. */
import { api, session } from '../api.js';
import { t } from '../i18n.js';
import { S, bus } from '../store.js';
import { esc, toast } from '../ui.js';
import { icon } from '../icons.js';
import { SCHEMES, MODES, schemeOf, palette, darkPalette, readable, applyTheme, isHex, resolvedMode } from '../theme.js';

const L = (en, ar) => t(en, ar);
const saved = () => ({ ...schemeOf(session.user?.theme), mode: MODES.includes(session.user?.theme?.mode) ? session.user.theme.mode : 'light' });
const draft = () => S.themeDraft || saved();
const same = (a, b) => schemeOf(a).id === schemeOf(b).id && schemeOf(a).primary === schemeOf(b).primary && a.mode === b.mode;
const MODE_NAMES = { light: ['Light', 'فاتح'], dark: ['Dark', 'داكن'], system: ['Same as this device', 'مثل هذا الجهاز'] };

const SAMPLE = `<i class="ss-rail"><i></i><i></i><i></i></i>
      <i class="ss-page"><i class="ss-line"></i><i class="ss-line short"></i><i class="ss-chip"></i><i class="ss-btn"></i></i>`;
const swatches = (primary, mode) => {
  if (resolvedMode(mode) === 'dark') { const p = darkPalette(primary); return { '--sw-1': p.primary, '--sw-2': p.muted, '--sw-3': p.selection, '--sw-4': p.bg }; }
  const p = palette(primary); return { '--sw-1': p.primary, '--sw-2': p.muted, '--sw-3': p.selection, '--sw-4': p.bg };
};
const styleOf = vars => Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');

function schemeCard(scheme, chosen, wheel = false) {
  const on = chosen.id === scheme.id;
  return `<label class="scheme-card${on ? ' on' : ''}" style="${styleOf(swatches(scheme.primary, chosen.mode))}">
    <input type="radio" name="scheme" value="${scheme.id}" class="sr" ${on ? 'checked' : ''}>
    <span class="scheme-sample${wheel ? ' wheel' : ''}" aria-hidden="true">${wheel ? `<i class="ss-wheel">${icon('plus', 18)}</i>` : SAMPLE}</span>
    <span class="scheme-name">${esc(L(scheme.en, scheme.ar))}${on ? `<span class="scheme-tick">${icon('check', 15)}</span>` : ''}</span>
  </label>`;
}
const customNote = (picked, shown) => picked.toUpperCase() === shown
  ? L('Good choice — text reads clearly with this colour.', 'اختيار جيد — النص واضح مع هذا اللون.')
  : L(`This colour is quite light, so it is shown a little darker (${shown}) to keep text readable.`, `هذا اللون فاتح بعض الشيء، لذا يظهر أغمق قليلاً (${shown}) ليبقى النص مقروءاً.`);
const stateText = changed => changed ? L('You are previewing these colours. Save them to keep them on every device you sign in on.', 'أنت تعاين هذه الألوان. احفظها لتبقى على كل جهاز تسجّل الدخول منه.')
  : L('These are your saved colours. Only you see them.', 'هذه ألوانك المحفوظة. لا يراها أحد سواك.');

export function appearancePanel() {
  const chosen = draft(), kept = saved();
  const custom = chosen.id === 'custom' ? chosen : { id: 'custom', en: 'Your own colour', ar: 'لونك الخاص', primary: kept.id === 'custom' ? kept.primary : '#7A2E3A' };
  return `<p class="t-body dim scheme-intro">${L('Choose how your own screens look. Your choice does not change anyone else’s screens or the public parish pages, which share one website theme.',
      'اختر شكل شاشاتك أنت. لا يغيّر اختيارك شاشات أي شخص آخر ولا صفحات الرعايا العامة التي تتشارك سمة موقع واحدة.')}</p>
    <fieldset class="formrow"><legend class="label">${L('Mode', 'الوضع')}</legend><div class="seg" role="radiogroup">
      ${MODES.map(m => `<label class="seg-radio"><input type="radio" name="th-mode" value="${m}" ${chosen.mode === m ? 'checked' : ''}><span>${L(...MODE_NAMES[m])}</span></label>`).join('')}</div></fieldset>
    <fieldset class="scheme-grid"><legend class="label">${L('Colour scheme', 'نظام الألوان')}</legend>
      ${SCHEMES.map(scheme => schemeCard(scheme, chosen)).join('')}
      ${schemeCard({ ...custom, en: 'Your own colour', ar: 'لونك الخاص' }, chosen, chosen.id !== 'custom' && kept.id !== 'custom')}
    </fieldset>
    <div class="scheme-custom" id="th-custom" ${chosen.id === 'custom' ? '' : 'hidden'}>
      <label class="label" for="th-color">${L('Your colour', 'لونك')}</label>
      <div class="scheme-custom-row">
        <input type="color" id="th-color" value="${esc(custom.primary.toLowerCase())}" aria-describedby="th-note">
        <input class="input mono" id="th-hex" value="${esc(custom.primary)}" maxlength="7" dir="ltr" spellcheck="false" autocomplete="off" aria-label="${L('Colour code', 'رمز اللون')}" aria-describedby="th-note">
      </div>
      <p class="help" id="th-note" aria-live="polite">${customNote(custom.primary, readable(custom.primary))}</p>
    </div>
    <p class="help">${L('Text, focus outlines and status colours are checked for contrast in light and dark mode.', 'تُفحص ألوان النص وحدود التركيز وألوان الحالات لضمان التباين في الوضعين الفاتح والداكن.')}</p>
    <div class="scheme-actions">
      <button class="btn btn-primary" id="th-save" ${same(chosen, kept) ? 'disabled' : ''}>${icon('check', 17)}${L('Save my colours', 'حفظ ألواني')}</button>
      <button class="btn btn-secondary" id="th-undo" ${same(chosen, kept) ? 'disabled' : ''}>${L('Discard', 'تجاهل')}</button>
      <span class="t-caption dim" id="th-state" aria-live="polite">${stateText(!same(chosen, kept))}</span></div>`;
}

export function wireAppearance(host) {
  if (!host.querySelector('#th-save')) return;
  applyTheme(draft());
  const preview = next => {
    S.themeDraft = same(next, saved()) ? null : { id: next.id, en: next.en, ar: next.ar, primary: next.primary, mode: next.mode };
    const shown = draft();
    applyTheme(shown);
    host.querySelectorAll('.scheme-card').forEach(card => {
      const input = card.querySelector('input'), on = input.value === shown.id;
      const primary = input.value === 'custom' ? host.querySelector('#th-hex').value : SCHEMES.find(s => s.id === input.value)?.primary;
      if (isHex(primary)) Object.entries(swatches(primary, shown.mode)).forEach(([k, v]) => card.style.setProperty(k, v));
      card.classList.toggle('on', on);
      card.querySelector('.scheme-tick')?.remove();
      if (on) card.querySelector('.scheme-name').insertAdjacentHTML('beforeend', `<span class="scheme-tick">${icon('check', 15)}</span>`);
    });
    host.querySelector('#th-custom').hidden = shown.id !== 'custom';
    const changed = !!S.themeDraft;
    host.querySelector('#th-save').disabled = host.querySelector('#th-undo').disabled = !changed;
    host.querySelector('#th-state').textContent = stateText(changed);
  };
  const customCard = host.querySelector('.scheme-card input[value=custom]').closest('.scheme-card');
  const mode = () => host.querySelector('input[name=th-mode]:checked')?.value || 'light';
  const setCustom = (color, from) => {
    const value = color.toUpperCase();
    if (from !== 'hex') host.querySelector('#th-hex').value = value;
    if (from !== 'color') host.querySelector('#th-color').value = value.toLowerCase();
    const sample = customCard.querySelector('.scheme-sample');
    if (sample.classList.contains('wheel')) { sample.classList.remove('wheel'); sample.innerHTML = SAMPLE; }
    host.querySelector('#th-note').textContent = customNote(value, readable(value));
    customCard.querySelector('input').checked = true;
    preview({ id: 'custom', en: 'Custom colour', ar: 'لون مخصّص', primary: value, mode: mode() });
  };
  host.querySelectorAll('.scheme-card input').forEach(input => input.addEventListener('change', () => {
    if (input.value === 'custom') return setCustom(host.querySelector('#th-hex').value);
    preview({ ...SCHEMES.find(scheme => scheme.id === input.value), mode: mode() });
  }));
  host.querySelectorAll('input[name=th-mode]').forEach(r => r.addEventListener('change', () => preview({ ...draft(), mode: r.value })));
  let frame = 0;
  host.querySelector('#th-color').addEventListener('input', e => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setCustom(e.target.value, 'color')); });
  host.querySelector('#th-hex').addEventListener('input', e => {
    let value = e.target.value.trim(); if (value && value[0] !== '#') value = '#' + value;
    const ok = isHex(value);
    e.target.setAttribute('aria-invalid', ok || value.length < 7 ? 'false' : 'true');
    if (ok) setCustom(value, 'hex');
  });
  host.querySelector('#th-undo').addEventListener('click', () => { S.themeDraft = null; applyTheme(saved()); bus.refresh(); });
  host.querySelector('#th-save').addEventListener('click', async e => {
    const next = draft();
    e.currentTarget.disabled = true;
    try {
      const result = await api('account', 'POST', { op: 'saveTheme', theme: { scheme: next.id, primary: next.primary.toUpperCase(), mode: next.mode } });
      session.user.theme = result.theme; S.themeDraft = null; applyTheme(saved()); bus.refresh();
      toast(L('Colours saved', 'حُفظت الألوان'), L('Only your own screens use them.', 'لا تستعملها إلا شاشاتك أنت.'), 'success');
    } catch (error) { e.currentTarget.disabled = false; toast(L('Not saved', 'لم يُحفظ'), error.message, 'danger'); }
  });
}
