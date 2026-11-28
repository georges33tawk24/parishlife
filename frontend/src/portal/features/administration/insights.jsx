/* Insights and the parish CRM, for platform operators. Insights are the API's platform figures
   (GET /api/administration/insights): visits recorded on the public site by day, kind and language,
   parishes by operating status and by jurisdiction, and sign-in account counts with new accounts by day
   (counts only, no names or emails). The CRM lists every church (GET /api/administration/parishes) with
   its follow-up record when it has one (stage, next action, follow-up date, notes and history), from
   /api/administration/parish-crm/worklist and .../parishes/{id}/crm; a church without one can be started.
   Main members: InsightsPage; Visits, Crm and Follow are also shown on the operator's Administration overview
   (workspace-overview.jsx). */
import { useRef, useState } from 'react';
import { t, fmtDate, matches } from '../../../lib/i18n.js';
import { PageHead, TabBar, Stat, Empty, Panel, Pill, openDrawer, toast, ListSkeleton } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { DrawerForm } from '../../ui/forms.jsx';
import * as A from '../../model/modules/administration-api.js';
import { useLoad } from './use-load.js';
import { Trend, Bars, DataTable, number, shortDate, useChartTips } from './insight-charts.jsx';

const L = (en, ar) => t(en, ar);

const KIND = {
  'home.view': ['Homepage visits', 'زيارات الصفحة الرئيسية'],
  'directory.view': ['Directory visits', 'زيارات الدليل'],
  'parish.view': ['Parish page visits', 'زيارات صفحات الرعايا'],
  'request.start': ['Requests started', 'طلبات بدأت']
};
const LANG = {
  en: ['English', 'الإنكليزية'],
  fr: ['French', 'الفرنسية'],
  ar: ['Arabic', 'العربية'],
  unknown: ['Not stated', 'غير محددة']
};
const STATUS = {
  Verified: ['Verified', 'موثّقة'],
  PendingVerification: ['Pending verification', 'بانتظار التوثيق'],
  Suspended: ['Suspended', 'معلّقة'],
  Closed: ['Closed', 'مقفلة']
};
const STAGES = {
  Onboarding: ['Onboarding', 'قيد الانضمام'],
  Active: ['Active', 'نشطة'],
  Attention: ['Needs attention', 'تحتاج متابعة'],
  Paused: ['Paused', 'متوقفة']
};
const word = (map, key) => L(...(map[key] || [key, key]));

const iso = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const days = (from, to) => {
  const out = [];
  for (
    let d = new Date(from + 'T00:00:00Z');
    d.toISOString().slice(0, 10) <= to && out.length < 400;
    d = new Date(d.getTime() + 86400000)
  )
    out.push(d.toISOString().slice(0, 10));
  return out;
};

export function Visits() {
  const [from, setFrom] = useState(iso(-30)),
    [to, setTo] = useState(iso());
  const box = useRef(null);
  const { data, error, loading } = useLoad(() => A.platformInsights(from, to), [from, to]);
  useChartTips(box);
  const sum = (rows, key) => {
    const totals = new Map();
    for (const r of rows) totals.set(key(r), (totals.get(key(r)) || 0) + r.count);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  };
  const metrics = data?.siteMetrics || [];
  const dates = days(from, to);
  const perDay = new Map();
  for (const m of metrics) perDay.set(m.day, (perDay.get(m.day) || 0) + m.count);
  const total = metrics.reduce((s, m) => s + m.count, 0);
  return (
    <div className="ins" ref={box}>
      <div className="toolbar" style={{ margin: '12px 0' }}>
        <label>
          {L('From', 'من')}{' '}
          <input
            className="input"
            type="date"
            value={from}
            max={to}
            onChange={e => e.target.value && setFrom(e.target.value)}
          />
        </label>
        <label>
          {L('To', 'إلى')}{' '}
          <input
            className="input"
            type="date"
            value={to}
            min={from}
            onChange={e => e.target.value && setTo(e.target.value)}
          />
        </label>
      </div>
      {error ? <p className="alert alert-danger">{error}</p> : null}
      {loading && !data ? <p role="status">{L('Counting…', 'جارٍ العدّ…')}</p> : null}
      {data ? (
        <>
          <div className="stats" style={{ margin: '16px 0' }}>
            <Stat k={L('Recorded visits', 'الزيارات المسجّلة')} v={number(total)} />
            {data.parishesByStatus.map(s => (
              <Stat key={s.status} k={word(STATUS, s.status)} v={number(s.count)} d={L('parishes', 'رعايا')} />
            ))}
            <Stat
              k={L('Parishes with a jurisdiction', 'رعايا لها أبرشية')}
              v={number(data.parishesWithJurisdiction)}
              d={`${number(data.parishesWithoutJurisdiction)} ${L('without', 'بلا')}`}
            />
          </div>
          {data.accounts ? <AccountsPanel accounts={data.accounts} dates={dates} /> : null}
          <Panel title={L('Visits by day', 'الزيارات يومياً')}>
            <Trend
              dates={dates}
              label={L('Recorded visits by day', 'الزيارات المسجّلة يومياً')}
              series={[{ label: L('Visits', 'الزيارات'), values: dates.map(d => perDay.get(d) || 0), area: true }]}
            />
            <DataTable
              caption={L('Visits by day', 'الزيارات يومياً')}
              head={[L('Day', 'اليوم'), L('Visits', 'الزيارات')]}
              rows={dates.map(d => [shortDate(d), number(perDay.get(d) || 0)])}
            />
          </Panel>
          <div className="ins-grid">
            <Panel title={L('By kind', 'حسب النوع')}>
              <Bars
                rows={sum(metrics, m => m.kind).map(([k, v]) => ({ label: word(KIND, k), value: v }))}
                empty={L('Nothing recorded in this period.', 'لم يُسجَّل شيء في هذه الفترة.')}
              />
            </Panel>
            <Panel title={L('By language', 'حسب اللغة')}>
              <Bars
                rows={sum(metrics, m => m.language).map(([k, v]) => ({ label: word(LANG, k), value: v }))}
                empty={L('Nothing recorded in this period.', 'لم يُسجَّل شيء في هذه الفترة.')}
              />
            </Panel>
          </div>
          {data.notes.length ? (
            <Panel title={L('About these figures', 'عن هذه الأرقام')}>
              <ul>
                {data.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* Sign-in accounts: counts only (the API sends no names or emails), and new accounts by day for the period. */
function AccountsPanel({ accounts: a, dates }) {
  const byDay = new Map((a.createdByDay || []).map(d => [d.day, d.count]));
  const fresh = (a.createdByDay || []).reduce((n, d) => n + d.count, 0);
  return (
    <Panel title={L('Accounts', 'الحسابات')}>
      <div className="stats ins-stats">
        <Stat
          k={L('Accounts', 'الحسابات')}
          v={number(a.total)}
          d={`${number(fresh)} ${L('new in this period', 'جديدة في هذه الفترة')}`}
        />
        <Stat k={L('Active', 'فعّالة')} v={number(a.active)} />
        <Stat k={L('Registration not finished', 'التسجيل غير مكتمل')} v={number(a.pending)} />
        <Stat k={L('Suspended', 'معلّقة')} v={number(a.suspended)} />
        <Stat k={L('With an authenticator', 'مع تطبيق مصادقة')} v={number(a.withAuthenticator)} />
        <Stat k={L('With Google or Microsoft', 'مع Google أو Microsoft')} v={number(a.withGoogleOrMicrosoft)} />
      </div>
      <Trend
        dates={dates}
        label={L('New accounts by day', 'الحسابات الجديدة يومياً')}
        series={[{ label: L('New accounts', 'حسابات جديدة'), values: dates.map(d => byDay.get(d) || 0), area: true }]}
      />
    </Panel>
  );
}

/* One parish in the CRM: stage, next action, follow-up date, notes and history. */
function CrmDetail({ id, name, done }) {
  const { data, error, reload } = useLoad(async () => {
    const [crm, history] = await Promise.all([
      A.getCrm(id).catch(e => (e.status === 404 ? null : Promise.reject(e))),
      A.crmHistory(id)
    ]);
    return { crm, history };
  }, []);
  if (error)
    return (
      <p className="help-error" role="alert">
        {error}
      </p>
    );
  if (!data) return <ListSkeleton />;
  const { crm, history } = data;
  const value = crm?.value;
  return (
    <div className="ins ins-drawer">
      <DrawerForm
        id="crm-form"
        close={false}
        saved={L('Saved', 'حُفظ')}
        save={values =>
          A.saveCrm(id, {
            version: crm?.version || null,
            trackingStatus: values.trackingStatus,
            nextAction: values.nextAction || null,
            followUpAt: values.followUpAt ? `${values.followUpAt}T09:00:00Z` : null,
            reason: values.reason
          })
        }
        done={async () => {
          await reload();
          await done?.();
        }}
      >
        <label className="formrow">
          <span className="label">{L('Stage', 'المرحلة')}</span>
          <Select name="trackingStatus" defaultValue={value?.trackingStatus || 'Onboarding'}>
            {Object.keys(STAGES).map(k => (
              <option key={k} value={k}>
                {word(STAGES, k)}
              </option>
            ))}
          </Select>
        </label>
        <label className="formrow">
          <span className="label">{L('Next action', 'الإجراء التالي')}</span>
          <input className="input" name="nextAction" maxLength="500" defaultValue={value?.nextAction || ''} />
        </label>
        <label className="formrow">
          <span className="label">{L('Next follow-up', 'المتابعة التالية')}</span>
          <input className="input" type="date" name="followUpAt" defaultValue={value?.followUpAt?.slice(0, 10) || ''} />
        </label>
        <label className="formrow">
          <span className="label">{L('Reason for the change', 'سبب التغيير')}</span>
          <input className="input" name="reason" required maxLength="500" />
        </label>
      </DrawerForm>
      <h3 style={{ marginTop: '18px' }}>{L('Add a note', 'إضافة ملاحظة')}</h3>
      <DrawerForm
        close={false}
        label={L('Add note', 'إضافة ملاحظة')}
        save={async (values, form) => {
          await A.addCrmNote(id, {
            version: crm?.version || '',
            occurredAt: new Date().toISOString(),
            text: values.text
          });
          form.reset();
        }}
        done={reload}
      >
        <textarea
          className="textarea"
          name="text"
          rows="3"
          maxLength="2000"
          required
          placeholder={L('What was said or agreed', 'ما قيل أو اتُّفق عليه')}
        />
      </DrawerForm>
      <h3 style={{ marginTop: '18px' }}>{L('History', 'السجل')}</h3>
      <ol className="ins-notes">
        {history.length ? (
          history.map(h => (
            <li key={h.id}>
              <span className="ins-note-kind">{h.kind}</span>
              <p dir="auto">
                {h.text ||
                  h.reason ||
                  `${h.current.trackingStatus}${h.current.nextAction ? ' — ' + h.current.nextAction : ''}`}
              </p>
              <small>{new Date(h.at).toLocaleString()}</small>
            </li>
          ))
        ) : (
          <li className="viz-empty">{L('No notes yet.', 'لا ملاحظات بعد.')}</li>
        )}
      </ol>
      <p className="help">{name}</p>
    </div>
  );
}

/* Every church, with its follow-up record when it has one: stage, next action and follow-up date. A church
   with no record shows "Not followed yet" and opens the same drawer to start one. */
export function Crm() {
  const [stage, setStage] = useState(''),
    [dueOnly, setDueOnly] = useState(false),
    [q, setQ] = useState('');
  const { data, error, loading, reload } = useLoad(async () => {
    const [churches, rows] = await Promise.all([A.platformParishes(), A.crmWorklist({})]);
    const crm = new Map(rows.map(r => [r.value.parishId, { ...r.value, version: r.version }]));
    return churches
      .map(c => ({ ...(crm.get(c.id) || {}), parishId: c.id, name: c.name, locality: c.locality, status: c.status }))
      .sort(
        (a, b) =>
          Number(!!b.trackingStatus) - Number(!!a.trackingStatus) || String(a.name).localeCompare(String(b.name))
      );
  }, []);
  const today = new Date().toISOString().slice(0, 10);
  const due = r => r.followUpAt && r.followUpAt.slice(0, 10) <= today;
  const shown = (data || []).filter(
    r =>
      (!stage || (stage === 'none' ? !r.trackingStatus : r.trackingStatus === stage)) &&
      (!dueOnly || due(r)) &&
      (!q || matches([r.name, r.locality].filter(Boolean).join(' '), q))
  );
  const open = row =>
    openDrawer({
      large: true,
      title: row.name || row.parishId,
      body: <CrmDetail id={row.parishId} name={row.name} done={reload} />
    });
  return (
    <>
      <div className="toolbar ins-toolbar">
        <input
          className="input"
          type="search"
          aria-label={L('Search churches', 'ابحث عن كنيسة')}
          placeholder={L('Search churches', 'ابحث عن كنيسة')}
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <Select aria-label={L('Stage', 'المرحلة')} value={stage} onChange={e => setStage(e.target.value)}>
          <option value="">{L('Every stage', 'كل المراحل')}</option>
          <option value="none">{L('Not followed yet', 'غير متابَعة بعد')}</option>
          {Object.keys(STAGES).map(k => (
            <option key={k} value={k}>
              {word(STAGES, k)}
            </option>
          ))}
        </Select>
        <label className="check">
          <input type="checkbox" checked={dueOnly} onChange={e => setDueOnly(e.target.checked)} />
          {L('Follow-up due', 'متابعة مستحقة')}
        </label>
      </div>
      {error ? <p className="alert alert-danger">{error}</p> : null}
      {loading && !data ? <ListSkeleton rows={6} /> : null}
      {data ? (
        shown.length ? (
          <div className="tablewrap">
            <div className="tablescroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{L('Church', 'الكنيسة')}</th>
                    <th>{L('Status', 'الحالة')}</th>
                    <th>{L('Stage', 'المرحلة')}</th>
                    <th>{L('Next action', 'الإجراء التالي')}</th>
                    <th>{L('Follow-up', 'المتابعة')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map(r => (
                    <tr key={r.parishId}>
                      <td>
                        <b>{r.name || r.parishId}</b>
                        {r.locality ? <small className="dim ins-sub">{r.locality}</small> : null}
                      </td>
                      <td>{word(STATUS, r.status)}</td>
                      <td>
                        {r.trackingStatus ? (
                          <Pill
                            label={word(STAGES, r.trackingStatus)}
                            tone={r.trackingStatus === 'Attention' ? 'warning' : ''}
                          />
                        ) : (
                          <span className="dim">{L('Not followed yet', 'غير متابَعة بعد')}</span>
                        )}
                      </td>
                      <td>{r.nextAction || <span className="dim">—</span>}</td>
                      <td>
                        {r.followUpAt ? (
                          <span className={due(r) ? 'ins-due' : ''}>{fmtDate(r.followUpAt.slice(0, 10))}</span>
                        ) : (
                          <span className="dim">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-dense"
                          data-crm-open={r.parishId}
                          onClick={() => open(r)}
                        >
                          {r.trackingStatus ? L('Open', 'فتح') : L('Start following', 'ابدأ المتابعة')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <Empty glyph="portal" title={L('No church matches', 'لا كنيسة مطابقة')} />
        )
      ) : null}
    </>
  );
}

/* Start following a church chosen from the list of every church. */
export function Follow({ onDone }) {
  const go = async () => {
    const churches = await A.platformParishes().catch(() => []);
    openDrawer({
      title: L('Follow a church', 'متابعة كنيسة'),
      body: (
        <DrawerForm
          save={async v => {
            await A.saveCrm(v.parishId, {
              version: null,
              trackingStatus: 'Onboarding',
              nextAction: null,
              followUpAt: null,
              reason: 'Started following this parish'
            });
          }}
          done={() => {
            toast(L('Church added', 'أُضيفت الكنيسة'), '', 'success');
            return onDone?.();
          }}
        >
          <label className="formrow">
            <span className="label">{L('Church', 'الكنيسة')}</span>
            <Select name="parishId" required defaultValue="">
              <option value="" disabled>
                {L('Choose a church', 'اختر كنيسة')}
              </option>
              {churches.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.locality ? ` · ${c.locality}` : ''}
                </option>
              ))}
            </Select>
          </label>
        </DrawerForm>
      )
    });
  };
  return (
    <button className="btn btn-secondary" data-crm-follow="" onClick={go}>
      {L('Follow a church', 'متابعة كنيسة')}
    </button>
  );
}

export function InsightsPage({ params: [tab = ''] = [] }) {
  tab = tab === 'parishes' ? 'parishes' : '';
  const [key, setKey] = useState(0);
  return (
    <>
      <PageHead
        title={L('Insights', 'المؤشرات')}
        sub={L(
          'How the public site is used and how the parishes stand, from what ParishLife records.',
          'كيف يُستخدم الموقع العام وأين تقف الرعايا، مما تسجّله «حياة الرعية».'
        )}
        actions={tab === 'parishes' ? <Follow onDone={() => setKey(k => k + 1)} /> : null}
      />
      <TabBar
        base="insights"
        items={[
          ['', 'Site and parishes', 'الموقع والرعايا'],
          ['parishes', 'Parish follow-up', 'متابعة الرعايا']
        ]}
        active={tab}
      />
      {tab === 'parishes' ? <Crm key={key} /> : <Visits />}
    </>
  );
}
