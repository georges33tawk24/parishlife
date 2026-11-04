/* Shared rendering pieces. They keep the markup consistent with the design system so a card never
   grows a fifth radius: page furniture, atoms, the data table and its pages, and the overlays
   (drawer, modal, menu, popover, toasts) every flow opens. */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';
import { t, isAr, usd, lbp, num, fmtDate } from '../../lib/i18n.js';
import { RATE, PHOTOS, initials, person } from '../model/data.js';
import { htmlAttrs } from './html.js';
import { Select } from './components.jsx';

/* ---------- page furniture ---------- */
export function PageHead({ crumbs = [], title, sub, actions }) {
  return (
    <div className="pagehead">
      <div>
        {crumbs.length ? (
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                {i ? <span className="sep">/</span> : null}
                {c.href ? <a href={c.href}>{c.label}</a> : <span>{c.label}</span>}
              </Fragment>
            ))}
          </nav>
        ) : null}
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="acts">{actions}</div> : null}
    </div>
  );
}

/** Tab bar whose tabs are real routes, so a tab is linkable and survives reload.
    items: [[slug, en, ar, count?]] — slug '' is the default tab. */
export function TabBar({ base, items, active = '' }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([slug, en, ar, n]) => {
        const on = (slug || '') === (active || '');
        return (
          <button key={slug} role="tab" aria-selected={on} data-go={base + (slug ? '/' + slug : '')}>
            {t(en, ar)}
            {n != null ? <span className="n">{String(n)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export const SectionH = ({ title, more }) => (
  <div className="section-h">
    <h2>{title}</h2>
    {more ? <div className="more">{more}</div> : null}
  </div>
);

/* ---------- atoms ---------- */
/** Initials, or the person's photo when one has been uploaded. slot overrides the photo slot (e.g. 'parish'). */
export function Avatar({ p, cls = '', slot = p?.id }) {
  return PHOTOS[slot] ? (
    <span
      className={'avatar has-photo ' + cls}
      style={{ backgroundImage: `url(${PHOTOS[slot]})` }}
      aria-hidden="true"
    ></span>
  ) : (
    <span className={'avatar ' + cls} aria-hidden="true">
      {initials(p)}
    </span>
  );
}

/** Personal names always show English first, followed by Arabic. */
export function Who({ p, avatarCls = '' }) {
  if (!p) return <span className="dimmer">—</span>;
  const lead = p.lat || p.ar,
    sub = p.ar && p.ar !== lead ? p.ar : ''; // a name typed once (online sign-up) shows once
  return (
    <span className="who">
      <Avatar p={p} cls={avatarCls} />
      <span className="truncate">
        <b>{lead}</b>
        {sub ? <small>{sub}</small> : null}
      </span>
    </span>
  );
}

/* Status badges: a toned pill carries the icon for what it means (the Status Badges UI Kit set:
   Success, Failed, Pending, In review, Progress, Submitted, Expire, plus a Paused drawn to match);
   a neutral one keeps the dot.
   mark: true for the tone's icon, an icon name to choose one, false for none. */
const TONE_ICON = { success: 'st-ok', warning: 'st-alert', danger: 'st-no', info: 'info' };
export function Pill({ label, tone = '', mark = true }) {
  const ic = typeof mark === 'string' ? mark : mark && TONE_ICON[tone];
  return (
    <span className={'pill ' + (tone ? 'pill-' + tone : '')}>
      {ic ? <Icon name={ic} size={14} cls="sticon" /> : mark ? <span className="dot"></span> : null}
      {label}
    </span>
  );
}

/** Status is never carried by colour alone: every pill pairs an icon with a word. */
const STATUS = {
  approved: ['Approved', 'موافَق عليه', 'success', 'st-ok'],
  registered: ['Registered', 'مسجَّل', 'success', 'st-ok'],
  issued: ['Issued', 'صدرت', 'success', 'st-ok'],
  accepted: ['Accepted', 'مقبول', 'success', 'st-ok'],
  sent: ['Sent', 'أُرسلت', 'success', 'st-sent'],
  paid: ['Paid', 'مدفوع', 'success', 'st-ok'],
  closed: ['Closed', 'مقفلة', 'success', 'st-ok'],
  member: ['Member', 'منتسب', 'success', 'st-ok'],
  ready: ['Ready', 'جاهز', 'success', 'st-ok'],
  completed: ['Completed', 'مكتمل', 'success', 'st-ok'],
  celebrated: ['Celebrated', 'تمّ الاحتفال', 'success', 'st-ok'],
  open: ['Open', 'مفتوحة', 'info', 'st-open'],
  requested: ['Request received', 'استُلم الطلب', 'warning', 'st-review'],
  submitted: ['Submitted', 'مُرسَل', 'warning', 'st-review'],
  'office-reviewed': ['Office reviewed', 'راجعه المكتب', 'warning', 'st-review'],
  preparing: ['In preparation', 'قيد التحضير', 'info', 'st-wait'],
  legacy: ['Needs linked record', 'يحتاج قيداً مرتبطاً', 'warning', 'st-alert'],
  scheduled: ['Scheduled', 'مجدوَل', 'info', 'st-wait'],
  draft: ['Draft', 'مسوّدة', 'info', 'st-open'],
  visitor: ['Visitor', 'زائر', 'info', 'people'],
  clergy: ['Clergy', 'إكليروس', 'info', 'sacr'],
  pending: ['Pending', 'قيد الانتظار', 'warning', 'st-alert'],
  'awaiting-approval': ['Awaiting approval', 'بانتظار الموافقة', 'warning', 'st-review'],
  'awaiting-signature': ['Awaiting signature', 'بانتظار التوقيع', 'warning', 'st-review'],
  unfilled: ['Unfilled', 'شاغر', 'warning', 'st-alert'],
  conflict: ['Conflict', 'تعارض', 'danger', 'st-alert'],
  rejected: ['Rejected', 'مرفوض', 'danger', 'st-no'],
  cancelled: ['Cancelled', 'ملغى', 'danger', 'st-no'],
  declined: ['Declined', 'اعتذر', 'danger', 'st-no'],
  withdrawn: ['Withdrawn', 'مسحوب', '', 'st-pause'],
  failed: ['Failed', 'فشل الإرسال', 'danger', 'st-no']
};
export function Status({ k }) {
  const s = STATUS[k];
  return s ? <Pill label={t(s[0], s[1])} tone={s[2]} mark={s[3]} /> : <Pill label={k} />;
}
export const statusLabel = key => (STATUS[key] ? t(STATUS[key][0], STATUS[key][1]) : key);

/** USD leads at full size, LBP follows in mono, and the rate travels with it. */
export function Amount({ dollars, showRate = false, cls = '' }) {
  return (
    <span className={'amount ' + cls} dir="ltr">
      <span className="usd">{usd(dollars)}</span>
      <span className="lbp">{lbp(dollars * RATE.value)}</span>
      {showRate ? (
        <span className="rate">
          at {num(RATE.value)} · {fmtDate(RATE.setOn)}
        </span>
      ) : null}
    </span>
  );
}

export const Stat = ({ k, v, d }) => (
  <div className="stat">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
    {d ? <span className="d">{d}</span> : null}
  </div>
);

export const SearchField = ({ ph, ...props }) => (
  <div className="search">
    <Icon name="search" size={17} />
    <input className="input" type="search" placeholder={ph} {...props} />
  </div>
);

export const Empty = ({ glyph, title, body, action }) => (
  <div className="empty">
    <span className="glyph">
      <Icon name={glyph} size={26} />
    </span>
    <h3>{title}</h3>
    <p>{body}</p>
    {action ? <div className="acts">{action}</div> : null}
  </div>
);

export const Panel = ({ title, more, tight = false, children }) => (
  <section className="panel">
    {title ? (
      <div className="panel-h">
        <h3>{title}</h3>
        {more ? <div className="more">{more}</div> : null}
      </div>
    ) : null}
    <div className={'panel-b ' + (tight ? 'tight' : '')}>{children}</div>
  </section>
);

/* ---------- collections and their pages ----------
   A list longer than a page shows ten at a time, with the pages beneath it. Rows a search or a
   filter hides on the page (hidden, or display none) are left out of the count, so filtering
   happens before paging. */
export const PAGE_SIZE = 10;
export function CollectionPages({ target, body = c => c }) {
  const [state, setState] = useState({ page: 0, visible: 0 });
  const memory = useRef({ signature: '', page: 0, ids: new WeakMap(), sequence: 0 });
  const update = (reset = false, page = memory.current.page) => {
    const container = target.current,
      rows = container && body(container);
    if (!rows) return;
    const m = memory.current,
      all = [...rows.children].filter(e => !e.matches('.detail,[data-no-page]'));
    const visible = all.filter(e => !e.hidden && e.style.display !== 'none');
    const next = visible
      .map(e => {
        if (!m.ids.has(e)) m.ids.set(e, ++m.sequence);
        return m.ids.get(e);
      })
      .join(',');
    if (reset || m.signature !== next) {
      page = 0;
      m.signature = next;
    }
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    m.page = page;
    all.forEach(e => {
      const i = visible.indexOf(e),
        hide = String(i < page * PAGE_SIZE || i >= (page + 1) * PAGE_SIZE);
      if (e.dataset.pageHidden !== hide) e.dataset.pageHidden = hide;
      const detail = e.nextElementSibling;
      if (detail?.matches('.detail') && detail.dataset.pageHidden !== hide) detail.dataset.pageHidden = hide;
    });
    container.dispatchEvent(new Event('paginationchange', { bubbles: true }));
    setState(s => (s.page === page && s.visible === visible.length ? s : { page, visible: visible.length }));
  };
  useLayoutEffect(() => {
    const rows = target.current && body(target.current);
    if (!rows) return undefined;
    update();
    const watch = new MutationObserver(() => update());
    watch.observe(rows, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style'] });
    return () => watch.disconnect();
  }, []);
  const { page, visible } = state,
    pages = Math.max(1, Math.ceil(visible / PAGE_SIZE));
  return (
    <nav className="collection-pages" aria-label={t('Pagination', 'الصفحات')} hidden={visible <= PAGE_SIZE}>
      <span>
        {visible ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, visible)}` : '0'} / {visible}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-dense"
        data-page-step="-1"
        disabled={!page}
        onClick={() => update(false, page - 1)}
      >
        {t('Previous', 'السابق')}
      </button>
      <label>
        {t('Page', 'الصفحة')}{' '}
        <Select data-page-select="" value={page} onChange={e => update(false, Number(e.target.value))}>
          {Array.from({ length: pages }, (_, i) => (
            <option key={i} value={i}>
              {i + 1}
            </option>
          ))}
        </Select>{' '}
        / {pages}
      </label>
      <button
        type="button"
        className="btn btn-secondary btn-dense"
        data-page-step="1"
        disabled={page + 1 >= pages}
        onClick={() => update(false, page + 1)}
      >
        {t('Next', 'التالي')}
      </button>
    </nav>
  );
}
/** A container of cards or rows that pages itself: <Paged className="member-list">…</Paged>. */
export function Paged({ as: Tag = 'div', children, ...props }) {
  const box = useRef(null);
  return (
    <>
      <Tag ref={box} {...props}>
        {children}
      </Tag>
      <CollectionPages target={box} />
    </>
  );
}

/* ---------- the data table ----------
   Sticky header, optional selection, sort, expandable rows and pages.
   cols: [{label, cls, sort}]; rows: [{cells, detail, cls, props, attrs, key}] or arrays of cells (attrs: attributes as text). */
export function Table({ cols, rows, foot, pick = false, empty: emptyMsg, id = 'tbl', onBulk, manual = false }) {
  const wrap = useRef(null);
  const [sort, setSort] = useState(null); // {i, dir, order}
  const [open, setOpen] = useState(() => new Set());
  /* new rows (a record saved, a filter changed) come back unsorted and closed, as a fresh table */
  const signature = rows.map((r, i) => r.key ?? i).join('|');
  const [shown, setShown] = useState(signature);
  if (shown !== signature) {
    setShown(signature);
    setSort(null);
    setOpen(new Set());
  }
  const visibleRows = () =>
    [...wrap.current.querySelectorAll('[data-row]')].filter(r => {
      const tr = r.closest('tr');
      return !tr.hidden && tr.style.display !== 'none' && tr.dataset.pageHidden !== 'true';
    });
  const sync = () => {
    const box = wrap.current,
      all = box.querySelector('[data-all]'),
      boxes = [...box.querySelectorAll('[data-row]')];
    const n = boxes.filter(r => r.checked).length,
      visible = visibleRows(),
      checked = visible.filter(r => r.checked).length;
    if (all) {
      all.checked = checked === visible.length && checked > 0;
      all.indeterminate = checked > 0 && checked < visible.length;
    }
    onBulk?.(n, box);
  };
  useEffect(() => {
    if (!pick || !wrap.current) return undefined;
    const box = wrap.current;
    box.addEventListener('paginationchange', sync);
    return () => box.removeEventListener('paginationchange', sync);
  });
  if (!rows.length)
    return (
      <div className="tablewrap">
        {emptyMsg || (
          <Empty
            glyph="search"
            title={t('Nothing matches those filters', 'لا شيء يطابق هذه المرشّحات')}
            body={t('Try clearing one of them, or add the first record.', 'جرّب إزالة أحدها، أو أضف السجل الأول.')}
          />
        )}
      </div>
    );

  /* Sorting reads each row's text as shown, numbers as numbers. */
  const sortBy = i => {
    const dir = sort?.i === i && sort.dir === 'ascending' ? 'descending' : 'ascending';
    const offset = pick ? 1 : 0;
    const text = [...wrap.current.querySelectorAll('tbody > tr:not(.detail)')].map(tr => [
      Number(tr.dataset.ri),
      tr.children[i + offset]?.textContent.trim() || ''
    ]);
    text.sort(([, av], [, bv]) => {
      const an = parseFloat(av.replace(/[^\d.-]/g, '')),
        bn = parseFloat(bv.replace(/[^\d.-]/g, ''));
      const r = !isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv, isAr() ? 'ar' : 'en');
      return dir === 'ascending' ? r : -r;
    });
    setSort({ i, dir, order: text.map(([ri]) => ri) });
  };
  const order = sort ? sort.order : rows.map((_, i) => i);
  const toggle = (e, ri) => {
    const button = e.target.closest('[data-expand]');
    if (!button) return;
    e.stopPropagation();
    const next = new Set(open),
      on = !next.has(ri);
    on ? next.add(ri) : next.delete(ri);
    button.setAttribute('aria-expanded', String(on));
    setOpen(next);
  };
  return (
    <>
      <div className="tablewrap" data-table={id} ref={wrap} data-manual-pagination={manual ? '' : undefined}>
        <div className="tablescroll">
          <table className="tbl">
            <thead>
              <tr>
                {pick ? (
                  <th className="pick">
                    <label className="check">
                      <input
                        type="checkbox"
                        data-all
                        aria-label={t('Select all rows', 'تحديد كل الصفوف')}
                        onChange={e => {
                          visibleRows().forEach(r => {
                            r.checked = e.target.checked;
                          });
                          sync();
                        }}
                      />
                    </label>
                  </th>
                ) : null}
                {cols.map((c, i) => (
                  <th
                    key={i}
                    className={`${c.cls || ''} ${c.sort ? 'sortable' : ''}`}
                    data-sort={c.sort ? i : undefined}
                    tabIndex={c.sort ? 0 : undefined}
                    aria-sort={sort?.i === i ? sort.dir : undefined}
                    onClick={c.sort ? () => sortBy(i) : undefined}
                    onKeyDown={
                      c.sort
                        ? e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              sortBy(i);
                            }
                          }
                        : undefined
                    }
                  >
                    {c.label ? c.label : <span className="sr">{t('Actions', 'إجراءات')}</span>}
                    {c.sort ? (
                      <span className="arrow" aria-hidden="true">
                        <Icon name="sort" size={13} />
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.map(ri => {
                const r = rows[ri],
                  cells = r.cells || r,
                  expanded = open.has(ri),
                  extra = { ...(r.attrs ? htmlAttrs(r.attrs) : {}), ...(r.props || {}) };
                return (
                  <Fragment key={r.key ?? ri}>
                    <tr
                      className={(r.cls || '') + (expanded ? ' expanded' : '')}
                      data-ri={ri}
                      {...extra}
                      onClick={
                        r.detail
                          ? e => {
                              toggle(e, ri);
                              if (!e.isPropagationStopped()) extra.onClick?.(e);
                            }
                          : extra.onClick
                      }
                    >
                      {pick ? (
                        <td className="pick">
                          <label className="check">
                            <input
                              type="checkbox"
                              data-row
                              aria-label={t(`Select row ${ri + 1}`, `تحديد الصف ${ri + 1}`)}
                              onChange={sync}
                            />
                          </label>
                        </td>
                      ) : null}
                      {cells.map((c, i) => (
                        <td key={i} className={cols[i]?.cls || ''}>
                          {c}
                        </td>
                      ))}
                    </tr>
                    {r.detail ? (
                      <tr className="detail" data-detail={ri} hidden={!expanded}>
                        <td colSpan={cells.length + (pick ? 1 : 0)}>{r.detail}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {foot ? <div className="tablefoot">{foot}</div> : null}
      </div>
      {manual ? null : <CollectionPages target={wrap} body={c => c.querySelector('tbody')} />}
    </>
  );
}

/* ---------- overlays ----------
   One drawer, one modal, one anchored menu or popover, and the toasts. Flows open them from
   anywhere with the functions below; OverlayHost draws them. */
const overlay = { drawer: null, modal: null, layer: null, toasts: [], open: false, created: false };
const overlayListeners = new Set();
let snapshot = { ...overlay };
const emit = () => {
  snapshot = { ...overlay };
  overlayListeners.forEach(l => l());
};
const useOverlays = () =>
  useSyncExternalStore(
    l => {
      overlayListeners.add(l);
      return () => overlayListeners.delete(l);
    },
    () => snapshot
  );
let lastFocus = null,
  gen = 0; // gen: a close only empties the overlays if nothing opened since

export function closeOverlays() {
  /* Never leave focus stranded on an element that is about to be hidden. */
  const back = lastFocus;
  lastFocus = null;
  if (back && back.isConnected && back !== document.body) back.focus();
  else document.getElementById('well')?.focus();
  if (!overlay.drawer && !overlay.modal) return;
  overlay.open = false;
  emit();
  const g = ++gen;
  setTimeout(() => {
    if (g === gen) {
      overlay.drawer = null;
      overlay.modal = null;
      emit();
    }
  }, 260);
}
/** opts: {title, sub, body, foot, large, onMount(el)} — body and foot are React nodes. */
export function openDrawer(opts) {
  lastFocus = document.activeElement;
  gen++;
  overlay.drawer = { ...opts, gen };
  overlay.modal = null;
  overlay.open = true;
  overlay.created = true;
  emit();
}
/** opts: {title, sub, body, foot, wide, onMount(el)} */
export function openModal(opts) {
  lastFocus = document.activeElement;
  gen++;
  overlay.modal = { ...opts, gen };
  overlay.drawer = null;
  overlay.open = true;
  overlay.created = true;
  emit();
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]';
/* what the keyboard can reach: not an element taken out of the tab order, nor one hidden from
   assistive technology (the native select behind a designed dropdown) */
const reachable = root =>
  [...root.querySelectorAll(FOCUSABLE)].filter(
    el => el.tabIndex >= 0 && !el.closest('[aria-hidden="true"]') && el.getClientRects().length
  );
/* Move focus into the dialog and keep Tab inside it — a drawer the keyboard can tab out of behind
   the scrim is worse than no drawer. */
const trapTab = e => {
  if (e.key !== 'Tab') return;
  const f = reachable(e.currentTarget);
  if (!f.length) return;
  const first = f[0],
    last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
};
function Sheet({ kind, opts }) {
  return (
    <>
      <div className={`${kind}-head`}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id={`${kind}-title`}>{opts.title}</h2>
          {opts.sub ? (
            <p className="t-caption dim" style={{ marginTop: 4 }}>
              {opts.sub}
            </p>
          ) : null}
        </div>
        <button className="iconbtn" data-close aria-label={t('Close', 'إغلاق')}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className={`${kind}-body`}>{opts.body}</div>
      {opts.foot ? <div className={`${kind}-foot`}>{opts.foot}</div> : null}
    </>
  );
}
/* A [data-close] anywhere in a dialog closes it. */
const closeOnMark = e => {
  if (e.target.closest('[data-close]')) closeOverlays();
};

/* ---------- anchored menu ----------
   Sheet 03: menus open 8px from their trigger, 10px radius, elevation 2, and flip upward when there
   is no room below. Items: {label, icon, fn, danger, hint, sep, head, tone, sub:[items]}. Esc or a
   click outside closes it. */
export function closeMenu() {
  if (!overlay.layer) return;
  overlay.layer.anchor?.setAttribute('aria-expanded', 'false');
  overlay.layer = null;
  emit();
}
export function openMenu(anchor, items, { width = 220 } = {}) {
  if (overlay.layer?.anchor === anchor) return closeMenu();
  closeMenu();
  anchor.setAttribute('aria-expanded', 'true');
  overlay.layer = { kind: 'menu', anchor, items, width };
  emit();
}
/** An anchored card (notifications, account) — same placement rules as a menu. content is a React node. */
export function openPopover(anchor, content, { width = 340 } = {}) {
  if (overlay.layer?.anchor === anchor) return closeMenu();
  closeMenu();
  anchor.setAttribute('aria-expanded', 'true');
  overlay.layer = { kind: 'popover', anchor, content, width };
  emit();
}
function MenuItems({ items, onSub }) {
  return items.map((it, i) =>
    it.sep ? (
      <div key={i} className="sep"></div>
    ) : it.head ? (
      <div key={i} className="head">
        {it.head}
      </div>
    ) : (
      <button
        key={i}
        type="button"
        className={`${it.danger ? 'danger' : ''} ${it.sub ? 'hassub' : ''} ${['present', 'excused', 'absent', 'unrecorded'].includes(it.tone) ? `attendance-option-${it.tone}` : ''}`}
        data-mi={i}
        role="menuitem"
        onClick={e => {
          e.stopPropagation();
          if (it.sub) return onSub?.(it, e.currentTarget);
          closeMenu();
          it.fn?.();
        }}
      >
        {it.icon ? <Icon name={it.icon} size={16} /> : null}
        <span style={{ flex: 1 }}>{it.label}</span>
        {it.hint ? <span className="t-caption dimmer">{it.hint}</span> : null}
        {it.sub ? <Icon name="chevR" size={14} /> : null}
      </button>
    )
  );
}
function Layer({ layer }) {
  const box = useRef(null);
  const [sub, setSub] = useState(null);
  useLayoutEffect(() => {
    const el = box.current,
      r = layer.anchor.getBoundingClientRect(),
      rtl = document.documentElement.dir === 'rtl';
    const mh = el.offsetHeight,
      mw = el.offsetWidth;
    let top = r.bottom + 8,
      left = rtl ? r.left : r.right - mw;
    if (layer.kind === 'menu' && top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 8);
    left = Math.min(Math.max(8, left), innerWidth - mw - 8);
    Object.assign(
      el.style,
      { position: 'fixed', top: top + 'px', left: left + 'px', zIndex: 140 },
      layer.kind === 'popover' ? { maxHeight: `calc(100vh - ${r.bottom + 24}px)`, overflowY: 'auto', padding: 0 } : {}
    );
    if (layer.kind === 'menu') el.querySelector('[data-mi]')?.focus();
  }, [layer]);
  useEffect(() => {
    const outside = e => {
      if (box.current && !box.current.contains(e.target) && !layer.anchor.contains(e.target)) closeMenu();
    };
    const escape = e => {
      if (e.key !== 'Escape') return;
      const anchor = layer.anchor;
      closeMenu();
      if (anchor?.isConnected) anchor.focus(); // the keyboard carries on from the button that opened it
    };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape);
    addEventListener('hashchange', closeMenu);
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', escape);
      removeEventListener('hashchange', closeMenu);
    };
  }, [layer]);
  if (layer.kind === 'popover')
    return (
      <div className="popover" role="dialog" style={{ width: layer.width }} ref={box}>
        {layer.content}
      </div>
    );
  const openSub = (it, button) => {
    const br = button.getBoundingClientRect(),
      rtl = document.documentElement.dir === 'rtl',
      width = layer.width;
    let sl = rtl ? br.left - width - 4 : br.right + 4;
    if (sl + width > innerWidth - 8) sl = br.left - width - 4;
    if (sl < 8) sl = br.right + 4;
    setSub({ items: it.sub, top: br.top - 6, left: sl });
  };
  return (
    <div className="menu" role="menu" style={{ width: layer.width }} ref={box}>
      <MenuItems items={layer.items} onSub={openSub} />
      {sub ? (
        <div
          className="menu submenu"
          style={{ width: layer.width, position: 'fixed', top: sub.top + 'px', left: sub.left + 'px', zIndex: 141 }}
        >
          <MenuItems items={sub.items} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------- toast ----------
   Sheet 04: bottom-right in LTR, bottom-left in RTL. 6s auto-dismiss, 10s with an action, never for
   errors. Reversible mutations carry Undo. */
let toastId = 0;
export function toast(title, body = '', tone = '', { action } = {}) {
  const id = ++toastId;
  const kill = () => {
    const item = overlay.toasts.find(x => x.id === id);
    if (!item || item.leaving) return;
    overlay.toasts = overlay.toasts.map(x => (x.id === id ? { ...x, leaving: true } : x));
    emit();
    setTimeout(() => {
      overlay.toasts = overlay.toasts.filter(x => x.id !== id);
      emit();
    }, 180);
  };
  overlay.toasts = [...overlay.toasts, { id, title, body, tone, action, kill }];
  emit();
  if (tone !== 'danger') setTimeout(kill, action ? 10000 : 6000);
  return kill;
}

/* Where the overlays are drawn: beside the app, in the document's body. */
export function OverlayHost() {
  const o = useOverlays();
  const drawer = useRef(null),
    modal = useRef(null);
  /* The scrim, drawer and modal are made the first time one opens, closed, and opened a frame of
     layout later, so even the first one slides in. */
  const [armed, setArmed] = useState(false);
  useLayoutEffect(() => {
    if (o.created && !armed) {
      void drawer.current?.offsetWidth;
      setArmed(true);
    }
  }, [o.created]);
  const open = o.open && armed;
  const current = o.drawer || o.modal,
    el = o.drawer ? drawer : modal;
  useLayoutEffect(() => {
    if (!current || !open) return;
    const host = el.current,
      g = current.gen;
    const els = reachable(host);
    (els.find(e => !e.hasAttribute('data-close')) || els[0])?.focus();
    /* what a dialog wires once it is drawn runs as soon as React has finished drawing it */
    if (current.onMount)
      queueMicrotask(() => {
        if ((overlay.drawer || overlay.modal)?.gen === g && overlay.open) current.onMount(host);
      });
  }, [current?.gen, open]);
  useEffect(() => {
    const escape = e => {
      if (e.key === 'Escape') closeOverlays();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);
  return createPortal(
    <>
      {o.created ? (
        <>
          <div className={'scrim' + (open ? ' open' : '')} onClick={closeOverlays}></div>
          <div
            className={'drawer' + (open && o.drawer ? ' open' : '') + (o.drawer?.large ? ' drawer-lg' : '')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            ref={drawer}
            onClick={closeOnMark}
            onKeyDown={trapTab}
          >
            {o.drawer ? <Sheet key={o.drawer.gen} kind="drawer" opts={o.drawer} /> : null}
          </div>
          <div
            className={'modal' + (open && o.modal ? ' open' : '')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            ref={modal}
            onClick={closeOnMark}
            onKeyDown={trapTab}
          >
            {o.modal ? (
              <div className={'sheet' + (o.modal.wide ? ' sheet-wide' : '')}>
                <Sheet key={o.modal.gen} kind="modal" opts={o.modal} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
      {o.layer ? <Layer layer={o.layer} /> : null}
      {o.toasts.length ? (
        <div className="toasts" role="status" aria-live="polite">
          {o.toasts.map(x => (
            <div
              key={x.id}
              className={'toast ' + x.tone}
              style={x.leaving ? { opacity: 0, transform: 'translateY(6px)' } : undefined}
            >
              <span className="bar"></span>
              <span className="tbody">
                <b>{x.title}</b>
                {x.body ? <span>{x.body}</span> : null}
                {x.action ? (
                  <span className="act">
                    <button
                      type="button"
                      onClick={() => {
                        x.action.fn();
                        x.kill();
                      }}
                    >
                      {x.action.label}
                    </button>
                  </span>
                ) : null}
              </span>
              <button className="iconbtn tclose" type="button" aria-label={t('Dismiss', 'إغلاق')} onClick={x.kill}>
                <Icon name="close" size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>,
    document.body
  );
}

export { Icon, person };
