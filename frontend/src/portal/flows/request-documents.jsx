/* The documents a sacrament or service request needs: each attached to its requirement, or marked
   as received on paper. Receiving a document never approves the request. */
import { useEffect, useState } from 'react';
import { t } from '../../lib/i18n.js';
import { PREP_REQUIREMENTS } from '../model/data.js';
import { is } from '../model/store.js';
import { Pill, toast } from '../ui/ui.jsx';
import { parishAPI, session } from '../model/api.js';
import { persist, hydrate } from '../model/persist.js';

const L = (en, ar) => t(en, ar);
export const requestRequirements = record => PREP_REQUIREMENTS[record.kind?.toLowerCase() === 'wedding' ? 'marriage' : record.kind?.toLowerCase()] || [];
const editable = record => is('priest', 'secretary') && !['celebrated', 'registered', 'issued', 'rejected', 'cancelled'].includes(record.status);

export async function uploadFile(scope, id, file, requirement = '', replaceId = null) {
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name) || !file.size || file.size > 10_000_000) throw new Error(L('Choose a PDF, JPG or PNG up to 10 MB.', 'اختر PDF أو JPG أو PNG حتى ١٠ ميغابايت.'));
  if (!await persist()) throw new Error(L('Resolve the pending save first.', 'عالج مشكلة الحفظ أولاً.'));
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  await parishAPI('files', 'POST', { scope, id, name: file.name, data: btoa(binary), requirement, replaceId, revision: session.revision });
  if (scope.endsWith('-request')) await hydrate();
}

function Requirement({ record, en, ar, required, index, files, error, busy, run, scope }) {
  const canEdit = editable(record) && !busy;
  const mine = files ? files.filter(file => (file.requirement || '') === en) : null;
  return <div className="request-document" data-document-index={index} data-document-requirement={en}>
    <h4>{en ? L(en, ar) : ar}{' '}{en ? <Pill label={record.documents?.[en] ? L('Received / complete', 'مستلم / مكتمل') : required ? L('Missing', 'ناقص') : L('Optional', 'اختياري')} tone={record.documents?.[en] ? 'success' : required ? 'warning' : ''} /> : ''}</h4>
    {en ? <label className="check"><input type="checkbox" data-document-paper="" defaultChecked={!!record.paperDocuments?.[en]} disabled={!canEdit}
      onChange={e => { const received = e.target.checked; run(() => parishAPI('request-documents', 'POST', { scope, id: record.id, requirement: en, received, revision: session.revision }), () => { e.target.checked = !!record.paperDocuments?.[en]; }); }} />
      <span>{L('Received on paper / completed in person', 'مستلم ورقياً / منجز شخصياً')}</span></label> : null}
    <div data-request-file-list="">{error ? <p className="help help-error">{error}</p> : !mine ? <p className="help">{L('Loading attachments…', 'جارٍ تحميل المرفقات…')}</p>
      : mine.length ? mine.map(file => <div key={file.id} className="filerow"><span className="grow"><b>{file.name}</b><small>{(file.size / 1048576).toFixed(1)} MB · {file.created_at.slice(0, 10)}</small></span>
        <a className="btn btn-secondary btn-dense" href={`/api/parishes/${encodeURIComponent(session.parishId)}/files/${encodeURIComponent(file.id)}`} target="_blank" rel="noopener">{L('Open / download', 'فتح / تنزيل')}</a>
        {editable(record) ? <><button className="btn btn-secondary btn-dense" data-request-replace={file.id} disabled={busy} onClick={e => { const box = e.currentTarget.closest('[data-document-requirement]').querySelector('[data-request-file]'); box.value = ''; box.dataset.replaceId = file.id; box.click(); }}>{L('Replace', 'استبدال')}</button>
          <button className="btn btn-danger-quiet btn-dense" data-request-delete={file.id} disabled={busy} onClick={() => run(() => parishAPI(`files/${encodeURIComponent(file.id)}`, 'DELETE', { revision: session.revision }))}>{L('Remove', 'إزالة')}</button></> : null}</div>)
        : <p className="help">{L('No uploaded files.', 'لا ملفات مرفوعة.')}</p>}</div>
    {editable(record) ? <label className="btn btn-secondary btn-dense">{L('Add document', 'إضافة مستند')}<input type="file" data-request-file="" hidden accept=".pdf,.png,.jpg,.jpeg" disabled={busy}
      onChange={e => { const box = e.target, file = box.files?.[0]; const replaceId = box.dataset.replaceId || null; delete box.dataset.replaceId; box.value = ''; if (file) run(() => uploadFile(scope, record.id, file, en, replaceId)); }} /></label> : null}
  </div>;
}

/** The documents of one request. onChange runs once the parish has the change. */
export function RequestDocuments({ record, scope, onChange }) {
  const [files, setFiles] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [round, setRound] = useState(0);
  useEffect(() => {
    parishAPI(`files?scope=${encodeURIComponent(scope)}&id=${encodeURIComponent(record.id)}`).then(({ files }) => setFiles(files), e => setError(e.message));
  }, [round]);
  const run = async (fn, undo) => {
    if (busy) return;
    setBusy(true);
    try { if (!await persist()) throw new Error(L('Resolve the pending save first.', 'عالج مشكلة الحفظ أولاً.')); await fn(); await hydrate(); setRound(n => n + 1); onChange?.(); }
    catch (e) { toast(L('Could not update documents', 'تعذّر تحديث المستندات'), e.message, 'danger'); undo?.(); }
    finally { setBusy(false); }
  };
  const requirements = requestRequirements(record);
  return <section className="request-documents" data-request-documents="" data-document-scope={scope} data-document-owner={record.id}>
    <h3 className="t-ui">{L('Documents & requirements', 'المستندات والمتطلبات')}</h3>
    <p className="help">{L('Attach a document to its requirement, or explicitly record an item received on paper / completed in person. Document receipt does not approve the request.', 'أرفق المستند بمتطلبه أو سجّل استلامه ورقياً / إنجازه شخصياً. استلام المستند لا يعني الموافقة على الطلب.')}</p>
    {[...requirements, ['', L('Additional attachments', 'مرفقات إضافية'), false]].map(([en, ar, required], index) =>
      <Requirement key={index} record={record} en={en} ar={ar} required={required} index={index} files={files} error={error} busy={busy} run={run} scope={scope} />)}
    <p className="help">{L('PDF, JPG or PNG up to 10 MB. Closed requests keep their files read-only.', 'PDF أو JPG أو PNG حتى ١٠ ميغابايت. تبقى ملفات الطلبات المقفلة للقراءة فقط.')}</p></section>;
}
