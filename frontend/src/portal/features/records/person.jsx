/* One person's record: the profile (the record's facts across the whole width, skills and languages, household,
   account and relationships), family (with linking to or creating a household), groups, sacraments, attendance,
   giving, notes, files and consent. Numbered offering envelopes are no longer shown here (owner, 27 November 2026). */
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
import { kindLabel } from './records-shared.jsx';
import { phoneShow } from '../../model/sacrament-requests.js';
import * as D from '../../model/data.js';
import {
  GROUPS,
  SACRAMENTS,
  PLEDGES,
  BATCH,
  PERSON_EXTRA,
  TODAY,
  GROUP_DETAIL,
  NOTES,
  FUNDS,
  person
} from '../../model/data.js';
import { hh, label, occupationField, onlineNew, phoneText, relLabel, riteLabel, unverified } from './people-shared.jsx';
import { familyTree } from './family-tree.jsx';
import { PersonLoader, ConsentPanel, MedicalPanel, RelationshipPanel } from './person-records.jsx';
import { personMenu } from './people.jsx';
import { exportHouseholds } from './households.jsx';
import { GEOGRAPHY } from '../../ui/geography.jsx';
import {
  LanguagesField,
  SkillsEditor,
  isoToDmy,
  languageLabel,
  phonesText,
  readLanguages,
  readSkills
} from './people-fields.jsx';

/* The Arabic name of a governorate or district from the address lists, or the stored text when unknown. */
const geoName = id => {
  for (const g of GEOGRAPHY) {
    if (g.id === id) return g.ar;
    const district = g.districts.find(x => x.id === id);
    if (district) return district.ar;
  }
  return id;
};

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
      <PersonLoader id={id} />
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
    '': () => {
      /* The record uses the whole width (owner, 27 November 2026): the facts in a responsive grid, then the
         skills, household and account panels side by side, then the recorded relationships. */
      const address = x.address || {};
      const place = [
        address.sector,
        p.town ? t(p.town, p.townAr || p.town) : '',
        address.district ? t(address.district, geoName(address.district)) : '',
        address.governorate ? t(address.governorate, geoName(address.governorate)) : ''
      ]
        .filter(Boolean)
        .join(', ');
      const fact = (en, ar, value, props = {}) => (
        <div className="person-fact" style={{ minWidth: 0 }}>
          <div className="t-caption dim">{t(en, ar)}</div>
          <div style={{ overflowWrap: 'anywhere' }} {...props}>
            {value || '—'}
          </div>
        </div>
      );
      const languages = x.languages?.length ? x.languages : x.lang ? [x.lang] : [];
      return (
        <div className="stack" style={{ gap: '16px', marginTop: '16px' }}>
          <Panel title={t('Record', 'السجل')}>
            <div
              data-person-record=""
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px 24px' }}
            >
              {fact('First name', 'الاسم الأول', p.given || p.lat)}
              {fact('Last name', 'اسم العائلة', p.family)}
              {/* bdi keeps the Arabic text under its label instead of pushing it to the far side of the cell */}
              {fact(
                'First name in Arabic',
                'الاسم الأول بالعربية',
                p.givenAr ? <bdi style={{ fontFamily: 'var(--arabic)', fontSize: '16px' }}>{p.givenAr}</bdi> : ''
              )}
              {fact(
                'Last name in Arabic',
                'اسم العائلة بالعربية',
                p.familyAr ? <bdi style={{ fontFamily: 'var(--arabic)', fontSize: '16px' }}>{p.familyAr}</bdi> : ''
              )}
              {fact('Date of birth', 'تاريخ الولادة', isoToDmy(p.born), { dir: 'ltr', className: 'mono' })}
              {fact(
                'Phone numbers',
                'أرقام الهاتف',
                p.phones?.length ? (
                  <span className="stack" style={{ gap: '2px' }}>
                    {p.phones.map(n => (
                      <span key={n.number}>
                        <bdi dir="ltr" className="mono">
                          {phonesText([n])}
                        </bdi>{' '}
                        {n.kind ? (
                          <span className="t-caption dim">
                            {n.kind === 'Mobile' ? t('mobile', 'خلوي') : t('landline', 'أرضي')}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </span>
                ) : p.phone && p.phone !== '—' ? (
                  <bdi dir="ltr">{phoneText(p.phone)}</bdi>
                ) : (
                  ''
                )
              )}
              {p.email ? fact('Email', 'البريد الإلكتروني', <bdi dir="ltr">{p.email}</bdi>) : null}
              {p.contact && !p.phoneFromContact ? fact('Other contact', 'جهة اتصال أخرى', p.contact) : null}
              {fact('Address', 'العنوان', place)}
              {fact('Rite', 'الطقس', p.rite ? riteLabel(p.rite) : '')}
              {fact('Line of work', 'المهنة', x.occupation)}
              {fact('Languages', 'اللغات', languages.map(languageLabel).join(', '))}
              {fact('Blood type', 'زمرة الدم', x.blood, { className: 'mono' })}
              {fact(
                'Printed directory',
                'الدليل المطبوع',
                x.directory === undefined
                  ? ''
                  : x.directory
                    ? t('Listed, by consent', 'مدرَج بموافقته')
                    : t('Not listed', 'غير مدرَج')
              )}
            </div>
          </Panel>{' '}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <Panel
              title={t('Skills and languages', 'المهارات واللغات')}
              more={
                <button className="btn btn-secondary btn-dense" id="edit-profile-extra">
                  <Icon name="edit" size={15} />
                  {t('Edit', 'تعديل')}
                </button>
              }
            >
              <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                {(x.skills || []).length ? (
                  x.skills.map((s, i) => (
                    <span key={i} className="chip">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="dim">{t('No skills recorded.', 'لا مهارات مسجّلة.')}</span>
                )}
              </div>
              <p className="t-caption dim" style={{ marginTop: '10px' }}>
                {t('Languages', 'اللغات')}: {languages.map(languageLabel).join(', ') || '—'}
              </p>
            </Panel>
            <Panel title={t('Household', 'العائلة')} tight={!!house}>
              {house ? (
                house.members
                  .map(person)
                  .filter(Boolean)
                  .map((m, i) => (
                    <a key={i} className="listrow" href={`#/person/${m.id}`}>
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
                  action={
                    <button className="btn btn-secondary btn-dense" data-act={`family-link:${p.id}`}>
                      {t('Link or create a household', 'ربط بعائلة أو إنشاؤها')}
                    </button>
                  }
                />
              )}
            </Panel>
            {accountPanel(p)}
          </div>{' '}
          <RelationshipPanel id={p.id} />
        </div>
      );
    },
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
                .map((m, i) => (
                  <div key={i} className="listrow">
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
                  list.map((m, i) => (
                    <div key={i} className="listrow">
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
                {t('Link or create a household', 'ربط بعائلة أو إنشاؤها')}
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
              <b>{kindLabel(s.kind)}</b>,
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
            GROUPS.filter(g => memberships.has(g.id)).map((g, i) => (
              <a key={i} className="listrow" href={`#/groups/${g.id}`}>
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
          detail: `${kindLabel(s.kind)} · ${s.reg}`
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
                    glyph="give"
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
            NOTES.filter(n => n.p === p.id).map((n, i) => (
              <div key={i} className="listrow" style={{ alignItems: 'flex-start' }}>
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
      <div className="stack" style={{ maxWidth: '720px', gap: '16px' }}>
        <ConsentPanel id={p.id} />
        <MedicalPanel id={p.id} />
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
        {GROUPS.map((g, i) => (
          <label key={i} className="row">
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

/* Skills are typed one at a time and added with Add (several, no digits); languages are ticked (several). */
function editProfileExtra(id) {
  const x = PERSON_EXTRA[id] || {};
  openModal({
    title: t('Skills, languages and occupation', 'المهارات واللغات والمهنة'),
    body: (
      <>
        <SkillsEditor value={x.skills || []} />
        <LanguagesField value={x.languages?.length ? x.languages : x.lang ? [x.lang] : []} />
        {occupationField('extra-occupation', x.occupation || '')}{' '}
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
      el.querySelector('#extra-save').addEventListener('click', async () => {
        const { skills, pending } = readSkills(el);
        if (pending)
          return toast(
            t('Add the skill first', 'أضف المهارة أولاً'),
            t(
              'Press Add to keep the skill you typed, or clear it.',
              'اضغط «إضافة» للاحتفاظ بالمهارة المكتوبة أو امسحها.'
            ),
            'warning'
          );
        const languages = readLanguages(el);
        const occupation = el.querySelector('#extra-occupation').value.trim();
        PERSON_EXTRA[id] = { ...x, skills, languages, occupation };
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(t('Profile details saved', 'حُفظت تفاصيل الملف'), '', 'success');
      });
    }
  });
}
