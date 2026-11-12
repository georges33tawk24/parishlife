/* Purpose: the Access and billing tab of the workspace, on ParishLife.Api: a parish's office coverage and
   grants (PUT /api/parishes/{id}/grants, .../grants/revoke), plans and the modules a parish has bought
   (GET /api/plans, .../billing/coverage), invoices and cash receipts, and the payer: who pays for the
   parish, and transfers between parish and archdiocese.
   The API has no list of a parish's grants or invoices; invoices are opened by reference.
   Main member: AccessAndBilling. */
import { useState } from 'react';
import { toast } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import * as A from '../../model/modules/administration-api.js';
import { useLoad } from './use-load.js';
import { L, Row, Section, ReferenceBox, openForm, csv, startOfDay, shortDay } from './workspace-forms.jsx';

const money = m => (m ? `${m.amount} ${m.currency}` : '—');

function Access({ parish, reload: outer }) {
  const { data, error, reload } = useLoad(() => A.orEmpty(A.parishOfficeCoverage(parish.id), null), [parish.id]);
  const grant = () =>
    openForm({
      title: L('Grant office access', 'منح صلاحية مكتب') + ' · ' + parish.name,
      fields: [
        { name: 'accountId', label: L('Account reference', 'مرجع الحساب') },
        {
          name: 'allows',
          label: L(
            'Allowed (comma separated, e.g. people.read, requests.manage)',
            'المسموح (مفصول بفواصل مثل people.read)'
          )
        },
        { name: 'denies', label: L('Denied (comma separated)', 'الممنوع (مفصول بفواصل)'), required: false },
        { name: 'startsAt', label: L('Starts', 'يبدأ'), type: 'date' },
        { name: 'endsAt', label: L('Ends (optional)', 'ينتهي (اختياري)'), type: 'date', required: false }
      ],
      save: async v =>
        A.grantAccess(parish.id, {
          version: (await A.getParish(parish.id)).version,
          accountId: v.accountId.trim(),
          allows: csv(v.allows),
          denies: csv(v.denies),
          startsAt: startOfDay(v.startsAt),
          endsAt: startOfDay(v.endsAt)
        }),
      done: async () => {
        await reload();
        await outer?.();
      },
      saved: L('Access granted', 'مُنحت الصلاحية')
    });
  const revoke = () =>
    openForm({
      title: L('Revoke office access', 'سحب صلاحية مكتب') + ' · ' + parish.name,
      fields: [
        { name: 'accountId', label: L('Account reference', 'مرجع الحساب') },
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }
      ],
      save: async v =>
        A.revokeAccess(parish.id, {
          version: (await A.getParish(parish.id)).version,
          accountId: v.accountId.trim(),
          reason: v.reason
        }),
      done: reload,
      saved: L('Access revoked', 'سُحبت الصلاحية')
    });
  return (
    <Section
      title={L('Office access', 'صلاحيات المكتب')}
      actions={
        <>
          <button className="btn btn-primary btn-dense" data-grant="" onClick={grant}>
            {L('Grant', 'منح')}
          </button>{' '}
          <button className="btn btn-secondary btn-dense" data-revoke="" onClick={revoke}>
            {L('Revoke', 'سحب')}
          </button>
        </>
      }
    >
      {error ? <p className="alert alert-danger">{error}</p> : null}
      {data ? (
        <>
          {data.noOfficeHolder ? (
            <p className="alert alert-info">
              {L('Nobody holds the office now.', 'لا أحد يشغل المكتب الآن.')} {data.fallback}
            </p>
          ) : null}
          {data.holders.map(h => (
            <Row
              key={h.accountId}
              title={h.accountId}
              lines={[
                h.duties.join(', '),
                `${h.openRequests} ${L('open requests', 'طلبات مفتوحة')} · ${h.openIncidents} ${L('open incidents', 'حوادث مفتوحة')}`,
                h.endsAt && `${L('Until', 'حتى')} ${shortDay(h.endsAt)}`
              ]}
            />
          ))}
        </>
      ) : (
        <p>{L('Office coverage is not available to this account.', 'تغطية المكتب غير متاحة لهذا الحساب.')}</p>
      )}
    </Section>
  );
}

function Billing({ parish, archdioceses, operator }) {
  const { data, error, reload } = useLoad(async () => {
    const [plans, coverage, schedule, transfers] = await Promise.all([
      A.listPlans(),
      A.orEmpty(A.parishCoverage(parish.id)),
      A.orEmpty(A.payerSchedule(parish.id), null),
      A.orEmpty(A.listPayerTransfers(parish.id))
    ]);
    return { plans, coverage, schedule, transfers };
  }, [parish.id]);
  const newInvoice = () =>
    openForm({
      title: L('Create an invoice', 'إنشاء فاتورة') + ' · ' + parish.name,
      fields: [
        {
          name: 'planId',
          label: L('Plan', 'الباقة'),
          type: 'select',
          options: data.plans.map(p => [p.id, `${p.name} · ${money(p.price)} · ${p.termMonths} ${L('months', 'أشهر')}`])
        },
        { name: 'startsAt', label: L('Coverage starts', 'تبدأ التغطية'), type: 'date' }
      ],
      save: async v => {
        const inv = await A.createInvoice(parish.id, { planId: v.planId, startsAt: startOfDay(v.startsAt) });
        toast(L('Invoice created', 'أُنشئت الفاتورة'), `${L('Reference', 'المرجع')}: ${inv.id}`, 'success');
      },
      done: reload
    });
  const openInvoice = async id => {
    const s = await A.getInvoice(parish.id, id);
    const inv = s.invoice.value;
    openForm({
      title: `${inv.planName} · ${inv.status}`,
      intro: `${L('Total', 'المجموع')} ${money(inv.total)} · ${L('paid', 'مدفوع')} ${inv.paid} · ${L('coverage', 'التغطية')} ${shortDay(inv.startsAt)} → ${shortDay(inv.endsAt)} · ${s.activationStatus}. ${s.receipts.length} ${L('cash receipts', 'إيصالات نقدية')}.`,
      label: L('Record cash received', 'تسجيل نقد مستلم'),
      fields: [
        { name: 'amount', label: L('Amount', 'المبلغ'), type: 'number' },
        { name: 'receivedAt', label: L('Received on', 'تاريخ الاستلام'), type: 'date' },
        { name: 'payerName', label: L('Paid by', 'دافع المبلغ') },
        { name: 'collectedBy', label: L('Collected by', 'جامع المبلغ') },
        { name: 'receiptReference', label: L('Receipt reference', 'مرجع الإيصال') }
      ],
      save: v =>
        A.recordCash(parish.id, id, {
          version: s.invoice.version,
          amount: Number(v.amount),
          currency: inv.total.currency,
          receivedAt: startOfDay(v.receivedAt),
          payerName: v.payerName,
          collectedBy: v.collectedBy,
          receiptReference: v.receiptReference
        }),
      done: reload
    });
  };
  const publish = () =>
    openForm({
      title: L('Publish a plan', 'نشر باقة'),
      fields: [
        { name: 'name', label: L('Name', 'الاسم') },
        { name: 'amount', label: L('Price', 'السعر'), type: 'number' },
        { name: 'currency', label: L('Currency', 'العملة'), value: 'USD' },
        {
          name: 'minorUnits',
          label: L('Decimal places of the currency', 'عدد خانات العملة العشرية'),
          type: 'number',
          value: 2
        },
        { name: 'termMonths', label: L('Term in months', 'المدة بالأشهر'), type: 'number', value: 12 },
        {
          name: 'modules',
          label: L(
            'Modules (comma separated: core, office, requests, sacraments, ministries, facilities, finance)',
            'الوحدات (مفصولة بفواصل)'
          )
        }
      ],
      save: v =>
        A.publishPlan({
          name: v.name,
          amount: Number(v.amount),
          currency: v.currency,
          minorUnits: Number(v.minorUnits),
          termMonths: Number(v.termMonths),
          modules: csv(v.modules)
        }),
      done: reload
    });
  const offer = side => {
    const archdiocese = archdioceses[0]?.id || '';
    openForm({
      title:
        side === 'parish'
          ? L('Hand billing to an archdiocese', 'تسليم الفوترة إلى أبرشية')
          : L('Take over this parish’s billing', 'تولّي فوترة الرعية'),
      fields: [
        { name: 'archdioceseId', label: L('Archdiocese reference', 'مرجع الأبرشية'), value: archdiocese },
        { name: 'effectiveFrom', label: L('Effective from', 'ابتداءً من'), type: 'date' },
        { name: 'acceptBy', label: L('Other side must answer by', 'على الطرف الآخر الردّ قبل'), type: 'date' },
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }
      ],
      save: v => {
        const body = {
          direction: side === 'parish' ? 'ParishToArchdiocese' : 'ArchdioceseToParish',
          effectiveFrom: startOfDay(v.effectiveFrom),
          acceptBy: startOfDay(v.acceptBy),
          reason: v.reason
        };
        return side === 'parish'
          ? A.proposeTransferToArchdiocese(parish.id, v.archdioceseId.trim(), body)
          : A.proposeTransferToParish(v.archdioceseId.trim(), parish.id, body);
      },
      done: reload
    });
  };
  const decide = t =>
    openForm({
      title: L('Answer the payer transfer', 'الردّ على نقل الدفع'),
      intro: `${t.direction} · ${t.status} · ${t.reason}`,
      fields: [
        {
          name: 'accept',
          label: L('Decision', 'القرار'),
          type: 'select',
          options: [
            ['true', L('Accept', 'قبول')],
            ['false', L('Decline', 'رفض')]
          ]
        },
        { name: 'reason', label: L('Reason (optional)', 'السبب (اختياري)'), required: false }
      ],
      save: async v => {
        const fresh = await A.getPayerTransfer(parish.id, t.id);
        return A.decideTransfer(parish.id, t.id, {
          version: fresh.version,
          accept: v.accept === 'true',
          reason: v.reason || null
        });
      },
      done: reload
    });
  const cancel = t =>
    openForm({
      title: L('Cancel the payer transfer', 'إلغاء نقل الدفع'),
      fields: [{ name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }],
      save: async v =>
        A.cancelTransfer(parish.id, t.id, {
          version: (await A.getPayerTransfer(parish.id, t.id)).version,
          reason: v.reason
        }),
      done: reload
    });
  return (
    <>
      {error ? <p className="alert alert-danger">{error}</p> : null}
      <Section
        title={L('Plans and coverage', 'الباقات والتغطية')}
        actions={
          <>
            <button
              className="btn btn-primary btn-dense"
              data-invoice-new=""
              disabled={!data?.plans.length}
              onClick={newInvoice}
            >
              {L('Create invoice', 'إنشاء فاتورة')}
            </button>{' '}
            {operator ? (
              <button className="btn btn-secondary btn-dense" data-plan-publish="" onClick={publish}>
                {L('Publish a plan', 'نشر باقة')}
              </button>
            ) : null}
          </>
        }
      >
        {data ? (
          <>
            <h3>{L('Modules in force', 'الوحدات السارية')}</h3>
            {data.coverage.length ? (
              data.coverage.map(c => (
                <Row
                  key={c.id}
                  title={c.modules.join(', ')}
                  lines={[
                    `${shortDay(c.startsAt)} → ${shortDay(c.endsAt)}`,
                    `${L('Invoice', 'الفاتورة')}: ${c.invoiceId}`
                  ]}
                />
              ))
            ) : (
              <p>{L('No coverage recorded for this parish.', 'لا تغطية مسجّلة لهذه الرعية.')}</p>
            )}
            <h3>{L('Published plans', 'الباقات المنشورة')}</h3>
            {data.plans.map(p => (
              <Row
                key={p.id}
                title={p.name}
                lines={[
                  `${money(p.price)} · ${p.termMonths} ${L('months', 'أشهر')} · v${p.version}`,
                  p.modules.join(', ')
                ]}
              />
            ))}
            {!data.plans.length ? <p>{L('No plan has been published.', 'لم تُنشر باقة.')}</p> : null}
            <ReferenceBox label={L('Open an invoice by reference', 'فتح فاتورة بمرجعها')} onOpen={openInvoice} />
          </>
        ) : null}
      </Section>
      <Section
        title={L('Who pays', 'من يدفع')}
        actions={
          <>
            <button className="btn btn-secondary btn-dense" onClick={() => offer('parish')}>
              {L('Hand to archdiocese', 'تسليم إلى أبرشية')}
            </button>{' '}
            <button className="btn btn-secondary btn-dense" onClick={() => offer('archdiocese')}>
              {L('Take over', 'تولّي')}
            </button>
          </>
        }
      >
        {data?.schedule ? (
          <>
            <p>
              {L('Current payer account', 'حساب الدافع الحالي')}: {data.schedule.currentAccountId}
            </p>
            {data.schedule.periods.map((p, i) => (
              <Row
                key={i}
                title={p.payerKind}
                lines={[`${L('From', 'من')} ${shortDay(p.effectiveFrom)}`, p.billingAccountId]}
              />
            ))}
          </>
        ) : (
          <p>{L('The payer schedule is not available to this account.', 'جدول الدافع غير متاح لهذا الحساب.')}</p>
        )}
        {(data?.transfers || []).map(t => (
          <Row
            key={t.id}
            data-transfer={t.id}
            title={`${t.direction} · ${t.status}`}
            lines={[
              `${L('Effective', 'سريان')} ${shortDay(t.effectiveFrom)} · ${L('answer by', 'الردّ قبل')} ${shortDay(t.acceptBy)}`,
              t.reason,
              t.decisionReason
            ]}
            actions={
              t.status === 'Proposed' || t.status === 'Pending' ? (
                <>
                  <button className="btn btn-primary btn-dense" onClick={() => decide(t)}>
                    {L('Answer', 'ردّ')}
                  </button>
                  <button className="btn btn-secondary btn-dense" onClick={() => cancel(t)}>
                    {L('Cancel', 'إلغاء')}
                  </button>
                </>
              ) : null
            }
          />
        ))}
      </Section>
    </>
  );
}

export function AccessAndBilling({ data, reload }) {
  const [id, setId] = useState(data.parishes[0]?.id || '');
  const parish = data.parishes.find(p => p.id === id);
  if (!data.parishes.length)
    return (
      <p>
        {L(
          'No parish in reach. Open one by its reference in Organizations.',
          'لا رعية في النطاق. افتح واحدة بمرجعها في المؤسسات.'
        )}
      </p>
    );
  return (
    <>
      <div className="toolbar" style={{ margin: '12px 0' }}>
        <label>
          {L('Parish', 'الرعية')}{' '}
          <Select data-workspace-parish="" value={id} onChange={e => setId(e.target.value)}>
            {data.parishes.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {parish ? (
        <>
          <Access key={'a' + id} parish={parish} reload={reload} />
          <Billing key={'b' + id} parish={parish} archdioceses={data.archdioceses} operator={data.scopes.operator} />
        </>
      ) : null}
    </>
  );
}
