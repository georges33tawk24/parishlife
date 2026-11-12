/* Purpose: the Appointments tab of the workspace: archdiocese staff, parish priests (with the head
   priest designation) and bishop appointments, on ParishLife.Api's staff-appointment, priest-appointment
   and bishop-appointment routes. Bishop appointments can only be read one at a time, so they are opened by
   the reference the proposal returned.
   Main member: Appointments. */
import { useState } from 'react';
import { Pill, toast } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import * as A from '../../model/modules/administration-api.js';
import { useLoad } from './use-load.js';
import { L, Row, Section, ReferenceBox, openForm, csv, startOfDay, shortDay } from './workspace-forms.jsx';

const step = [
  { name: 'currentPassword', label: L('Your password', 'كلمة مرورك'), type: 'password' },
  { name: 'currentCode', label: L('Authenticator code', 'رمز المصادقة') }
];
const yesNo = [
  ['true', L('Accept', 'قبول')],
  ['false', L('Decline', 'رفض')]
];

function List({ archdioceseId, parishId, canInvite }) {
  const { data, error, reload } = useLoad(
    () => A.orEmpty(A.listAppointments(archdioceseId, parishId)),
    [archdioceseId, parishId]
  );
  const invite = async () => {
    const scope = await A.appointmentScope(archdioceseId, parishId);
    openForm({
      title: parishId ? L('Appoint a priest', 'تعيين كاهن') : L('Appoint archdiocese staff', 'تعيين موظف أبرشية'),
      intro: `${scope.value.name}. ${L('The nominee must accept. This needs your password and authenticator code.', 'على المرشّح أن يقبل. يتطلب ذلك كلمة مرورك ورمز المصادقة.')}`,
      fields: [
        { name: 'accountId', label: L('Nominee account reference', 'مرجع حساب المرشّح') },
        {
          name: 'allows',
          label: L('Duties allowed (comma separated)', 'المهام المسموحة (مفصولة بفواصل)'),
          required: false
        },
        {
          name: 'denies',
          label: L('Duties denied (comma separated)', 'المهام الممنوعة (مفصولة بفواصل)'),
          required: false
        },
        { name: 'startsAt', label: L('Starts', 'يبدأ'), type: 'date' },
        { name: 'endsAt', label: L('Ends (optional)', 'ينتهي (اختياري)'), type: 'date', required: false },
        { name: 'acceptBy', label: L('Accept by', 'القبول قبل'), type: 'date' },
        {
          name: 'reviewDueAt',
          label: L('Review due (optional)', 'موعد المراجعة (اختياري)'),
          type: 'date',
          required: false
        },
        ...(parishId
          ? [{ name: 'isHead', label: L('Reserve the head priest period', 'حجز فترة الكاهن الرئيسي'), type: 'check' }]
          : []),
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' },
        { name: 'evidenceReference', label: L('Appointment evidence reference', 'مرجع إثبات التعيين') },
        ...step
      ],
      save: v =>
        A.inviteAppointment(archdioceseId, parishId, {
          scopeVersion: scope.version,
          accountId: v.accountId.trim(),
          role: parishId ? 'Priest' : 'ArchdioceseAdmin',
          allows: csv(v.allows),
          denies: csv(v.denies),
          startsAt: startOfDay(v.startsAt),
          endsAt: startOfDay(v.endsAt),
          acceptBy: startOfDay(v.acceptBy),
          reviewDueAt: startOfDay(v.reviewDueAt),
          isHead: !!v.isHead,
          reason: v.reason,
          evidenceReference: v.evidenceReference,
          currentPassword: v.currentPassword,
          currentCode: v.currentCode
        }),
      done: reload
    });
  };
  const respond = ({ value: a, version }) =>
    openForm({
      title: L('Answer the invitation', 'الردّ على الدعوة') + ' · ' + a.scopeName,
      fields: [
        { name: 'accept', label: L('Decision', 'القرار'), type: 'select', options: yesNo },
        { name: 'reason', label: L('Reason (optional)', 'السبب (اختياري)'), required: false }
      ],
      save: v =>
        A.respondAppointment(archdioceseId, parishId, a.id, {
          version,
          accept: v.accept === 'true',
          reason: v.reason || null
        }),
      done: reload
    });
  const act = ({ value: a, version }) =>
    openForm({
      title: L('Change the appointment', 'تغيير التعيين') + ' · ' + a.scopeName,
      fields: [
        {
          name: 'action',
          label: L('Action', 'الإجراء'),
          type: 'select',
          options: [
            ['Suspend', L('Suspend', 'تعليق')],
            ['Resume', L('Resume', 'استئناف')],
            ['Revoke', L('Revoke', 'سحب')],
            ['Review', L('Record a review', 'تسجيل مراجعة')]
          ]
        },
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' },
        {
          name: 'reviewDueAt',
          label: L('Next review (review action only)', 'المراجعة التالية (للمراجعة فقط)'),
          type: 'date',
          required: false
        },
        ...step
      ],
      save: v =>
        A.actAppointment(archdioceseId, parishId, a.id, {
          version,
          action: v.action,
          reason: v.reason,
          reviewDueAt: startOfDay(v.reviewDueAt),
          currentPassword: v.currentPassword,
          currentCode: v.currentCode
        }),
      done: reload
    });
  const head = ({ value: a, version }, ending) =>
    openForm({
      title:
        (ending
          ? L('End the head priest period', 'إنهاء فترة الكاهن الرئيسي')
          : L('Designate head priest', 'تعيين كاهن رئيسي')) +
        ' · ' +
        a.scopeName,
      fields: [
        { name: 'date', label: ending ? L('Ends', 'تنتهي') : L('Starts', 'تبدأ'), type: 'date' },
        ...(ending
          ? []
          : [{ name: 'endsAt', label: L('Ends (optional)', 'تنتهي (اختياري)'), type: 'date', required: false }]),
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' },
        { name: 'evidenceReference', label: L('Evidence reference', 'مرجع الإثبات') },
        ...step
      ],
      save: v =>
        ending
          ? A.endHead(archdioceseId, parishId, a.id, {
              version,
              endsAt: startOfDay(v.date),
              reason: v.reason,
              evidenceReference: v.evidenceReference,
              currentPassword: v.currentPassword,
              currentCode: v.currentCode
            })
          : A.designateHead(archdioceseId, parishId, a.id, {
              version,
              startsAt: startOfDay(v.date),
              endsAt: startOfDay(v.endsAt),
              reason: v.reason,
              evidenceReference: v.evidenceReference,
              currentPassword: v.currentPassword,
              currentCode: v.currentCode
            }),
      done: reload
    });
  return (
    <>
      {canInvite ? (
        <button className="btn btn-primary" data-appoint="" onClick={invite}>
          {parishId ? L('Appoint a priest', 'تعيين كاهن') : L('Appoint staff', 'تعيين موظف')}
        </button>
      ) : null}
      {error ? <p className="alert alert-danger">{error}</p> : null}
      {(data || []).map(row => {
        const a = row.value;
        return (
          <Row
            key={a.id}
            data-appointment={a.id}
            title={
              <>
                {a.role} · {a.scopeName} <Pill label={a.status} tone={a.effective ? 'success' : ''} />
                {a.head ? <Pill label={L('Head priest', 'كاهن رئيسي')} tone="info" /> : null}
              </>
            }
            lines={[
              `${L('Account', 'الحساب')}: ${a.accountId}`,
              `${shortDay(a.startsAt)} → ${shortDay(a.endsAt)}${a.reviewOverdue ? ' · ' + L('review overdue', 'المراجعة متأخرة') : ''}`,
              a.reason
            ]}
            actions={
              <>
                {a.status === 'Invited' ? (
                  <button className="btn btn-primary btn-dense" onClick={() => respond(row)}>
                    {L('Answer', 'ردّ')}
                  </button>
                ) : null}
                {['Accepted', 'Suspended'].includes(a.status) ? (
                  <button className="btn btn-secondary btn-dense" onClick={() => act(row)}>
                    {L('Change', 'تغيير')}
                  </button>
                ) : null}
                {parishId && a.status === 'Accepted' ? (
                  <button className="btn btn-secondary btn-dense" onClick={() => head(row, a.head)}>
                    {a.head ? L('End head period', 'إنهاء فترة الرئيس') : L('Designate head', 'تعيين رئيس')}
                  </button>
                ) : null}
              </>
            }
          />
        );
      })}
      {data && !data.length ? <p>{L('No appointments to show.', 'لا تعيينات لعرضها.')}</p> : null}
    </>
  );
}

function Bishop({ archdioceseId }) {
  const propose = () =>
    openForm({
      title: L('Propose a bishop appointment', 'اقتراح تعيين مطران'),
      intro: L(
        'A second platform operator reviews it; the nominee then accepts.',
        'يراجعه مشغّل ثانٍ للمنصة ثم يقبل المرشّح.'
      ),
      fields: [
        { name: 'accountId', label: L('Nominee account reference', 'مرجع حساب المرشّح') },
        { name: 'startsAt', label: L('Starts', 'يبدأ'), type: 'date' },
        { name: 'endsAt', label: L('Ends (optional)', 'ينتهي (اختياري)'), type: 'date', required: false },
        { name: 'acceptBy', label: L('Accept by', 'القبول قبل'), type: 'date' },
        {
          name: 'reviewDueAt',
          label: L('Review due (optional)', 'موعد المراجعة (اختياري)'),
          type: 'date',
          required: false
        },
        { name: 'evidenceReference', label: L('Appointment evidence reference', 'مرجع إثبات التعيين') },
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }
      ],
      save: async v => {
        const org = await A.getArchdiocese(archdioceseId);
        const r = await A.proposeBishop(archdioceseId, {
          organizationVersion: org.version,
          accountId: v.accountId.trim(),
          startsAt: startOfDay(v.startsAt),
          endsAt: startOfDay(v.endsAt),
          acceptBy: startOfDay(v.acceptBy),
          reviewDueAt: startOfDay(v.reviewDueAt),
          evidenceReference: v.evidenceReference,
          reason: v.reason
        });
        toast(L('Proposal recorded', 'سُجّل الاقتراح'), `${L('Reference', 'المرجع')}: ${r.id}`, 'success');
      }
    });
  const show = async id => {
    const row = await A.getBishopAppointment(archdioceseId, id);
    const a = row.value || row;
    const version = row.version;
    openForm({
      title: L('Bishop appointment', 'تعيين مطران') + ` · ${a.status}`,
      intro: `${L('Nominee', 'المرشّح')}: ${a.accountId} · ${shortDay(a.startsAt)} → ${shortDay(a.endsAt)}`,
      fields:
        a.status === 'Proposed' || a.status === 'PendingReview'
          ? [
              {
                name: 'mode',
                label: L('Step', 'الخطوة'),
                type: 'select',
                options: [
                  ['review', L('Operator review', 'مراجعة المشغّل')],
                  ['response', L('Nominee answer', 'ردّ المرشّح')]
                ]
              },
              { name: 'accept', label: L('Decision', 'القرار'), type: 'select', options: yesNo },
              { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }
            ]
          : [
              {
                name: 'mode',
                label: L('Step', 'الخطوة'),
                type: 'select',
                options: [
                  ['response', L('Nominee answer', 'ردّ المرشّح')],
                  ['review', L('Operator review', 'مراجعة المشغّل')]
                ]
              },
              { name: 'accept', label: L('Decision', 'القرار'), type: 'select', options: yesNo },
              { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }
            ],
      save: v =>
        v.mode === 'review'
          ? A.reviewBishop(archdioceseId, id, { version, approve: v.accept === 'true', reason: v.reason })
          : A.respondBishop(archdioceseId, id, { version, accept: v.accept === 'true', reason: v.reason })
    });
  };
  return (
    <Section
      title={L('Bishop appointments', 'تعيينات المطارنة')}
      actions={
        <button className="btn btn-secondary btn-dense" data-bishop-propose="" onClick={propose}>
          {L('Propose', 'اقتراح')}
        </button>
      }
    >
      <p className="help">
        {L(
          'The API shows one bishop appointment at a time. Open it by the reference the proposal gave.',
          'تعرض الواجهة تعيين مطران واحداً في كل مرة. افتحه بالمرجع الذي أعطاه الاقتراح.'
        )}
      </p>
      <ReferenceBox label={L('Appointment reference', 'مرجع التعيين')} onOpen={show} />
    </Section>
  );
}

export function Appointments({ data }) {
  const arch = data.archdioceses,
    parishes = data.parishes;
  const [archId, setArch] = useState(arch[0]?.id || ''),
    [parishId, setParish] = useState('');
  const canInvite = a => data.scopes.archdioceses.some(x => x.id === a && x.kinds.includes('Bishop'));
  return (
    <>
      <div className="toolbar" style={{ margin: '12px 0' }}>
        <label>
          {L('Archdiocese', 'الأبرشية')}{' '}
          <Select value={archId} onChange={e => setArch(e.target.value)}>
            {arch.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {archId ? (
        <>
          <Section title={L('Archdiocese staff', 'موظفو الأبرشية')}>
            <List key={archId} archdioceseId={archId} canInvite={canInvite(archId)} />
          </Section>
          <Section title={L('Parish priests', 'كهنة الرعايا')}>
            <div className="toolbar">
              <Select value={parishId} onChange={e => setParish(e.target.value)} aria-label={L('Parish', 'الرعية')}>
                <option value="">{L('Choose a parish', 'اختر رعية')}</option>
                {parishes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            {parishId ? (
              <List key={archId + parishId} archdioceseId={archId} parishId={parishId} canInvite={canInvite(archId)} />
            ) : null}
          </Section>
          {data.scopes.operator || canInvite(archId) ? <Bishop archdioceseId={archId} /> : null}
        </>
      ) : (
        <p>
          {L(
            'No archdiocese in reach. Open one by its reference in Organizations.',
            'لا أبرشية في النطاق. افتح واحدة بمرجعها في المؤسسات.'
          )}
        </p>
      )}
    </>
  );
}
