/* Purpose: the office's queue of requests visitors sent without an account (origin Guest).
   Main function: GuestRequests (the page). A row opens the same case view as an online request
   (requests-case.jsx), which also holds the account-link review and the replacement of a leaked
   tracking link.

   Signed letters on the tracking page and releasing a file to the applicant's link are not connected:
   the API shows a guest only the case's status, its applicant-visible messages and the office's reply,
   and its files are private to the office and signed-in applicants. */
import { useState, useRef } from 'react';
import { t } from '../../../lib/i18n.js';
import { MEMBER_REQUESTS } from '../../model/data.js';
import { bus } from '../../model/store.js';
import { PageHead, CollectionPages } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { openRequestCase, caseStatus } from './requests-case.jsx';

const STATUSES = [
  'Received',
  'NeedsInformation',
  'AcceptedForProcessing',
  'CancellationRequested',
  'Completed',
  'Declined',
  'Withdrawn',
  'Cancelled'
];

export function GuestRequests() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState('');
  const table = useRef(null);
  const requests = MEMBER_REQUESTS.filter(r => r.origin === 'Guest');
  const query = q.toLowerCase().trim();
  return (
    <>
      <PageHead
        title={t('Guest requests', 'طلبات الزوّار')}
        sub={t(
          'Requests submitted without an account. The applicant follows them, and reads your messages, on a private tracking link.',
          'طلبات مرسلة دون حساب. يتابعها مقدّم الطلب ويقرأ رسائلك على رابط متابعة خاص.'
        )}
      />
      <div data-guests="" aria-live="polite">
        <a className="btn btn-secondary" href="#/requests">
          {t('All parish requests', 'كل طلبات الرعية')}
        </a>
        <div className="collection-toolbar">
          <input
            className="input"
            type="search"
            data-search=""
            placeholder={t('Search guest requests', 'ابحث في طلبات الزوّار')}
            aria-label={t('Search requests', 'البحث في الطلبات')}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <Select
            data-status=""
            aria-label={t('Status', 'الحالة')}
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">{t('All statuses', 'كل الحالات')}</option>
            {STATUSES.map(v => (
              <option key={v} value={v}>
                {caseStatus(v)}
              </option>
            ))}
          </Select>
        </div>
        <div className="tablewrap" ref={table}>
          <div className="tablescroll">
            <table className="tbl">
              <thead>
                <tr>
                  {[
                    t('Applicant', 'مقدّم الطلب'),
                    t('Request', 'الطلب'),
                    t('Contact', 'التواصل'),
                    t('Status', 'الحالة'),
                    t('Received', 'الاستلام'),
                    t('Review', 'مراجعة')
                  ].map((x, i) => (
                    <th key={i}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const dto = r.api.dto;
                  const text = [dto.requesterName, dto.summary, dto.requesterContact, dto.reference]
                    .join(' ')
                    .toLowerCase();
                  return (
                    <tr
                      key={r.id}
                      data-search-text={text}
                      data-request-status={dto.status}
                      hidden={!text.includes(query) || (!!status && dto.status !== status)}
                    >
                      <td>{dto.requesterName}</td>
                      <td>{dto.summary}</td>
                      <td>{dto.requesterContact}</td>
                      <td>{caseStatus(dto.status)}</td>
                      <td>{String(dto.receivedAt).slice(0, 10)}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-dense"
                          data-review={r.id}
                          onClick={() => openRequestCase(r.id, () => bus.refresh())}
                        >
                          {t('Review', 'مراجعة')}
                          {dto.claimantAccountId ? ' · ' + t('account link', 'ربط حساب') : ''}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <CollectionPages target={table} body={c => c.querySelector('tbody')} />
        {requests.length ? null : <p>{t('No guest requests yet.', 'لا طلبات زوّار بعد.')}</p>}
      </div>
    </>
  );
}
