/* Interactive components from sheet 03 (controls) and sheet 04 (patterns): buttons, fields, the
   Lebanon compound fields, choosing, dates, uploads, rich text, menus, feedback, charts and the
   designed dropdown every select uses. */
import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';
import { t, isAr, num, usd, month, dayShort, matches } from '../../lib/i18n.js';
import { RATE, FEASTS, PEOPLE, PHOTOS, PREFS, person, initials } from '../model/data.js';
import { parishAPI, session } from '../model/api.js';
import { Avatar, toast, openPopover, closeMenu } from './ui.jsx';
export { AddressCascade } from './geography.jsx';

/* ---------------- buttons ---------------- */
export const SplitBtn = ({ label, id, kind = 'primary', ico = 'plus' }) => (
  <span className="split">
    <button className={`btn btn-${kind}`} data-split={id}>
      <Icon name={ico} size={17} />
      {label}
    </button>
    <button className={`btn btn-${kind}`} data-splitmenu={id} aria-label={t('More actions', 'إجراءات أخرى')}>
      <Icon name="chevD" size={16} />
    </button>
  </span>
);

/* With `k`, the group is a real filter: a press stores its index in S.ui[k] and re-renders (the
   view verb); without it, the pressed button simply shows as chosen. */
export function BGroup({ items, sel = 0, k = '' }) {
  const [chosen, setChosen] = useState(sel);
  const on = k ? sel : chosen;
  return (
    <span className="bgroup" role="group">
      {items.map((l, i) => (
        <button
          key={i}
          aria-pressed={i === on}
          data-act={k ? `view:${k}|${i}` : undefined}
          onClick={k ? undefined : () => setChosen(i)}
        >
          {l}
        </button>
      ))}
    </span>
  );
}

export const IconBtn = ({ ico, label, ...props }) => (
  <button className="btn-icon dense" data-tip={label} aria-label={label} {...props}>
    <Icon name={ico} size={17} />
  </button>
);

/* ---------------- fields ---------------- */
export function Field({
  label,
  req,
  opt,
  help,
  helpTone = '',
  value = '',
  ph = '',
  type = 'text',
  dir = '',
  ar = false,
  state = '',
  tail,
  id = '',
  ...input
}) {
  const auto = useId(),
    fid = id || (label ? 'f' + auto.replace(/[^a-z0-9]/gi, '') : undefined); // every labelled field is named by its label
  if (state === 'loading')
    tail = tail || <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }}></span>;
  return (
    <div className="formrow">
      {label ? (
        <label className="label" htmlFor={fid}>
          {label}
          {req ? <span className="req">*</span> : null}
          {opt ? <span className="opt">{t('(optional)', '(اختياري)')}</span> : null}
        </label>
      ) : null}
      <div className="fieldwrap">
        <input
          id={fid}
          className={state === 'ok' ? 'input ok' : 'input'}
          type={type}
          defaultValue={value}
          placeholder={ph}
          dir={dir || undefined}
          style={ar ? { fontFamily: 'var(--arabic)' } : undefined}
          aria-invalid={state === 'error' ? 'true' : undefined}
          disabled={state === 'disabled' || undefined}
          {...input}
        />
        {tail ? <span className="tail">{tail}</span> : null}
      </div>
      {help ? <span className={'help ' + helpTone}>{help}</span> : null}
    </div>
  );
}

export function Textarea({ label, value = '', ph = '', max = 500, help = '', ar = false, id = 'ta', ...input }) {
  const [length, setLength] = useState(String(value).length);
  return (
    <div className="formrow">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <textarea
        className="textarea"
        id={id}
        data-max={max}
        placeholder={ph}
        defaultValue={value}
        dir={ar ? 'rtl' : undefined}
        style={ar ? { fontFamily: 'var(--arabic)' } : undefined}
        {...input}
        onInput={e => {
          setLength(e.target.value.length);
          input.onInput?.(e);
        }}
      ></textarea>
      {help ? <span className="help">{help}</span> : null}
      <span className={'counter' + (length > max ? ' over' : '')} data-for={id}>
        {length} / {max}
      </span>
    </div>
  );
}

export function Stepper({ label, value = 0, help = '', id = 'st' }) {
  const input = useRef(null);
  const step = n => {
    input.current.value = Math.max(0, (parseInt(input.current.value, 10) || 0) + n);
  };
  return (
    <div className="formrow">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="stepper">
        <button type="button" data-step="-1" aria-label={t('Less', 'أقل')} onClick={() => step(-1)}>
          −
        </button>
        <input id={id} defaultValue={value} inputMode="numeric" dir="ltr" ref={input} />
        <button type="button" data-step="1" aria-label={t('More', 'أكثر')} onClick={() => step(1)}>
          +
        </button>
      </div>
      {help ? <span className="help">{help}</span> : null}
    </div>
  );
}

/* Empties a field the way typing would, so its own input and change handlers run. */
export function setFieldValue(input, value) {
  const proto =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : input instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
export function SearchClear({ ph, id = 'sc', ...input }) {
  const field = useRef(null);
  return (
    <div className="search fieldwrap">
      <span className="lead">
        <Icon name="search" size={17} />
      </span>
      <input
        className="input"
        id={id}
        type="search"
        placeholder={ph}
        style={{ paddingInline: '36px 34px' }}
        ref={field}
        {...input}
      />
      <span className="tail">
        <button
          className="iconbtn"
          style={{ width: 22, height: 22 }}
          data-clear={id}
          aria-label={t('Clear', 'مسح')}
          onClick={() => {
            setFieldValue(field.current, '');
            field.current.focus();
          }}
        >
          <Icon name="close" size={14} />
        </button>
      </span>
    </div>
  );
}

/* ---------------- Lebanon compound fields ---------------- */
export function CurrencyField({ label = t('Amount', 'المبلغ'), value = '1,250.00', stale = false, id = 'cur' }) {
  const [state, setState] = useState({ lira: false, value, note: '' });
  const v = parseFloat(String(state.value).replace(/,/g, '')) || 0;
  const conv = state.note || `L.L ${num(Math.round(v * RATE.value))} ${t('at', 'على سعر')} ${num(RATE.value)}`;
  const swap = () => {
    const toLira = !state.lira;
    setState({
      lira: toLira,
      value: toLira ? num(Math.round(v * RATE.value)) : (v / RATE.value).toFixed(2),
      note: toLira
        ? `$${v.toFixed(2)} ${t('at', 'على سعر')} ${num(RATE.value)} · ${t('stored as lira', 'يُخزَّن بالليرة')}`
        : `L.L ${num(Math.round((v / RATE.value) * RATE.value))} ${t('at', 'على سعر')} ${num(RATE.value)}`
    });
  };
  return (
    <div className="formrow">
      <label className="label" htmlFor={id}>
        {label}
        <span className="req">*</span>
      </label>
      <div className="field">
        <span className="prefix">{state.lira ? 'L.L' : 'USD'}</span>
        <input
          id={id}
          className="value"
          data-usd
          style={{ border: 0, background: 'none', width: '100%' }}
          value={state.value}
          dir="ltr"
          onChange={e => setState({ ...state, value: e.target.value, note: '' })}
        />
      </div>
      <div className="row" style={{ gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        <span className="help mono" data-conv>
          {conv}
        </span>
        <button className="btn btn-ghost btn-dense" data-swap style={{ marginInlineStart: 'auto' }} onClick={swap}>
          {state.lira ? t('Switch to USD', 'التحويل إلى الدولار') : t('Switch to LBP', 'التحويل إلى الليرة')}
        </button>
      </div>
      {stale ? (
        <div className="alert alert-warning" style={{ marginTop: 10 }}>
          <Icon name="warn" size={18} />
          <span>
            {t('The parish rate was last set 6 days ago.', 'آخر ضبط لسعر الرعية قبل ٦ أيام.')}
            <span className="act">
              <button data-rate onClick={() => document.getElementById('userbtn')?.click()}>
                {t('Update it', 'حدّثه')}
              </button>
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export const SplitCurrency = () => (
  <div className="formrow">
    <label className="label">{t('Given in both currencies', 'مُعطى بالعملتين')}</label>
    <div className="formgrid" style={{ gap: 10 }}>
      <div className="field">
        <span className="prefix">$</span>
        <input
          className="value"
          defaultValue="900.00"
          dir="ltr"
          style={{ border: 0, background: 'none', width: '100%' }}
        />
      </div>
      <div className="field">
        <span className="prefix">L.L</span>
        <input
          className="value"
          defaultValue="31,325,000"
          dir="ltr"
          style={{ border: 0, background: 'none', width: '100%' }}
        />
      </div>
    </div>
    <span className="help">
      {t('Total recorded:', 'المسجَّل إجمالاً:')} <b className="mono">$1,250.00</b> {t('equivalent.', 'ما يعادل.')}
    </span>
  </div>
);

export function PhoneField({
  label = t('Mobile', 'الخلوي'),
  value = '3 421 887',
  state = '',
  id = 'ph',
  required = true
}) {
  const [typed, setTyped] = useState(null);
  const digits = typed == null ? '' : typed.replace(/\D/g, '').replace(/^0/, '');
  const ok = typed == null ? state !== 'error' : digits.length === 7 || digits.length === 0;
  return (
    <div className="formrow">
      <label className="label" htmlFor={id}>
        {label}
        {required ? <span className="req">*</span> : null}
      </label>
      <div className="field" style={ok ? undefined : { borderColor: 'var(--danger)' }}>
        <span className="prefix">+961</span>
        <input
          id={id}
          className="value"
          defaultValue={value}
          dir="ltr"
          style={{ border: 0, background: 'none', width: '100%' }}
          data-phone
          onInput={e => setTyped(e.target.value)}
        />
        {typed == null && ok && value ? (
          <span style={{ display: 'flex', alignItems: 'center', paddingInlineEnd: 10 }}>
            <span className="pill pill-success">
              <span className="dot"></span>
              {t('on WhatsApp', 'على واتساب')}
            </span>
          </span>
        ) : null}
      </div>
      <span className={'help ' + (ok ? '' : 'help-error')} data-phonehelp>
        {!ok
          ? t('A Lebanese mobile has 7 digits after the prefix.', 'الخلوي اللبناني ٧ أرقام بعد المقدّمة.')
          : typed != null
            ? t('Leading zero is dropped automatically.', 'يُحذف الصفر تلقائياً.')
            : t(
                'Leading zero is dropped automatically. 03, 70, 71, 76, 78, 79, 81 are recognised as mobile.',
                'يُحذف الصفر تلقائياً. 03 و70 و71 و76 و78 و79 و81 تُعرَف كخلوي.'
              )}
      </span>
    </div>
  );
}

export const NamePair = () => (
  <div className="formgrid">
    <div className="formrow">
      <label className="label" htmlFor="latname">
        {t('English name', 'الاسم الإنكليزي')}
        <span className="req">*</span>
      </label>
      <input className="input" id="latname" dir="ltr" placeholder="Georges Haddad" />
    </div>
    <div className="formrow">
      <label className="label" htmlFor="arname">
        {t('Arabic name', 'الاسم العربي')}
        <span className="req">*</span>
      </label>
      <input className="input" id="arname" dir="rtl" style={{ fontFamily: 'var(--arabic)' }} placeholder="جورج حدّاد" />
    </div>
  </div>
);

export const RiteSelect = ({ id = 'newrite' }) => (
  <div className="formrow">
    <label className="label">
      {t('Rite', 'الطقس')}
      <span className="req">*</span>
    </label>
    <Select id={id}>
      {[
        ['Maronite', 'ماروني'],
        ['Greek Orthodox', 'روم أرثوذكس'],
        ['Melkite', 'روم كاثوليك'],
        ['Armenian', 'أرمني'],
        ['Syriac', 'سرياني'],
        ['Roman Catholic', 'روم كاثوليك غربي'],
        ['Evangelical', 'إنجيلي']
      ].map(r => (
        <option key={r[0]} value={r[0]}>
          {t(...r)}
        </option>
      ))}
    </Select>
    <span className="help">
      {t(
        'Changing the rite changes the sacraments available and the feast calendar. Existing records keep the rite they were entered under.',
        'تغيير الطقس يغيّر الأسرار المتاحة ورزنامة الأعياد. والسجلات القائمة تحتفظ بالطقس الذي أُدخلت به.'
      )}
    </span>
  </div>
);

/* ---------------- choosing ---------------- */
export function ChipField({ label, tags, help = '' }) {
  const [list, setList] = useState(tags),
    input = useRef(null);
  return (
    <div className="formrow">
      <label className="label">{label}</label>
      <div
        className="chipfield"
        data-chipfield
        onClick={e => {
          if (e.target === e.currentTarget) input.current.focus();
        }}
      >
        {list.map((x, i) => (
          <span key={i + x} className="tag">
            {x}
            <button aria-label={t('Remove', 'إزالة')} onClick={() => setList(list.filter((_, k) => k !== i))}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
        <input
          placeholder={t('Add…', 'أضف…')}
          ref={input}
          onKeyDown={e => {
            const v = e.target.value.trim();
            if (e.key === 'Enter' && v) {
              e.preventDefault();
              setList([...list, v]);
              e.target.value = '';
            } else if (e.key === 'Backspace' && !e.target.value) setList(list.slice(0, -1));
          }}
        />
      </div>
      <span className="help">
        {help || t('Backspace on an empty field removes the last chip.', 'مسافة للخلف في حقل فارغ تحذف آخر وسم.')}
      </span>
    </div>
  );
}

/* Choosing a person by typing a name in either script; someone not yet on file can be added as a visitor. */
export function PersonPicker({ label = t('Person', 'الشخص'), id = 'pp' }) {
  const [q, setQ] = useState(''),
    [open, setOpen] = useState(false),
    input = useRef(null);
  const hits = q ? PEOPLE.filter(p => matches(`${p.lat} ${p.ar} ${p.phone}`, q)).slice(0, 6) : [];
  const choose = value => {
    input.current.value = value;
    setOpen(false);
  };
  return (
    <div className="formrow">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="ac" data-ac={id}>
        <input
          className="input"
          id={id}
          autoComplete="off"
          placeholder={t('Type a name in either script', 'اكتب الاسم بأي حرف')}
          ref={input}
          onInput={e => {
            setQ(e.target.value);
            setOpen(!!e.target.value);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
        />
        <div className="ac-list" hidden={!open || !q}>
          {!q ? null : hits.length ? (
            hits.map(p => (
              <button key={p.id} className="ac-opt" data-pid={p.id} onClick={() => choose(isAr() ? p.ar : p.lat)}>
                <Avatar p={p} cls="avatar-sm" />
                <span>
                  <b>{isAr() ? p.ar : p.lat}</b>
                  <small>
                    {isAr() ? p.lat : p.ar} · {t(p.town, p.townAr)}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <div className="ac-none">
              {t('No match.', 'لا نتيجة.')}
              <button
                className="btn btn-ghost btn-dense"
                data-create
                onMouseDown={e => {
                  e.preventDefault();
                  PEOPLE.unshift({
                    id: 'p' + Date.now(),
                    lat: q,
                    ar: q,
                    town: 'Hadath',
                    townAr: 'الحدث',
                    rite: 'Maronite',
                    status: 'visitor',
                    phone: '—',
                    born: '1990-01-01',
                    hh: null,
                    tags: []
                  });
                  choose(q);
                  toast(
                    t('Added as a visitor', 'أُضيف كزائر'),
                    t('Complete the record from People when you can.', 'أكمل السجل من صفحة المؤمنين لاحقاً.'),
                    'success'
                  );
                }}
              >
                {t('Create', 'إنشاء')} “{q}”
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* pref: a key in PREFS, so the choice is saved as it changes and remembered (see the portal's
   delegated data-pref handling). */
export function CheckRow({
  label,
  type = 'checkbox',
  checked = false,
  indet = false,
  note = '',
  id = '',
  pref = '',
  ...input
}) {
  const box = useRef(null);
  useLayoutEffect(() => {
    if (indet && box.current) box.current.indeterminate = true;
  }, [indet]);
  return (
    <label className="check">
      <input
        type={type}
        id={id || undefined}
        defaultChecked={pref && pref in PREFS ? PREFS[pref] : checked}
        data-indeterminate={indet ? '' : undefined}
        data-pref={pref || undefined}
        ref={box}
        {...input}
      />
      <span>
        {label}
        {note ? (
          <>
            {' '}
            <span className="dimmer">— {note}</span>
          </>
        ) : null}
      </span>
    </label>
  );
}
export const SwitchRow = ({ label, checked = false, note = '', pref = '', ...input }) => (
  <label className="switch">
    <input
      type="checkbox"
      defaultChecked={pref && pref in PREFS ? PREFS[pref] : checked}
      data-pref={pref || undefined}
      {...input}
    />
    <span>
      {label}
      {note ? (
        <>
          {' '}
          <span className="dimmer">— {note}</span>
        </>
      ) : null}
    </span>
  </label>
);

/* ---------------- date & time ---------------- */
export function DatePicker({ y: year = 2026, m: monthIndex = 9, sel: selected = 4 }) {
  const [at, setAt] = useState({ y: year, m: monthIndex, sel: selected });
  const { y, m } = at,
    first = new Date(y, m, 1),
    days = new Date(y, m + 1, 0).getDate(),
    lead = first.getDay();
  const go = d => setAt({ y: y + Math.floor((m + d) / 12), m: (m + d + 12) % 12, sel: 0 });
  return (
    <div className="dp" data-y={y} data-m={m} data-sel={at.sel}>
      <div className="dp-head">
        <IconBtn ico="chevL" label={t('Previous month', 'الشهر السابق')} data-dpnav="-1" onClick={() => go(-1)} />
        <b>
          {month(m)} {y}
        </b>
        <IconBtn ico="chevR" label={t('Next month', 'الشهر التالي')} data-dpnav="1" onClick={() => go(1)} />
      </div>
      <div className="dp-grid">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <span key={'d' + i} className="dow">
            {dayShort(i)}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <button key={'o' + i} className="out" tabIndex="-1">
            {new Date(y, m, -(lead - i - 1)).getDate()}
          </button>
        ))}
        {Array.from({ length: days }, (_, k) => {
          const d = k + 1,
            key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          return (
            <button
              key={d}
              className={`${d === at.sel ? 'sel' : ''} ${FEASTS[key] ? 'feast' : ''} ${d === 4 && m === 9 && y === 2026 ? 'today' : ''}`}
              title={FEASTS[key] ? t(...FEASTS[key]) : undefined}
              onClick={() => setAt({ ...at, sel: d })}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="dp-foot">
        <span className="dot"></span>
        {t('Feast day', 'يوم عيد')}
        <span style={{ marginInlineStart: 'auto' }}>7 Oct — {t('Our Lady of the Rosary', 'سيدة الورديّة')}</span>
      </div>
    </div>
  );
}

export const TimeField = () => (
  <div className="formrow">
    <label className="label">{t('Service time', 'وقت الخدمة')}</label>
    <div className="row" style={{ gap: 8 }}>
      <input className="input mono" defaultValue="10:30" style={{ maxWidth: 110 }} dir="ltr" />
      <BGroup items={['AM', 'PM']} sel={0} />
    </div>
    <span className="help">
      {t('The clock icon never mirrors in RTL.', 'أيقونة الساعة لا تنعكس في العربية أبداً.')}
    </span>
  </div>
);

export function DateRange() {
  const presets = [
    t('This week', 'هذا الأسبوع'),
    t('This month', 'هذا الشهر'),
    t('Last month', 'الشهر الماضي'),
    t('Year to date', 'منذ بداية السنة'),
    t('Since Easter', 'منذ الفصح'),
    t('Custom…', 'مخصّص…')
  ];
  const [on, setOn] = useState(3);
  return (
    <div className="formrow">
      <label className="label">{t('Date range', 'المدى الزمني')}</label>
      <input className="input mono" defaultValue="1 Jan – 30 Sep 2026" dir="ltr" style={{ maxWidth: 260 }} />
      <div className="presets" style={{ marginTop: 10 }}>
        {presets.map((l, i) => (
          <button key={i} aria-pressed={i === on} onClick={() => setOn(i)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- uploads ---------------- */
/* Files appear above the drop area immediately; success comes from the server. */
export function Dropzone({ id = 'dz', scope = '', ownerId = '', readOnly = false }) {
  const [files, setFiles] = useState(null),
    [pending, setPending] = useState([]),
    [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const load = async () => {
    if (!scope) return;
    try {
      const data = await parishAPI(`files?scope=${encodeURIComponent(scope)}&id=${encodeURIComponent(ownerId)}`);
      setFiles(data.files);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, [scope, ownerId]);
  const take = async list => {
    for (const f of list) {
      const supported = /\.(jpe?g|png|pdf)$/i.test(f.name),
        large = f.size > 10_000_000,
        key = Math.random();
      const row = {
        key,
        name: f.name,
        err: !supported || large,
        note: large
          ? t('File is larger than 10 MB', 'الملف أكبر من ١٠ ميغابايت')
          : !supported
            ? t('Use JPG, PNG or PDF', 'استخدم JPG أو PNG أو PDF')
            : scope
              ? t('Uploading…', 'جارٍ الرفع…')
              : t('Selected for preview only', 'مختار للمعاينة فقط')
      };
      setPending(p => [row, ...p]);
      if (!supported || large || !scope) continue;
      const bytes = new Uint8Array(await f.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      try {
        await parishAPI('files', 'POST', { scope, id: ownerId, name: f.name, data: btoa(binary) });
        setPending(p => p.filter(x => x.key !== key));
        await load();
        toast(t('File uploaded', 'رُفع الملف'), f.name, 'success');
      } catch (e) {
        setPending(p => p.map(x => (x.key === key ? { ...x, err: true, note: e.message } : x)));
      }
    }
  };
  const remove = async fileId => {
    try {
      await parishAPI(`files/${encodeURIComponent(fileId)}`, 'DELETE', {});
      await load();
    } catch (e) {
      toast(t('Could not delete file', 'تعذّر حذف الملف'), e.message, 'danger');
    }
  };
  return (
    <>
      <div
        className="files"
        data-files={id}
        data-upload-scope={scope}
        data-upload-owner={ownerId}
        data-files-readonly={String(readOnly)}
      >
        {pending.map(f => (
          <div key={f.key} className={'filerow' + (f.err ? ' err' : '')}>
            <Icon name={f.err ? 'warn' : 'doc'} size={18} cls="dimmer" />
            <span className="grow">
              <b>{f.name}</b>
              <small>{f.note}</small>
            </span>
          </div>
        ))}
        {error ? (
          <p className="help help-error">{error}</p>
        ) : files ? (
          files.length ? (
            files.map(f => (
              <div key={f.id} className="filerow">
                <Icon name="doc" size={18} cls="dimmer" />
                <span className="grow">
                  <b>{f.name}</b>
                  <small>
                    {(f.size / 1048576).toFixed(1)} MB · {f.created_at.slice(0, 10)}
                  </small>
                </span>
                <a
                  className="btn btn-secondary btn-dense"
                  href={`/api/parishes/${encodeURIComponent(session.parishId)}/files/${encodeURIComponent(f.id)}`}
                  target="_blank"
                  rel="noopener"
                >
                  {t('Open', 'فتح')}
                </a>
                {readOnly ? null : (
                  <button
                    className="btn-icon"
                    data-delete-file={f.id}
                    aria-label={t('Delete file', 'حذف الملف')}
                    onClick={() => remove(f.id)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="help">{t('No attachments yet.', 'لا مرفقات بعد.')}</p>
          )
        ) : null}
      </div>
      {readOnly ? null : (
        <div
          className={'drop' + (over ? ' over' : '')}
          data-drop={id}
          onDragEnter={e => {
            e.preventDefault();
            setOver(true);
          }}
          onDragOver={e => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={e => {
            e.preventDefault();
            setOver(false);
          }}
          onDrop={e => {
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files);
          }}
        >
          <Icon name="export" size={26} />
          <b style={{ marginTop: 8 }}>
            {t('Drop the file here, or', 'أفلت الملف هنا، أو')}{' '}
            <label className="linkbtn">
              {t('choose a file', 'اختر ملفاً')}
              <input
                type="file"
                multiple
                hidden
                data-pick={id}
                accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf"
                onChange={e => {
                  take(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </b>
          <span className="hint">
            {scope
              ? t(
                  'JPG, PNG or PDF up to 10 MB. Files are saved to this parish.',
                  'JPG أو PNG أو PDF حتى ١٠ ميغابايت. تُحفظ الملفات في هذه الرعية.'
                )
              : t('Select a file to preview this control.', 'اختر ملفاً لمعاينة هذا العنصر.')}
          </span>
        </div>
      )}
    </>
  );
}

export function AvatarUpload({ k = 'specimen' }) {
  const ph = PHOTOS[k],
    label = k === 'parish' ? 'P' : k === 'new' || k === 'specimen' ? 'GH' : initials(person(k));
  return (
    <div className="row" style={{ gap: 16, alignItems: 'flex-start' }} data-photo={k}>
      <span
        className={'avatar avatar-xl ' + (ph ? 'has-photo' : '')}
        style={ph ? { backgroundImage: `url(${ph})` } : undefined}
      >
        {ph ? '' : label}
      </span>
      <div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-dense" data-act={`avatar-upload:${k}`}>
            <Icon name="export" size={16} />
            {ph ? t('Change photo', 'تغيير الصورة') : t('Upload photo', 'رفع صورة')}
          </button>
          {ph ? (
            <button className="btn btn-ghost btn-dense" data-act={`avatar-remove:${k}`}>
              {t('Remove', 'إزالة')}
            </button>
          ) : null}
        </div>
        <p className="help" style={{ marginTop: 8, maxWidth: '38ch' }}>
          {t(
            'Initials are the fallback and are generated from the English name. Square crop, 1:1, minimum 200px.',
            'الأحرف الأولى هي البديل وتُولَّد من الاسم الإنكليزي. قصّ مربّع ١:١، ٢٠٠ بكسل كحدّ أدنى.'
          )}
        </p>
      </div>
    </div>
  );
}

/* ---------------- rich text ---------------- */
function LinkPopover({ range }) {
  const input = useRef(null);
  useEffect(() => {
    input.current.focus();
  }, []);
  const apply = () => {
    const url = input.current.value.trim();
    if (!/^https?:\/\//i.test(url))
      return toast(t('Use an http or https link', 'استخدم رابط http أو https'), '', 'warning');
    closeMenu();
    if (!range) return;
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('createLink', false, url);
  };
  return (
    <div style={{ padding: 12 }}>
      <label className="label" htmlFor="rtel">
        {t('Link address', 'عنوان الرابط')}
      </label>
      <input
        className="input"
        id="rtel"
        dir="ltr"
        placeholder="https://"
        ref={input}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply();
          }
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn btn-primary btn-dense" id="rtego" style={{ marginInlineStart: 'auto' }} onClick={apply}>
          {t('Add link', 'إضافة رابط')}
        </button>
      </div>
    </div>
  );
}
/* The editor's text is the editor's own: it is set once, and read back from the element (body ref). */
export const RichText = forwardRef(function RichText({ body = '' }, ref) {
  const area = useRef(null);
  useImperativeHandle(ref, () => area.current);
  useLayoutEffect(() => {
    area.current.innerHTML = body;
  }, []);
  /* mousedown only keeps the selection in the text; the command runs on click, so Enter and Space work too */
  const command = (kind, button) => {
    const text = area.current;
    if (kind === 'emoji') {
      openPopover(
        button,
        <div style={{ display: 'flex', gap: 6, padding: 10 }}>
          {['🙏', '❤️', '✨', '🎵', '📅', '😊'].map(value => (
            <button
              key={value}
              className="btn btn-secondary btn-dense"
              data-emoji={value}
              aria-label={value}
              onClick={() => {
                text.focus();
                document.execCommand('insertText', false, value);
                closeMenu();
              }}
            >
              {value}
            </button>
          ))}
        </div>,
        { width: 310 }
      );
      return;
    }
    const cmd = { bold: 'bold', underline: 'underline', list: 'insertUnorderedList' }[kind];
    if (cmd) {
      if (!text.contains(getSelection().anchorNode)) {
        text.focus();
        getSelection().selectAllChildren(text);
        getSelection().collapseToEnd();
      } // nothing selected in this editor yet: work at its end
      document.execCommand(cmd);
      return;
    }
    const sel = getSelection(),
      range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    openPopover(button, <LinkPopover range={range} />, { width: 300 });
  };
  const B = ({ kind, children, ...props }) => (
    <button
      data-rte={kind}
      onMouseDown={e => e.preventDefault()}
      onClick={e => command(kind, e.currentTarget)}
      {...props}
    >
      {children}
    </button>
  );
  return (
    <div className="rte">
      <div className="rte-bar">
        <B kind="bold">
          <b>B</b>
        </B>
        <B kind="underline">
          <u>U</u>
        </B>
        <span className="sep"></span>
        <B kind="link">{t('Link', 'رابط')}</B>
        <B kind="list">{t('List', 'لائحة')}</B>
        <B kind="emoji" aria-label={t('Insert emoji', 'إدراج رمز تعبيري')}>
          ☺
        </B>
        <span className="sep"></span>
        <BGroup items={['EN', 'ع']} sel={isAr() ? 1 : 0} />
      </div>
      <div
        className="rte-body"
        contentEditable="true"
        suppressContentEditableWarning
        data-placeholder={t('Write an announcement…', 'اكتب إعلاناً…')}
        ref={area}
      ></div>
      <div className="rte-foot">
        {t(
          'Use bold, underline, links, lists and emoji.',
          'استخدم الغامق والتسطير والروابط واللوائح والرموز التعبيرية.'
        )}
      </div>
    </div>
  );
});

/* ---------------- menus (specimens for the design system) ---------------- */
export function FilterMenu({ title, opts }) {
  const box = useRef(null);
  return (
    <div className="menu" style={{ position: 'static', width: 260 }} ref={box}>
      <div className="head">{title}</div>
      <div style={{ padding: '0 4px 6px' }}>
        <SearchClear ph={t('Search status', 'ابحث في الحالات')} id="fm" />
      </div>
      {opts.map(([l, n, on]) => (
        <label key={l} className="opt">
          <input
            type="checkbox"
            defaultChecked={on}
            style={{
              appearance: 'none',
              width: 16,
              height: 16,
              border: '1.5px solid var(--border-strong)',
              borderRadius: 4
            }}
          />
          {l}
          <span className="n">{num(n)}</span>
        </label>
      ))}
      <div className="foot">
        <button className="btn btn-ghost btn-dense" data-act="filter-clear">
          {t('Clear', 'مسح')}
        </button>
        <button className="btn btn-primary btn-dense" data-act="filter-apply" style={{ marginInlineStart: 'auto' }}>
          {t('Apply', 'تطبيق')}
        </button>
      </div>
    </div>
  );
}

export const KebabMenu = () => (
  <div className="menu" style={{ position: 'static', width: 230 }}>
    <button data-act="person-edit:p1">
      <Icon name="edit" size={16} />
      {t('Edit record', 'تعديل السجل')}
    </button>
    <button data-go="people/duplicates">
      <Icon name="family" size={16} />
      {t('Find duplicates', 'البحث عن تكرار')}
    </button>
    <div className="sub">
      <button data-go="certificate/sc6/bilingual">
        <Icon name="doc" size={16} />
        {t('Certificate', 'شهادة')}
        <span style={{ marginInlineStart: 'auto' }}>
          <Icon name="chevR" size={14} />
        </span>
      </button>
    </div>
    <button data-act="archive-specimen">
      <Icon name="trash" size={16} />
      {t('Archive', 'أرشفة')}
    </button>
    <div className="sep"></div>
    <button className="danger" data-act="spec-delete">
      <Icon name="trash" size={16} />
      {t('Delete permanently', 'حذف نهائي')}
    </button>
  </div>
);

export const BulkBar = ({ n }) => (
  <div className="bulkbar">
    <b>
      {num(n)} {t('selected', 'محدَّد')}
    </b>
    <button className="btn btn-secondary" data-act="bulk-message">
      <Icon name="msg" size={16} />
      {t('Message', 'مراسلة')}
    </button>
    <button className="btn btn-secondary" data-act="bulk-group">
      <Icon name="groups" size={16} />
      {t('Add to group', 'إضافة إلى مجموعة')}
    </button>
    <button className="btn btn-secondary" data-act="bulk-export">
      <Icon name="export" size={16} />
      {t('Export', 'تصدير')}
    </button>
    <button className="btn btn-secondary last" data-act="bulk-archive">
      <Icon name="trash" size={16} />
      {t('Archive', 'أرشفة')}
    </button>
  </div>
);

export const RatePopover = ({ amount = 50 }) => (
  <div className="popover" style={{ position: 'static', width: 'auto', padding: '14px 16px' }}>
    <b style={{ display: 'block', font: '600 13px/18px var(--sans)', marginBottom: 10 }}>
      {t('How the LBP figure is worked out', 'كيف يُحتسب المبلغ بالليرة')}
    </b>
    <dl className="dl" style={{ fontSize: 13 }}>
      <dt>{t('Amount', 'المبلغ')}</dt>
      <dd className="mono">{usd(amount)}</dd>
      <dt>{t('Parish rate', 'سعر الرعية')}</dt>
      <dd className="mono">{num(RATE.value)}</dd>
      <dt>{t('In LBP', 'بالليرة')}</dt>
      <dd className="mono">{num(amount * RATE.value)}</dd>
    </dl>
    <p className="t-caption dim" style={{ marginTop: 10 }}>
      {t('Set by Fr. Antoine on 4 Oct 2026.', 'ضبطه الأب أنطوان في ٤ تشرين الأول ٢٠٢٦.')}{' '}
      <a href="#/settings">{t('Rate history', 'سجل الأسعار')}</a>
    </p>
  </div>
);

/* ---------------- feedback ---------------- */
export const InlineAlert = ({ tone, title, body, actions }) => (
  <div className={`alert alert-${tone}`}>
    <Icon name={tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'warn'} size={18} />
    <span>
      <b>{title}</b>
      {body}
      {actions ? <span className="act">{actions}</span> : null}
    </span>
  </div>
);

export const SkeletonRows = ({ n = 4 }) =>
  Array.from({ length: n }, (_, i) => (
    <div key={i} className="skel-row">
      <span className="skel" style={{ width: 28, height: 28, borderRadius: 99 }}></span>
      <span className="skel" style={{ width: '32%', height: 12 }}></span>
      <span className="skel" style={{ width: '18%', height: 12 }}></span>
      <span className="skel" style={{ width: '14%', height: 12, marginInlineStart: 'auto' }}></span>
    </div>
  ));

/* ---------------- charts ---------------- */
export function Sparkline({ values, w = 240, h = 40, tone = 'var(--primary)' }) {
  if (!values || values.length < 2) return null; /* no trend to draw (e.g. giving hidden from this role) */
  const max = Math.max(...values),
    min = Math.min(...values),
    span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / span) * (h - 6) - 3]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={tone} opacity=".10" />
      <path d={d} fill="none" stroke={tone} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const Kpi = ({ k, v, sub, delta, dir = 'up', spark = null }) => (
  <div className="kpi">
    <div className="k">{k}</div>
    <div className="v">{v}</div>
    {sub ? <div className="sub">{sub}</div> : null}
    {delta ? (
      <div className={'delta ' + dir}>
        <Icon name="arrowR" size={13} />
        {delta}
      </div>
    ) : null}
    {spark ? <Sparkline values={spark} /> : null}
  </div>
);

export const BarChart = ({ rows }) => (
  <div className="barchart">
    {rows.map((r, i) => {
      const pct = Math.min(140, Math.round((r.v / r.max) * 100));
      return (
        <div key={i} className="row">
          <div className="top">
            <span>{r.label}</span>
            <span className="v" dir="ltr">
              {r.text ?? `${usd(r.v)} / ${usd(r.max)}`}
            </span>
          </div>
          <div className="track">
            <i className={pct > 100 ? 'over' : ''} style={{ width: Math.min(100, pct) + '%' }}></i>
            {pct > 100 ? <span className="goal" style={{ insetInlineStart: '100%' }}></span> : null}
          </div>
          {pct > 100 ? (
            <div className="t-caption" style={{ color: 'var(--danger-ink)', marginTop: 4 }}>
              {pct}% — {t('over budget', 'تجاوز الموازنة')}
            </div>
          ) : null}
        </div>
      );
    })}
  </div>
);

export function Donut({ segments, size = 132 }) {
  const chartPalette = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
  const segs = segments.map((segment, index) => ({ ...segment, color: chartPalette[index % chartPalette.length] }));
  const total = segs.reduce((a, s) => a + s.v, 0);
  const r = size / 2 - 11,
    c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="donut">
      <svg width={size} height={size} aria-hidden="true">
        {segs.map((s, i) => {
          const len = (s.v / total) * c,
            ring = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={`${len.toFixed(2)} ${(c - len).toFixed(2)}`}
                strokeDashoffset={(-off).toFixed(2)}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
          off += len;
          return ring;
        })}
      </svg>
      <div className="legend">
        {segs.map((s, i) => (
          <span key={i}>
            <i style={{ background: s.color }}></i>
            {s.label}
            <b className="v">{Math.round((s.v / total) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- designed dropdowns ----------------
   Every <Select> gets the design system's own list: a trigger that looks like the field and a
   listbox drawn like the menus. Arrow keys, Home/End, type-ahead, Enter and Esc work, long lists
   get a filter box, and it mirrors in Arabic. The native select stays underneath and keeps the
   value, so forms, change handlers and reads of .value are untouched. Touch screens keep the
   phone's own picker, which is the better control there. */
const fine = () => matchMedia('(pointer: fine)').matches;
let ddN = 0;
function DropList({ sel, btn, onClose }) {
  const list = useRef(null),
    q = useRef(null);
  const opts = [...sel.options],
    searchable = opts.length > 8,
    rtl = document.documentElement.dir === 'rtl';
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(
    Math.max(
      0,
      opts.findIndex(o => o.selected)
    )
  );
  const visible = opts.map((o, i) => ({ o, i })).filter(({ o }) => !filter || matches(o.textContent, filter));
  const place = () => {
    if (!btn.isConnected) return onClose();
    const r = btn.getBoundingClientRect(),
      el = list.current;
    el.style.minWidth = `${Math.max(r.width, 180)}px`;
    const h = el.offsetHeight,
      w = el.offsetWidth,
      below = innerHeight - r.bottom - 12;
    el.style.top = `${below < h && r.top - 12 > below ? r.top - h - 6 : r.bottom + 6}px`; // flip up near the bottom
    el.style.left = `${Math.max(8, Math.min(rtl ? r.right - w : r.left, innerWidth - w - 8))}px`;
  };
  const pick = i => {
    if (i == null || opts[i]?.disabled) return;
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    onClose(true);
  };
  const typed = useRef({ text: '', at: 0 });
  const position = Math.max(
    0,
    visible.findIndex(v => v.i === active)
  );
  const move = n => {
    if (visible.length) setActive(visible[(position + n + visible.length) % visible.length].i);
  };
  useLayoutEffect(() => {
    place();
    let raf = requestAnimationFrame(function follow() {
      place();
      raf = requestAnimationFrame(follow);
    }); // keeps up with a drawer still sliding in
    const onKey = e => {
      const k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        keys.current.move(k === 'ArrowDown' ? 1 : -1);
      } else if (k === 'Home' && !searchable) {
        e.preventDefault();
        keys.current.to(0);
      } else if (k === 'End' && !searchable) {
        e.preventDefault();
        keys.current.to(-1);
      } else if (k === 'Enter') {
        e.preventDefault();
        keys.current.pick();
      } else if (k === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose(true);
      } else if (k === 'Tab') onClose();
      else if (!searchable && k.length === 1 && !e.metaKey && !e.ctrlKey) {
        // type-ahead jumps to the first match
        const now = Date.now();
        typed.current.text = (now - typed.current.at > 700 ? '' : typed.current.text) + k.toLowerCase();
        typed.current.at = now;
        keys.current.ahead(typed.current.text);
      }
    };
    const outside = e => {
      if (!list.current.contains(e.target) && !btn.contains(e.target)) onClose();
    };
    const onScroll = e => {
      if (!list.current.contains(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', outside, true);
    addEventListener('scroll', onScroll, true);
    addEventListener('resize', place);
    q.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', outside, true);
      removeEventListener('scroll', onScroll, true);
      removeEventListener('resize', place);
    };
  }, []);
  const keys = useRef({});
  keys.current = {
    move,
    pick: () => pick(visible[position]?.i),
    to: n => setActive(visible.at(n)?.i ?? active),
    ahead: text => {
      const hit = visible.find(({ o }) => o.textContent.trim().toLowerCase().startsWith(text));
      if (hit) setActive(hit.i);
    }
  };
  useEffect(() => {
    list.current.querySelector('.dd-opt.active')?.scrollIntoView({ block: 'nearest' });
    (q.current || btn).setAttribute('aria-activedescendant', `${btn.id}-o${active}`);
  }, [active]);
  return createPortal(
    <div className="dd" dir={rtl ? 'rtl' : 'ltr'} ref={list}>
      {searchable ? (
        <div className="dd-search">
          <Icon name="search" size={15} />
          <input
            className="dd-q"
            type="text"
            autoComplete="off"
            ref={q}
            value={filter}
            placeholder={t('Type to filter', 'اكتب للتصفية')}
            aria-label={t('Filter the list', 'تصفية اللائحة')}
            aria-controls={`${btn.id}-list`}
            onChange={e => {
              setFilter(e.target.value);
              const first = opts.findIndex(o => matches(o.textContent, e.target.value));
              if (first > -1) setActive(first);
            }}
          />
        </div>
      ) : null}
      <div className="dd-opts" role="listbox" id={`${btn.id}-list`}>
        {opts.map((o, i) => (
          <div
            key={i}
            className={'dd-opt' + (i === active ? ' active' : '')}
            role="option"
            id={`${btn.id}-o${i}`}
            data-i={i}
            aria-selected={o.selected}
            aria-disabled={o.disabled ? 'true' : undefined}
            hidden={filter && !matches(o.textContent, filter) ? true : undefined}
            onMouseMove={() => {
              if (i !== active) setActive(i);
            }}
            onClick={() => pick(i)}
          >
            <span>{o.textContent.trim()}</span>
            <Icon name="check" size={16} cls="dd-tick" />
          </div>
        ))}
      </div>
      <div className="dd-none" hidden={visible.length > 0}>
        {t('Nothing matches', 'لا شيء يطابق')}
      </div>
    </div>,
    document.body
  );
}

export const Select = forwardRef(function Select({ className = 'select', children, style, id, ...props }, ref) {
  const sel = useRef(null),
    btn = useRef(null);
  useImperativeHandle(ref, () => sel.current);
  const [enhanced] = useState(fine);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [btnId] = useState(() => (id ? `${id}-dd` : `dd${++ddN}`));
  /* the trigger shows the chosen option, whatever chose it */
  useLayoutEffect(() => {
    if (!enhanced) return;
    const now = sel.current.selectedOptions[0]?.textContent.trim() || '';
    if (now !== text) setText(now);
  });
  /* options a dialog redraws (a household's members, a town's streets) update the trigger too */
  useEffect(() => {
    if (!enhanced) return undefined;
    const watch = new MutationObserver(() => setText(sel.current.selectedOptions[0]?.textContent.trim() || ''));
    watch.observe(sel.current, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!enhanced) return;
    const lab =
      (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
      sel.current.closest('.formrow')?.querySelector(':scope > .label');
    if (lab) {
      lab.id ||= `${btnId}-l`;
      if (lab.htmlFor) lab.htmlFor = btnId;
      btn.current.setAttribute('aria-labelledby', lab.id);
    } else if (props['aria-label']) btn.current.setAttribute('aria-label', props['aria-label']);
  }, []);
  const close = (focusBack = false) => {
    setOpen(false);
    btn.current?.removeAttribute('aria-activedescendant');
    if (focusBack && btn.current?.isConnected) btn.current.focus({ preventScroll: true });
  };
  if (!enhanced)
    return (
      <select ref={sel} className={className} id={id} style={style} {...props}>
        {children}
      </select>
    );
  return (
    <>
      <select
        ref={sel}
        className={className + ' dd-native'}
        id={id}
        style={style}
        tabIndex={-1}
        aria-hidden="true"
        data-dd="1"
        {...props}
        onChange={e => {
          setText(e.target.selectedOptions[0]?.textContent.trim() || '');
          props.onChange?.(e);
        }}
      >
        {children}
      </select>
      <button
        type="button"
        className="select dd-trigger"
        id={btnId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${btnId}-list` : undefined}
        style={style}
        disabled={props.disabled}
        ref={btn}
        onClick={() => setOpen(!open)}
        onKeyDown={e => {
          if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="dd-value">{text}</span>
      </button>
      {open ? <DropList sel={sel.current} btn={btn.current} onClose={close} /> : null}
    </>
  );
});
