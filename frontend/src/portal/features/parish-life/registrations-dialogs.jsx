/* Registration-form dialogs: a new form, its fields, and registering a participant. */
import { Select } from '../../ui/components.jsx';
import { paint } from '../../ui/html.js';
import { t, fmtDate } from '../../../lib/i18n.js';
import { is } from '../../model/store.js';
import { Icon, toast, openDrawer, openModal, closeOverlays, openMenu } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { persist } from '../../model/persist.js';
import { participantForm } from './registration-forms.jsx';
import {
  eligibleEvents,
  eventById,
  selectedRegistration,
  selectRegistration,
  linkedEvent
} from '../../model/event-workflows.js';
import { ok, refresh, today, val } from '../../shared/dialog-helpers.jsx';
import { need } from '../../shared/dialogs.jsx';

const L = (en, ar) => t(en, ar);

export function formNew() {
  /* An event that is not in the calendar yet can be described right here; it is created together
     with the form, so cancelling the drawer leaves nothing half-made behind. */
  const canMakeEvent = is('priest', 'secretary');
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  let draft = null;
  const place = id => {
    const v = D.venue(id);
    return v ? L(v.name, v.ar || v.name) : '';
  };
  const hm = x => {
    const [h, m] = String(x || '0:0')
      .split(':')
      .map(Number);
    return h * 60 + m;
  };
  const options = () => (
    <>
      <option value="">{L('Select an event', 'اختر حدثاً')}</option>{' '}
      {draft ? (
        <option value="__new__">
          {L('New', 'جديد')}: {draft.title} · {draft.d} · {place(draft.venue)}
        </option>
      ) : (
        ''
      )}{' '}
      {eligibleEvents().map((e, i) => (
        <option key={i} value={e.id}>
          {L(e.title, e.titleAr)} · {e.d} · {place(e.venue)}
        </option>
      ))}
    </>
  );
  const KINDS = [
    ['event', L('Parish event', 'حدث رعوي')],
    ['group', L('Group activity', 'نشاط مجموعة')],
    ['sacr', L('Sacrament celebration', 'احتفال بسرّ')]
  ];
  openDrawer({
    title: L('New registration form', 'استمارة تسجيل جديدة'),
    sub: L(
      'Registration signs someone up for a selected event. Check-in records their arrival at that event.',
      'التسجيل يضيف شخصاً إلى حدث محدّد، والتسجيل عند الباب يثبت وصوله إليه.'
    ),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="rf_e">
            {L('Event', 'الحدث')}
            <span className="req">*</span>
          </label>
          <Select id="rf_e">{options()}</Select>
        </div>{' '}
        <div className="help" id="rf_context">
          {L(
            'Choose the event before creating its registration form.',
            'اختر الحدث قبل إنشاء استمارة التسجيل الخاصة به.'
          )}
        </div>{' '}
        {canMakeEvent ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-dense"
              id="rf_newev"
              aria-expanded="false"
              aria-controls="rf_evbox"
              style={{ margin: '2px 0 14px', paddingInline: '8px' }}
            >
              <Icon name="plus" size={15} />
              <span>{L('The event isn’t listed — create it here', 'الحدث غير موجود؟ أنشئه هنا')}</span>
            </button>{' '}
            <div className="inlinecard" id="rf_evbox" hidden>
              <div className="inlinecard-h">
                <b>{L('New event', 'حدث جديد')}</b>{' '}
                <span className="t-caption dim">
                  {L(
                    'It is added to the calendar when you create this form.',
                    'يُضاف إلى الرزنامة حين تُنشئ هذه الاستمارة.'
                  )}
                </span>
              </div>{' '}
              <C.Field
                label={L('Event title', 'عنوان الحدث')}
                req={true}
                id="ne_t"
                ph={L('Youth retreat', 'خلوة الشبيبة')}
              />{' '}
              <div className="formgrid">
                <C.Field label={L('Date', 'التاريخ')} type="date" req={true} id="ne_d" value="" />{' '}
                <div className="formrow">
                  <label className="label" htmlFor="ne_v">
                    {L('Room', 'القاعة')}
                  </label>
                  <Select id="ne_v">
                    {D.VENUES.map((v, i) => (
                      <option key={i} value={v.id}>
                        {place(v.id)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>{' '}
              <div className="formgrid">
                <C.Field label={L('From', 'من')} type="time" id="ne_from" value="18:00" />{' '}
                <C.Field label={L('To', 'إلى')} type="time" id="ne_to" value="20:00" />
              </div>{' '}
              <div className="formrow">
                <label className="label" htmlFor="ne_k">
                  {L('Kind of event', 'نوع الحدث')}
                </label>
                <Select id="ne_k">
                  {KINDS.map(([k, lab], i) => (
                    <option key={i} value={k}>
                      {lab}
                    </option>
                  ))}
                </Select>{' '}
                <span className="help">
                  {L(
                    'Masses are not registered for, so they are not offered here.',
                    'لا يُسجَّل للقداديس، لذلك لا تظهر هنا.'
                  )}
                </span>
              </div>{' '}
              <div className="formrow" id="ne_group_row" hidden>
                <label className="label" htmlFor="ne_group">
                  {L('Group', 'المجموعة')}
                </label>
                <Select id="ne_group">
                  <option value="">{L('Choose a group', 'اختر مجموعة')}</option>
                  {D.GROUPS.map((g, i) => (
                    <option key={i} value={g.id}>
                      {L(g.name, g.ar)}
                    </option>
                  ))}
                </Select>
              </div>{' '}
              <div id="ne_clash" />{' '}
              <div className="inlinecard-acts">
                <button type="button" className="btn btn-secondary btn-dense" id="ne_cancel">
                  {L('Cancel', 'إلغاء')}
                </button>{' '}
                <button type="button" className="btn btn-primary btn-dense" id="ne_ok">
                  <Icon name="check" size={15} />
                  {L('Use this event', 'استعمل هذا الحدث')}
                </button>
              </div>
            </div>
          </>
        ) : (
          ''
        )}{' '}
        <div className="formgrid">
          <C.Stepper label={L('Capacity', 'السعة')} value={60} id="rf_cap" />{' '}
          <C.Field label={L('Closes', 'يقفل')} type="date" value={deadline.toLocaleDateString('sv-SE')} id="rf_dl" />
        </div>{' '}
        <C.Field label={L('Fee', 'الرسم')} id="rf_fee" type="number" value={0} />{' '}
        <div className="formrow">
          <label className="label" htmlFor="rf_currency">
            {L('Currency', 'العملة')}
          </label>
          <Select id="rf_currency">
            <option>USD</option>
            <option>LBP</option>
          </Select>
        </div>{' '}
        <div className="registration-section">
          <h3>{L('Transport options', 'خيارات النقل')}</h3>
          <C.CheckRow label={L('Allow own transport', 'السماح بالنقل الخاص')} id="rf_own" checked={true} />
          <C.CheckRow label={L('Offer parish bus', 'توفير باص الرعية')} id="rf_bus" />
          <C.Field
            label={L('Bus fee (event currency)', 'رسم الباص (عملة الحدث)')}
            id="rf_bus_fee"
            type="number"
            value={0}
          />
        </div>{' '}
        <div className="stack" style={{ gap: '10px' }}>
          <C.CheckRow label={L('Household registration', 'تسجيل عائلي')} checked={true} id="rf_household" />{' '}
          <C.CheckRow
            label={L('Waiting list once full', 'لائحة انتظار عند الامتلاء')}
            checked={true}
            id="rf_waitlist"
          />{' '}
          <C.CheckRow
            label={L('Parental consent for under-18s', 'موافقة الأهل لمن دون ١٨')}
            checked={true}
            id="rf_consent"
          />
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="rf_go" style={{ marginInlineStart: 'auto' }}>
          {L('Create form', 'إنشاء الاستمارة')}
        </button>
      </>
    ),
    onMount(el) {
      const sel = el.querySelector('#rf_e'),
        box = el.querySelector('#rf_evbox'),
        opener = el.querySelector('#rf_newev');
      const context = () => {
        const e = sel.value === '__new__' ? draft : eventById(sel.value);
        el.querySelector('#rf_context').textContent = e
          ? `${sel.value === '__new__' ? L('New event, created with this form', 'حدث جديد يُنشأ مع هذه الاستمارة') + ' — ' : ''}${L(e.title, e.titleAr || e.title)} · ${e.d} ${e.t}${e.to ? `–${e.to}` : ''} · ${place(e.venue)}`
          : L(
              'Choose the event before creating its registration form.',
              'اختر الحدث قبل إنشاء استمارة التسجيل الخاصة به.'
            );
      };
      sel.addEventListener('change', context);
      if (box) {
        const v = q => el.querySelector(q).value;
        el.querySelector('#ne_k').addEventListener('change', () => {
          el.querySelector('#ne_group_row').hidden = v('#ne_k') !== 'group';
        });
        /* the room is checked against the calendar, room bookings (with their set-up time) and maintenance blocks */
        const showClash = () => {
          const d = v('#ne_d'),
            from = v('#ne_from'),
            to = v('#ne_to'),
            room = v('#ne_v');
          const block = d && D.MAINTENANCE.find(m => m.venue === room && m.from <= d && d <= m.to);
          const ev =
            d &&
            D.EVENTS.find(
              x =>
                x.venue === room &&
                x.d === d &&
                x.kind !== 'pending' &&
                hm(x.t) < hm(to) &&
                hm(from) < (x.to ? hm(x.to) : hm(x.t) + (x.kind === 'mass' ? 60 : 90))
            );
          const res =
            d &&
            D.RESERVATIONS.find(
              r =>
                r.venue === room &&
                r.date === d &&
                r.status !== 'rejected' &&
                hm(r.from) - (+r.setup || 0) < hm(to) &&
                hm(from) < hm(r.to)
            );
          const c = ev
            ? { title: L(ev.title, ev.titleAr || ev.title), at: ev.t }
            : res
              ? { title: L(res.title, res.titleAr || res.title), at: res.from }
              : null;
          paint(
            el.querySelector('#ne_clash'),
            !d ? (
              ''
            ) : d < today ? (
              <C.InlineAlert
                tone="warning"
                title={L('That day has passed', 'هذا اليوم مضى')}
                body={L('Choose today or a later date.', 'اختر اليوم أو تاريخاً لاحقاً.')}
              />
            ) : hm(from) >= hm(to) ? (
              <C.InlineAlert
                tone="warning"
                title={L('The event ends before it starts', 'ينتهي الحدث قبل أن يبدأ')}
                body={L('Check the two times.', 'تحقّق من الوقتين.')}
              />
            ) : block ? (
              <C.InlineAlert
                tone="warning"
                title={L(`${place(room)} is closed for maintenance`, `${place(room)} مغلقة للصيانة`)}
                body={L(
                  `${block.why} · ${fmtDate(block.from)} – ${fmtDate(block.to)}. Pick another room or day.`,
                  `${block.whyAr || block.why} · ${fmtDate(block.from)} – ${fmtDate(block.to)}. اختر قاعة أو يوماً آخر.`
                )}
              />
            ) : c ? (
              <C.InlineAlert
                tone="warning"
                title={L(`${place(room)} is taken`, `${place(room)} محجوزة`)}
                body={L(
                  `${c.title} is there from ${c.at}. Pick another room or time.`,
                  `${c.title} فيها من ${c.at}. اختر قاعة أو وقتاً آخر.`
                )}
              />
            ) : (
              <C.InlineAlert
                tone="success"
                title={L('The room is free', 'القاعة متاحة')}
                body={L(`${place(room)} is free at that time.`, `${place(room)} متاحة في ذلك الوقت.`)}
              />
            )
          );
        };
        ['#ne_d', '#ne_from', '#ne_to', '#ne_v'].forEach(q =>
          el.querySelector(q).addEventListener('change', showClash)
        );
        const toggle = open => {
          box.hidden = !open;
          opener.setAttribute('aria-expanded', String(open));
          if (open) el.querySelector('#ne_t').focus();
        };
        opener.addEventListener('click', () => toggle(box.hidden));
        el.querySelector('#ne_cancel').addEventListener('click', () => toggle(false));
        el.querySelector('#ne_ok').addEventListener('click', () => {
          if (v('#ne_k') === 'group' && !v('#ne_group'))
            return toast(L('Choose a group', 'اختر مجموعة'), '', 'warning');
          if (
            ![
              need(el, '#ne_t', L('Give the event a title', 'أعطِ الحدث عنواناً')),
              need(
                el,
                '#ne_d',
                L('Choose today or a later date', 'اختر اليوم أو تاريخاً لاحقاً'),
                d => !!d && d >= today
              ),
              need(el, '#ne_to', L('Ends before it starts', 'ينتهي قبل أن يبدأ'), to => hm(to) > hm(v('#ne_from')))
            ].every(Boolean)
          )
            return;
          const title = v('#ne_t').trim();
          draft = {
            title,
            titleAr: title,
            d: v('#ne_d'),
            t: v('#ne_from'),
            to: v('#ne_to'),
            venue: v('#ne_v'),
            kind: v('#ne_k'),
            groupId: v('#ne_group')
          };
          paint(sel, options());
          sel.value = '__new__';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          opener.querySelector('span').textContent = L('Change the new event', 'عدّل الحدث الجديد');
          toggle(false);
          context();
        });
      }
      el.querySelector('#rf_go').addEventListener('click', async () => {
        let e = sel.value === '__new__' ? draft : eventById(sel.value);
        if (
          !e &&
          !need(
            el,
            '#rf_e',
            canMakeEvent
              ? L('Choose the event, or create it here first', 'اختر الحدث، أو أنشئه هنا أولاً')
              : L('Choose the event', 'اختر الحدث'),
            () => false
          )
        )
          return;
        if (e === draft) {
          e = { id: 'ev' + Date.now().toString(36), ...draft };
          D.EVENTS.push(e);
          const cat = {
            event: ['Parish life', 'حياة الرعية'],
            group: ['Formation', 'التنشئة'],
            sacr: ['Sacrament', 'سرّ']
          }[e.kind];
          D.EVENT_DETAIL[e.id] = {
            ...D.eventInfo(e),
            cat: cat[0],
            catAr: cat[1],
            cap: +val(el, '#rf_cap') || 60,
            visibility: e.kind === 'group' ? 'groups' : e.kind === 'sacr' ? 'confidential' : 'public',
            visibleGroupIds: e.kind === 'group' ? [e.groupId] : [],
            priestIds: []
          };
        }
        const form = {
          id: 'rg' + Date.now(),
          eventId: e.id,
          event: e.title,
          eventAr: e.titleAr,
          open: true,
          cap: +val(el, '#rf_cap') || 60,
          taken: 0,
          currency: val(el, '#rf_currency'),
          transportOptions: [
            ...(el.querySelector('#rf_own').checked
              ? [{ id: 'own', name: 'Own transport', nameAr: 'نقل خاص', fee: 0 }]
              : []),
            ...(el.querySelector('#rf_bus').checked
              ? [{ id: 'bus', name: 'Parish bus', nameAr: 'باص الرعية', fee: Number(val(el, '#rf_bus_fee')) || 0 }]
              : [])
          ],
          fee: parseFloat(val(el, '#rf_fee')) || 0,
          deadline: val(el, '#rf_dl'),
          waiting: 0,
          fields: [],
          discounts: [],
          installments: [],
          household: el.querySelector('#rf_household').checked,
          waitingList: el.querySelector('#rf_waitlist').checked,
          parentalConsent: el.querySelector('#rf_consent').checked
        };
        D.REGISTRATIONS.unshift(form);
        selectRegistration(form.id);
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(
          sel.value === '__new__'
            ? L('Event and form created', 'أُنشئ الحدث والاستمارة')
            : L('Form created and open', 'أُنشئت الاستمارة وفُتحت'),
          `${L(e.title, e.titleAr)} · ${e.d}`
        );
      });
    }
  });
}

export function registerParticipant() {
  participantForm(selectedRegistration());
}

export function fieldAdd() {
  const form = selectedRegistration();
  if (!form || !linkedEvent(form))
    return toast(L('Select a linked registration form', 'اختر استمارة مرتبطة بحدث'), '', 'warning');
  openModal({
    title: L('Add a field', 'إضافة حقل'),
    body: (
      <>
        <div className="formgrid">
          <C.Field label={L('Label (English)', 'التسمية (إنكليزي)')} req={true} id="ff_en" />{' '}
          <C.Field label={L('Label (Arabic)', 'التسمية (عربي)')} dir="rtl" ar={true} id="ff_ar" />
        </div>{' '}
        <div className="formrow">
          <label htmlFor="ff_t" className="label">
            {L('Type', 'النوع')}
          </label>
          <Select id="ff_t">
            <option value="text">{L('Short text', 'نصّ قصير')}</option>
            <option value="choice">{L('Choice', 'اختيار')}</option>
            <option value="date">{L('Date', 'تاريخ')}</option>
            <option value="file">{L('File', 'ملف')}</option>
            <option value="consent">{L('Consent', 'موافقة')}</option>
            <option value="restricted">{L('Restricted (medical)', 'مقيّد (طبي)')}</option>
          </Select>
        </div>{' '}
        <C.CheckRow label={L('Required', 'إلزامي')} />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="ff_go" style={{ marginInlineStart: 'auto' }}>
          {L('Add field', 'إضافة الحقل')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#ff_go').addEventListener('click', async () => {
        if (!need(el, '#ff_en', L('Give it a label', 'أعطه تسمية'))) return;
        const en = val(el, '#ff_en');
        form.fields.push([
          en,
          val(el, '#ff_ar') || en,
          el.querySelector('#ff_t').value,
          el.querySelector('.check input').checked,
          '',
          ''
        ]);
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Field added', 'أُضيف الحقل'), en);
      });
    }
  });
}

export function fieldMenu(btn, i) {
  const f = selectedRegistration()?.fields;
  if (!f) return;
  i = +i;
  openMenu(btn, [
    {
      label: L('Make required', 'اجعله إلزامياً'),
      icon: 'check',
      fn: async () => {
        f[i][3] = true;
        if (!(await persist())) return;
        refresh();
        ok(L('Now required', 'صار إلزامياً'));
      }
    },
    {
      label: L('Move up', 'نقل للأعلى'),
      icon: 'chevL',
      fn: async () => {
        if (i > 0) {
          [f[i - 1], f[i]] = [f[i], f[i - 1]];
          if (await persist()) refresh();
        }
      }
    },
    { sep: true },
    {
      label: L('Remove field', 'إزالة الحقل'),
      icon: 'trash',
      danger: true,
      fn: async () => {
        const [x] = f.splice(i, 1);
        if (!(await persist())) return;
        refresh();
        ok(L('Field removed', 'أُزيل الحقل'), L(x[0], x[1]));
      }
    }
  ]);
}
