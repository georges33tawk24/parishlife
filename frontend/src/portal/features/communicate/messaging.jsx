/* The communication centre: messages, automations, ready-made designs and delivery rules. */
import { Select } from '../../ui/components.jsx';
import { t, num } from '../../../lib/i18n.js';
import { is, bus } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Panel,
  Status,
  Pill,
  Table,
  openDrawer,
  openModal,
  closeOverlays,
  toast,
  TabBar,
  Paged
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { persist } from '../../model/persist.js';
import { compose } from './messaging-dialogs.jsx';
import { MESSAGES, TEMPLATES, AUTOMATIONS, PARISH, GROUPS, groupInfo } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

const CHANNEL = { whatsapp: ['WhatsApp', 'واتساب'], sms: ['SMS', 'رسالة قصيرة'], email: ['Email', 'بريد إلكتروني'] };

const MTABS = () => [
  ['', 'Messages', 'الرسائل'],
  [
    'automations',
    'Automations',
    'الأتمتة',
    is('leader')
      ? GROUPS.flatMap(g => groupInfo(g.id).automations).filter(a => a.active).length
      : AUTOMATIONS.filter(a => a.active).length
  ],
  ['templates', 'Designs', 'التصاميم'],
  ['preferences', 'Rules', 'القواعد']
];

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
  if (tab === 'automations')
    return (
      <>
        {head}
        <div className="tabbody">
          <Table
            cols={[
              { label: L('Automation plan', 'خطة الأتمتة') },
              { label: L('Trigger', 'المحفّز'), cls: 'hide-sm' },
              { label: L('Saved state', 'الحالة المحفوظة'), cls: 'shrink' }
            ]}
            rows={AUTOMATIONS.map((a, ai) => ({
              cells: [
                <b>{L(a.what, a.whatAr)}</b>,
                <span className="dim">{L(a.on, a.onAr)}</span>,
                <label className="switch">
                  <input type="checkbox" defaultChecked={!!a.active} data-act={`auto-toggle:${ai}`} />
                  <span className="sr">{L('Active', 'مفعّل')}</span>
                </label>
              ]
            }))}
          />{' '}
          <C.InlineAlert
            tone="info"
            title={L('Plans only', 'خطط فقط')}
            body={L(
              'No scheduled runner or external delivery service is connected. These switches save a plan; they do not send messages.',
              'لا يوجد مشغّل مجدول أو خدمة إرسال خارجية موصولة. تحفظ المفاتيح الخطة ولا ترسل رسائل.'
            )}
          />{' '}
          <p className="t-caption dim" style={{ marginTop: '14px' }}>
            {L(
              'These are stored automation plans. No scheduled runner or external delivery service is connected.',
              'هذه خطط أتمتة محفوظة. لا يوجد مشغّل مجدول أو خدمة إرسال خارجية موصولة.'
            )}
          </p>
        </div>
      </>
    );
  if (tab === 'templates')
    return (
      <>
        {head}
        <div className="tabbody">
          <Paged className="gridcards">
            {TEMPLATES.map((tp, ti) => (
              <button
                key={ti}
                className="panel"
                style={{ cursor: 'pointer', textAlign: 'start', border: '1px solid var(--border)' }}
                data-act={`design:${ti}`}
              >
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
                    {L(tp.name, tp.ar)}
                  </span>
                </div>{' '}
                <div className="panel-b" style={{ padding: '12px' }}>
                  <b style={{ font: '500 13px/18px var(--sans)' }}>{L(tp.name, tp.ar)}</b>{' '}
                  <small className="t-caption dim" style={{ display: 'block', marginTop: '2px' }}>
                    {L('Fill the date and location', 'املأ التاريخ والمكان')}
                  </small>
                </div>
              </button>
            ))}
          </Paged>{' '}
          <p className="t-caption dim" style={{ marginTop: '16px' }}>
            {L(
              'Each design carries the parish name. Fill in the date and location, then download an SVG, PNG, or JPEG announcement.',
              'يحمل كل تصميم اسم الرعية. املأ التاريخ والمكان، ثم نزّل الإعلان بصيغة SVG أو PNG أو JPEG.'
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
  const rows = MESSAGES.map(m => ({
    cells: [
      <b style={{ font: '500 14px/20px var(--sans)' }}>{L(m.subject, m.subjectAr)}</b>,
      <span className="dim">{L(m.audience, m.audienceAr)}</span>,
      <span className="chip">{L(...CHANNEL[m.channel])}</span>,
      <span className="num dim">{num(m.reach)}</span>,
      <span className="dim mono" dir="ltr">
        {m.when}
      </span>,
      <Status k={m.status} />,
      <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
        {CR.recBtn('message', m.id)}
      </span>
    ]
  }));
  return (
    <>
      {head}
      <div style={{ margin: '20px 0' }}>
        <C.InlineAlert
          tone="info"
          title={L('In-app communication is available', 'التواصل داخل التطبيق متاح')}
          body={L(
            'Use Member communication to review delivered messages and published updates. The records below are historical channel entries; this app cannot verify or retry their external delivery.',
            'استخدم التواصل مع الأعضاء لمراجعة الرسائل والمستجدات المنشورة. القيود أدناه تاريخية؛ لا يستطيع التطبيق تأكيد إرسالها خارجياً أو إعادة المحاولة.'
          )}
        />{' '}
        <a className="btn btn-secondary" style={{ marginTop: '12px' }} href="#/memberhub">
          {L('Open member communication', 'فتح التواصل مع الأعضاء')}
        </a>
      </div>{' '}
      <h2>{L('Historical channel records', 'قيود القنوات التاريخية')}</h2>{' '}
      <Table
        cols={[
          { label: L('Subject', 'الموضوع'), sort: true },
          { label: L('Audience', 'الجمهور'), cls: 'hide-sm' },
          { label: L('Channel', 'القناة'), cls: 'shrink hide-sm' },
          { label: L('Reach', 'العدد'), cls: 'num hide-md' },
          { label: L('When', 'الموعد'), cls: 'hide-md' },
          { label: L('Status', 'الحالة'), cls: 'shrink' },
          { label: '', cls: 'shrink' }
        ]}
        rows={rows}
      />
    </>
  );
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
          <button data-act="compose-person">
            <Icon name="msg" size={16} />
            {L('Message a person', 'مراسلة شخص')}
          </button>{' '}
          <button data-act="compose:group">
            <Icon name="groups" size={16} />
            {L('Message a group', 'مراسلة مجموعة')}
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
