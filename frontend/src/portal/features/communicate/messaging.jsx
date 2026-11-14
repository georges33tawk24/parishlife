/* The communication centre: broadcasts (drafted, approved, stored now or at a scheduled time), the parish's
   bounded broadcast automations (staff), group automations (leaders), ready-made designs and delivery rules.
   Main members: messaging (the page), AutomationsTab, BroadcastStatus. People are named through
   model/names.js; nothing here says that anything was sent outside the app. */
import { useEffect, useState } from 'react';
import { Select } from '../../ui/components.jsx';
import { t, num, fmtDate } from '../../../lib/i18n.js';
import { is, bus } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Panel,
  Pill,
  Table,
  Empty,
  openDrawer,
  openModal,
  closeOverlays,
  toast,
  TabBar,
  Paged
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { persist } from '../../model/persist.js';
import { session } from '../../model/api.js';
import { confirmAction } from '../../shared/dialogs.jsx';
import { ok } from '../../shared/dialog-helpers.jsx';
import {
  compose,
  broadcastForm,
  templateForm,
  designTemplate,
  reload,
  LANGUAGE_NAMES,
  scheduleForm,
  automationForm
} from './messaging-dialogs.jsx';
import { nameOf } from '../../model/names.js';
import { ReviewsTab } from './messaging-reviews.jsx';
import {
  can,
  audiencePreview,
  broadcastAction,
  templateAction,
  automations as loadAutomations,
  automationAction
} from '../../model/modules/communications.js';
import { MESSAGES, TEMPLATES, PARISH, GROUPS, groupInfo } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

/* The channels the API reports for a broadcast: only the app stores anything; the others have no provider. */
const CHANNEL = {
  InApp: ['In the app', 'داخل التطبيق'],
  Email: ['Email', 'بريد إلكتروني'],
  Sms: ['SMS', 'رسالة قصيرة'],
  Push: ['Push', 'إشعار']
};
const CHANNEL_STATE = {
  Stored: ['stored for recipients', 'محفوظة للمستلمين'],
  NotSent: ['not sent yet', 'لم تُرسل بعد'],
  NotConfigured: ['not set up', 'غير مفعّل']
};

const operator = () => session.accountUser?.role === 'super_admin';
const MTABS = () => [
  ['', 'Broadcasts', 'البثّ'],
  ...(can(currentParish(), 'communications.manage') ? [['automations', 'Automations', 'الأتمتة']] : []),
  ...(is('leader') && !can(currentParish(), 'communications.manage')
    ? [
        [
          'automations',
          'Automations',
          'الأتمتة',
          GROUPS.flatMap(g => groupInfo(g.id).automations).filter(a => a.active).length
        ]
      ]
    : []),
  ['templates', 'Templates', 'القوالب'],
  ...(operator() ? [['reviews', 'Message reviews', 'مراجعة الرسائل']] : []),
  ['preferences', 'Rules', 'القواعد']
];

const currentParish = () => session.parishes.find(p => p.id === session.parishId);

/* The parish's broadcast automations: each run saves one draft from an approved template; nothing is sent. */
function AutomationsTab() {
  const [rows, setRows] = useState(null),
    [error, setError] = useState('');
  const refresh = () =>
    loadAutomations(session.parishId).then(
      r => setRows(r),
      e => setError(e.message)
    );
  useEffect(() => {
    refresh();
  }, []);
  const act = async (r, action) => {
    try {
      await automationAction(session.parishId, r.value.id, r.version, action);
      await refresh();
    } catch (e) {
      toast(L('Not done', 'لم يتم'), e.message, 'danger');
    }
  };
  const STATUS = { Active: ['Active', 'مفعّلة'], Paused: ['Paused', 'متوقّفة'], Ended: ['Ended', 'منتهية'] };
  if (error) return <p className="help-error">{error}</p>;
  if (!rows) return <p className="help">{L('Loading…', 'جارٍ التحميل…')}</p>;
  return (
    <>
      <div className="toolbar ministry-section-heading">
        <h2>{L('Broadcast automations', 'أتمتة البثّ')}</h2>
        <button
          className="btn btn-primary btn-dense"
          data-automation-new=""
          onClick={() => automationForm(null, refresh)}
        >
          <Icon name="plus" size={15} />
          {L('New automation', 'أتمتة جديدة')}
        </button>
      </div>
      <Table
        cols={[
          { label: L('Automation', 'الأتمتة') },
          { label: L('Next run', 'التشغيل التالي'), cls: 'hide-sm' },
          { label: L('Runs', 'المرات'), cls: 'num' },
          { label: L('Status', 'الحالة'), cls: 'shrink' },
          { label: '', cls: 'shrink' }
        ]}
        rows={rows.map(r => {
          const a = r.value;
          return {
            key: a.id,
            cells: [
              <span>
                <b>{L(a.name, a.nameAr || a.name)}</b>
                <small style={{ display: 'block' }} className="dim">
                  {(TEMPLATES.find(x => x.id === a.templateId)?.name || L('A template', 'قالب')) +
                    ' · ' +
                    (a.recurrence === 'Monthly' ? L('every month', 'كل شهر') : L('every week', 'كل أسبوع'))}
                  {a.lastOutcome === 'Skipped'
                    ? L(
                        ' · last run skipped: the previous draft was still waiting',
                        ' · تخطّي آخر تشغيل: المسودة السابقة ما زالت تنتظر'
                      )
                    : ''}
                </small>
                {a.statusReason ? <small style={{ display: 'block' }}>{a.statusReason}</small> : null}
              </span>,
              <span className="dim mono" dir="ltr">
                {a.status === 'Active' ? new Date(a.nextRunAt).toLocaleString() : '—'}
              </span>,
              <span className="num">{a.runCount + ' / ' + a.maxRuns}</span>,
              <Pill
                label={L(...(STATUS[a.status] || [a.status, a.status]))}
                tone={a.status === 'Active' ? 'success' : 'warning'}
              />,
              <span className="row" style={{ gap: '6px' }}>
                {a.status !== 'Ended' ? (
                  <button
                    className="btn btn-secondary btn-dense"
                    onClick={() => automationForm({ ...a, version: r.version }, refresh)}
                  >
                    {L('Edit', 'تعديل')}
                  </button>
                ) : null}
                {a.status === 'Active' ? (
                  <button className="btn btn-ghost btn-dense" onClick={() => act(r, 'pause')}>
                    {L('Pause', 'إيقاف مؤقت')}
                  </button>
                ) : null}
                {a.status === 'Paused' ? (
                  <button className="btn btn-ghost btn-dense" onClick={() => act(r, 'resume')}>
                    {L('Resume', 'استئناف')}
                  </button>
                ) : null}
                {a.status !== 'Ended' ? (
                  <button className="btn btn-ghost btn-dense" onClick={() => act(r, 'end')}>
                    {L('End', 'إنهاء')}
                  </button>
                ) : null}
              </span>
            ]
          };
        })}
        empty={
          <Empty
            glyph="msg"
            title={L('No automations', 'لا أتمتة')}
            body={L(
              'An automation saves one draft from an approved template each week or month, a set number of times.',
              'تحفظ الأتمتة مسودة واحدة من قالب معتمد كل أسبوع أو شهر، لعدد محدّد من المرات.'
            )}
          />
        }
      />
      <p className="help">
        {L(
          'Automations never approve or send. A different staff member approves each draft, then someone stores or schedules it. Missed runs are not made up.',
          'لا تعتمد الأتمتة ولا ترسل. يعتمد موظف آخر كل مسودة، ثم يحفظها أحدهم أو يجدولها. لا تُعوَّض المرات الفائتة.'
        )}
      </p>
    </>
  );
}

export function messaging(tab = '') {
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Communicate', 'التواصل') }, { label: L('Messaging', 'المراسلة') }]}
        title={L('Communication centre', 'مركز التواصل')}
        sub={L(
          'Publish updates and send messages inside ParishLife. External email, WhatsApp and SMS delivery are not connected.',
          'انشر المستجدات وأرسل الرسائل داخل ParishLife. إرسال البريد وواتساب والرسائل القصيرة غير موصول.'
        )}
        actions={
          <>
            {tab === 'templates' ? (
              ''
            ) : (
              <button className="btn btn-secondary" data-go="messaging/templates">
                <Icon name="doc" size={17} />
                {L('Ready-made designs', 'تصاميم جاهزة')}
              </button>
            )}{' '}
            {<C.SplitBtn label={L('New message', 'رسالة جديدة')} id="newmsg" />}
          </>
        }
      />
      <TabBar base="messaging" items={MTABS()} active={tab} />
    </>
  );
  if (tab === 'automations' && can(currentParish(), 'communications.manage'))
    return (
      <>
        {head}
        <div className="tabbody">
          <AutomationsTab />
        </div>
      </>
    );
  if (is('leader') && (tab === 'automations' || tab === 'preferences')) {
    const automation = tab === 'automations',
      key = automation ? 'automations' : 'messagingRules';
    const rows = GROUPS.flatMap(g => groupInfo(g.id)[key].map((item, index) => ({ g, item, index })));
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="toolbar ministry-section-heading">
            <h2>
              {automation
                ? L('Group automations', 'أتمتة المجموعة')
                : L('Group messaging rules', 'قواعد مراسلة المجموعة')}
            </h2>
            <button className="btn btn-primary btn-dense" data-message-config-new={key}>
              <Icon name="plus" size={15} />
              {L('Add', 'إضافة')}
            </button>
          </div>{' '}
          <Table
            cols={[
              { label: L('Group', 'المجموعة') },
              { label: automation ? L('Automation', 'الأتمتة') : L('Rule', 'القاعدة') },
              { label: automation ? L('Trigger', 'المحفّز') : L('Condition / action', 'الشرط / الإجراء') },
              { label: L('Status', 'الحالة') },
              { label: '', cls: 'shrink' }
            ]}
            rows={rows.map(({ g, item, index }) => ({
              cells: [
                L(g.name, g.ar),
                <b>{L(item.name, item.nameAr || item.name)}</b>,
                <span>
                  {L(item.trigger, item.triggerAr || item.trigger)}
                  {!automation && item.action ? (
                    <small style={{ display: 'block' }}>{L(item.action, item.actionAr || item.action)}</small>
                  ) : (
                    ''
                  )}
                </span>,
                item.active ? (
                  <Pill label={L('Active', 'مفعّلة')} tone="success" />
                ) : (
                  <Pill label={L('Paused', 'متوقّفة')} tone="warning" />
                ),
                <div className="row">
                  <button className="btn btn-secondary btn-dense" data-message-config-edit={`${key}|${g.id}|${index}`}>
                    {L('Edit', 'تعديل')}
                  </button>
                  <button
                    className="btn-icon"
                    data-message-config-delete={`${key}|${g.id}|${index}`}
                    aria-label={L('Delete', 'حذف')}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ]
            }))}
          />{' '}
          <p className="help">
            {L(
              'These settings are saved for your ministry. External message delivery and timed execution require a connected service.',
              'تُحفظ هذه الإعدادات لخدمتك. يتطلب إرسال الرسائل وتنفيذها المجدول خدمة موصولة.'
            )}
          </p>
        </div>
      </>
    );
  }
  if (tab === 'reviews' && operator())
    return (
      <>
        {head}
        <div className="tabbody">
          <ReviewsTab parishId={session.parishId} />
        </div>
      </>
    );
  if (tab === 'templates')
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="toolbar ministry-section-heading">
            <h2>{L('Broadcast templates', 'قوالب البثّ')}</h2>
            <button className="btn btn-primary btn-dense" onClick={() => templateForm()}>
              <Icon name="plus" size={15} />
              {L('New template', 'قالب جديد')}
            </button>
          </div>
          {TEMPLATES.length ? (
            <Paged className="gridcards">
              {TEMPLATES.map((tp, ti) => (
                <div key={tp.id} className="panel" style={{ border: '1px solid var(--border)' }}>
                  <div
                    style={{
                      height: '110px',
                      background: 'var(--ink)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--on-dark)',
                      font: '600 14px/1 var(--sans)',
                      textAlign: 'center',
                      padding: '10px'
                    }}
                  >
                    <span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          opacity: '.7',
                          letterSpacing: '.1em',
                          textTransform: 'uppercase'
                        }}
                      >
                        {L(PARISH.name, PARISH.nameAr)}
                      </span>{' '}
                      {tp.title}
                    </span>
                  </div>{' '}
                  <div className="panel-b" style={{ padding: '12px' }}>
                    <b style={{ font: '500 13px/18px var(--sans)' }}>{tp.name}</b>{' '}
                    <small className="t-caption dim" style={{ display: 'block', margin: '2px 0 8px' }}>
                      {L(...LANGUAGE_NAMES[tp.language])} ·{' '}
                      {tp.status === 'approved'
                        ? L('Approved', 'معتمد')
                        : tp.status === 'retired'
                          ? L('Retired', 'متوقف')
                          : L('Draft', 'مسودة')}
                    </small>
                    <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                      {tp.status === 'draft' ? (
                        <>
                          <button className="btn btn-secondary btn-dense" onClick={() => templateForm(tp)}>
                            {L('Edit', 'تعديل')}
                          </button>
                          <button className="btn btn-primary btn-dense" onClick={() => templateStep(tp, 'approve')}>
                            {L('Approve', 'اعتماد')}
                          </button>
                        </>
                      ) : null}
                      {tp.status === 'approved' ? (
                        <button
                          className="btn btn-primary btn-dense"
                          onClick={() => compose('all', { template: tp.id })}
                        >
                          {L('Use in a broadcast', 'استخدام في بثّ')}
                        </button>
                      ) : null}
                      {tp.status !== 'retired' ? (
                        <button className="btn btn-ghost btn-dense" onClick={() => templateStep(tp, 'retire')}>
                          {L('Retire', 'إيقاف')}
                        </button>
                      ) : null}
                      <button className="btn btn-ghost btn-dense" onClick={() => designTemplate(ti)}>
                        {L('Poster', 'ملصق')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </Paged>
          ) : (
            <Empty
              glyph="doc"
              title={L('No templates', 'لا قوالب')}
              body={L(
                'Save wording you reuse. A different staff member approves it before a broadcast can use it.',
                'احفظ نصاً تعيد استخدامه. يعتمده موظف آخر قبل أن يستخدمه بثّ.'
              )}
            />
          )}
          <p className="t-caption dim" style={{ marginTop: '16px' }}>
            {L(
              'A poster is made from a template’s subject: fill in the date and place, then download it. The file is not sent anywhere.',
              'يُصنع الملصق من موضوع القالب: املأ التاريخ والمكان ثم نزّله. لا يُرسل الملف إلى أي جهة.'
            )}
          </p>
        </div>
      </>
    );
  if (tab === 'preferences')
    return (
      <>
        {head}
        <div style={{ marginTop: '20px' }} className="grid g2">
          <Panel title={L('Available now', 'المتاح الآن')}>
            <p>
              {L(
                'ParishLife delivers in-app messages to named account holders and publishes group or parish updates to authorized member feeds.',
                'يرسل ParishLife رسائل داخل التطبيق إلى حسابات محدّدة وينشر مستجدات المجموعات والرعية للأعضاء المخوّلين.'
              )}
            </p>{' '}
            <a className="btn btn-secondary btn-dense" style={{ marginTop: '12px' }} href="#/memberhub">
              {L('Review in-app communication', 'مراجعة التواصل داخل التطبيق')}
            </a>
          </Panel>{' '}
          <Panel title={L('External delivery', 'الإرسال الخارجي')}>
            <p>
              {L(
                'Email, WhatsApp, SMS, timed automations, delivery retries, and emergency broadcasts require a connected service. This installation does not send them.',
                'يتطلب البريد وواتساب والرسائل القصيرة والأتمتة المجدولة وإعادة المحاولة والبثّ الطارئ خدمة موصولة. لا يرسلها هذا التثبيت.'
              )}
            </p>
          </Panel>
        </div>
      </>
    );
  const parish = currentParish(),
    staff = can(parish, 'communications.manage');
  const rows = MESSAGES.map(m => ({
    key: m.id,
    cells: [
      <b style={{ font: '500 14px/20px var(--sans)' }}>{m.subject}</b>,
      <span className="dim">
        {m.audience === 'Ministry'
          ? L('A ministry', 'خدمة') +
            (GROUPS.find(g => g.id === m.ministryId) ? ` · ${GROUPS.find(g => g.id === m.ministryId).name}` : '')
          : L('All members', 'كل الأعضاء')}
      </span>,
      <span className="chip">{L('In the app', 'داخل التطبيق')}</span>,
      <span className="num dim">{m.status === 'sent' ? num(m.reach) : '—'}</span>,
      <span className="dim mono" dir="ltr">
        {m.when ? fmtDate(m.when.slice(0, 10)) : '—'}
      </span>,
      <BroadcastStatus m={m} />,
      <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
        {m.status === 'draft' ? (
          <button className="btn btn-secondary btn-dense" onClick={() => broadcastForm(m)}>
            {L('Edit', 'تعديل')}
          </button>
        ) : null}
        {m.status === 'draft' || m.status === 'approved' ? (
          <button className="btn btn-ghost btn-dense" onClick={() => preview(m)}>
            {L('Who would get it', 'من سيصله')}
          </button>
        ) : null}
        {m.status === 'draft' ? (
          <button className="btn btn-primary btn-dense" onClick={() => step(m, 'approve')}>
            {L('Approve', 'اعتماد')}
          </button>
        ) : null}
        {m.status === 'approved' || m.status === 'scheduled' ? (
          <button className="btn btn-primary btn-dense" onClick={() => step(m, 'send')}>
            {L('Store in the app now', 'حفظ داخل التطبيق الآن')}
          </button>
        ) : null}
        {m.status === 'approved' ? (
          <button className="btn btn-secondary btn-dense" onClick={() => scheduleForm(m)}>
            {L('Schedule', 'جدولة')}
          </button>
        ) : null}
        {m.status === 'scheduled' ? (
          <button className="btn btn-ghost btn-dense" onClick={() => unschedule(m)}>
            {L('Unschedule', 'إلغاء الجدولة')}
          </button>
        ) : null}
        {m.status === 'draft' || m.status === 'approved' || m.status === 'scheduled' ? (
          <button className="btn btn-ghost btn-dense" onClick={() => cancelBroadcast(m)}>
            {L('Cancel', 'إلغاء')}
          </button>
        ) : null}
      </span>
    ],
    detail: (
      <div className="stack" style={{ padding: '4px 0' }}>
        <div style={{ whiteSpace: 'pre-wrap' }} dir="auto">
          {m.body}
        </div>
        {m.titleAr ? (
          <div style={{ whiteSpace: 'pre-wrap' }} dir="rtl">
            <b>{m.titleAr}</b>
            {'\n'}
            {m.arabicBody}
          </div>
        ) : null}
        <small className="dim">
          {[
            [L('Written by', 'كتبه'), m.updatedBy],
            [L('Approved by', 'اعتمده'), m.approvedBy],
            [L('Scheduled by', 'جدوله'), m.scheduledBy],
            [L('Stored by', 'حفظه'), m.sentBy]
          ]
            .filter(([, id]) => id)
            .map(([label, id]) => `${label}: ${nameOf(session.parishId, id) || '—'}`)
            .join(' · ')}
          {m.automationId ? L(' · drafted by an automation', ' · مسودة من أتمتة') : ''}
        </small>
        {m.status === 'scheduled' && m.scheduledFor ? (
          <small className="dim">
            {L('To be stored in the app at ', 'يُحفظ داخل التطبيق في ')}
            {new Date(m.scheduledFor).toLocaleString()}
          </small>
        ) : null}
        {m.scheduleNote ? <small>{m.scheduleNote}</small> : null}
        <small className="dim">
          {(m.channels || [])
            .map(
              c =>
                `${L(...(CHANNEL[c.channel] || [c.channel, c.channel]))}: ${L(...(CHANNEL_STATE[c.status] || [c.status, c.status]))}`
            )
            .join(' · ')}
        </small>
        {m.status === 'sent' && m.skipped ? (
          <small className="dim">
            {L(`${m.skipped} left out because they muted this topic.`, `${m.skipped} مستثنى لأنهم كتموا هذا الموضوع.`)}
          </small>
        ) : null}
        {m.cancelReason ? (
          <small className="dim">
            {L('Cancelled: ', 'أُلغي: ')}
            {m.cancelReason}
          </small>
        ) : null}
      </div>
    )
  }));
  return (
    <>
      {head}
      <div style={{ margin: '20px 0' }}>
        <C.InlineAlert
          tone="info"
          title={L('Broadcasts stay inside ParishLife', 'البثّ يبقى داخل ParishLife')}
          body={L(
            'A broadcast is drafted, approved by a different staff member, then stored in the app for each member in its audience. Email, SMS and push are not set up, so nothing is delivered outside the app.',
            'يُكتب البثّ ثم يعتمده موظف آخر، ثم يُحفظ داخل التطبيق لكل عضو في جمهوره. البريد والرسائل القصيرة والإشعارات غير مفعّلة، فلا يصل شيء خارج التطبيق.'
          )}
        />
      </div>
      {staff ? (
        <Table
          cols={[
            { label: L('Subject', 'الموضوع'), sort: true },
            { label: L('Audience', 'الجمهور'), cls: 'hide-sm' },
            { label: L('Channel', 'القناة'), cls: 'shrink hide-sm' },
            { label: L('Stored for', 'محفوظ لـ'), cls: 'num hide-md' },
            { label: L('When', 'الموعد'), cls: 'hide-md' },
            { label: L('Status', 'الحالة'), cls: 'shrink' },
            { label: '', cls: 'shrink' }
          ]}
          rows={rows}
          empty={
            <Empty
              glyph="msg"
              title={L('No broadcasts', 'لا بثّ')}
              body={L('Draft one with New message.', 'اكتب مسودة من «رسالة جديدة».')}
            />
          }
        />
      ) : (
        <Empty
          glyph="msg"
          title={L('Broadcasts are managed by parish communications staff', 'يدير البثّ موظفو التواصل في الرعية')}
          body={L(
            'This account is not allowed to draft or approve them.',
            'هذا الحساب غير مخوّل بكتابتها أو اعتمادها.'
          )}
        />
      )}
    </>
  );
}

/* The status of a broadcast, in words that say where it is stored. */
function BroadcastStatus({ m }) {
  return m.status === 'sent' ? (
    <Pill label={L('Stored in the app', 'محفوظ داخل التطبيق')} tone="success" mark="st-sent" />
  ) : m.status === 'scheduled' ? (
    <Pill label={L('Scheduled', 'مجدول')} tone="info" mark="st-open" />
  ) : m.status === 'approved' ? (
    <Pill label={L('Approved', 'معتمد')} tone="success" mark="st-ok" />
  ) : m.status === 'cancelled' ? (
    <Pill label={L('Cancelled', 'ملغى')} tone="danger" mark="st-no" />
  ) : (
    <Pill label={L('Draft', 'مسودة')} tone="info" mark="st-open" />
  );
}

const explain = (m, action) =>
  action === 'approve'
    ? L(
        'This approves the exact wording saved now. A different staff member than the author must do it.',
        'يعتمد هذا النص المحفوظ الآن بالتحديد. يجب أن يقوم به موظف غير كاتبه.'
      )
    : L(
        'This stores one copy in the app for every member of the audience as it is right now. It does not send email, SMS or push.',
        'يحفظ هذا نسخة داخل التطبيق لكل عضو في الجمهور كما هو الآن. لا يرسل بريداً ولا رسائل قصيرة ولا إشعارات.'
      );

function step(m, action) {
  confirmAction({
    title:
      action === 'approve'
        ? L('Approve this broadcast?', 'اعتماد هذا البثّ؟')
        : L('Store it in the app?', 'حفظه داخل التطبيق؟'),
    body: explain(m, action),
    cta: action === 'approve' ? L('Approve', 'اعتماد') : L('Store in the app', 'حفظ داخل التطبيق'),
    then: async () => {
      try {
        const sent = await broadcastAction(session.parishId, m.id, m.version, action);
        await reload();
        ok(
          action === 'approve' ? L('Approved', 'اعتُمد') : L('Stored in the app', 'حُفظ داخل التطبيق'),
          action === 'approve'
            ? ''
            : L(
                `${sent.recipientCount} members will see it in the app. Nothing was sent by email, SMS or push.`,
                `${sent.recipientCount} عضواً سيرونه داخل التطبيق. لم يُرسل شيء بالبريد أو الرسائل القصيرة أو الإشعارات.`
              )
        );
      } catch (error) {
        toast(L('Not done', 'لم يتم'), error.message, 'danger');
      }
    }
  });
}

async function unschedule(m) {
  try {
    await broadcastAction(session.parishId, m.id, m.version, 'unschedule');
    await reload();
    ok(
      L('No longer scheduled', 'أُلغيت الجدولة'),
      L('It is approved and can be stored or scheduled again.', 'هو معتمد ويمكن حفظه أو جدولته من جديد.')
    );
  } catch (error) {
    toast(L('Not done', 'لم يتم'), error.message, 'danger');
  }
}

function cancelBroadcast(m) {
  openModal({
    title: L('Cancel this broadcast?', 'إلغاء هذا البثّ؟'),
    body: <CancelReason onDone={reason => run(m, reason)} />
  });
}
async function run(m, reason) {
  await broadcastAction(session.parishId, m.id, m.version, 'cancel', reason);
  closeOverlays();
  await reload();
  ok(L('Cancelled', 'أُلغي'));
}
function CancelReason({ onDone }) {
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        try {
          await onDone(new FormData(e.currentTarget).get('reason'));
        } catch (err) {
          setError(err.message);
        }
      }}
    >
      <label className="formrow">
        <span className="label">{L('Reason', 'السبب')}</span>
        <textarea className="textarea" name="reason" required maxLength="2000" rows="3" />
      </label>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-danger">{L('Cancel the broadcast', 'إلغاء البثّ')}</button>
    </form>
  );
}

async function preview(m) {
  try {
    const r = await audiencePreview(session.parishId, m.id);
    toast(
      L(`${r.eligibleCount} would receive it`, `${r.eligibleCount} سيصلهم`),
      L(
        `${r.skippedByPreferenceCount} skipped because they muted this topic. The audience is worked out again when it is stored.`,
        `${r.skippedByPreferenceCount} مستثنى لأنهم كتموا هذا الموضوع. يُحتسب الجمهور من جديد عند الحفظ.`
      ),
      'info'
    );
  } catch (error) {
    toast(L('Not available', 'غير متاح'), error.message, 'danger');
  }
}

function templateStep(tp, action) {
  confirmAction({
    title:
      action === 'approve'
        ? L('Approve this template?', 'اعتماد هذا القالب؟')
        : L('Retire this template?', 'إيقاف هذا القالب؟'),
    body:
      action === 'approve'
        ? L('A different staff member than the author must approve it.', 'يجب أن يعتمده موظف غير كاتبه.')
        : L(
            'A retired template can no longer be used for new broadcasts.',
            'لا يمكن استخدام القالب الموقوف في بثّ جديد.'
          ),
    cta: action === 'approve' ? L('Approve', 'اعتماد') : L('Retire', 'إيقاف'),
    danger: action === 'retire',
    then: async () => {
      try {
        await templateAction(session.parishId, tp.id, tp.version, action);
        await reload();
        ok(action === 'approve' ? L('Template approved', 'اعتُمد القالب') : L('Template retired', 'أُوقف القالب'));
      } catch (error) {
        toast(L('Not done', 'لم يتم'), error.message, 'danger');
      }
    }
  });
}

messaging.mount = host => {
  host
    .querySelector('[data-message-config-new]')
    ?.addEventListener('click', b => messageConfigForm(b.currentTarget.dataset.messageConfigNew));
  host.querySelectorAll('[data-message-config-edit]').forEach(b =>
    b.addEventListener('click', () => {
      const [key, gid, index] = b.dataset.messageConfigEdit.split('|');
      messageConfigForm(key, gid, Number(index));
    })
  );
  host.querySelectorAll('[data-message-config-delete]').forEach(b =>
    b.addEventListener('click', () => {
      const [key, gid, index] = b.dataset.messageConfigDelete.split('|'),
        items = groupInfo(gid)[key],
        item = items[Number(index)];
      if (!item) return;
      openModal({
        title: L('Delete item?', 'حذف العنصر؟'),
        body: <p>{item.name}</p>,
        foot: (
          <>
            <button className="btn btn-secondary" data-close="">
              {L('Cancel', 'إلغاء')}
            </button>
            <button className="btn btn-danger" id="mc_delete">
              {L('Delete', 'حذف')}
            </button>
          </>
        ),
        onMount(el) {
          el.querySelector('#mc_delete').addEventListener('click', async () => {
            items.splice(Number(index), 1);
            if (!(await persist())) return;
            closeOverlays();
            bus.refresh();
          });
        }
      });
    })
  );
  host.querySelector('[data-split="newmsg"]')?.addEventListener('click', () => compose('all'));
  host.querySelector('[data-splitmenu="newmsg"]')?.addEventListener('click', () =>
    openModal({
      title: L('Send', 'إرسال'),
      body: (
        <div className="menu" style={{ position: 'static', boxShadow: 'none', border: 0, padding: 0 }}>
          <button data-act="compose:group">
            <Icon name="groups" size={16} />
            {L('Broadcast to a ministry', 'بثّ إلى خدمة')}
          </button>{' '}
          <button data-act="broadcast">
            <Icon name="bell" size={16} />
            {L('Emergency broadcast', 'بثّ طارئ')}
          </button>
        </div>
      )
    })
  );
};

function messageConfigForm(key, gid = '', index = -1) {
  const automation = key === 'automations',
    item = gid ? groupInfo(gid)[key]?.[index] : null;
  openDrawer({
    title: item
      ? L('Edit item', 'تعديل العنصر')
      : automation
        ? L('Add automation', 'إضافة أتمتة')
        : L('Add messaging rule', 'إضافة قاعدة مراسلة'),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="mc_group">
            {L('Group', 'المجموعة')}
          </label>
          <Select defaultValue={gid} id="mc_group" disabled={!!item}>
            {GROUPS.map((g, i) => (
              <option key={i} value={g.id}>
                {L(g.name, g.ar)}
              </option>
            ))}
          </Select>
        </div>
        <C.Field label={L('Name', 'الاسم')} id="mc_name" value={item?.name || ''} req={true} />
        <C.Field label={L('Arabic name', 'الاسم العربي')} id="mc_name_ar" value={item?.nameAr || ''} />
        <C.Field
          label={automation ? L('Trigger', 'المحفّز') : L('Condition', 'الشرط')}
          id="mc_trigger"
          value={item?.trigger || ''}
          req={true}
        />
        <C.Field label={L('Arabic description', 'الوصف العربي')} id="mc_trigger_ar" value={item?.triggerAr || ''} />
        {automation ? (
          ''
        ) : (
          <C.Field label={L('Action', 'الإجراء')} id="mc_action" value={item?.action || ''} req={true} />
        )}
        {automation ? (
          ''
        ) : (
          <C.Field label={L('Arabic action', 'الإجراء بالعربية')} id="mc_action_ar" value={item?.actionAr || ''} />
        )}
        <label className="check">
          <input type="checkbox" id="mc_active" defaultChecked={!!(item?.active !== false)} />
          <span>{L('Active', 'مفعّل')}</span>
        </label>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="mc_save">
          {L('Save', 'حفظ')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#mc_save').addEventListener('click', async () => {
        const name = el.querySelector('#mc_name').value.trim(),
          trigger = el.querySelector('#mc_trigger').value.trim(),
          action = el.querySelector('#mc_action')?.value.trim() || '';
        if (!name || !trigger || (!automation && !action))
          return toast(L('Complete the name, condition and action', 'أكمل الاسم والشرط والإجراء'), '', 'warning');
        const target = item || { id: `mc-${Date.now().toString(36)}`, sent: 0 };
        Object.assign(target, {
          name,
          nameAr: el.querySelector('#mc_name_ar').value.trim() || name,
          trigger,
          triggerAr: el.querySelector('#mc_trigger_ar').value.trim() || trigger,
          active: el.querySelector('#mc_active').checked
        });
        if (!automation)
          Object.assign(target, { action, actionAr: el.querySelector('#mc_action_ar').value.trim() || action });
        if (!item) groupInfo(el.querySelector('#mc_group').value)[key].push(target);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
      });
    }
  });
}
