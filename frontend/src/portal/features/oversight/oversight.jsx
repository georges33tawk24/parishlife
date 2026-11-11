/* The bishop's pages, read-only, from the API's bishop overview (GET /api/archdioceses/{id}/overview and
   .../overview/map): what each parish of the archdiocese has in counts, the eparchy list and the parish
   map. The API gives counts and office coverage, not parish records, so a parish's people, sacraments,
   calendar and groups are not shown here.
   Main members: Oversight, Eparchy, MapView. */
import { useState } from 'react';
import { t, fmtDate } from '../../../lib/i18n.js';
import { PageHead, Table, Stat, Pill, Empty, Panel } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { bishopOverview, bishopMap, myScopes } from '../../model/modules/administration-api.js';
import { useLoad } from '../administration/use-load.js';

const L = (en, ar) => t(en, ar);

const TONE = { Verified: 'success', PendingVerification: 'warning', Suspended: 'danger', Closed: 'quiet' };
const STATUS_WORDS = {
  Verified: ['Verified', 'موثّقة'],
  PendingVerification: ['Pending verification', 'بانتظار التوثيق'],
  Suspended: ['Suspended', 'معلّقة'],
  Closed: ['Closed', 'مقفلة']
};
const StatusPill = ({ status }) => (
  <Pill label={L(...(STATUS_WORDS[status] || [status, status]))} tone={TONE[status] || ''} />
);

const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const startOf = d => `${d}T00:00:00Z`,
  endOf = d => `${d}T23:59:59Z`;

/* The archdioceses this account oversees (as bishop, or as archdiocese administrator). */
function useArchdioceses() {
  return useLoad(async () => (await myScopes()).archdioceses, []);
}

/* Which archdiocese is shown: the route's, else the first. */
function Picker({ list, value, onChange }) {
  if (list.length < 2) return null;
  return (
    <div className="toolbar" style={{ margin: '18px 0' }}>
      <label htmlFor="oversight-archdiocese">{L('Archdiocese', 'الأبرشية')}</label>
      <Select id="oversight-archdiocese" value={value} onChange={e => onChange(e.target.value)}>
        {list.map(a => (
          <option key={a.id} value={a.id}>
            {a.name || a.id}
          </option>
        ))}
      </Select>
    </div>
  );
}

function Shell({ title, sub, children }) {
  return (
    <>
      <PageHead title={title} sub={sub} />
      {children}
    </>
  );
}

function Gate({ scopes, children }) {
  if (scopes.loading) return <p role="status">{L('Loading…', 'جارٍ التحميل…')}</p>;
  if (scopes.error) return <p className="alert alert-danger">{scopes.error}</p>;
  if (!scopes.data.length)
    return (
      <Empty
        glyph="shield"
        title={L('No archdiocese to oversee', 'لا أبرشية للإشراف عليها')}
        body={L(
          'This account holds no bishop or archdiocese administrator appointment.',
          'لا يملك هذا الحساب تعيين مطران أو مدير أبرشية.'
        )}
      />
    );
  return children;
}

export function Oversight() {
  const scopes = useArchdioceses();
  const [picked, setPicked] = useState(''),
    [from, setFrom] = useState(day(-30)),
    [to, setTo] = useState(day());
  const archdiocese = picked || scopes.data?.[0]?.id || '';
  const overview = useLoad(
    () => (archdiocese ? bishopOverview(archdiocese, startOf(from), endOf(to)) : Promise.resolve(null)),
    [archdiocese, from, to]
  );
  const o = overview.data;
  return (
    <Shell
      title={L('Parish oversight', 'الإشراف على الرعايا')}
      sub={L(
        'Counts for each parish of your archdiocese. Parish records themselves are not shown.',
        'أعداد كل رعية في أبرشيتك. لا تُعرض سجلات الرعايا نفسها.'
      )}
    >
      <Gate scopes={scopes}>
        <Picker list={scopes.data || []} value={archdiocese} onChange={setPicked} />
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
        {overview.error ? <p className="alert alert-danger">{overview.error}</p> : null}
        {overview.loading && !o ? <p role="status">{L('Loading oversight…', 'جارٍ تحميل بيانات الإشراف…')}</p> : null}
        {o ? (
          <>
            <div className="stats" style={{ margin: '16px 0' }}>
              <Stat
                k={L('Parishes', 'الرعايا')}
                v={o.totals.parishes}
                d={`${o.totals.parishesWithoutHeadPriest} ${L('without a head priest', 'بلا كاهن رئيسي')}`}
              />
              <Stat
                k={L('Current priests', 'الكهنة الحاليون')}
                v={o.totals.currentPriests}
                d={`${o.totals.otherCurrentStaff} ${L('other staff', 'موظفون آخرون')}`}
              />
              <Stat
                k={L('Open requests', 'الطلبات المفتوحة')}
                v={o.totals.openRequests}
                d={`${o.totals.requestsReceived} ${L('received', 'مستلمة')}`}
              />
              <Stat k={L('Certificates awaiting you', 'شهادات بانتظارك')} v={o.totals.certificatesAwaitingBishop} />
              <Stat k={L('Membership requests', 'طلبات العضوية')} v={o.totals.membershipRequestsPending} />
              <Stat k={L('Published events', 'الأحداث المنشورة')} v={o.totals.publishedEvents} />
            </div>
            <Table
              cols={[
                { label: L('Parish', 'الرعية') },
                { label: L('Status', 'الحالة') },
                { label: L('Priests', 'الكهنة'), cls: 'num' },
                { label: L('Head priest', 'الكاهن الرئيسي') },
                { label: L('Other staff', 'موظفون'), cls: 'num hide-sm' },
                { label: L('Open requests', 'طلبات مفتوحة'), cls: 'num' },
                { label: L('Certificates', 'شهادات'), cls: 'num hide-sm' },
                { label: L('Membership', 'عضوية'), cls: 'num hide-sm' },
                { label: L('Events', 'أحداث'), cls: 'num hide-sm' }
              ]}
              rows={o.parishes.map(p => ({
                cells: [
                  <>
                    <b>{p.name}</b>
                    <small style={{ display: 'block' }}>{p.locality}</small>
                  </>,
                  <StatusPill status={p.status} />,
                  <span className="num">{p.currentPriests}</span>,
                  p.headPriestDesignated ? (
                    L('Designated', 'معيَّن')
                  ) : (
                    <span className="dim">{L('None', 'لا أحد')}</span>
                  ),
                  <span className="num dim">{p.otherCurrentStaff}</span>,
                  <span className="num">{p.openRequests}</span>,
                  <span className="num dim">{p.certificatesAwaitingBishop}</span>,
                  <span className="num dim">{p.membershipRequestsPending}</span>,
                  <span className="num dim">{p.publishedEvents}</span>
                ]
              }))}
              empty={<Empty glyph="portal" title={L('No parishes in this archdiocese', 'لا رعايا في هذه الأبرشية')} />}
            />
            <Panel title={L('How these counts are measured', 'كيف تُقاس هذه الأعداد')}>
              <dl className="dl">
                {o.measures.map(m => (
                  <div key={m.key}>
                    <dt>{m.key}</dt>
                    <dd>
                      {m.definition} <small className="dim">({m.basis})</small>
                    </dd>
                  </div>
                ))}
              </dl>
              {o.excluded.length ? (
                <p className="help">
                  {L('Not included, by design', 'غير مشمول عمداً')}: {o.excluded.join(', ')}
                </p>
              ) : null}
              <p className="help">
                {fmtDate(o.from.slice(0, 10))} – {fmtDate(o.to.slice(0, 10))} · {L('ordered', 'الترتيب')}: {o.ordering}
              </p>
            </Panel>
          </>
        ) : null}
      </Gate>
    </Shell>
  );
}

export function Eparchy() {
  const scopes = useArchdioceses();
  const [picked, setPicked] = useState('');
  const archdiocese = picked || scopes.data?.[0]?.id || '';
  const overview = useLoad(
    () => (archdiocese ? bishopOverview(archdiocese, startOf(day(-30)), endOf(day())) : Promise.resolve(null)),
    [archdiocese]
  );
  const o = overview.data;
  return (
    <Shell
      title={L('Eparchy', 'الأبرشية')}
      sub={L('Read-only list of the parishes in your archdiocese.', 'قائمة للقراءة فقط برعايا أبرشيتك.')}
    >
      <Gate scopes={scopes}>
        <Picker list={scopes.data || []} value={archdiocese} onChange={setPicked} />
        {overview.error ? <p className="alert alert-danger">{overview.error}</p> : null}
        {o ? (
          <>
            <div className="stats" style={{ margin: '18px 0' }}>
              <Stat k={L('Parishes', 'الرعايا')} v={o.totals.parishes} />
              <Stat k={L('Current priests', 'الكهنة الحاليون')} v={o.totals.currentPriests} />
              <Stat k={L('Without a head priest', 'بلا كاهن رئيسي')} v={o.totals.parishesWithoutHeadPriest} />
            </div>
            <Table
              cols={[
                { label: L('Parish', 'الرعية') },
                { label: L('Locality', 'البلدة') },
                { label: L('Status', 'الحالة') }
              ]}
              rows={o.parishes.map(p => ({ cells: [<b>{p.name}</b>, p.locality, <StatusPill status={p.status} />] }))}
              empty={<Empty glyph="portal" title={L('No parishes in this archdiocese', 'لا رعايا في هذه الأبرشية')} />}
            />
            <p style={{ marginTop: '18px' }}>
              <a href="#/assignments" className="text-link">
                {L('View priest assignments', 'عرض تعيينات الكهنة')}
              </a>
            </p>
          </>
        ) : overview.loading ? (
          <p role="status">{L('Loading…', 'جارٍ التحميل…')}</p>
        ) : null}
      </Gate>
    </Shell>
  );
}

export function MapView() {
  const scopes = useArchdioceses();
  const [picked, setPicked] = useState('');
  const archdiocese = picked || scopes.data?.[0]?.id || '';
  const map = useLoad(() => (archdiocese ? bishopMap(archdiocese) : Promise.resolve(null)), [archdiocese]);
  const m = map.data;
  return (
    <Shell
      title={L('Parish map', 'خريطة الرعايا')}
      sub={L('Where the parishes of the archdiocese are, as recorded.', 'مواقع رعايا الأبرشية كما سُجّلت.')}
    >
      <Gate scopes={scopes}>
        <Picker list={scopes.data || []} value={archdiocese} onChange={setPicked} />
        {map.error ? <p className="alert alert-danger">{map.error}</p> : null}
        {m ? (
          <>
            <p className="alert alert-info">
              {L(
                `${m.located} parishes have a recorded location and ${m.notLocated} do not. A parish without a recorded location is listed but never placed on a guess.`,
                `${m.located} رعايا لها موقع مسجّل و${m.notLocated} بلا موقع. تُعرض الرعية بلا موقع في القائمة دون تقدير.`
              )}
            </p>
            <Table
              cols={[
                { label: L('Parish', 'الرعية') },
                { label: L('Locality', 'البلدة'), cls: 'hide-sm' },
                { label: L('Status', 'الحالة') },
                { label: L('Location', 'الموقع') },
                { label: L('Source', 'المصدر'), cls: 'hide-sm' }
              ]}
              rows={m.parishes.map(p => ({
                cells: [
                  <b>{p.name}</b>,
                  p.locality,
                  <StatusPill status={p.status} />,
                  p.latitude != null && p.longitude != null ? (
                    <a
                      className="text-link mono"
                      dir="ltr"
                      href={`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=16/${p.latitude}/${p.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.latitude}, {p.longitude}
                    </a>
                  ) : (
                    <span className="dim">{L('Not recorded', 'غير مسجّل')}</span>
                  ),
                  <span className="dim">{p.sourceReference || '—'}</span>
                ]
              }))}
              empty={<Empty glyph="pin" title={L('No parishes in this archdiocese', 'لا رعايا في هذه الأبرشية')} />}
            />
          </>
        ) : map.loading ? (
          <p role="status">{L('Loading…', 'جارٍ التحميل…')}</p>
        ) : null}
      </Gate>
    </Shell>
  );
}
