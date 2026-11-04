/* Dialogs every part of the portal uses: the required-field check, asking before a consequential
   step, switching parish, sharing a link, previewing a document, and choosing which record to
   create. */
import { t } from '../../lib/i18n.js';
import { bus, go } from '../model/store.js';
import { Icon, openDrawer, openModal, closeOverlays } from '../ui/ui.jsx';
import * as C from '../ui/components.jsx';
import { ok } from './dialog-helpers.jsx';

const L = (en, ar) => t(en, ar);

/* Inline validation as sheet 03 draws it: the field turns red, the message sits under
   it and focus moves there; it clears as soon as the person types. */
export function need(el, sel, msg, ok = v => !!v) {
  const inp = el.querySelector(sel);
  if (!inp || ok(inp.value.trim())) return true;
  const row = inp.closest('.formrow') || inp.parentElement;
  let h = row.querySelector('[data-need]');
  if (!h) {
    h = Object.assign(document.createElement('span'), { className: 'help help-error' });
    h.dataset.need = '1';
    row.append(h);
  }
  h.textContent = msg;
  inp.setAttribute('aria-invalid', 'true');
  inp.focus();
  inp.addEventListener(
    'input',
    () => {
      inp.removeAttribute('aria-invalid');
      h.remove();
    },
    { once: true }
  );
  return false;
}

export function share({ title, url = location.href, text = '' }) {
  const wa = `https://wa.me/?text=${encodeURIComponent((text ? text + ' ' : '') + url)}`;
  openModal({
    title: L('Share', 'مشاركة'),
    sub: title,
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="shurl">
            {L('Link', 'الرابط')}
          </label>{' '}
          <div className="field">
            <input
              className="value"
              id="shurl"
              readOnly
              defaultValue={url}
              dir="ltr"
              style={{ border: 0, background: 'none', width: '100%', font: '400 13px/1 var(--mono)' }}
            />{' '}
            <button className="btn btn-ghost btn-dense" id="shcopy" style={{ borderRadius: 0 }}>
              {L('Copy', 'نسخ')}
            </button>
          </div>
        </div>{' '}
        <div className="grid g3" style={{ gap: '10px' }}>
          <a
            className="card card-flat"
            href={wa}
            target="_blank"
            rel="noopener"
            style={{ textAlign: 'center', padding: '16px 10px' }}
          >
            <span style={{ color: 'var(--success)' }}>
              <Icon name="msg" size={22} />
            </span>
            <b style={{ display: 'block', font: '500 13px/18px var(--sans)', marginTop: '6px' }}>WhatsApp</b>
          </a>{' '}
          <a
            className="card card-flat"
            href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}
            style={{ textAlign: 'center', padding: '16px 10px' }}
          >
            <span style={{ color: 'var(--primary)' }}>
              <Icon name="msg" size={22} />
            </span>
            <b style={{ display: 'block', font: '500 13px/18px var(--sans)', marginTop: '6px' }}>
              {L('Email', 'بريد')}
            </b>
          </a>{' '}
          <button
            className="card card-flat"
            id="shprint"
            style={{ textAlign: 'center', padding: '16px 10px', cursor: 'pointer' }}
          >
            <span style={{ color: 'var(--text-2)' }}>
              <Icon name="print" size={22} />
            </span>
            <b style={{ display: 'block', font: '500 13px/18px var(--sans)', marginTop: '6px' }}>
              {L('Print', 'طباعة')}
            </b>
          </button>
        </div>
      </>
    ),
    onMount(el) {
      el.querySelector('#shcopy').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          el.querySelector('#shurl').select();
          document.execCommand('copy');
        }
        ok(L('Link copied', 'نُسخ الرابط'));
      });
      el.querySelector('#shprint').addEventListener('click', () => {
        closeOverlays();
        setTimeout(() => window.print(), 250);
      });
    }
  });
}

/** Preview a document the parish holds, with print and download. */
export function previewDoc(name, kind = 'file') {
  openDrawer({
    title: name,
    body: (
      <C.InlineAlert
        tone="warning"
        title={L('Digital file unavailable', 'الملف الرقمي غير متاح')}
        body={L(
          'This legacy record contains a filename but no stored file. Ask the office for the original, or upload it to the appropriate person or group record.',
          'يحتوي السجل القديم على اسم الملف فقط دون نسخة محفوظة. اطلب الأصل من المكتب أو ارفعه إلى سجل الشخص أو المجموعة المناسب.'
        )}
      />
    ),
    foot: (
      <button className="btn btn-secondary" data-close="">
        {L('Close', 'إغلاق')}
      </button>
    )
  });
}

export function recordChooser() {
  openModal({
    title: L('New record', 'سجل جديد'),
    sub: L('What are you adding?', 'ماذا تضيف؟'),
    body: (
      <div className="grid g2" style={{ gap: '10px' }}>
        {[
          ['people', L('Parishioner', 'مؤمن'), 'people', 'newperson'],
          ['family', L('Household', 'عائلة'), 'households', 'hhnew'],
          ['sacr', L('Sacrament request', 'طلب سرّ'), 'requests', 'newsacreq'],
          ['events', L('Event', 'حدث'), 'calendar', 'evnew'],
          ['rooms', L('Room request', 'طلب قاعة'), 'reservations', 'newres'],
          ['give', L('Counting session', 'جلسة عدّ'), 'giving', 'addenv']
        ].map(([ic, lab, route, trigger], i) => (
          <button
            key={i}
            className="card card-flat"
            data-choose={`${route}|${trigger}`}
            style={{
              cursor: 'pointer',
              textAlign: 'start',
              padding: '16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}
          >
            <span className="avatar">
              <Icon name={ic} size={17} />
            </span>
            <b style={{ font: '500 14px/20px var(--sans)' }}>{lab}</b>
          </button>
        ))}
      </div>
    ),
    onMount(el) {
      el.querySelectorAll('[data-choose]').forEach(b =>
        b.addEventListener('click', () => {
          const [route, trigger] = b.dataset.choose.split('|');
          closeOverlays();
          go(route);
          setTimeout(
            () =>
              (
                document.getElementById(trigger) || document.querySelector(`[data-act="${trigger}"],[data-split]`)
              )?.click(),
            260
          );
        })
      );
    }
  });
}

/* onBack runs when the person steps back with the back button (not Esc), for example to reopen
   the drawer the question was asked from. */
export function confirmAction({ title, body, cta, danger = false, then, back = L('Cancel', 'إلغاء'), onBack }) {
  openModal({
    title,
    body: (
      <p className="t-body dim" style={{ fontSize: '14px', lineHeight: '22px' }}>
        {body}
      </p>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="" id="cf_back">
          {back}
        </button>{' '}
        <button
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          id="cf_go"
          style={{ marginInlineStart: 'auto' }}
        >
          {cta}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#cf_go').addEventListener('click', () => {
        closeOverlays();
        then();
      });
      if (onBack) el.querySelector('#cf_back').addEventListener('click', onBack);
    }
  });
}

export function parishSwitch(id) {
  return bus.switchParish?.(id);
}
