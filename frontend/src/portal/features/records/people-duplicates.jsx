/* Purpose: reviewing the API's duplicate suggestions: record that a pair are different people (or need
   more information), compare and merge them with an explicit choice for every differing field, and undo a
   recent merge; dupCompare shows both records side by side, and the merge form says which record is kept and
   which value each differing field takes. Main members: dupDismiss, dupCompare, dupMerge, MergeHistory.
   Connected to GET people/duplicates, duplicates/decisions, merges/preview, merges and merges/{id}/unmerge. */
import { useEffect, useState } from 'react';
import { t, fmtDate } from '../../../lib/i18n.js';
import { DUPLICATES, PERSON_EXTRA, person } from '../../model/data.js';
import { hh } from './people-shared.jsx';
import { phonesText } from './people-fields.jsx';
import { hydrate } from '../../model/persist.js';
import { bus } from '../../model/store.js';
import {
  duplicateDecision,
  listMerges,
  mergePeople,
  previewMerge,
  unmerge
} from '../../model/modules/people-workflows.js';
import { openModal, closeOverlays, toast } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';

const FIELD = {
  GivenName: ['First name', 'الاسم الأول'],
  FamilyName: ['Last name', 'اسم العائلة'],
  GivenNameAr: ['First name in Arabic', 'الاسم الأول بالعربية'],
  FamilyNameAr: ['Last name in Arabic', 'اسم العائلة بالعربية'],
  BirthDate: ['Date of birth', 'تاريخ الميلاد'],
  Phones: ['Phone numbers', 'أرقام الهاتف'],
  Contact: ['Other contact', 'جهة اتصال أخرى'],
  Rite: ['Rite', 'الطقس'],
  RegisterStatus: ['Status', 'الحالة']
};
const fieldName = f => (FIELD[f] ? t(...FIELD[f]) : f);
const STATUS_LABEL = { member: ['Member', 'منتسب'], visitor: ['Visitor', 'زائر'] };
const valueOf = (p, f) =>
  p
    ? {
        GivenName: p.given,
        FamilyName: p.family,
        GivenNameAr: p.givenAr,
        FamilyNameAr: p.familyAr,
        BirthDate: p.born ? fmtDate(p.born) : '',
        Phones: p.phoneFromContact ? '' : (p.phones || []).length ? phonesText(p.phones) : '',
        Contact: p.contact,
        Rite: p.rite,
        RegisterStatus: STATUS_LABEL[p.status] ? t(...STATUS_LABEL[p.status]) : ''
      }[f] || ''
    : '';

/* Every field of both people, next to each other, with the rows that differ marked. */
const COMPARE = [
  ['Name', 'الاسم', p => p.lat],
  ['Arabic name', 'الاسم بالعربية', p => p.arStored || ''],
  ['Date of birth', 'تاريخ الولادة', p => (p.born ? fmtDate(p.born) : '')],
  ['Phone numbers', 'أرقام الهاتف', p => ((p.phones || []).length ? phonesText(p.phones) : '')],
  ['Town', 'البلدة', p => (p.town ? t(p.town, p.townAr || p.town) : '')],
  ['Household', 'العائلة', p => (hh(p.hh) ? t(hh(p.hh).name, hh(p.hh).ar) : '')],
  ['Rite', 'الطقس', p => p.rite],
  ['Status', 'الحالة', p => (STATUS_LABEL[p.status] ? t(...STATUS_LABEL[p.status]) : '')],
  ['Line of work', 'المهنة', p => PERSON_EXTRA[p.id]?.occupation || ''],
  ['Added on', 'أُضيف في', p => (p.createdAt ? fmtDate(String(p.createdAt).slice(0, 10)) : '')]
];

export function dupCompare(i) {
  const d = DUPLICATES[+i];
  if (!d) return;
  const a = person(d.a.id) || d.a,
    b = person(d.b.id) || d.b;
  openModal({
    wide: true,
    title: t('Both records side by side', 'السجلّان جنباً إلى جنب'),
    sub: (d.signals || []).join(' · '),
    body: (
      <table className="tbl" data-dup-side-by-side="">
        <thead>
          <tr>
            <th>{t('Field', 'الحقل')}</th>
            <th>
              <a href={`#/person/${a.id}`}>{a.lat}</a>
            </th>
            <th>
              <a href={`#/person/${b.id}`}>{b.lat}</a>
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARE.map(([en, ar, get]) => {
            const x = get(a) || '—',
              y = get(b) || '—';
            return (
              <tr key={en} style={x !== y ? { background: 'var(--warning-subtle)' } : undefined}>
                <th scope="row">
                  {t(en, ar)}
                  {x !== y ? <span className="t-caption dim"> · {t('differs', 'مختلف')}</span> : null}
                </th>
                <td dir="auto">{x}</td>
                <td dir="auto">{y}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    ),
    foot: (
      <button className="btn btn-secondary" data-close="">
        {t('Close', 'إغلاق')}
      </button>
    )
  });
}

function Form({ submit, run, children }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        try {
          await run(Object.fromEntries(new FormData(e.currentTarget)));
          closeOverlays();
          await hydrate();
          bus.refresh();
        } catch (err) {
          setError(err.message);
          setBusy(false);
        }
      }}
    >
      {children}
      <p role="alert" className="help-error">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {submit}
      </button>
    </form>
  );
}
const Row = ({ label, children }) => (
  <label className="formrow">
    <span className="label">{label}</span>
    {children}
  </label>
);

export function dupDismiss(i) {
  const d = DUPLICATES[+i];
  if (!d) return;
  openModal({
    title: t('They are not duplicates', 'ليسا مكرَّرين'),
    sub: `${d.a.lat} · ${d.b.lat}`,
    body: (
      <Form
        submit={t('Save', 'حفظ')}
        run={f =>
          duplicateDecision(d.a.id, d.b.id, f.decision, f.reason).then(() => toast(t('Saved', 'حُفظ'), '', 'success'))
        }
      >
        <Row label={t('Decision', 'القرار')}>
          <Select name="decision">
            <option value="different">
              {t('Different people: do not suggest again', 'شخصان مختلفان: لا تقترحهما ثانية')}
            </option>
            <option value="need-information">{t('Need more information', 'نحتاج معلومات أكثر')}</option>
          </Select>
        </Row>
        <Row label={t('Reason', 'السبب')}>
          <textarea className="input" name="reason" maxLength={1000} required />
        </Row>
      </Form>
    )
  });
}

function MergeForm({ keep, drop, preview }) {
  const [survivor, source] = [keep, drop];
  return (
    <Form
      submit={t('Merge into the kept record', 'دمج في السجل الباقي')}
      run={f => {
        const choices = Object.fromEntries(preview.conflicts.map(c => [c, f['choice-' + c]]));
        return mergePeople(survivor.id, source.id, choices, f.reason).then(() =>
          toast(t('Records merged', 'دُمج السجلّان'), `${survivor.lat}`, 'success')
        );
      }}
    >
      {preview.needsPriest ? (
        <p className="help">
          {t(
            'A sacrament record is involved, so the parish priest must do this merge.',
            'يتعلّق الدمج بسجل سرّ، فيجريه كاهن الرعية.'
          )}
        </p>
      ) : null}
      <div className="grid g2" style={{ gap: '12px', marginBottom: '12px' }} data-merge-sides="">
        <div className="card card-flat" style={{ borderColor: 'var(--success-border)' }}>
          <span className="pill pill-success">{t('Kept record', 'السجل الباقي')}</span>
          <b style={{ display: 'block', marginTop: '6px' }}>{survivor.lat}</b>
          <span className="t-caption dim">
            {t('Stays in the register with its history.', 'يبقى في السجل مع تاريخه.')}
          </span>
        </div>
        <div className="card card-flat">
          <span className="pill pill-warning">{t('Merged into it', 'يُدمج فيه')}</span>
          <b style={{ display: 'block', marginTop: '6px' }}>{source.lat}</b>
          <span className="t-caption dim">
            {t('Archived after the merge; it can be undone.', 'يُؤرشف بعد الدمج؛ ويمكن التراجع.')}
          </span>
        </div>
      </div>
      {preview.conflicts.length ? (
        <p className="help">
          {t(
            'For each field that differs, choose which value the kept record will have.',
            'لكل حقل مختلف، اختر القيمة التي سيحملها السجل الباقي.'
          )}
        </p>
      ) : (
        <p className="help">{t('The two records hold the same values.', 'يحمل السجلّان القيم نفسها.')}</p>
      )}
      {preview.conflicts.map(c => (
        <fieldset key={c} className="formrow" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
          <legend className="label">{fieldName(c)}</legend>
          <div className="grid g2" style={{ gap: '8px' }}>
            <label className="check">
              <input type="radio" name={'choice-' + c} value="survivor" defaultChecked />
              <span>
                <span className="t-caption dim">{t('Keep the kept record’s value', 'إبقاء قيمة السجل الباقي')}</span>
                <b style={{ display: 'block' }} dir="auto">
                  {valueOf(person(survivor.id), c) || t('(empty)', '(فارغ)')}
                </b>
              </span>
            </label>
            <label className="check">
              <input type="radio" name={'choice-' + c} value="source" />
              <span>
                <span className="t-caption dim">
                  {t('Use the value from the merged record', 'استعمال قيمة السجل المدموج')}
                </span>
                <b style={{ display: 'block' }} dir="auto">
                  {valueOf(person(source.id), c) || t('(empty)', '(فارغ)')}
                </b>
              </span>
            </label>
          </div>
        </fieldset>
      ))}
      {Object.keys(preview.dependents).length ? (
        <p className="help">
          {t('These records keep pointing at the merged-away person: ', 'تبقى هذه السجلات مرتبطة بالشخص المدموج: ')}
          {Object.entries(preview.dependents)
            .map(([k, n]) => `${k} ×${n}`)
            .join(', ')}
        </p>
      ) : null}
      <Row label={t('Reason for merging', 'سبب الدمج')}>
        <textarea className="input" name="reason" maxLength={1000} required />
      </Row>
    </Form>
  );
}

export async function dupMerge(i) {
  const d = DUPLICATES[+i];
  if (!d) return;
  const radio = document.querySelector(`input[name="keep${i}"]:checked`);
  const second = radio && [...document.querySelectorAll(`input[name="keep${i}"]`)].indexOf(radio) === 1;
  // an account-linked person must be the one that stays
  const keep = d.b.linked && !d.a.linked ? d.b : d.a.linked && !d.b.linked ? d.a : second ? d.b : d.a;
  const drop = keep === d.a ? d.b : d.a;
  try {
    const preview = await previewMerge(keep.id, drop.id);
    if (preview.sourceLinked)
      return toast(
        t('Keep the person with an account', 'أبقِ الشخص صاحب الحساب'),
        t(
          'Both are linked to accounts; resolve that through identity review first.',
          'كلاهما مرتبط بحساب؛ عالج ذلك بمراجعة الهوية أولاً.'
        ),
        'warning'
      );
    openModal({
      title: t('Compare and merge', 'قارن وادمج'),
      sub: `${t('Keeping', 'الإبقاء على')} ${keep.lat}; ${drop.lat} ${t('is archived', 'يُؤرشف')}`,
      body: <MergeForm keep={keep} drop={drop} preview={preview} />
    });
  } catch (err) {
    toast(t('Could not compare', 'تعذّرت المقارنة'), err.message, 'danger');
  }
}

/* Recent merges, each with an undo while the kept person is unchanged. */
export function MergeHistory() {
  const [rows, setRows] = useState([]);
  const [round, setRound] = useState(0);
  useEffect(() => {
    listMerges().then(setRows, () => {});
  }, [round]);
  if (!rows.length) return null;
  return (
    <section className="panel" style={{ marginTop: '20px' }}>
      <div className="panel-h">
        <h3>{t('Merges', 'عمليات الدمج')}</h3>
      </div>
      <div className="panel-b">
        {rows.map(m => (
          <div key={m.id} className="listrow">
            <span className="grow">
              {person(m.survivorId)?.lat || m.survivorId} ← {person(m.sourceId)?.lat || m.sourceId}
              <span className="dim t-caption">
                {' '}
                · {fmtDate(String(m.at).slice(0, 10))} · {m.reason}
              </span>
            </span>
            {m.status === 'Merged' ? (
              <button
                className="btn btn-ghost btn-dense"
                onClick={() =>
                  openModal({
                    title: t('Undo this merge', 'التراجع عن الدمج'),
                    body: (
                      <Form
                        submit={t('Undo merge', 'تراجع')}
                        run={f => unmerge(m, f.reason).then(() => setRound(r => r + 1))}
                      >
                        <Row label={t('Reason', 'السبب')}>
                          <textarea className="input" name="reason" maxLength={1000} required />
                        </Row>
                      </Form>
                    )
                  })
                }
              >
                {t('Undo', 'تراجع')}
              </button>
            ) : (
              <span className="dim t-caption">{t('Undone', 'مُلغى')}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
