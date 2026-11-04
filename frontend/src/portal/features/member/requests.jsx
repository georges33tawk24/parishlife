/* My requests: a member's sacrament, certificate and hall requests, and the card on their home
   page. */
import { Fragment } from 'react';

import { t, fmtDate } from '../../../lib/i18n.js';
import { M, memberAction } from '../../model/member-data.js';
import { session } from '../../model/api.js';
import { bus, go, S } from '../../model/store.js';
import { Icon, Pill, openModal, closeOverlays, toast, Paged } from '../../ui/ui.jsx';
import {
  REQUEST_KINDS,
  kindOf,
  fmtDay,
  plannedText,
  todayKey,
  stageInfo,
  isActive,
  CLOSED,
  stepsFor,
  stepsDone,
  nextText
} from '../../model/sacrament-requests.js';
import { OWN, aboutOf, kindGrid, reload, titleOf, txt, unlinked } from './requests-shared.jsx';
import { newPage } from './request-form.jsx';
import { detailPage } from './request-detail.jsx';
import { mountForm } from './request-form-checks.jsx';

const L = (en, ar) => t(en, ar);

const redraw = () => {
  if (session.user?.role === 'member') bus.renderAll();
  else bus.refresh();
};

const meter = r => {
  const total = stepsFor(r).length,
    done = stepsDone(r);
  return (
    <span
      className={`mr-meter${CLOSED.has(r.progress.stage) ? ' is-closed' : ''}`}
      role="img"
      aria-label={txt(L(`${done} of ${total} steps done`, `${done} من ${total} خطوات منجزة`))}
    >
      {Array.from({ length: total }, (_, i) => (
        <i className={i < done ? 'on' : undefined} />
      ))}
    </span>
  );
};

const dateNote = r => {
  const p = r.progress;
  if (OWN.has(r.kind))
    return r.kind === 'custom' && p.preferredDate && isActive(r)
      ? ` · ${L('For', 'ليوم')} ${fmtDay(p.preferredDate)}`
      : '';
  if (p.plannedDate && !CLOSED.has(p.stage)) return ` · ${L('Planned for', 'مقرّر في')} ${plannedText(p)}`;
  if (p.preferredDate && isActive(r)) return ` · ${L('Preferred date', 'التاريخ المفضّل')} ${fmtDay(p.preferredDate)}`;
  return '';
};

function requestCard(r) {
  const [label, tone, mark] = stageInfo(r),
    about = aboutOf(r);
  return (
    <a className={`mr-card${CLOSED.has(r.progress.stage) ? ' is-closed' : ''}`} href={`#/myrequests/${txt(r.id)}`}>
      <span className="mr-card-icon" aria-hidden="true">
        <Icon name={kindOf(r.kind).icon} size={22} />
      </span>{' '}
      <span className="mr-card-main">
        <span className="mr-card-title">
          <b>{txt(titleOf(r))}</b>
          {about ? <span>· {txt(about)}</span> : ''}
        </span>{' '}
        <span className="mr-card-next">{txt(nextText(r))}</span> {meter(r)}{' '}
        <span className="mr-card-meta">
          <bdi className="mono" dir="ltr">
            {txt(r.reference)}
          </bdi>{' '}
          · {L('Sent', 'أُرسل')} {fmtDate(r.createdAt)}
          {dateNote(r)}
        </span>
      </span>{' '}
      <span className="mr-card-side">
        <Pill label={label} tone={tone} mark={mark} />
        <Icon name="chevR" size={18} cls="mr-card-go" />
      </span>
    </a>
  );
}

const howItWorks = () => (
  <section className="mr-how" aria-labelledby="mr-how-title">
    <h2 id="mr-how-title">{L('How it works', 'كيف يجري الطلب')}</h2>
    <ol>
      <li>
        <b>{L('Send your request', 'أرسل طلبك')}</b>
        <span>
          {L('Choose what you need. It takes about two minutes.', 'اختر ما تحتاج إليه. يستغرق ذلك دقيقتين تقريباً.')}
        </span>
      </li>
      <li>
        <b>{L('The parish reviews it', 'تراجعه الرعية')}</b>
        <span>
          {L(
            'The parish office checks the details, and the priest gives his answer.',
            'يتحقّق مكتب الرعية من التفاصيل، ويعطي الكاهن جوابه.'
          )}
        </span>
      </li>
      <li>
        <b>{L('Follow every step', 'تابع كل خطوة')}</b>
        <span>
          {L(
            'Dates, preparation and answers appear here, with a notification at each step.',
            'تظهر المواعيد والتحضير والأجوبة هنا، مع إشعار عند كل خطوة.'
          )}
        </span>
      </li>
    </ol>
  </section>
);

/* What still matters now: requests on their way, and bookings confirmed for a day still to come. */
const current = r =>
  isActive(r) || (r.kind === 'booking' && r.progress.stage === 'confirmed' && r.details.date >= todayKey());

function listPage() {
  const active = M.requests.filter(current),
    earlier = M.requests.filter(r => !current(r));
  const linked = (M.requestOptions?.subjects || []).length > 0;
  const section = (id, title, body, extra = '') => (
    <section className="mr-section" aria-labelledby={`mr-${id}`}>
      <div className="member-section-head">
        <h2 id={`mr-${id}`}>{title}</h2>
        {extra}
      </div>
      {body}
    </section>
  );
  return (
    <div className="member-page mr-page">
      <header className="member-head">
        <h1>{L('My requests', 'طلباتي')}</h1>{' '}
        <p>
          {L(
            'Ask the parish for a sacrament, a certificate, a hall or anything else, then follow every step here.',
            'اطلب من الرعية سرّاً أو شهادة أو قاعة أو أي أمر آخر، ثم تابع كل خطوة هنا.'
          )}
        </p>
      </header>{' '}
      {linked ? '' : unlinked()}{' '}
      {active.length
        ? section(
            'active',
            L('Current requests', 'طلباتك الحالية'),
            <Paged className="mr-cards">
              {active.map((item, i, all) => (
                <Fragment key={i}>{requestCard(item, i, all)}</Fragment>
              ))}
            </Paged>
          )
        : ''}{' '}
      {section(
        'sacraments',
        L('Sacraments and certificates', 'الأسرار والشهادات'),
        kindGrid(REQUEST_KINDS.filter(k => !k.other))
      )}{' '}
      {section(
        'other',
        L('Book a place, or ask for something else', 'احجز مكاناً، أو اطلب أمراً آخر'),
        kindGrid(
          REQUEST_KINDS.filter(k => k.other),
          ' mr-kinds-2'
        )
      )}{' '}
      {M.requests.length ? '' : howItWorks()}{' '}
      {earlier.length
        ? section(
            'earlier',
            L('Completed and closed', 'المنجزة والمغلقة'),
            <Paged className="mr-cards">
              {earlier.map((item, i, all) => (
                <Fragment key={i}>{requestCard(item, i, all)}</Fragment>
              ))}
            </Paged>
          )
        : ''}
    </div>
  );
}

/* ---- the route ---------------------------------------------------------------- */
export function requestsPage(first = '', second = '') {
  if (first === 'new') return newPage(second);
  if (first) return detailPage(first);
  return listPage();
}

requestsPage.mount = host => {
  mountForm(host);
  host.querySelectorAll('[data-mr-withdraw]').forEach(b =>
    b.addEventListener('click', () => {
      const r = M.requests.find(x => x.id === b.dataset.mrWithdraw);
      if (!r) return;
      const about = aboutOf(r);
      openModal({
        title: L('Withdraw this request?', 'سحب هذا الطلب؟'),
        body: (
          <>
            <div className="mr-withdraw-what">
              <span className="mr-card-icon" aria-hidden="true">
                <Icon name={kindOf(r.kind).icon} size={20} />
              </span>
              <div>
                <b>{txt(titleOf(r))}</b>{' '}
                <span>
                  {about ? `${txt(about)} · ` : ''}
                  <bdi className="mono" dir="ltr">
                    {txt(r.reference)}
                  </bdi>
                </span>
              </div>
            </div>{' '}
            <p className="mr-withdraw-note">
              {L(
                'The parish office will no longer see it as waiting. You can send a new request at any time.',
                'لن يظهر لمكتب الرعية كطلب منتظر بعد الآن. يمكنك إرسال طلب جديد في أي وقت.'
              )}
            </p>
          </>
        ),
        foot: (
          <>
            <button className="btn btn-secondary" data-close="">
              {L('Keep the request', 'إبقاء الطلب')}
            </button>
            <button className="btn btn-danger" id="mr-withdraw-yes">
              {L('Withdraw request', 'سحب الطلب')}
            </button>
          </>
        ),
        onMount(el) {
          const yes = el.querySelector('#mr-withdraw-yes');
          yes.addEventListener('click', async () => {
            yes.disabled = true;
            yes.setAttribute('aria-busy', 'true');
            try {
              await memberAction('requestWithdraw', { id: r.id });
              await reload();
              closeOverlays();
              redraw();
              toast(L('Request withdrawn', 'سُحب الطلب'), '', 'success');
            } catch (error) {
              yes.disabled = false;
              yes.removeAttribute('aria-busy');
              toast(L('Could not withdraw the request', 'تعذّر سحب الطلب'), error.message, 'danger');
            }
          });
        }
      });
    })
  );
  host.querySelectorAll('[data-mr-certificate]').forEach(b =>
    b.addEventListener('click', () => {
      const r = M.requests.find(x => location.hash.endsWith(x.id));
      S.ui.mrDraft = null;
      S.ui.mrPrefill = {
        kind: 'certificate',
        certificateOf: b.dataset.mrCertificate,
        subject: r && !r.subject.new ? r.subject.id : ''
      };
      go('myrequests/new/certificate');
    })
  );
  if (S.ui.mrJustSent && location.hash.endsWith(S.ui.mrJustSent))
    setTimeout(() => {
      S.ui.mrJustSent = null;
    }, 0);
};

/* The home page's view of requests: what is moving, or how to start. */
export function homeCard() {
  const active = M.requests.filter(current);
  if (active.length)
    return (
      <section className="member-card mr-home">
        <div className="mr-card-head">
          <h2>{L('My requests', 'طلباتي')}</h2>{' '}
          <a className="btn btn-ghost btn-dense" href="#/myrequests">
            {L('View all', 'عرض الكل')}
          </a>
        </div>{' '}
        <Paged className="mr-cards">
          {active.slice(0, 2).map((item, i, all) => (
            <Fragment key={i}>{requestCard(item, i, all)}</Fragment>
          ))}
        </Paged>
      </section>
    );
  return (
    <section className="member-card mr-home mr-home-cta">
      <div className="mr-home-icons" aria-hidden="true">
        {['water', 'rings', 'rooms'].map((i, k) => (
          <span key={k}>
            <Icon name={i} size={20} />
          </span>
        ))}
      </div>{' '}
      <div>
        <h2>
          {L(
            'Planning a baptism or a wedding, or need a certificate or the parish hall?',
            'تخطّط لمعمودية أو إكليل، أو تحتاج إلى شهادة أو إلى قاعة الرعية؟'
          )}
        </h2>{' '}
        <p>
          {L('Ask your parish online and follow every step here.', 'اطلب من رعيتك عبر الإنترنت وتابع كل خطوة من هنا.')}
        </p>
      </div>{' '}
      <a className="btn btn-primary" href="#/myrequests">
        {L('Start a request', 'ابدأ طلباً')}
      </a>
    </section>
  );
}
