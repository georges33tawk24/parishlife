import { Select } from "../ui/components.jsx";
/* USED: Amount, C, Empty, Icon, PageHead, Paged, Panel, Pill, Stat, Status, TabBar, Table, Who | HTML: nodesOr, css */
import { nodesOr, css, paint } from "../ui/html.js";
/* Modules 1, 15, 16, 17 — eparchy, workflows, reporting, audit, security. */
import { t, isAr, num, usd, fmtDate } from "../../lib/i18n.js";
import { S, ROLES, is, go, bus } from "../model/store.js";
import { Icon, PageHead, Panel, Who, Status, Pill, Table, Empty, Stat, openDrawer, openModal, closeOverlays, toast, TabBar, Amount, openMenu, Paged } from "../ui/ui.jsx";
import * as C from "../ui/components.jsx";
import * as CR from "../flows/crud.jsx";
import { deleteGuard, newPersonDrawer } from "./people.jsx";
import { savedAt, savedSize, persist } from "../model/persist.js";
import { api } from "../model/api.js";
import { WORKFLOWS, RUNS, RUN_LOG, AUDIT, FUNDS, RATE, PARISH, PARISHES, EPARCHY_NEWS, GROUPS, BATCH, SESSIONS, SECURITY_ALERTS, RETENTION, WEBHOOKS, PERMISSIONS, ATTENDANCE_SERIES, GIVING_SERIES, PAYMENT_MIX, VOLUNTEERS, ARCHIVED, PHOTOS, FORM_FIELDS, FORM_RULES, EXCEPTIONS, TODAY, PREFS, GROUP_DETAIL, REGISTRATIONS, REGISTRANTS, CHECKIN, EVENTS, person } from "../model/data.js";
import { FIELD_TYPES } from "../flows/crud.jsx";
import { SCHEMES, schemeOf, palette, readable, applyTheme, isHex } from "../../lib/theme.js";
const L = (en, ar) => t(en, ar);

/* ═══════════ 1 · eparchy ═══════════ */
export function eparchy(tab = '') {
  const head = <><PageHead crumbs={[{
      label: L('Administration', 'الإدارة')
    }, {
      label: L('Eparchy', 'الأبرشية')
    }]} title={L(PARISH.eparchy, PARISH.eparchyAr)} sub={L('Aggregated across the parishes you hold a role in. Restricted parish records are never exposed here by default.', 'مجمَّع عبر الرعايا التي لك دور فيها. ولا تُكشف السجلات المقيّدة هنا افتراضياً.')} actions={<button className="btn btn-secondary" data-act="export"><Icon name='export' size={17} />{L('Export', 'تصدير')}</button>} /><TabBar base='eparchy' items={[['', 'Parishes', 'الرعايا'], ['news', 'Announcements', 'الإعلانات'], ['aggregate', 'Aggregates', 'التجميعات']]} active={tab} /></>;
  if (tab === 'news') return <>{head}<Table cols={[{
      label: L('Announcement', 'الإعلان')
    }, {
      label: L('Date', 'التاريخ')
    }, {
      label: L('Shared with parishes', 'مشترك مع الرعايا'),
      cls: 'shrink'
    }, {
      label: '',
      cls: 'shrink'
    }]} rows={EPARCHY_NEWS.map(n => ({
      cells: [<b>{L(n.title, n.ar)}</b>, <span className="mono dim">{fmtDate(n.at)}</span>, n.shared ? <Pill label={L('Shared', 'مشترك')} tone='success' /> : <Pill label={L('Clergy only', 'للإكليروس فقط')} tone='info' />, <button className="btn btn-secondary btn-dense" data-act={`doc:${L(n.title, n.ar)}`}>{L('Open', 'فتح')}</button>]
    }))} /></>;
  if (tab === 'aggregate') return <>{head}<div className="grid g2"><C.Kpi k={L('People across accessible parishes', 'المؤمنون في الرعايا المتاحة')} v={num(PARISHES.reduce((a, p) => a + p.people, 0))} sub={`${PARISHES.length} ${L('parishes', 'رعايا')}`} />{" "}<C.Kpi k={L(`Sacraments registered, ${new Date().getFullYear()}`, `الأسرار المسجَّلة ${new Date().getFullYear()}`)} v={num(PARISHES.reduce((a, p) => a + (p.sacramentsYear || 0), 0))} sub={L('across accessible registers', 'في السجلات المتاحة')} /></div>{" "}<Panel title={L('Parishioners by parish', 'المؤمنون حسب الرعية')}><C.BarChart rows={PARISHES.map(p => ({
        label: L(p.name, p.ar),
        v: p.people,
        max: 2200,
        text: num(p.people)
      }))} /></Panel>{" "}<C.InlineAlert tone='info' title={L('Small groups are not broken out', 'لا تُفصَّل المجموعات الصغيرة')} body={L('An aggregate never splits a figure so far that an individual could be identified by elimination.', 'لا يقسّم التجميع رقماً إلى حدّ يسمح بتحديد شخص بالاستبعاد.')} /></>;
  return <>{head}{<Table cols={[{
      label: L('Parish', 'الرعية'),
      sort: true
    }, {
      label: L('Town', 'البلدة'),
      cls: 'hide-sm'
    }, {
      label: L('Your role there', 'دورك فيها'),
      cls: 'hide-sm'
    }, {
      label: L('People', 'المؤمنون'),
      cls: 'num',
      sort: true
    }, {
      label: L('Households', 'العائلات'),
      cls: 'num hide-sm'
    }, {
      label: '',
      cls: 'shrink'
    }]} rows={PARISHES.map(p => ({
      cells: [<span className="row" style={{
        gap: "10px"
      }}><span className="avatar">{L(p.name, p.ar).slice(0, 1)}</span>{" "}<b>{L(p.name, p.ar)}</b></span>, <span className="dim">{L(p.town, p.townAr)}</span>, <span className="chip">{L(p.role, p.roleAr)}</span>, <span className="num">{num(p.people)}</span>, <span className="num dim">{num(p.households)}</span>, L(p.name, p.ar) === L(PARISH.name, PARISH.nameAr) ? <Pill label={L('Current', 'الحالية')} tone='success' /> : <button className="btn btn-secondary btn-dense" data-act={`parish-switch:${p.id}`}>{L('Switch to', 'التبديل إليها')}</button>]
    }))} />}{" "}{<C.InlineAlert tone='info' title={L('Every record belongs to one parish', 'كل سجل يخصّ رعية واحدة')} body={L('Groups, facilities, events and financial records are all owned by a parish, and a person’s memberships are recorded explicitly rather than inferred.', 'المجموعات والمرافق والأحداث والسجلات المالية كلها مملوكة لرعية، وانتساب الشخص يُسجَّل صراحةً لا استنتاجاً.')} />}</>;
}
eparchy.mount = host => {};
export function assignments() {
  if (!is('bishop')) return <Empty glyph='shield' title={L('Bishop access required', 'تتطلّب صلاحية المطران')} body={L('Only the bishop can assign parish priests.', 'المطران وحده يعيّن كهنة الرعايا.')} />;
  return <><PageHead crumbs={[{
      label: L('Archdiocese', 'الأبرشية')
    }, {
      label: L('Priest assignments', 'تعيينات الكهنة')
    }]} title={L('Priest assignments', 'تعيينات الكهنة')} sub={L('Read-only view of clergy assignments. Changes are made by an operator on the parish server.', 'عرض تعيينات الكهنة للقراءة فقط. يجري المشغّل التغييرات على خادم الرعية.')} /><div id="assignment-body" className="tabbody"><p className="dim">{L('Loading assignments…', 'جارٍ تحميل التعيينات…')}</p></div></>;
}
assignments.mount = async host => {
  const body = host.querySelector('#assignment-body');
  if (!body) return;
  try {
    const data = await api('assignments');
    paint(body, data.priests.length ? data.priests.map(priest => <section className="panel" style={{
      marginBottom: "16px"
    }} data-priest={priest.id}><div className="panel-h"><h3>{priest.name}</h3></div><div className="panel-b"><div className="stack" style={{
          gap: "10px"
        }}>{nodesOr(data.parishes.filter(p => priest.parishes.includes(p.id)).map(p => <div className="listrow"><span>{L(p.name, p.ar)} · {L(p.town, p.townAr)}</span></div>), <p className="help">{L('No assigned parishes.', 'لا رعايا معيّنة.')}</p>)}</div></div></section>) : <Empty glyph='people' title={L('No priest accounts yet', 'لا حسابات كهنة بعد')} body={L('Create a priest account on the server, then assign its parishes here.', 'أنشئ حساب كاهن على الخادم ثم عيّن رعاياه هنا.')} />);
  } catch (e) {
    paint(body, <div className="alert alert-danger">{e.message}</div>);
  }
};

/* ═══════════ 15 · forms & workflows ═══════════ */
const WTABS = () => [['', 'Workflows', 'المسارات'], ['runs', 'Open tasks', 'المهام المفتوحة', RUNS.length], ['builder', 'Form builder', 'بناء الاستمارة'], ['log', 'Activity log', 'سجل النشاط']];
const wfSteps = w => w && (isAr() ? w.stepsAr : w.steps) || w?.steps || [];
const nameIn = p => p ? L(p.lat, p.ar || p.lat) : '';
const RULE_OPS = {
  '=': ['is', 'هو'],
  '≠': ['is not', 'ليس']
};
export function forms(tab = '') {
  if (tab !== 'runs') S.ui.runWf = ''; // the queue filter belongs to the visit that set it
  const head = <><PageHead crumbs={[{
      label: L('Administration', 'الإدارة')
    }, {
      label: L('Forms & workflows', 'الاستمارات والمسارات')
    }]} title={L('Forms and workflows', 'الاستمارات ومسارات العمل')} sub={L('Each request moves through set steps. Every step has a person responsible and a due date, so nothing is forgotten.', 'يمرّ كل طلب بخطوات محدّدة، ولكل خطوة شخص مسؤول وموعد، فلا يُنسى شيء.')} actions={<>{tab === 'builder' ? '' : <button className="btn btn-secondary" data-go="forms/builder"><Icon name='doc' size={17} />{L('Form templates', 'قوالب الاستمارات')}</button>}{" "}<button className="btn btn-primary" data-act="wf-new"><Icon name='plus' size={17} />{L('New workflow', 'مسار جديد')}</button></>} /><TabBar base='forms' items={WTABS()} active={tab} /></>;
  if (tab === 'runs') {
    const only = WORKFLOWS.find(w => w.id === S.ui.runWf),
      runs = RUNS.filter(r => WORKFLOWS.some(w => w.id === r.wf) && (!only || r.wf === only.id));
    const late = runs.filter(r => r.overdue).length;
    return <>{head}{only ? <div className="toolbar" style={{
        marginBottom: "14px"
      }}><span className="chip chip-on" style={{
          gap: "6px"
        }}><Icon name='filter' size={14} />{L(only.name, only.ar)}</span>{" "}<span className="t-caption dim">{runs.length}{" "}{L('open', 'مفتوحة')}</span>{" "}<button className="btn btn-ghost btn-dense" data-act="wf-queue:">{L('Show every workflow', 'عرض كل المسارات')}</button></div> : ''}{" "}{<Table cols={[{
        label: L('Workflow', 'المسار'),
        sort: true
      }, {
        label: L('For', 'لـ')
      }, {
        label: L('Current step', 'الخطوة الحالية')
      }, {
        label: L('Responsible', 'المسؤول'),
        cls: 'hide-sm'
      }, {
        label: L('Due', 'الموعد'),
        sort: true
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={runs.map(r => {
        const w = WORKFLOWS.find(x => x.id === r.wf),
          steps = wfSteps(w);
        return {
          cls: 'clickable',
          attrs: `data-run="${r.id}" tabindex="0"`,
          cells: [<b>{L(w.name, w.ar)}</b>, r.subject ? <Who p={person(r.subject)} /> : <span className="dim">{L('Parish expense', 'مصروف الرعية')}</span>, <span style={{
            display: "block",
            minWidth: "150px"
          }}><b style={{
              fontWeight: 500
            }}>{steps[r.step] || ''}</b>{" "}<span className="t-caption dim tnum" style={{
              display: "block"
            }}>{L(`Step ${Math.min(r.step + 1, r.total)} of ${r.total}`, `الخطوة ${Math.min(r.step + 1, r.total)} من ${r.total}`)}</span>{" "}<span className="meter" style={{
              marginTop: "6px"
            }}><i style={css(`width:${Math.round(r.step / r.total * 100)}%`)} /></span></span>, <Who p={person(r.owner)} />, r.overdue ? <Pill label={`${fmtDate(r.due)} · ${L('late', 'متأخرة')}`} tone='danger' /> : <span className="mono dim">{fmtDate(r.due)}</span>, <span className="btn btn-secondary btn-dense" aria-hidden="true">{L('Open', 'فتح')}</span>]
        };
      })} empty={<Empty glyph='check' title={L('No open tasks', 'لا مهام مفتوحة')} body={only ? L('Nothing is waiting in this workflow.', 'لا شيء ينتظر في هذا المسار.') : L('Every request has been dealt with.', 'عولجت كل الطلبات.')} />} />}{" "}{late ? <C.InlineAlert tone='warning' title={late === 1 ? L('One task is late', 'مهمّة واحدة متأخرة') : L(`${late} tasks are late`, `${late} مهام متأخرة`)} body={L('The person responsible is reminded. Nothing is ever decided automatically.', 'يُذكَّر الشخص المسؤول. ولا يُتّخذ أي قرار تلقائياً.')} /> : ''}</>;
  }
  if (tab === 'builder') return <>{head}<div className="splitview"><div><Panel title={L('Certificate request form', 'استمارة طلب شهادة')}>{nodesOr(FORM_FIELDS.map(f => <div className="listrow" style={{
            paddingInline: 0,
            alignItems: "flex-start"
          }}><span style={{
              color: "var(--text-3)",
              marginTop: "2px"
            }}><Icon name={f.type === 'file' ? 'doc' : f.type === 'person' ? 'people' : f.type === 'date' ? 'events' : 'forms'} size={17} /></span>{" "}<span className="grow"><b>{L(f.label, f.labelAr)}{f.req ? <span style={{
                  color: "var(--danger)"
                }}>*</span> : ''}</b>{" "}{f.note ? <small style={{
                whiteSpace: "normal"
              }}>{L(f.note, f.noteAr)}</small> : ''}</span>{" "}<span className="chip">{L(...(FIELD_TYPES[f.type] || [f.type, f.type]))}</span>{CR.recBtn('field', f.id, L('Field options', 'خيارات الحقل'))}</div>), <p className="t-caption dim">{L('No fields yet — add the first one.', 'لا حقول بعد — أضف الأول.')}</p>)}{" "}<button className="btn btn-secondary btn-dense" style={{
            marginTop: "14px"
          }} data-act="dom-add-field"><Icon name='plus' size={15} />{L('Add field', 'إضافة حقل')}</button>{" "}<p className="t-caption dim" style={{
            marginTop: "12px"
          }}>{L('Fields marked * must be filled in before the request can be sent.', 'يجب ملء الحقول المعلَّمة بـ* قبل إرسال الطلب.')}</p></Panel></div>{" "}<div className="sidecol"><Panel title={L('Show a field only when…', 'أظهر الحقل فقط حين…')}>{nodesOr(FORM_RULES.map(r => {
            const a = FORM_FIELDS.find(f => f.id === r.show),
              b = FORM_FIELDS.find(f => f.id === r.when);
            return <div className="rulecard"><span className="grow">{L('Show', 'أظهر')}{" "}<b>{a ? L(a.label, a.labelAr) : '—'}</b>{" "}{L('only when', 'فقط حين يكون')}{" "}<b>{b ? L(b.label, b.labelAr) : '—'}</b>{" "}{L(...(RULE_OPS[r.op] || [r.op, r.op]))}{" "}<b>{L(r.value, r.valueAr)}</b></span>{" "}<C.IconBtn ico='close' label={L('Remove rule', 'إزالة القاعدة')} data-act={`rule-del:${r.id}`} /></div>;
          }), <p className="t-caption dim">{L('No rules — every field always shows.', 'لا قواعد — كل الحقول تظهر دائماً.')}</p>)}{" "}<button className="btn btn-secondary btn-dense" style={{
            marginTop: "4px"
          }} data-act="dom-add-rule"><Icon name='plus' size={15} />{L('Add rule', 'إضافة قاعدة')}</button></Panel>{" "}<Panel title={L('Checks before sending', 'تحقّق قبل الإرسال')}><div className="stack" style={{
            gap: "10px"
          }}><C.CheckRow label={L('Required fields must be filled', 'الحقول المطلوبة إلزامية')} checked={true} />{" "}<C.CheckRow label={L('Attachments limited to 10 MB', 'المرفقات حتى ١٠ ميغابايت')} checked={true} />{" "}<C.CheckRow label={L('Refuse the same request twice within 7 days', 'رفض الطلب نفسه مرّتين خلال ٧ أيام')} checked={true} /></div></Panel></div></div></>;
  if (tab === 'log') return <>{head}<Panel title={L('What happened, newest first', 'ما جرى، الأحدث أولاً')}><div className="timeline">{RUN_LOG.map(([when, en, ar, kind]) => <div className={`tl-item ${kind === 'err' ? 'accent' : ''}`}><div className="when">{stampText(when)}</div>{" "}<div className="what">{L(en, ar)}{kind === 'err' && /retry|محاولة/i.test(en + ar) ? <>{<Pill label={L('Retried', 'أُعيدت')} tone='warning' />}</> : ''}</div></div>)}</div></Panel>{" "}<div className="grid g2"><Panel title={L('Pause or resume a workflow', 'إيقاف مسار أو استئنافه')}>{WORKFLOWS.map(w => <div className="listrow" style={{
          paddingInline: 0
        }}><span className="grow"><b>{L(w.name, w.ar)}</b><small>{w.paused ? L('Paused — no new requests start', 'متوقّف — لا تبدأ طلبات جديدة') : L('Running', 'يعمل')}</small></span>{" "}<button className="btn btn-secondary btn-dense" data-act={`wf-pause:${w.id}`}>{w.paused ? L('Resume', 'استئناف') : L('Pause', 'إيقاف مؤقّت')}</button></div>)}{" "}<div className="row" style={{
          gap: "8px",
          marginTop: "14px"
        }}><button className="btn btn-secondary btn-dense" data-act="wf-retry">{L('Retry messages that failed', 'إعادة إرسال الرسائل الفاشلة')}</button></div>{" "}<p className="t-caption dim" style={{
          marginTop: "12px"
        }}>{L('Retrying never sends a message twice: anything already delivered is skipped.', 'إعادة المحاولة لا تُرسل رسالة مرّتين: ما وصل سابقاً يُتخطّى.')}</p></Panel>{" "}<Panel title={L('When something goes wrong', 'حين يتعطّل شيء')}><dl className="dl"><dt>{L('A message fails', 'فشل رسالة')}</dt><dd>{L('Tried again up to 3 times, a little later each time', 'تُعاد حتى ٣ مرّات، بفاصل أطول كل مرّة')}</dd><dt>{L('It still fails', 'إن استمرّ الفشل')}</dt><dd>{L('The workflow stops and tells the person responsible', 'يتوقّف المسار ويُبلغ المسؤول')}</dd><dt>{L('Sensitive steps', 'الخطوات الحسّاسة')}</dt><dd>{L('Always wait for a person', 'تنتظر شخصاً دائماً')}</dd></dl></Panel></div></>;
  const cards = WORKFLOWS.map(w => {
    const steps = wfSteps(w),
      open = RUNS.filter(r => r.wf === w.id).length;
    return <section className="panel"><div className="panel-b"><div className="row" style={{
          gap: "10px",
          alignItems: "flex-start"
        }}><span className="avatar avatar-lg"><Icon name='forms' size={20} /></span>{" "}<div style={{
            flex: 1,
            minWidth: 0
          }}><b style={{
              display: "block",
              font: "600 16px/22px var(--sans)"
            }}>{L(w.name, w.ar)}</b>{" "}<small className="t-caption dim">{L('usually takes', 'يستغرق عادةً')}{" "}{L(w.avg, w.avgAr)}</small></div>{" "}{w.paused ? <Pill label={L('Paused', 'متوقّف')} tone='warning' mark='st-pause' /> : ''}<span className={`badge ${open ? '' : 'badge-quiet'}`} title={L('Open tasks', 'مهام مفتوحة')}>{open}</span>{CR.recBtn('workflow', w.id)}</div>{" "}<div className="divider" />{" "}<ol className="wfsteps">{steps.map((st, i) => <li><span className="n">{i + 1}</span>{st}</li>)}</ol>{" "}<button className="btn btn-secondary" style={{
          width: "100%",
          marginTop: "14px",
          minHeight: "34px",
          fontSize: "13px"
        }} data-act={`wf-queue:${w.id}`}>{open ? L(`See ${open} open task${open === 1 ? '' : 's'}`, `عرض المهام المفتوحة (${open})`) : L('No open tasks', 'لا مهام مفتوحة')}</button></div></section>;
  });
  const late = RUNS.filter(r => r.overdue),
    lateW = late[0] && WORKFLOWS.find(w => w.id === late[0].wf);
  return <>{head}<div className="stats"><Stat k={L('Open tasks', 'مهام مفتوحة')} v={RUNS.length} d={L(`in ${new Set(RUNS.map(r => r.wf)).size} workflows`, `في ${new Set(RUNS.map(r => r.wf)).size} مسارات`)} />{" "}<Stat k={L('Late', 'متأخرة')} v={late.length} d={late.length ? <span className="down">{L(lateW?.name || '', lateW?.ar || '')} · {fmtDate(late[0].due)}</span> : L('nothing is late', 'لا شيء متأخر')} />{" "}<Stat k={L('Finished this month', 'أُنجزت هذا الشهر')} v={27} d={L('usually within 2 days', 'عادةً خلال يومين')} />{" "}<Stat k={L('Automatic steps', 'خطوات تلقائية')} v={4} d={L('a person always checks the result', 'يراجع شخصٌ النتيجة دائماً')} /></div>{" "}<Paged className="gridcards">{cards}</Paged>{" "}<C.InlineAlert tone='info' title={L('Sensitive decisions always stop for a person', 'القرارات الحسّاسة تتوقّف دائماً عند شخص')} body={L('Pastoral, safeguarding, financial and disciplinary steps are never completed automatically, however routine they look. Automation may prepare the work; it never decides it.', 'لا تُنجَز الخطوات الرعوية والحمائية والمالية والتأديبية تلقائياً مهما بدت روتينية. للأتمتة أن تُحضّر العمل لا أن تقرّره.')} /></>;
}

/* One open task: its steps, who is responsible, and the next action. Also reopened after
   "Keep the task" in the cancel confirmation. */
/* "2026-10-04 11:02" as people read it: 4 Oct 2026 · 11:02 */
const stampText = v => `${fmtDate(String(v).slice(0, 10))}${String(v).length > 10 ? ` · ${String(v).slice(11, 16)}` : ''}`;
export function openRun(id) {
  const r = RUNS.find(x => x.id === id),
    w = r && WORKFLOWS.find(x => x.id === r.wf);
  if (!w) return;
  const steps = wfSteps(w),
    owner = person(r.owner);
  openDrawer({
    title: L(w.name, w.ar),
    sub: r.subject ? nameIn(person(r.subject)) : L('Parish expense', 'مصروف الرعية'),
    body: <><ol className="runsteps">{steps.map((st, i) => <li className={i < r.step ? 'done' : i === r.step ? 'now' : ''}><span className="dot" aria-hidden="true">{i < r.step ? <Icon name='check' size={13} /> : i + 1}</span>{" "}<span className="grow"><b>{st}</b><small>{i < r.step ? `${L('Done', 'أُنجزت')}${r.doneAt?.[i] ? ` · ${stampText(r.doneAt[i])}` : ''}` : i === r.step ? `${L('Current step', 'الخطوة الحالية')}${r.doneAt?.[i - 1] ? ` · ${L('waiting since', 'بانتظار منذ')} ${stampText(r.doneAt[i - 1])}` : ''}` : L('Still to come', 'لاحقاً')}</small></span></li>)}</ol>{" "}<div className="divider" />{" "}<dl className="dl"><dt>{L('Responsible', 'المسؤول')}</dt><dd>{nameIn(owner) || '—'}</dd><dt>{L('Due', 'الموعد')}</dt><dd>{fmtDate(r.due)}{r.overdue ? <> · <span style={{
              color: "var(--danger-ink)",
              fontWeight: 600
            }}>{L('late', 'متأخرة')}</span></> : ''}</dd><dt>{L('If it runs late', 'إن تأخّرت')}</dt><dd>{L('Fr. Antoine Khoury is reminded after 2 days', 'يُذكَّر الأب أنطوان خوري بعد يومين')}</dd></dl>{" "}<div style={{
        marginTop: "18px"
      }}><C.Textarea label={L('Note for the next person (optional)', 'ملاحظة لمن يتابع (اختياري)')} id='runnote' max={300} /></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-danger-quiet" data-act={`wf-cancel:${r.id}`}>{L('Cancel task', 'إلغاء المهمّة')}</button>{" "}<button className="btn btn-primary" id="run_go" style={{
        marginInlineStart: "auto"
      }} data-act={`run-step:${r.id}`}><Icon name='check' size={16} />{r.step + 1 >= r.total ? L('Finish task', 'إنهاء المهمّة') : L('Mark step done', 'إنجاز الخطوة')}</button></>,
    onMount(el) {
      /* start on the steps, not in the note: on a phone, focusing the note would scroll past them and
         open the keyboard. Focus rests on the dialog itself, so no key press completes a step by accident. */
      el.querySelector('.drawer-body').scrollTop = 0;
      el.tabIndex = -1;
      el.focus({
        preventScroll: true
      });
    }
  });
}
forms.mount = host => {
  host.querySelectorAll('tr[data-run]').forEach(tr => {
    tr.addEventListener('click', () => openRun(tr.dataset.run));
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openRun(tr.dataset.run);
      }
    });
  });
};

/* ═══════════ 16 · reporting ═══════════ */
const REPORTS = [['attendance', 'attend', 'Group meeting attendance', 'حضور اجتماعات المجموعات', 'Recorded attendance at group meetings and activities only', 'حضور مسجّل في اجتماعات المجموعات وأنشطتها فقط'], ['membership', 'people', 'Membership records', 'سجلات الانتساب', 'Current and archived parish records', 'سجلات الرعية الحالية والمؤرشفة'], ['groups', 'groups', 'Group participation', 'مشاركة المجموعات', 'Roster size, attendance rate, course completion', 'حجم اللائحة ونسبة الحضور وإتمام الدورات'], ['volunteers', 'vol', 'Volunteer workload', 'عبء المتطوّعين', 'Availability, conflicts, who is serving too often', 'التوفّر والتعارضات ومن يخدم كثيراً'], ['facilities', 'rooms', 'Facility utilisation', 'استخدام المرافق', 'Hours booked, refusals, equipment loans', 'ساعات الحجز والرفض وإعارات التجهيزات'], ['giving', 'give', 'Giving trends', 'اتجاهات التقدمات', 'By fund, by currency, with the rate applied', 'حسب الصندوق والعملة، مع السعر المطبَّق'], ['budget', 'fin', 'Budget and expenses', 'الموازنة والمصاريف', 'Budget against actual, approvals, reconciliation', 'الموازنة مقابل الفعلي والموافقات والمطابقة'], ['capacity', 'registr', 'Registration versus attendance', 'التسجيل مقابل الحضور', 'Unused capacity on events people signed up for', 'السعة غير المستعملة في الأحداث المسجَّل لها']];
export function reports(id = '') {
  if (id) return reportDetail(id);
  return <><PageHead crumbs={[{
      label: L('Administration', 'الإدارة')
    }, {
      label: L('Reports', 'التقارير')
    }]} title={L('Reporting and analytics', 'التقارير والتحليلات')} sub={L('Every report is filtered to what you are allowed to see, and says which period and which definition it used.', 'كل تقرير مرشَّح بحسب ما يحقّ لك الاطّلاع عليه، ويذكر الفترة والتعريف المستعملين.')} actions={<><button className="btn btn-secondary" data-act="export"><Icon name='export' size={17} />{L('Export PDF / Excel / CSV', 'تصدير PDF / Excel / CSV')}</button>{" "}<button className="btn btn-primary" id="sched"><Icon name='clock' size={17} />{L('Scheduled delivery', 'إرسال مجدول')}</button></>} />{" "}<Paged className="gridcards">{REPORTS.map(([slug, ic, en, ar, se, sa]) => <a className="panel" href={`#/reports/${slug}`} style={{
        display: "block"
      }}><div className="panel-b"><div className="row" style={{
            gap: "10px",
            alignItems: "flex-start"
          }}><span className="avatar avatar-lg"><Icon name={ic} size={20} /></span>{" "}<span style={{
              flex: 1,
              minWidth: 0
            }}><b style={{
                display: "block",
                font: "600 15px/21px var(--sans)"
              }}>{L(en, ar)}</b>{" "}<small className="t-caption dim" style={{
                display: "block",
                marginTop: "3px"
              }}>{L(se, sa)}</small></span>{" "}<span className="dimmer"><Icon name='chevR' size={16} /></span></div></div></a>)}</Paged>{" "}<C.InlineAlert tone='info' title={L('What these numbers are, and are not', 'ما هي هذه الأرقام وما ليست')} body={L('Individual attendance reports cover group meetings and activities. Event check-in requires a selected eligible event. Individual attendance at Masses and feast-day liturgies is not recorded.', 'تشمل تقارير الحضور اجتماعات المجموعات وأنشطتها. يتطلّب تسجيل الوصول حدثاً مؤهّلاً محدداً. لا يُسجّل حضور الأفراد في القداديس وليتورجيات الأعياد.')} /></>;
}

/* The period scales what is counted over time (visitors, gifts, hours, joins); averages move a little.
   Group rosters and event registrations are a snapshot, so those two reports have no period. */
const PERIODS = [['This month', 'هذا الشهر', '2026-10-01', 0.11, 1.03], ['This year', 'هذه السنة', '2026-01-01', 1, 1], ['Since Easter', 'منذ الفصح', '2026-04-05', 0.66, 0.98]];
const SNAPSHOT = ['groups', 'capacity'],
  MONEY = ['giving', 'budget'];
function reportDetail(slug) {
  const r = REPORTS.find(x => x[0] === slug) || REPORTS[0];
  const pi = S.ui.repPeriod ?? 1,
    [pen, par, from, k, a] = PERIODS[pi];
  const fund = MONEY.includes(r[0]) && FUNDS.find(f => f.id === S.ui.repFund) || null;
  const funds = fund ? [fund] : FUNDS;
  const sc = n => Math.round(n * k),
    av = n => Math.round(n * a);
  const bars = (items, max) => <C.BarChart rows={items.map(([label, v]) => ({
    label,
    v: sc(v),
    max: sc(max),
    text: num(sc(v))
  }))} />;
  const filters = <div className="toolbar">{SNAPSHOT.includes(r[0]) ? <span className="chip"><Icon name='clock' size={14} />{L('As of', 'حتى')}{" "}{fmtDate(TODAY)}</span> : <C.BGroup items={PERIODS.map(p => L(p[0], p[1]))} sel={pi} k='repPeriod' />}{" "}{MONEY.includes(r[0]) ? <Select style={{
      width: "auto"
    }} id="repfund" aria-label={L('Fund', 'الصندوق')}><option value="">{L('All funds', 'كل الصناديق')}</option>{FUNDS.map(f => <option value={f.id} selected={!!(fund === f)}>{L(f.name, f.ar)}</option>)}</Select> : ''}{" "}<div style={{
      marginInlineStart: "auto",
      display: "flex",
      gap: "6px"
    }}><button className="btn btn-secondary btn-dense" data-act="pdf"><Icon name='export' size={15} />PDF</button>{" "}<button className="btn btn-secondary btn-dense" data-act="export"><Icon name='export' size={15} />Excel</button>{" "}<button className="btn btn-secondary btn-dense" data-act="export"><Icon name='export' size={15} />CSV</button></div></div>;
  const inPeriod = L(['this month', 'this year', 'since Easter'][pi], ['هذا الشهر', 'هذه السنة', 'منذ الفصح'][pi]);
  const given = funds.reduce((n, f) => n + f.actual, 0);
  const body = {
    attendance: () => <Panel title={L('Group meetings and activities', 'اجتماعات المجموعات وأنشطتها')}><Table cols={[{
        label: L('Group', 'المجموعة')
      }, {
        label: L('Meeting', 'الاجتماع')
      }, {
        label: L('Present', 'حاضر')
      }, {
        label: L('Excused', 'معذور')
      }, {
        label: L('Absent', 'غائب')
      }]} rows={GROUPS.flatMap(g => (GROUP_DETAIL[g.id]?.meetings || []).filter(m => m.d >= from && m.d <= new Date().toISOString().slice(0, 10)).map(m => {
        const values = Object.values(m.attendance || {});
        return {
          cells: [L(g.name, g.ar), fmtDate(m.d), values.filter(v => v === 'present').length, values.filter(v => v === 'excused').length, values.filter(v => v === 'absent').length]
        };
      }))} /></Panel>,
    giving: () => <><div className="grid g2"><C.Kpi k={`${L('Given', 'المعطى')} ${inPeriod}`} v={usd(sc(given))} sub={`L.L ${num(sc(given) * RATE.value)}`} delta={fund ? L(fund.name, fund.ar) : L('All funds', 'كل الصناديق')} spark={GIVING_SERIES} />{" "}<Panel title={L('How people give', 'كيف يُعطي الناس')}><C.Donut segments={PAYMENT_MIX.map(p => ({
            ...p,
            label: isAr() ? p.labelAr : p.label
          }))} /></Panel></div>{" "}<Panel title={L('By fund', 'حسب الصندوق')}><C.BarChart rows={funds.map(f => ({
          label: L(f.name, f.ar),
          v: sc(f.actual),
          max: sc(f.budget),
          text: usd(sc(f.actual))
        }))} /></Panel></>,
    volunteers: () => <Panel title={`${L('Service hours', 'ساعات الخدمة')} · ${inPeriod}`}>{bars(VOLUNTEERS.map(v => [isAr() ? person(v.p).ar : person(v.p).lat, v.hours]), 140)}</Panel>,
    groups: () => <Panel title={L('Participation by group', 'المشاركة حسب المجموعة')}><C.BarChart rows={GROUPS.slice(0, 6).map(g => ({
        label: L(g.name, g.ar),
        v: g.members,
        max: 45,
        text: String(g.members)
      }))} /></Panel>,
    budget: () => <Panel title={`${L('Budget against actual', 'الموازنة مقابل الفعلي')} · ${inPeriod}`}><C.BarChart rows={funds.map(f => ({
        label: L(f.name, f.ar),
        v: sc(f.actual),
        max: sc(f.budget),
        text: `${usd(sc(f.actual))} / ${usd(sc(f.budget))}`
      }))} /></Panel>,
    capacity: () => <Panel title={L('Event registration and check-in', 'التسجيل في الأحداث والوصول إليها')}><Table cols={[{
        label: L('Event', 'الحدث')
      }, {
        label: L('Registered', 'مسجّل')
      }, {
        label: L('Checked in', 'سجّل وصوله')
      }]} rows={REGISTRATIONS.filter(r => EVENTS.some(e => e.id === r.eventId && e.kind !== 'mass' && !e.liturgy && !e.feastLiturgy)).map(r => ({
        cells: [L(r.event, r.eventAr), REGISTRANTS.filter(p => p.registrationId === r.id).length, (CHECKIN.sessions?.[r.eventId]?.rows || []).length]
      }))} /></Panel>,
    membership: () => <Panel title={`${L('Membership records', 'سجلات الانتساب')} · ${inPeriod}`}>{bars([[L('Current records', 'السجلات الحالية'), PARISH.people], [L('Archived records', 'السجلات المؤرشفة'), ARCHIVED.length]], Math.max(1, PARISH.people, ARCHIVED.length))}</Panel>,
    facilities: () => <Panel title={`${L('Room utilisation', 'استخدام القاعات')} · ${inPeriod}`}><C.BarChart rows={[[L('Parish Hall', 'قاعة الرعية'), 68], [L('Meeting Room 1', 'قاعة اجتماعات ١'), 41], [L('Catechism Room A', 'صف التعليم أ'), 88], [L('Courtyard', 'ساحة الكنيسة'), 22]].map(([label, v]) => ({
        label,
        v: Math.min(av(v), 100),
        max: 100,
        text: `${Math.min(av(v), 100)}%`
      }))} /></Panel>
  }[slug] || (() => <Panel title={L('Report', 'تقرير')}><Empty glyph='reports' title={L('Nothing for this period', 'لا شيء لهذه الفترة')} body='' /></Panel>);
  return <>{<PageHead crumbs={[{
      label: L('Reports', 'التقارير'),
      href: '#/reports'
    }, {
      label: L(r[2], r[3])
    }]} title={L(r[2], r[3])} sub={L(r[4], r[5])} actions={<><button className="btn btn-secondary" data-go="reports"><Icon name='chevL' size={17} />{L('All reports', 'كل التقارير')}</button>{" "}<button className="btn btn-primary" id="sched"><Icon name='clock' size={17} />{L('Schedule', 'جدولة')}</button></>} />}{" "}{filters}{" "}{body()}{" "}{<Panel title={L('Definitions and period', 'التعاريف والفترة')}><dl className="dl"><dt>{L('Period', 'الفترة')}</dt><dd>{SNAPSHOT.includes(r[0]) ? `${L('As of', 'حتى')} ${fmtDate(TODAY)}` : `${fmtDate(from)} – ${fmtDate(TODAY)}`}</dd>{fund ? <><dt>{L('Fund', 'الصندوق')}</dt><dd>{L(fund.name, fund.ar)}</dd></> : ''}<dt>{L('Counted by', 'من يعدّ')}</dt><dd>{L('An usher, at the offertory', 'مُرشد، عند التقدمة')}</dd><dt>{L('Excludes', 'يستثني')}</dt><dd>{L('Groups smaller than five, so no individual can be identified', 'المجموعات الأصغر من خمسة، كي لا يُعرَّف شخص')}</dd><dt>{L('Your scope', 'نطاقك')}</dt><dd>{L(PARISH.name, PARISH.nameAr)}{" "}{L('only', 'فقط')}</dd></dl></Panel>}</>;
}
reports.mount = host => {
  host.querySelector('#repfund')?.addEventListener('change', e => {
    S.ui.repFund = e.target.value;
    bus.refresh();
  });
  host.querySelector('#sched')?.addEventListener('click', () => openModal({
    title: L('Scheduled delivery', 'إرسال مجدول'),
    sub: L('The report is generated and sent on a schedule, filtered to each recipient’s own permissions.', 'يُولَّد التقرير ويُرسَل وفق جدول، مرشَّحاً بحسب صلاحيات كل مستلم.'),
    body: <><div className="formgrid"><div className="formrow"><label className="label">{L('Every', 'كل')}</label>{" "}<Select><option>{L('Month', 'شهر')}</option><option>{L('Quarter', 'فصل')}</option><option>{L('Week', 'أسبوع')}</option></Select></div>{" "}<div className="formrow"><label className="label">{L('Format', 'الصيغة')}</label>{" "}<Select><option>PDF</option><option>Excel</option><option>CSV</option></Select></div></div>{" "}<C.PersonPicker label={L('Send to', 'إرسال إلى')} id='schedp' /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" data-act="report-schedule">{L('Schedule', 'جدولة')}</button></>,
    onMount(el) {}
  }));
};

/* ═══════════ audit ═══════════ */
export function audit() {
  const KINDS = {
    approve: [L('Approval', 'موافقة'), 'success'],
    create: [L('Created', 'إنشاء'), 'info'],
    publish: [L('Published', 'نشر'), 'info'],
    settings: [L('Setting', 'إعداد'), 'info'],
    error: [L('Failure', 'فشل'), 'danger'],
    sensitive: [L('Sensitive access', 'وصول حسّاس'), 'warning']
  };
  const ONLY = [null, 'approve', 'sensitive', 'error'],
    kind = S.ui.auditKind || 0;
  return <><PageHead crumbs={[{
      label: L('Administration', 'الإدارة')
    }, {
      label: L('Audit trail', 'سجل التدقيق')
    }]} title={L('Audit trail', 'سجل التدقيق')} sub={L('Who did what, and when. Available to authorized clergy and administrators in this parish. Audit records cannot be edited.', 'من فعل ماذا ومتى. متاح للكهنة والمديرين المخوّلين في الرعية. لا يمكن تعديل سجل التدقيق.')} actions={<button className="btn btn-secondary" data-act="export"><Icon name='export' size={17} />{L('Export', 'تصدير')}</button>} />{" "}<div className="toolbar"><div className="grow" style={{
        maxWidth: "300px"
      }}><C.SearchClear ph={L('Person or action', 'الشخص أو الإجراء')} id='asearch' data-find="" /></div>{" "}<C.BGroup items={[L('All', 'الكل'), L('Approvals', 'الموافقات'), L('Sensitive access', 'وصول حسّاس'), L('Failures', 'الإخفاقات')]} sel={kind} k='auditKind' /></div>{" "}<Table cols={[{
      label: L('When', 'الوقت'),
      cls: 'hide-sm',
      sort: true
    }, {
      label: L('Who', 'من'),
      cls: 'hide-md'
    }, {
      label: L('What', 'ماذا')
    }, {
      label: L('Kind', 'النوع'),
      cls: 'shrink'
    }]} rows={AUDIT.filter(a => !kind || a.kind === ONLY[kind]).map(a => ({
      attrs: 'data-find-item',
      cells: [<span className="mono dim" dir="ltr">{a.at}</span>, a.who && person(a.who) ? <Who p={person(a.who)} /> : a.actorName || '—', L(a.what, a.whatAr), <Pill label={KINDS[a.kind][0]} tone={KINDS[a.kind][1]} />]
    }))} empty={<Empty glyph='shield' title={L('Nothing of this kind was recorded', 'لم يُسجَّل شيء من هذا النوع')} body={L('Choose All to see every event.', 'اختر «الكل» لرؤية كل الأحداث.')} />} />{" "}<div className="find-empty" hidden><Empty glyph='search' title={L('No event matches', 'لا حدث يطابق')} body={L('Try a name, or part of the action.', 'جرّب اسماً أو جزءاً من الإجراء.')} /></div>{" "}<C.InlineAlert tone='info' title={L('Opening a restricted record is itself an event', 'فتح سجل مقيّد هو بحدّ ذاته حدث')} body={L('Staff are told this when the permission is granted, not discovered afterwards.', 'يُبلَّغ الموظّفون بذلك عند منح الصلاحية، لا يكتشفونه لاحقاً.')} /></>;
}
audit.mount = host => {};

/* ═══════════ 17 · settings & security ═══════════ */
const SETTABS = () => [['', 'Parish', 'الرعية'], ['appearance', 'Colours', 'الألوان'], ['currency', 'Currency', 'العملة'], ['languages', 'Languages', 'اللغات'], ['modules', 'Modules', 'الوحدات'], ['roles', 'Roles & permissions', 'الأدوار والصلاحيات'], ['security', 'Security', 'الأمان'], ['data', 'Data & retention', 'البيانات والحفظ'], ['api', 'API & webhooks', 'الواجهة البرمجية']];
export function settings(tab = '') {
  const head = <><PageHead crumbs={[{
      label: L('Administration', 'الإدارة')
    }, {
      label: L('Settings', 'الإعدادات')
    }]} title={L('Parish settings', 'إعدادات الرعية')} sub={L('Branding, enabled modules, languages, currency, permissions and local workflow rules.', 'الهوية والوحدات المفعّلة واللغات والعملة والصلاحيات وقواعد العمل المحلية.')} actions={tab === 'appearance' ? '' : <button className="btn btn-primary" data-act="settings-save"><Icon name='check' size={17} />{L('Save changes', 'حفظ التعديلات')}</button>} /><TabBar base='settings' items={SETTABS()} active={tab} /></>;
  const T = {
    '': () => <div className="splitview"><div className="stack" style={{
        gap: "16px"
      }}><Panel title={L('Parish', 'الرعية')}><div className="formgrid"><C.Field label={L('Name (English)', 'الاسم (إنكليزي)')} value={PARISH.name} />{" "}<C.Field label={L('Name (Arabic)', 'الاسم (عربي)')} value={PARISH.nameAr} dir='rtl' ar={true} />{" "}<C.Field label={L('Eparchy', 'الأبرشية')} value={L(PARISH.eparchy, PARISH.eparchyAr)} />{" "}<C.Field label={L('Patron saint', 'الشفيع')} value={L('Saint Elias the Prophet', 'مار الياس النبي')} /></div>{" "}<C.RiteSelect />{" "}<C.Field label={L('Phone', 'الهاتف')} value={PARISH.phone} dir='ltr' />{" "}<C.Field label={L('Address', 'العنوان')} value={L(PARISH.address, PARISH.addressAr)} /></Panel>{" "}<Panel title={L('Branding', 'الهوية')}><C.AvatarUpload k='parish' />{" "}<div className="scheme-current"><span className="scheme-dot" aria-hidden="true" />{" "}<span className="grow"><b>{L('Personal appearance', 'المظهر الشخصي')}</b><small>{L('Choose your own dashboard palette in My account. Public websites share one theme.', 'اختر ألوان حسابك في حسابي. للمواقع العامة مظهر موحّد.')}</small></span>{" "}<a className="btn btn-secondary btn-dense" href="#/account">{L('Change colours', 'تغيير الألوان')}</a></div></Panel></div>{" "}<div className="sidecol"><Panel title={L('Clergy and staff', 'الإكليروس والموظّفون')} tight={true}>{['p17', 'p18', 'p4', 'p15'].map(id => <div className="listrow" style={{
            paddingInline: 0
          }}><Who p={person(id)} />{" "}<span className="grow" /><C.IconBtn ico='edit' label={L('Edit', 'تعديل')} data-act={`person-edit:${id}`} /></div>)}</Panel></div></div>,
    appearance: () => <Panel title={L('Personal appearance', 'المظهر الشخصي')}><p>{L('Each user chooses their own dashboard colors and light or dark mode.', 'يختار كل مستخدم ألوان حسابه والوضع الفاتح أو الداكن.')}</p><a className="btn btn-primary" href="#/account">{L('Open my account', 'افتح حسابي')}</a></Panel>,
    currency: () => <div className="splitview"><div><Panel title={L('Currency and rate', 'العملة والسعر')}><div className="formgrid"><div className="formrow"><label className="label">{L('Leading currency', 'العملة الأساسية')}</label>{" "}<Select data-pref="cur.lead" aria-label={L('Leading currency', 'العملة الأساسية')}><option>USD</option><option>L.L</option></Select></div>{" "}<C.Field label={L('Rate (lira to the dollar)', 'السعر (ليرة للدولار)')} value={num(RATE.value)} dir='ltr' state={is('priest', 'treasurer', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin') ? '' : 'disabled'} /></div>{" "}<p className="help">{L('Changing the rate applies to new records only. Everything already recorded keeps the rate it was created with.', 'تغيير السعر يسري على السجلات الجديدة فقط. وما سُجّل يحتفظ بالسعر الذي أُنشئ به.')}</p>{" "}<div className="stack" style={{
            gap: "12px",
            marginTop: "16px"
          }}><C.SwitchRow label={L('Warn when the rate is more than 7 days old', 'نبّهني حين يتجاوز عمر السعر ٧ أيام')} checked={true} pref='cur.warn' />{" "}<C.SwitchRow label={L('Show both currencies on every amount', 'إظهار العملتين على كل مبلغ')} checked={true} pref='cur.both' />{" "}<C.SwitchRow label={L('Keep lira gifts as lira, never convert on entry', 'إبقاء تقدمات الليرة ليرة، بلا تحويل عند الإدخال')} checked={true} pref='cur.keepLira' /></div></Panel></div>{" "}<div className="sidecol"><Panel title={L('Rate history', 'سجل الأسعار')}><div className="timeline">{[['89,500', '4 Oct 2026', 'p17'], ['89,200', '12 Sep 2026', 'p15'], ['90,100', '3 Aug 2026', 'p15']].map(([v, d, p], i) => <div className={`tl-item ${i === 0 ? 'accent' : ''}`}><div className="when">{d} · {isAr() ? person(p).ar : person(p).lat}</div>{" "}<div className="what"><b className="mono">{v}</b> L.L / $</div></div>)}</div></Panel></div></div>,
    languages: () => <div className="splitview"><div><Panel title={L('Interface languages', 'لغات الواجهة')}><div className="stack" style={{
            gap: "12px"
          }}><C.CheckRow label={L('English', 'الإنكليزية')} checked={true} pref='lang.en' />{" "}<C.CheckRow label={L('Arabic — with full right-to-left mirroring', 'العربية — مع انعكاس كامل من اليمين إلى اليسار')} checked={true} pref='lang.ar' />{" "}<C.CheckRow label={L('French', 'الفرنسية')} note={L('interface strings not yet translated', 'نصوص الواجهة غير مترجمة بعد')} pref='lang.fr' /></div>{" "}<div className="divider" />{" "}<h4 className="t-ui" style={{
            marginBottom: "10px"
          }}>{L('Certificates', 'الشهادات')}</h4>{" "}<p className="help" style={{
            marginBottom: "12px"
          }}>{L('Certificates can be issued bilingual or trilingual independently of the interface language.', 'يمكن إصدار الشهادات بلغتين أو ثلاث بمعزل عن لغة الواجهة.')}</p>{" "}<span data-pref-group="cert.langs"><C.BGroup items={[L('Arabic', 'عربي'), L('Bilingual', 'ثنائي'), L('Trilingual', 'ثلاثي')]} sel={PREFS['cert.langs'] ?? 1} /></span></Panel></div>{" "}<div className="sidecol"><Panel title={L('Liturgical calendar', 'الرزنامة الطقسية')}><Select data-pref="cal.rite" aria-label={L('Liturgical calendar', 'الرزنامة الطقسية')}><option value="maronite">{L('Maronite', 'مارونية')}</option><option value="melkite">{L('Melkite', 'روم كاثوليك')}</option><option value="orthodox">{L('Greek Orthodox', 'روم أرثوذكس')}</option><option value="armenian">{L('Armenian', 'أرمنية')}</option></Select>{" "}<p className="help" style={{
            marginTop: "10px"
          }}>{L('The calendar in use must be approved by the parish. Feast days drive the gold markers everywhere in the product.', 'يجب أن توافق الرعية على الرزنامة المستعملة. والأعياد تقود العلامات الذهبية في كل المنتج.')}</p></Panel></div></div>,
    modules: () => <div style={{
      maxWidth: "760px"
    }}><Panel title={L('Enabled modules', 'الوحدات المفعّلة')}><div className="stack" style={{
          gap: "12px"
        }}>{[[L('Sacramental registers', 'سجلات الأسرار'), true], [L('Giving and finance', 'التقدمات والمالية'), true], [L('Child check-in and safeguarding', 'تسجيل الأطفال والحماية'), true], [L('Music library', 'مكتبة الألحان'), true], [L('Member portal', 'بوّابة المؤمنين'), true], [L('Facilities and reservations', 'المرافق والحجوزات'), true], [L('Volunteer scheduling', 'جدولة المتطوّعين'), true], [L('Online payments', 'الدفع الإلكتروني'), false], [L('AI assistance', 'مساعدة الذكاء الاصطناعي'), false]].map(([l, on], i) => <C.SwitchRow label={l} checked={on} pref={`mod.${i}`} />)}</div>{" "}<p className="help" style={{
          marginTop: "14px"
        }}>{L('A module that is switched off disappears from every rail, for every role.', 'الوحدة المعطَّلة تختفي من كل شريط ولكل دور.')}</p></Panel></div>,
    roles: () => <div className="splitview"><div><Panel title={L('Permission matrix', 'مصفوفة الصلاحيات')} tight={true}><div className="tablescroll"><table className="tbl"><thead><tr><th>{L('Action', 'الإجراء')}</th>{Object.values(ROLES).map(r => <th style={{
                    textAlign: "center"
                  }}>{L(r.en, r.ar)}</th>)}</tr></thead><tbody>{PERMISSIONS.map(([code, en, ar, roles]) => <tr><td><b style={{
                      font: "500 13px/18px var(--sans)"
                    }}>{L(en, ar)}</b>{" "}<small className="t-caption mono dimmer" style={{
                      display: "block"
                    }}>{code}</small></td>{Object.keys(ROLES).map(k => <td style={{
                    textAlign: "center"
                  }}>{roles.includes(k) ? <span style={{
                      color: "var(--success)"
                    }}><Icon name='check' size={17} /></span> : <span className="dimmer">—</span>}</td>)}</tr>)}</tbody></table></div></Panel></div>{" "}<div className="sidecol"><Panel title={L('Roles', 'الأدوار')} tight={true}>{Object.entries(ROLES).map(([k, r]) => <div className="listrow" style={{
            paddingInline: 0,
            alignItems: "flex-start"
          }}><span className="grow"><b>{L(r.en, r.ar)}</b><small style={{
                whiteSpace: "normal"
              }}>{L(r.noteEn, r.noteAr)}</small></span>{" "}<span className="badge badge-quiet">{r.nav.filter(n => n[0] === 'l').length}</span></div>)}</Panel>{" "}<Panel title={L('Exceptions', 'الاستثناءات')}><p className="t-body dim" style={{
            fontSize: "14px"
          }}>{L('A named person can be granted or denied a single action. An explicit deny always beats a role grant, and every exception carries a reason and a review date.', 'يمكن منح شخص مسمّى إجراءً واحداً أو حرمانه منه. والمنع الصريح يتقدّم دائماً على منح الدور، ولكل استثناء سبب وتاريخ مراجعة.')}</p>{" "}{EXCEPTIONS.map(x => <div className="listrow" style={{
            paddingInline: 0,
            marginTop: "10px"
          }}><Who p={person(x.p)} />{" "}<span className="grow" /><Pill label={`${x.effect} ${x.action}`} tone={x.effect === '+' ? 'success' : 'danger'} />{" "}<C.IconBtn ico='close' label={L('Remove exception', 'إزالة الاستثناء')} data-act={`exception-del:${x.id}`} /></div>)}{" "}<button className="btn btn-secondary btn-dense" style={{
            marginTop: "10px"
          }} data-act="perm-exception"><Icon name='plus' size={15} />{L('Add exception', 'إضافة استثناء')}</button></Panel></div></div>,
    security: () => <div className="splitview"><div className="stack" style={{
        gap: "16px"
      }}><Panel title={L('Authentication', 'المصادقة')}><div className="stack" style={{
            gap: "12px"
          }}><C.SwitchRow label={L('Two-factor for administrators', 'تحقّق بخطوتين للمدراء')} checked={true} pref='sec.2fa' />{" "}<C.SwitchRow label={L('Sign out after 30 minutes idle', 'تسجيل الخروج بعد ٣٠ دقيقة خمول')} checked={true} pref='sec.idle' />{" "}<C.SwitchRow label={L('Alert on sign-in from a new device', 'تنبيه عند الدخول من جهاز جديد')} checked={true} pref='sec.newdevice' /></div></Panel>{" "}<Panel title={L('Active sessions and devices', 'الجلسات والأجهزة النشطة')} tight={true}>{SESSIONS.map((s, si) => <div className="listrow" style={{
            paddingInline: 0
          }}><Icon name='card' size={17} cls='dimmer' /><span className="grow"><b>{L(s.device, s.deviceAr)}</b>{" "}<small>{s.where} · {s.at}</small></span>{" "}{s.current ? <Pill label={L('This device', 'هذا الجهاز')} tone='success' /> : <button className="btn btn-danger-quiet btn-dense" data-act={`session-revoke:${si}`}>{L('Revoke', 'إنهاء')}</button>}</div>)}</Panel>{" "}<Panel title={L('Security alerts', 'تنبيهات الأمان')}>{SECURITY_ALERTS.map(a => <C.InlineAlert tone={a.level === 'warning' ? 'warning' : 'info'} title={L(a.what, a.whatAr)} body={a.at} />)}</Panel>{" "}<Panel title={L('Boundaries that are tested, not assumed', 'حدود تُختبَر لا تُفترَض')}><ul style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>{[[L('Every import and upload is validated before a byte is written', 'يُتحقَّق من كل استيراد ورفع قبل كتابة أي بايت'), 'shield'], [L('Rate limits on every endpoint, with failures monitored', 'حدود معدّل على كل وجهة، مع مراقبة الإخفاقات'), 'clock'], [L('Two people editing one record: the second is told, and neither silently overwrites the other', 'شخصان يعدّلان سجلاً واحداً: يُبلَّغ الثاني، ولا يمحو أحدهما الآخر بصمت'), 'people'], [L('Authorisation boundaries are covered by the test suite, including cross-parish isolation', 'حدود الصلاحيات مغطّاة باختبارات، بما فيها عزل الرعايا'), 'check']].map(([x, i]) => <li className="row" style={{
              gap: "10px",
              alignItems: "flex-start"
            }}><Icon name={i} size={17} cls='dimmer' />{" "}<span className="t-caption">{x}</span></li>)}</ul></Panel></div>{" "}<div className="sidecol"><Panel title={L('Field-level protection', 'حماية على مستوى الحقل')}><ul style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>{[[L('Medical and allergy alerts', 'التنبيهات الطبية والحساسية'), 'shield'], [L('Safeguarding and incident reports', 'تقارير الحماية والحوادث'), 'shield'], [L('Donor details and amounts', 'تفاصيل المتبرّعين والمبالغ'), 'give'], [L('Notes & Tasks', 'الملاحظات والمهام'), 'notes']].map(([x, i]) => <li className="row" style={{
              gap: "10px",
              alignItems: "flex-start"
            }}><Icon name={i} size={17} cls='dimmer' />{" "}<span className="t-caption">{x}</span></li>)}</ul>{" "}<div className="divider" />{" "}<p className="t-caption dim">{L('Permissions are checked on the server and again on every export — hiding a screen is never treated as security.', 'تُفحص الصلاحيات على الخادم ومجدداً عند كل تصدير — ولا يُعتبر إخفاء الشاشة أماناً.')}</p></Panel></div></div>,
    data: () => <div className="splitview"><div><Panel title={L('Retention schedule', 'جدول الحفظ')} tight={true}><Table cols={[{
            label: L('Record type', 'نوع السجل')
          }, {
            label: L('Kept for', 'يُحفظ')
          }]} rows={RETENTION.map(([en, ar, ke, ka]) => ({
            cells: [<b>{L(en, ar)}</b>, <span className="dim">{L(ke, ka)}</span>]
          }))} /></Panel></div>{" "}<div className="sidecol"><Panel title={L('Where this parish is saved', 'أين تُحفظ هذه الرعية')}><p className="t-body dim" style={{
            fontSize: "14px",
            lineHeight: "22px"
          }}>{L('Changes are saved to the parish database on the server and are available to authorized accounts after a reload or from another computer.', 'تُحفظ التغييرات في قاعدة بيانات الرعية على الخادم، وتبقى متاحة للحسابات المخوّلة بعد إعادة التحميل أو من حاسوب آخر.')}</p>{" "}<dl className="dl" style={{
            marginTop: "12px"
          }}><dt>{L('Last saved', 'آخر حفظ')}</dt><dd className="mono">{savedAt() ? new Date(savedAt()).toLocaleString(isAr() ? 'ar-LB' : 'en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short'
              }) : L('Not yet — nothing has changed', 'ليس بعد — لم يتغيّر شيء')}</dd><dt>{L('Size', 'الحجم')}</dt><dd className="mono">{Math.max(1, Math.round(savedSize() / 1024))} KB</dd></dl>{" "}<div className="row" style={{
            gap: "8px",
            marginTop: "14px",
            flexWrap: "wrap"
          }}><button className="btn btn-secondary btn-dense" data-act="data-export"><Icon name='export' size={15} />{L('Download data snapshot', 'تنزيل صورة من البيانات')}</button></div>{" "}<div className="divider" />{" "}<p className="help">{L('Restoring a database backup requires a reviewed administrator operation.', 'استعادة نسخة قاعدة البيانات تتطلب إجراءً إدارياً مُراجعاً.')}</p></Panel>{" "}<Panel title={L('Permanent deletion', 'الحذف النهائي')}><p className="t-body dim" style={{
            fontSize: "14px"
          }}>{L('Permanent deletion is a reviewed request, not a button. The reviewer is shown exactly what would be lost before they can confirm, and sacramental records are never deletable.', 'الحذف النهائي طلب يُراجَع لا زرّ. ويُعرَض على المراجع ما سيُفقَد قبل التأكيد، وسجلات الأسرار غير قابلة للحذف أبداً.')}</p>{" "}<button className="btn btn-danger-quiet" style={{
            marginTop: "12px",
            width: "100%"
          }} id="perm"><Icon name='trash' size={16} />{L('Review deletion requests', 'مراجعة طلبات الحذف')}</button></Panel></div></div>,
    api: () => <div className="splitview"><div><Panel title={L('Webhooks', 'الخطّافات')} tight={true}><Table cols={[{
            label: L('Endpoint', 'الوجهة')
          }, {
            label: L('Events', 'الأحداث'),
            cls: 'hide-sm'
          }, {
            label: L('Scope', 'النطاق'),
            cls: 'shrink'
          }, {
            label: L('Active', 'مفعّل'),
            cls: 'shrink'
          }]} rows={WEBHOOKS.map((w, wi) => ({
            cells: [<span className="mono" style={{
              fontSize: "12px"
            }}>{w.url}</span>, <span className="row" style={{
              gap: "4px",
              flexWrap: "wrap"
            }}>{w.events.map(e => <span className="chip">{e}</span>)}</span>, <Pill label={w.scope} tone='info' />, <label className="switch"><input type="checkbox" defaultChecked={!!w.active} data-act={`wh-toggle:${wi}`} /><span className="sr">{L('Active', 'مفعّل')}</span></label>]
          }))} /></Panel>{" "}<button className="btn btn-secondary" style={{
          marginTop: "16px"
        }} data-act="webhook-add"><Icon name='plus' size={17} />{L('Add webhook', 'إضافة خطّاف')}</button></div>{" "}<div className="sidecol"><Panel title={L('API credentials', 'بيانات الاعتماد')}>{PARISH.apiKeyRevoked ? <C.InlineAlert tone='warning' title={L('The reporting key is revoked', 'مفتاح التقارير ملغى')} body={L('The eparchy link is stopped until a new key is issued.', 'رابط الأبرشية متوقّف حتى إصدار مفتاح جديد.')} /> : <C.Field label={L('Eparchy reporting key', 'مفتاح تقارير الأبرشية')} value={'pl_live_••••••••••••' + (PARISH.apiKey || '7a21')} state='disabled' dir='ltr' />}{" "}<div className="row" style={{
            gap: "8px",
            marginTop: "12px"
          }}><button className="btn btn-secondary btn-dense" data-act="key-rotate">{PARISH.apiKeyRevoked ? L('Issue a new key', 'إصدار مفتاح جديد') : L('Rotate', 'تدوير')}</button>{" "}{PARISH.apiKeyRevoked ? '' : <button className="btn btn-danger-quiet btn-dense" data-act="key-revoke">{L('Revoke', 'إلغاء')}</button>}</div>{" "}<p className="t-caption dim" style={{
            marginTop: "12px"
          }}>{L('Credentials are scoped to named events and are auditable like any other access. Rate limits apply to every endpoint.', 'بيانات الاعتماد محصورة بأحداث مسمّاة وقابلة للتدقيق كأي وصول آخر. وتُطبَّق حدود المعدّل على كل وجهة.')}</p></Panel></div></div>
  };
  return <>{head}{(T[tab] || T[''])()}</>;
}
settings.mount = (host, tab = '') => {
  host.querySelector('#perm')?.addEventListener('click', reviewDeletions);
  // Appearance is managed per account through My account.
};

/* ── Colours: a scheme for the whole parish, previewed live and saved by the priest ── */
const sameTheme = (a, b) => schemeOf(a).id === schemeOf(b).id && schemeOf(a).primary === schemeOf(b).primary;
const themeDraft = () => S.themeDraft || schemeOf(PARISH.theme);
const canTheme = () => is('priest', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin');
const SAMPLE = <><i className="ss-rail"><i /><i /><i /></i>{" "}<i className="ss-page"><i className="ss-line" /><i className="ss-line short" /><i className="ss-chip" /><i className="ss-btn" /></i></>;

/* The own-colour card shows a colour wheel until a colour of the parish's own has been picked. */
function schemeCard(scheme, chosen, locked, wheel = false) {
  const p = palette(scheme.primary),
    on = chosen.id === scheme.id;
  return <label className={`scheme-card${on ? ' on' : ''}`} style={css(`--sw-1:${p.primary};--sw-2:${p.muted};--sw-3:${p.selection};--sw-4:${p.bg}`)}><input type="radio" name="scheme" defaultValue={scheme.id} className="sr" defaultChecked={!!on} disabled={!!locked} />{" "}<span className={`scheme-sample${wheel ? ' wheel' : ''}`} aria-hidden="true">{wheel ? <i className="ss-wheel"><Icon name='plus' size={18} /></i> : SAMPLE}</span>{" "}<span className="scheme-name">{L(scheme.en, scheme.ar)}{on ? <span className="scheme-tick"><Icon name='check' size={15} /></span> : ''}</span></label>;
}
function appearance() {
  const saved = schemeOf(PARISH.theme),
    chosen = themeDraft(),
    locked = !canTheme();
  const custom = chosen.id === 'custom' ? chosen : {
    id: 'custom',
    en: 'Your own colour',
    ar: 'لونك الخاص',
    primary: saved.id === 'custom' ? saved.primary : '#7A2E3A'
  };
  const changed = !sameTheme(chosen, saved);
  const shown = readable(custom.primary);
  return <div className="splitview"><div className="stack" style={{
      gap: "16px"
    }}><Panel title={L('Colour scheme', 'نظام الألوان')}><p className="t-body dim scheme-intro">{L('Choose the colour of your parish. It is used everywhere: on the office screens, in the members’ portal and on your parish website.', 'اختر لون رعيتك. يُستعمل في كل مكان: في شاشات المكتب وفي بوّابة المؤمنين وعلى موقع رعيتك.')}</p>{" "}{locked ? <C.InlineAlert tone='info' title={L('Only the parish priest can change the colours', 'وحده كاهن الرعية يغيّر الألوان')} body={L('You can see the scheme in use. Ask the parish priest if it should change.', 'يمكنك رؤية النظام المستعمل. اطلب من كاهن الرعية إن كان يجب تغييره.')} /> : ''}{" "}<fieldset className="scheme-grid" disabled={!!locked}><legend className="sr">{L('Colour scheme', 'نظام الألوان')}</legend>{" "}{SCHEMES.map(scheme => schemeCard(scheme, chosen, locked))}{" "}{schemeCard({
            ...custom,
            en: 'Your own colour',
            ar: 'لونك الخاص'
          }, chosen, locked, chosen.id !== 'custom' && saved.id !== 'custom')}</fieldset>{" "}<div className="scheme-custom" id="th-custom" hidden={!(chosen.id === 'custom')}><label className="label" htmlFor="th-color">{L('Your colour', 'لونك')}</label>{" "}<div className="scheme-custom-row"><input type="color" id="th-color" defaultValue={custom.primary.toLowerCase()} disabled={!!locked} aria-describedby="th-note" />{" "}<input className="input mono" id="th-hex" defaultValue={custom.primary} maxLength="7" dir="ltr" spellCheck="false" autoComplete="off" aria-label={L('Colour code', 'رمز اللون')} disabled={!!locked} aria-describedby="th-note" /></div>{" "}<p className="help" id="th-note" aria-live="polite">{customNote(custom.primary, shown)}</p></div>{" "}{locked ? '' : <div className="scheme-actions"><button className="btn btn-primary" id="th-save" disabled={!changed}><Icon name='check' size={17} />{L('Save colours', 'حفظ الألوان')}</button>{" "}<button className="btn btn-secondary" id="th-undo" disabled={!changed}>{L('Discard', 'تجاهل')}</button>{" "}<span className="t-caption dim" id="th-state" aria-live="polite">{changed ? L('You are previewing this scheme. Save it so everyone sees it.', 'أنت تعاين هذا النظام. احفظه ليراه الجميع.') : L('This is the scheme everyone sees.', 'هذا هو النظام الذي يراه الجميع.')}</span></div>}</Panel></div>{" "}<div className="sidecol"><Panel title={L('How it looks', 'كيف يبدو')}><div className="scheme-preview" aria-hidden="true"><div className="sp-site"><span className="sp-seal" /><b>{L(PARISH.name, PARISH.nameAr)}</b><span className="sp-pill">{L('Members', 'المؤمنون')}</span></div>{" "}<div className="sp-body"><span className="sp-eyebrow">{L('This Sunday', 'هذا الأحد')}</span>{" "}<b>{L('Divine Liturgy', 'القداس الإلهي')}</b><span className="sp-text">{L('9:00 and 11:00 in the main church', '٩:٠٠ و١١:٠٠ في الكنيسة الكبرى')}</span>{" "}<span className="sp-row"><span className="sp-btn">{L('Ask for a certificate', 'اطلب شهادة')}</span><span className="sp-tag">{L('Confirmed', 'مؤكَّد')}</span></span></div></div>{" "}<p className="t-caption dim" style={{
          marginTop: "12px"
        }}>{L('Text colours are checked and darkened when needed, so every word stays easy to read.', 'تُفحص ألوان النص وتُغمَّق عند الحاجة، لتبقى كل كلمة سهلة القراءة.')}</p></Panel>{" "}<Panel title={L('Where it shows', 'أين يظهر')}><ul className="scheme-where">{[['dash', L('Office screens, for every role', 'شاشات المكتب، لكل الأدوار')], ['people', L('The members’ portal', 'بوّابة المؤمنين')], ['globe', L('Your parish website', 'موقع رعيتك')]].map(([i, x]) => <li><Icon name={i} size={17} cls='dimmer' /><span>{x}</span></li>)}</ul>{" "}<p className="t-caption dim">{L('Certificates and printed pages keep their classic dark ink.', 'تحتفظ الشهادات والصفحات المطبوعة بحبرها الداكن الكلاسيكي.')}</p></Panel></div></div>;
}
const customNote = (picked, shown) => picked.toUpperCase() === shown ? L('Good choice — white text reads clearly on this colour.', 'اختيار جيد — النص الأبيض واضح على هذا اللون.') : L(`This colour is quite light, so it is shown a little darker (${shown}) to keep text readable.`, `هذا اللون فاتح بعض الشيء، لذا يظهر أغمق قليلاً (${shown}) ليبقى النص مقروءاً.`);
function wireAppearance(host) {
  applyTheme(themeDraft());
  if (!canTheme()) return;
  const preview = next => {
    S.themeDraft = sameTheme(next, PARISH.theme) ? null : {
      id: next.id,
      en: next.en,
      ar: next.ar,
      primary: next.primary
    };
    applyTheme(themeDraft());
    const changed = !!S.themeDraft;
    host.querySelectorAll('.scheme-card').forEach(card => {
      const on = card.querySelector('input').value === next.id;
      card.classList.toggle('on', on);
      card.querySelector('.scheme-tick')?.remove();
      if (on) card.querySelector('.scheme-name').insertAdjacentHTML('beforeend', <span className="scheme-tick"><Icon name='check' size={15} /></span>);
    });
    host.querySelector('#th-custom').hidden = next.id !== 'custom';
    host.querySelector('#th-save').disabled = host.querySelector('#th-undo').disabled = !changed;
    host.querySelector('#th-state').textContent = changed ? L('You are previewing this scheme. Save it so everyone sees it.', 'أنت تعاين هذا النظام. احفظه ليراه الجميع.') : L('This is the scheme everyone sees.', 'هذا هو النظام الذي يراه الجميع.');
  };
  const customCard = host.querySelector('.scheme-card input[value=custom]').closest('.scheme-card');
  const setCustom = (color, from) => {
    const value = color.toUpperCase();
    if (from !== 'hex') host.querySelector('#th-hex').value = value;
    if (from !== 'color') host.querySelector('#th-color').value = value.toLowerCase();
    const p = palette(value),
      sample = customCard.querySelector('.scheme-sample');
    if (sample.classList.contains('wheel')) {
      sample.classList.remove('wheel');
      paint(sample, SAMPLE);
    }
    Object.entries({
      '--sw-1': p.primary,
      '--sw-2': p.muted,
      '--sw-3': p.selection,
      '--sw-4': p.bg
    }).forEach(([k, v]) => customCard.style.setProperty(k, v));
    host.querySelector('#th-note').textContent = customNote(value, readable(value));
    customCard.querySelector('input').checked = true;
    preview({
      id: 'custom',
      en: 'Custom colour',
      ar: 'لون مخصّص',
      primary: value
    });
  };
  host.querySelectorAll('.scheme-card input').forEach(input => input.addEventListener('change', () => {
    if (input.value === 'custom') return setCustom(host.querySelector('#th-hex').value);
    preview(SCHEMES.find(scheme => scheme.id === input.value));
  }));
  let frame = 0;
  host.querySelector('#th-color').addEventListener('input', e => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => setCustom(e.target.value, 'color'));
  });
  host.querySelector('#th-hex').addEventListener('input', e => {
    let value = e.target.value.trim();
    if (value && value[0] !== '#') value = '#' + value;
    const ok = isHex(value);
    e.target.setAttribute('aria-invalid', ok || value.length < 7 ? 'false' : 'true');
    if (ok) setCustom(value, 'hex');
  });
  host.querySelector('#th-undo').addEventListener('click', () => {
    S.themeDraft = null;
    bus.refresh();
  });
  host.querySelector('#th-save').addEventListener('click', async () => {
    const next = themeDraft();
    PARISH.theme = {
      scheme: next.id,
      primary: next.primary.toUpperCase()
    };
    S.themeDraft = null;
    bus.refresh();
    if (!(await persist())) return bus.refresh(); // refused: the saved colours come back, and the error is already on screen
    toast(L('Colours saved', 'حُفظت الألوان'), L(`${L(next.en, next.ar)} is now used in the office, the members’ portal and on your parish website.`, `يُستعمل «${L(next.en, next.ar)}» الآن في المكتب وبوّابة المؤمنين وعلى موقع رعيتك.`), 'success');
  });
}

/* Deletion requests made from People → Archived. Approving is permanent and typed; declining keeps the archived record. */
function reviewDeletions() {
  const reqs = ARCHIVED.filter(p => p.deletionRequested);
  openModal({
    title: L('Deletion requests', 'طلبات الحذف'),
    sub: reqs.length ? L('Each record was archived first. Deleting removes it for good; sacramental entries stay in the registers.', 'أُرشف كل سجل أولاً. والحذف يزيله نهائياً؛ وتبقى قيود الأسرار في السجلات.') : '',
    body: reqs.length ? reqs.map(p => <div className="listrow" style={{
      paddingInline: 0
    }}><Who p={p} /><span className="grow" />{" "}<button className="btn btn-secondary btn-dense" data-del-no={p.id}>{L('Decline', 'رفض')}</button>{" "}<button className="btn btn-danger btn-dense" data-del-yes={p.id}>{L('Delete', 'حذف')}</button></div>) : <Empty glyph='check' title={L('No deletion requests', 'لا طلبات حذف')} body={L('They are made from People → Archived, after a record has been archived.', 'تُقدَّم من المؤمنون ← المؤرشفون، بعد أرشفة السجل.')} action={<a className="btn btn-secondary btn-dense" href="#/people/archived">{L('Open archived records', 'فتح السجلات المؤرشفة')}</a>} />,
    foot: <button className="btn btn-secondary" data-close="" style={{
      marginInlineStart: "auto"
    }}>{L('Close', 'إغلاق')}</button>,
    onMount(el) {
      el.querySelectorAll('[data-del-no]').forEach(b => b.addEventListener('click', () => {
        const p = ARCHIVED.find(x => x.id === b.dataset.delNo);
        if (!p) return;
        delete p.deletionRequested;
        bus.refresh();
        reviewDeletions();
        toast(L('Request declined', 'رُفض الطلب'), L(`${p.lat} stays archived.`, `يبقى ${p.ar} مؤرشفاً.`));
      }));
      el.querySelectorAll('[data-del-yes]').forEach(b => b.addEventListener('click', () => confirmDeletion(ARCHIVED.find(x => x.id === b.dataset.delYes))));
    }
  });
}
function confirmDeletion(p) {
  if (!p) return;
  openModal({
    title: L('Permanently delete this record?', 'حذف هذا السجل نهائياً؟'),
    sub: L('This cannot be undone.', 'لا يمكن التراجع.'),
    body: <><div className="formrow"><label className="label" htmlFor="typed">{L('Type', 'اكتب')}{" "}<b>{p.lat}</b>{" "}{L('to confirm', 'للتأكيد')}</label>{" "}<input className="input" id="typed" autoComplete="off" placeholder={p.lat} /></div>{" "}<span className="help help-error" id="typedhelp">{L('The name does not match yet.', 'الاسم لا يطابق بعد.')}</span></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Keep record', 'الاحتفاظ بالسجل')}</button>{" "}<button className="btn btn-danger" id="del" disabled style={{
        marginInlineStart: "auto"
      }}>{L('Delete permanently', 'حذف نهائي')}</button></>,
    onMount(el) {
      const inp = el.querySelector('#typed'),
        btn = el.querySelector('#del'),
        help = el.querySelector('#typedhelp');
      inp.addEventListener('input', () => {
        const okk = inp.value.trim() === p.lat;
        btn.disabled = !okk;
        help.classList.toggle('help-error', !okk);
        help.classList.toggle('help-ok', okk);
        help.textContent = okk ? L('Match.', 'مطابق.') : L('The name does not match yet.', 'الاسم لا يطابق بعد.');
      });
      btn.addEventListener('click', () => {
        ARCHIVED.splice(ARCHIVED.indexOf(p), 1);
        delete PHOTOS[p.id];
        closeOverlays();
        bus.refresh();
        toast(L('Record deleted permanently', 'حُذف السجل نهائياً'), p.lat, 'success');
      });
    }
  });
}

/* ═══════════ the living design system ═══════════
   Sheets 02 (tokens), 03 (controls) and 04 (patterns) rendered from the same
   CSS and components the product uses, so the library cannot drift from the app. */
const SGTABS = () => [['', 'Tokens', 'الرموز'], ['controls', 'Controls', 'الضوابط'], ['lebanon', 'Lebanon fields', 'حقول لبنان'], ['patterns', 'Patterns', 'الأنماط'], ['data', 'Data & charts', 'البيانات والرسوم']];
export function styleguide(tab = '') {
  const head = <><PageHead crumbs={[{
      label: L('Administration', 'الإدارة')
    }, {
      label: L('Design system', 'نظام التصميم')
    }]} title={L('ParishLife design system', 'نظام تصميم «حياة الرعية»')} sub={L('Every token, control and pattern from the library, rendered by the same CSS the product uses. If a specimen here is wrong, the product is wrong too.', 'كل رمز وضابط ونمط من المكتبة، مرسوماً بالـCSS نفسه الذي يستعمله المنتج. وإن كان النموذج هنا خاطئاً فالمنتج خاطئ أيضاً.')} actions={<button className="btn btn-secondary" data-act="print"><Icon name='print' size={17} />{L('Print sheet', 'طباعة الورقة')}</button>} /><TabBar base='styleguide' items={SGTABS()} active={tab} /></>;
  const spec = (title, note, body) => <section className="panel"><div className="panel-h"><h3>{title}</h3>{note ? <span className="t-caption dim" style={{
        marginInlineStart: "auto"
      }}>{note}</span> : ''}</div>{" "}<div className="panel-b">{body}</div></section>;
  const swatch = (name, hex, use) => <div className="card card-flat" style={{
    padding: 0,
    overflow: "hidden"
  }}><div style={css(`height:64px;background:${hex};border-bottom:1px solid var(--border)`)} />{" "}<div style={{
      padding: "12px 14px"
    }}><b style={{
        font: "500 13px/18px var(--sans)"
      }}>{name}</b>{" "}<div className="mono t-caption dim" dir="ltr">{hex}</div>{" "}<div className="t-caption dimmer" style={{
        marginTop: "4px"
      }}>{use}</div></div></div>;
  const T = {
    '': () => <>{spec(L('Colour', 'اللون'), L('Forest green, sage and warm white throughout the product', 'الأخضر الداكن والمريمي والأبيض الدافئ في جميع أجزاء التطبيق'), <><Paged className="gridcards" style={{
          gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))"
        }}>{swatch(L('Forest green', 'أخضر داكن'), '#233B32', L('Actions, rail and body text', 'الأفعال والشريط ونص المتن'))}{" "}{swatch(L('Soft sage', 'مريمي فاتح'), '#EDF0E8', L('Soft fills and selected states', 'الخلفيات الناعمة وحالات التحديد'))}{" "}{swatch(L('White', 'أبيض'), '#FFFFFF', L('Cards, forms and print', 'البطاقات والاستمارات والطباعة'))}{" "}{swatch(L('Selection sage', 'مريمي التحديد'), '#D6E1D0', L('Selected navigation and quiet highlights', 'التنقّل المحدّد والإبراز الهادئ'))}{" "}{swatch(L('Muted sage gray', 'رمادي مريمي'), '#607068', L('Secondary text, accents and charts', 'النص الثانوي واللمسات والرسوم'))}</Paged>{" "}<div className="divider" />{" "}<Paged className="gridcards" style={{
          gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))"
        }}>{swatch(L('Warm white', 'أبيض دافئ'), '#F7F7F2', L('Page background', 'خلفية الصفحة'))}{" "}{swatch(L('Paper', 'لون الورق'), '#F7F7F2', L('Table headers and summary cards', 'رؤوس الجداول وبطاقات الملخّص'))}{" "}{swatch(L('Sage accent', 'لمسة مريمية'), '#9BAC9F', L('Charts and small marks', 'الرسوم والعلامات الصغيرة'))}{" "}{swatch(L('Sage border', 'حدّ مريمي'), '#9BAC9F', L('Control outlines', 'حدود الضوابط'))}</Paged>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "10px",
          flexWrap: "wrap"
        }}><Status k='approved' /><Status k='failed' /><Status k='pending' /><Status k='awaiting-approval' /><Status k='open' /><Status k='sent' /><Status k='scheduled' /><Pill label={L('Paused', 'متوقّف')} tone='warning' mark='st-pause' /></div>{" "}<p className="t-caption dim" style={{
          marginTop: "14px"
        }}>{L('Status is never carried by colour alone: every status pill pairs an icon with a word, every alert pairs a tint with an icon and a heading.', 'الحالة لا تُحمَل باللون وحده أبداً: كل شارة حالة تجمع أيقونة وكلمة، وكل تنبيه يجمع لوناً وأيقونة وعنواناً.')}</p></>)}{spec(L('Type', 'الخطّ'), L('Six sizes, two families', 'ستة أحجام وعائلتان'), <><div className="tablescroll"><table className="tbl"><thead><tr><th>{L('Token', 'الرمز')}</th><th>{L('Inter / English', 'إنتر / إنكليزي')}</th><th>{L('Plex Arabic', 'بلكس عربي')}</th><th>{L('Spec', 'المواصفة')}</th></tr></thead><tbody>{[['t-display', 'Saint Elias', 'مار الياس', '32 / 40 / 600'], ['t-heading', 'Baptism register', 'سجل المعمودية', '24 / 32 / 600'], ['t-sub', 'Counting session 214', 'جلسة العدّ ٢١٤', '20 / 28 / 600'], ['t-body', 'Sunday 10:30 Mass, in the upper church.', 'قدّاس الأحد ١٠:٣٠ في الكنيسة العليا.', '16 / 26 / 400'], ['t-ui', 'Buttons, table cells, nav, inputs', 'الأزرار وخلايا الجدول والتنقل', '14 / 20 / 500'], ['t-caption', 'Helper text, timestamps, hints.', 'نص مساعد وطوابع زمنية', '12 / 18 / 400']].map(([cls, en, ar, sp]) => <tr><td><span className="mono t-caption">{cls}</span></td><td><span className={cls}>{en}</span></td><td><span className={cls} style={{
                    fontFamily: "var(--arabic)"
                  }}>{ar}</span></td><td><span className="mono t-caption dim">{sp}</span></td></tr>)}</tbody></table></div>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "28px",
          flexWrap: "wrap"
        }}><div><div className="t-caption dim">{L('Numerals', 'الأرقام')}</div>{" "}<div className="mono tnum" style={{
              fontSize: "20px"
            }} dir="ltr">1,240,000 · 04/10/2026</div></div>{" "}<div><div className="t-caption dim">{L('Weights in use', 'الأوزان المستعملة')}</div>{" "}<div style={{
              fontSize: "16px"
            }}><span style={{
                fontWeight: 400
              }}>400</span> · <span style={{
                fontWeight: 500
              }}>500</span> · <span style={{
                fontWeight: 600
              }}>600</span></div></div></div>{" "}<p className="t-caption dim" style={{
          marginTop: "12px"
        }}>{L('Tabular figures in every table, amount and register number, in both languages. Western digits throughout. No italics anywhere — italic Arabic does not exist.', 'أرقام جدولية في كل جدول ومبلغ ورقم قيد، وباللغتين. أرقام غربية في كل مكان. ولا مائل في أي موضع — فالمائل العربي غير موجود.')}</p></>)}{spec(L('Space, radius, elevation', 'المسافة والاستدارة والارتفاع'), L('Everything lands on 8', 'كل شيء على مضاعفات ٨'), <><div className="grid g3" style={{
          gap: "24px"
        }}><div><div className="t-caption dim" style={{
              marginBottom: "10px"
            }}>{L('Spacing scale', 'سلّم المسافات')}</div>{" "}{[[4, 'icon→label'], [8, 'field→helper'], [16, 'between fields'], [24, 'card padding'], [32, 'page gutter'], [48, 'between sections'], [64, 'page top/bottom']].map(([n, u]) => <div className="row" style={{
              gap: "10px",
              marginBottom: "6px"
            }}><span className="mono t-caption" style={{
                width: "26px"
              }}>{n}</span>{" "}<span style={css(`height:8px;width:${n * 1.6}px;background:var(--primary);border-radius:2px`)} />{" "}<span className="t-caption dimmer">{u}</span></div>)}</div>{" "}<div><div className="t-caption dim" style={{
              marginBottom: "10px"
            }}>{L('Radius', 'الاستدارة')}</div>{" "}{[['6px', 'inputs'], ['10px', 'cards, buttons'], ['14px', 'modals, drawers'], ['999px', 'pills, avatars']].map(([r, u]) => <div className="row" style={{
              gap: "10px",
              marginBottom: "8px"
            }}><span style={css(`width:34px;height:26px;border:1px solid var(--border-strong);border-radius:${r};background:var(--surface)`)} />{" "}<span className="mono t-caption">{r}</span><span className="t-caption dimmer">{u}</span></div>)}</div>{" "}<div><div className="t-caption dim" style={{
              marginBottom: "10px"
            }}>{L('Elevation', 'الارتفاع')}</div>{" "}{[['0 · line', 'none', '1px border'], ['1 · card', 'var(--e1)', 'cards'], ['2 · menu', 'var(--e2)', 'menus, popovers'], ['3 · modal', 'var(--e3)', 'modals']].map(([n, sh, u]) => <div className="row" style={{
              gap: "10px",
              marginBottom: "10px"
            }}><span style={css(`width:34px;height:26px;border:1px solid var(--border);border-radius:6px;background:var(--surface);box-shadow:${sh}`)} />{" "}<span className="t-caption">{n}</span><span className="t-caption dimmer">{u}</span></div>)}</div></div>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "28px",
          flexWrap: "wrap"
        }}>{[[40, L('button height', 'ارتفاع الزرّ')], [40, L('input height', 'ارتفاع الحقل')], [44, L('min touch target', 'أصغر هدف لمس')], [48, L('table row', 'صف الجدول')], [64, L('top bar', 'الشريط العلوي')], [264, L('sidebar expanded', 'الشريط الموسّع')], [72, L('sidebar collapsed', 'الشريط المطوي')], [20, L('icon, 1.5 stroke', 'أيقونة، سماكة ١٫٥')]].map(([n, u]) => <div><div className="mono" style={{
              fontSize: "19px",
              fontVariantNumeric: "tabular-nums"
            }}>{n}</div>{" "}<div className="t-caption dim">{u}</div></div>)}</div></>)}</>,
    controls: () => <>{spec(L('Buttons', 'الأزرار'), '40px · 10px radius · 14/500', <><div className="row" style={{
          gap: "10px",
          flexWrap: "wrap"
        }}><button className="btn btn-primary" data-act="spec-save">{L('Save record', 'حفظ السجل')}</button>{" "}<button className="btn btn-secondary" data-act="spec-cancel">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-ghost" data-go="people">{L('View all', 'عرض الكل')}</button>{" "}<button className="btn btn-danger" data-act="spec-delete">{L('Delete', 'حذف')}</button>{" "}<button className="btn btn-danger-quiet" data-act="archive-specimen">{L('Archive', 'أرشفة')}</button>{" "}<button className="btn btn-primary" disabled>{L('Disabled', 'معطّل')}</button>{" "}<button className="btn btn-primary" disabled aria-busy="true" style={{
            opacity: 1
          }}><span className="spin" />{L('Saving…', 'يُحفظ…')}</button></div>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center"
        }}><C.SplitBtn label={L('New parishioner', 'مؤمن جديد')} id='sg1' />{" "}<C.BGroup items={[L('Month', 'شهر'), L('Week', 'أسبوع'), L('Day', 'يوم')]} sel={0} />{" "}<C.IconBtn ico='print' label={L('Print certificate', 'طباعة الشهادة')} data-act="print" />{" "}<C.IconBtn ico='trash' label={L('Archive', 'أرشفة')} data-act="archive-specimen" /></div>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center"
        }}><button className="btn btn-secondary btn-dense" data-act="spec-save">32 {L('dense', 'كثيف')}</button>{" "}<button className="btn btn-secondary" data-act="spec-save">40 {L('default', 'افتراضي')}</button>{" "}<button className="btn btn-secondary btn-touch" data-act="spec-save">48 {L('touch', 'لمس')}</button></div></>)}{spec(L('Text fields', 'الحقول النصّية'), L('40px · 6px radius · label above, helper below', '٤٠ بكسل · استدارة ٦ · التسمية فوق والمساعدة تحت'), <><div className="formgrid"><C.Field label={L('English name', 'الاسم الإنكليزي')} req={true} value='Georges Haddad' help={L('As it appears on the ID card.', 'كما يظهر على الهوية.')} />{" "}<C.Field label={L('English name', 'الاسم الإنكليزي')} req={true} value='G' state='error' help={L('Enter at least 2 characters.', 'أدخل حرفين على الأقل.')} helpTone='help-error' />{" "}<C.Field label={L('Envelope number', 'رقم المظروف')} value='0142' state='ok' help={L('Available.', 'متاح.')} helpTone='help-ok' tail={<span style={{
            color: "var(--success)"
          }}><Icon name='check' size={16} /></span>} />{" "}<C.Field label={L('English name', 'الاسم الإنكليزي')} value='Georges Haddad' state='disabled' help={L('Locked while the record is archived.', 'مقفل ما دام السجل مؤرشفاً.')} />{" "}<C.Field label={L('Envelope number', 'رقم المظروف')} value='0142' state='loading' help={L('Checking if this envelope is free…', 'يجري التحقّق من توفّر المظروف…')} /></div>{" "}<C.Textarea label={L('Pastoral note', 'ملاحظة رعوية')} id='sgta' max={500} value='Visited at home after the hospital stay. Asked for the parish to remember his mother at Sunday Mass.' help={L('Visible to the priest only.', 'تظهر للكاهن وحده.')} />{" "}<div className="formgrid"><C.Stepper label={L('Seats in the hall', 'المقاعد في القاعة')} value={120} id='sgst' help={L('Steppers are 38px wide so a thumb can hit them.', 'أزرار الزيادة ٣٨ بكسل ليصلها الإبهام.')} />{" "}<div className="formrow"><label className="label">{L('Find a parishioner', 'ابحث عن مؤمن')}</label>{" "}<C.SearchClear ph={L('Searches Arabic and English name at once', 'يبحث في الاسمين معاً')} id='sgsc' /></div></div></>)}{spec(L('Choosing', 'الاختيار'), L('Every option row is 44px', 'كل صف خيار ٤٤ بكسل'), <><div className="formgrid"><div className="formrow"><label className="label">{L('Fund', 'الصندوق')}</label>{" "}<Select>{FUNDS.map(f => <option>{L(f.name, f.ar)}</option>)}</Select></div>{" "}<C.PersonPicker label={L('Person — autocomplete with avatar', 'شخص — إكمال تلقائي مع صورة')} id='sgpp' /></div>{" "}<C.ChipField label={L('Groups', 'المجموعات')} tags={[L('Choir', 'الجوقة'), L('Youth', 'الشبيبة'), L('Catechism G4', 'تعليم ٤')]} />{" "}<div className="divider" />{" "}<div className="grid g3" style={{
          gap: "20px"
        }}><div><div className="t-caption dim" style={{
              marginBottom: "10px"
            }}>{L('Marital status', 'الحالة الاجتماعية')}</div>{" "}<div className="stack" style={{
              gap: "8px"
            }}><C.CheckRow label={L('Married', 'متزوّج')} type='radio' checked={true} />{" "}<C.CheckRow label={L('Single', 'أعزب')} type='radio' />{" "}<C.CheckRow label={L('Widowed', 'أرمل')} type='radio' />{" "}<C.CheckRow label={L('Annulled', 'مُبطَل')} type='radio' note={L('needs a chancery record', 'يحتاج قيد المطرانية')} /></div></div>{" "}<div><div className="t-caption dim" style={{
              marginBottom: "10px"
            }}>{L('Consent', 'الموافقة')}</div>{" "}<div className="stack" style={{
              gap: "8px"
            }}><C.CheckRow label={L('Announcements on WhatsApp', 'الإعلانات على واتساب')} checked={true} />{" "}<C.CheckRow label={L('Printed parish directory', 'الدليل المطبوع')} />{" "}<C.CheckRow label={L('Some family members opted in', 'وافق بعض أفراد العائلة')} indet={true} /></div></div>{" "}<div><div className="t-caption dim" style={{
              marginBottom: "10px"
            }}>{L('Toggles', 'المفاتيح')}</div>{" "}<div className="stack" style={{
              gap: "10px"
            }}><C.SwitchRow label={L('Show in member portal', 'الظهور في البوّابة')} checked={true} />{" "}<C.SwitchRow label={L('Weekly giving digest', 'ملخّص التقدمات')} checked={true} />{" "}<C.SwitchRow label={L('Card gateway', 'بوابة البطاقات')} note={L('not connected', 'غير موصولة')} /></div></div></div></>)}{spec(L('Dates, time and uploads', 'التواريخ والوقت والرفع'), L('Gregorian, feast days marked', 'ميلادية، مع علامات الأعياد'), <><div className="grid g2" style={{
          gap: "24px",
          alignItems: "start"
        }}><div><C.DatePicker y={2026} m={9} sel={4} /></div>{" "}<div><C.TimeField /><C.DateRange /></div></div>{" "}<div className="divider" /><C.Dropzone id='sgdz' specimen={true} />{" "}<div className="divider" /><C.AvatarUpload />{" "}<div className="divider" /><C.RichText /></>)}{spec(L('Dropdowns and menus', 'القوائم المنسدلة'), L('8px offset · 10px radius · elevation 2', 'إزاحة ٨ · استدارة ١٠ · ارتفاع ٢'), <><div className="grid g3" style={{
          gap: "20px",
          alignItems: "start"
        }}><C.FilterMenu title={L('Status', 'الحالة')} opts={[[L('Active', 'نشط'), 1284, true], [L('Visitor', 'زائر'), 96, true], [L('Moved away', 'انتقل'), 41, false], [L('Deceased', 'متوفّى'), 218, false], [L('Archived', 'مؤرشف'), 7, false]]} />{" "}<C.KebabMenu />{" "}<C.RatePopover amount={50} /></div>{" "}<div className="divider" /><C.BulkBar n={14} />{" "}<div className="divider" />{" "}<div className="grid g2" style={{
          gap: "20px",
          alignItems: "start"
        }}><div><div className="t-caption dim" style={{
              marginBottom: "10px"
            }}>{L('Searchable combobox — grouped, keyboard-driven', 'صندوق بحث — مجمَّع، بالكيبورد')}</div>{" "}<div className="ac-list" style={{
              position: "static",
              maxHeight: "none"
            }}><div className="ac-group">{L('Sacraments', 'الأسرار')}</div>{" "}<button className="ac-opt" aria-selected="true" data-go="sacraments"><Icon name='sacr' size={17} />{" "}<span><b>{L('Baptism register', 'سجل المعمودية')}</b></span><span className="kbd" style={{
                  marginInlineStart: "auto"
                }}>↵</span></button>{" "}<button className="ac-opt" data-go="sacraments"><Icon name='plus' size={17} /><span><b>{L('New baptism record', 'قيد معمودية جديد')}</b></span></button>{" "}<div className="ac-group">{L('Certificates', 'الشهادات')}</div>{" "}<button className="ac-opt" data-go="certificate/sc1"><Icon name='doc' size={17} />{" "}<span><b>{L('Baptism certificate — Arabic', 'إفادة معمودية — عربي')}</b></span></button></div>{" "}<p className="t-caption dimmer" style={{
              marginTop: "8px"
            }}>↑↓ {L('move', 'تنقّل')} · ↵ {L('open', 'فتح')} · esc {L('close', 'إغلاق')}</p></div>{" "}<div><div className="t-caption dim" style={{
              marginBottom: "10px"
            }}>{L('Command palette', 'لوحة الأوامر')}</div>{" "}<button className="btn btn-secondary" id="sgcmd"><Icon name='search' size={17} />{L('Open it', 'افتحها')}{" "}<span className="kbd" style={{
                marginInlineStart: "6px"
              }}>⌘K</span></button>{" "}<p className="t-caption dimmer" style={{
              marginTop: "8px"
            }}>{L('Searches people, records, pages and actions.', 'تبحث في الأشخاص والسجلات والصفحات والإجراءات.')}</p></div></div></>)}</>,
    lebanon: () => <>{spec(L('Currency — dual USD / LBP', 'العملة — دولار/ليرة'), L('The rate travels with the amount', 'السعر يسافر مع المبلغ'), <><C.CurrencyField label={L('Amount', 'المبلغ')} value='1,250.00' stale={true} id='sgcur' />{" "}<C.SplitCurrency />{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "28px",
          flexWrap: "wrap"
        }}><Amount dollars={1250} showRate={true} cls='amount-lg' />{" "}<Amount dollars={50} showRate={true} />{" "}<Amount dollars={50} cls='amount-sm' /></div></>)}{spec(L('Phone — +961 prefix control', 'الهاتف — مقدّمة ‎+961'), '', <div className="formgrid"><C.PhoneField label={L('Mobile', 'الخلوي')} value='3 421 887' />{" "}<C.PhoneField label={L('Mobile', 'الخلوي')} value='3 421' state='error' id='sgph2' /></div>)}{spec(L('Address — cascading select', 'العنوان — اختيار متسلسل'), L('No postal code field exists', 'لا حقل رمز بريدي'), <C.AddressCascade />)}{spec(L('Bilingual name pair and rite', 'ثنائي الاسم والطقس'), L('Arabic is the record of truth', 'العربي هو سجل الحقيقة'), <><C.NamePair /><C.RiteSelect /></>)}{spec(L('Channel order and direction', 'ترتيب القنوات والاتجاه'), '', <><div className="row" style={{
          gap: "10px",
          flexWrap: "wrap"
        }}><span className="chip chip-on">WhatsApp <span className="t-caption" style={{
              marginInlineStart: "6px",
              opacity: ".75"
            }}>{L('default', 'افتراضي')}</span></span>{" "}<Icon name='arrowR' size={16} cls='dimmer' /><span className="chip">SMS <span className="t-caption" style={{
              marginInlineStart: "6px",
              opacity: ".75"
            }}>{L('fallback', 'احتياط')}</span></span>{" "}<Icon name='arrowR' size={16} cls='dimmer' /><span className="chip">{L('Email — last', 'بريد — أخيراً')}</span></div>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "10px"
        }}><span className="chip mono" dir="ltr">dir=ltr</span><span className="chip chip-on mono" dir="ltr">dir=rtl</span></div>{" "}<p className="t-caption dim" style={{
          marginTop: "12px"
        }}>{L('Arabic mirrors the sidebar side, table column order, chart axis, drawer entry edge, chevrons and progress fill. Clocks, logos, media controls and the play triangle never flip. Numerals and amounts stay left-to-right in both.', 'العربية تعكس جهة الشريط وترتيب الأعمدة ومحور الرسم وحافة الدرج والأسهم وامتلاء التقدّم. الساعات والشعارات وأزرار الوسائط ومثلّث التشغيل لا تنعكس أبداً. والأرقام والمبالغ تبقى من اليسار إلى اليمين.')}</p></>)}</>,
    patterns: () => <>{spec(L('Toasts and alerts', 'التنبيهات'), L('Every mutation toasts; reversible ones carry Undo', 'كل تعديل يُنبّه؛ والقابل للتراجع يحمل «تراجع»'), <><div className="stack" style={{
          gap: "10px"
        }}><C.InlineAlert tone='warning' title={L('This family has two records', 'لهذه العائلة سجلّان')} body={L('Haddad (Hadath) and Hadad (Hadath) look like the same household.', 'يبدو أن «حدّاد» و«حداد» في الحدث العائلة نفسها.')} actions={<button data-go="people/duplicates">{L('Compare and merge', 'قارن وادمج')}</button>} />{" "}<C.InlineAlert tone='warning' title={L('The hall is already booked at this time', 'القاعة محجوزة في هذا الوقت')} body={L('Catechism grade 4, Saturday 15:00–16:30. You can still save and let the two overlap.', 'تعليم مسيحي ٤، السبت ١٥:٠٠–١٦:٣٠. يمكنك الحفظ والسماح بالتداخل.')} />{" "}<C.InlineAlert tone='danger' title={L('4 fields need attention before saving', '٤ حقول تحتاج انتباهاً قبل الحفظ')} body={L('Arabic name, date of birth, rite and the register page number.', 'الاسم العربي وتاريخ الولادة والطقس ورقم صفحة السجل.')} />{" "}<C.InlineAlert tone='success' title={L('Second person has verified this batch', 'تحقّق شخص ثانٍ من هذه الدفعة')} body={L('Rita Nassar counted the same totals at 19:32. Ready to close.', 'عدّت ريتا نصّار المجاميع نفسها الساعة ١٩:٣٢.')} /></div>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "8px",
          flexWrap: "wrap"
        }}><button className="btn btn-secondary btn-dense" id="tst1">{L('Toast — archived, with Undo', 'تنبيه — أُرشف، مع تراجع')}</button>{" "}<button className="btn btn-secondary btn-dense" id="tst2">{L('Toast — queued', 'تنبيه — في الانتظار')}</button>{" "}<button className="btn btn-secondary btn-dense" id="tst3">{L('Toast — saved locally', 'تنبيه — حُفظ محلياً')}</button>{" "}<button className="btn btn-secondary btn-dense" id="tst4">{L('Toast — send failed', 'تنبيه — فشل الإرسال')}</button></div></>)}{spec(L('Modals, drawers, guards', 'النوافذ والأدراج والحواجز'), '', <><div className="row" style={{
          gap: "8px",
          flexWrap: "wrap"
        }}><button className="btn btn-secondary" id="sgm1">{L('Confirmation modal', 'نافذة تأكيد')}</button>{" "}<button className="btn btn-secondary" id="sgm2">{L('Destructive — typed confirmation', 'حذف — تأكيد بالكتابة')}</button>{" "}<button className="btn btn-secondary" id="sgm3">{L('Side drawer — 420', 'درج جانبي — ٤٢٠')}</button>{" "}<button className="btn btn-secondary" id="sgm4">{L('Side drawer — 720', 'درج جانبي — ٧٢٠')}</button>{" "}<button className="btn btn-secondary" id="sgm5">{L('Unsaved-changes guard', 'حاجز التغييرات غير المحفوظة')}</button></div>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "20px",
          flexWrap: "wrap",
          alignItems: "center"
        }}><C.IconBtn ico='print' label={L('Print certificate', 'طباعة الشهادة')} data-act="print" />{" "}<span className="t-caption dim">{L('Every icon-only button has a tooltip. 400ms delay.', 'كل زرّ أيقونة له تلميح. تأخير ٤٠٠ مللي ثانية.')}</span></div></>)}{spec(L('Progress, spinner, skeleton', 'التقدّم والدوران والهيكل'), L('Skeletons mirror the real 48px row height', 'الهياكل تطابق ارتفاع الصف ٤٨ بكسل'), <><div className="grid g3" style={{
          gap: "20px",
          alignItems: "start"
        }}><div><div className="t-caption dim" style={{
              marginBottom: "8px"
            }}>{L('Importing — step 3 of 4', 'الاستيراد — الخطوة ٣ من ٤')}</div>{" "}<span className="progress"><i style={{
                width: "60%"
              }} /></span>{" "}<div className="mono t-caption dim" style={{
              marginTop: "6px"
            }}>248 / 412</div></div>{" "}<div><div className="t-caption dim" style={{
              marginBottom: "8px"
            }}>{L('Budget consumed', 'الموازنة المستهلكة')}</div>{" "}<span className="progress accent"><i style={{
                width: "86%"
              }} /></span></div>{" "}<div><div className="t-caption dim" style={{
              marginBottom: "8px"
            }}>{L('Loading', 'جارٍ التحميل')}</div>{" "}<span className="spinner" /></div></div>{" "}<div className="divider" />{" "}<div className="tablewrap"><C.SkeletonRows n={4} /></div></>)}{spec(L('Empty, error, denied, offline', 'فارغ وخطأ وممنوع وبلا اتصال'), L('Four different problems, four different answers', 'أربع مشكلات وأربع إجابات'), <div className="grid g2" style={{
        gap: "16px"
      }}><div className="card card-flat"><Empty glyph='people' title={L('No parishioners yet', 'لا مؤمنين بعد')} body={L('Add the first household by hand, or bring in the existing list from a spreadsheet.', 'أضف العائلة الأولى يدوياً أو استورد اللائحة من جدول.')} action={<><button className="btn btn-primary btn-dense" data-act="record-new">{L('New parishioner', 'مؤمن جديد')}</button>{" "}<button className="btn btn-secondary btn-dense" data-go="people/import">{L('Import CSV', 'استيراد CSV')}</button></>} /></div>{" "}<div className="card card-flat"><Empty glyph='search' title={L('Nothing matches those filters', 'لا شيء يطابق المرشّحات')} body={L('Status “Visitor”, town “Hadath” and last 30 days together return no one.', 'الحالة «زائر» والبلدة «الحدث» وآخر ٣٠ يوماً معاً لا تُرجع أحداً.')} action={<button className="btn btn-secondary btn-dense" data-act="spec-clear">{L('Clear all filters', 'مسح كل المرشّحات')}</button>} /></div>{" "}<div className="card card-flat"><Empty glyph='warn' title={L('This list could not be loaded', 'تعذّر تحميل اللائحة')} body={L('The server did not answer. Nothing you did caused it and nothing was lost.', 'لم يستجب الخادم. لم يتسبّب بذلك شيء فعلته ولم يضع شيء.')} action={<><button className="btn btn-secondary btn-dense" data-act="spec-retry">{L('Try again', 'إعادة المحاولة')}</button>{" "}<span className="mono t-caption dimmer" style={{
              display: "block",
              marginTop: "8px"
            }}>ref 8f21c4 · 09:41</span></>} /></div>{" "}<div className="card card-flat"><Empty glyph='shield' title={L('Giving is not part of your role', 'التقدمات ليست ضمن دورك')} body={L('Only the treasurer and the parish priest can open financial records. Ask Fr. Antoine if you need access.', 'أمين الصندوق والكاهن وحدهما يفتحان السجلات المالية.')} action={<button className="btn btn-secondary btn-dense" data-go="dashboard">{L('Back to dashboard', 'العودة إلى اللوحة')}</button>} /></div></div>)}{spec(L('Page furniture', 'أثاث الصفحة'), L('Breadcrumbs, entity header, tabs with counts', 'مسار وعنوان كيان وتبويبات بعدّاد'), <><nav className="crumbs" style={{
          display: "flex",
          gap: "7px",
          font: "400 12px/16px var(--sans)",
          color: "var(--text-2)"
        }}><a href="#/people">{L('People', 'المؤمنون')}</a><span className="sep">/</span>{" "}<a href="#/people">{L('Parishioners', 'المؤمنون')}</a><span className="sep">/</span><span>Georges Haddad</span></nav>{" "}<div className="entityhead" style={{
          marginTop: "12px"
        }}><span className="avatar avatar-lg">GH</span>{" "}<div className="id"><h1 style={{
              font: "600 24px/32px var(--sans)",
              letterSpacing: "-.02em"
            }}>Georges Haddad <Status k='member' /><span className="pill">{L('Maronite', 'ماروني')}</span></h1>{" "}<div className="meta" style={{
              fontFamily: "var(--arabic)"
            }}>جورج حدّاد · {L('Envelope', 'مظروف')}{" "}<span className="mono">0142</span> · {L('Hadath', 'الحدث')}</div></div>{" "}<div className="acts"><button className="btn btn-secondary" data-act="person-edit:p1">{L('Edit', 'تعديل')}</button>{" "}<button className="btn btn-primary" data-act="compose:p1">{L('Message', 'رسالة')}</button></div></div>{" "}<div style={{
          marginTop: "16px"
        }}><TabBar base='styleguide/patterns' items={[['', 'Profile', 'الملف'], ['x1', 'Family', 'العائلة'], ['x2', 'Sacraments', 'الأسرار', 4], ['x3', 'Giving', 'التقدمات'], ['x4', 'Notes', 'ملاحظات']]} active='' /></div></>)}</>,
    data: () => <>{spec(L('Data table', 'جدول البيانات'), L('48px rows · sticky header · sortable · expandable · hover actions', '٤٨ بكسل · رأس ثابت · قابل للفرز والتوسيع'), <>{<Table pick={true} cols={[{
          label: L('Name', 'الاسم'),
          sort: true
        }, {
          label: L('Town', 'البلدة'),
          sort: true
        }, {
          label: L('Envelope', 'المظروف'),
          cls: 'shrink'
        }, {
          label: L('Status', 'الحالة'),
          cls: 'shrink'
        }, {
          label: L('Last gift', 'آخر تقدمة'),
          cls: 'num'
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={[['p1', 'Hadath', '0142', 'member', 50], ['p3', 'Hadath', '—', 'visitor', 0], ['p4', 'Baabda', '0088', 'member', 120]].map(([pid, town, env, st, gift]) => ({
          detail: <div className="grid g4" style={{
            gap: "20px"
          }}><dl className="dl"><dt>{L('Household', 'العائلة')}</dt><dd>Nassar — 4 {L('members', 'أفراد')}</dd></dl>{" "}<dl className="dl"><dt>{L('Phone', 'الهاتف')}</dt><dd className="mono">+961 3 887 210</dd></dl>{" "}<dl className="dl"><dt>{L('Groups', 'المجموعات')}</dt><dd>{L('Choir, Counting team', 'الجوقة، فريق العدّ')}</dd></dl>{" "}<dl className="dl"><dt>{L('Attendance 12 mo', 'الحضور ١٢ شهراً')}</dt><dd>41 / 52</dd></dl></div>,
          cells: [<span className="row" style={{
            gap: "6px"
          }}><C.IconBtn ico='chevR' label={L('Expand', 'توسيع')} data-expand="" aria-expanded="false" /><Who p={person(pid)} /></span>, <span className="dim">{town}</span>, <span className="mono">{env}</span>, <Status k={st} />, gift ? <><span className="num">{usd(gift)}</span><br /><span className="num t-caption dim">{num(gift * RATE.value)}</span></> : <span className="num dimmer">—</span>, <span className="rowacts"><C.IconBtn ico='msg' label={L('Message', 'مراسلة')} data-act={`compose:${pid}`} /><C.IconBtn ico='dots' label={L('More', 'المزيد')} data-act={`person-menu:${pid}`} /></span>]
        }))} foot={<><span>1–3 {L('of', 'من')} 1,380</span>{" "}<span className="savedview" style={{
            marginInlineStart: "auto"
          }}><Icon name='check' size={14} />{L('Saved: Envelope holders', 'محفوظ: أصحاب المظاريف')}</span></>} />}</>)}{spec(L('Display parts', 'أجزاء العرض'), '', <><div className="row" style={{
          gap: "8px",
          flexWrap: "wrap"
        }}><Status k='member' /><Status k='visitor' /><Status k='pending' /><Status k='failed' />{" "}<span className="pill">{L('Archived', 'مؤرشف')}</span></div>{" "}<div className="row" style={{
          gap: "8px",
          flexWrap: "wrap",
          marginTop: "14px"
        }}><span className="chip">{L('Maronite', 'ماروني')}</span><span className="chip">{L('Choir', 'الجوقة')}</span>{" "}<span className="chip">{L('Envelope holder', 'صاحب مظروف')}</span>{" "}<button className="btn btn-ghost btn-dense" data-act="tag-add">+ {L('Add tag', 'إضافة وسم')}</button></div>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "20px",
          alignItems: "center",
          flexWrap: "wrap"
        }}><span className="avatar-stack">{['p1', 'p4', 'p3'].map(i => <span className="avatar">{person(i).lat.split(' ').map(x => x[0]).slice(0, 2)}</span>)}{" "}<span className="avatar" style={{
              background: "var(--muted)",
              color: "var(--text-2)"
            }}>+9</span></span>{" "}{['avatar-sm', '', 'avatar-lg', 'avatar-xl'].map(c => <span className={`avatar ${c}`}>GH</span>)}</div></>)}{spec(L('KPI, sparkline, bar and donut', 'المؤشرات والرسوم'), L('RTL flips the axis', 'العربية تعكس المحور'), <><div className="grid g3" style={{
          gap: "16px"
        }}><C.Kpi k={L('Given this month', 'المعطى هذا الشهر')} v={usd(8420)} sub={`L.L ${num(8420 * RATE.value)}`} delta={L('+12% vs Sept', '+١٢٪ عن أيلول')} spark={GIVING_SERIES} />{" "}<C.Kpi k={L('Group meeting attendance', 'حضور اجتماعات المجموعات')} v='86%' sub={L('illustrative component data', 'بيانات توضيحية للمكوّن')} spark={ATTENDANCE_SERIES} />{" "}<C.Kpi k={L('Volunteers active', 'متطوّعون نشطون')} v='96' sub={L('this quarter', 'هذا الفصل')} delta={L('−4 on last quarter', '−٤ عن الفصل الماضي')} dir='down' /></div>{" "}<div className="divider" />{" "}<div className="grid g2" style={{
          gap: "24px",
          alignItems: "start"
        }}><div><div className="t-caption dim" style={{
              marginBottom: "12px"
            }}>{L('Budget vs actual, by fund', 'الموازنة مقابل الفعلي')}</div>{" "}<C.BarChart rows={FUNDS.map(f => ({
              label: L(f.name, f.ar),
              v: f.actual,
              max: f.budget
            }))} /></div>{" "}<div><div className="t-caption dim" style={{
              marginBottom: "12px"
            }}>{L('How people give', 'كيف يُعطي الناس')}</div>{" "}<C.Donut segments={PAYMENT_MIX.map(p => ({
              ...p,
              label: isAr() ? p.labelAr : p.label
            }))} /></div></div></>)}{spec(L('Key-value list and activity timeline', 'قائمة مفتاح-قيمة وسجل النشاط'), '', <div className="grid g2" style={{
        gap: "24px",
        alignItems: "start"
      }}><dl className="dl"><dt>{L('Arabic name', 'الاسم العربي')}</dt><dd style={{
            fontFamily: "var(--arabic)"
          }}>جورج حدّاد</dd><dt>{L('Rite', 'الطقس')}</dt><dd>{L('Maronite', 'ماروني')}</dd><dt>{L('Born', 'الولادة')}</dt><dd className="mono">12 / 03 / 1958</dd><dt>{L('Phone', 'الهاتف')}</dt><dd className="mono">+961 3 421 887</dd><dt>{L('Envelope', 'المظروف')}</dt><dd className="mono">0142</dd></dl>{" "}<div className="timeline"><div className="tl-item accent"><div className="when">{L('Today, 19:12', 'اليوم ١٩:١٢')}</div>{" "}<div className="what"><b>Rita Nassar</b>{" "}{L('recorded $50.00 in session 214', 'سجّلت 50.00$ في الجلسة ٢١٤')}</div></div>{" "}<div className="tl-item"><div className="when">2 Oct 2026, 11:40</div>{" "}<div className="what">{L('Baptism certificate printed in Arabic · Book 12, page 84', 'طُبعت إفادة المعمودية بالعربية · دفتر ١٢، صفحة ٨٤')}</div></div>{" "}<div className="tl-item"><div className="when">28 Sep 2026</div>{" "}<div className="what">{L('Phone number changed from 03 421 880 · by the secretary', 'تغيّر رقم الهاتف · بواسطة أمانة السرّ')}</div></div></div></div>)}</>
  };
  return <>{head}{(T[tab] || T[''])()}</>;
}
styleguide.mount = host => {
  const T = {
    tst1: () => toast(L('Georges Haddad was archived', 'أُرشف جورج حدّاد'), L('Removed from lists and messaging. Records kept.', 'أُزيل من اللوائح والمراسلة. والسجلات محفوظة.')),
    tst2: () => toast(L('Statement queued for 412 households', 'كشف في الانتظار لـ٤١٢ عائلة'), L('You will be told when the PDFs are ready.', 'ستُبلَّغ عندما تجهز الملفات.'), 'success'),
    tst3: () => toast(L('Saved on this computer only', 'حُفظ على هذا الحاسوب فقط'), L('It will sync when the connection returns.', 'سيُزامَن عند عودة الاتصال.'), 'warning'),
    tst4: () => toast(L('18 of 412 WhatsApp messages failed', 'فشل ١٨ من ٤١٢ رسالة'), L('Numbers not registered on WhatsApp.', 'أرقام غير مسجّلة على واتساب.'), 'danger')
  };
  Object.entries(T).forEach(([id, fn]) => host.querySelector('#' + id)?.addEventListener('click', fn));
  host.querySelector('#sgm1')?.addEventListener('click', () => openModal({
    title: L('Archive Georges Haddad?', 'أرشفة جورج حدّاد؟'),
    body: <p className="t-body dim" style={{
      fontSize: "14px",
      lineHeight: "22px"
    }}>{L('He will disappear from lists, groups and messaging. Sacrament records, giving history and certificates are all kept and can be restored at any time.', 'سيختفي من اللوائح والمجموعات والمراسلة. وتبقى سجلات الأسرار وتاريخ التقدمات والشهادات محفوظة وقابلة للاسترجاع في أي وقت.')}</p>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-danger" style={{
        marginInlineStart: "auto"
      }} data-act="archive-specimen">{L('Archive', 'أرشفة')}</button></>
  }));
  host.querySelector('#sgm2')?.addEventListener('click', () => deleteGuard(person('p1'), {
    dry: true
  }));
  host.querySelector('[data-split="sg1"]')?.addEventListener('click', newPersonDrawer);
  host.querySelector('[data-splitmenu="sg1"]')?.addEventListener('click', e => openMenu(e.currentTarget, [{
    label: L('New parishioner', 'مؤمن جديد'),
    icon: 'people',
    fn: newPersonDrawer
  }, {
    label: L('New household', 'عائلة جديدة'),
    icon: 'family',
    fn: () => CR.create('household')
  }, {
    label: L('Import CSV', 'استيراد CSV'),
    icon: 'export',
    fn: () => go('people/import')
  }], {
    width: 220
  }));
  host.querySelector('#sgm3')?.addEventListener('click', () => openDrawer({
    title: L('New contribution', 'مساهمة جديدة'),
    sub: L('Session 214 · envelope entry', 'الجلسة ٢١٤ · إدخال مظروف'),
    body: <>{<C.Field label={L('Envelope no.', 'رقم المظروف')} value='0142' dir='ltr' />}{" "}{<C.PersonPicker label={L('Given by', 'المتبرّع')} id='sgd3' />}{" "}{<C.CurrencyField label={L('Amount', 'المبلغ')} value='50.00' id='sgd3c' />}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<span className="t-caption dim" style={{
        marginInlineStart: "auto"
      }}>{L('Draft saved', 'حُفظت المسوّدة')}</span>{" "}<button className="btn btn-primary" data-act="env-add">{L('Save & add next', 'حفظ وإضافة التالي')}</button></>,
    onMount(el) {}
  }));
  host.querySelector('#sgm4')?.addEventListener('click', () => openDrawer({
    large: true,
    title: L('Large drawer — 720', 'درج كبير — ٧٢٠'),
    sub: L('Used where a form needs two columns or a preview sits beside the fields.', 'يُستعمل حين تحتاج الاستمارة عمودين أو معاينة إلى جانب الحقول.'),
    body: <><div className="formgrid"><C.Field label={L('Arabic name', 'الاسم العربي')} ar={true} dir='rtl' />{" "}<C.Field label={L('English name', 'الاسم الإنكليزي')} /></div><C.AddressCascade /></>,
    foot: <button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>,
    onMount(el) {}
  }));
  host.querySelector('#sgm5')?.addEventListener('click', () => openModal({
    title: L('Leave without saving?', 'المغادرة بلا حفظ؟'),
    body: <p className="t-body dim" style={{
      fontSize: "14px",
      lineHeight: "22px"
    }}>{L('You changed the Arabic name and the rite. A draft is kept on this computer for 7 days.', 'غيّرتَ الاسم العربي والطقس. وتُحفظ مسوّدة على هذا الحاسوب ٧ أيام.')}</p>,
    foot: <><button className="btn btn-danger-quiet" data-close="">{L('Discard', 'تجاهل')}</button>{" "}<button className="btn btn-secondary" data-close="">{L('Keep editing', 'متابعة التعديل')}</button>{" "}<button className="btn btn-primary" style={{
        marginInlineStart: "auto"
      }} data-act="save">{L('Save & leave', 'حفظ ومغادرة')}</button></>
  }));
  host.querySelector('#sgcmd')?.addEventListener('click', () => document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'k',
    metaKey: true,
    bubbles: true
  })));
};