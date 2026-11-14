/* Purpose: the documents of a request case: the office's checklist of what the case needs (each item
   missing, received on paper or not applicable) and the case's private files (PDF, JPEG or PNG up to
   10 MB, replaced with the earlier version kept, removed with a reason). Receiving a document never
   approves the request.
   Main functions: RequestDocuments (the section), uploadFile, requestRequirements.

   Routes: GET/PUT .../requests/{id}/checklist, and .../requests/{id}/files (list, upload, download, remove)
   on ParishLife.Api. Files exist only on request cases: sacrament entries, service requests and office
   expenses have no file route yet, so their uploads say so. A file may name the checklist item it answers
   (checklistKey), and the office marks an item received with a paper reference, one of the case's active
   files, or both. Naming an item never marks it received. */
import { useEffect, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { PREP_REQUIREMENTS } from '../../model/data.js';
import { is } from '../../model/store.js';
import { Select } from '../../ui/components.jsx';
import { Pill, toast } from '../../ui/ui.jsx';
import { notConnected } from '../../model/api.js';
import {
  getCase,
  listFiles,
  uploadFile as sendFile,
  removeFile,
  fileURL,
  setChecklist,
  TERMINAL
} from '../../model/modules/requests.js';

const L = (en, ar) => t(en, ar);

export const requestRequirements = record =>
  PREP_REQUIREMENTS[record.kind?.toLowerCase() === 'wedding' ? 'marriage' : record.kind?.toLowerCase()] || [];

const TYPES = /\.(pdf|png|jpe?g)$/i;
const tooBig = L('Choose a PDF, JPG or PNG up to 10 MB.', 'اختر PDF أو JPG أو PNG حتى ١٠ ميغابايت.');
/* Request cases hold files; the old scope names for a guest request map to the same case. */
const onCase = scope => scope === 'request' || scope === 'guest-request';

/* Shared by other screens (office expenses, guest requests): uploads to a request case. */
export async function uploadFile(scope, id, file, requirement = '', replaceId = null) {
  if (!onCase(scope)) throw new Error(notConnected);
  if (!TYPES.test(file.name) || !file.size || file.size > 10_000_000) throw new Error(tooBig);
  return sendFile(id, file, {
    replacesId: replaceId,
    reason: replaceId ? 'Replaced by the office' : '',
    checklistKey: requirement || undefined
  });
}

const STATUS = [
  ['Missing', 'Missing', 'ناقص'],
  ['Received', 'Received', 'مستلم'],
  ['NotApplicable', 'Not needed', 'غير مطلوب']
];
const slug = (label, taken) => {
  const base =
    String(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'item';
  let key = base,
    n = 1;
  while (taken.has(key)) key = `${base}-${++n}`;
  return key;
};

function Checklist({ dto, version, editable, run, id, files }) {
  const [items, setItems] = useState(dto.checklist),
    [label, setLabel] = useState(''),
    [required, setRequired] = useState(true);
  useEffect(() => setItems(dto.checklist), [version]);
  const change = (key, patch) => setItems(list => list.map(i => (i.key === key ? { ...i, ...patch } : i)));
  const problem = items.find(
    i => i.status === 'Received' && !String(i.paperReference || '').trim() && !i.evidenceFileId
  );
  const active = files.filter(f => f.status === 'Active');
  const fileName = fileId => files.find(f => f.id === fileId)?.fileName || L('a case file', 'ملف في الطلب');
  return (
    <>
      <h4>{L('Checklist', 'قائمة المتطلبات')}</h4>
      {items.length ? null : <p className="help">{L('No checklist items yet.', 'لا بنود في القائمة بعد.')}</p>}
      {items.map(i => (
        <div key={i.key} className="request-document" data-document-requirement={i.label}>
          <b>{i.label}</b>{' '}
          <Pill
            label={
              i.status === 'Received'
                ? L('Received', 'مستلم')
                : i.status === 'NotApplicable'
                  ? L('Not needed', 'غير مطلوب')
                  : i.required
                    ? L('Missing', 'ناقص')
                    : L('Optional', 'اختياري')
            }
            tone={i.status === 'Received' ? 'success' : i.status === 'Missing' && i.required ? 'warning' : ''}
          />
          {editable ? (
            <div className="formgrid">
              <Select
                value={i.status}
                onChange={e =>
                  change(i.key, {
                    status: e.target.value,
                    ...(e.target.value === 'Received' ? {} : { evidenceFileId: null })
                  })
                }
                aria-label={L('Status', 'الحالة')}
              >
                {STATUS.map(([v, en, ar]) => (
                  <option key={v} value={v}>
                    {L(en, ar)}
                  </option>
                ))}
              </Select>
              <input
                className="input"
                maxLength="500"
                placeholder={L('Paper or file reference', 'مرجع الورقة أو الملف')}
                value={i.paperReference || ''}
                onChange={e => change(i.key, { paperReference: e.target.value })}
              />
              {i.status === 'Received' ? (
                <Select
                  value={i.evidenceFileId || ''}
                  onChange={e => change(i.key, { evidenceFileId: e.target.value || null })}
                  aria-label={L('Case file received for this item', 'ملف الطلب المستلم لهذا البند')}
                  data-checklist-file={i.key}
                >
                  <option value="">{L('No case file', 'دون ملف')}</option>
                  {i.evidenceFileId && !active.some(f => f.id === i.evidenceFileId) ? (
                    <option value={i.evidenceFileId}>{fileName(i.evidenceFileId)}</option>
                  ) : null}
                  {active.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.fileName}
                    </option>
                  ))}
                </Select>
              ) : null}
              <button
                className="btn btn-danger-quiet btn-dense"
                onClick={() => setItems(list => list.filter(x => x.key !== i.key))}
              >
                {L('Remove item', 'إزالة البند')}
              </button>
            </div>
          ) : (
            <>
              {i.paperReference ? <small> · {i.paperReference}</small> : null}
              {i.evidenceFileId ? <small> · {fileName(i.evidenceFileId)}</small> : null}
            </>
          )}
        </div>
      ))}
      {editable ? (
        <>
          <div className="formgrid">
            <input
              className="input"
              maxLength="300"
              placeholder={L('A document or step this case needs', 'مستند أو خطوة يحتاجها هذا الطلب')}
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
            <label className="check">
              <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
              {L('Required', 'مطلوب')}
            </label>
            <button
              className="btn btn-secondary btn-dense"
              disabled={!label.trim() || items.length >= 40}
              onClick={() => {
                setItems(list => [
                  ...list,
                  {
                    key: slug(label, new Set(list.map(i => i.key))),
                    label: label.trim(),
                    required,
                    status: 'Missing',
                    paperReference: ''
                  }
                ]);
                setLabel('');
              }}
            >
              {L('Add item', 'إضافة بند')}
            </button>
          </div>
          {problem ? (
            <p className="help help-error">
              {L(
                'A received item needs its paper reference or a case file: ',
                'البند المستلم يحتاج مرجع الورقة أو ملفاً من الطلب: '
              )}
              {problem.label}
            </p>
          ) : null}
          <button
            className="btn btn-primary btn-dense"
            disabled={!!problem || JSON.stringify(items) === JSON.stringify(dto.checklist)}
            onClick={() => run(() => setChecklist(id, version, items))}
          >
            {L('Save checklist', 'حفظ القائمة')}
          </button>
        </>
      ) : null}
    </>
  );
}

function Files({ id, files, canRemove, canChange, run, checklist }) {
  const [pending, setPending] = useState(null), // { kind: 'replace' | 'remove', file, reason }
    [item, setItem] = useState('');
  const label = key => checklist.find(c => c.key === key)?.label || key;
  const shown = files.filter(f => f.status === 'Active' || canRemove);
  return (
    <>
      <h4>{L('Files', 'الملفات')}</h4>
      {shown.length ? null : <p className="help">{L('No uploaded files.', 'لا ملفات مرفوعة.')}</p>}
      {shown.map(f => (
        <div key={f.id} className="filerow">
          <span className="grow">
            <b>{f.fileName}</b>
            <small>
              {(f.size / 1048576).toFixed(1)} MB · {String(f.uploadedAt).slice(0, 10)} ·{' '}
              {f.uploaderRole === 'Office'
                ? L('office', 'المكتب')
                : f.uploaderRole === 'Guest'
                  ? L('guest, through the tracking link', 'زائر، عبر رابط المتابعة')
                  : L('applicant', 'مقدّم الطلب')}
              {f.checklistKey ? ` · ${label(f.checklistKey)}` : ''}
              {f.status !== 'Active'
                ? ` · ${f.status === 'Replaced' ? L('replaced', 'استُبدل') : L('removed', 'أُزيل')}${f.reason ? `: ${f.reason}` : ''}`
                : ''}
            </small>
          </span>
          {f.status !== 'Removed' ? (
            <a className="btn btn-secondary btn-dense" href={fileURL(id, f.id)} target="_blank" rel="noopener">
              {L('Open / download', 'فتح / تنزيل')}
            </a>
          ) : null}
          {canChange && f.status === 'Active' ? (
            <button
              className="btn btn-secondary btn-dense"
              onClick={() => setPending({ kind: 'replace', file: f, reason: '' })}
            >
              {L('Replace', 'استبدال')}
            </button>
          ) : null}
          {canRemove && f.status === 'Active' ? (
            <button
              className="btn btn-danger-quiet btn-dense"
              onClick={() => setPending({ kind: 'remove', file: f, reason: '' })}
            >
              {L('Remove', 'إزالة')}
            </button>
          ) : null}
        </div>
      ))}
      {pending ? (
        <div className="formrow">
          <label className="label">
            {pending.kind === 'replace'
              ? L('Why it is replaced, then choose the new file', 'سبب الاستبدال، ثم اختر الملف الجديد')
              : L('Why it is removed', 'سبب الإزالة')}
          </label>
          <input
            className="input"
            maxLength="500"
            value={pending.reason}
            onChange={e => setPending({ ...pending, reason: e.target.value })}
          />
          {pending.kind === 'replace' ? (
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              disabled={!pending.reason.trim()}
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (!TYPES.test(file.name) || !file.size || file.size > 10_000_000) return toast(tooBig, '', 'warning');
                run(() => sendFile(id, file, { replacesId: pending.file.id, reason: pending.reason.trim() }));
                setPending(null);
              }}
            />
          ) : (
            <button
              className="btn btn-danger btn-dense"
              disabled={!pending.reason.trim()}
              onClick={() => {
                run(() => removeFile(id, pending.file.id, pending.file.version, pending.reason.trim()));
                setPending(null);
              }}
            >
              {L('Remove file', 'إزالة الملف')}
            </button>
          )}{' '}
          <button className="btn btn-secondary btn-dense" onClick={() => setPending(null)}>
            {L('Cancel', 'إلغاء')}
          </button>
        </div>
      ) : null}
      {canChange && checklist.length ? (
        <Select
          value={item}
          onChange={e => setItem(e.target.value)}
          aria-label={L('The checklist item this file answers', 'بند القائمة الذي يجيب عنه هذا الملف')}
          data-upload-item=""
        >
          <option value="">{L('No particular item', 'لا بند محدّد')}</option>
          {checklist.map(c => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
      ) : null}
      {canChange ? (
        <label className="btn btn-secondary btn-dense">
          {L('Add document', 'إضافة مستند')}
          <input
            type="file"
            hidden
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (!TYPES.test(file.name) || !file.size || file.size > 10_000_000) return toast(tooBig, '', 'warning');
              run(() => sendFile(id, file, { checklistKey: item || undefined }));
            }}
          />
        </label>
      ) : null}
    </>
  );
}

/** The documents of one request case. `applicant` is the person who made it: they add and replace their
    own files but neither edit the checklist nor remove files. onChange runs once the parish has the change. */
export function RequestDocuments({ record, scope = 'request', onChange, applicant = false }) {
  const [state, setState] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [round, setRound] = useState(0);
  const supported = onCase(scope);
  useEffect(() => {
    if (!supported) return;
    let live = true;
    (async () => {
      try {
        const [c, files] = await Promise.all([getCase(record.id), listFiles(record.id)]);
        if (live) setState({ c, files });
      } catch (e) {
        if (live) setError(e.message);
      }
    })();
    return () => {
      live = false;
    };
  }, [round, record.id]);
  if (!supported)
    return (
      <section className="request-documents" data-request-documents="">
        <h3 className="t-ui">{L('Documents & requirements', 'المستندات والمتطلبات')}</h3>
        <p className="help">
          {L(
            'Documents for this kind of record are not connected to the new backend yet.',
            'مستندات هذا النوع من السجلات غير متّصلة بالخادم الجديد بعد.'
          )}
        </p>
      </section>
    );
  const run = async work => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      setRound(n => n + 1);
      onChange?.();
    } catch (e) {
      toast(L('Could not update documents', 'تعذّر تحديث المستندات'), e.message, 'danger');
    } finally {
      setBusy(false);
    }
  };
  const dto = state?.c?.value,
    open = dto ? !TERMINAL.includes(dto.status) : applicant && record.open !== false,
    office = !applicant && is('priest', 'secretary');
  return (
    <section className="request-documents" data-request-documents="" data-document-owner={record.id} aria-busy={busy}>
      <h3 className="t-ui">{L('Documents & requirements', 'المستندات والمتطلبات')}</h3>
      <p className="help">
        {L(
          'Attach a document, and record items received on paper or in person. Receiving a document does not approve the request.',
          'أرفق المستند وسجّل ما استُلم ورقياً أو شخصياً. استلام المستند لا يعني الموافقة على الطلب.'
        )}
      </p>
      {error ? (
        <p className="help help-error">{error}</p>
      ) : !state ? (
        <p className="help">{L('Loading attachments…', 'جارٍ تحميل المرفقات…')}</p>
      ) : (
        <>
          {dto ? (
            <Checklist
              dto={dto}
              version={state.c.version}
              editable={office && open}
              run={run}
              id={record.id}
              files={state.files}
            />
          ) : null}
          <Files
            id={record.id}
            files={state.files}
            canRemove={office && open}
            canChange={open}
            run={run}
            checklist={dto?.checklist || []}
          />
        </>
      )}
      <p className="help">
        {L(
          'PDF, JPG or PNG up to 10 MB, at most 20 at a time. Closed requests keep their files read-only.',
          'PDF أو JPG أو PNG حتى ١٠ ميغابايت، وبحد أقصى ٢٠ ملفاً. تبقى ملفات الطلبات المقفلة للقراءة فقط.'
        )}
      </p>
    </section>
  );
}
