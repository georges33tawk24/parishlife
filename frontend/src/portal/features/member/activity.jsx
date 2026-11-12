/* My parish life: the parishes this account follows or belongs to, what is coming up across them, the
   latest notifications, and the controls for following, the primary parish and membership requests.
   Data and actions: loadActivity, directory and activityAction (model/member-data.js). */
import { useEffect, useState } from 'react';
import { loadSession, session } from '../../model/api.js';
import { activityAction, directory, loadActivity } from '../../model/member-data.js';
import { hydrate } from '../../model/persist.js';
import { bus } from '../../model/store.js';
import { t, fmtDate } from '../../../lib/i18n.js';
import { PageHead, Panel, openDrawer, closeOverlays, toast, Paged } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { CalendarView } from '../../ui/collection.jsx';

const calendar = { mode: 'month' };

let parish = '';

const ask = async (op, values, done) => {
  try {
    await activityAction(op, values);
    await loadSession(); // the parishes and roles this account now has
    await hydrate();
    bus.refresh();
    closeOverlays();
    if (done) toast(done, '', 'success');
    return true;
  } catch (error) {
    toast(t('Could not save', 'تعذّر الحفظ'), error.message, 'danger');
    return false;
  }
};

function applyDrawer(p) {
  const words = String(session.user?.name || '')
    .trim()
    .split(/\s+/);
  const field = (id, label, value = '', type = 'text') => (
    <div className="formrow">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input className="input" id={id} type={type} defaultValue={value} />
    </div>
  );
  openDrawer({
    title: t(`Request membership in ${p.name}`, `طلب العضوية في ${p.name}`),
    sub: t(
      'The parish office matches your request to its records and decides. Following a parish is separate from membership.',
      'يطابق مكتب الرعية طلبك مع سجلاته ويقرّر. متابعة الرعية منفصلة عن العضوية.'
    ),
    body: (
      <>
        {field('apply-given', t('Given name', 'الاسم الأول'), words[0] || '')}
        {field('apply-family', t('Family name', 'اسم العائلة'), words.slice(1).join(' '))}
        {field('apply-born', t('Date of birth (optional)', 'تاريخ الميلاد (اختياري)'), '', 'date')}
        {field('apply-contact', t('Phone or email (optional)', 'الهاتف أو البريد (اختياري)'))}
        {field('apply-locality', t('Town or neighbourhood (optional)', 'البلدة أو الحي (اختياري)'))}
        <div className="formrow">
          <label className="label" htmlFor="apply-note">
            {t('Note to the office (optional)', 'ملاحظة للمكتب (اختياري)')}
          </label>
          <textarea className="textarea" id="apply-note" rows="3" maxLength="1000" />
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {t('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="apply-send">
          {t('Send request', 'إرسال الطلب')}
        </button>
      </>
    ),
    onMount(el) {
      const v = id => el.querySelector('#' + id).value.trim();
      el.querySelector('#apply-send').addEventListener('click', () => {
        if (!v('apply-given') || !v('apply-family'))
          return el.querySelector(!v('apply-given') ? '#apply-given' : '#apply-family').focus();
        ask(
          'apply',
          {
            parishId: p.parishId,
            givenName: v('apply-given'),
            familyName: v('apply-family'),
            birthDate: v('apply-born'),
            contact: v('apply-contact'),
            locality: v('apply-locality'),
            note: v('apply-note')
          },
          t('Request sent', 'أُرسل الطلب')
        );
      });
    }
  });
}

export function ActivityPage() {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [parishes, setParishes] = useState([]),
    [pick, setPick] = useState(''),
    [tick, setTick] = useState(0);
  const [, setShown] = useState(parish);
  useEffect(() => {
    loadActivity().then(setData, e => setError(e.message));
  }, [tick]);
  useEffect(() => {
    directory().then(setParishes);
  }, []);
  const reload = () => setTick(n => n + 1);
  const run = async (op, values, done) => {
    if (await ask(op, values, done)) reload();
  };
  if (data && !data.parishes.some(p => p.parishId === parish)) parish = '';
  const choose = value => {
    parish = value;
    setShown(value);
  };
  const events = data
    ? data.events
        .filter(e => !parish || e.parishId === parish)
        .map(e => ({ ...e, date: e.d, time: e.t, subtitle: e.parishName }))
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
            {e.location ? <p>{e.location}</p> : null}
            <a
              className="btn btn-secondary"
              href={`public.html?parish=${encodeURIComponent(e.parishId)}&view=calendar`}
            >
              {t('Parish calendar and contact', 'رزنامة الرعية والتواصل')}
            </a>
          </>
        )
      });
  };
  const followed = new Set((data?.parishes || []).map(p => p.parishId));
  const waiting = id => (data?.applications[id] || []).find(r => ['Submitted', 'NeedsInformation'].includes(r.status));
  const home = id => data?.home?.parishes?.find(h => h.parishId === id);
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
            <Panel title={t('My parishes', 'رعاياي')}>
              {data.parishes.length ? (
                data.parishes.map(p => {
                  const request = waiting(p.parishId);
                  return (
                    <div key={p.parishId} className="member-simple-row" data-my-parish={p.parishId}>
                      <span>
                        <b>{p.name}</b> · {p.relationship === 'Member' ? t('Member', 'عضو') : t('Following', 'متابَعة')}
                        {p.primary ? ` · ${t('Primary', 'الأساسية')}` : ''}
                        {home(p.parishId)?.unreadNotifications
                          ? ` · ${home(p.parishId).unreadNotifications} ${t('new', 'جديد')}`
                          : ''}
                        {request ? ` · ${t('Membership requested', 'طلب العضوية قيد المراجعة')}` : ''}
                      </span>
                      <span className="account-actions">
                        {p.primary ? null : (
                          <button
                            className="btn btn-secondary btn-dense"
                            data-primary={p.parishId}
                            onClick={() =>
                              run(
                                'primary',
                                { parishId: p.parishId },
                                t('Primary parish changed', 'تغيّرت الرعية الأساسية')
                              )
                            }
                          >
                            {t('Make primary', 'جعلها الأساسية')}
                          </button>
                        )}
                        {p.relationship === 'Member' ? null : request ? (
                          <button
                            className="btn btn-secondary btn-dense"
                            data-withdraw={request.id}
                            onClick={() =>
                              run(
                                'withdraw',
                                { parishId: p.parishId, id: request.id },
                                t('Request withdrawn', 'سُحب الطلب')
                              )
                            }
                          >
                            {t('Withdraw request', 'سحب الطلب')}
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-dense"
                            data-apply={p.parishId}
                            onClick={() => applyDrawer(p)}
                          >
                            {t('Request membership', 'طلب العضوية')}
                          </button>
                        )}
                        {p.relationship === 'Member' ? null : (
                          <button
                            className="btn btn-secondary btn-dense"
                            data-unfollow={p.parishId}
                            onClick={() =>
                              run('unfollow', { parishId: p.parishId }, t('No longer following', 'لم تعد تتابع الرعية'))
                            }
                          >
                            {t('Unfollow', 'إلغاء المتابعة')}
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="member-empty">
                  {t(
                    'Follow a parish to see its public activity. Parish membership is a separate request.',
                    'تابع رعية لترى أنشطتها العامة. العضوية في الرعية طلب منفصل.'
                  )}
                </p>
              )}
              <div className="account-actions">
                <Select
                  data-follow=""
                  value={pick}
                  onChange={e => setPick(e.target.value)}
                  aria-label={t('Parish to follow', 'رعية للمتابعة')}
                >
                  <option value="">{t('Choose a parish to follow…', 'اختر رعية لمتابعتها…')}</option>
                  {parishes
                    .filter(p => !followed.has(p.parishId))
                    .map(p => (
                      <option key={p.parishId} value={p.parishId}>
                        {p.name}
                      </option>
                    ))}
                </Select>
                <button
                  className="btn btn-primary"
                  data-follow-go=""
                  disabled={!pick}
                  onClick={() =>
                    run('follow', { parishId: pick }, t('Now following', 'تتابع الرعية الآن')).then(() => setPick(''))
                  }
                >
                  {t('Follow', 'متابعة')}
                </button>
                <a className="btn btn-secondary" href="#/account">
                  {t('My account', 'حسابي')}
                </a>
              </div>
            </Panel>
            <div className="account-actions">
              <label>
                {t('Activity from', 'أنشطة')}{' '}
                <Select data-parish="" value={parish} onChange={e => choose(e.target.value)}>
                  <option value="">{t('All my parishes', 'كل رعاياي')}</option>
                  {data.parishes.map(p => (
                    <option key={p.parishId} value={p.parishId}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
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
                      data-notice-parish={n.parishId}
                      hidden={!!parish && n.parishId !== parish}
                    >
                      <h3>{n.title}</h3>
                      <small>{fmtDate(n.createdAt)}</small>
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
