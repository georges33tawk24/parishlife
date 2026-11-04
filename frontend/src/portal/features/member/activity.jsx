/* My parish life: the public activity of every parish someone follows, or of one of them. */
import { useEffect, useState } from 'react';
import { api } from '../../model/api.js';
import { t, isAr } from '../../../lib/i18n.js';
import { PageHead, Panel, openDrawer, Paged } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { CalendarView } from '../../ui/collection.jsx';

const calendar = { mode: 'month' };

let parish = '';

export function ActivityPage() {
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  const [, setShown] = useState(parish);
  useEffect(() => {
    api('account/activity').then(setData, e => setError(e.message));
  }, []);
  if (data && !data.parishes.some(p => p.id === parish)) parish = '';
  const choose = value => {
    parish = value;
    setShown(value);
  };
  const events = data
    ? data.events
        .filter(e => !parish || e.parish === parish)
        .map(e => ({ ...e, title: isAr() ? e.titleAr || e.title : e.title }))
    : [];
  const open = id => {
    const e = events.find(x => x.id === id);
    if (e)
      openDrawer({
        title: e.title,
        body: (
          <>
            <p>{e.subtitle}</p>
            <p>
              {e.date} · {e.time}
            </p>
            <a className="btn btn-secondary" href={`public.html?parish=${encodeURIComponent(e.parish)}&view=calendar`}>
              {t('Parish calendar and contact', 'رزنامة الرعية والتواصل')}
            </a>
          </>
        )
      });
  };
  return (
    <>
      <PageHead
        title={t('My parish life', 'حياتي الرعوية')}
        sub={t('See the activity of all your parishes, or focus on one.', 'تابع أنشطة كل رعاياك أو اختر رعية واحدة.')}
      />
      <div data-activity="" aria-live="polite">
        {error ? (
          error
        ) : !data ? (
          t('Loading…', 'جارٍ التحميل…')
        ) : (
          <>
            <div className="account-actions">
              <a className="btn btn-secondary" href="#/account">
                {t('Complete Profile · manage my parishes', 'إكمال الملف · إدارة رعاياي')}
              </a>
              <label>
                {t('Activity from', 'أنشطة')}{' '}
                <Select data-parish="" value={parish} onChange={e => choose(e.target.value)}>
                  <option value="">{t('All my parishes', 'كل رعاياي')}</option>
                  {data.parishes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            {data.parishes.length ? null : (
              <p className="member-empty">
                {t(
                  'Follow a parish in Complete Profile to see its public activity. Parish membership is a separate request.',
                  'تابع رعية في إكمال الملف لرؤية أنشطتها العامة. العضوية في الرعية طلب منفصل.'
                )}
              </p>
            )}
            <div data-activity-calendar="">
              <CalendarView events={events} state={calendar} onOpen={open} />
            </div>
            <Panel title={t('Updates for me', 'تحديثاتي')}>
              <Paged className="inbox-grid" data-activity-updates="" data-paginate="">
                {data.notifications.length ? (
                  data.notifications.map((n, i) => (
                    <article
                      key={i}
                      className="inbox-card"
                      data-notice-parish={n.parish_id}
                      hidden={!!parish && n.parish_id !== parish}
                    >
                      <h3>{n.title}</h3>
                      <p className="message-body">{n.body}</p>
                      <small>{n.created_at.slice(0, 10)}</small>
                    </article>
                  ))
                ) : (
                  <p>{t('No updates yet.', 'لا تحديثات بعد.')}</p>
                )}
              </Paged>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
