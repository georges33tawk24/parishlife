/* Reports, on ParishLife.Api: the parish's work overview (GET /api/parishes/{id}/work-overview: counts
   of what is waiting, by area and queue) and scheduled delivery of it (/api/report-schedules and
   /api/report-deliveries). The old finance, attendance and giving reports are not here: they depend on
   those modules' own data. Email delivery is recorded as requested but not sent until a delivery
   provider is configured. Main member: reports. */
import { PageHead, Panel, Stat, Pill, Table, Empty, TabBar } from '../../ui/ui.jsx';
import { session } from '../../model/api.js';
import * as A from '../../model/modules/administration-api.js';
import { useLoad } from './use-load.js';
import { L, openForm } from './workspace-forms.jsx';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const when = v => (v ? new Date(v).toLocaleString() : '—');

function Overview() {
  const { data, error, loading } = useLoad(() => A.workOverview(session.parishId), [session.parishId]);
  if (error) return <p className="alert alert-danger">{error}</p>;
  if (loading && !data) return <p role="status">{L('Loading…', 'جارٍ التحميل…')}</p>;
  return (
    <>
      <p className="help">
        {L('Generated', 'أُنشئ')} {when(data.generatedAt)}
      </p>
      <div className="stats">
        {data.counts.map(c => (
          <Stat
            key={c.area + c.queue}
            k={`${c.area} · ${c.queue}`}
            v={c.count}
            d={`${c.unit} · ${c.statuses.join(', ')}`}
          />
        ))}
      </div>
      {!data.counts.length ? (
        <Empty glyph="reports" title={L('Nothing is waiting', 'لا شيء بانتظار المعالجة')} />
      ) : null}
    </>
  );
}

function Schedules() {
  const { data, error, reload } = useLoad(
    async () => ({ schedules: await A.listReportSchedules(), deliveries: await A.listReportDeliveries() }),
    []
  );
  const create = () =>
    openForm({
      title: L('Schedule the work overview', 'جدولة نظرة العمل'),
      fields: [
        {
          name: 'frequency',
          label: L('How often', 'التكرار'),
          type: 'select',
          options: [
            ['Daily', L('Daily', 'يومياً')],
            ['Weekly', L('Weekly', 'أسبوعياً')]
          ]
        },
        {
          name: 'dayOfWeek',
          label: L('Day (weekly only)', 'اليوم (أسبوعي فقط)'),
          type: 'select',
          required: false,
          options: [['', '—'], ...DAYS.map(d => [d, d])]
        },
        { name: 'localHour', label: L('Hour of the day (0–23)', 'الساعة (٠–٢٣)'), type: 'number', value: 8 },
        {
          name: 'timeZone',
          label: L('Time zone', 'المنطقة الزمنية'),
          value: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        { name: 'email', label: L('Also ask for an email copy', 'طلب نسخة بالبريد أيضاً'), type: 'check' }
      ],
      save: v =>
        A.createReportSchedule({
          report: 'work-overview',
          parishId: session.parishId,
          frequency: v.frequency,
          dayOfWeek: v.frequency === 'Weekly' ? v.dayOfWeek || null : null,
          localHour: Number(v.localHour),
          timeZone: v.timeZone,
          email: !!v.email
        }),
      done: reload
    });
  const act = (s, version, action) =>
    openForm({
      title: action + ' · ' + s.frequency,
      fields: [{ name: 'reason', label: L('Reason (optional)', 'السبب (اختياري)'), required: false }],
      save: v => A.actReportSchedule(s.id, version, action.toLowerCase(), v.reason),
      done: reload
    });
  if (error) return <p className="alert alert-danger">{error}</p>;
  return (
    <>
      <button className="btn btn-primary" data-schedule-new="" disabled={!session.parishId} onClick={create}>
        {L('New schedule', 'جدول جديد')}
      </button>
      <Panel title={L('Schedules', 'الجداول')}>
        <Table
          cols={[
            { label: L('Report', 'التقرير') },
            { label: L('When', 'متى') },
            { label: L('Status', 'الحالة') },
            { label: L('Next run', 'التشغيل التالي') },
            { label: L('Email', 'البريد') },
            { label: '', cls: 'shrink' }
          ]}
          rows={(data?.schedules || []).map(({ value: s, version }) => ({
            cells: [
              s.report,
              `${s.frequency}${s.dayOfWeek ? ' ' + s.dayOfWeek : ''} ${String(s.localHour).padStart(2, '0')}:00 ${s.timeZone}`,
              <Pill label={s.status} tone={s.status === 'Active' ? 'success' : 'warning'} />,
              <span className="mono dim">{when(s.nextRunAt)}</span>,
              s.emailRequested ? s.emailStatus || L('requested', 'مطلوب') : '—',
              <span className="row" style={{ gap: '6px' }}>
                {s.status === 'Active' ? (
                  <button className="btn btn-secondary btn-dense" onClick={() => act(s, version, 'Pause')}>
                    {L('Pause', 'إيقاف')}
                  </button>
                ) : null}
                {s.status === 'Paused' ? (
                  <button className="btn btn-secondary btn-dense" onClick={() => act(s, version, 'Resume')}>
                    {L('Resume', 'استئناف')}
                  </button>
                ) : null}
                {['Active', 'Paused'].includes(s.status) ? (
                  <button className="btn btn-danger-quiet btn-dense" onClick={() => act(s, version, 'Cancel')}>
                    {L('Cancel', 'إلغاء')}
                  </button>
                ) : null}
              </span>
            ]
          }))}
          empty={<Empty glyph="reports" title={L('No schedule yet', 'لا جداول بعد')} />}
        />
      </Panel>
      <Panel title={L('Deliveries', 'التسليمات')}>
        <Table
          cols={[
            { label: L('Scheduled for', 'مجدولة في') },
            { label: L('Produced', 'أُنتجت') },
            { label: L('Status', 'الحالة') },
            { label: L('Email', 'البريد') }
          ]}
          rows={(data?.deliveries || []).map(d => ({
            cells: [
              when(d.scheduledFor),
              when(d.producedAt),
              d.status,
              d.externalChannel ? `${d.externalChannel}: ${d.externalStatus}` : '—'
            ]
          }))}
          empty={<Empty glyph="reports" title={L('Nothing delivered yet', 'لم يُسلَّم شيء بعد')} />}
        />
      </Panel>
    </>
  );
}

function ReportsPage({ tab }) {
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Reports', 'التقارير') }]}
        title={L('Reports', 'التقارير')}
        sub={L(
          'What is waiting in this parish, and scheduled delivery of that overview.',
          'ما ينتظر المعالجة في هذه الرعية، وجدولة تسليم هذه النظرة.'
        )}
      />
      <TabBar
        base="reports"
        items={[
          ['', 'Work overview', 'نظرة العمل'],
          ['schedules', 'Scheduled delivery', 'التسليم المجدول']
        ]}
        active={tab}
      />
      {tab === 'schedules' ? <Schedules /> : <Overview />}
    </>
  );
}

export function reports(tab = '') {
  return <ReportsPage tab={tab} />;
}
