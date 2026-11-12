/* Purpose: the small form dialog the Facilities and Reservations screens share, and the helpers around it.
   Main functions: ask (a modal with fields that runs one API write, then reloads the parish and reports),
   done (reload and toast after a write made outside ask), failure (the same error toast), money, Notice.

   Every write on these screens is one call to ParishLife.Api (model/modules/facilities.js); nothing here
   changes the view model directly, so what is shown is always what the API stored. */
import { t } from '../../../lib/i18n.js';
import { bus } from '../../model/store.js';
import { hydrate } from '../../model/persist.js';
import { denied } from '../../model/modules/facilities.js';
import { toast, openModal, closeOverlays } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { need } from '../../shared/dialogs.jsx';

const L = (en, ar) => t(en, ar);

/* Reload from the API and redraw. */
export async function done(title, body = '') {
  await hydrate();
  bus.refresh();
  if (title) toast(title, body, 'success');
}
export const failure = (title, error) => toast(title, error?.message || String(error), 'danger');

export function money(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency || ''}`.trim();
  }
}

/* An area this account cannot read here says so, instead of looking empty. */
export function Notice({ area }) {
  if (!denied.has(area)) return null;
  const needsLogin = area === 'equipment' || area === 'issues' || area === 'rentals';
  return (
    <C.InlineAlert
      tone="warning"
      title={L('Not available to this account here', 'غير متاح لهذا الحساب هنا')}
      body={
        needsLogin
          ? L(
              ' This needs facility management permission and a sign-in with your authenticator, so nothing is listed.',
              ' يحتاج هذا إلى صلاحية إدارة المرافق وتسجيل الدخول بتطبيق المصادقة، لذلك لا يُعرض شيء.'
            )
          : L(
              ' This account has no facility management permission in this parish, so nothing is listed.',
              ' ليس لهذا الحساب صلاحية إدارة المرافق في هذه الرعية، لذلك لا يُعرض شيء.'
            )
      }
    />
  );
}

/* One field: text, number, date, textarea or select (options as [value, label]). */
function Row({ f }) {
  if (f.type === 'textarea')
    return (
      <div className="formrow">
        <label className="label" htmlFor={f.id}>
          {f.label}
          {f.req ? <span className="req">*</span> : null}
        </label>
        <textarea className="textarea" id={f.id} rows="3" maxLength={f.max || 2000} defaultValue={f.value || ''} />
        {f.help ? <span className="help">{f.help}</span> : null}
      </div>
    );
  if (f.type === 'checks')
    return (
      <fieldset className="formrow" id={f.id}>
        <legend className="label">{f.label}</legend>
        {f.options.length ? (
          f.options.map(([value, label]) => (
            <label key={value} className="row" style={{ gap: '8px', padding: '4px 0' }}>
              <input type="checkbox" value={value} defaultChecked={(f.value || []).includes(value)} />
              <span>{label}</span>
            </label>
          ))
        ) : (
          <span className="help">{L('None to choose from.', 'لا خيارات متاحة.')}</span>
        )}
        {f.help ? <span className="help">{f.help}</span> : null}
      </fieldset>
    );
  if (f.type === 'select')
    return (
      <div className="formrow">
        <label className="label" htmlFor={f.id}>
          {f.label}
          {f.req ? <span className="req">*</span> : null}
        </label>
        <C.Select id={f.id} defaultValue={f.value ?? ''}>
          {f.options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </C.Select>
        {f.help ? <span className="help">{f.help}</span> : null}
      </div>
    );
  return (
    <C.Field
      label={f.label}
      type={f.type || 'text'}
      value={f.value ?? ''}
      id={f.id}
      req={f.req}
      opt={!f.req && f.opt}
      help={f.help}
      min={f.min}
      max={f.max}
      maxLength={f.type === 'number' ? undefined : f.max}
    />
  );
}

/* Open a form. `run(values)` makes the write; the dialog stays open with the API's message if it fails.
   `values` holds each field's text, numbers as numbers. */
export function ask({ title, sub, fields, confirm, run, success, note, tone = 'primary' }) {
  openModal({
    title,
    sub,
    body: (
      <>
        {note || null}
        {fields.map(f => (
          <Row key={f.id} f={f} />
        ))}
        <p className="help help-error" id="ask-error" role="alert" hidden></p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className={`btn btn-${tone}`} id="ask-go" style={{ marginInlineStart: 'auto' }}>
          {confirm}
        </button>
      </>
    ),
    onMount(el) {
      const go = el.querySelector('#ask-go'),
        error = el.querySelector('#ask-error');
      go.addEventListener('click', async () => {
        const ok = fields
          .filter(f => f.req && f.type !== 'checks')
          .map(f => need(el, `#${f.id}`, L('This is required', 'هذا الحقل مطلوب'), v => !!v))
          .every(Boolean);
        if (!ok) return;
        const values = Object.fromEntries(
          fields.map(f => {
            if (f.type === 'checks')
              return [f.id, [...el.querySelectorAll(`#${f.id} input:checked`)].map(box => box.value)];
            const raw = el.querySelector(`#${f.id}`)?.value ?? '';
            return [f.id, f.type === 'number' ? (raw === '' ? null : Number(raw)) : raw.trim()];
          })
        );
        go.disabled = true;
        error.hidden = true;
        try {
          const result = await run(values);
          closeOverlays();
          const message = typeof success === 'function' ? success(result, values) : success;
          await done(message?.[0] || '', message?.[1] || '');
        } catch (e) {
          error.textContent = e.message;
          error.hidden = false;
          go.disabled = false;
        }
      });
    }
  });
}
