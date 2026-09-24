/* Shared rendering helpers. Views build HTML strings; these keep the markup
   consistent with the design system so a card never grows a fifth radius. */
import { icon } from './icons.js';
import { t, isAr, usd, lbp, num, fmtDate } from './i18n.js';
import { RATE, PHOTOS, initials, person } from './data.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ---------- page furniture ---------- */
export function pageHead({ crumbs = [], title, sub, actions = '' }) {
  const cr = crumbs.map((c, i) =>
    `${i ? '<span class="sep">/</span>' : ''}${c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`}`
  ).join('');
  return `<div class="pagehead">
    <div>
      ${cr ? `<nav class="crumbs" aria-label="Breadcrumb">${cr}</nav>` : ''}
      <h1>${esc(title)}</h1>
      ${sub ? `<p class="sub">${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="acts">${actions}</div>` : ''}
  </div>`;
}

/** Tab bar whose tabs are real routes, so a tab is linkable and survives reload.
    items: [[slug, en, ar, count?]] — slug '' is the default tab. */
export function tabBar(base, items, active = '') {
  return `<div class="tabs" role="tablist">${items.map(([slug, en, ar, n]) => {
    const on = (slug || '') === (active || '');
    return `<button role="tab" aria-selected="${on}" data-go="${base}${slug ? '/' + slug : ''}">
      ${esc(t(en, ar))}${n != null ? `<span class="n">${esc(String(n))}</span>` : ''}</button>`;
  }).join('')}</div>`;
}

export const sectionH = (title, more = '') =>
  `<div class="section-h"><h2>${esc(title)}</h2>${more ? `<div class="more">${more}</div>` : ''}</div>`;

/* ---------- atoms ---------- */
/** Initials, or the person's photo when one has been uploaded. key overrides the photo slot (e.g. 'parish'). */
export const avatar = (p, cls = '', key = p?.id) => PHOTOS[key]
  ? `<span class="avatar has-photo ${cls}" style="background-image:url(${PHOTOS[key]})" aria-hidden="true"></span>`
  : `<span class="avatar ${cls}" aria-hidden="true">${esc(initials(p))}</span>`;

/** Bilingual name pair — the Arabic record leads in Arabic, the Latin in English. */
export function who(p, { avatarCls = '' } = {}) {
  if (!p) return `<span class="dimmer">—</span>`;
  const lead = isAr() ? p.ar : p.lat, sub = isAr() ? p.lat : p.ar;
  return `<span class="who">${avatar(p, avatarCls)}<span class="truncate">
    <b>${esc(lead)}</b><small>${esc(sub)}</small></span></span>`;
}

/* Status badges: a toned pill carries the icon for what it means (the Status Badges UI Kit set:
   Success, Failed, Pending, In review, Progress, Submitted, Expire); a neutral one keeps the dot.
   mark: true for the tone's icon, an icon name to choose one, false for none. */
const TONE_ICON = { success: 'st-ok', warning: 'st-alert', danger: 'st-no', info: 'info' };
export const pill = (label, tone = '', mark = true) => {
  const ic = typeof mark === 'string' ? mark : mark && TONE_ICON[tone];
  return `<span class="pill ${tone ? 'pill-' + tone : ''}">${ic ? icon(ic, 14, 'sticon') : mark ? '<span class="dot"></span>' : ''}${esc(label)}</span>`;
};

/** Status is never carried by colour alone: every pill pairs a dot with a word. */
const STATUS = {
  approved:      ['Approved', 'موافَق عليه', 'success', 'st-ok'],
  registered:    ['Registered', 'مسجَّل', 'success', 'st-ok'],
  accepted:      ['Accepted', 'مقبول', 'success', 'st-ok'],
  sent:          ['Sent', 'أُرسلت', 'success', 'st-sent'],
  paid:          ['Paid', 'مدفوع', 'success', 'st-ok'],
  closed:        ['Closed', 'مقفلة', 'success', 'st-ok'],
  member:        ['Member', 'منتسب', 'success', 'st-ok'],
  ready:         ['Ready', 'جاهز', 'success', 'st-ok'],
  open:          ['Open', 'مفتوحة', 'info', 'st-open'],
  scheduled:     ['Scheduled', 'مجدوَل', 'info', 'st-wait'],
  draft:         ['Draft', 'مسوّدة', 'info', 'st-open'],
  visitor:       ['Visitor', 'زائر', 'info', 'people'],
  clergy:        ['Clergy', 'إكليروس', 'info', 'sacr'],
  pending:       ['Pending', 'قيد الانتظار', 'warning', 'st-alert'],
  'awaiting-approval': ['Awaiting approval', 'بانتظار الموافقة', 'warning', 'st-review'],
  'awaiting-signature':['Awaiting signature', 'بانتظار التوقيع', 'warning', 'st-review'],
  unfilled:      ['Unfilled', 'شاغر', 'warning', 'st-alert'],
  conflict:      ['Conflict', 'تعارض', 'danger', 'st-alert'],
  rejected:      ['Rejected', 'مرفوض', 'danger', 'st-no'],
  declined:      ['Declined', 'اعتذر', 'danger', 'st-no'],
  failed:        ['Failed', 'فشل الإرسال', 'danger', 'st-no']
};
export function status(key) {
  const s = STATUS[key];
  return s ? pill(t(s[0], s[1]), s[2], s[3]) : pill(key);
}

/** USD leads at full size, LBP follows in mono, and the rate travels with it. */
export function amount(dollars, { showRate = false, cls = '' } = {}) {
  return `<span class="amount ${cls}" dir="ltr">
    <span class="usd">${usd(dollars)}</span>
    <span class="lbp">${lbp(dollars * RATE.value)}</span>
    ${showRate ? `<span class="rate">at ${num(RATE.value)} · ${fmtDate(RATE.setOn)}</span>` : ''}
  </span>`;
}

export const stat = (k, v, d = '') =>
  `<div class="stat"><span class="k">${esc(k)}</span><span class="v">${v}</span>${d ? `<span class="d">${d}</span>` : ''}</div>`;

export const btn = (label, { kind = 'secondary', ico = '', attrs = '', size = '' } = '') =>
  `<button class="btn btn-${kind} ${size}" ${attrs}>${ico ? icon(ico, 17) : ''}${esc(label)}</button>`;

export const searchField = (ph, attrs = '') =>
  `<div class="search">${icon('search', 17)}<input class="input" type="search" placeholder="${esc(ph)}" ${attrs}></div>`;

export const empty = (glyph, title, body, action = '') =>
  `<div class="empty"><span class="glyph">${icon(glyph, 26)}</span>
   <h3>${esc(title)}</h3><p>${esc(body)}</p>${action ? `<div class="acts">${action}</div>` : ''}</div>`;

export const panel = (title, body, { more = '', tight = false } = {}) =>
  `<section class="panel">
     ${title ? `<div class="panel-h"><h3>${esc(title)}</h3>${more ? `<div class="more">${more}</div>` : ''}</div>` : ''}
     <div class="panel-b ${tight ? 'tight' : ''}">${body}</div>
   </section>`;

/** Data table: sticky header, optional selection, sort, expandable rows and
    hover row-actions. cols:[{label,cls,sort}] rows:[{cells,detail,cls,attrs}] */
export function table({ cols, rows, foot = '', pick = false, empty: emptyMsg = '', id = 'tbl' }) {
  if (!rows.length) return `<div class="tablewrap">${emptyMsg || empty('search',
    t('Nothing matches those filters', 'لا شيء يطابق هذه المرشّحات'),
    t('Try clearing one of them, or add the first record.', 'جرّب إزالة أحدها، أو أضف السجل الأول.'))}</div>`;

  const head = `<tr>${pick ? `<th class="pick"><label class="check"><input type="checkbox" data-all></label></th>` : ''}
    ${cols.map((c, i) => `<th class="${c.cls || ''} ${c.sort ? 'sortable' : ''}" ${c.sort ? `data-sort="${i}" tabindex="0"` : ''}>
      ${esc(c.label)}${c.sort ? '<span class="arrow">⇅</span>' : ''}</th>`).join('')}</tr>`;

  const body = rows.map((r, ri) => {
    const cells = (r.cells || r);
    const main = `<tr class="${r.cls || ''}" data-ri="${ri}" ${r.attrs || ''}>
      ${pick ? `<td class="pick"><label class="check"><input type="checkbox" data-row></label></td>` : ''}
      ${cells.map((c, i) => `<td class="${cols[i]?.cls || ''}">${c}</td>`).join('')}</tr>`;
    const det = r.detail ? `<tr class="detail" data-detail="${ri}" hidden>
      <td colspan="${cells.length + (pick ? 1 : 0)}">${r.detail}</td></tr>` : '';
    return main + det;
  }).join('');

  return `<div class="tablewrap" data-table="${id}"><div class="tablescroll"><table class="tbl">
    <thead>${head}</thead><tbody>${body}</tbody>
  </table></div>${foot ? `<div class="tablefoot">${foot}</div>` : ''}</div>`;
}

/** Wire selection, sorting and expandable rows for every table in host. */
export function wireTables(host, { onBulk } = {}) {
  host.querySelectorAll('[data-table]').forEach(wrap => {
    const all = wrap.querySelector('[data-all]');
    const rows = [...wrap.querySelectorAll('[data-row]')];
    const sync = () => {
      const n = rows.filter(r => r.checked).length;
      if (all) { all.checked = n === rows.length && n > 0; all.indeterminate = n > 0 && n < rows.length; }
      onBulk?.(n, wrap);
    };
    all?.addEventListener('change', () => { rows.forEach(r => { r.checked = all.checked; }); sync(); });
    rows.forEach(r => r.addEventListener('change', sync));

    wrap.querySelectorAll('[data-sort]').forEach(th => {
      const go = () => {
        const i = +th.dataset.sort;
        const dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
        wrap.querySelectorAll('[data-sort]').forEach(x => x.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', dir);
        const tb = wrap.querySelector('tbody');
        const pickOffset = wrap.querySelector('[data-all]') ? 1 : 0;
        const trs = [...tb.querySelectorAll('tr:not(.detail)')];
        trs.sort((a, b) => {
          const av = a.children[i + pickOffset]?.textContent.trim() || '';
          const bv = b.children[i + pickOffset]?.textContent.trim() || '';
          const an = parseFloat(av.replace(/[^\d.-]/g, '')), bn = parseFloat(bv.replace(/[^\d.-]/g, ''));
          const r = (!isNaN(an) && !isNaN(bn)) ? an - bn : av.localeCompare(bv, isAr() ? 'ar' : 'en');
          return dir === 'ascending' ? r : -r;
        });
        trs.forEach(tr => { tb.append(tr);
          const d = tb.querySelector(`[data-detail="${tr.dataset.ri}"]`); if (d) tb.append(d); });
      };
      th.addEventListener('click', go);
      th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });

    wrap.querySelectorAll('[data-expand]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const tr = b.closest('tr'), det = wrap.querySelector(`[data-detail="${tr.dataset.ri}"]`);
      if (!det) return;
      det.hidden = !det.hidden;
      tr.classList.toggle('expanded', !det.hidden);
      b.setAttribute('aria-expanded', String(!det.hidden));
    }));
  });
}

/* Every control is wired by its view, its verb (data-act) or its component. This
   only flags a button that slipped through, in the console, so it is caught in
   development instead of shipping as a dead click. */
const SELF_WIRED = '.seg,.bgroup,.presets,.tabs,.stepper,.chipfield,.rte-bar,.langswap,.dp,.check,.switch,.menu,.ac-list';

export function catchAll(host) {
  host.querySelectorAll('button').forEach(b => {
    if (b.dataset.wired || b.id || b.hasAttribute('onclick') || b.disabled) return;
    if ([...b.attributes].some(a => a.name.startsWith('data-') && a.name !== 'data-tip')) return;
    if (b.closest(SELF_WIRED)) return;
    b.dataset.wired = '1';
    console.warn('ParishLife: button without a handler —', b.textContent.trim() || b.getAttribute('aria-label') || b.outerHTML.slice(0, 80));
  });
}

/* ---------- overlays ---------- */

let drawerEl, modalEl, scrimEl, lastFocus, gen = 0;   // gen: a close only empties the overlays if nothing opened since

function ensureOverlays() {
  if (scrimEl) return;
  scrimEl = Object.assign(document.createElement('div'), { className: 'scrim' });
  drawerEl = Object.assign(document.createElement('aside'), { className: 'drawer' });
  drawerEl.setAttribute('role', 'dialog'); drawerEl.setAttribute('aria-modal', 'true');
  modalEl = Object.assign(document.createElement('div'), { className: 'modal' });
  modalEl.setAttribute('role', 'dialog'); modalEl.setAttribute('aria-modal', 'true');
  document.body.append(scrimEl, drawerEl, modalEl);
  scrimEl.addEventListener('click', closeOverlays);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlays(); });
}

export function closeOverlays() {
  if (!scrimEl) return;
  /* Never leave focus stranded on an element that is about to be hidden. */
  const back = lastFocus; lastFocus = null;
  if (back && back.isConnected && back !== document.body) back.focus();
  else document.getElementById('well')?.focus();
  scrimEl.classList.remove('open');
  drawerEl.classList.remove('open', 'drawer-lg');
  modalEl.classList.remove('open');
  const g = ++gen;
  setTimeout(() => { if (g === gen) { drawerEl.innerHTML = ''; modalEl.innerHTML = ''; } }, 260);
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
/* Move focus into the dialog and keep Tab inside it — a drawer the keyboard
   can tab out of behind the scrim is worse than no drawer. */
function focusFirst(host) {
  const els = [...host.querySelectorAll(FOCUSABLE)];
  (els.find(e => !e.hasAttribute('data-close')) || els[0])?.focus();
  host.onkeydown = e => {
    if (e.key !== 'Tab') return;
    const f = [...host.querySelectorAll(FOCUSABLE)];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
}

function shell(kind, { title, sub = '', body, foot = '' }) {
  return `<div class="${kind}-head">
      <div style="flex:1;min-width:0"><h3>${esc(title)}</h3>${sub ? `<p class="t-caption dim" style="margin-top:4px">${sub}</p>` : ''}</div>
      <button class="iconbtn" data-close aria-label="${t('Close', 'إغلاق')}">${icon('close', 18)}</button>
    </div>
    <div class="${kind}-body">${body}</div>
    ${foot ? `<div class="${kind}-foot">${foot}</div>` : ''}`;
}

export function openDrawer(opts) {
  ensureOverlays();
  lastFocus = document.activeElement;
  drawerEl.classList.toggle('drawer-lg', !!opts.large);
  gen++;
  drawerEl.innerHTML = shell('drawer', opts);
  void drawerEl.offsetWidth;                         // settle the closed state first, so the slide-in still animates
  scrimEl.classList.add('open'); drawerEl.classList.add('open');
  drawerEl.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeOverlays));
  focusFirst(drawerEl);
  opts.onMount?.(drawerEl);
  wireOverlay(drawerEl);

}

export function openModal(opts) {
  ensureOverlays();
  lastFocus = document.activeElement;
  gen++;
  modalEl.innerHTML = `<div class="sheet">${shell('modal', opts)}</div>`;
  void modalEl.offsetWidth;
  scrimEl.classList.add('open'); modalEl.classList.add('open');
  modalEl.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeOverlays));
  focusFirst(modalEl);
  opts.onMount?.(modalEl);
  wireOverlay(modalEl);

}

/* Overlays get the same wiring the page does. Imported lazily to keep ui.js
   free of a cycle back through actions.js. */
async function wireOverlay(el) {
  const [{ wireActions }, { enhanceSelects }] = await Promise.all([import('./actions.js'), import('./components.js')]);
  wireActions(el);
  catchAll(el);
  enhanceSelects(el);
}

/* ---------- anchored menu ----------
   Sheet 03: menus open 8px from their trigger, 10px radius, elevation 2, and
   flip upward when there is no room below. Items: {label, icon, fn, danger,
   hint, sep, sub:[items]}. Esc or a click outside closes it. */
let menuEl, menuAnchor;
export function closeMenu() {
  menuEl?.remove(); menuEl = null;
  menuAnchor?.setAttribute('aria-expanded', 'false'); menuAnchor = null;
}
function menuItems(items) {
  return items.map((it, i) => it.sep ? '<div class="sep"></div>'
    : it.head ? `<div class="head">${esc(it.head)}</div>`
    : `<button type="button" class="${it.danger ? 'danger' : ''} ${it.sub ? 'hassub' : ''}" data-mi="${i}" role="menuitem">
        ${it.icon ? icon(it.icon, 16) : ''}<span style="flex:1">${esc(it.label)}</span>
        ${it.hint ? `<span class="t-caption dimmer">${esc(it.hint)}</span>` : ''}
        ${it.sub ? icon('chevR', 14) : ''}</button>`).join('');
}
export function openMenu(anchor, items, { width = 220 } = {}) {
  if (menuAnchor === anchor) return closeMenu();
  closeMenu();
  menuAnchor = anchor; anchor.setAttribute('aria-expanded', 'true');
  menuEl = document.createElement('div');
  menuEl.className = 'menu'; menuEl.setAttribute('role', 'menu');
  menuEl.style.width = width + 'px';
  menuEl.innerHTML = menuItems(items);
  document.body.append(menuEl);

  const r = anchor.getBoundingClientRect(), mh = menuEl.offsetHeight, mw = menuEl.offsetWidth;
  const rtl = document.documentElement.dir === 'rtl';
  let top = r.bottom + 8;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 8);
  let left = rtl ? r.left : r.right - mw;
  left = Math.min(Math.max(8, left), innerWidth - mw - 8);
  Object.assign(menuEl.style, { position: 'fixed', top: top + 'px', left: left + 'px', zIndex: 140 });

  menuEl.querySelectorAll('[data-mi]').forEach(b => {
    const it = items[+b.dataset.mi];
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (it.sub) {
        menuEl.querySelector('.submenu')?.remove();
        const sm = document.createElement('div');
        sm.className = 'menu submenu'; sm.style.width = width + 'px';
        sm.innerHTML = menuItems(it.sub);
        const br = b.getBoundingClientRect();
        let sl = rtl ? br.left - width - 4 : br.right + 4;
        if (sl + width > innerWidth - 8) sl = br.left - width - 4;
        if (sl < 8) sl = br.right + 4;
        Object.assign(sm.style, { position: 'fixed', top: br.top - 6 + 'px', left: sl + 'px', zIndex: 141 });
        menuEl.append(sm);
        sm.querySelectorAll('[data-mi]').forEach(sb => sb.addEventListener('click', ev => {
          ev.stopPropagation(); const sit = it.sub[+sb.dataset.mi]; closeMenu(); sit.fn?.();
        }));
        return;
      }
      closeMenu(); it.fn?.();
    });
  });
  menuEl.querySelector('[data-mi]')?.focus();
}
document.addEventListener('click', e => {
  if (menuEl && !menuEl.contains(e.target) && !menuAnchor?.contains(e.target)) closeMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
addEventListener('hashchange', closeMenu);

/** An anchored card (notifications, account) — same placement rules as a menu. */
export function openPopover(anchor, html, { width = 340, onMount } = {}) {
  if (menuAnchor === anchor) return closeMenu();
  closeMenu();
  menuAnchor = anchor; anchor.setAttribute('aria-expanded', 'true');
  menuEl = document.createElement('div');
  menuEl.className = 'popover'; menuEl.setAttribute('role', 'dialog');
  menuEl.style.width = width + 'px';
  menuEl.innerHTML = html;
  document.body.append(menuEl);
  const r = anchor.getBoundingClientRect(), mw = menuEl.offsetWidth;
  const rtl = document.documentElement.dir === 'rtl';
  let left = rtl ? r.left : r.right - mw;
  left = Math.min(Math.max(8, left), innerWidth - mw - 8);
  Object.assign(menuEl.style, { position: 'fixed', top: r.bottom + 8 + 'px', left: left + 'px', zIndex: 140,
    maxHeight: `calc(100vh - ${r.bottom + 24}px)`, overflowY: 'auto', padding: 0 });
  onMount?.(menuEl);
  return menuEl;
}

/* ---------- toast ----------
   Sheet 04: bottom-right in LTR, bottom-left in RTL. 6s auto-dismiss, 10s with
   an action, never for errors. Reversible mutations carry Undo. */
let toastHost;
export function toast(title, body = '', tone = '', { action } = {}) {
  if (!toastHost) {
    toastHost = Object.assign(document.createElement('div'), { className: 'toasts' });
    toastHost.setAttribute('role', 'status'); toastHost.setAttribute('aria-live', 'polite');
    document.body.append(toastHost);
  }
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.innerHTML = `<span class="bar"></span>
    <span class="tbody"><b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ''}
      ${action ? `<span class="act"><button type="button">${esc(action.label)}</button></span>` : ''}</span>
    <button class="iconbtn tclose" type="button" aria-label="${t('Dismiss', 'إغلاق')}">${icon('close', 15)}</button>`;
  toastHost.append(el);
  const kill = () => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; setTimeout(() => el.remove(), 180); };
  el.querySelector('.tclose').addEventListener('click', kill);
  if (action) el.querySelector('.act button').addEventListener('click', () => { action.fn(); kill(); });
  if (tone !== 'danger') setTimeout(kill, action ? 10000 : 6000);
  return kill;
}

export { icon, person };
