/* Writing to people: broadcast drafts and templates (saved through ParishLife.Api and kept in the app),
   direct messages to a person, scheduling, automations, reminders and ready-made posters.
   Main functions: compose, broadcastForm, templateForm, scheduleForm, automationForm, ArabicFields,
   designTemplate, useSubmit, reload, remind, broadcast.

   Broadcasts are stored in the app for their recipients only; email, SMS and push have no provider, so
   nothing here claims to send anything outside ParishLife. */
import { useEffect, useState } from 'react';
import { Select } from '../../ui/components.jsx';
import { paint } from '../../ui/html.js';
import { t } from '../../../lib/i18n.js';
import { Icon, toast, openDrawer, closeOverlays } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { session } from '../../model/api.js';
import { bus, S } from '../../model/store.js';
import { hydrate } from '../../model/persist.js';
import {
  saveBroadcast,
  saveTemplate,
  listMinistries,
  LANGUAGES,
  can,
  startConversation,
  scheduleBroadcast,
  saveAutomation
} from '../../model/modules/communications.js';
import { download } from '../../shell/actions.jsx';
import { ok, val } from '../../shared/dialog-helpers.jsx';
import { pickPerson } from '../records/people-dialogs.jsx';

const L = (en, ar) => t(en, ar);

export const LANGUAGE_NAMES = { en: ['English', 'الإنكليزية'], fr: ['French', 'الفرنسية'], ar: ['Arabic', 'العربية'] };

/* After a workflow call: show what the API now holds. */
export async function reload() {
  await hydrate();
  bus.refresh();
}

/* Busy and error state for a form that calls the API. */
export function useSubmit(run) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e?.preventDefault?.();
    setBusy(true);
    setError('');
    try {
      await run(e?.currentTarget ? Object.fromEntries(new FormData(e.currentTarget)) : {});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

export function LanguageSelect({ name = 'language', defaultValue = 'en', disabled = false }) {
  return (
    <Select name={name} defaultValue={defaultValue} disabled={disabled}>
      {LANGUAGES.map(l => (
        <option key={l} value={l}>
          {L(...LANGUAGE_NAMES[l])}
        </option>
      ))}
    </Select>
  );
}

/* The optional Arabic version of a non-Arabic text: saved as typed, both or neither, never copied. */
export function ArabicFields({ title = '', body = '', bodyMax = 20000 }) {
  return (
    <>
      <label className="formrow">
        <span className="label">{L('Arabic title (optional)', 'العنوان بالعربية (اختياري)')}</span>
        <input className="input" name="titleAr" maxLength="300" dir="rtl" defaultValue={title} />
      </label>
      <label className="formrow">
        <span className="label">{L('Arabic text (optional)', 'النص بالعربية (اختياري)')}</span>
        <textarea className="textarea" name="bodyAr" maxLength={bodyMax} rows="6" dir="rtl" defaultValue={body} />
      </label>
      <p className="help">
        {L(
          'Fill both or leave both empty. Leave them empty when the main text is already Arabic.',
          'املأ الحقلين أو اتركهما فارغين. اتركهما فارغين إذا كان النص الأساسي بالعربية.'
        )}
      </p>
    </>
  );
}

/* The ministries a broadcast or notice can be aimed at, read when the form opens. */
export function useMinistries(parishId) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let live = true;
    listMinistries(parishId).then(
      r => live && setList(r),
      () => live && setList([])
    );
    return () => {
      live = false;
    };
  }, [parishId]);
  return list;
}

/* A broadcast draft: all members, or the members of one ministry. Wording comes from an approved template
   or is typed here. A different staff member approves the saved draft before it can be stored for recipients. */
function BroadcastForm({ parish, broadcast, preset }) {
  const ministries = useMinistries(parish.id),
    templates = D.TEMPLATES.filter(x => x.status === 'approved');
  const [audience, setAudience] = useState(broadcast?.audience || preset.audience || 'Members');
  const [templateId, setTemplateId] = useState(broadcast?.templateId || preset.templateId || '');
  const template = templates.find(x => x.id === templateId);
  const { error, busy, submit } = useSubmit(async q => {
    if (audience === 'Ministry' && !q.ministryId) throw new Error(L('Choose a ministry.', 'اختر الخدمة.'));
    await saveBroadcast(parish.id, {
      id: broadcast?.id,
      version: broadcast?.version,
      audience,
      ministryId: q.ministryId,
      templateId: templateId || null,
      title: (q.title || '').trim(),
      body: (q.body || '').trim(),
      language: q.language,
      titleAr: (q.titleAr || '').trim(),
      bodyAr: (q.bodyAr || '').trim()
    });
    closeOverlays();
    await reload();
    ok(
      L('Draft saved', 'حُفظت المسودة'),
      L(
        'Nothing has been delivered. A different staff member approves it, then it can be stored for its recipients.',
        'لم يُرسل شيء. يوافق عليها موظف آخر، ثم يمكن حفظها لمستلميها.'
      )
    );
  });
  return (
    <form onSubmit={submit}>
      <label className="formrow">
        <span className="label">{L('Audience', 'الجمهور')}</span>
        <Select value={audience} onChange={e => setAudience(e.target.value)} disabled={!!broadcast}>
          <option value="Members">{L('All members of the parish', 'كل أعضاء الرعية')}</option>
          <option value="Ministry">{L('The members of a ministry', 'أعضاء خدمة')}</option>
        </Select>
      </label>
      {audience === 'Ministry' ? (
        <label className="formrow">
          <span className="label">{L('Ministry', 'الخدمة')}</span>
          <Select name="ministryId" defaultValue={broadcast?.ministryId || preset.ministryId || ''} required>
            <option value="">
              {ministries ? L('Choose a ministry', 'اختر الخدمة') : L('Loading…', 'جارٍ التحميل…')}
            </option>
            {(ministries || []).map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      {templates.length ? (
        <label className="formrow">
          <span className="label">{L('Approved template', 'قالب معتمد')}</span>
          <Select value={templateId} onChange={e => setTemplateId(e.target.value)}>
            <option value="">{L('Write it here', 'اكتبها هنا')}</option>
            {templates.map(x => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      {template ? (
        <div className="panel" style={{ marginBottom: '14px' }}>
          <div className="panel-b">
            <b>{template.title}</b>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: '8px' }} dir="auto">
              {template.body}
            </div>
            <p className="help">{L('The template’s wording is copied when you save.', 'يُنسخ نص القالب عند الحفظ.')}</p>
          </div>
        </div>
      ) : (
        <>
          <label className="formrow">
            <span className="label">{L('Language', 'اللغة')}</span>
            <LanguageSelect defaultValue={broadcast?.language || preset.language || 'en'} />
          </label>
          <label className="formrow">
            <span className="label">{L('Subject', 'الموضوع')}</span>
            <input
              className="input"
              name="title"
              required
              maxLength="300"
              defaultValue={broadcast?.subject || preset.subject || ''}
            />
          </label>
          <label className="formrow">
            <span className="label">{L('Message', 'الرسالة')}</span>
            <textarea
              className="textarea"
              name="body"
              required
              maxLength="20000"
              rows="8"
              defaultValue={broadcast?.body || preset.body || ''}
            />
          </label>
          <ArabicFields title={broadcast?.titleAr || ''} body={broadcast?.arabicBody || ''} />
        </>
      )}
      <p className="help">
        {L(
          'Sending stores one copy in the app for each recipient. Email, SMS and push are not set up, so nothing leaves ParishLife.',
          'يحفظ الإرسال نسخة داخل التطبيق لكل مستلم. البريد والرسائل القصيرة والإشعارات غير مفعّلة، فلا يخرج شيء من ParishLife.'
        )}
      </p>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Save draft', 'حفظ المسودة')}
      </button>
    </form>
  );
}

export function broadcastForm(broadcast = null, preset = {}) {
  const parish = session.parishes.find(p => p.id === session.parishId);
  if (!parish) return toast(L('No parish is selected', 'لم تُحدَّد رعية'), '', 'warning');
  openDrawer({
    title: broadcast ? L('Edit draft', 'تعديل المسودة') : L('New broadcast', 'بثّ جديد'),
    sub: L('Stored in the app for the people in the audience.', 'يُحفظ داخل التطبيق لمن في الجمهور.'),
    body: <BroadcastForm parish={parish} broadcast={broadcast} preset={preset} />
  });
}

function TemplateForm({ parish, template }) {
  const { error, busy, submit } = useSubmit(async q => {
    await saveTemplate(parish.id, {
      id: template?.id,
      version: template?.version,
      name: (q.name || '').trim(),
      title: (q.title || '').trim(),
      body: (q.body || '').trim(),
      language: q.language,
      titleAr: (q.titleAr || '').trim(),
      bodyAr: (q.bodyAr || '').trim()
    });
    closeOverlays();
    await reload();
    ok(
      L('Template saved as a draft', 'حُفظ القالب كمسودة'),
      L('A different staff member approves it.', 'يوافق عليه موظف آخر.')
    );
  });
  return (
    <form onSubmit={submit}>
      <label className="formrow">
        <span className="label">{L('Template name', 'اسم القالب')}</span>
        <input className="input" name="name" required maxLength="200" defaultValue={template?.name || ''} />
      </label>
      <label className="formrow">
        <span className="label">{L('Language', 'اللغة')}</span>
        <LanguageSelect defaultValue={template?.language || 'en'} />
      </label>
      <label className="formrow">
        <span className="label">{L('Subject', 'الموضوع')}</span>
        <input className="input" name="title" required maxLength="300" defaultValue={template?.title || ''} />
      </label>
      <label className="formrow">
        <span className="label">{L('Message', 'الرسالة')}</span>
        <textarea
          className="textarea"
          name="body"
          required
          maxLength="20000"
          rows="8"
          defaultValue={template?.body || ''}
        />
      </label>
      <ArabicFields title={template?.titleAr || ''} body={template?.bodyAr || ''} />
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Save draft', 'حفظ المسودة')}
      </button>
    </form>
  );
}

export function templateForm(template = null) {
  const parish = session.parishes.find(p => p.id === session.parishId);
  if (!parish) return toast(L('No parish is selected', 'لم تُحدَّد رعية'), '', 'warning');
  openDrawer({
    title: template ? L('Edit template', 'تعديل القالب') : L('New template', 'قالب جديد'),
    body: <TemplateForm parish={parish} template={template} />
  });
}

/* A direct message from office staff to a person in the people list. The API finds the person's one linked
   account in this parish (it needs people.read) and refuses when there is none; nothing is sent then. */
function DirectForm({ parish, personId }) {
  const { error, busy, submit } = useSubmit(async q => {
    const c = await startConversation(parish.id, q.subject.trim(), q.body.trim(), { personId });
    closeOverlays();
    ok(L('Message stored in the app', 'حُفظت الرسالة داخل التطبيق'), c.notificationOutcome?.meaning || '');
  });
  return (
    <form onSubmit={submit} data-direct-form="">
      <label className="formrow">
        <span className="label">{L('Subject', 'الموضوع')}</span>
        <input className="input" name="subject" required maxLength="300" />
      </label>
      <label className="formrow">
        <span className="label">{L('Message', 'الرسالة')}</span>
        <textarea className="textarea" name="body" required maxLength="10000" rows="8" />
      </label>
      <p className="help">
        {L(
          'It goes to the linked ParishLife account of this person and is read inside the app. Nothing is sent by email or SMS.',
          'تصل إلى حساب الشخص المرتبط في ParishLife وتُقرأ داخل التطبيق. لا يُرسل شيء بالبريد أو الرسائل القصيرة.'
        )}
      </p>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Send message', 'إرسال الرسالة')}
      </button>
    </form>
  );
}

/* Schedules an approved broadcast: it is stored in the app at that time, if the scheduler still has access. */
function ScheduleForm({ parish, m }) {
  const { error, busy, submit } = useSubmit(async q => {
    await scheduleBroadcast(parish.id, m.id, m.version, q.when);
    closeOverlays();
    await reload();
    ok(
      L('Scheduled', 'جُدول'),
      L(
        'Nothing is stored yet. At that time it is stored in the app for the audience as it is then.',
        'لم يُحفظ شيء بعد. في ذلك الوقت يُحفظ داخل التطبيق للجمهور كما يكون حينها.'
      )
    );
  });
  return (
    <form onSubmit={submit}>
      <label className="formrow">
        <span className="label">{L('Store it in the app at', 'حفظه داخل التطبيق في')}</span>
        <input className="input" name="when" type="datetime-local" required />
      </label>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Schedule', 'جدولة')}
      </button>
    </form>
  );
}
export function scheduleForm(m) {
  const parish = session.parishes.find(p => p.id === session.parishId);
  if (!parish) return;
  openDrawer({ title: L('Schedule this broadcast', 'جدولة هذا البثّ'), body: <ScheduleForm parish={parish} m={m} /> });
}

/* A bounded automation: one draft from an approved template at each due time, at most a set number of times. */
function AutomationForm({ parish, automation, done }) {
  const ministries = useMinistries(parish.id),
    templates = D.TEMPLATES.filter(x => x.status === 'approved');
  const [audience, setAudience] = useState(automation?.audience || 'Members');
  const { error, busy, submit } = useSubmit(async q => {
    await saveAutomation(parish.id, {
      id: automation?.id,
      version: automation?.version,
      name: q.name.trim(),
      nameAr: (q.nameAr || '').trim(),
      templateId: q.templateId,
      audience,
      ministryId: q.ministryId,
      recurrence: q.recurrence,
      firstRunAt: q.firstRunAt,
      maxRuns: q.maxRuns
    });
    closeOverlays();
    await done();
    ok(
      L('Automation saved', 'حُفظت الأتمتة'),
      L(
        'At each run it saves one draft. A different staff member approves it before anything is stored for members.',
        'في كل مرة تحفظ مسودة واحدة. يعتمدها موظف آخر قبل أن يُحفظ أي شيء للأعضاء.'
      )
    );
  });
  return (
    <form onSubmit={submit}>
      <label className="formrow">
        <span className="label">{L('Name', 'الاسم')}</span>
        <input className="input" name="name" required maxLength="200" defaultValue={automation?.name || ''} />
      </label>
      <label className="formrow">
        <span className="label">{L('Arabic name (optional)', 'الاسم بالعربية (اختياري)')}</span>
        <input className="input" name="nameAr" maxLength="200" dir="rtl" defaultValue={automation?.nameAr || ''} />
      </label>
      <label className="formrow">
        <span className="label">{L('Approved template', 'قالب معتمد')}</span>
        <Select name="templateId" required defaultValue={automation?.templateId || ''}>
          <option value="">{L('Choose a template', 'اختر قالباً')}</option>
          {templates.map(x => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="formrow">
        <span className="label">{L('Audience', 'الجمهور')}</span>
        <Select value={audience} onChange={e => setAudience(e.target.value)}>
          <option value="Members">{L('All members of the parish', 'كل أعضاء الرعية')}</option>
          <option value="Ministry">{L('The members of a ministry', 'أعضاء خدمة')}</option>
        </Select>
      </label>
      {audience === 'Ministry' ? (
        <label className="formrow">
          <span className="label">{L('Ministry', 'الخدمة')}</span>
          <Select name="ministryId" required defaultValue={automation?.ministryId || ''}>
            <option value="">{L('Choose a ministry', 'اختر الخدمة')}</option>
            {(ministries || []).map(x => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <label className="formrow">
        <span className="label">{L('Repeat', 'التكرار')}</span>
        <Select name="recurrence" defaultValue={automation?.recurrence || 'Weekly'}>
          <option value="Weekly">{L('Every week', 'كل أسبوع')}</option>
          <option value="Monthly">{L('Every month', 'كل شهر')}</option>
        </Select>
      </label>
      <label className="formrow">
        <span className="label">{L('First run', 'أول تشغيل')}</span>
        <input className="input" name="firstRunAt" type="datetime-local" required />
      </label>
      <label className="formrow">
        <span className="label">{L('Number of runs (1–52)', 'عدد المرات (1–52)')}</span>
        <input
          className="input"
          name="maxRuns"
          type="number"
          min="1"
          max="52"
          required
          defaultValue={automation?.maxRuns || 4}
        />
      </label>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Save automation', 'حفظ الأتمتة')}
      </button>
    </form>
  );
}
export function automationForm(automation, done) {
  const parish = session.parishes.find(p => p.id === session.parishId);
  if (!parish) return;
  openDrawer({
    title: automation ? L('Edit automation', 'تعديل الأتمتة') : L('New automation', 'أتمتة جديدة'),
    body: <AutomationForm parish={parish} automation={automation} done={done} />
  });
}

/* Other screens call compose() with a person's id, 'all' or 'group'. A group or all members becomes a
   broadcast draft. A person becomes a direct message from office staff (communications.manage). */
export function compose(audience = 'all', { subject = '', body = '', bodyAr = '', template = null } = {}) {
  if (audience === 'eparchy')
    return toast(
      L('Eparchy delivery is not connected', 'خدمة الإرسال إلى الأبرشية غير موصولة'),
      L('Use the Eparchy contact outside this application.', 'تواصل مع الأبرشية خارج هذا التطبيق.'),
      'warning'
    );
  if (audience !== 'all' && audience !== 'group') {
    const parish = session.parishes.find(p => p.id === session.parishId);
    if (parish && can(parish, 'communications.manage'))
      return openDrawer({
        title: L('Message a person', 'مراسلة شخص'),
        body: <DirectForm parish={parish} personId={audience} />
      });
    return toast(
      L('Direct messages are written by the parish office', 'يكتب مكتب الرعية الرسائل المباشرة'),
      L(
        'This account cannot write to a person directly. Nothing was sent.',
        'لا يستطيع هذا الحساب مراسلة شخص مباشرة. لم يُرسل شيء.'
      ),
      'warning'
    );
  }
  const group = audience === 'group' && S.route === 'groups' ? S.params[0] : '';
  broadcastForm(null, {
    audience: audience === 'group' ? 'Ministry' : 'Members',
    ministryId: group || '',
    templateId: template || '',
    subject,
    body: body || bodyAr,
    language: !body && bodyAr ? 'ar' : 'en'
  });
}

export function remind(context = 'rota') {
  toast(
    L('External reminders are not connected', 'التذكيرات الخارجية غير موصولة'),
    L(
      'Use in-app announcements for the group, or contact people outside ParishLife.',
      'استخدم المستجدات داخل التطبيق للمجموعة، أو تواصل خارج ParishLife.'
    ),
    'warning'
  );
}

export function broadcast() {
  toast(
    L('Emergency broadcast is not connected', 'البثّ الطارئ غير موصول'),
    L(
      'Use the parish’s established emergency contact procedure. No message was sent from this application.',
      'استخدم إجراء الطوارئ المعتمد في الرعية. لم يُرسَل شيء من التطبيق.'
    ),
    'warning'
  );
}

/** Ready-made parish design: fill date and place, then export the rendered design. */
export function designTemplate(i) {
  const tp = D.TEMPLATES[+i] || D.TEMPLATES[0];
  if (!tp)
    return toast(
      L('No template yet', 'لا قالب بعد'),
      L('Create a template first; a poster is made from its subject.', 'أنشئ قالباً أولاً؛ يُصنع الملصق من موضوعه.'),
      'warning'
    );
  const svg = (date, place, width = '600', height = '800') => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width={width} height={height}>
      <rect width="600" height="800" fill="#233B32" />
      <rect x="28" y="28" width="544" height="744" fill="none" stroke="#EDF0E8" strokeOpacity=".45" />{' '}
      <text x="300" y="130" fill="#EDF0E8" fontFamily="Inter,Arial" fontSize="18" letterSpacing="4" textAnchor="middle">
        {String(D.PARISH.name || '').toUpperCase()}
      </text>{' '}
      <text x="300" y="170" fill="#EDF0E8" fillOpacity=".7" fontFamily="Arial" fontSize="22" textAnchor="middle">
        {D.PARISH.nameAr}
      </text>{' '}
      <text x="300" y="380" fill="#FFFFFF" fontFamily="Inter,Arial" fontSize="52" fontWeight="600" textAnchor="middle">
        {tp.title || tp.name}
      </text>{' '}
      <line x1="220" y1="500" x2="380" y2="500" stroke="#EDF0E8" />{' '}
      <text x="300" y="560" fill="#FFFFFF" fontFamily="Inter,Arial" fontSize="26" textAnchor="middle">
        {date}
      </text>{' '}
      <text x="300" y="600" fill="#FFFFFF" fillOpacity=".75" fontFamily="Inter,Arial" fontSize="20" textAnchor="middle">
        {place}
      </text>{' '}
    </svg>
  );
  openDrawer({
    large: true,
    title: tp.name,
    sub: L(
      'The parish name is already on it. Fill in the date and place, then download.',
      'اسم الرعية موجود. املأ التاريخ والمكان ثم نزّل التصميم.'
    ),
    body: (
      <div className="grid g2" style={{ gap: '20px', alignItems: 'start' }}>
        <div>
          <C.Field label={L('Date and time', 'التاريخ والوقت')} value="" id="dgdate" />{' '}
          <C.Field label={L('Place', 'المكان')} value="" id="dgplace" />{' '}
          <C.InlineAlert
            tone="info"
            title={L('Print or share', 'اطبع أو شارك')}
            body={L(
              'The file is a vector, so it prints sharp at A4 or A3.',
              'الملف متّجهي، فيُطبع واضحاً على A4 أو A3.'
            )}
          />
        </div>{' '}
        <div id="dgprev" style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', boxShadow: 'var(--e2)' }} />
      </div>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <Select
          id="dgformat"
          aria-label={L('Download format', 'صيغة التنزيل')}
          style={{ width: 'auto', marginInlineStart: 'auto' }}
        >
          <option value="svg">SVG</option>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
        </Select>{' '}
        <button className="btn btn-primary" id="dgdl">
          <Icon name="export" size={16} />
          {L('Download', 'تنزيل')}
        </button>
      </>
    ),
    onMount(el) {
      /* the preview is drawn by React as the fields change; the download is that drawing at full size */
      const prev = el.querySelector('#dgprev');
      const draw = () => paint(prev, svg(val(el, '#dgdate'), val(el, '#dgplace'), '100%', undefined));
      const artworkOf = () => {
        const art = prev.querySelector('svg').cloneNode(true);
        art.setAttribute('width', '600');
        art.setAttribute('height', '800');
        return new XMLSerializer().serializeToString(art);
      };
      el.querySelectorAll('#dgdate,#dgplace').forEach(i2 => i2.addEventListener('input', draw));
      draw();
      el.querySelector('#dgdl').addEventListener('click', async () => {
        const format = val(el, '#dgformat'),
          base = tp.name.toLowerCase().replace(/\s+/g, '-');
        const artwork = artworkOf();
        if (format === 'svg') {
          download(`${base}.svg`, artwork, 'image/svg+xml');
          ok(L('Design downloaded', 'نُزّل التصميم'), `${base}.svg`);
          return;
        }
        const url = URL.createObjectURL(new Blob([artwork], { type: 'image/svg+xml;charset=utf-8' }));
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const canvas = document.createElement('canvas');
          canvas.width = 1200;
          canvas.height = 1600;
          const context = canvas.getContext('2d');
          if (format === 'jpeg') {
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
          const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.94));
          if (!blob) throw new Error('Could not render the image.');
          const link = document.createElement('a'),
            output = URL.createObjectURL(blob);
          link.href = output;
          link.download = `${base}.${format}`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(output), 1000);
          ok(L('Design downloaded', 'نُزّل التصميم'), link.download);
        } catch (error) {
          toast(L('Could not export image', 'تعذّر تصدير الصورة'), error.message, 'danger');
        } finally {
          URL.revokeObjectURL(url);
        }
      });
    }
  });
}

/** A row's own menu — edit, duplicate, and a destructive action kept last and apart. */
export function composeToPerson() {
  pickPerson({ title: L('Message a person', 'مراسلة شخص'), cta: L('Continue', 'متابعة'), onPick: p => compose(p.id) });
}
