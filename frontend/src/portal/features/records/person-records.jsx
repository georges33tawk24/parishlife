/* Purpose: the parts of a person's record that come from their own ParishLife.Api routes rather than from
   the people list: the load of their facts, consents and relationships; consents (recorded from the paper
   form, withdrawn with a reason); the medical declaration for designated staff; and relationships.
   Main members: PersonLoader, ConsentPanel, MedicalPanel, RelationshipPanel, reloadPerson. */
import { useEffect, useState } from 'react';
import { t, fmtDate } from '../../../lib/i18n.js';
import { bus } from '../../model/store.js';
import { hydrate } from '../../model/persist.js';
import {
  addRelationship,
  detail,
  endRelationship,
  openPerson,
  recordConsent,
  saveMedical,
  searchPeople,
  withdrawConsent
} from '../../model/modules/people-workflows.js';
import { Panel, openModal, closeOverlays } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';

const opened = new Map(); // person id → when it was last read, so a refresh does not read it again at once

export async function reloadPerson(id) {
  opened.set(id, Date.now());
  const first = await openPerson(id);
  if (first) await hydrate();
  bus.refresh();
}

/* Reads the person's facts, consents and relationships when their page opens. */
export function PersonLoader({ id }) {
  useEffect(() => {
    if (Date.now() - (opened.get(id) || 0) < 15000) return;
    reloadPerson(id).catch(() => {});
  }, [id]);
  return null;
}

/* A short form in a dialog: run(form) does the work, then the person is read again. */
function Form({ id, submit, children, run }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        try {
          await run(Object.fromEntries(new FormData(e.currentTarget)), e.currentTarget);
          closeOverlays();
          await reloadPerson(id);
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
const askReason = (id, title, label, run) =>
  openModal({
    title,
    body: (
      <Form id={id} submit={t('Confirm', 'تأكيد')} run={form => run(form.reason)}>
        <Row label={label}>
          <textarea className="input" name="reason" maxLength={500} required />
        </Row>
      </Form>
    )
  });

/* ---------- consents ---------- */
const KINDS = {
  Directory: ['Printed directory', 'الدليل المطبوع'],
  Photo: ['Photos', 'الصور'],
  Communications: ['Communications', 'المراسلات'],
  Event: ['Events', 'الفعاليات'],
  Representation: ['Representing someone', 'تمثيل شخص']
};
const DIRECTORY_FIELDS = ['Name', 'Phone', 'Email', 'Address', 'Photo', 'Household'];
const STATUS = s => ({ Given: t('Given', 'مُعطاة'), Withdrawn: t('Withdrawn', 'مسحوبة') })[s] || s;

function ConsentForm({ id }) {
  const [kind, setKind] = useState('Directory');
  return (
    <Form
      id={id}
      submit={t('Record consent', 'تسجيل الموافقة')}
      run={(form, el) =>
        recordConsent(id, {
          ...form,
          kind,
          fields: [...el.querySelectorAll('[name="fields"]:checked')].map(c => c.value)
        })
      }
    >
      <Row label={t('Consent for', 'الموافقة على')}>
        <Select value={kind} onChange={e => setKind(e.target.value)}>
          {Object.entries(KINDS).map(([k, [en, ar]]) => (
            <option key={k} value={k}>
              {t(en, ar)}
            </option>
          ))}
        </Select>
      </Row>
      <Row label={t('Purpose', 'الغرض')}>
        <input className="input" name="purpose" maxLength={300} required />
      </Row>
      <Row label={t('Policy version', 'نسخة السياسة')}>
        <input className="input" name="policyVersion" maxLength={40} required />
      </Row>
      <Row label={t('Given by (name on the paper form)', 'مُعطي الموافقة (الاسم على الاستمارة)')}>
        <input className="input" name="givenBy" maxLength={200} required />
      </Row>
      {kind === 'Directory' ? (
        <div className="formrow">
          <span className="label">{t('Details the directory may show', 'ما يظهر في الدليل')}</span>
          <div className="choice-grid">
            {DIRECTORY_FIELDS.map(f => (
              <label key={f} className="row">
                <input type="checkbox" name="fields" value={f} />
                <span>{f}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </Form>
  );
}

export function ConsentPanel({ id }) {
  const rows = detail(id)?.consents;
  return (
    <Panel title={t('Consent', 'الموافقات')}>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button
          className="btn btn-secondary btn-dense"
          onClick={() =>
            openModal({
              title: t('Record a consent from a paper form', 'تسجيل موافقة من استمارة ورقية'),
              sub: t(
                'Entered by the office; it is kept as received on paper, with who gave it.',
                'يُدخلها المكتب، وتُحفظ كما وردت على الورق مع اسم مُعطيها.'
              ),
              body: <ConsentForm id={id} />
            })
          }
        >
          {t('Record a consent', 'تسجيل موافقة')}
        </button>
      </div>
      {!rows ? (
        <p className="t-caption dim">{t('Loading…', 'جارٍ التحميل…')}</p>
      ) : rows.length ? (
        <div className="timeline">
          {rows.map(row => {
            const c = row.value;
            return (
              <div key={c.id} className="tl-item">
                <div className="when">{fmtDate(String(c.givenAt).slice(0, 10))}</div>
                <div className="what">
                  <b>{t(...(KINDS[c.kind] || [c.kind, c.kind]))}</b> · {c.purpose}
                  <div className="t-caption dim">
                    {STATUS(c.status)} · {c.source} · {c.givenBy} · {t('policy', 'السياسة')} {c.policyVersion}
                    {c.fields.length ? ` · ${c.fields.join(', ')}` : ''}
                    {c.withdrawnAt
                      ? ` · ${t('withdrawn', 'سُحبت')} ${fmtDate(String(c.withdrawnAt).slice(0, 10))}${c.withdrawalReason ? ` (${c.withdrawalReason})` : ''}`
                      : ''}
                  </div>
                  {c.status === 'Given' ? (
                    <button
                      className="btn btn-ghost btn-dense"
                      onClick={() =>
                        askReason(
                          id,
                          t('Withdraw this consent', 'سحب هذه الموافقة'),
                          t('Reason', 'السبب'),
                          async reason => {
                            await withdrawConsent(row, reason);
                          }
                        )
                      }
                    >
                      {t('Withdraw', 'سحب')}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="t-caption dim">{t('No consent recorded.', 'لا موافقات مسجّلة.')}</p>
      )}
      <p className="t-caption dim" style={{ marginTop: '12px' }}>
        {t(
          'Every consent is kept with its date and source, and a withdrawal is added beside it rather than replacing it.',
          'تُحفظ كل موافقة بتاريخها ومصدرها، ويُضاف السحب بجانبها ولا يحلّ محلّها.'
        )}
      </p>
    </Panel>
  );
}

/* ---------- medical declaration (designated staff only) ---------- */
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function MedicalForm({ id, current }) {
  const m = current?.value || {};
  return (
    <Form id={id} submit={t('Save declaration', 'حفظ الإفادة')} run={form => saveMedical(id, form)}>
      <Row label={t('Purpose of keeping this', 'غرض الاحتفاظ بها')}>
        <input className="input" name="purpose" maxLength={300} defaultValue={m.purpose || ''} required />
      </Row>
      <Row label={t('Allergies', 'الحساسية')}>
        <textarea className="input" name="allergies" maxLength={1000} defaultValue={m.allergies || ''} />
      </Row>
      <Row label={t('Conditions', 'الحالات الصحية')}>
        <textarea className="input" name="conditions" maxLength={1000} defaultValue={m.conditions || ''} />
      </Row>
      <Row label={t('Blood type', 'زمرة الدم')}>
        <Select name="bloodType" defaultValue={m.bloodType || ''}>
          <option value="">—</option>
          {BLOOD.map(b => (
            <option key={b}>{b}</option>
          ))}
        </Select>
      </Row>
      <Row label={t('Notes', 'ملاحظات')}>
        <textarea className="input" name="notes" maxLength={2000} defaultValue={m.notes || ''} />
      </Row>
      <Row label={t('Source (for example a signed form)', 'المصدر (مثلاً استمارة موقّعة)')}>
        <input className="input" name="source" maxLength={300} defaultValue={m.source || ''} />
      </Row>
    </Form>
  );
}

export function MedicalPanel({ id }) {
  const row = detail(id)?.medical,
    m = row?.value;
  return (
    <Panel title={t('Medical declaration', 'الإفادة الصحية')}>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button
          className="btn btn-secondary btn-dense"
          onClick={() =>
            openModal({
              title: t('Medical declaration', 'الإفادة الصحية'),
              body: <MedicalForm id={id} current={row} />
            })
          }
        >
          {m ? t('Edit', 'تعديل') : t('Add a declaration', 'إضافة إفادة')}
        </button>
      </div>
      {m ? (
        <dl className="dl">
          <dt>{t('Allergies', 'الحساسية')}</dt>
          <dd>{m.allergies || '—'}</dd>
          <dt>{t('Conditions', 'الحالات الصحية')}</dt>
          <dd>{m.conditions || '—'}</dd>
          <dt>{t('Blood type', 'زمرة الدم')}</dt>
          <dd className="mono">{m.bloodType || '—'}</dd>
          <dt>{t('Notes', 'ملاحظات')}</dt>
          <dd>{m.notes || '—'}</dd>
          <dt>{t('Kept for', 'محفوظة لغرض')}</dt>
          <dd>{m.purpose}</dd>
          <dt>{t('Source', 'المصدر')}</dt>
          <dd>{m.verified ? m.source : t('Unverified: no source recorded', 'غير موثّقة: لا مصدر مسجّل')}</dd>
        </dl>
      ) : (
        <p className="t-caption dim">
          {t(
            'No declaration is recorded, or this account is not allowed to see it.',
            'لا إفادة مسجّلة، أو أن هذا الحساب غير مخوّل برؤيتها.'
          )}
        </p>
      )}
    </Panel>
  );
}

/* ---------- relationships ---------- */
const RELATIONS = {
  Parent: ['Parent', 'والد/والدة'],
  Child: ['Child', 'ابن/ابنة'],
  AdoptiveParent: ['Adoptive parent', 'والد/والدة بالتبنّي'],
  AdoptiveChild: ['Adopted child', 'ابن/ابنة بالتبنّي'],
  StepParent: ['Stepparent', 'زوج/زوجة الأب أو الأم'],
  StepChild: ['Stepchild', 'ابن/ابنة الزوج أو الزوجة'],
  Spouse: ['Spouse', 'زوج/زوجة'],
  Sibling: ['Brother or sister', 'أخ/أخت'],
  Guardian: ['Guardian', 'وصيّ'],
  Ward: ['Ward', 'تحت الوصاية'],
  Relative: ['Other relative', 'قريب آخر']
};

function RelationshipForm({ id }) {
  const [kind, setKind] = useState('Spouse'),
    [query, setQuery] = useState(''),
    [matches, setMatches] = useState([]);
  const search = async () =>
    setMatches(query.trim() ? (await searchPeople(query.trim()).catch(() => [])).filter(p => p.id !== id) : []);
  return (
    <Form id={id} submit={t('Add relationship', 'إضافة صلة')} run={form => addRelationship(id, { ...form, kind })}>
      <div className="formrow">
        <label className="label" htmlFor="rel-search">
          {t('Find the other person', 'ابحث عن الشخص الآخر')}
        </label>
        <div className="row" style={{ gap: '8px' }}>
          <input
            id="rel-search"
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                search();
              }
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={search}>
            {t('Search', 'بحث')}
          </button>
        </div>
      </div>
      <Row label={t('The other person', 'الشخص الآخر')}>
        <Select name="relatedPersonId" required>
          <option value="">{t('Choose a person', 'اختر شخصاً')}</option>
          {matches.map(p => (
            <option key={p.id} value={p.id}>
              {`${p.givenName} ${p.familyName}`.trim()} {p.birthDate ? `· ${p.birthDate}` : ''}
            </option>
          ))}
        </Select>
      </Row>
      <Row label={t('They are this person’s…', 'هو/هي بالنسبة إلى هذا الشخص…')}>
        <Select value={kind} onChange={e => setKind(e.target.value)}>
          {Object.entries(RELATIONS).map(([k, [en, ar]]) => (
            <option key={k} value={k}>
              {t(en, ar)}
            </option>
          ))}
        </Select>
      </Row>
      <Row label={t('Source', 'المصدر')}>
        <input className="input" name="source" maxLength={500} />
      </Row>
      <Row label={t('Evidence reference', 'مرجع الإثبات')}>
        <input
          className="input"
          name="evidenceReference"
          maxLength={1000}
          required={['Guardian', 'Ward'].includes(kind)}
        />
      </Row>
    </Form>
  );
}

export function RelationshipPanel({ id }) {
  const rows = detail(id)?.relationships;
  return (
    <Panel title={t('Recorded relationships', 'الصلات المسجّلة')}>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button
          className="btn btn-secondary btn-dense"
          onClick={() =>
            openModal({
              title: t('Add a relationship', 'إضافة صلة'),
              sub: t(
                'The other side is recorded automatically. A household never implies a guardian.',
                'يُسجَّل الطرف الآخر تلقائياً. الانتماء إلى عائلة لا يعني وصاية.'
              ),
              body: <RelationshipForm id={id} />
            })
          }
        >
          {t('Add a relationship', 'إضافة صلة')}
        </button>
      </div>
      {!rows ? (
        <p className="t-caption dim">{t('Loading…', 'جارٍ التحميل…')}</p>
      ) : rows.length ? (
        rows.map(row => {
          const r = row.value;
          return (
            <div key={r.id} className="listrow">
              <a href={`#/person/${r.relatedPersonId}`}>{r.relatedName || r.relatedPersonId}</a>
              <span className="grow" />
              <span className="dim t-caption">
                {t(...(RELATIONS[r.kind] || [r.kind, r.kind]))}
                {r.status === 'Ended' ? ` · ${t('ended', 'انتهت')}${r.endReason ? ` (${r.endReason})` : ''}` : ''}
              </span>
              {r.status === 'Active' ? (
                <button
                  className="btn btn-ghost btn-dense"
                  onClick={() =>
                    askReason(id, t('End this relationship', 'إنهاء هذه الصلة'), t('Reason', 'السبب'), async reason => {
                      await endRelationship(id, row, reason);
                    })
                  }
                >
                  {t('End', 'إنهاء')}
                </button>
              ) : null}
            </div>
          );
        })
      ) : (
        <p className="t-caption dim">{t('No relationship recorded.', 'لا صلات مسجّلة.')}</p>
      )}
    </Panel>
  );
}
