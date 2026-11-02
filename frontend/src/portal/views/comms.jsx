import { joinNodes } from "../ui/html.js";
import { Select } from "../ui/components.jsx";
/* USED: Avatar, C, Empty, Icon, PageHead, Paged, Panel, Pill, Status, TabBar, Table, Who | HTML: nodesOr */
import { nodesOr, paint } from "../ui/html.js";
/* Modules 11, 13, 14 — communication centre, notices & bulletin, music, portal. */
import { t, isAr, num, fmtDate } from "../../lib/i18n.js";
import { is, S, bus } from "../model/store.js";
import { Icon, PageHead, Panel, Who, Status, Pill, Table, Empty, openDrawer, openModal, closeOverlays, toast, TabBar, Avatar, Paged } from "../ui/ui.jsx";
import * as C from "../ui/components.jsx";
import * as CR from "../flows/crud.jsx";
import { persist } from "../model/persist.js";
import { printSheet } from "../flows/print.js";
import * as F from "../flows/flows.jsx";
import { MESSAGES, TEMPLATES, NOTICES, MUSIC, MUSIC_DETAIL, SETLISTS, AUTOMATIONS, PRAYERS, PARISH, EVENTS, PORTAL_REQUESTS, HOUSEHOLDS, GROUPS, CONTENT, groupInfo, musicInfo, person, venue } from "../model/data.js";
import { waitingOnline } from "./online-requests.jsx";
import { session } from "../model/api.js";
const L = (en, ar) => t(en, ar);
const CHANNEL = {
  whatsapp: ['WhatsApp', 'واتساب'],
  sms: ['SMS', 'رسالة قصيرة'],
  email: ['Email', 'بريد إلكتروني']
};
const MTABS = () => [['', 'Messages', 'الرسائل'], ['automations', 'Automations', 'الأتمتة', is('leader') ? GROUPS.flatMap(g => groupInfo(g.id).automations).filter(a => a.active).length : AUTOMATIONS.filter(a => a.active).length], ['templates', 'Designs', 'التصاميم'], ['preferences', 'Rules', 'القواعد']];

/* ═══════════ 11 · communication ═══════════ */
export function messaging(tab = '') {
  const head = <><PageHead crumbs={[{
      label: L('Communicate', 'التواصل')
    }, {
      label: L('Messaging', 'المراسلة')
    }]} title={L('Communication centre', 'مركز التواصل')} sub={L('Publish updates and send messages inside ParishLife. External email, WhatsApp and SMS delivery are not connected.', 'انشر المستجدات وأرسل الرسائل داخل ParishLife. إرسال البريد وواتساب والرسائل القصيرة غير موصول.')} actions={<>{tab === 'templates' ? '' : <button className="btn btn-secondary" data-go="messaging/templates"><Icon name='doc' size={17} />{L('Ready-made designs', 'تصاميم جاهزة')}</button>}{" "}{<C.SplitBtn label={L('New message', 'رسالة جديدة')} id='newmsg' />}</>} /><TabBar base='messaging' items={MTABS()} active={tab} /></>;
  if (is('leader') && (tab === 'automations' || tab === 'preferences')) {
    const automation = tab === 'automations',
      key = automation ? 'automations' : 'messagingRules';
    const rows = GROUPS.flatMap(g => groupInfo(g.id)[key].map((item, index) => ({
      g,
      item,
      index
    })));
    return <>{head}<div className="tabbody"><div className="toolbar ministry-section-heading"><h2>{automation ? L('Group automations', 'أتمتة المجموعة') : L('Group messaging rules', 'قواعد مراسلة المجموعة')}</h2><button className="btn btn-primary btn-dense" data-message-config-new={key}><Icon name='plus' size={15} />{L('Add', 'إضافة')}</button></div>{" "}<Table cols={[{
          label: L('Group', 'المجموعة')
        }, {
          label: automation ? L('Automation', 'الأتمتة') : L('Rule', 'القاعدة')
        }, {
          label: automation ? L('Trigger', 'المحفّز') : L('Condition / action', 'الشرط / الإجراء')
        }, {
          label: L('Status', 'الحالة')
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={rows.map(({
          g,
          item,
          index
        }) => ({
          cells: [L(g.name, g.ar), <b>{L(item.name, item.nameAr || item.name)}</b>, <span>{L(item.trigger, item.triggerAr || item.trigger)}{!automation && item.action ? <small style={{
              display: "block"
            }}>{L(item.action, item.actionAr || item.action)}</small> : ''}</span>, item.active ? <Pill label={L('Active', 'مفعّلة')} tone='success' /> : <Pill label={L('Paused', 'متوقّفة')} tone='warning' />, <div className="row"><button className="btn btn-secondary btn-dense" data-message-config-edit={`${key}|${g.id}|${index}`}>{L('Edit', 'تعديل')}</button><button className="btn-icon" data-message-config-delete={`${key}|${g.id}|${index}`} aria-label={L('Delete', 'حذف')}><Icon name='trash' size={16} /></button></div>]
        }))} />{" "}<p className="help">{L('These settings are saved for your ministry. External message delivery and timed execution require a connected service.', 'تُحفظ هذه الإعدادات لخدمتك. يتطلب إرسال الرسائل وتنفيذها المجدول خدمة موصولة.')}</p></div></>;
  }
  if (tab === 'automations') return <>{head}<div className="tabbody"><Table cols={[{
        label: L('Automation plan', 'خطة الأتمتة')
      }, {
        label: L('Trigger', 'المحفّز'),
        cls: 'hide-sm'
      }, {
        label: L('Saved state', 'الحالة المحفوظة'),
        cls: 'shrink'
      }]} rows={AUTOMATIONS.map((a, ai) => ({
        cells: [<b>{L(a.what, a.whatAr)}</b>, <span className="dim">{L(a.on, a.onAr)}</span>, <label className="switch"><input type="checkbox" defaultChecked={!!a.active} data-act={`auto-toggle:${ai}`} /><span className="sr">{L('Active', 'مفعّل')}</span></label>]
      }))} />{" "}<C.InlineAlert tone='info' title={L('Plans only', 'خطط فقط')} body={L('No scheduled runner or external delivery service is connected. These switches save a plan; they do not send messages.', 'لا يوجد مشغّل مجدول أو خدمة إرسال خارجية موصولة. تحفظ المفاتيح الخطة ولا ترسل رسائل.')} />{" "}<p className="t-caption dim" style={{
        marginTop: "14px"
      }}>{L('These are stored automation plans. No scheduled runner or external delivery service is connected.', 'هذه خطط أتمتة محفوظة. لا يوجد مشغّل مجدول أو خدمة إرسال خارجية موصولة.')}</p></div></>;
  if (tab === 'templates') return <>{head}<div className="tabbody"><Paged className="gridcards">{TEMPLATES.map((tp, ti) => <button className="panel" style={{
          cursor: "pointer",
          textAlign: "start",
          border: "1px solid var(--border)"
        }} data-act={`design:${ti}`}><div style={{
            height: "110px",
            background: "var(--ink)",
            display: "grid",
            placeItems: "center",
            color: "var(--on-dark)",
            font: "600 14px/1 var(--sans)",
            textAlign: "center",
            padding: "10px"
          }}><span><span style={{
                display: "block",
                fontSize: "11px",
                opacity: ".7",
                letterSpacing: ".1em",
                textTransform: "uppercase"
              }}>{L(PARISH.name, PARISH.nameAr)}</span>{" "}{L(tp.name, tp.ar)}</span></div>{" "}<div className="panel-b" style={{
            padding: "12px"
          }}><b style={{
              font: "500 13px/18px var(--sans)"
            }}>{L(tp.name, tp.ar)}</b>{" "}<small className="t-caption dim" style={{
              display: "block",
              marginTop: "2px"
            }}>{L('Fill the date and location', 'املأ التاريخ والمكان')}</small></div></button>)}</Paged>{" "}<p className="t-caption dim" style={{
        marginTop: "16px"
      }}>{L('Each design carries the parish name. Fill in the date and location, then download an SVG, PNG, or JPEG announcement.', 'يحمل كل تصميم اسم الرعية. املأ التاريخ والمكان، ثم نزّل الإعلان بصيغة SVG أو PNG أو JPEG.')}</p></div></>;
  if (tab === 'preferences') return <>{head}<div style={{
      marginTop: "20px"
    }} className="grid g2"><Panel title={L('Available now', 'المتاح الآن')}><p>{L('ParishLife delivers in-app messages to named account holders and publishes group or parish updates to authorized member feeds.', 'يرسل ParishLife رسائل داخل التطبيق إلى حسابات محدّدة وينشر مستجدات المجموعات والرعية للأعضاء المخوّلين.')}</p>{" "}<a className="btn btn-secondary btn-dense" style={{
          marginTop: "12px"
        }} href="#/memberhub">{L('Review in-app communication', 'مراجعة التواصل داخل التطبيق')}</a></Panel>{" "}<Panel title={L('External delivery', 'الإرسال الخارجي')}><p>{L('Email, WhatsApp, SMS, timed automations, delivery retries, and emergency broadcasts require a connected service. This installation does not send them.', 'يتطلب البريد وواتساب والرسائل القصيرة والأتمتة المجدولة وإعادة المحاولة والبثّ الطارئ خدمة موصولة. لا يرسلها هذا التثبيت.')}</p></Panel></div></>;
  const rows = MESSAGES.map(m => ({
    cells: [<b style={{
      font: "500 14px/20px var(--sans)"
    }}>{L(m.subject, m.subjectAr)}</b>, <span className="dim">{L(m.audience, m.audienceAr)}</span>, <span className="chip">{L(...CHANNEL[m.channel])}</span>, <span className="num dim">{num(m.reach)}</span>, <span className="dim mono" dir="ltr">{m.when}</span>, <Status k={m.status} />, <span className="row" style={{
      gap: "6px",
      justifyContent: "flex-end"
    }}>{CR.recBtn('message', m.id)}</span>]
  }));
  return <>{head}<div style={{
      margin: "20px 0"
    }}><C.InlineAlert tone='info' title={L('In-app communication is available', 'التواصل داخل التطبيق متاح')} body={L('Use Member communication to review delivered messages and published updates. The records below are historical channel entries; this app cannot verify or retry their external delivery.', 'استخدم التواصل مع الأعضاء لمراجعة الرسائل والمستجدات المنشورة. القيود أدناه تاريخية؛ لا يستطيع التطبيق تأكيد إرسالها خارجياً أو إعادة المحاولة.')} />{" "}<a className="btn btn-secondary" style={{
        marginTop: "12px"
      }} href="#/memberhub">{L('Open member communication', 'فتح التواصل مع الأعضاء')}</a></div>{" "}<h2>{L('Historical channel records', 'قيود القنوات التاريخية')}</h2>{" "}<Table cols={[{
      label: L('Subject', 'الموضوع'),
      sort: true
    }, {
      label: L('Audience', 'الجمهور'),
      cls: 'hide-sm'
    }, {
      label: L('Channel', 'القناة'),
      cls: 'shrink hide-sm'
    }, {
      label: L('Reach', 'العدد'),
      cls: 'num hide-md'
    }, {
      label: L('When', 'الموعد'),
      cls: 'hide-md'
    }, {
      label: L('Status', 'الحالة'),
      cls: 'shrink'
    }, {
      label: '',
      cls: 'shrink'
    }]} rows={rows} /></>;
}
messaging.mount = host => {
  host.querySelector('[data-message-config-new]')?.addEventListener('click', b => messageConfigForm(b.currentTarget.dataset.messageConfigNew));
  host.querySelectorAll('[data-message-config-edit]').forEach(b => b.addEventListener('click', () => {
    const [key, gid, index] = b.dataset.messageConfigEdit.split('|');
    messageConfigForm(key, gid, Number(index));
  }));
  host.querySelectorAll('[data-message-config-delete]').forEach(b => b.addEventListener('click', () => {
    const [key, gid, index] = b.dataset.messageConfigDelete.split('|'),
      items = groupInfo(gid)[key],
      item = items[Number(index)];
    if (!item) return;
    openModal({
      title: L('Delete item?', 'حذف العنصر؟'),
      body: <p>{item.name}</p>,
      foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-danger" id="mc_delete">{L('Delete', 'حذف')}</button></>,
      onMount(el) {
        el.querySelector('#mc_delete').addEventListener('click', async () => {
          items.splice(Number(index), 1);
          if (!(await persist())) return;
          closeOverlays();
          bus.refresh();
        });
      }
    });
  }));
  const compose = () => F.compose('all');
  host.querySelector('[data-split="newmsg"]')?.addEventListener('click', compose);
  host.querySelector('[data-splitmenu="newmsg"]')?.addEventListener('click', () => openModal({
    title: L('Send', 'إرسال'),
    body: <div className="menu" style={{
      position: "static",
      boxShadow: "none",
      border: 0,
      padding: 0
    }}><button data-act="compose-person"><Icon name='msg' size={16} />{L('Message a person', 'مراسلة شخص')}</button>{" "}<button data-act="compose:group"><Icon name='groups' size={16} />{L('Message a group', 'مراسلة مجموعة')}</button>{" "}<button data-act="broadcast"><Icon name='bell' size={16} />{L('Emergency broadcast', 'بثّ طارئ')}</button></div>
  }));
};
function messageConfigForm(key, gid = '', index = -1) {
  const automation = key === 'automations',
    item = gid ? groupInfo(gid)[key]?.[index] : null;
  openDrawer({
    title: item ? L('Edit item', 'تعديل العنصر') : automation ? L('Add automation', 'إضافة أتمتة') : L('Add messaging rule', 'إضافة قاعدة مراسلة'),
    body: <><div className="formrow"><label className="label" htmlFor="mc_group">{L('Group', 'المجموعة')}</label><Select id="mc_group" disabled={!!item}>{GROUPS.map(g => <option value={g.id} selected={!!(g.id === gid)}>{L(g.name, g.ar)}</option>)}</Select></div><C.Field label={L('Name', 'الاسم')} id='mc_name' value={item?.name || ''} req={true} /><C.Field label={L('Arabic name', 'الاسم العربي')} id='mc_name_ar' value={item?.nameAr || ''} /><C.Field label={automation ? L('Trigger', 'المحفّز') : L('Condition', 'الشرط')} id='mc_trigger' value={item?.trigger || ''} req={true} /><C.Field label={L('Arabic description', 'الوصف العربي')} id='mc_trigger_ar' value={item?.triggerAr || ''} />{automation ? '' : <C.Field label={L('Action', 'الإجراء')} id='mc_action' value={item?.action || ''} req={true} />}{automation ? '' : <C.Field label={L('Arabic action', 'الإجراء بالعربية')} id='mc_action_ar' value={item?.actionAr || ''} />}<label className="check"><input type="checkbox" id="mc_active" defaultChecked={!!(item?.active !== false)} /><span>{L('Active', 'مفعّل')}</span></label></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="mc_save">{L('Save', 'حفظ')}</button></>,
    onMount(el) {
      el.querySelector('#mc_save').addEventListener('click', async () => {
        const name = el.querySelector('#mc_name').value.trim(),
          trigger = el.querySelector('#mc_trigger').value.trim(),
          action = el.querySelector('#mc_action')?.value.trim() || '';
        if (!name || !trigger || !automation && !action) return toast(L('Complete the name, condition and action', 'أكمل الاسم والشرط والإجراء'), '', 'warning');
        const target = item || {
          id: `mc-${Date.now().toString(36)}`,
          sent: 0
        };
        Object.assign(target, {
          name,
          nameAr: el.querySelector('#mc_name_ar').value.trim() || name,
          trigger,
          triggerAr: el.querySelector('#mc_trigger_ar').value.trim() || trigger,
          active: el.querySelector('#mc_active').checked
        });
        if (!automation) Object.assign(target, {
          action,
          actionAr: el.querySelector('#mc_action_ar').value.trim() || action
        });
        if (!item) groupInfo(el.querySelector('#mc_group').value)[key].push(target);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
      });
    }
  });
}

/* ═══════════ notices & bulletin ═══════════ */
export function notices() {
  const rows = nodesOr(NOTICES.map(n => <div className="listrow" style={{
    alignItems: "flex-start"
  }}><span className="grow"><b>{L(n.title, n.ar)}</b>{" "}<small>{fmtDate(n.at)} · {person(n.by) ? isAr() ? person(n.by).ar : person(n.by).lat : '—'} · {L(n.audience, n.audienceAr)}</small></span>{" "}{n.pri === 'urgent' ? <Pill label={L('Urgent', 'عاجل')} tone='danger' mark='st-alert' /> : <Pill label={L('Normal', 'عادي')} />}{" "}{CR.recBtn('notice', n.id)}</div>), <Empty glyph='bell' title={L('No notices', 'لا إعلانات')} body={L('Publish one and it appears on the board and in the bulletin.', 'انشر واحداً فيظهر على اللوحة وفي النشرة.')} />);
  return <><PageHead crumbs={[{
      label: L('Communicate', 'التواصل')
    }, {
      label: L('Notices', 'الإعلانات')
    }]} title={L('Notices and the weekly bulletin', 'الإعلانات والنشرة الأسبوعية')} sub={L('Enter Mass times, intentions, announcements and events once. ParishLife turns them into a printable bulletin and a phone-friendly version.', 'أدخل مواعيد القداديس والنوايا والإعلانات والأحداث مرّة واحدة. يحوّلها «حياة الرعية» إلى نشرة للطباعة ونسخة للهاتف.')} actions={<><button className="btn btn-secondary" id="bulletin"><Icon name='doc' size={17} />{L('Build bulletin', 'بناء النشرة')}</button>{" "}<button className="btn btn-primary" data-act="notice-add"><Icon name='plus' size={17} />{L('New notice', 'إعلان جديد')}</button></>} />{" "}<div className="splitview"><Panel title={L('Published notices', 'الإعلانات المنشورة')} tight={true}>{rows}</Panel>{" "}<div className="sidecol"><Panel title={L('Upcoming Masses', 'القداديس المقبلة')} tight={true}>{nodesOr(EVENTS.filter(m => m.kind === 'mass' && m.d >= new Date().toISOString().slice(0, 10)).slice(0, 8).map(m => <div className="listrow" style={{
            paddingInline: 0
          }}><span className="mono dim" style={{
              width: "94px",
              flex: "none"
            }}>{m.d} · {m.t}</span>{" "}<span className="grow"><b>{L(m.title, m.titleAr)}</b><small>{L(venue(m.venue)?.name || '', venue(m.venue)?.ar || '')}</small></span></div>), <p className="help">{L('No upcoming Masses in the calendar.', 'لا قداديس مقبلة في الرزنامة.')}</p>)}</Panel>{" "}<Panel title={L('Public parish page', 'صفحة الرعية العامة')}><p className="t-caption dim">{L('Published parish content and public calendar events appear on this page.', 'يظهر في هذه الصفحة محتوى الرعية المنشور وأحداث الرزنامة العامة.')}</p>{" "}<a className="btn btn-secondary" style={{
            marginTop: "12px"
          }} href={`public.html?parish=${encodeURIComponent(PARISH.id || '')}`} target="_blank" rel="noopener"><Icon name='link' size={17} />{L('Open public page', 'فتح الصفحة العامة')}</a></Panel></div></div></>;
}
notices.mount = host => {
  host.querySelector('#bulletin')?.addEventListener('click', () => openDrawer({
    large: true,
    title: L('Weekly bulletin', 'النشرة الأسبوعية'),
    sub: L('Edit the welcome text and intentions; the current public Masses and parish notices are included automatically.', 'حرّر كلمة الترحيب والنوايا؛ تُضاف القداديس العامة وإعلانات الرعية الحالية تلقائياً.'),
    body: <><div className="formgrid"><div className="formrow"><label className="label" htmlFor="bulletin-en">English introduction</label><textarea className="input" id="bulletin-en" rows="3" defaultValue={CONTENT.bulletin?.en || ''} /></div>{" "}<div className="formrow"><label className="label" htmlFor="bulletin-ar">المقدمة بالعربية</label><textarea className="input" id="bulletin-ar" rows="3" dir="rtl" defaultValue={CONTENT.bulletin?.ar || ''} /></div></div>{" "}<div className="formgrid"><div className="formrow"><label className="label" htmlFor="intentions-en">Mass intentions (English, one per line)</label><textarea className="input" id="intentions-en" rows="3" defaultValue={CONTENT.intentions?.en || ''} /></div>{" "}<div className="formrow"><label className="label" htmlFor="intentions-ar">نوايا القداديس (عربي، سطر لكل نيّة)</label><textarea className="input" id="intentions-ar" rows="3" dir="rtl" defaultValue={CONTENT.intentions?.ar || ''} /></div></div>{" "}<div className="a4bar"><C.BGroup items={[L('A4 preview', 'معاينة A4'), L('Phone preview', 'معاينة الهاتف')]} sel={0} /></div><div className="a4" id="bulletin-preview" style={{
        maxWidth: "none",
        aspectRatio: "auto",
        padding: "32px",
        alignItems: "stretch",
        textAlign: "start"
      }} /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button><button className="btn btn-secondary" id="bulletin-save">{L('Save content', 'حفظ المحتوى')}</button>{" "}<button className="btn btn-primary" id="bulletin-print" style={{
        marginInlineStart: "auto"
      }}>{L('Print', 'طباعة')}</button></>,
    onMount(el) {
      const page = el.querySelector('#bulletin-preview');
      const render = () => {
        const now = new Date(),
          end = new Date(now);
        end.setDate(now.getDate() + 6);
        const from = now.toISOString().slice(0, 10),
          through = end.toISOString().slice(0, 10);
        const langText = (en, ar) => isAr() ? ar || en : en || ar;
        const intro = langText(el.querySelector('#bulletin-en').value, el.querySelector('#bulletin-ar').value);
        const intentions = langText(el.querySelector('#intentions-en').value, el.querySelector('#intentions-ar').value).split('\n').map(x => x.trim()).filter(Boolean);
        const masses = EVENTS.filter(e => e.kind === 'mass' && e.d >= from && e.d <= through).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
        const notices = NOTICES.filter(n => n.audience === 'Parish' && !n.groupId && n.at >= from && n.at <= through);
        paint(page, <><div style={{
            textAlign: "center"
          }}><div className="ttl">{L(PARISH.name, PARISH.nameAr)}</div><div className="ttl-ar">{L('Weekly bulletin', 'النشرة الأسبوعية')} · {from} – {through}</div></div>{" "}{intro ? <p style={{
            marginTop: "18px",
            whiteSpace: "pre-wrap"
          }}>{intro}</p> : ''}{" "}<h4>{L('Masses', 'القداديس')}</h4>{nodesOr(masses.map(m => <div className="listrow"><span className="mono">{m.d} · {m.t}</span><span>{L(m.title, m.titleAr)}</span></div>), <p>{L('No Masses scheduled this week.', 'لا قداديس مجدولة هذا الأسبوع.')}</p>)}{" "}{intentions.length ? <><h4>{L('Mass intentions', 'نوايا القداديس')}</h4>{intentions.map(text => <div className="listrow">{text}</div>)}</> : ''}{" "}<h4>{L('Parish notices', 'إعلانات الرعية')}</h4>{nodesOr(notices.map(n => <div className="listrow">{L(n.title, n.ar)}</div>), <p>{L('No parish notices this week.', 'لا إعلانات للرعية هذا الأسبوع.')}</p>)}</>);
      };
      el.querySelectorAll('#bulletin-en,#bulletin-ar,#intentions-en,#intentions-ar').forEach(input => input.addEventListener('input', render));
      render();
      el.querySelectorAll('.a4bar button').forEach((b, i) => b.addEventListener('click', () => page.classList.toggle('phone', i === 1)));
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
      el.querySelector('#bulletin-print').addEventListener('click', () => printSheet({
        title: L('Weekly bulletin', 'النشرة الأسبوعية'),
        body: page.innerHTML,
        margin: '12mm'
      }));
    }
  }));
};

/* ═══════════ 13 · music ═══════════ */
const LANG_AR = {
  Arabic: 'عربي',
  Syriac: 'سرياني',
  English: 'إنكليزي',
  French: 'فرنسي',
  'Roman liturgical': 'طقسي روماني'
};
const PART_AR = {
  Entrance: 'الدخول',
  Trisagion: 'التقديسات',
  Offertory: 'التقدمة',
  Communion: 'المناولة',
  Veneration: 'السجود للصليب',
  Recessional: 'الختام'
};
export function music(id, tab = '') {
  if (id) return hymn(id, tab);
  const f = S.ui.music || {};
  const shown = MUSIC.filter(m => (!f.occ || m.occasion === f.occ) && (!f.part || m.part === f.part) && (!f.lang || m.lang === f.lang));
  const choice = (key, all, allAr, values) => <Select style={{
    width: "auto"
  }} data-mfilter={key} aria-label={L(all, allAr)}><option value="">{L(all, allAr)}</option>{values.map(([v, en, ar]) => <option value={v} selected={!!(f[key] === v)}>{L(en, ar)}</option>)}</Select>;
  const uniq = pick => [...new Map(MUSIC.map(m => pick(m)).filter(x => x[0]).map(x => [x[0], x])).values()].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = shown.map(m => ({
    cls: 'clickable',
    attrs: `data-hymn="${m.id}" data-find-item`,
    cells: [<><b style={{
        font: "500 14px/20px var(--sans)"
      }}>{m.title}</b>{" "}<small className="t-caption dim" style={{
        display: "block",
        fontFamily: "var(--arabic)"
      }}>{m.ar}</small></>, <span className="dim">{L(m.occasion, m.occasionAr)}</span>, <span className="dim">{L(m.part, PART_AR[m.part] || m.part)}</span>, <span className="mono">{m.key}</span>, <span className="chip">{L(m.lang, LANG_AR[m.lang] || m.lang)}</span>, <span className="row" style={{
      gap: "6px"
    }}>{musicInfo(m).lyrics?.length || musicInfo(m).chords ? <Icon name='doc' size={17} cls='dimmer' /> : ''}{m.youtubeUrl || m.anghamiUrl || m.otherUrl ? <Icon name='music' size={17} cls='dimmer' /> : ''}</span>, <span className="row" style={{
      gap: "6px",
      justifyContent: "flex-end"
    }}><button className="btn btn-secondary btn-dense" data-act={`to-service:${m.id}`}>{L('Add to service', 'أضف إلى الخدمة')}</button>{CR.recBtn('hymn', m.id)}</span>]
  }));
  return <><PageHead crumbs={[{
      label: L('Communicate', 'التواصل')
    }, {
      label: L('Music library', 'مكتبة الألحان')
    }]} title={L('Music and worship resources', 'الألحان وموارد العبادة')} sub={L('Catalogued by title, language, composer, occasion, Mass part, feast and season, with the key, the arrangement and the instrument notes attached.', 'مفهرسة بالعنوان واللغة والملحّن والمناسبة وجزء القدّاس والعيد والزمن، مع المقام والتوزيع وملاحظات الآلات.')} actions={<><button className="btn btn-secondary" id="setlist"><Icon name='doc' size={17} />{L('Setlists', 'لوائح الألحان')}</button>{" "}<button className="btn btn-primary" data-act="hymn-new"><Icon name='plus' size={17} />{L('Add hymn', 'إضافة لحن')}</button></>} />{" "}<div className="toolbar" style={{
      marginBottom: "16px"
    }}><div className="grow" style={{
        maxWidth: "320px"
      }}><C.SearchClear ph={L('Title, occasion or first line', 'العنوان أو المناسبة أو المطلع')} id='msearch' data-find="" /></div>{" "}{choice('occ', 'All occasions', 'كل المناسبات', uniq(m => [m.occasion, m.occasion, m.occasionAr]))}{" "}{choice('part', 'All Mass parts', 'كل أجزاء القدّاس', uniq(m => [m.part, m.part, PART_AR[m.part] || m.part]))}{" "}{choice('lang', 'All languages', 'كل اللغات', uniq(m => [m.lang, m.lang, LANG_AR[m.lang] || m.lang]))}{" "}{f.occ || f.part || f.lang ? <button className="btn btn-ghost btn-dense" data-act="music-clear">{L('Clear filters', 'مسح المرشّحات')}</button> : ''}</div>{" "}<Table cols={[{
      label: L('Hymn', 'اللحن'),
      sort: true
    }, {
      label: L('Occasion', 'المناسبة'),
      cls: 'hide-sm',
      sort: true
    }, {
      label: L('Mass part', 'جزء القدّاس'),
      cls: 'hide-md'
    }, {
      label: L('Key', 'المقام'),
      cls: 'shrink'
    }, {
      label: L('Language', 'اللغة'),
      cls: 'shrink hide-md'
    }, {
      label: L('Files', 'الملفات'),
      cls: 'shrink hide-sm'
    }, {
      label: '',
      cls: 'shrink'
    }]} rows={rows} empty={<Empty glyph='music' title={L('No hymn matches', 'لا لحن يطابق')} body={L('Try another occasion, part or language.', 'جرّب مناسبة أو جزءاً أو لغة أخرى.')} action={<button className="btn btn-secondary btn-dense" data-act="music-clear">{L('Clear filters', 'مسح المرشّحات')}</button>} />} />{" "}<div className="find-empty" hidden><Empty glyph='search' title={L('No hymn matches', 'لا لحن يطابق')} body={L('Try part of the title or the occasion.', 'جرّب جزءاً من العنوان أو المناسبة.')} /></div></>;
}

/* Transposition moves every chord on a chord line by semitones; lyric lines are left alone. */
const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#'
};
const moveNote = (n, by) => {
  const i = NOTES_SHARP.indexOf(FLAT[n] || n);
  return i < 0 ? n : NOTES_SHARP[(i + by + 120) % 12];
};
const CHORD = /^([A-G][b#]?)(m|maj7|m7|7|sus2|sus4|dim|aug|add9)?(\/[A-G][b#]?)?$/;
function transpose(text, by) {
  if (!by) return text;
  return text.split('\n').map(line => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (!words.length || !words.every(w => CHORD.test(w))) return line;
    return line.replace(/[A-G][b#]?(?:maj7|m7|m|7|sus2|sus4|dim|aug|add9)?(?:\/[A-G][b#]?)?/g, c => {
      const [, root, rest = '', bass = ''] = c.match(CHORD);
      return moveNote(root, by) + rest + (bass ? '/' + moveNote(bass.slice(1), by) : '');
    });
  }).join('\n');
}
const transposeKey = (key, by) => {
  const m = String(key || '').match(/^([A-G][b#]?)(.*)$/);
  return m ? moveNote(m[1], by) + m[2] : key;
};
const HTABS = () => [['', 'Lyrics', 'الكلمات'], ['chords', 'Chords', 'الأوتار'], ['notes', 'Instrument notes', 'ملاحظات الآلات'], ['versions', 'Versions', 'الإصدارات'], ['rights', 'Rights', 'الحقوق']];
const safeMusicLink = (value, host) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (!host || url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : '';
  } catch {
    return '';
  }
};
function hymn(id, tab) {
  const m = MUSIC.find(x => x.id === id);
  if (!m) return <>{<PageHead crumbs={[{
      label: L('Music library', 'مكتبة الألحان'),
      href: '#/music'
    }]} title={L('Hymn not found', 'اللحن غير موجود')} />}{" "}{<Empty glyph='music' title={L('This hymn is no longer in the library', 'هذا اللحن لم يعد في المكتبة')} body={L('It may have been deleted.', 'ربما حُذف.')} action={<a className="btn btn-primary btn-dense" href="#/music">{L('Music library', 'مكتبة الألحان')}</a>} />}</>;
  const d = musicInfo(m),
    shift = (S.ui.transpose || {})[m.id] || 0;
  const musicLinks = [['YouTube', safeMusicLink(m.youtubeUrl, 'youtube.com') || safeMusicLink(m.youtubeUrl, 'youtu.be')], ['Anghami', safeMusicLink(m.anghamiUrl, 'anghami.com')], ['Other link', safeMusicLink(m.otherUrl, '')]].filter(([, url]) => url);
  const head = <><div className="pagehead"><div className="entityhead" style={{
        width: "100%"
      }}><div className="id"><nav className="crumbs"><a href="#/music">{L('Music library', 'مكتبة الألحان')}</a><span className="sep">/</span><span>{m.title}</span></nav>{" "}<h1 style={{
            font: "600 26px/34px var(--sans)",
            letterSpacing: "-.02em"
          }}>{m.title}{" "}{m.key ? <span className="pill">{m.key}</span> : ''}<span className="pill">{L(m.lang, LANG_AR[m.lang] || m.lang)}</span></h1>{" "}<div className="meta" style={{
            fontFamily: "var(--arabic)"
          }}>{[m.ar, L(m.occasion, m.occasionAr), L(m.part, PART_AR[m.part] || m.part)].filter(Boolean).join(' · ')}</div></div>{" "}<div className="acts">{musicLinks.length ? <button className="btn btn-secondary" data-act={`play:${m.id}`}><Icon name='play' size={17} />{L('Listen online', 'استمع عبر الإنترنت')}</button> : ''}{" "}<button className="btn btn-secondary" data-hymn-print={m.id}><Icon name='print' size={17} />{L('Print sheet', 'طباعة النوتة')}</button>{" "}<button className="btn btn-primary" data-act={`to-service:${m.id}`}><Icon name='plus' size={17} />{L('Add to service', 'أضف إلى الخدمة')}</button></div></div></div><TabBar base={'music/' + m.id} items={HTABS()} active={tab} /></>;
  const T = {
    '': () => <div className="splitview"><Panel title={L('Lyrics', 'الكلمات')} tight={true} more={<button className="btn btn-ghost btn-dense" data-act={`hymn-text:${m.id}|lyrics`}><Icon name={d.lyrics.length ? 'edit' : 'plus'} size={15} />{d.lyrics.length ? L('Edit', 'تعديل') : L('Add lyrics', 'إضافة الكلمات')}</button>}><table className="tbl" style={{
          width: "100%"
        }}><thead><tr><th>{L('Syriac', 'سرياني')}</th><th>{L('Arabic', 'عربي')}</th><th>{L('English', 'إنكليزي')}</th></tr></thead><tbody>{d.lyrics.length ? '' : <tr><td colSpan="3" className="dim">{L('No lyrics entered yet.', 'لا كلمات بعد.')}</td></tr>}{d.lyrics.map(r => <tr><td style={{
                fontSize: "16px"
              }}>{r[0]}</td><td style={{
                fontFamily: "var(--arabic)",
                fontSize: "16px"
              }}>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table></Panel>{" "}<div className="sidecol">{musicLinks.length ? <Panel title={L('Listen online', 'استمع عبر الإنترنت')}>{musicLinks.map(([label, url]) => <a className="btn btn-secondary btn-dense" href={url} target="_blank" rel="noopener noreferrer" style={{
            margin: "4px"
          }}>{label}</a>)}</Panel> : ''}{" "}<Panel title={L('Personal annotations', 'ملاحظات شخصية')}>{d.annotations.map(([p, en, ar]) => <div className="listrow" style={{
            paddingInline: 0,
            alignItems: "flex-start"
          }}><Avatar p={person(p)} cls='avatar-sm' /><span className="grow t-caption">{L(en, ar)}</span></div>)}<div className="divider" /><C.Textarea label={L('Add your own', 'أضف ملاحظتك')} id='hann' max={200} /></Panel></div></div>,
    chords: () => <div className="splitview"><Panel title={L('Chord chart', 'جدول الأوتار') + (shift ? ` · ${shift > 0 ? '+' : ''}${shift}` : '')} more={<button className="btn btn-ghost btn-dense" data-act={`hymn-text:${m.id}|chords`}><Icon name={d.chords ? 'edit' : 'plus'} size={15} />{d.chords ? L('Edit', 'تعديل') : L('Add chords', 'إضافة الأوتار')}</button>}>{d.chords ? <pre className="mono" style={{
          fontSize: "13px",
          lineHeight: "24px",
          whiteSpace: "pre-wrap",
          margin: 0
        }}>{transpose(d.chords, shift)}</pre> : <p className="dim">{L('No chord chart yet.', 'لا جدول أوتار بعد.')}</p>}</Panel>{" "}<div className="sidecol"><Panel title={L('Transpose', 'النقل')}><div className="row" style={{
            gap: "8px",
            flexWrap: "wrap"
          }}><span className="chip">{m.key || '—'}</span><Icon name='arrowR' size={16} cls='dimmer' />{" "}<span className="chip chip-on">{transposeKey(m.key, shift) || '—'}</span></div>{" "}<div className="presets" style={{
            marginTop: "12px"
          }}>{[-2, -1, 0, 1, 2].map(n => <button aria-pressed={n === shift} data-act={`transpose:${m.id}|${n}`}>{n > 0 ? '+' + n : n === 0 ? '0' : '−' + -n}</button>)}</div>{" "}<C.InlineAlert tone='warning' title={L('A scanned PDF cannot be transposed', 'الـPDF الممسوح لا يُنقَل')} body={L('Structured chord text transposes cleanly. ParishLife says so rather than producing a wrong sheet.', 'النصّ الوتري المنظَّم يُنقَل بلا مشاكل. ويقول «حياة الرعية» ذلك بدل إنتاج نوتة خاطئة.')} /></Panel></div></div>,
    notes: () => <div style={{
      maxWidth: "760px"
    }}><Panel title={L('Instrument notes', 'ملاحظات الآلات')} tight={true}>{nodesOr(d.notes.map(([inst, instAr, en, ar], ni) => <div className="listrow" style={{
          paddingInline: 0,
          alignItems: "flex-start"
        }}><span className="chip" style={{
            flex: "none"
          }}>{L(inst, instAr)}</span>{" "}<span className="grow">{L(en, ar)}</span><C.IconBtn ico='edit' label={L('Edit', 'تعديل')} data-act={`inst-edit:${m.id}|${ni}`} /></div>), <p className="dim" style={{
          padding: "18px",
          margin: 0
        }}>{L('No instrument notes yet.', 'لا ملاحظات آلات بعد.')}</p>)}</Panel></div>,
    versions: () => <div style={{
      maxWidth: "760px"
    }}><Panel title={L('Version history', 'سجل الإصدارات')}>{d.versions.length ? '' : <p className="dim" style={{
          margin: 0
        }}>{L('No earlier versions.', 'لا إصدارات سابقة.')}</p>}<div className="timeline">{d.versions.map(([en, ar, when, by], i) => <div className={`tl-item ${i === 0 ? 'accent' : ''}`}><div className="when">{fmtDate(when)} · {isAr() ? person(by).ar : person(by).lat}</div>{" "}<div className="what">{L(en, ar)}{i === 0 ? <span className="pill pill-success"><span className="dot" />{L('current', 'الحالي')}</span> : ''}</div>{" "}{i ? <button className="btn btn-secondary btn-dense" style={{
              marginTop: "8px"
            }} data-act={`hymn-restore:${m.id}|${i}`}>{L('Restore', 'استرجاع')}</button> : ''}</div>)}</div></Panel></div>,
    rights: () => <div className="splitview"><Panel title={L('Copyright and permitted uses', 'الحقوق والاستعمالات المسموحة')}><dl className="dl"><dt>{L('Composer', 'الملحّن')}</dt><dd>{L(d.composer, d.composerAr)}</dd><dt>{L('Copyright', 'الحقوق')}</dt><dd>{L(d.copyright, d.copyrightAr)}</dd><dt>{L('Attribution', 'الإسناد')}</dt><dd>{L('Not required', 'غير مطلوب')}</dd></dl>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "8px",
          flexWrap: "wrap"
        }}>{d.uses.map(u => <span className="chip chip-on"><Icon name='check' size={13} />{" "}{u}</span>)}{" "}<span className="chip">{L('Sell', 'بيع')}</span></div></Panel>{" "}<div className="sidecol"><Panel title={L('Instrument tuning', 'دوزان الآلات')}><p className="t-body dim" style={{
            fontSize: "14px",
            lineHeight: "22px"
          }}>{L('A built-in tuner is deliberately not part of ParishLife. Choirs already use a phone app for it, and building one would take time away from the library, the setlists and the service plans that only a parish system can do.', 'الدوزان المدمج ليس جزءاً من «حياة الرعية» عن قصد. الجوقات تستعمل تطبيقاً على الهاتف أصلاً، وبناء واحد يأخذ وقتاً من المكتبة واللوائح وخطط الخدمة التي لا يقوم بها سوى نظام الرعية.')}</p>{" "}<span className="pill">{L('Deferred — external tool', 'مؤجَّل — أداة خارجية')}</span></Panel>{" "}<Panel title={L('Offline copies', 'نسخ للعمل بلا إنترنت')}><p className="t-body dim" style={{
            fontSize: "14px"
          }}>{L('Downloadable and offline copies are offered only where the licence allows it. Where it does not, the item can still be projected but not distributed.', 'النسخ القابلة للتنزيل والعمل بلا إنترنت تُتاح فقط حيث يسمح الترخيص. وحيث لا يسمح يبقى العرض ممكناً لا التوزيع.')}</p>{" "}<C.SwitchRow label={L('Allow choir members to download', 'السماح لأعضاء الجوقة بالتنزيل')} checked={true} pref='music.download' /></Panel></div></div>
  };
  return <>{head}{(T[tab] || T[''])()}</>;
}
music.mount = host => {
  host.querySelector('[data-hymn-print]')?.addEventListener('click', e => {
    const m = MUSIC.find(item => item.id === e.currentTarget.dataset.hymnPrint);
    if (!m) return;
    const detail = musicInfo(m),
      hasLyrics = !!detail.lyrics?.length,
      hasChords = !!detail.chords;
    if (!hasLyrics && !hasChords) return toast(L('No lyrics or chords to print', 'لا كلمات أو أوتار للطباعة'), '', 'warning');
    openModal({
      title: L('Print hymn sheet', 'طباعة ورقة اللحن'),
      body: <><p>{L(m.title, m.ar)}</p><div className="formrow"><label className="label" htmlFor="hymn-print-choice">{L('Include', 'تضمين')}</label><Select id="hymn-print-choice">{hasLyrics ? <option value="lyrics">{L('Lyrics', 'الكلمات')}</option> : ''}{hasChords ? <option value="chords">{L('Chords', 'الأوتار')}</option> : ''}{hasLyrics && hasChords ? <option value="both">{L('Lyrics and chords', 'الكلمات والأوتار')}</option> : ''}</Select></div></>,
      foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="hymn-print-go">{L('Print', 'طباعة')}</button></>,
      onMount(el) {
        el.querySelector('#hymn-print-go').addEventListener('click', () => {
          const choice = el.querySelector('#hymn-print-choice').value,
            lyrics = joinNodes(detail.lyrics.map(row => row.filter(Boolean).join(' · ')), <br />);
          const body = <><h1>{L(m.title, m.ar)}</h1>{choice !== 'chords' ? <section><h2>{L('Lyrics', 'الكلمات')}</h2><p>{lyrics}</p></section> : ''}{choice !== 'lyrics' ? <section><h2>{L('Chords', 'الأوتار')}</h2><pre>{detail.chords}</pre></section> : ''}</>;
          printSheet({
            title: L(m.title, m.ar),
            body,
            margin: '15mm'
          });
        });
      }
    });
  });
  host.querySelectorAll('[data-mfilter]').forEach(sel => sel.addEventListener('change', () => {
    S.ui.music = {
      ...(S.ui.music || {}),
      [sel.dataset.mfilter]: sel.value
    };
    bus.refresh();
  }));
  host.querySelectorAll('[data-hymn]').forEach(tr => tr.addEventListener('click', e => {
    if (e.target.closest('button,a,input')) return;
    location.hash = '#/music/' + tr.dataset.hymn;
  }));
  host.querySelector('#setlist')?.addEventListener('click', () => openDrawer({
    title: L('Setlists', 'لوائح الألحان'),
    sub: L('A setlist links to a service plan, so the order of service and the choir folder never drift apart.', 'ترتبط اللائحة بخطة الخدمة، فلا يفترق ترتيب الخدمة عن ملف الجوقة.'),
    body: nodesOr(SETLISTS.map(s => <div className="listrow"><span className="grow"><b>{L(s.name, s.ar)}</b>{" "}<small>{s.items.length}{" "}{L('hymns', 'ألحان')}{s.service ? ` · ${L('linked to a service', 'مرتبطة بخدمة')}` : ''}</small></span>{" "}<button className="btn btn-secondary btn-dense" data-act={`setlist-open:${s.id}`}>{L('Open', 'فتح')}</button>{CR.recBtn('setlist', s.id)}</div>), <Empty glyph='music' title={L('No setlists yet', 'لا لوائح بعد')} body={L('Put hymns in order for a Mass or a feast.', 'رتّب الألحان لقدّاس أو عيد.')} />),
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-primary" data-act="setlist-new" style={{
        marginInlineStart: "auto"
      }}>{L('New setlist', 'لائحة جديدة')}</button></>
  }));
};

/* ═══════════ 14 · portal ═══════════ */
const portalSections = [['welcome', 'Welcome message', 'رسالة الترحيب', 'Introduce your parish in a few welcoming words.', 'عرّف برعيتك بكلمات ترحيبية موجزة.'], ['history', 'History & patron saint', 'التاريخ والشفيع', 'Share the story and identity of your parish.', 'شارك تاريخ رعيتك وهويتها.'], ['massTimes', 'Mass & confession', 'القداديس والاعتراف', 'Help visitors plan their next visit.', 'ساعد الزوّار على التخطيط لزيارتهم المقبلة.'], ['contact', 'Contact & visiting', 'التواصل والزيارة', 'Make it easy to find and contact the parish.', 'سهّل الوصول إلى الرعية والتواصل معها.'], ['sacraments', 'Sacraments & certificates', 'الأسرار والشهادات', 'Tell families what to know before they ask for a baptism, a wedding or a certificate.', 'أخبر العائلات بما يجب معرفته قبل طلب معمودية أو إكليل أو شهادة.']];
function portalContent() {
  const hasText = c => !!(c.en?.trim() || c.ar?.trim());
  const published = portalSections.filter(([key]) => {
    const c = CONTENT[key] || {};
    return hasText(c) && c.published !== false;
  }).length;
  const drafts = portalSections.filter(([key]) => {
    const c = CONTENT[key] || {};
    return hasText(c) && c.published === false;
  }).length;
  return <div className="cms-content"><section className="cms-overview" aria-labelledby="cms-overview-title"><div className="cms-overview-copy"><span className="cms-eyebrow">{L('Your public presence', 'حضورك العام')}</span>{" "}<h2 id="cms-overview-title">{L(PARISH.name, PARISH.nameAr)}</h2>{" "}<p>{L('A welcoming first visit starts here. Keep your parish story, service times and visiting details easy to find.', 'تبدأ الزيارة الأولى هنا. اجعل تاريخ رعيتك ومواعيد الخدمات ومعلومات الزيارة سهلة الوصول.')}</p></div>{" "}<dl className="cms-summary"><div><dt>{L('Published', 'منشور')}</dt><dd>{num(published)}</dd></div><div><dt>{L('Drafts', 'مسودات')}</dt><dd>{num(drafts)}</dd></div><div><dt>{L('Empty', 'فارغ')}</dt><dd>{num(portalSections.length - published - drafts)}</dd></div></dl></section>{" "}<div className="cms-section-heading"><div><span className="cms-eyebrow">{L('01 / Website content', '01 / محتوى الموقع')}</span><h2>{L('Make every section feel welcoming.', 'اجعل كل قسم يرحّب بالزوّار.')}</h2></div>{" "}<p>{L('Edit in English and Arabic. Only published sections are visible to visitors.', 'حرّر بالإنكليزية والعربية. يرى الزوّار الأقسام المنشورة فقط.')}</p></div>{" "}<div className="cms-section-grid">{portalSections.map(([key, en, ar, desc, descAr], index) => {
        const c = CONTENT[key] || {},
          filled = hasText(c),
          state = !filled ? 'empty' : c.published === false ? 'draft' : 'published';
        const preview = L(c.en || '', c.ar || '') || c.en || c.ar || '';
        return <article className="cms-section-card" aria-labelledby={`cms-${key}-title`}><div className="cms-card-top"><span className="cms-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className={`cms-state cms-state-${state}`}><span aria-hidden="true" />{state === 'published' ? L('Published', 'منشور') : state === 'draft' ? L('Draft · private', 'مسودة · خاصة') : L('Not started', 'لم يبدأ بعد')}</span></div>{" "}<h3 id={`cms-${key}-title`}>{L(en, ar)}</h3><p className="cms-card-description">{L(desc, descAr)}</p>{" "}<p className={`cms-content-preview${filled ? '' : ' cms-content-empty'}`} dir="auto">{preview || (key === 'sacraments' ? L('Until you add one, visitors see a short default introduction above the request buttons.', 'إلى أن تضيف نصاً، يرى الزوّار مقدّمة قصيرة افتراضية فوق أزرار الطلبات.') : L('Add this section to welcome visitors to your parish.', 'أضف هذا القسم للترحيب بزوّار رعيتك.'))}</p>{" "}<div className="cms-card-footer"><div className="cms-languages" aria-label={L('Content languages', 'لغات المحتوى')}><span className={c.en?.trim() ? 'is-ready' : ''} title={c.en?.trim() ? L('English content ready', 'المحتوى الإنكليزي جاهز') : L('English content missing', 'المحتوى الإنكليزي غير مضاف')}><Icon name={c.en?.trim() ? 'check' : 'plus'} size={12} />English</span><span className={c.ar?.trim() ? 'is-ready' : ''} lang="ar" title={c.ar?.trim() ? L('Arabic content ready', 'المحتوى العربي جاهز') : L('Arabic content missing', 'المحتوى العربي غير مضاف')}><Icon name={c.ar?.trim() ? 'check' : 'plus'} size={12} />العربية</span></div>{" "}<button className="cms-edit" data-act={`content-edit:${key}`} aria-label={L('Edit ' + en, 'تعديل ' + ar)}>{filled ? L('Edit section', 'تعديل القسم') : L('Add content', 'إضافة محتوى')}<Icon name='arrowR' size={16} /></button></div></article>;
      })}</div>{" "}<aside className="cms-publishing-note"><Icon name='info' size={18} /><p>{L('Save a draft while you work. A draft section stays off the public page until you publish it. Add both languages before publishing.', 'احفظ مسودة أثناء العمل. يبقى القسم المسودة خارج الصفحة العامة حتى تنشره. أضف اللغتين قبل النشر.')}</p></aside>{" "}<section className="cms-related" aria-labelledby="cms-related-title"><div><span className="cms-eyebrow">{L('02 / Parish updates', '02 / مستجدات الرعية')}</span><h2 id="cms-related-title">{L('Keep your community up to date.', 'أبقِ جماعتك على اطّلاع.')}</h2><p>{L('Public events and announcements are managed in their own spaces.', 'تُدار الأحداث العامة والإعلانات في أقسامها الخاصة.')}</p></div>{" "}<div className="cms-related-links"><a href="#/calendar"><Icon name='events' size={21} /><span><strong>{L('Public calendar', 'الرزنامة العامة')}</strong><small>{L('Service times and upcoming events', 'مواعيد الخدمات والأحداث المقبلة')}</small></span><Icon name='arrowR' size={18} /></a>{" "}<a href="#/memberhub"><Icon name='bell' size={21} /><span><strong>{L('Announcements', 'الإعلانات')}</strong><small>{L('News and updates for your community', 'أخبار ومستجدات جماعتك')}</small></span><Icon name='arrowR' size={18} /></a>{" "}{session.user?.platformRole === 'super_admin' ? <a href="#/workspace" data-act="homepage-edit"><Icon name='globe' size={21} /><span><strong>{L('ParishLife homepage', 'الصفحة الرئيسية لـ ParishLife')}</strong><small>{L('Opening lines, announcement, stories and sections shared by every parish', 'الافتتاح والإعلان والقصص والأقسام المشتركة بين جميع الرعايا')}</small></span><Icon name='arrowR' size={18} /></a> : ''}</div></section></div>;
}
const PTABS = () => [['', 'Website content', 'محتوى الموقع'], ['requests', 'Self-service', 'الخدمة الذاتية', PORTAL_REQUESTS.length], ['prayers', 'Prayer requests', 'نوايا الصلاة', PRAYERS.filter(p => p.status === 'awaiting-approval').length]];
export function portal(tab = '') {
  const head = <><PageHead crumbs={[{
      label: L('Communicate', 'التواصل')
    }, {
      label: L('Member portal', 'بوّابة المؤمنين')
    }]} title={tab ? L('Parish content and member portal', 'محتوى الرعية وبوّابة المؤمنين') : L('Your parish website', 'موقع رعيتك')} sub={L('A clear, welcoming place for parish life. Manage your public content and member requests.', 'مساحة واضحة ومرحّبة لحياة الرعية. أدر المحتوى العام وطلبات الأعضاء.')} actions={<><button className="btn btn-secondary" data-act="portal-open"><Icon name='link' size={17} />{L('View public page', 'عرض الصفحة العامة')}</button>{" "}<button className="btn btn-primary" data-act="content-edit:welcome"><Icon name='edit' size={17} />{L('Edit welcome', 'تعديل الترحيب')}</button></>} /><TabBar base='portal' items={PTABS()} active={tab} /></>;
  const online = waitingOnline().length;
  const onlineNote = online ? <a className="listrow or-pointer" href="#/requests"><Icon name='sacr' size={17} cls='dimmer' /><span className="grow"><b>{L(online === 1 ? '1 sacrament or certificate request is waiting' : `${online} sacrament or certificate requests are waiting`, online === 1 ? 'طلب سرّ أو شهادة واحد بالانتظار' : `${online} طلبات أسرار أو شهادات بالانتظار`)}</b>{" "}<small>{L('They are reviewed in Requests.', 'تُراجَع في صفحة الطلبات.')}</small></span><Icon name='chevR' size={16} cls='dimmer' /></a> : '';
  if (tab === 'requests') return <>{head}<div style={{
      marginTop: "20px"
    }} className="splitview"><Panel title={L('Waiting for review', 'بانتظار المراجعة')} tight={false}>{<>{onlineNote}{PORTAL_REQUESTS.length ? <>{PORTAL_REQUESTS.map(r => <div className="listrow" style={{
              paddingInline: 0
            }}><span className="grow"><b>{L(r.what, r.whatAr)}</b>{" "}<small>{L('submitted', 'قُدّم')}{" "}{fmtDate(r.at)}</small></span>{" "}<button className="btn btn-secondary btn-dense" data-act={`portal-compare:${r.id}`}>{L('Compare', 'مقارنة')}</button>{" "}<button className="btn btn-primary btn-dense" data-act={`portal-accept:${r.id}`}>{L('Accept', 'قبول')}</button></div>)}{" "}<p className="t-caption dim" style={{
              marginTop: "12px"
            }}>{L('Nothing a member submits lands in the record directly. The office reviews every change first.', 'لا شيء يقدّمه المؤمن يدخل السجل مباشرة. يراجع المكتب كل تعديل أولاً.')}</p></> : online ? '' : <Empty glyph='check' title={L('Nothing waiting', 'لا شيء بالانتظار')} body={L('Changes members submit from the portal appear here for review.', 'التعديلات التي يرسلها المؤمنون من البوّابة تظهر هنا للمراجعة.')} />}</>}</Panel>{" "}<div className="sidecol"><Panel title={L('What a member can do', 'ما يستطيع المؤمن فعله')}><ul style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>{[[L('Update their own address, phone and family members', 'تحديث عنوانه وهاتفه وأفراد عائلته'), 'edit'], [L('Manage family registrations where authorised', 'إدارة تسجيلات العائلة حيث يُصرَّح له'), 'family'], [L('Request a sacrament or a certificate, and follow each step', 'طلب سرّ أو شهادة ومتابعة كل خطوة'), 'sacr'], [L('See their own giving statement', 'الاطّلاع على كشف تقدماته'), 'give'], [L('Discover groups and request membership', 'اكتشاف المجموعات وطلب الانتساب'), 'groups'], [L('See their volunteer schedule and registrations', 'رؤية مناوباته وتسجيلاته'), 'vol'], [L('Set their own notification preferences', 'ضبط تفضيلات إشعاراته'), 'bell']].map(([x, i]) => <li className="row" style={{
              gap: "10px",
              alignItems: "flex-start"
            }}><Icon name={i} size={17} cls='dimmer' /><span className="t-caption">{x}</span></li>)}</ul>{" "}<div className="divider" />{" "}<p className="t-caption dim">{L('A member never reaches anyone else’s record, and directory visibility is opt-in per person.', 'لا يصل المؤمن إلى سجل أحد آخر، وظهوره في الدليل اختياري لكل شخص.')}</p></Panel></div></div></>;
  if (tab === 'prayers') return <>{head}<div className="tabbody"><C.InlineAlert tone='info' title={L('A clear handling policy', 'سياسة معالجة واضحة')} body={L('A private request is seen by the priest only and never published. A request offered for the public list is moderated before it appears.', 'النيّة الخاصة يراها الكاهن وحده ولا تُنشر أبداً. والنيّة المعروضة للائحة العامة تُراجَع قبل ظهورها.')} />{" "}<div style={{
        marginTop: "16px"
      }}><Table cols={[{
          label: L('From', 'من')
        }, {
          label: L('Intention', 'النيّة')
        }, {
          label: L('Visibility', 'الظهور'),
          cls: 'shrink'
        }, {
          label: L('Status', 'الحالة'),
          cls: 'shrink'
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={PRAYERS.map(p => ({
          cells: [p.by ? <Who p={person(p.by)} /> : <span className="dim">{L('Anonymous', 'مجهول')}</span>, L(p.body, p.bodyAr), p.vis === 'private' ? <Pill label={L('Private', 'خاصة')} tone='info' mark='lock' /> : <Pill label={L('For the public list', 'للائحة العامة')} />, p.status === 'private' ? <Pill label={L('Priest only', 'للكاهن فقط')} tone='info' mark='lock' /> : <Status k={p.status} />, <span className="row" style={{
            gap: "6px",
            justifyContent: "flex-end"
          }}>{p.status === 'awaiting-approval' ? <button className="btn btn-primary btn-dense" data-act={`prayer-publish:${p.id}`}>{L('Publish', 'نشر')}</button> : ''}{CR.recBtn('prayer', p.id)}</span>]
        }))} empty={<Empty glyph='notes' title={L('No prayer requests', 'لا طلبات صلاة')} body={L('Requests members send from the portal appear here for moderation.', 'الطلبات المرسلة من البوّابة تظهر هنا للمراجعة.')} />} /></div></div></>;
  return <div className="cms-page">{head}{portalContent()}</div>;
}
portal.mount = host => {};