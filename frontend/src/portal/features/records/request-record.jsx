/* Purpose: on an accepted request case, the office opens the record the case needs: a sacramental case
   for a sacrament inquiry, or a certificate for a certificate request. ParishLife.Api opens it through
   the sacrament services, which keep their own rules (sacraments.record access, a matched person record),
   and links it to the case. Opening a sacramental case writes nothing in the register: the case starts
   as received, and only a priest registers it later. A retry reuses the same operation id, so nothing is
   opened twice.
   Main functions: OpenRecord (the section), LinkedRecords (the links already on the case). */
import { useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { Select } from '../../ui/components.jsx';
import { newOperationId } from '../../model/api.js';
import { openRecord } from '../../model/modules/requests.js';

const L = (en, ar) => t(en, ar);

const SACRAMENTS = [
  ['Baptism', 'Baptism', 'المعمودية'],
  ['FirstCommunion', 'First Communion', 'المناولة الأولى'],
  ['Confirmation', 'Confirmation', 'التثبيت'],
  ['Marriage', 'Marriage', 'الزواج'],
  ['Funeral', 'Funeral', 'الجناز'],
  ['Anointing', 'Anointing of the sick', 'مسحة المرضى'],
  ['Other', 'Other', 'آخر']
];
/* The portal's words for a sacrament (details.sacrament or details.certificateOf) → the API's. */
const FROM_DETAILS = {
  baptism: 'Baptism',
  communion: 'FirstCommunion',
  'first communion': 'FirstCommunion',
  confirmation: 'Confirmation',
  marriage: 'Marriage',
  wedding: 'Marriage',
  funeral: 'Funeral'
};
export const sacramentOf = details =>
  FROM_DETAILS[String(details?.sacrament || details?.certificateOf || '').toLowerCase()] || 'Baptism';

const LINKS = {
  SacramentRecord: ['Sacramental case', 'ملف سرّ'],
  Certificate: ['Certificate', 'شهادة'],
  Reservation: ['Reservation', 'حجز'],
  Event: ['Event', 'حدث'],
  Registration: ['Registration', 'تسجيل'],
  Other: ['Record', 'سجل']
};

/** The records linked to the case (kind and a short id; the record itself opens in its own page). */
export function LinkedRecords({ links }) {
  if (!links?.length) return null;
  return (
    <ul className="help" data-request-links="">
      {links.map(l => (
        <li key={l.kind + l.recordId}>
          {L(...(LINKS[l.kind] || [l.kind, l.kind]))} ·{' '}
          <bdi className="mono" dir="ltr">
            {String(l.recordId).slice(0, 10)}
          </bdi>
        </li>
      ))}
    </ul>
  );
}

/** Shown to the office on an accepted sacrament inquiry or certificate request. run(key, work, done) is the
    case view's one-action runner (it reloads the case afterwards). */
export function OpenRecord({ dto, version, run, busy }) {
  const certificate = dto.kind === 'Certificate';
  const linkKind = certificate ? 'Certificate' : 'SacramentRecord';
  const [sacrament, setSacrament] = useState(sacramentOf(dto.details)),
    [tentativeDate, setTentativeDate] = useState(''),
    [language, setLanguage] = useState('en'),
    [quantity, setQuantity] = useState(1),
    [purpose, setPurpose] = useState(String(dto.details?.purpose || '').slice(0, 300)),
    /* Kept until the record opens, so a retry after a lost answer opens nothing twice. */
    [operationId, setOperationId] = useState(newOperationId);
  if (dto.status !== 'AcceptedForProcessing' || !['SacramentInquiry', 'Certificate'].includes(dto.kind)) return null;
  const opened = dto.links?.filter(l => l.kind === linkKind) || [];
  const matched = !!dto.subjectPersonId;
  const open = () =>
    run(
      'open-record',
      async () => {
        await openRecord(
          dto.id,
          version,
          certificate ? 'Certificate' : 'SacramentalCase',
          certificate
            ? { sacrament, language, quantity: Number(quantity) || 1, purpose: purpose.trim() }
            : { sacrament, tentativeDate: tentativeDate.trim(), facts: {} },
          operationId
        );
        setOperationId(newOperationId());
      },
      certificate ? L('Certificate opened', 'فُتحت الشهادة') : L('Sacramental case opened', 'فُتح ملف السرّ')
    );
  return (
    <section className="or-section" aria-labelledby="rc-record" data-open-record={linkKind}>
      <h3 id="rc-record">{certificate ? L('Certificate', 'الشهادة') : L('Sacramental case', 'ملف السرّ')}</h3>
      {opened.length ? (
        <p className="help">
          {certificate
            ? L('A certificate is open for this request.', 'شهادة مفتوحة لهذا الطلب.')
            : L('A sacramental case is open for this request.', 'ملف سرّ مفتوح لهذا الطلب.')}
        </p>
      ) : null}
      <p className="help">
        {certificate
          ? L(
              'Opens a certificate for the matched person, waiting for the register entry it comes from. It needs sacrament records access.',
              'يفتح شهادة للشخص المطابَق بانتظار قيد السجل الذي تصدر عنه. يحتاج إلى صلاحية سجلات الأسرار.'
            )
          : L(
              'Opens a sacramental case for the matched person. Nothing is written in the register: a priest registers the celebration later. It needs sacrament records access.',
              'يفتح ملف سرّ للشخص المطابَق. لا يُكتب شيء في السجل: يسجّل الكاهن الاحتفال لاحقاً. يحتاج إلى صلاحية سجلات الأسرار.'
            )}
      </p>
      {!matched ? (
        <p className="help help-error">
          {L('Match the request to the person’s record first.', 'طابِق الطلب مع سجل الشخص أولاً.')}
        </p>
      ) : null}
      <div className="formgrid">
        <Select value={sacrament} onChange={e => setSacrament(e.target.value)} aria-label={L('Sacrament', 'السرّ')}>
          {SACRAMENTS.map(([v, en, ar]) => (
            <option key={v} value={v}>
              {L(en, ar)}
            </option>
          ))}
        </Select>
        {certificate ? (
          <>
            <Select value={language} onChange={e => setLanguage(e.target.value)} aria-label={L('Language', 'اللغة')}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
              <option value="fr">Français</option>
            </Select>
            <input
              className="input"
              type="number"
              min="1"
              max="20"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              aria-label={L('Copies', 'عدد النسخ')}
            />
            <input
              className="input"
              maxLength="300"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder={L('Purpose', 'الغاية')}
            />
          </>
        ) : (
          <input
            className="input"
            maxLength="200"
            value={tentativeDate}
            onChange={e => setTentativeDate(e.target.value)}
            placeholder={L('Tentative date (optional)', 'موعد مبدئي (اختياري)')}
          />
        )}
      </div>
      <button className="btn btn-primary btn-dense" disabled={!!busy || !matched} onClick={open}>
        {certificate ? L('Open the certificate', 'فتح الشهادة') : L('Open the sacramental case', 'فتح ملف السرّ')}
      </button>
    </section>
  );
}
