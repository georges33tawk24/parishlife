/* ParishLife application shell: the sign-in screen until someone signs in, then the rail, the top
   bar, the screen for the current route, and the dialogs the shell itself opens. The server owns
   authentication, parish access and authoritative records; the browser shows them. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ui/icons.jsx';
import { t, isAr, lang, setLang, num, matches } from '../../lib/i18n.js';
import { PARISH, RATE, PEOPLE, PHOTOS, PREFS } from '../model/data.js';
import * as D from '../model/data.js';
import { closeOverlays, toast, openModal, openDrawer, Avatar, openPopover, closeMenu, OverlayHost } from '../ui/ui.jsx';
import { S, MOBILE_NAV, role, me, canSee, go, save, bus } from '../model/store.js';
import { runAction } from './actions.jsx';
import { hydrate, persist, saveFailed, loadFailures } from '../model/persist.js';
import { api, loadSession, session, selectParish, signOut } from '../model/api.js';
import { MODULES } from '../model/modules/index.js';
import { M, loadMember } from '../model/member-data.js';
import { applyTheme } from '../../lib/theme.js';
import { confirmPlanNavigation, planDirty } from '../model/planning.js';
import { refresh, useVersion } from './version.js';
import { Auth } from './Auth.jsx';
import { ROUTES, allowed, MEMBER_ROUTES } from './routes.jsx';

/* ---------------- delegated controls ----------------
   The screens mark their controls the way the design system does: data-go navigates, data-act runs
   a verb from shell/actions.jsx, data-pref saves a preference, data-find narrows a page's rows, data-tip
   names a button. One handler at the root of the portal serves them all, dialogs included. */
const finds = new Map(),
  findKey = input => location.hash.split('?')[0] + '|' + input.id;
function applyFind(input) {
  const q = input.value.trim(),
    scope = input.closest('#view') || document;
  finds.set(findKey(input), input.value);
  let shown = 0;
  scope.querySelectorAll('[data-find-item]').forEach(el => {
    const on = matches(el.textContent, q);
    el.hidden = !on;
    shown += on;
    const detail = el.nextElementSibling; // an expanded table row follows its parent
    if (detail?.classList.contains('detail') && !on) detail.hidden = true;
  });
  scope.querySelector('.find-empty')?.toggleAttribute('hidden', shown > 0 || !q);
}
const savePref = (key, v, what) => {
  PREFS[key] = v;
  persist();
  toast(t('Setting saved', 'حُفظ الإعداد'), String(what).trim().replace(/\s+/g, ' '), 'success');
};
function onClick(e) {
  const goer = e.target.closest('[data-go]');
  if (goer) {
    e.preventDefault();
    go(goer.dataset.go);
    return;
  }
  const act = e.target.closest('[data-act]');
  /* a ticked checkbox keeps its tick: the browser would undo it after React has drawn the new state */
  if (act && !act.disabled) {
    if (!act.matches('input')) e.preventDefault();
    runAction(act);
    return;
  }
  const pressed = e.target.closest('[data-pref-group] button');
  if (pressed) {
    const g = pressed.closest('[data-pref-group]');
    savePref(g.dataset.prefGroup, [...g.querySelectorAll('button')].indexOf(pressed), pressed.textContent);
  }
  /* segmented groups drawn as plain markup show the pressed button as chosen */
  const seg = e.target.closest('.bgroup button,.seg button,.presets button');
  if (seg) {
    seg.parentElement.querySelectorAll(':scope > button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    seg.setAttribute('aria-pressed', 'true');
  }
}
function onChange(e) {
  const el = e.target;
  if (el.matches('select[data-pref]')) savePref(el.dataset.pref, el.value, el.selectedOptions[0]?.textContent || '');
  else if (el.matches('input[data-pref]'))
    savePref(el.dataset.pref, el.checked, el.closest('label')?.textContent || '');
}
function onInput(e) {
  if (e.target.matches('input[data-find]')) applyFind(e.target);
}

/* Tooltips: a button's data-tip shows above it after a short hover, or at once on focus. Once one has
   been open, the next opens with no wait, so moving along a row of icons does not feel slow. */
function useTooltips() {
  useEffect(() => {
    let tip = null,
      wait = 0,
      closedAt = 0;
    const warm = () => Date.now() - closedAt < 500;
    const hide = () => {
      clearTimeout(wait);
      if (tip) closedAt = Date.now();
      tip?.remove();
      tip = null;
    };
    const show = el => {
      const instant = warm();
      hide();
      /* the rail's label is on screen unless the rail is collapsed: then there is nothing to add */
      const label = el.querySelector('.nl');
      if (label && getComputedStyle(label).display !== 'none') return;
      tip = document.createElement('span');
      tip.className = 'tip' + (instant ? ' instant' : '');
      tip.textContent = el.dataset.tip;
      document.body.append(tip);
      const r = el.getBoundingClientRect(),
        w = tip.offsetWidth,
        h = tip.offsetHeight;
      if (el.closest('.rail')) {
        tip.style.top = `${r.top + r.height / 2 - h / 2 + scrollY}px`;
        tip.style.left = `${document.documentElement.dir === 'rtl' ? r.left - w - 8 : r.right + 8}px`;
      } else {
        tip.style.top = `${(r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + scrollY}px`;
        tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
      }
      const shown = tip;
      requestAnimationFrame(() => shown.classList.add('on'));
    };
    const over = e => {
      const el = e.target.closest?.('[data-tip]');
      if (!el || el.contains(e.relatedTarget)) return;
      const delay = tip || warm() ? 0 : 400;
      hide();
      closedAt = delay ? closedAt : Date.now();
      wait = setTimeout(() => {
        if (el.matches(':hover')) show(el);
      }, delay);
    };
    const out = e => {
      const el = e.target.closest?.('[data-tip]');
      if (el && !el.contains(e.relatedTarget)) hide();
    };
    const focus = e => {
      const el = e.target.closest?.('[data-tip]');
      if (el) show(el);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', out);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    return () => {
      hide();
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mouseout', out);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
    };
  }, []);
}

/* ---------------- dialogs ---------------- */
function RateBody({ canEdit, typed, setTyped, input }) {
  const v = typed == null ? null : parseInt(typed.replace(/\D/g, ''), 10),
    fine = v >= 10000 && v <= 500000;
  return (
    <>
      <label className="label" htmlFor="rateinput">
        {t('Lira to the dollar', 'الليرة مقابل الدولار')}
      </label>
      <div className="field">
        <span className="prefix">L.L / $</span>
        <input
          className="value"
          id="rateinput"
          defaultValue={num(RATE.value)}
          disabled={!canEdit}
          dir="ltr"
          ref={input}
          style={{ border: 0, background: 'none', width: '100%' }}
          inputMode="numeric"
          onInput={e => setTyped(e.target.value)}
        />
      </div>
      <p className={'help' + (typed != null && !fine ? ' help-error' : '')} id="ratehelp">
        {typed != null
          ? fine
            ? t(`$50 becomes L.L ${num(v * 50)}.`, `50$ تصبح ${num(v * 50)} ل.ل.`)
            : t('Enter a rate between 10,000 and 500,000.', 'أدخل سعراً بين 10,000 و500,000.')
          : canEdit
            ? t(`Last set by ${RATE.setBy || 'parish office'}.`, `ضُبط أخيراً من ${RATE.setBy || 'مكتب الرعية'}.`)
            : t('Only clergy and the treasurer may change the rate.', 'الإكليروس وأمين الصندوق وحدهم يغيّرون السعر.')}
      </p>
    </>
  );
}
export function rateDialog() {
  const canEdit =
    ['priest', 'treasurer', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin'].includes(S.role) ||
    (session.user?.roles || []).includes('treasurer');
  /* the help line follows what is typed; the input itself stays the browser's */
  function Body() {
    const [typed, setTyped] = useState(null);
    return <RateBody canEdit={canEdit} typed={typed} setTyped={setTyped} input={null} />;
  }
  /* The API has no exchange rate: persist() reports it as not connected and puts the old value back. */
  const saveRate = async e => {
    const input = e.currentTarget.closest('.modal').querySelector('#rateinput');
    const value = parseInt(input.value.replace(/\D/g, ''), 10);
    if (!(value >= 10000 && value <= 500000)) return input.focus();
    const before = RATE.value;
    RATE.value = value;
    RATE.setOn = new Date();
    RATE.setBy = session.user?.name || '';
    if (!(await persist())) return;
    closeOverlays();
    bus.refresh();
    toast(t('Rate saved', 'حُفظ السعر'), `${num(value)} L.L / $`, 'success', {
      action: {
        label: t('Undo', 'تراجع'),
        fn: () => {
          RATE.value = before;
          bus.refresh();
        }
      }
    });
  };
  openModal({
    title: t('Parish exchange rate', 'سعر صرف الرعية'),
    sub: t(
      'Every amount recorded from now on carries this rate. Past records keep the rate that produced them.',
      'كل مبلغ يُسجَّل من الآن يحمل هذا السعر. السجلات السابقة تحتفظ بالسعر الذي أنتجها.'
    ),
    body: <Body />,
    foot: (
      <>
        <button className="btn btn-secondary" data-close>
          {t('Cancel', 'إلغاء')}
        </button>
        <button
          className="btn btn-primary"
          id="saverate"
          disabled={!canEdit}
          style={{ marginInlineStart: 'auto' }}
          onClick={saveRate}
        >
          {t('Save rate', 'حفظ السعر')}
        </button>
      </>
    )
  });
}

/* ---------------- command palette (⌘K) ---------------- */
const ACTIONS = [
  ['Start a counting session', 'فتح جلسة عدّ', 'give', '#/giving'],
  ['New parishioner', 'مؤمن جديد', 'people', '#/people'],
  ['Request a room', 'طلب قاعة', 'rooms', '#/reservations'],
  ['Take attendance', 'تسجيل الحضور', 'attend', '#/checkin'],
  ['Build this week’s bulletin', 'بناء نشرة الأسبوع', 'doc', '#/notices'],
  ['Print my schedule', 'اطبع جدولي', 'print', '#/calendar'],
  ['Open the audit trail', 'فتح سجل التدقيق', 'shield', '#/audit']
];
function Mark({ text, q }) {
  if (!q) return text;
  const parts = String(text).split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}
function Palette({ open, onClose }) {
  const [q, setQ] = useState(''),
    [active, setActive] = useState(0),
    input = useRef(null),
    box = useRef(null);
  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      input.current?.focus();
    }
  }, [open]);
  const acts = ['bishop', 'member'].includes(S.role)
    ? []
    : ACTIONS.filter(a => allowed(a[3].replace(/^#\//, '').split('/')[0]) && matches(a[0] + ' ' + a[1], q));
  const ppl =
    S.role === 'member'
      ? []
      : (q ? PEOPLE.filter(p => matches(`${p.lat} ${p.ar} ${p.phone}`, q)) : PEOPLE.slice(0, 3)).slice(0, 5);
  const households =
    q && canSee('households')
      ? D.HOUSEHOLDS.filter(h => matches(`${h.name} ${h.ar} ${h.town || ''} ${h.envelope || ''}`, q)).slice(0, 5)
      : [];
  const records =
    q && canSee('sacraments')
      ? D.SACRAMENTS.filter(r => matches(`${r.reg || ''} ${r.kind || ''} ${D.person(r.person)?.lat || ''}`, q)).slice(
          0,
          5
        )
      : [];
  const pages = Object.entries(ROUTES)
    .filter(([id, r]) => !r.hidden && allowed(id) && matches(r.en + ' ' + r.ar, q))
    .slice(0, 5);
  const options = [
    ...acts.map(a => a[3]),
    ...pages.map(([id]) => '#/' + id),
    ...ppl.map(p => '#/person/' + p.id),
    ...households.map(h => '#/household/' + h.id),
    ...records.map(r => '#/certificate/' + r.id)
  ];
  const pick = href => {
    onClose();
    location.hash = href;
  };
  let n = 0;
  const Opt = ({ href, children }) => {
    const i = n++;
    return (
      <button
        className="ac-opt"
        data-href={href}
        aria-selected={i === active ? 'true' : undefined}
        onClick={() => pick(href)}
      >
        {children}
      </button>
    );
  };
  useEffect(() => {
    box.current?.querySelector('.ac-opt[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  if (!open && !box.current) return null;
  return createPortal(
    <div
      className={'cmdk' + (open ? ' open' : '')}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="box" role="dialog" aria-modal="true" aria-label={t('Command palette', 'لوحة الأوامر')}>
        <div className="q">
          <Icon name="search" size={19} />
          <input
            id="cmdq"
            autoComplete="off"
            ref={input}
            value={q}
            placeholder={t('Search people, records, pages and actions', 'ابحث عن شخص أو سجل أو صفحة أو إجراء')}
            aria-label={t('Search people, records, pages and actions', 'ابحث عن شخص أو سجل أو صفحة أو إجراء')}
            onChange={e => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(i => (e.key === 'ArrowDown' ? Math.min(options.length - 1, i + 1) : Math.max(0, i - 1)));
              } else if (e.key === 'Enter' && options.length) pick(options[Math.max(0, active)]);
            }}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="results" id="cmdres" ref={box}>
          {acts.length ? (
            <>
              <div className="ac-group">{t('Actions', 'إجراءات')}</div>
              {acts.map(a => (
                <Opt key={a[0]} href={a[3]}>
                  <Icon name={a[2]} size={17} />
                  <span>
                    <b>
                      <Mark text={t(a[0], a[1])} q={q} />
                    </b>
                  </span>
                  <span className="kbd" style={{ marginInlineStart: 'auto' }}>
                    ↵
                  </span>
                </Opt>
              ))}
            </>
          ) : null}
          {pages.length ? (
            <>
              <div className="ac-group">{t('Pages', 'الصفحات')}</div>
              {pages.map(([id, r]) => (
                <Opt key={id} href={'#/' + id}>
                  <Icon name={r.ico} size={17} />
                  <span>
                    <b>
                      <Mark text={t(r.en, r.ar)} q={q} />
                    </b>
                  </span>
                </Opt>
              ))}
            </>
          ) : null}
          {ppl.length ? (
            <>
              <div className="ac-group">{q ? t('People', 'المؤمنون') : t('Recent', 'الأخيرة')}</div>
              {ppl.map(p => (
                <Opt key={p.id} href={'#/person/' + p.id}>
                  <Avatar p={p} cls="avatar-sm" />
                  <span>
                    <b>
                      <Mark text={isAr() ? p.ar : p.lat} q={q} />
                    </b>
                    <small>
                      {isAr() ? p.lat : p.ar} · {t('Parishioner', 'مؤمن')}
                    </small>
                  </span>
                </Opt>
              ))}
            </>
          ) : null}
          {households.length ? (
            <>
              <div className="ac-group">{t('Households', 'العائلات')}</div>
              {households.map(h => (
                <Opt key={h.id} href={'#/household/' + h.id}>
                  <Icon name="family" size={17} />
                  <span>
                    <b>
                      <Mark text={isAr() ? h.ar : h.name} q={q} />
                    </b>
                    <small>
                      {t('Household', 'عائلة')} · {h.town || ''}
                    </small>
                  </span>
                </Opt>
              ))}
            </>
          ) : null}
          {records.length ? (
            <>
              <div className="ac-group">{t('Sacrament records', 'سجلات الأسرار')}</div>
              {records.map(r => (
                <Opt key={r.id} href={'#/certificate/' + r.id}>
                  <Icon name="sacr" size={17} />
                  <span>
                    <b>
                      <Mark text={r.reg || r.kind} q={q} />
                    </b>
                    <small>
                      {t('Record', 'قيد')} · {D.person(r.person)?.lat || ''}
                    </small>
                  </span>
                </Opt>
              ))}
            </>
          ) : null}
          {!options.length ? <div className="ac-none">{t('Nothing matches.', 'لا نتيجة.')}</div> : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------------- notifications ---------------- */
function Notifications() {
  useVersion();
  const visible = D.NOTIFICATIONS.map((note, index) => ({ note, index })).filter(
    ({ note }) =>
      !note[3] || (note[3] === 'rate' ? canSee('settings') : allowed(String(note[3]).replace(/^#\//, '').split('/')[0]))
  );
  return (
    <>
      <div className="pop-h">
        <b>{t('Notifications', 'الإشعارات')}</b>
        <button
          className="btn btn-ghost btn-dense"
          id="markread"
          style={{ marginInlineStart: 'auto' }}
          onClick={() => {
            D.NOTIFICATIONS.forEach(n => {
              n[4] = false;
            });
            persist();
            refresh();
            toast(t('All marked read', 'عُلّم الكل كمقروء'), '', 'success');
          }}
        >
          {t('Mark all read', 'تعليم الكل كمقروء')}
        </button>
      </div>
      <div className="pop-b">
        {visible.map(({ note: [ic, txt, when, href, unread], index: i }) => (
          <button
            key={i}
            className={'notif ' + (unread ? 'unread' : '')}
            data-n={i}
            onClick={() => {
              const n = D.NOTIFICATIONS[i];
              n[4] = false;
              persist();
              closeMenu();
              if (n[3] === 'rate') rateDialog();
              else if (n[3]) location.hash = n[3];
            }}
          >
            <span className="nico">
              <Icon name={ic} size={17} />
            </span>
            <span className="ntxt">
              <span>{t(...txt)}</span>
              <small className="mono">{t(...when)}</small>
            </span>
            {unread ? <span className="ndot"></span> : null}
          </button>
        ))}
      </div>
      {canSee('audit') ? (
        <a className="pop-f" href="#/audit" onClick={() => closeMenu()}>
          {t('See all activity', 'كل النشاط')}
        </a>
      ) : null}
    </>
  );
}

/* ---------------- the shell ---------------- */
export function Portal() {
  const version = useVersion();
  const [screen, setScreen] = useState({ kind: 'starting' });
  const [, setNav] = useState(0);
  const [railOpen, setRailOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(S.collapsed);
  const [palette, setPalette] = useState(false);
  useTooltips();

  const loginScreen = (error = '') => setScreen({ kind: 'auth', error, at: Date.now() });
  const renderAll = () => {
    setScreen({ kind: 'app' });
    setNav(n => n + 1);
    refresh();
  };

  /* A link from a parish's public page names the parish; open the account there when it can. */
  const pickParish = () => {
    const wanted = new URLSearchParams(location.search).get('parish');
    if (!wanted) return;
    if (session.parishes.some(p => p.id === wanted)) selectParish(wanted);
    history.replaceState(null, '', location.pathname + location.hash);
  };
  /* Into the portal after signing in or opening an account: the page that was asked for, or the role's first page. */
  const enter = async (parishId = '') => {
    await loadSession();
    const invitation = location.hash.startsWith('#invite=') ? location.hash.slice(8) : '';
    if (invitation) {
      try {
        const claimed = await api('account/claim-invitation', 'POST', { token: invitation });
        await loadSession();
        parishId = claimed.parish;
        history.replaceState(null, '', '#/account');
      } catch (e) {
        history.replaceState(null, '', '#/account');
        toast(t('Invitation could not be accepted', 'تعذّر قبول الدعوة'), e.message, 'danger');
      }
    }
    pickParish();
    if (parishId && session.parishes.some(p => p.id === parishId)) selectParish(parishId);
    S.role = session.user.role;
    await hydrate();
    S.route =
      S.role === 'member' && !session.user.person_id
        ? 'activity'
        : S.role === 'bishop'
          ? 'oversight'
          : role().nav.find(n => n[0] === 'l')?.[1] || 'account';
    /* Signing in from a link (a request form, a notification) continues to that page. */
    const wanted = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (wanted && ROUTES[wanted] && allowed(wanted)) route();
    else {
      location.hash = '#/' + S.route;
      renderAll();
    }
  };

  const route = () => {
    const raw = location.hash.replace(/^#\/?/, '');
    const current = [S.route, ...S.params].filter(Boolean).join('/');
    if (current && raw !== current && planDirty() && !confirmPlanNavigation()) {
      location.hash = '#/' + current;
      return;
    }
    const [id, ...params] = raw.split('/').filter(Boolean);
    const target = ROUTES[id] ? id : role().nav.find(n => n[0] === 'l')[1];
    if (!allowed(target)) {
      S.route = role().nav.find(n => n[0] === 'l')[1];
      S.params = [];
      /* "home" simply means this role's first page; anything else was a real attempt, so say where they landed */
      if (target !== 'dashboard')
        toast(
          t('Not part of your role', 'ليس ضمن دورك'),
          t(`You have been taken to ${ROUTES[S.route].en}.`, `نُقلت إلى ${ROUTES[S.route].ar}.`),
          'warning'
        );
    } else {
      S.route = target;
      S.params = params;
    }
    closeOverlays();
    renderAll();
  };

  /* Signing out lands on the sign-in screen — a new surface, drawn to the same rules. */
  const signOut = async () => {
    if (!confirmPlanNavigation()) return;
    if (!(await persist()))
      return toast(
        t('Changes were not saved', 'لم تُحفظ التغييرات'),
        t('Resolve the save error before signing out.', 'عالِج خطأ الحفظ قبل تسجيل الخروج.'),
        'danger'
      );
    closeOverlays();
    await signOut().catch(() => {});
    loginScreen();
  };
  const switchLanguage = () => {
    setLang(lang === 'ar' ? 'en' : 'ar');
    renderAll();
  };

  /* ---------------- parish / archdiocese switcher ---------------- */
  const switchParish = async id => {
    const x = session.parishes.find(q => q.id === id);
    if (!x || x.id === session.parishId) return false;
    if (!confirmPlanNavigation()) return false;
    if (!(await persist())) {
      toast(
        t('Changes were not saved', 'لم تُحفظ التغييرات'),
        t('Resolve the save error before switching parishes.', 'عالِج خطأ الحفظ قبل تبديل الرعية.'),
        'danger'
      );
      return false;
    }
    const previous = session.parishId;
    selectParish(x.id);
    S.role = session.user.role;
    try {
      await hydrate();
      closeOverlays();
      renderAll();
      toast(
        t(`Now working in ${x.name}`, `تعمل الآن في ${x.ar}`),
        t(`Your role here: ${x.role}`, `دورك هنا: ${x.roleAr}`),
        'success'
      );
      return true;
    } catch (e) {
      selectParish(previous);
      S.role = session.user.role;
      await hydrate().catch(() => {});
      toast(t('Parish could not be opened', 'تعذّر فتح الرعية'), e.message, 'danger');
      return false;
    }
  };
  const parishSwitcher = () => {
    if (!session.parishes.length) {
      go('account');
      return;
    }
    openDrawer({
      title: t('Switch parish', 'تبديل الرعية'),
      sub: t(
        'You hold a role in more than one parish. Records never cross between them.',
        'لديك دور في أكثر من رعية. ولا تعبر السجلات بينها أبداً.'
      ),
      body: (
        <>
          <div className="ac-group" style={{ paddingInline: 0 }}>
            {t(PARISH.eparchy, PARISH.eparchyAr)}
          </div>
          {session.parishes.map(x => (
            <button key={x.id} className="ac-opt" data-parish={x.id} onClick={() => switchParish(x.id)}>
              <span className="avatar">{t(x.name, x.ar).slice(0, 1)}</span>
              <span>
                <b>{t(x.name, x.ar)}</b>
                <small>
                  {t(x.town, x.townAr)} · {t(x.role, x.roleAr)}
                </small>
              </span>
              {x.name === PARISH.name ? (
                <span style={{ marginInlineStart: 'auto', color: 'var(--primary)' }}>
                  <Icon name="check" size={16} />
                </span>
              ) : null}
            </button>
          ))}
          <div className="divider"></div>
          {S.role === 'bishop' ? (
            <a className="listrow" href="#/bishopeparchy" style={{ paddingInline: 0 }}>
              <Icon name="portal" size={17} cls="dimmer" />
              <span className="grow">
                <b>{t('Eparchy view', 'عرض الأبرشية')}</b>
                <small>{t('All parishes in this archdiocese', 'كل رعايا هذه الأبرشية')}</small>
              </span>
              <Icon name="chevR" size={15} />
            </a>
          ) : null}
        </>
      ),
      foot: (
        <button className="btn btn-secondary" data-close>
          {t('Close', 'إغلاق')}
        </button>
      )
    });
  };

  /* ---------------- user menu ---------------- */
  const userMenu = e => {
    const r = role(),
      p = me(),
      anchor = e.currentTarget;
    const pick = u => {
      closeMenu();
      if (u === 'lang') switchLanguage();
      else if (u === 'rate') rateDialog();
      else if (u === 'settings') location.hash = '#/settings';
      else if (u === 'account' || u === 'profile') go('account');
      else if (u === 'member') go('memberhome');
      else if (u === 'signout') signOut();
    };
    if (S.role === 'member') {
      openPopover(
        anchor,
        <>
          <div className="pop-user">
            <Avatar p={p} cls="avatar-lg" />
            <span>
              <b>{isAr() ? p.ar || p.lat : p.lat}</b>
              <small>
                {session.user?.username ? (
                  <bdi dir="ltr">{session.user.username}</bdi>
                ) : (
                  t('Parishioner', 'من أبناء الرعية')
                )}
              </small>
            </span>
          </div>
          <div className="pop-b">
            <button className="mi" data-u="profile" onClick={() => pick('profile')}>
              <Icon name="people" size={17} />
              <span>{t('My profile', 'ملفي')}</span>
            </button>
            <button className="mi" data-u="lang" onClick={() => pick('lang')}>
              <Icon name="globe" size={17} />
              <span>{t('Language', 'اللغة')}</span>
              <span className="mhint">{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            <button className="mi danger" data-u="signout" onClick={() => pick('signout')}>
              <Icon name="arrowR" size={17} />
              <span>{t('Sign out', 'تسجيل الخروج')}</span>
            </button>
          </div>
        </>,
        { width: 290 }
      );
      return;
    }
    openPopover(
      anchor,
      <>
        <div className="pop-user">
          <Avatar p={p} cls="avatar-lg" />
          <span>
            <b>{isAr() ? p.ar : p.lat}</b>
            <small>
              {t(r.en, r.ar)} · {t(PARISH.name, PARISH.nameAr)}, {t(PARISH.town, PARISH.townAr)}
            </small>
          </span>
        </div>
        <div className="pop-b">
          <button className="mi" data-u="account" onClick={() => pick('account')}>
            <Icon name="people" size={17} />
            <span>{t('My account', 'حسابي')}</span>
          </button>
          {session.user?.person_id && S.role !== 'secretary' ? (
            <button className="mi" data-u="member" onClick={() => pick('member')}>
              <Icon name="groups" size={17} />
              <span>{t('My parish life', 'حياتي الرعوية')}</span>
            </button>
          ) : null}
          <button className="mi" data-u="lang" onClick={() => pick('lang')}>
            <Icon name="msg" size={17} />
            <span>{t('Language', 'اللغة')}</span>
            <span className="mhint">{lang === 'ar' ? 'العربية' : 'English'}</span>
          </button>
          {canSee('settings') ? (
            <>
              <button className="mi" data-u="rate" onClick={() => pick('rate')}>
                <Icon name="give" size={17} />
                <span>{t('Exchange rate', 'سعر الصرف')}</span>
                <span className="mhint mono">{num(RATE.value)}</span>
              </button>
              <button className="mi" data-u="settings" onClick={() => pick('settings')}>
                <Icon name="settings" size={17} />
                <span>{t('Parish settings', 'إعدادات الرعية')}</span>
              </button>
            </>
          ) : null}
          <div className="msep"></div>
          <div className="syncline" style={{ padding: '8px 12px' }}>
            {saveFailed ? (
              <>
                <span className="dot" style={{ background: 'var(--danger)' }}></span>
                {t('Save failed', 'تعذّر الحفظ')}
              </>
            ) : (
              <>
                <span className="dot"></span>
                {t('Connected to parish records', 'متصل بسجلات الرعية')}
              </>
            )}
          </div>
          <div className="msep"></div>
          <button className="mi danger" data-u="signout" onClick={() => pick('signout')}>
            <Icon name="arrowR" size={17} />
            <span>{t('Sign out', 'تسجيل الخروج')}</span>
          </button>
        </div>
      </>,
      { width: 290 }
    );
  };
  const notifications = e => {
    if (S.role === 'member') {
      go('membernotifications');
      return;
    }
    openPopover(e.currentTarget, <Notifications />, { width: 360 });
  };

  /* ---------------- start, and what keeps it in step ---------------- */
  useEffect(() => {
    /* Every change re-renders through the bus, so that is where the parish is saved. */
    bus.refresh = () => {
      refresh();
      persist();
    };
    bus.renderAll = () => {
      renderAll();
      persist();
    };
    bus.switchParish = switchParish;
    const keys = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (session.user) setPalette(true);
      }
      if (e.key === 'Escape') setPalette(false);
    };
    const hidden = () => {
      if (document.hidden) persist();
    };
    const saveError = e => toast(t('Changes were not saved', 'لم تُحفظ التغييرات'), e.detail, 'danger');
    /* the screens' marked controls, wherever they are drawn: the page, a dialog, a menu */
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', keys);
    addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', hidden);
    addEventListener('hashchange', route);
    document.addEventListener('parish-save-error', saveError);
    setLang(lang);
    (async () => {
      try {
        await enter();
      } catch (error) {
        session.user = null;
        loginScreen(error.status === 401 ? '' : error.message);
      }
    })();
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('change', onChange);
      document.removeEventListener('input', onInput);
      document.removeEventListener('keydown', keys);
      removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', hidden);
      removeEventListener('hashchange', route);
      document.removeEventListener('parish-save-error', saveError);
    };
  }, []);

  if (screen.kind === 'starting')
    return (
      <>
        <div id="app" className="app"></div>
        <OverlayHost />
      </>
    );
  if (screen.kind === 'auth' || !session.user)
    return (
      <>
        <Auth
          key={screen.at + lang}
          enter={enter}
          error={screen.error}
          onLanguage={() => {
            setLang(lang === 'ar' ? 'en' : 'ar');
            setScreen({ ...screen, at: Date.now() });
          }}
        />
        <OverlayHost />
      </>
    );

  const r = role(),
    p = me();
  const mobile = (MOBILE_NAV[S.role] || []).filter(id => canSee(id));
  return (
    <>
      <div id="app" className={'app' + (collapsed ? ' collapsed' : '') + (railOpen ? ' railopen' : '')}>
        <aside className="rail" id="rail">
          <button
            className="rail-parish"
            id="parishbtn"
            style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'start' }}
            onClick={parishSwitcher}
          >
            {PHOTOS.parish ? (
              <span className="seal has-photo" style={{ backgroundImage: `url(${PHOTOS.parish})` }}></span>
            ) : (
              <span className="seal">P</span>
            )}
            <span className="txt">
              <b>{t(PARISH.name, PARISH.nameAr)}</b>
              <small>
                {t(PARISH.town, PARISH.townAr)} · {t(PARISH.rite, PARISH.riteAr)}
              </small>
            </span>
            <span className="chev dimmer">
              <Icon name="chevD" size={16} />
            </span>
          </button>
          <nav className="rail-nav" aria-label={t('Modules', 'الوحدات')}>
            {r.nav.map((n, i) => {
              if (n[0] === 'h')
                return (
                  <div key={i} className="navgroup">
                    {t(n[1], n[2])}
                  </div>
                );
              const rt = ROUTES[n[1]];
              if (!rt) return null;
              const on = S.route === n[1],
                badge = rt.badge?.();
              return (
                <a
                  key={i}
                  className={'navitem ' + (on ? 'on' : '')}
                  href={'#/' + n[1]}
                  aria-current={on ? 'page' : undefined}
                  /* collapsed, the label is display:none, which also takes it away from a screen reader */
                  aria-label={badge ? `${t(rt.en, rt.ar)} (${badge})` : t(rt.en, rt.ar)}
                  data-tip={t(rt.en, rt.ar)}
                  onClick={() => setRailOpen(false)}
                >
                  <Icon name={rt.ico} size={18} />
                  <span className="nl">{t(rt.en, rt.ar)}</span>
                  <span className="nb" hidden={!badge}>
                    {String(badge || '')}
                  </span>
                </a>
              );
            })}
          </nav>
          <div className="rail-foot">
            {saveFailed ? (
              <div className="syncline offline">
                <span className="dot"></span>
                <span>{t('Save failed', 'تعذّر الحفظ')}</span>
              </div>
            ) : (
              <div className="syncline">
                <span className="dot"></span>
                <span>{t('Connected to parish records', 'متصل بسجلات الرعية')}</span>
              </div>
            )}
            <button
              className="railtoggle"
              id="railtoggle"
              onClick={() => {
                S.collapsed = !S.collapsed;
                save('pl-rail', S.collapsed ? '1' : '0');
                setCollapsed(S.collapsed);
              }}
            >
              <Icon name="chevL" size={17} />
              <span>{t('Collapse rail', 'طيّ الشريط')}</span>
            </button>
          </div>
        </aside>
        <div className="railscrim" id="railscrim" onClick={() => setRailOpen(false)}></div>
        <div className="main">
          <header className="topbar-app">
            <button
              className="iconbtn"
              id="menubtn"
              aria-label={t('Open menu', 'فتح القائمة')}
              onClick={() => setRailOpen(true)}
            >
              <Icon name="menu" size={19} />
            </button>
            <div className="gsearch">
              <div className="search">
                <Icon name="search" size={17} />
                <input
                  className="input"
                  type="search"
                  id="gsearch"
                  placeholder={t('Search people, records, pages', 'ابحث عن شخص أو سجل أو صفحة')}
                  aria-label={t('Search', 'بحث')}
                  readOnly
                  onClick={() => setPalette(true)}
                />
                <span className="kbdslot">
                  <span className="kbd">⌘K</span>
                </span>
              </div>
            </div>
            <div className="topbar-right">
              {S.role === 'bishop' ? null : (
                <button
                  className="iconbtn"
                  id="bellbtn"
                  aria-label={t('Notifications', 'الإشعارات')}
                  onClick={notifications}
                >
                  <Icon name="bell" size={19} />
                  {S.role !== 'member' || M.notifications.some(n => !n.read) ? <span className="dotmark"></span> : null}
                </button>
              )}
              <button className="userbtn" id="userbtn" aria-label={t('Account', 'الحساب')} onClick={userMenu}>
                <Avatar p={p} />
                <span className="txt">
                  <span className="un">{isAr() ? p.ar : p.lat}</span>
                  <span className="ur">{t(r.en, r.ar)}</span>
                </span>
                <Icon name="chevD" size={15} cls="dimmer" />
              </button>
            </div>
          </header>
          {/* every change redraws the screen from the parish data, as a fresh page would */}
          {/* moving between pages is otherwise silent to a screen reader; outside the view, which is redrawn */}
          <span className="sr" id="route-said" role="status">
            {ROUTES[S.route] ? t(ROUTES[S.route].en, ROUTES[S.route].ar) : ''}
          </span>
          <main className="well" id="well" tabIndex="-1">
            <View key={S.route + '/' + S.params.join('/') + '#' + version} />
          </main>
        </div>
        <nav className="mobilebar" aria-label={t('Sections', 'الأقسام')}>
          {mobile.map(id => {
            const rt = ROUTES[id];
            if (!rt) return null;
            return (
              <button key={id} data-go={id} aria-current={S.route === id ? 'page' : undefined}>
                <Icon name={rt.ico} size={20} />
                <span>{rt.mEn ? t(rt.mEn, rt.mAr) : t(rt.en, rt.ar)}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} />
      <OverlayHost />
    </>
  );
}

/* The screen for the current route. A new screen starts at the top and eases in; a re-render after
   an edit keeps the reader exactly where they were. The rail never moves either way. */
const moduleFor = {
  people: 'office',
  person: 'office',
  households: 'office',
  household: 'office',
  officeexpenses: 'office',
  services: 'office',
  requests: 'requests',
  myrequests: 'requests',
  sacraments: 'sacraments',
  certificate: 'sacraments',
  groups: 'ministries',
  attendance: 'ministries',
  music: 'ministries',
  volunteers: 'ministries',
  registrations: 'ministries',
  checkin: 'ministries',
  facilities: 'facilities',
  reservations: 'facilities',
  giving: 'finance',
  finance: 'finance'
};
/* Pages that load and save through ParishLife.Api so far (each connected module lists its own,
   model/modules/). The others say so instead of looking like an empty parish. */
const CONNECTED = new Set(MODULES.flatMap(m => m.routes));
let shownRoute = '';
function View() {
  const host = useRef(null);
  const rt = ROUTES[S.route] || ROUTES.dashboard;
  /* the parish colours; a scheme being previewed in Settings → Colours lasts only while that tab is open */
  if (!(S.route === 'settings' && S.params[0] === 'appearance')) S.themeDraft = null;
  applyTheme(session.preferences?.theme);
  const memberKey = `${session.user?.id}:${session.parishId}`;
  const waiting = MEMBER_ROUTES.has(S.route) && M.loadedFor !== memberKey;
  useEffect(() => {
    if (!waiting || M.loadingFor === memberKey) return;
    M.loadingFor = memberKey;
    loadMember()
      .then(() => {
        M.loadingFor = null;
        refresh();
      })
      .catch(error => {
        /* stop waiting: the page says what is missing instead of loading for ever */
        M.loadingFor = null;
        M.loadedFor = memberKey;
        refresh();
        toast(t('Could not load member data', 'تعذّر تحميل بيانات الأعضاء'), error.message, 'danger');
      });
  });
  useLayoutEffect(() => {
    const here = [S.route, ...S.params].join('/');
    if (here === shownRoute) return; // a redraw after an edit keeps the reader where they were
    shownRoute = here;
    const well = document.getElementById('well');
    if (well) well.scrollTop = 0;
    const el = host.current;
    el.classList.remove('view-in');
    void el.offsetWidth;
    el.classList.add('view-in'); // a new page eases in
  }, []);
  /* a re-render (a filter pressed, a record saved) keeps what was typed in a page search */
  useLayoutEffect(() => {
    document.title = `${t(rt.en, rt.ar)} · ParishLife`;
    host.current.querySelectorAll('input[data-find]').forEach(input => {
      const q = finds.get(findKey(input));
      if (q) {
        input.value = q;
        applyFind(input);
      }
    });
  });
  const bundle = session.parishes.find(p => p.id === session.parishId)?.plan;
  const restricted = bundle && moduleFor[S.route] && !bundle.modules?.includes(moduleFor[S.route]);
  const Screen = rt.view;
  return (
    <div className="wellpad" id="view" ref={host}>
      {waiting ? (
        <div className="member-page member-empty">
          <p>{t('Loading your parish life…', 'جارٍ تحميل حياتك الرعوية…')}</p>
        </div>
      ) : (
        <>
          {loadFailures.has(S.route) ? (
            <div className="alert alert-danger" role="alert">
              {t('This page could not load from the backend: ', 'تعذّر تحميل هذه الصفحة من الخادم: ')}
              {loadFailures.get(S.route)}
            </div>
          ) : null}
          {!CONNECTED.has(S.route) ? (
            <div className="alert alert-info" role="status">
              {S.route === 'dashboard'
                ? t(
                    'Not every module is connected to the new backend yet. Panels for the others stay empty until they are.',
                    'لم تُوصل كل الوحدات بالخادم الجديد بعد. تبقى لوحات الوحدات الأخرى فارغة إلى أن تُوصل.'
                  )
                : t(
                    "This page isn't connected to the new backend yet. It shows nothing from your parish, and changes made here are not saved.",
                    'هذه الصفحة غير متّصلة بالخادم الجديد بعد. لا تعرض شيئاً من رعيتك، ولا تُحفظ التغييرات التي تُجرى فيها.'
                  )}
            </div>
          ) : null}
          {restricted ? (
            <div className="alert alert-info" role="status">
              {t(
                'This module is read-only in the current parish bundle. You can view existing records and complete requests already in progress. Contact the parish administrator to request a bundle change.',
                'هذه الوحدة للقراءة فقط ضمن باقة الرعية الحالية. يمكنك عرض السجلات وإكمال الطلبات الجارية. تواصل مع إدارة الرعية لطلب تغيير الباقة.'
              )}
            </div>
          ) : null}
          <Screen params={S.params} />
        </>
      )}
    </div>
  );
}
