/* The platform operator's overview, at the top of the Administration workspace's main tab (owner, 27 November
   2026: the super admin page should carry the CRM and the analytics). It reuses the Insights page's parts on
   the same API calls: the site and parish figures (GET /api/administration/insights) and the parish follow-up
   worklist (GET /api/administration/parish-crm/worklist, each row opening its CRM record). Nothing new is
   counted or stored here.
   Main member: PlatformOverview. */
import { useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { Visits, Crm, Follow } from './insights.jsx';

const L = (en, ar) => t(en, ar);

const Heading = ({ id, title, children }) => (
  <div className="panel-h" style={{ marginTop: 8 }}>
    <h2 id={id}>{title}</h2>
    <div className="more">{children}</div>
  </div>
);

export function PlatformOverview() {
  const [round, setRound] = useState(0);
  return (
    <div data-platform-overview="">
      <section aria-labelledby="overview-crm">
        <Heading id="overview-crm" title={L('Parish follow-up', 'متابعة الرعايا')}>
          <Follow onDone={() => setRound(n => n + 1)} />
          <a className="btn btn-ghost btn-dense" href="#/insights/parishes">
            {L('Open in Insights', 'فتح في المؤشرات')}
          </a>
        </Heading>
        <Crm key={round} />
      </section>
      <section aria-labelledby="overview-site">
        <Heading id="overview-site" title={L('Site analytics', 'تحليلات الموقع')}>
          <a className="btn btn-ghost btn-dense" href="#/insights">
            {L('Open in Insights', 'فتح في المؤشرات')}
          </a>
        </Heading>
        <Visits />
      </section>
    </div>
  );
}
