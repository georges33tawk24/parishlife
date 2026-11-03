/* One person's record: profile, family, groups, sacraments, attendance, account and the activity
   linked to them. */
import { css, joinNodes, nodesOr } from '../../ui/html.js';
import { t, isAr, num, fmtDate, usd } from '../../../lib/i18n.js';
import { is, canSee, bus } from '../../model/store.js';
import {
  Icon,
  Panel,
  Who,
  Status,
  Pill,
  Table,
  Empty,
  openModal,
  closeOverlays,
  toast,
  TabBar,
  Avatar
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { persist } from '../../model/persist.js';
import { memberAction } from '../../model/member-data.js';
import { phoneShow } from '../../model/sacrament-requests.js';
import * as D from '../../model/data.js';
import {
  GROUPS,
  SACRAMENTS,
  PLEDGES,
  BATCH,
  PERSON_EXTRA,
  VOLUNTEERS,
  TODAY,
  GROUP_DETAIL,
  NOTES,
  FUNDS,
  person
} from '../../model/data.js';
import { hh, label, occupationField, onlineNew, phoneText, relLabel, riteLabel, unverified } from './people-shared.jsx';
import { familyTree } from './family-tree.jsx';
import { personMenu } from './people.jsx';
import { exportHouseholds } from './households.jsx';

const skillOptions = () =>
  [
    ...new Set([
      ...Object.values(PERSON_EXTRA).flatMap(x => x.skills || []),
      ...VOLUNTEERS.flatMap(v => v.skills || [])
    ])
  ]
    .filter(Boolean)
    .sort();

function skillPicker(selected = []) {
  const options = [...new Set([...skillOptions(), ...selected])].sort();
  return (
    <div className="formrow">
      <label className="label" htmlFor="skill-search">
        {t('Skills', 'المهارات')}
      </label>{' '}
      <input
        className="input"
        type="search"
        id="skill-search"
        placeholder={t('Search existing skills', 'ابحث عن مهارة موجودة')}
      />{' '}
      <div className="choice-grid skill-choices" style={{ maxHeight: '180px', overflow: 'auto', marginTop: '8px' }}>
        {options.map(s => (
          <label className="check" data-skill-choice="">
            <input type="checkbox" defaultValue={s} defaultChecked={!!selected.includes(s)} />
            <span>{s}</span>
          </label>
        ))}
      </div>{' '}
      <label className="check" style={{ marginTop: '10px' }}>
        <input type="checkbox" id="skill-other" />
        <span>{t('Other skill', 'مهارة أخرى')}</span>
      </label>{' '}
      <input
        className="input"
        id="skill-custom"
        maxLength="80"
        placeholder={t('Enter another skill', 'أدخل مهارة أخرى')}
        style={{ marginTop: '7px' }}
        disabled
      />
    </div>
  );
}

function wireSkillPicker(el) {
  el.querySelector('#skill-search')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLocaleLowerCase();
    el.querySelectorAll('[data-skill-choice]').forEach(row => {
      row.hidden = !row.textContent.toLocaleLowerCase().includes(q);
    });
  });
  el.querySelector('#skill-other')?.addEventListener('change', e => {
    const custom = el.querySelector('#skill-custom');
    custom.disabled = !e.target.checked;
    if (e.target.checked) custom.focus();
  });
}

function selectedSkills(el) {
  const selected = [...el.querySelectorAll('[data-skill-choice] input:checked')].map(x => x.value);
  const other = el.querySelector('#skill-other')?.checked ? el.querySelector('#skill-custom').value.trim() : '';
  return [...new Set([...selected, ...(other ? [other] : [])])];
}

const signInName = v => (/^\+\d+$/.test(v) ? phoneShow(v) : v);

const ACCESS = {
  super_admin: ['Super Admin', 'المشرف العام'],
  diocesan_admin: ['Archdiocese Admin', 'مدير الأبرشية'],
  parish_admin: ['Parish Admin', 'مدير الرعية'],
  secretary: ['Secretary', 'أمين السر'],
  priest: ['Parish priest', 'كاهن الرعية'],
  treasurer: ['Treasurer', 'أمين الصندوق'],
  member: ['Member portal', 'بوّابة المؤمنين'],
  leader: ['Member portal · ministry leader', 'بوّابة المؤمنين · مسؤول خدمة']
};

/* ---------------- person detail ---------------- */
const PTABS = pid => [
  ['', 'Profile', 'الملف'],
  ['family', 'Family', 'العائلة'],
  ['groups', 'Groups', 'المجموعات'],
  ['sacraments', 'Sacraments', 'الأسرار', SACRAMENTS.filter(x => x.person === pid).length],
  ['attendance', 'Group attendance', 'حضور المجموعات'],
  ['giving', 'Giving', 'التقدمات'],
  ['activity', 'Activity', 'النشاط'],
  ['notes', 'Notes', 'ملاحظات'],
  ['files', 'Files', 'ملفات'],
  ['consent', 'Consent', 'الموافقات']
];

export function personView(id, tab = '') {
  const p = person(id);
  if (!p)
    return (
      <Empty
        glyph="people"
        title={t('No such record', 'لا سجلّ بهذا الرقم')}
        body={t('The link may be stale.', 'قد يكون الرابط قديماً.')}
        action={
          <a className="btn btn-primary" href="#/people">
            {t('Back to people', 'العودة إلى المؤمنين')}
          </a>
        }
      />
    );
  const house = hh(p.hh),
    x = PERSON_EXTRA[p.id] || {};
  const tabs = PTABS(p.id).filter(
    tb =>
      (tb[0] !== 'giving' || canSee('giving')) &&
      (tb[0] !== 'notes' || is('priest')) &&
      (tb[0] !== 'groups' || canSee('groups')) &&
      (tb[0] !== 'sacraments' || canSee('sacraments'))
  );
  const head = (
    <>
      <div className="pagehead">
        <div className="entityhead" style={{ width: '100%' }}>
          <span style={{ marginTop: '22px', display: 'flex' }}>
            <Avatar p={p} cls="avatar-xl" />
          </span>{' '}
          <div className="id">
            <nav className="crumbs">
              <a href="#/people">{t('People', 'المؤمنون')}</a>
              <span className="sep">/</span>
              <span>{label(p)}</span>
            </nav>{' '}
            <h1 style={{ font: '600 26px/34px var(--sans)', letterSpacing: '-.02em' }}>
              {label(p)} <Status k={p.status} />
              {p.rite ? <span className="pill">{riteLabel(p.rite)}</span> : ''}
              {onlineNew(p)}
            </h1>{' '}
            <div className="meta">
              {joinNodes(
                [
                  p.ar && p.ar !== p.lat ? (
                    <span style={{ fontFamily: 'var(--arabic)' }} dir="auto">
                      {p.ar}
                    </span>
                  ) : (
                    ''
                  ),
                  house?.envelope ? (
                    <>
                      {t('Offering-envelope identifier', 'رمز مظروف العطاء')}{' '}
                      <span className="mono">{house.envelope}</span>
                    </>
                  ) : (
                    ''
                  ),
                  p.town ? t(p.town, p.townAr) : ''
                ].filter(Boolean),
                ' · '
              )}
            </div>
          </div>{' '}
          <div className="acts">
            <button className="btn btn-secondary" data-act={`compose:${p.id}`}>
              <Icon name="msg" size={17} />
              {t('Message', 'مراسلة')}
            </button>{' '}
            <button className="btn btn-secondary" data-act="print">
              <Icon name="print" size={17} />
              {t('Print card', 'طباعة بطاقة')}
            </button>{' '}
            <button className="btn btn-primary" data-act={`person-edit:${p.id}`}>
              <Icon name="edit" size={17} />
              {t('Edit record', 'تعديل السجل')}
            </button>{' '}
            <C.IconBtn ico="dots" label={t('More actions', 'إجراءات أخرى')} data-pkebab="" />
          </div>
        </div>
      </div>{' '}
      <TabBar base={'person/' + id} items={tabs} active={tab} />
    </>
  );
  const T = {
    '': () => (
      <div className="splitview">
        <div className="stack" style={{ gap: '16px' }}>
          <Panel title={t('Record', 'السجل')}>
            <dl className="dl">
              <dt>{t('English name', 'الاسم الإنكليزي')}</dt>
              <dd>{p.lat}</dd>
              <dt>{t('Arabic name', 'الاسم العربي')}</dt>
              <dd style={{ fontFamily: 'var(--arabic)', fontSize: '16px' }}>{p.ar}</dd>
              <dt>{t('Born', 'الولادة')}</dt>
              <dd className="mono" dir="ltr">
                {p.born || '—'}
              </dd>
              <dt>{t('Rite', 'الطقس')}</dt>
              <dd>{p.rite ? riteLabel(p.rite) : '—'}</dd>
              <dt>{t('Phone', 'الهاتف')}</dt>
              <dd className="mono" dir="ltr">
                {phoneText(p.phone)}
              </dd>
              {p.email ? (
                <>
                  <dt>{t('Email', 'البريد الإلكتروني')}</dt>
                  <dd>
                    <bdi dir="ltr">{p.email}</bdi>
                  </dd>
                </>
              ) : (
                ''
              )}
              <dt>{t('Address', 'العنوان')}</dt>
              <dd>{house ? t(house.address, house.addressAr) : '—'}</dd>
              <dt>{t('Line of work', 'المهنة')}</dt>
              <dd>{x.occupation || '—'}</dd>
              <dt>{t('Language', 'اللغة')}</dt>
              <dd>{x.lang === 'ar' ? t('Arabic', 'العربية') : t('English', 'الإنكليزية')}</dd>
              <dt>{t('Reach them on', 'التواصل عبر')}</dt>
              <dd>
                {{ whatsapp: 'WhatsApp', sms: 'SMS', email: t('Email', 'بريد إلكتروني') }[x.channel] || 'WhatsApp'}
              </dd>
              <dt>{t('Blood type', 'زمرة الدم')}</dt>
              <dd className="mono">{x.blood || '—'}</dd>
              <dt>{t('Directory', 'الدليل')}</dt>
              <dd>{x.directory ? t('Listed, by consent', 'مدرَج بموافقته') : t('Not listed', 'غير مدرَج')}</dd>
            </dl>
          </Panel>{' '}
          <Panel title={t('Skills and important dates', 'المهارات والتواريخ المهمّة')}>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-dense" id="edit-profile-extra">
                <Icon name="edit" size={15} />
                {t('Edit skills and dates', 'تعديل المهارات والتواريخ')}
              </button>
            </div>{' '}
            <h4 className="t-ui">{t('Skills', 'المهارات')}</h4>{' '}
            <div className="row" style={{ gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
              {(x.skills || []).length ? (
                x.skills.map(s => <span className="chip">{s}</span>)
              ) : (
                <span className="dim">{t('No skills recorded.', 'لا مهارات مسجّلة.')}</span>
              )}
            </div>{' '}
            <div className="divider" /> <h4 className="t-ui">{t('Important dates', 'التواريخ المهمّة')}</h4>{' '}
            {nodesOr(
              (x.dates || []).map(([en, ar, d]) => (
                <div className="listrow" style={{ paddingInline: 0 }}>
                  <span className="grow">
                    <b>{t(en, ar)}</b>
                  </span>
                  <span className="mono dim">{d ? fmtDate(d) : '—'}</span>
                </div>
              )),
              <p className="t-caption dim">{t('No dates recorded.', 'لا تواريخ مسجّلة.')}</p>
            )}{' '}
            {(x.fields || []).length ? (
              <>
                <div className="divider" />
                <div className="ac-group" style={{ paddingInline: 0 }}>
                  {t('Parish fields', 'حقول الرعية')}
                </div>{' '}
                {x.fields.map(([en, ar, v]) => (
                  <div className="listrow" style={{ paddingInline: 0 }}>
                    <span className="grow">{t(en, ar)}</span>
                    <b>{v}</b>
                  </div>
                ))}
              </>
            ) : (
              ''
            )}
          </Panel>
        </div>{' '}
        <div className="sidecol">
          {accountPanel(p)}{' '}
          <Panel title={t('Household', 'العائلة')} tight={!!house}>
            {house ? (
              house.members
                .map(person)
                .filter(Boolean)
                .map(m => (
                  <a className="listrow" href={`#/person/${m.id}`}>
                    <Who p={m} />
                    <span className="grow" />{' '}
                    {m.id === house.head ? <Pill label={t('Head', 'ربّ العائلة')} tone="info" /> : ''}
                  </a>
                ))
            ) : (
              <Empty
                glyph="family"
                title={t('No household', 'لا عائلة')}
                body={t('Recorded on their own.', 'مسجّل بمفرده.')}
              />
            )}
          </Panel>
        </div>
      </div>
    ),
    family: () =>
      house ? (
        <div className="splitview">
          <div>
            <Panel
              title={t('Family tree', 'شجرة العائلة') + ' — ' + t(house.name, house.ar)}
              more={
                <>
                  <button className="btn btn-secondary btn-dense" data-household-export-id={house.id}>
                    <Icon name="export" size={15} />
                    {t('Export family', 'تصدير العائلة')}
                  </button>
                  <button className="btn btn-secondary btn-dense" data-act={`family-add:${house.id}`}>
                    <Icon name="plus" size={15} />
                    {t('Add family member', 'إضافة فرد')}
                  </button>
                </>
              }
            >
              {familyTree(house, p.id)}
            </Panel>{' '}
            <Panel title={t('Members and relationships', 'الأفراد والصلات')} tight={true}>
              {house.members
                .map(person)
                .filter(Boolean)
                .map(m => (
                  <div className="listrow">
                    <Who p={m} />
                    <span className="grow" />{' '}
                    <span className="dim t-caption">
                      {relLabel(m, house)}
                      {m.emergency ? ` · ${t('emergency contact', 'جهة طوارئ')}` : ''}
                    </span>{' '}
                    <C.IconBtn
                      ico="edit"
                      label={t('Edit relationship', 'تعديل الصلة')}
                      data-act={`relation-edit:${m.id}`}
                    />
                  </div>
                ))}
            </Panel>
          </div>{' '}
          <div className="sidecol">
            <Panel title={t('Emergency contacts', 'جهات الطوارئ')} tight={true}>
              {(() => {
                /* the people in the same household marked as emergency contacts, or its adults until someone is marked — never a child by default */
                const mates = (house?.members || [])
                  .filter(id => id !== p.id)
                  .map(person)
                  .filter(Boolean);
                const adult = m =>
                  !m.born || new Date(m.born) <= new Date(TODAY.getFullYear() - 18, TODAY.getMonth(), TODAY.getDate());
                const marked = mates.filter(m => m.emergency),
                  list = marked.length ? marked : mates.filter(adult);
                return list.length ? (
                  list.map(m => (
                    <div className="listrow">
                      <Who p={m} />
                      <span className="grow" /> <span className="t-caption dim">{relLabel(m, house)}</span>{' '}
                      <C.IconBtn
                        ico="edit"
                        label={t('Edit relationship', 'تعديل الصلة')}
                        data-act={`relation-edit:${m.id}`}
                      />
                    </div>
                  ))
                ) : (
                  <div className="panel-pad">
                    {house ? (
                      <Empty
                        glyph="family"
                        title={t('No adult to call yet', 'لا راشد للاتصال بعد')}
                        body={t(
                          'Add a parent or another adult relative, or mark someone in the household as an emergency contact.',
                          'أضف والداً أو قريباً راشداً، أو حدّد أحد أفراد العائلة جهة طوارئ.'
                        )}
                        action={
                          <button className="btn btn-secondary btn-dense" data-act={`family-add:${house.id}`}>
                            <Icon name="plus" size={15} />
                            {t('Add family member', 'إضافة فرد')}
                          </button>
                        }
                      />
                    ) : (
                      <Empty
                        glyph="family"
                        title={t('No one to call yet', 'لا أحد للاتصال بعد')}
                        body={t(
                          'Link this person to a household to choose their emergency contacts.',
                          'اربط هذا الشخص بعائلة لاختيار جهات الطوارئ.'
                        )}
                      />
                    )}
                  </div>
                );
              })()}
            </Panel>{' '}
            <Panel title={t('Authorised to collect children', 'المفوَّضون باستلام الأطفال')}>
              <p className="t-caption dim">
                {t(
                  'Managed on the check-in screen so the door team is the one that maintains it.',
                  'تُدار من شاشة التسجيل ليحافظ عليها فريق الباب نفسه.'
                )}
              </p>{' '}
              <a className="btn btn-secondary btn-dense" style={{ marginTop: '10px' }} href="#/checkin/pickup">
                {t('Open pickup list', 'فتح لائحة الاستلام')}
              </a>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="tabbody">
          <Empty
            glyph="family"
            title={t('Not linked to a household', 'غير مرتبط بعائلة')}
            body={t(
              'This person is recorded on their own. Link them to a household to draw their family and choose emergency contacts.',
              'هذا الشخص مسجّل بمفرده. اربطه بعائلة لرسم عائلته واختيار جهات الطوارئ.'
            )}
            action={
              <button className="btn btn-primary btn-dense" data-act={`family-link:${p.id}`}>
                <Icon name="family" size={15} />
                {t('Link to a household', 'ربط بعائلة')}
              </button>
            }
          />
        </div>
      ),
    sacraments: () => {
      const sacr = SACRAMENTS.filter(s => s.person === p.id);
      return sacr.length ? (
        <Table
          cols={[
            { label: t('Sacrament', 'السرّ') },
            { label: t('Register', 'القيد'), cls: 'shrink' },
            { label: t('Date', 'التاريخ') },
            { label: t('Status', 'الحالة'), cls: 'shrink' },
            { label: '', cls: 'shrink' }
          ]}
          rows={sacr.map(s => ({
            cells: [
              <b>{s.kind}</b>,
              <span className="mono">{s.reg}</span>,
              <span className="dim">{fmtDate(s.date)}</span>,
              <Status k={s.status} />,
              <a className="btn btn-secondary btn-dense" href={`#/certificate/${s.id}`}>
                {t('Certificate', 'الشهادة')}
              </a>
            ]
          }))}
        />
      ) : (
        <Empty
          glyph="sacr"
          title={t('No sacramental record', 'لا سجل أسرار')}
          body={t('Nothing registered in this parish.', 'لا شيء مسجّل في هذه الرعية.')}
        />
      );
    },
    groups: () => {
      const memberships = new Set(
        Object.entries(GROUP_DETAIL)
          .filter(([, d]) => d.roster?.some(r => r.p === p.id))
          .map(([gid]) => gid)
      );
      return (
        <Panel
          title={t('Parish groups', 'مجموعات الرعية')}
          tight={true}
          more={
            <button className="btn btn-secondary btn-dense" id="edit-person-groups">
              <Icon name="edit" size={15} />
              {t('Edit memberships', 'تعديل العضويات')}
            </button>
          }
        >
          {nodesOr(
            GROUPS.filter(g => memberships.has(g.id)).map(g => (
              <a className="listrow" href={`#/groups/${g.id}`}>
                <b className="grow">{t(g.name, g.ar)}</b>
                <span className="dim">{t(g.cat, g.catAr)}</span>
              </a>
            )),
            <p className="dim">{t('No group memberships.', 'لا عضوية في مجموعات.')}</p>
          )}
        </Panel>
      );
    },
    attendance: () => {
      const entries = GROUPS.flatMap(g =>
        (GROUP_DETAIL[g.id]?.meetings || [])
          .filter(m => m.attendance?.[p.id])
          .map(m => ({ group: g, meeting: m, mark: m.attendance[p.id] }))
      );
      return (
        <Panel title={t('Group meeting attendance', 'حضور اجتماعات المجموعات')} tight={true}>
          {entries.length ? (
            <Table
              cols={[
                { label: t('Group', 'المجموعة') },
                { label: t('Meeting', 'الاجتماع') },
                { label: t('Date', 'التاريخ') },
                { label: t('Attendance', 'الحضور') }
              ]}
              rows={entries.map(({ group, meeting, mark }) => ({
                cells: [
                  <a href={`#/groups/${group.id}`}>{t(group.name, group.ar)}</a>,
                  <a href={`#/groups/${group.id}/meetings`}>
                    {t(meeting.title || meeting.topic || 'Meeting', meeting.titleAr || meeting.topicAr || 'اجتماع')}
                  </a>,
                  fmtDate(meeting.date || meeting.d),
                  <Status k={mark} />
                ]
              }))}
            />
          ) : (
            <Empty
              glyph="groups"
              title={t('No group attendance recorded', 'لا حضور مجموعات مسجّلاً')}
              body={t(
                'Attendance is recorded only at group meetings and activities.',
                'يسجّل الحضور فقط في اجتماعات المجموعات وأنشطتها.'
              )}
            />
          )}
        </Panel>
      );
    },
    activity: () => {
      const entries = [
        ...SACRAMENTS.filter(s => s.person === p.id).map(s => ({
          date: s.date,
          label: t('Sacrament recorded', 'سُجّل سرّ'),
          detail: `${s.kind} · ${s.reg}`
        })),
        ...GROUPS.flatMap(g =>
          (GROUP_DETAIL[g.id]?.meetings || [])
            .filter(m => m.attendance?.[p.id])
            .map(m => ({
              date: m.date || m.d,
              label: t('Meeting attendance', 'حضور اجتماع'),
              detail: `${t(g.name, g.ar)} · ${m.attendance[p.id]}`
            }))
        )
      ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      return (
        <Panel title={t('Recorded activity', 'النشاط المسجّل')} tight={true}>
          {entries.length ? (
            <Table
              cols={[
                { label: t('Date', 'التاريخ') },
                { label: t('Activity', 'النشاط') },
                { label: t('Detail', 'التفاصيل') }
              ]}
              rows={entries.map(e => ({ cells: [fmtDate(e.date), e.label, e.detail] }))}
            />
          ) : (
            <Empty
              glyph="notes"
              title={t('No linked activity yet', 'لا نشاط مرتبط بعد')}
              body={t(
                'Sacraments and recorded group attendance appear here.',
                'تظهر هنا الأسرار وحضور المجموعات المسجّل.'
              )}
            />
          )}
        </Panel>
      );
    },
    giving: () => {
      const pledge = PLEDGES.find(z => z.p === p.id),
        gifts = BATCH.lines.filter(l => l.p === p.id);
      return (
        <div className="splitview">
          <div className="stack" style={{ gap: '16px' }}>
            <Panel title={t('Offering-envelope identifier', 'رمز مظروف العطاء')}>
              <b className="mono">{house?.envelope || '—'}</b>{' '}
              <p className="help">
                {t(
                  'This optional identifier belongs to the household. Membership does not make each person a donor.',
                  'هذا الرمز الاختياري يتبع العائلة. انتماء الشخص إليها لا يجعله متبرّعاً.'
                )}
              </p>
            </Panel>{' '}
            <Panel title={t('Contributions', 'المساهمات')} tight={true}>
              <Table
                cols={[
                  { label: t('Date', 'التاريخ') },
                  { label: t('Fund', 'الصندوق') },
                  { label: 'USD', cls: 'num' },
                  { label: 'L.L', cls: 'num' }
                ]}
                rows={gifts.map(line => ({
                  cells: [
                    <span className="mono dim">{fmtDate(BATCH.date)}</span>,
                    <span className="dim">
                      {t(
                        FUNDS.find(f => f.id === line.fund)?.name || line.fund,
                        FUNDS.find(f => f.id === line.fund)?.ar || line.fund
                      )}
                    </span>,
                    <span className="num">{line.usd ? usd(line.usd) : '—'}</span>,
                    <span className="num">{line.lbp ? num(line.lbp) : '—'}</span>
                  ]
                }))}
                empty={
                  <Empty
                    glyph="giving"
                    title={t(
                      'No attributed gifts in the current counting session',
                      'لا تقدمات منسوبة في جلسة العدّ الحالية'
                    )}
                    body={t(
                      'Only gifts explicitly attributed to this person appear here.',
                      'تظهر هنا فقط التقدمات المنسوبة إلى هذا الشخص صراحةً.'
                    )}
                  />
                }
              />
            </Panel>
          </div>{' '}
          <div className="sidecol">
            {pledge ? (
              <Panel title={t('Pledge', 'التعهّد')}>
                <div className="amount" dir="ltr">
                  <span className="usd">{usd(pledge.paid)}</span>{' '}
                  <span className="lbp">
                    {t('of', 'من')} {usd(pledge.pledged)}
                  </span>
                </div>{' '}
                <span className="meter" style={{ marginTop: '10px' }}>
                  <i style={css(`width:${Math.round((pledge.paid / pledge.pledged) * 100)}%`)} />
                </span>
              </Panel>
            ) : (
              ''
            )}{' '}
            <Panel title={t('Counting-session statement', 'كشف جلسة العدّ')}>
              <p className="t-caption dim">
                {t(
                  'Shows only gifts recorded for this person in the current counting session. It is not a full-year or tax statement.',
                  'يعرض فقط التقدمات المسجّلة لهذا الشخص في جلسة العدّ الحالية. ليس كشف سنة كاملة ولا مستنداً ضريبياً.'
                )}
              </p>{' '}
              <button
                className="btn btn-secondary btn-dense"
                style={{ marginTop: '10px' }}
                data-act={`statement:${p.id}`}
              >
                <Icon name="doc" size={15} />
                {t('Download statement', 'تنزيل الكشف')}
              </button>
            </Panel>
          </div>
        </div>
      );
    },
    notes: () => (
      <div className="tabbody">
        <Panel title={t('Notes & Tasks', 'الملاحظات والمهام')} tight={true}>
          {nodesOr(
            NOTES.filter(n => n.p === p.id).map(n => (
              <div className="listrow" style={{ alignItems: 'flex-start' }}>
                <span className="grow">
                  <small className="mono dim">{n.at}</small>
                  <span style={{ display: 'block' }}>{t(n.body, n.bodyAr)}</span>
                </span>
                {n.priority !== 'ordinary' ? (
                  <Pill
                    label={t(
                      n.priority === 'urgent' ? 'Urgent' : 'Needs attention',
                      n.priority === 'urgent' ? 'عاجل' : 'تحتاج متابعة'
                    )}
                    tone={n.priority === 'urgent' ? 'danger' : 'warning'}
                  />
                ) : (
                  ''
                )}
                <C.IconBtn ico="edit" label={t('Edit', 'تعديل')} data-act={`note-edit:${n.id}`} />
              </div>
            )),
            <Empty
              glyph="notes"
              title={t('No pastoral notes yet', 'لا ملاحظات رعوية بعد')}
              body={t(
                'A new note will appear here and in Notes & Tasks.',
                'ستظهر الملاحظة الجديدة هنا وفي قسم الملاحظات الرعوية.'
              )}
            />
          )}
        </Panel>
        <button className="btn btn-primary" style={{ marginTop: '16px' }} data-act={`note-new:${p.id}`}>
          <Icon name="plus" size={16} />
          {t('Add pastoral note', 'إضافة ملاحظة رعوية')}
        </button>
      </div>
    ),
    files: () => (
      <div style={{ maxWidth: '720px' }}>
        <Panel title={t('Attachments', 'المرفقات')}>
          <p className="help" style={{ marginBottom: '12px' }}>
            {t(
              'Only real uploaded files appear here. Access and deletion are logged.',
              'تظهر هنا الملفات المرفوعة فعلياً فقط. يُسجّل فتحها وحذفها.'
            )}
          </p>{' '}
          <C.Dropzone id="pfiles" scope="person" ownerId={p.id} />
        </Panel>
      </div>
    ),
    consent: () => (
      <div style={{ maxWidth: '720px' }}>
        <Panel title={t('Consent', 'الموافقات')}>
          <div className="stack" style={{ gap: '12px' }}>
            <C.SwitchRow
              label={t('Parish announcements on WhatsApp', 'إعلانات الرعية على واتساب')}
              checked={x.consent?.[0]?.[2] ?? false}
              pref={`consent.${p.id}.0`}
            />{' '}
            <label className="switch">
              <input type="checkbox" id="directory-consent" defaultChecked={!!x.directory} />
              <span>{t('Printed parish people directory', 'دليل مؤمني الرعية المطبوع')}</span>
            </label>{' '}
            <p className="help">
              {t(
                'Includes names in English and Arabic, household, town, and phone only. Changes affect the next printed directory.',
                'يشمل الاسمين الإنكليزي والعربي والعائلة والبلدة والهاتف فقط. تسري التغييرات على الدليل المطبوع التالي.'
              )}
            </p>{' '}
            <C.SwitchRow
              label={t('Photos in parish media', 'الصور في وسائل الرعية')}
              checked={x.consent?.[2]?.[2] ?? false}
              pref={`consent.${p.id}.2`}
            />
          </div>{' '}
          <div className="divider" />{' '}
          <div className="ac-group" style={{ paddingInline: 0 }}>
            {t('Consent history', 'سجل الموافقات')}
          </div>{' '}
          <div className="timeline">
            <div className="tl-item">
              <div className="when">30 Mar 2026</div>
              <div className="what">
                {t('Signed the 2026 consent form in the office.', 'وقّع استمارة موافقة ٢٠٢٦ في المكتب.')}
              </div>
            </div>{' '}
            <div className="tl-item">
              <div className="when">14 Jan 2025</div>
              <div className="what">{t('Withdrew consent for photos.', 'سحب الموافقة على الصور.')}</div>
            </div>
          </div>{' '}
          <p className="t-caption dim" style={{ marginTop: '12px' }}>
            {t(
              'Every change of consent is kept with its date, so the parish can always show what was agreed and when.',
              'كل تغيير في الموافقة يُحفظ بتاريخه، فتستطيع الرعية دائماً أن تُظهر ما اتُّفق عليه ومتى.'
            )}
          </p>
        </Panel>
      </div>
    )
  };
  return (
    <>
      {head}
      {(T[tab] || T[''])()}
    </>
  );
}

/* The portal account of a parishioner: how they sign in, whether the office has checked a record they
   made themselves, and a new password when they forget theirs. Only the parish office sees it. */
function accountPanel(p) {
  const account = D.ACCOUNTS[p.id],
    online = p.registeredOnline;
  if (!is('priest', 'secretary') || !(account || online)) return '';
  const access = account && (ACCESS[account.role] || [account.role, account.role]);
  return (
    <Panel title={t('Online account', 'الحساب الإلكتروني')}>
      {unverified(p) ? (
        <C.InlineAlert
          tone="warning"
          title={t('Registered online. ', 'سجّل نفسه إلكترونياً. ')}
          body={t(
            'Check the details they gave — the Arabic name, town and household — then mark the record as verified.',
            'تحقّق من المعلومات التي أدخلها — الاسم بالعربية والبلدة والعائلة — ثم علّم السجل كمُتحقَّق منه.'
          )}
        />
      ) : (
        ''
      )}{' '}
      <dl className="dl">
        {account ? (
          <>
            <dt>{t('Signs in with', 'يسجّل الدخول بـ')}</dt>
            <dd>
              <bdi className="mono" dir="ltr">
                {signInName(account.username)}
              </bdi>
            </dd>{' '}
            <dt>{t('Access', 'الصلاحية')}</dt>
            <dd>{t(...access)}</dd>
          </>
        ) : (
          ''
        )}
        {online ? (
          <>
            <dt>{t('Registered', 'التسجيل')}</dt>
            <dd>
              {fmtDate(online.at)} ·{' '}
              {online.via === 'email'
                ? t('with an email address', 'ببريد إلكتروني')
                : t('with a phone number', 'برقم هاتف')}
            </dd>{' '}
            <dt>{t('Verified', 'التحقّق')}</dt>
            <dd>
              {online.verified
                ? `${t('Yes', 'نعم')}${online.verifiedBy ? ` · ${online.verifiedBy}` : ''}${online.verifiedAt ? ` · ${fmtDate(online.verifiedAt)}` : ''}`
                : t('Not yet', 'ليس بعد')}
            </dd>
          </>
        ) : (
          ''
        )}
      </dl>{' '}
      {unverified(p) || (account && account.canResetPassword) ? (
        <div className="row" style={{ gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
          {unverified(p) ? (
            <button className="btn btn-primary btn-dense" data-act={`person-verify:${p.id}`}>
              <Icon name="check" size={15} />
              {t('Mark as verified', 'تعليم كمُتحقَّق منه')}
            </button>
          ) : (
            ''
          )}{' '}
          {account && account.canResetPassword ? (
            <button className="btn btn-secondary btn-dense" id="account-reset">
              <Icon name="lock" size={15} />
              {t('Reset password', 'إعادة تعيين كلمة المرور')}
            </button>
          ) : (
            ''
          )}
        </div>
      ) : (
        ''
      )}
    </Panel>
  );
}

/* A forgotten password: the office makes a new one and reads it to the parishioner over the phone. */
function resetPassword(p) {
  const name = isAr() ? p.ar || p.lat : p.lat;
  openModal({
    title: t('Reset the password?', 'إعادة تعيين كلمة المرور؟'),
    body: (
      <p>
        {t(
          `A new password is made for ${name}. Their old password stops working, and they are signed out on every device.`,
          `تُنشأ كلمة مرور جديدة لـ ${name}. تتوقّف كلمة المرور القديمة، ويُسجَّل خروجه من كل الأجهزة.`
        )}
      </p>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {t('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="reset-yes">
          {t('Make a new password', 'إنشاء كلمة مرور جديدة')}
        </button>
      </>
    ),
    onMount(el) {
      const yes = el.querySelector('#reset-yes');
      yes.addEventListener('click', async () => {
        yes.disabled = true;
        yes.setAttribute('aria-busy', 'true');
        try {
          const result = await memberAction('accountReset', { personId: p.id });
          openModal({
            title: t('New password', 'كلمة المرور الجديدة'),
            body: (
              <>
                <p>{t(`Read it to ${name}. They sign in with:`, `اقرأها لـ ${name}. يسجّل الدخول بـ:`)}</p>{' '}
                <dl className="dl reset-dl">
                  <dt>{t('Phone number or email', 'رقم الهاتف أو البريد')}</dt>
                  <dd>
                    <bdi className="mono" dir="ltr">
                      {signInName(result.username)}
                    </bdi>
                  </dd>
                  <dt>{t('Password', 'كلمة المرور')}</dt>
                  <dd>
                    <bdi className="mono reset-pass" dir="ltr">
                      {result.password.replace(/(\d{4})(\d{4})/, '$1 $2')}
                    </bdi>
                  </dd>
                </dl>{' '}
                <p className="help">
                  {t(
                    'It is shown only now. They can choose their own password in My profile once they sign in.',
                    'تظهر الآن فقط. يمكنه اختيار كلمة مروره من «ملفي» بعد تسجيل الدخول.'
                  )}
                </p>
              </>
            ),
            foot: (
              <>
                <button className="btn btn-secondary" id="reset-copy">
                  <Icon name="doc" size={15} />
                  {t('Copy password', 'نسخ كلمة المرور')}
                </button>
                <button className="btn btn-primary" data-close="">
                  {t('Done', 'تمّ')}
                </button>
              </>
            ),
            onMount(box) {
              box.querySelector('#reset-copy').addEventListener('click', async () => {
                try {
                  await navigator.clipboard.writeText(result.password);
                  toast(t('Password copied', 'نُسخت كلمة المرور'), '', 'success');
                } catch {
                  toast(
                    t('Could not copy', 'تعذّر النسخ'),
                    t('Select the password and copy it instead.', 'حدّد كلمة المرور وانسخها.'),
                    'warning'
                  );
                }
              });
            }
          });
        } catch (error) {
          yes.disabled = false;
          yes.removeAttribute('aria-busy');
          toast(t('The password was not reset', 'لم تُعَد كلمة المرور'), error.message, 'danger');
        }
      });
    }
  });
}

personView.mount = (host, id) => {
  host.querySelector('#account-reset')?.addEventListener('click', () => {
    const p = person(id);
    if (p) resetPassword(p);
  });
  host
    .querySelector('[data-household-export-id]')
    ?.addEventListener('click', e => exportHouseholds([e.currentTarget.dataset.householdExportId]));
  host.querySelector('[data-pkebab]')?.addEventListener('click', e => personMenu(e.currentTarget, id));
  host.querySelector('#edit-person-groups')?.addEventListener('click', () => editPersonGroups(id));
  host.querySelector('#edit-profile-extra')?.addEventListener('click', () => editProfileExtra(id));
  host.querySelector('#directory-consent')?.addEventListener('change', async e => {
    const x = (PERSON_EXTRA[id] ||= {});
    x.directory = e.target.checked;
    if (x.consent?.[1]) x.consent[1][2] = x.directory;
    if (await persist()) toast(t('Directory preference saved', 'حُفظ خيار الدليل'), '', 'success');
    else e.target.checked = !!PERSON_EXTRA[id]?.directory;
  });
};

function editPersonGroups(id) {
  const before = new Set(
    Object.entries(GROUP_DETAIL)
      .filter(([, d]) => d.roster?.some(r => r.p === id))
      .map(([gid]) => gid)
  );
  openModal({
    title: t('Edit group memberships', 'تعديل عضويات المجموعات'),
    sub: t('Choose groups, then review the changes before saving.', 'اختر المجموعات ثم راجع التغييرات قبل الحفظ.'),
    body: (
      <div className="choice-grid">
        {GROUPS.map(g => (
          <label className="row">
            <input type="checkbox" defaultValue={g.id} data-group-choice="" defaultChecked={!!before.has(g.id)} />
            <span>{t(g.name, g.ar)}</span>
          </label>
        ))}
      </div>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {t('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="group-review">
          {t('Review changes', 'مراجعة التغييرات')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#group-review').addEventListener('click', () => {
        const after = new Set([...el.querySelectorAll('[data-group-choice]:checked')].map(x => x.value));
        const added = GROUPS.filter(g => after.has(g.id) && !before.has(g.id));
        const removed = GROUPS.filter(g => before.has(g.id) && !after.has(g.id));
        if (!added.length && !removed.length) {
          closeOverlays();
          return;
        }
        openModal({
          title: t('Confirm membership changes', 'تأكيد تغييرات العضوية'),
          body: (
            <>
              <p>
                {t('Add', 'إضافة')}: {added.map(g => t(g.name, g.ar)).join(', ') || '—'}
              </p>{' '}
              <p>
                {t('Remove', 'إزالة')}: {removed.map(g => t(g.name, g.ar)).join(', ') || '—'}
              </p>{' '}
              <p className="help">
                {t(
                  'This changes group rosters; earlier meeting attendance is preserved.',
                  'تتغيّر لوائح المجموعات وتبقى سجلات الحضور السابقة محفوظة.'
                )}
              </p>
            </>
          ),
          foot: (
            <>
              <button className="btn btn-secondary" data-close="">
                {t('Keep memberships', 'إبقاء العضويات')}
              </button>
              <button className="btn btn-primary" id="group-confirm">
                {t('Save memberships', 'حفظ العضويات')}
              </button>
            </>
          ),
          onMount(confirm) {
            confirm.querySelector('#group-confirm').addEventListener('click', async () => {
              for (const g of added) {
                const d = (GROUP_DETAIL[g.id] ||= {
                  roster: [],
                  assistant: null,
                  roles: [],
                  requests: [],
                  meetings: [],
                  posts: [],
                  files: []
                });
                d.roster ||= [];
                if (!d.roster.some(r => r.p === id))
                  d.roster.push({
                    p: id,
                    role: 'Member',
                    roleAr: 'عضو',
                    joined: new Date().getFullYear().toString(),
                    att: 0
                  });
                g.members = d.roster.length;
              }
              for (const g of removed) {
                const d = GROUP_DETAIL[g.id];
                if (d) {
                  d.roster = d.roster.filter(r => r.p !== id);
                  g.members = d.roster.length;
                }
              }
              if (!(await persist())) return;
              closeOverlays();
              bus.refresh();
              toast(t('Memberships saved', 'حُفظت العضويات'), '', 'success');
            });
          }
        });
      });
    }
  });
}

function editProfileExtra(id) {
  const x = PERSON_EXTRA[id] || {};
  const dates = x.dates || [];
  openModal({
    title: t('Skills and important dates', 'المهارات والتواريخ المهمّة'),
    body: (
      <>
        {skillPicker(x.skills || [])}
        {occupationField('extra-occupation', x.occupation || '')}{' '}
        <div className="stack" id="extra-dates">
          {[...dates, ['', '', '']].map(([en, ar, d], i) => (
            <div className="formgrid" data-date-row="">
              <C.Field
                label={t('Date label (English)', 'تسمية التاريخ (إنكليزي)')}
                value={en || ''}
                id={`extra-en-${i}`}
              />{' '}
              <C.Field label={t('Date label (Arabic)', 'تسمية التاريخ (عربي)')} value={ar || ''} id={`extra-ar-${i}`} />{' '}
              <C.Field label={t('Date', 'التاريخ')} type="date" value={d || ''} id={`extra-date-${i}`} />
            </div>
          ))}
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {t('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="extra-save">
          {t('Save', 'حفظ')}
        </button>
      </>
    ),
    onMount(el) {
      wireSkillPicker(el);
      el.querySelector('#extra-save').addEventListener('click', async () => {
        const skills = selectedSkills(el);
        const occupation = el.querySelector('#extra-occupation').value.trim();
        const nextDates = [...el.querySelectorAll('[data-date-row]')]
          .map(row => [...row.querySelectorAll('input')].map(i => i.value.trim()))
          .filter(([en, ar, d]) => en || ar || d);
        if (nextDates.some(([en, ar, d]) => !en || !d))
          return toast(t('Complete each date label and date', 'أكمل تسمية كل تاريخ وتاريخه'), '', 'warning');
        PERSON_EXTRA[id] = { ...x, skills, occupation, dates: nextDates };
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(t('Profile details saved', 'حُفظت تفاصيل الملف'), '', 'success');
      });
    }
  });
}
