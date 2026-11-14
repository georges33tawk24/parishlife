/* Notices and the weekly bulletin: the parish's notices (announcements, drafted, published and withdrawn
   through ParishLife.Api), upcoming Masses and a bulletin to print. The bulletin's introduction and Mass
   intentions are typed for printing only: the API has nowhere to keep them, so they are not saved. */
import { nodesOr, paint } from '../../ui/html.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { Icon, PageHead, Panel, Pill, Empty, openDrawer } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { session } from '../../model/api.js';
import { printSheet } from '../../shared/print.js';
import { NOTICES, PARISH, EVENTS, venue } from '../../model/data.js';
import { noticeForm, publishNotice, withdrawNotice } from './notices-dialogs.jsx';
import { nameOf } from '../../model/names.js';

const L = (en, ar) => t(en, ar);

export function notices() {
  const AUDIENCE = {
    Public: ['Public page', 'الصفحة العامة'],
    Members: ['Members', 'الأعضاء'],
    Ministry: ['A ministry', 'خدمة']
  };
  const rows = nodesOr(
    NOTICES.map(n => (
      <div key={n.id} className="listrow" style={{ alignItems: 'flex-start' }}>
        <span className="grow">
          <b dir="auto">{L(n.title, n.ar)}</b>{' '}
          <small>
            {n.at ? fmtDate(n.at) + ' · ' : ''}
            {L(...AUDIENCE[n.visibility])}
            {n.category ? ` · ${n.category}` : ''}
            {n.authorId ? ` · ${L('by', 'بقلم')} ${nameOf(session.parishId, n.authorId) || '—'}` : ''}
          </small>
        </span>{' '}
        {n.urgent ? <Pill label={L('Urgent', 'عاجل')} tone="danger" mark="st-no" /> : null}
        {n.pinned ? <Pill label={L('Pinned', 'مثبّت')} tone="info" mark="st-open" /> : null}
        {n.status === 'published' ? (
          <Pill label={L('Published', 'منشور')} tone="success" mark="st-ok" />
        ) : n.status === 'withdrawn' ? (
          <Pill label={L('Withdrawn', 'مسحوب')} mark="st-pause" />
        ) : (
          <Pill label={L('Draft', 'مسودة')} tone="info" mark="st-open" />
        )}
        {n.status === 'draft' ? (
          <>
            <button className="btn btn-secondary btn-dense" onClick={() => noticeForm(n)}>
              {L('Edit', 'تعديل')}
            </button>
            <button className="btn btn-primary btn-dense" onClick={() => publishNotice(n)}>
              {L('Publish', 'نشر')}
            </button>
          </>
        ) : null}
        {n.status === 'published' ? (
          <button className="btn btn-ghost btn-dense" onClick={() => withdrawNotice(n)}>
            {L('Withdraw', 'سحب')}
          </button>
        ) : null}
      </div>
    )),
    <Empty
      glyph="bell"
      title={L('No notices', 'لا إعلانات')}
      body={L('Draft one, then publish it to the people it is for.', 'اكتب مسودة ثم انشرها لمن تعنيهم.')}
    />
  );
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Communicate', 'التواصل') }, { label: L('Notices', 'الإعلانات') }]}
        title={L('Notices and the weekly bulletin', 'الإعلانات والنشرة الأسبوعية')}
        sub={L(
          'Enter Mass times, intentions, announcements and events once. ParishLife turns them into a printable bulletin and a phone-friendly version.',
          'أدخل مواعيد القداديس والنوايا والإعلانات والأحداث مرّة واحدة. يحوّلها «حياة الرعية» إلى نشرة للطباعة ونسخة للهاتف.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" id="bulletin">
              <Icon name="doc" size={17} />
              {L('Build bulletin', 'بناء النشرة')}
            </button>{' '}
            <button className="btn btn-primary" onClick={() => noticeForm()}>
              <Icon name="plus" size={17} />
              {L('New notice', 'إعلان جديد')}
            </button>
          </>
        }
      />{' '}
      <div className="splitview">
        <Panel title={L('Notices', 'الإعلانات')} tight={true}>
          {rows}
        </Panel>{' '}
        <div className="sidecol">
          <Panel title={L('Upcoming Masses', 'القداديس المقبلة')} tight={true}>
            {nodesOr(
              EVENTS.filter(m => m.kind === 'mass' && m.d >= new Date().toISOString().slice(0, 10))
                .slice(0, 8)
                .map((m, i) => (
                  <div key={i} className="listrow" style={{ paddingInline: 0 }}>
                    <span className="mono dim" style={{ width: '94px', flex: 'none' }}>
                      {m.d} · {m.t}
                    </span>{' '}
                    <span className="grow">
                      <b>{L(m.title, m.titleAr)}</b>
                      <small>{L(venue(m.venue)?.name || '', venue(m.venue)?.ar || '')}</small>
                    </span>
                  </div>
                )),
              <p className="help">{L('No upcoming Masses in the calendar.', 'لا قداديس مقبلة في الرزنامة.')}</p>
            )}
          </Panel>{' '}
          <Panel title={L('Public parish page', 'صفحة الرعية العامة')}>
            <p className="t-caption dim">
              {L(
                'Published parish content and public calendar events appear on this page.',
                'يظهر في هذه الصفحة محتوى الرعية المنشور وأحداث الرزنامة العامة.'
              )}
            </p>{' '}
            <a
              className="btn btn-secondary"
              style={{ marginTop: '12px' }}
              href={`public.html?parish=${encodeURIComponent(session.parishId || '')}`}
              target="_blank"
              rel="noopener"
            >
              <Icon name="link" size={17} />
              {L('Open public page', 'فتح الصفحة العامة')}
            </a>
          </Panel>
        </div>
      </div>
    </>
  );
}

notices.mount = host => {
  host.querySelector('#bulletin')?.addEventListener('click', () =>
    openDrawer({
      large: true,
      title: L('Weekly bulletin', 'النشرة الأسبوعية'),
      sub: L(
        'Type the welcome text and intentions to print; the Masses this week and the published notices are included automatically. What you type here is not saved.',
        'اكتب كلمة الترحيب والنوايا للطباعة؛ تُضاف قداديس هذا الأسبوع والإعلانات المنشورة تلقائياً. ما تكتبه هنا لا يُحفظ.'
      ),
      body: (
        <>
          <div className="formgrid">
            <div className="formrow">
              <label className="label" htmlFor="bulletin-en">
                {L('Introduction in English', 'المقدمة بالإنكليزية')}
              </label>
              <textarea className="input" id="bulletin-en" rows="3" />
            </div>{' '}
            <div className="formrow">
              <label className="label" htmlFor="bulletin-ar">
                {L('Introduction in Arabic', 'المقدمة بالعربية')}
              </label>
              <textarea className="input" id="bulletin-ar" rows="3" dir="rtl" />
            </div>
          </div>{' '}
          <div className="formgrid">
            <div className="formrow">
              <label className="label" htmlFor="intentions-en">
                {L('Mass intentions in English, one per line', 'نوايا القداديس بالإنكليزية، سطر لكل نيّة')}
              </label>
              <textarea className="input" id="intentions-en" rows="3" />
            </div>{' '}
            <div className="formrow">
              <label className="label" htmlFor="intentions-ar">
                {L('Mass intentions in Arabic, one per line', 'نوايا القداديس بالعربية، سطر لكل نيّة')}
              </label>
              <textarea className="input" id="intentions-ar" rows="3" dir="rtl" />
            </div>
          </div>{' '}
          <div className="a4bar">
            <C.BGroup items={[L('A4 preview', 'معاينة A4'), L('Phone preview', 'معاينة الهاتف')]} sel={0} />
          </div>
          <div
            className="a4"
            id="bulletin-preview"
            style={{
              maxWidth: 'none',
              aspectRatio: 'auto',
              padding: '32px',
              alignItems: 'stretch',
              textAlign: 'start'
            }}
          />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Close', 'إغلاق')}
          </button>
          <button className="btn btn-primary" id="bulletin-print" style={{ marginInlineStart: 'auto' }}>
            {L('Print', 'طباعة')}
          </button>
        </>
      ),
      onMount(el) {
        const page = el.querySelector('#bulletin-preview');
        const render = () => {
          const now = new Date(),
            end = new Date(now);
          end.setDate(now.getDate() + 6);
          const from = now.toISOString().slice(0, 10),
            through = end.toISOString().slice(0, 10);
          const langText = (en, ar) => (isAr() ? ar || en : en || ar);
          const intro = langText(el.querySelector('#bulletin-en').value, el.querySelector('#bulletin-ar').value);
          const intentions = langText(
            el.querySelector('#intentions-en').value,
            el.querySelector('#intentions-ar').value
          )
            .split('\n')
            .map(x => x.trim())
            .filter(Boolean);
          const masses = EVENTS.filter(e => e.kind === 'mass' && e.d >= from && e.d <= through).sort((a, b) =>
            (a.d + a.t).localeCompare(b.d + b.t)
          );
          const notices = NOTICES.filter(
            n => n.status === 'published' && n.visibility !== 'Ministry' && n.at >= from && n.at <= through
          );
          paint(
            page,
            <>
              <div style={{ textAlign: 'center' }}>
                <div className="ttl">{L(PARISH.name, PARISH.nameAr)}</div>
                <div className="ttl-ar">
                  {L('Weekly bulletin', 'النشرة الأسبوعية')} · {from} – {through}
                </div>
              </div>{' '}
              {intro ? <p style={{ marginTop: '18px', whiteSpace: 'pre-wrap' }}>{intro}</p> : ''}{' '}
              <h4>{L('Masses', 'القداديس')}</h4>
              {nodesOr(
                masses.map((m, i) => (
                  <div key={i} className="listrow">
                    <span className="mono">
                      {m.d} · {m.t}
                    </span>
                    <span>{L(m.title, m.titleAr)}</span>
                  </div>
                )),
                <p>{L('No Masses scheduled this week.', 'لا قداديس مجدولة هذا الأسبوع.')}</p>
              )}{' '}
              {intentions.length ? (
                <>
                  <h4>{L('Mass intentions', 'نوايا القداديس')}</h4>
                  {intentions.map((text, i) => (
                    <div key={i} className="listrow">
                      {text}
                    </div>
                  ))}
                </>
              ) : (
                ''
              )}{' '}
              <h4>{L('Parish notices', 'إعلانات الرعية')}</h4>
              {nodesOr(
                notices.map((n, i) => (
                  <div key={i} className="listrow">
                    {n.title}
                  </div>
                )),
                <p>{L('No parish notices this week.', 'لا إعلانات للرعية هذا الأسبوع.')}</p>
              )}
            </>
          );
        };
        el.querySelectorAll('#bulletin-en,#bulletin-ar,#intentions-en,#intentions-ar').forEach(input =>
          input.addEventListener('input', render)
        );
        render();
        el.querySelectorAll('.a4bar button').forEach((b, i) =>
          b.addEventListener('click', () => page.classList.toggle('phone', i === 1))
        );
        el.querySelector('#bulletin-print').addEventListener('click', () =>
          printSheet({ title: L('Weekly bulletin', 'النشرة الأسبوعية'), body: page.innerHTML, margin: '12mm' })
        );
      }
    })
  );
};
