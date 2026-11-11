/* The Requests page: the sacrament and certificate queue, with links to the other review queues
   under its heading. */
import { t } from '../../../lib/i18n.js';
import { S } from '../../model/store.js';
import { session, api } from '../../model/api.js';
import { openOnlineRequest } from './online-requests.jsx';
import { sacraments } from './sacraments.jsx';

const L = (en, ar) => t(en, ar);

export const requests = () =>
  sacraments(
    'requests',
    <div className="account-actions request-queues">
      <a className="btn btn-secondary" href="#/membershipreviews">
        {L('Parish memberships', 'عضويات الرعية')} <span data-queue-count="membershipreviews" />
      </a>
      <a className="btn btn-secondary" href="#/guestrequests">
        {L('Guest requests · no account', 'طلبات الزوّار · دون حساب')} <span data-queue-count="guestrequests" />
      </a>
      <a className="btn btn-secondary" href="#/profilereviews">
        {t('Profile corrections', 'تصحيحات الملفات')} <span data-queue-count="profilereviews" />
      </a>
    </div>
  );

/* #/requests/online/<id> opens that online request over the list; the address then settles back on Requests. */
requests.mount = (host, first, second) => {
  api('workspace/request-counts?parish=' + encodeURIComponent(session.parishId))
    .then(counts => {
      if (host.isConnected)
        host.querySelectorAll('[data-queue-count]').forEach(el => {
          el.textContent = counts[el.dataset.queueCount] ? String(counts[el.dataset.queueCount]) : '';
        });
    })
    .catch(() => {});
  sacraments.mount(host);
  if (first === 'online' && second) {
    S.params = [];
    history.replaceState(null, '', '#/requests');
    openOnlineRequest(second);
  }
};
