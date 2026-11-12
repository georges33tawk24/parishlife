/* Purpose: reviewing the API's duplicate suggestions: record that a pair are different people (or need
   more information), compare and merge them with an explicit choice for every differing field, and undo a
   recent merge. Main members: dupDismiss, dupMerge, MergeHistory.
   Connected to GET people/duplicates, duplicates/decisions, merges/preview, merges and merges/{id}/unmerge. */
import { useEffect, useState } from 'react';
import { t, fmtDate } from '../../../lib/i18n.js';
import { DUPLICATES, person } from '../../model/data.js';
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
  GivenName: ['Given name', 'الاسم الأول'],
  FamilyName: ['Family name', 'اسم العائلة'],
  BirthDate: ['Date of birth', 'تاريخ الميلاد'],
  Contact: ['Contact', 'جهة الاتصال']
};
const fieldName = f => (FIELD[f] ? t(...FIELD[f]) : f);
const valueOf = (p, f) =>
  p ? { GivenName: p.given, FamilyName: p.family, BirthDate: p.born, Contact: p.phone === '—' ? '' : p.phone }[f] : '';

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
      submit={t('Merge', 'دمج')}
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
      {preview.conflicts.map(c => (
        <Row key={c} label={fieldName(c)}>
          <Select name={'choice-' + c} defaultValue="survivor">
            <option value="survivor">
              {t('Keep', 'الإبقاء')}: {valueOf(person(survivor.id), c) || '—'}
            </option>
            <option value="source">
              {t('Take', 'أخذ')}: {valueOf(person(source.id), c) || '—'}
            </option>
          </Select>
        </Row>
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
