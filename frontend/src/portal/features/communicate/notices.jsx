/* Notices and the weekly bulletin: published notices, upcoming Masses and the bulletin built from
   them. */
import { nodesOr, paint } from '../../ui/html.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { Icon, PageHead, Panel, Pill, Empty, openDrawer, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { persist } from '../../model/persist.js';
import { printSheet } from '../../shared/print.js';
import { NOTICES, PARISH, EVENTS, CONTENT, person, venue } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

export function notices() {
  const rows = nodesOr(
    NOTICES.map((n, i) => (
      <div key={i} className="listrow" style={{ alignItems: 'flex-start' }}>
        <span className="grow">
          <b>{L(n.title, n.ar)}</b>{' '}
          <small>
            {fmtDate(n.at)} · {person(n.by) ? (isAr() ? person(n.by).ar : person(n.by).lat) : '—'} ·{' '}
            {L(n.audience, n.audienceAr)}
          </small>
        </span>{' '}
        {n.pri === 'urgent' ? (
          <Pill label={L('Urgent', 'عاجل')} tone="danger" mark="st-alert" />
        ) : (
          <Pill label={L('Normal', 'عادي')} />
        )}{' '}
        {CR.recBtn('notice', n.id)}
      </div>
    )),
    <Empty
      glyph="bell"
      title={L('No notices', 'لا إعلانات')}
      body={L(
        'Publish one and it appears on the board and in the bulletin.',
        'انشر واحداً فيظهر على اللوحة وفي النشرة.'
      )}
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
            <button className="btn btn-primary" data-act="notice-add">
              <Icon name="plus" size={17} />
              {L('New notice', 'إعلان جديد')}
            </button>
          </>
        }
      />{' '}
      <div className="splitview">
        <Panel title={L('Published notices', 'الإعلانات المنشورة')} tight={true}>
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
              href={`public.html?parish=${encodeURIComponent(PARISH.id || '')}`}
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
        'Edit the welcome text and intentions; the current public Masses and parish notices are included automatically.',
        'حرّر كلمة الترحيب والنوايا؛ تُضاف القداديس العامة وإعلانات الرعية الحالية تلقائياً.'
      ),
      body: (
        <>
          <div className="formgrid">
            <div className="formrow">
              <label className="label" htmlFor="bulletin-en">
                {L('Introduction in English', 'المقدمة بالإنكليزية')}
              </label>
              <textarea className="input" id="bulletin-en" rows="3" defaultValue={CONTENT.bulletin?.en || ''} />
            </div>{' '}
            <div className="formrow">
              <label className="label" htmlFor="bulletin-ar">
                {L('Introduction in Arabic', 'المقدمة بالعربية')}
              </label>
              <textarea
                className="input"
                id="bulletin-ar"
                rows="3"
                dir="rtl"
                defaultValue={CONTENT.bulletin?.ar || ''}
              />
            </div>
          </div>{' '}
          <div className="formgrid">
            <div className="formrow">
              <label className="label" htmlFor="intentions-en">
                {L('Mass intentions in English, one per line', 'نوايا القداديس بالإنكليزية، سطر لكل نيّة')}
              </label>
              <textarea className="input" id="intentions-en" rows="3" defaultValue={CONTENT.intentions?.en || ''} />
            </div>{' '}
            <div className="formrow">
              <label className="label" htmlFor="intentions-ar">
                {L('Mass intentions in Arabic, one per line', 'نوايا القداديس بالعربية، سطر لكل نيّة')}
              </label>
              <textarea
                className="input"
                id="intentions-ar"
                rows="3"
                dir="rtl"
                defaultValue={CONTENT.intentions?.ar || ''}
              />
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
          <button className="btn btn-secondary" id="bulletin-save">
            {L('Save content', 'حفظ المحتوى')}
          </button>{' '}
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
          const notices = NOTICES.filter(n => n.audience === 'Parish' && !n.groupId && n.at >= from && n.at <= through);
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
                    {L(n.title, n.ar)}
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
        el.querySelector('#bulletin-save').addEventListener('click', async () => {
          CONTENT.bulletin = {
            en: el.querySelector('#bulletin-en').value.trim(),
            ar: el.querySelector('#bulletin-ar').value.trim(),
            published: false
          };
          CONTENT.intentions = {
            en: el.querySelector('#intentions-en').value.trim(),
            ar: el.querySelector('#intentions-ar').value.trim(),
            published: false
          };
          if (!(await persist())) return;
          toast(L('Bulletin content saved', 'حُفظ محتوى النشرة'), '', 'success');
        });
        el.querySelector('#bulletin-print').addEventListener('click', () =>
          printSheet({ title: L('Weekly bulletin', 'النشرة الأسبوعية'), body: page.innerHTML, margin: '12mm' })
        );
      }
    })
  );
};
