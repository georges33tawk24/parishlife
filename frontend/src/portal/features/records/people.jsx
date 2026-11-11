/* Parishioners: the searchable register with its filters, duplicates and CSV import, the printed
   directory, adding a person, and each person's actions menu. */
import { Select } from '../../ui/components.jsx';
import { css, paint } from '../../ui/html.js';
import { t, isAr, num, matches, fmtDate } from '../../../lib/i18n.js';
import { is, canSee, go, S, bus } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Panel,
  Who,
  Status,
  Pill,
  Table,
  Empty,
  openDrawer,
  openModal,
  closeOverlays,
  toast,
  Stat,
  TabBar,
  openMenu,
  openPopover,
  closeMenu
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { personEdit } from './people-dialogs.jsx';
import { compose } from '../communicate/messaging-dialogs.jsx';
import { needAll } from '../../shared/dialogs.jsx';
import { download } from '../../shell/actions.jsx';
import { persist } from '../../model/persist.js';
import { printSheet } from '../../shared/print.js';
import { readAddressCascade } from '../../ui/geography.jsx';
import { api, session } from '../../model/api.js';
import * as D from '../../model/data.js';
import {
  PEOPLE,
  ARCHIVED,
  PHOTOS,
  HOUSEHOLDS,
  GROUPS,
  SACRAMENTS,
  PLEDGES,
  BATCH,
  PERSON_EXTRA,
  DUPLICATES,
  GROUP_DETAIL,
  NOTES,
  person
} from '../../model/data.js';
import {
  hh,
  importDraft,
  importReview,
  occupationField,
  onlineNew,
  phoneText,
  riteLabel,
  unverified,
  wireImport
} from './people-shared.jsx';

const filteredPeople = () =>
  PEOPLE.filter(
    x =>
      (!S.ui.peopleStatus || S.ui.peopleStatus.includes(x.status)) &&
      (!S.ui.peopleTown || x.town === S.ui.peopleTown) &&
      (!S.ui.peopleRite || x.rite === S.ui.peopleRite) &&
      (!S.ui.peopleEnv || hh(x.hh)?.envelope) &&
      matches(`${x.lat} ${x.ar} ${x.phone} ${hh(x.hh)?.envelope || ''}`, S.ui.peopleQ || '')
  );

const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

function peopleExport() {
  const selected = [...document.querySelectorAll('#view tr[data-ri-p] [data-row]:checked')].map(
    c => c.closest('tr').dataset.riP
  );
  const options = [
    ['english', 'English name', 'الاسم الإنكليزي'],
    ['arabic', 'Arabic name', 'الاسم العربي'],
    ['phone', 'Phone', 'الهاتف'],
    ['town', 'Town', 'البلدة'],
    ['rite', 'Rite', 'الطقس'],
    ['status', 'Status', 'الحالة'],
    ['household', 'Household', 'العائلة'],
    ['envelope', 'Offering-envelope identifier', 'رمز مظروف العطاء'],
    ['birth', 'Date of birth', 'تاريخ الولادة']
  ];
  openModal({
    title: t('Export people', 'تصدير المؤمنين'),
    sub: t('Choose the records and fields in this CSV file.', 'اختر السجلات والحقول لهذا الملف.'),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="ex_scope">
            {t('Scope', 'النطاق')}
          </label>
          <Select id="ex_scope">
            {selected.length ? (
              <option value="selected">
                {t(`Selected people on this page (${selected.length})`, `المحدّدون في هذه الصفحة (${selected.length})`)}
              </option>
            ) : (
              ''
            )}
            <option value="filtered">
              {t(
                `Current filtered results (${filteredPeople().length})`,
                `نتائج المرشّح الحالي (${filteredPeople().length})`
              )}
            </option>
            <option value="all">
              {t(`All active people (${PEOPLE.length})`, `جميع المؤمنين النشطين (${PEOPLE.length})`)}
            </option>
          </Select>
        </div>{' '}
        <div className="label" style={{ margin: '16px 0 8px' }}>
          {t('Fields to include', 'الحقول المطلوبة')}
        </div>{' '}
        <div className="choice-grid">
          {options.map(([key, en, ar], i) => (
            <label key={i} className="row">
              <input type="checkbox" data-export-field={key} defaultChecked={!!(i < 6)} />
              <span>{t(en, ar)}</span>
            </label>
          ))}
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {t('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="export-confirm">
          {t('Download CSV', 'تنزيل CSV')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#export-confirm').addEventListener('click', () => {
        const chosen = [...el.querySelectorAll('[data-export-field]:checked')].map(c => c.dataset.exportField);
        if (!chosen.length) return toast(t('Choose at least one field', 'اختر حقلاً واحداً على الأقل'), '', 'warning');
        const scope = el.querySelector('#ex_scope').value;
        const rows =
          scope === 'all'
            ? PEOPLE
            : scope === 'filtered'
              ? filteredPeople()
              : PEOPLE.filter(p => selected.includes(p.id));
        const values = {
          english: p => p.lat,
          arabic: p => p.ar,
          phone: p => p.phone,
          town: p => p.town,
          rite: p => p.rite,
          status: p => p.status,
          household: p => hh(p.hh)?.name || '',
          envelope: p => hh(p.hh)?.envelope || '',
          birth: p => p.born
        };
        download(
          `parishlife-people-${scope}.csv`,
          [
            chosen.map(k => csvCell(options.find(x => x[0] === k)[1])).join(','),
            ...rows.map(p => chosen.map(k => csvCell(values[k](p))).join(','))
          ].join('\r\n')
        );
        closeOverlays();
        toast(t('People exported', 'صُدّر المؤمنون'), `${rows.length} ${t('records', 'سجلّاً')}`, 'success');
      });
    }
  });
}

const TABS = () => [
  ['', 'All people', 'كل المؤمنين'],
  ['duplicates', 'Duplicates', 'التكرارات', DUPLICATES.length],
  ['import', 'Import', 'استيراد'],
  ['archived', 'Archived', 'المؤرشفون', ARCHIVED.length]
];

/* ---------------- list ---------------- */
export function people(tab = '') {
  const head = (
    <>
      <PageHead
        crumbs={[{ label: t('Records', 'السجلات'), href: '#/people' }, { label: t('People', 'المؤمنون') }]}
        title={t('Parishioners', 'المؤمنون')}
        sub={
          <>
            <span dir="ltr" className="tnum">
              {num(PEOPLE.length)}
            </span>{' '}
            {t(
              `records · ${HOUSEHOLDS.length} households · updated today`,
              `سجلاً · ${HOUSEHOLDS.length} عائلة · حُدّثت اليوم`
            )}
          </>
        }
        actions={
          <>
            <button className="btn btn-secondary" id="people-directory">
              <Icon name="print" size={17} />
              {t('Print directory', 'طباعة الدليل')}
            </button>{' '}
            <button className="btn btn-secondary" id="people-export">
              <Icon name="export" size={17} />
              {t('Export people', 'تصدير المؤمنين')}
            </button>{' '}
            <C.SplitBtn label={t('New parishioner', 'مؤمن جديد')} id="newp" />
          </>
        }
      />
      <TabBar base="people" items={TABS()} active={tab} />
    </>
  );
  if (tab === 'duplicates')
    return (
      <>
        {head}
        {duplicates()}
      </>
    );
  if (tab === 'import')
    return (
      <>
        {head}
        {importView()}
      </>
    );
  if (tab === 'archived')
    return (
      <>
        {head}
        {archivedPeople()}
      </>
    );
  // Archived records are retained for history; account status is managed separately.

  /* Real pagination over what is loaded — ten rows a page, as a secretary scans a page at a time. */
  const q = S.ui.peopleQ || '',
    town = S.ui.peopleTown || '',
    rite = S.ui.peopleRite || '';
  const visible = filteredPeople();
  const PER = 10,
    pages = Math.max(1, Math.ceil(visible.length / PER));
  S.ui.peoplePage = Math.min(S.ui.peoplePage, pages - 1);
  const from = S.ui.peoplePage * PER,
    pageRows = visible.slice(from, from + PER);
  const rows = pageRows.map(p => ({
    cls: 'clickable',
    attrs: `data-ri-p="${p.id}"`,
    detail: (
      <div className="grid g3" style={{ gap: '20px' }}>
        <dl className="dl">
          <dt>{t('Household', 'العائلة')}</dt>
          <dd>{hh(p.hh) ? t(hh(p.hh).name, hh(p.hh).ar) : '—'}</dd>
          <dt>{t('Phone', 'الهاتف')}</dt>
          <dd className="mono" dir="ltr">
            {phoneText(p.phone)}
          </dd>
        </dl>{' '}
        <dl className="dl">
          <dt>{t('Groups', 'المجموعات')}</dt>
          <dd>
            {GROUPS.filter(g => GROUP_DETAIL[g.id]?.roster?.some(r => r.p === p.id))
              .map(g => t(g.name, g.ar))
              .join(', ') || '—'}
          </dd>
          <dt>{t('Born', 'الولادة')}</dt>
          <dd className="mono">{p.born}</dd>
        </dl>{' '}
        <div>
          <a className="btn btn-secondary btn-dense" href={`#/person/${p.id}`}>
            {t('Open record', 'فتح السجل')}
          </a>
        </div>
      </div>
    ),
    cells: [
      <span className="row" style={{ gap: '6px' }}>
        <C.IconBtn ico="chevR" label={t('Expand', 'توسيع')} data-expand="" aria-expanded="false" />
        <Who p={p} />
        {onlineNew(p)}
      </span>,
      <span className="dim">{hh(p.hh) ? t(hh(p.hh).name, hh(p.hh).ar) : '—'}</span>,
      <span className="dim">{t(p.town, p.townAr)}</span>,
      <span className="dim">{riteLabel(p.rite)}</span>,
      <span className="mono dim nowrap" dir="ltr">
        {p.phone === '—' ? <span className="dimmer">—</span> : phoneText(p.phone)}
      </span>,
      <Status k={p.status} />,
      <span className="rowacts">
        <C.IconBtn ico="msg" label={t('Message', 'مراسلة')} data-act={`compose:${p.id}`} />
        <C.IconBtn ico="dots" label={t('More', 'المزيد')} data-kebab={p.id} />
      </span>
    ]
  }));
  return (
    <>
      {head}{' '}
      <div className="toolbar" style={{ margin: '20px 0 16px' }}>
        <div className="grow" style={{ maxWidth: '320px' }}>
          <C.SearchClear ph={t('Name, phone or envelope number', 'الاسم أو الهاتف أو رقم المظروف')} id="psearch" />
        </div>{' '}
        <button className="btn btn-secondary" data-filter="" aria-haspopup="true">
          <Icon name="filter" size={17} />
          {t('Status', 'الحالة')}
          <span className="badge" style={{ marginInlineStart: '6px' }}>
            {(S.ui.peopleStatus || ['member', 'visitor']).length}
          </span>
        </button>{' '}
        <Select defaultValue={town} style={{ width: 'auto' }} id="ptown" aria-label={t('Town', 'البلدة')}>
          <option value="">{t('All towns', 'كل البلدات')}</option>
          {[...new Map(PEOPLE.filter(x => x.town).map(x => [x.town, x.townAr])).entries()].sort().map(([en, ar], i) => (
            <option key={i} value={en}>
              {t(en, ar)}
            </option>
          ))}
        </Select>{' '}
        <Select defaultValue={rite} style={{ width: 'auto' }} id="prite" aria-label={t('Rite', 'الطقس')}>
          <option value="">{t('All rites', 'كل الطقوس')}</option>
          {[...new Set(PEOPLE.map(x => x.rite).filter(Boolean))].sort().map((r, i) => (
            <option key={i} value={r}>
              {riteLabel(r)}
            </option>
          ))}
        </Select>{' '}
        <button
          className="savedview"
          data-act="people-env"
          aria-pressed={!!S.ui.peopleEnv}
          style={css(PEOPLE.some(unverified) || S.ui.peopleNew ? undefined : 'margin-inline-start:auto')}
        >
          <Icon name={S.ui.peopleEnv ? 'check' : 'filter'} size={14} />
          {t('Household envelopes', 'مظاريف العائلات')}
        </button>
      </div>{' '}
      {S.ui.peopleEnv ? (
        <p className="help" style={{ marginBottom: '12px' }}>
          {t(
            'A numbered giving envelope belongs to a household. It connects counted gifts and statements to that household; its members are listed for lookup, not as individual donors.',
            'المظروف المرقّم للعطاء يتبع العائلة المنزلية. يربط التقدمات وكشوفها بها؛ ويظهر أفرادها للبحث لا لأن كل فرد متبرّع.'
          )}
        </p>
      ) : (
        ''
      )}{' '}
      <Table
        pick={true}
        cols={[
          { label: t('Name', 'الاسم'), sort: true },
          { label: t('Household', 'العائلة'), cls: 'hide-md', sort: true },
          { label: t('Town', 'البلدة'), cls: 'hide-sm', sort: true },
          { label: t('Rite', 'الطقس'), cls: 'hide-md' },
          { label: t('Phone', 'الهاتف'), cls: 'hide-sm' },
          { label: t('Status', 'الحالة'), cls: 'shrink' },
          { label: '', cls: 'shrink' }
        ]}
        rows={rows}
        foot={
          <>
            <span className="tnum">
              {pageRows.length ? from + 1 : 0}–{from + pageRows.length} {t('of', 'من')} {visible.length}
            </span>{' '}
            <span style={{ marginInlineStart: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                className="btn-icon dense"
                data-act="page:prev"
                aria-label={t('Previous page', 'الصفحة السابقة')}
                disabled={!!(S.ui.peoplePage === 0)}
              >
                <Icon name="chevL" size={15} />
              </button>{' '}
              <span className="mono t-caption" style={{ minWidth: '44px', textAlign: 'center' }}>
                {S.ui.peoplePage + 1} / {pages}
              </span>{' '}
              <button
                className="btn-icon dense"
                data-act="page:next"
                aria-label={t('Next page', 'الصفحة التالية')}
                disabled={!!(S.ui.peoplePage >= pages - 1)}
              >
                <Icon name="chevR" size={15} />
              </button>
            </span>
          </>
        }
        onBulk={n => paint(document.getElementById('bulkhost'), n ? <C.BulkBar n={n} /> : null)}
      />{' '}
      <div id="bulkhost" />
    </>
  );
}

/* The row menu from sheet 03: edit, find duplicates, certificate with a
   language submenu, archive — and permanent deletion last and apart. */
export function personMenu(anchor, pid) {
  const p = person(pid);
  if (!p) return;
  const sac = SACRAMENTS.find(s => s.person === pid);
  const cert = lang =>
    sac
      ? go(`certificate/${sac.id}/${lang}`)
      : toast(
          t('No register entry yet', 'لا قيد في السجل بعد'),
          t('Record the sacrament first.', 'سجّل السرّ أولاً.'),
          'warning'
        );
  openMenu(
    anchor,
    [
      { label: t('Edit record', 'تعديل السجل'), icon: 'edit', fn: () => personEdit(pid) },
      { label: t('Message', 'مراسلة'), icon: 'msg', fn: () => compose(pid) },
      { label: t('Find duplicates', 'البحث عن تكرار'), icon: 'family', fn: () => go('people/duplicates') },
      ...(canSee('sacraments')
        ? [
            {
              label: t('Certificate', 'شهادة'),
              icon: 'doc',
              sub: [
                { label: t('Arabic — A4', 'عربي — A4'), fn: () => cert('arabic') },
                { label: t('English — A4', 'إنكليزي — A4'), fn: () => cert('english') },
                { label: t('Bilingual — A4', 'ثنائي — A4'), fn: () => cert('bilingual') }
              ]
            }
          ]
        : []),
      ...(!D.ACCOUNTS[pid]?.id && is('priest', 'secretary', 'super_admin', 'parish_admin', 'diocesan_admin')
        ? [{ label: t('Invite to complete account', 'دعوة لإكمال الحساب'), icon: 'mail', fn: () => inviteAccount(p) }]
        : []),
      ...(D.ACCOUNTS[pid]?.id && is('priest', 'super_admin', 'bishop', 'parish_admin', 'diocesan_admin')
        ? [
            {
              label: D.ACCOUNTS[pid].inactive
                ? t('Reactivate parish access', 'إعادة تفعيل الوصول للرعية')
                : t('Deactivate parish access', 'تعطيل الوصول للرعية'),
              icon: 'shield',
              fn: () => accountAccess(p)
            }
          ]
        : []),
      { sep: true },
      {
        label: t('Delete permanently — cannot be undone', 'حذف نهائي — لا تراجع'),
        icon: 'trash',
        danger: true,
        fn: () => deleteGuard(p)
      }
    ],
    { width: 230 }
  );
}

async function inviteAccount(p) {
  try {
    const result = await api('workspace/invitations', 'POST', { parish: session.parishId, personId: p.id });
    const link = new URL('index.html', location.href);
    link.hash = 'invite=' + result.token;
    openModal({
      title: t('Account invitation', 'دعوة الحساب'),
      body: (
        <>
          <p>{p.lat}</p>
          <p>
            {t(
              'Give this private link directly to the person. Email and SMS delivery are not configured, so no message has been sent. The link expires after seven days.',
              'أعطِ هذا الرابط الخاص للشخص مباشرة. لم يتم إعداد إرسال البريد والرسائل النصية لذلك لم تُرسل رسالة. تنتهي الدعوة بعد سبعة أيام.'
            )}
          </p>
          <label className="formrow">
            <span className="label">{t('Private invitation link', 'رابط الدعوة الخاص')}</span>
            <input className="input" readOnly defaultValue={link.href} />
          </label>
        </>
      ),
      foot: (
        <button className="btn btn-primary" data-close="">
          {t('Done', 'تم')}
        </button>
      ),
      onMount(el) {
        el.querySelector('input').onclick = e => e.target.select();
      }
    });
  } catch (e) {
    toast(t('Could not create invitation', 'تعذّر إنشاء الدعوة'), e.message, 'danger');
  }
}

function accountAccess(p) {
  const account = D.ACCOUNTS[p.id];
  openModal({
    title: account.inactive
      ? t('Reactivate parish access', 'إعادة تفعيل الوصول')
      : t('Deactivate parish access', 'تعطيل الوصول'),
    body: (
      <>
        <p>
          {t(
            'All records and activity will be preserved. Access to other parishes is unchanged.',
            'تبقى جميع السجلات والأنشطة محفوظة. لا يتأثر الوصول إلى الرعايا الأخرى.'
          )}
        </p>
        <label className="label">
          {t('Reason', 'السبب')}
          <textarea className="textarea" id="account-access-reason" maxLength="500" />
        </label>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {t('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="account-access-save">
          {t('Confirm', 'تأكيد')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#account-access-save').onclick = async e => {
        const b = e.currentTarget;
        b.disabled = true;
        try {
          await api('workspace/suspension', 'POST', {
            parish: session.parishId,
            userId: account.id,
            scope: 'parish',
            active: !account.inactive,
            reason: el.querySelector('#account-access-reason').value
          });
          account.inactive = !account.inactive;
          closeOverlays();
          bus.refresh();
        } catch (err) {
          b.disabled = false;
          toast(t('Could not update access', 'تعذّر تعديل الوصول'), err.message, 'danger');
        }
      };
    }
  });
}

/* Destructive — typed confirmation, exactly as sheet 04 draws it. */
/** Typed confirmation before a permanent delete. dry: the style-guide specimen, which
    shows the whole flow but leaves the register untouched. */
export function deleteGuard(p, { dry = false } = {}) {
  const mentions = (value, id) =>
    value === id ||
    (Array.isArray(value) && value.some(x => mentions(x, id))) ||
    (value &&
      typeof value === 'object' &&
      Object.entries(value).some(([key, item]) => key === id || mentions(item, id)));
  const excluded = new Set([
    'PEOPLE',
    'ARCHIVED',
    'PERSON_EXTRA',
    'PHOTOS',
    'PREFS',
    'HOUSEHOLDS',
    'GROUP_DETAIL',
    'NOTES',
    'SACRAMENTS',
    'PLEDGES',
    'BATCH'
  ]);
  const otherLinks =
    Object.entries(D).filter(
      ([key, value]) => !excluded.has(key) && typeof value === 'object' && value !== null && mentions(value, p.id)
    ).length + PEOPLE.concat(ARCHIVED).filter(other => other.id !== p.id && mentions(other, p.id)).length;
  const links = [
    [t('Sacrament records', 'سجلات الأسرار'), SACRAMENTS.filter(s => s.person === p.id).length],
    [t('Households', 'العائلات'), HOUSEHOLDS.filter(h => h.members.includes(p.id)).length],
    [
      t('Group memberships', 'عضويات المجموعات'),
      Object.values(GROUP_DETAIL).filter(d => d.roster?.some(r => r.p === p.id)).length
    ],
    [t('Pastoral items', 'بنود رعوية'), NOTES.filter(n => n.p === p.id).length],
    [
      t('Offering and pledge records', 'سجلات العطاء والتعهد'),
      PLEDGES.filter(x => x.p === p.id).length + BATCH.lines.filter(x => x.p === p.id).length
    ],
    [t('Other linked records', 'سجلات مرتبطة أخرى'), otherLinks]
  ];
  const blocked = !dry && links.some(([, count]) => count);
  openModal({
    title: blocked
      ? t('Cannot permanently delete this linked record', 'لا يمكن حذف هذا السجل المرتبط نهائياً')
      : t('Permanently delete this record?', 'حذف هذا السجل نهائياً؟'),
    sub: blocked
      ? t(
          'Archive it to remove it from active lists while preserving its history.',
          'أرشفه لإزالته من اللوائح النشطة مع الحفاظ على تاريخه.'
        )
      : t('This cannot be undone. Review the record before deleting.', 'لا يمكن التراجع. راجع السجل قبل حذفه.'),
    body: (
      <>
        <div className="stack">
          {links.map(([a, b], i) => (
            <div key={i} className="listrow" style={{ paddingInline: 0 }}>
              <span className="grow">{a}</span>
              <b className="mono">{b}</b>
            </div>
          ))}
        </div>{' '}
        {blocked ? (
          ''
        ) : (
          <>
            <div className="formrow" style={{ marginTop: '16px' }}>
              <label htmlFor="dg_in" className="label">
                {t('Type', 'اكتب')} <b>{p.lat}</b> {t('to confirm', 'للتأكيد')}
              </label>{' '}
              <input className="input" id="dg_in" autoComplete="off" />
            </div>{' '}
            <span className="help help-error" id="dg_help">
              {t('The name does not match yet.', 'الاسم لا يطابق بعد.')}
            </span>
          </>
        )}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {t('Keep record', 'الاحتفاظ بالسجل')}
        </button>{' '}
        {blocked ? (
          ''
        ) : (
          <button className="btn btn-danger" id="dg_go" disabled style={{ marginInlineStart: 'auto' }}>
            {t('Delete permanently', 'حذف نهائي')}
          </button>
        )}
      </>
    ),
    onMount(el) {
      if (blocked) return;
      const inp = el.querySelector('#dg_in'),
        b = el.querySelector('#dg_go'),
        h = el.querySelector('#dg_help');
      inp.addEventListener('input', () => {
        const okk = inp.value.trim() === p.lat;
        b.disabled = !okk;
        h.classList.toggle('help-error', !okk);
        h.classList.toggle('help-ok', okk);
        h.textContent = okk ? t('Match.', 'مطابق.') : t('The name does not match yet.', 'الاسم لا يطابق بعد.');
      });
      b.addEventListener('click', async () => {
        b.disabled = true;
        closeOverlays();
        if (dry)
          return toast(
            t('Confirmed', 'تمّ التأكيد'),
            t('Style-guide specimen — the register is untouched.', 'نموذج من دليل التصميم — السجل لم يُمَسّ.')
          );
        const source = PEOPLE.includes(p) ? PEOPLE : ARCHIVED;
        const index = source.indexOf(p);
        if (index < 0)
          return toast(
            t('Record changed', 'تغيّر السجل'),
            t('Reload and review the current record before deleting.', 'أعد التحميل وراجع السجل الحالي قبل الحذف.'),
            'warning'
          );
        source.splice(index, 1);
        delete PERSON_EXTRA[p.id];
        delete PHOTOS[p.id];
        if (!(await persist())) return;
        if (S.route === 'person') go('people');
        else bus.refresh();
        toast(t('Record deleted', 'حُذف السجل'), p.lat, 'danger');
      });
    }
  });
}

people.mount = host => {
  wireImport(host);
  host.querySelector('#people-export')?.addEventListener('click', peopleExport);
  host.querySelector('#people-directory')?.addEventListener('click', printPeopleDirectory);
  host.querySelectorAll('[data-delete-archived]').forEach(button =>
    button.addEventListener('click', () => {
      const archived = ARCHIVED.find(person => person.id === button.dataset.deleteArchived);
      if (archived) deleteGuard(archived);
    })
  );
  host.querySelectorAll('[data-ri-p]').forEach(tr =>
    tr.addEventListener('click', e => {
      if (e.target.closest('button,input,a,label')) return;
      go('person/' + tr.dataset.riP);
    })
  );
  host.querySelector('[data-split="newp"]')?.addEventListener('click', newPersonDrawer);
  host
    .querySelector('[data-splitmenu="newp"]')
    ?.addEventListener('click', e =>
      openMenu(
        e.currentTarget,
        [
          { label: t('New parishioner', 'مؤمن جديد'), icon: 'people', fn: newPersonDrawer },
          { label: t('New household', 'عائلة جديدة'), icon: 'family', fn: () => CR.create('household') },
          { label: t('Import CSV', 'استيراد CSV'), icon: 'export', fn: () => go('people/import') },
          ...(canSee('requests')
            ? [{ label: t('New certificate request', 'طلب شهادة جديد'), icon: 'doc', fn: () => go('requests') }]
            : [])
        ],
        { width: 240 }
      )
    );
  host.querySelector('[data-filter]')?.addEventListener('click', e => {
    const btn = e.currentTarget,
      current = S.ui.peopleStatus || ['member', 'visitor'];
    const opts = [
      ['member', t('Active', 'نشط')],
      ['visitor', t('Visitor', 'زائر')],
      ['clergy', t('Clergy', 'إكليروس')]
    ];
    openPopover(
      btn,
      <div style={{ padding: '6px' }}>
        <div
          className="head"
          style={{
            padding: '8px 10px 4px',
            font: '500 12px/1 var(--sans)',
            letterSpacing: '.09em',
            textTransform: 'uppercase',
            color: 'var(--text-3)'
          }}
        >
          {t('Status', 'الحالة')}
        </div>{' '}
        {opts.map(([k, lab], i) => (
          <label
            key={i}
            className="opt"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minHeight: '40px',
              padding: '6px 10px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              defaultValue={k}
              defaultChecked={!!current.includes(k)}
              style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
            />{' '}
            <span style={{ flex: 1 }}>{lab}</span>
            <span className="mono t-caption dimmer">{PEOPLE.filter(x => x.status === k).length}</span>
          </label>
        ))}{' '}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 6px 4px',
            borderTop: '1px solid var(--border)',
            marginTop: '6px'
          }}
        >
          <button className="btn btn-ghost btn-dense" id="fclear">
            {t('Clear', 'مسح')}
          </button>{' '}
          <button className="btn btn-primary btn-dense" id="fapply" style={{ marginInlineStart: 'auto' }}>
            {t('Apply', 'تطبيق')}
          </button>
        </div>
      </div>,
      {
        width: 260,
        onMount(el) {
          el.querySelector('#fclear').addEventListener('click', () => {
            S.ui.peopleStatus = null;
            closeMenu();
            bus.refresh();
          });
          el.querySelector('#fapply').addEventListener('click', () => {
            S.ui.peopleStatus = [...el.querySelectorAll('input:checked')].map(c => c.value);
            S.ui.peoplePage = 0;
            closeMenu();
            bus.refresh();
            toast(
              t('Filter applied', 'طُبّق المرشّح'),
              `${PEOPLE.filter(x => S.ui.peopleStatus.includes(x.status)).length} ${t('people', 'شخصاً')}`,
              'success'
            );
          });
        }
      }
    );
  });
  /* search, town and rite filter the whole register (not just this page), then paging starts again */
  const ps = host.querySelector('#psearch');
  if (ps) {
    ps.value = S.ui.peopleQ || '';
    let timer;
    const apply = () => {
      S.ui.peopleQ = ps.value.trim();
      S.ui.peoplePage = 0;
      bus.refresh();
      const again = document.getElementById('psearch');
      again?.focus();
      again?.setSelectionRange(again.value.length, again.value.length);
    };
    ps.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 180);
    });
  }
  host.querySelector('#ptown')?.addEventListener('change', e => {
    S.ui.peopleTown = e.target.value;
    S.ui.peoplePage = 0;
    bus.refresh();
  });
  host.querySelector('#prite')?.addEventListener('change', e => {
    S.ui.peopleRite = e.target.value;
    S.ui.peoplePage = 0;
    bus.refresh();
  });
  host.querySelectorAll('[data-kebab]').forEach(b =>
    b.addEventListener('click', e => {
      e.stopPropagation();
      personMenu(b, b.dataset.kebab);
    })
  );
};

/* ---------------- duplicates ---------------- */
function duplicates() {
  return (
    <div className="tabbody">
      <C.InlineAlert
        tone="warning"
        title={t('2 possible duplicates', 'تكراران محتملان')}
        body={t(
          'Suggested for review only. ParishLife never merges login identities automatically.',
          'مقترحة للمراجعة فقط. لا يدمج «حياة الرعية» هويات الدخول تلقائياً أبداً.'
        )}
      />{' '}
      <div className="stack" style={{ gap: '16px', marginTop: '20px' }}>
        {DUPLICATES.map((d, i) => (
          <section key={i} className="panel">
            <div className="panel-h">
              <h3>{t('Possible match', 'تطابق محتمل')}</h3>{' '}
              <span className="pill pill-warning" style={{ marginInlineStart: 'auto' }}>
                <span className="dot" />
                {d.score}% {t('similar', 'تشابه')}
              </span>
            </div>{' '}
            <div className="panel-b">
              <div className="grid g2" style={{ gap: '16px' }}>
                {[d.a, d.b].map((r, j) => (
                  <div key={j} className="card card-flat">
                    <div className="row" style={{ gap: '10px' }}>
                      <span className="avatar">
                        {r.lat
                          .split(' ')
                          .map(x => x[0])
                          .slice(0, 2)}
                      </span>{' '}
                      <span>
                        <b style={{ display: 'block' }}>{isAr() ? r.ar : r.lat}</b>{' '}
                        <small className="t-caption dim">{isAr() ? r.lat : r.ar}</small>
                      </span>
                    </div>{' '}
                    <dl className="dl" style={{ marginTop: '12px', fontSize: '13px' }}>
                      <dt>{t('Town', 'البلدة')}</dt>
                      <dd>{r.town}</dd>
                      <dt>{t('Envelope', 'المظروف')}</dt>
                      <dd className="mono">{r.env}</dd>
                      <dt>{t('Born', 'الولادة')}</dt>
                      <dd className="mono">{r.born}</dd>
                    </dl>{' '}
                    <label className="check" style={{ marginTop: '12px' }}>
                      <input type="radio" name={`keep${i}`} defaultChecked={!!(j === 0)} />{' '}
                      <span>{t('Keep this one', 'احتفظ بهذا')}</span>
                    </label>
                  </div>
                ))}
              </div>{' '}
              <div className="row" style={{ gap: '8px', marginTop: '16px' }}>
                <button className="btn btn-secondary" data-act={`dup-dismiss:${i}`}>
                  {t('Not a duplicate', 'ليسا مكرَّرين')}
                </button>{' '}
                <button className="btn btn-primary" style={{ marginInlineStart: 'auto' }} data-act={`dup-merge:${i}`}>
                  {t('Compare and merge', 'قارن وادمج')}
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const importFields = [
  ['lat', 'English name'],
  ['ar', 'Arabic name'],
  ['phone', 'Phone'],
  ['born', 'Birth date'],
  ['town', 'Town'],
  ['rite', 'Rite'],
  ['occupation', 'Line of work']
];

function importView() {
  const review = importReview(),
    valid = review.filter(x => !x.errors.length),
    invalid = review.filter(x => x.errors.length);
  const duplicates = importDraft?.map.filter(Boolean).filter((x, i, a) => a.indexOf(x) !== i) || [];
  return (
    <div className="stack" style={{ marginTop: '20px', gap: '16px' }}>
      <Panel title={t('1 · Choose a CSV file', '١ · اختر ملف CSV')}>
        <input
          className="input"
          type="file"
          id="people-import-file"
          accept=".csv,text/csv"
          aria-label={t('Choose CSV file', 'اختر ملف CSV')}
        />{' '}
        {importDraft ? (
          <p className="help">
            {importDraft.name} · {importDraft.rows.length} {t('data rows', 'صفوف بيانات')}
          </p>
        ) : (
          <p className="help">
            {t(
              'Use a CSV file with column headings. Nothing is saved until you review and confirm.',
              'استخدم ملف CSV بعناوين أعمدة. لا يُحفظ شيء قبل المراجعة والتأكيد.'
            )}
          </p>
        )}
      </Panel>{' '}
      {importDraft ? (
        <Panel title={t('2 · Map columns', '٢ · طابق الأعمدة')} tight={true}>
          <Table
            cols={[{ label: t('File column', 'عمود الملف') }, { label: t('Save as', 'احفظ باسم') }]}
            rows={importDraft.header.map((name, i) => ({
              cells: [
                name,
                <Select
                  defaultValue={importDraft.map[i]}
                  data-import-map={i}
                  aria-label={`${t('Map column', 'طابق العمود')} ${name}`}
                >
                  <option value="">{t('Skip', 'تخطّ')}</option>
                  {importFields.map(([key, label], k) => (
                    <option key={k} value={key}>
                      {t(label, label)}
                    </option>
                  ))}
                </Select>
              ]
            }))}
          />
        </Panel>
      ) : (
        ''
      )}{' '}
      {importDraft ? (
        <Panel title={t('3 · Review and save', '٣ · راجع واحفظ')} tight={true}>
          {duplicates.length ? (
            <p className="alert alert-warning">
              {t(
                'A destination field is mapped more than once. Choose each field once.',
                'حقل الهدف محدّد أكثر من مرة. اختر كل حقل مرة واحدة.'
              )}
            </p>
          ) : (
            ''
          )}{' '}
          <div className="stats">
            <Stat k={t('Ready', 'جاهز')} v={valid.length} />
            <Stat k={t('Needs correction', 'يحتاج تصحيحاً')} v={invalid.length} />
          </div>{' '}
          <Table
            cols={[
              { label: t('Row', 'الصف') },
              { label: t('English name', 'الاسم الإنكليزي') },
              { label: t('Arabic name', 'الاسم العربي') },
              { label: t('Result', 'النتيجة') }
            ]}
            rows={review
              .slice(0, 100)
              .map(item => ({
                cells: [
                  String(item.line),
                  item.record.lat || '—',
                  item.record.ar || '—',
                  item.errors.length ? item.errors.join(' · ') : <Pill label={t('Ready', 'جاهز')} tone="success" />
                ]
              }))}
          />{' '}
          {review.length > 100 ? (
            <p className="help">
              {t(
                'Showing the first 100 rows; every row is validated before save.',
                'تظهر أول ١٠٠ صف؛ يُفحص كل صف قبل الحفظ.'
              )}
            </p>
          ) : (
            ''
          )}{' '}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: '14px' }}>
            <button
              className="btn btn-primary"
              id="people-import-save"
              disabled={!!(!valid.length || invalid.length || duplicates.length)}
            >
              {t('Import reviewed records', 'استيراد السجلات المراجعة')}
            </button>
          </div>
        </Panel>
      ) : (
        ''
      )}{' '}
      {importDraft?.result ? <p className="alert alert-success">{importDraft.result}</p> : ''}
    </div>
  );
}

function printPeopleDirectory() {
  const listed = PEOPLE.filter(p => PERSON_EXTRA[p.id]?.directory).sort((a, b) => a.lat.localeCompare(b.lat));
  if (!listed.length)
    return toast(
      t('Nobody to print yet', 'لا أحد للطباعة بعد'),
      t('Only people who opted in to the directory are printed.', 'لا يُطبع إلا من وافق على الإدراج في الدليل.'),
      'warning'
    );
  /* printed from a hidden frame, so the page stays where it is and no new tab opens */
  printSheet({
    title: t('Parish people directory', 'دليل مؤمني الرعية'),
    margin: '14mm',
    css: 'h1{font:600 20px/28px Inter,sans-serif;margin:0 0 4px}p{margin:0 0 14px;color:#607068}table{width:100%;border-collapse:collapse}th,td{text-align:start;padding:7px 9px;border-bottom:1px solid #EDF0E8}th{background:#F7F7F2;font:600 10px/14px Inter,sans-serif;text-transform:uppercase;letter-spacing:.05em}',
    body: (
      <>
        <h1>{t('Parish people directory', 'دليل مؤمني الرعية')}</h1>
        <p>
          {t('Only people who opted in are included.', 'يشمل فقط من وافقوا على الإدراج.')} · {listed.length}
        </p>{' '}
        <table>
          <thead>
            <tr>
              {[
                t('English name', 'الاسم بالإنكليزية'),
                t('Arabic name', 'الاسم بالعربية'),
                t('Household', 'العائلة'),
                t('Town', 'البلدة'),
                t('Phone', 'الهاتف')
              ].map((x, i) => (
                <th key={i}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listed.map((p, i) => {
              const h = hh(p.hh);
              return (
                <tr key={i}>
                  <td dir="auto">{p.lat}</td>
                  <td dir="auto">{p.ar}</td>
                  <td>{h ? t(h.name, h.ar || h.name) : ''}</td>
                  <td>{t(p.town || '', p.townAr || p.town || '')}</td>
                  <td dir="ltr">{p.phone === '—' ? '' : p.phone}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    )
  });
}

/* ---------------- new-person drawer ---------------- */
export function newPersonDrawer() {
  delete PHOTOS.new; // a photo left from a cancelled drawer does not carry over
  openDrawer({
    large: true,
    title: t('New parishioner', 'مؤمن جديد'),
    sub: t(
      'Both names are required. The Arabic name is what a certificate prints.',
      'الاسمان مطلوبان. الاسم العربي هو ما تطبعه الشهادة.'
    ),
    body: (
      <>
        <C.NamePair />
        <C.RiteSelect />
        <C.PhoneField id="newphone" value="" required={false} />{' '}
        <div className="formgrid">
          <C.Field label={t('Date of birth', 'تاريخ الولادة')} type="date" id="newborn" />
        </div>{' '}
        {occupationField('newoccupation')} <div className="divider" />{' '}
        <h4 className="t-ui" style={{ marginBottom: '12px' }}>
          {t('Address', 'العنوان')}
        </h4>{' '}
        <C.AddressCascade /> <div className="divider" />{' '}
        <div className="formgrid">
          <div className="formrow">
            <label className="label" htmlFor="newblood">
              {t('Blood type', 'زمرة الدم')}
              <span className="opt">{t('(for emergencies)', '(للطوارئ)')}</span>
            </label>{' '}
            <Select id="newblood">
              <option value="">—</option>
              <option>O+</option>
              <option>O−</option>
              <option>A+</option>
              <option>B+</option>
              <option>AB+</option>
            </Select>
          </div>{' '}
          <div className="formrow">
            <label htmlFor="newlang" className="label">
              {t('Language', 'اللغة')}
            </label>{' '}
            <Select id="newlang">
              <option value="ar">{t('Arabic', 'العربية')}</option>
              <option value="en">{t('English', 'الإنكليزية')}</option>
              <option value="fr">{t('French', 'الفرنسية')}</option>
            </Select>
          </div>
        </div>{' '}
        <div className="formrow">
          <label className="label">{t('Assign to existing groups', 'إسناد إلى مجموعات قائمة')}</label>
          <div className="choice-grid">
            {GROUPS.map((g, i) => (
              <label key={i} className="row">
                <input type="checkbox" id={`newgroup-${g.id}`} />
                <span>{t(g.name, g.ar)}</span>
              </label>
            ))}
          </div>
          <span className="help">
            {t(
              'Only existing groups can be assigned during registration.',
              'يمكن الإسناد إلى المجموعات القائمة فقط عند التسجيل.'
            )}
          </span>
        </div>{' '}
        <C.AvatarUpload k="new" /> <div className="divider" />{' '}
        <div className="stack" style={{ gap: '10px' }}>
          <C.CheckRow
            label={t('Send parish announcements on WhatsApp', 'إرسال إعلانات الرعية على واتساب')}
            id="announce-optin"
          />{' '}
          <label className="row">
            <input type="checkbox" id="directory-optin" />
            <span>{t('Include in the printed parish directory', 'إدراج في دليل الرعية المطبوع')}</span>
          </label>{' '}
          <p className="help">
            {t(
              'This controls the printed parish people directory: English and Arabic names, household, town, and phone. It does not change private records or other exports.',
              'يتحكّم هذا بدليل مؤمني الرعية المطبوع: الاسمان الإنكليزي والعربي والعائلة والبلدة والهاتف. لا يغيّر السجلات الخاصة أو الصادرات الأخرى.'
            )}
          </p>
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {t('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-secondary" id="person-save-next">
          {t('Save & add next', 'حفظ وإضافة التالي')}
        </button>{' '}
        <button className="btn btn-primary" id="person-save" style={{ marginInlineStart: 'auto' }}>
          {t('Save parishioner', 'حفظ المؤمن')}
        </button>
      </>
    ),
    onMount(el) {
      let saving = false;
      async function save(addNext) {
        if (saving) return;
        const lat = el.querySelector('#latname')?.value.trim(),
          ar = el.querySelector('#arname')?.value.trim();
        if (
          !needAll(el, [
            ['#latname', t('Enter the English name', 'أدخل الاسم الإنكليزي')],
            ['#arname', t('Enter the Arabic name', 'أدخل الاسم العربي')]
          ])
        )
          return;
        const address = readAddressCascade(el);
        if (
          (address.governorate || address.district || address.town) &&
          (!address.governorate || !address.district || !address.town)
        )
          return toast(t('Complete the address hierarchy', 'أكمل تسلسل العنوان'), '', 'warning');
        saving = true;
        el.querySelectorAll('#person-save,#person-save-next').forEach(b => (b.disabled = true));
        const id = 'p' + Date.now().toString(36);
        const rec = {
          id,
          lat,
          ar,
          town: address.town || '',
          townAr: address.townAr || '',
          rite: el.querySelector('#newrite')?.value || 'Maronite',
          status: 'member',
          phone: el.querySelector('#newphone')?.value.trim() || '—',
          born: el.querySelector('#newborn')?.value || '',
          hh: null,
          tags: []
        };
        PEOPLE.unshift(rec);
        const announcement = !!el.querySelector('#announce-optin')?.checked,
          directory = !!el.querySelector('#directory-optin')?.checked;
        PERSON_EXTRA[id] = {
          address,
          directory,
          blood: el.querySelector('#newblood')?.value || '',
          lang: el.querySelector('#newlang')?.value || 'ar',
          occupation: el.querySelector('#newoccupation')?.value.trim() || '',
          channel: announcement ? 'whatsapp' : '',
          skills: [],
          dates: [],
          consent: [
            ['Parish announcements on WhatsApp', 'إعلانات الرعية على واتساب', announcement],
            ['Printed parish directory', 'الدليل المطبوع', directory],
            ['Photos in parish media', 'الصور في وسائل الرعية', false]
          ]
        };
        el.querySelectorAll('input[id^="newgroup-"]:checked').forEach(input => {
          const gid = input.id.slice(9),
            g = GROUPS.find(x => x.id === gid);
          const detail = (GROUP_DETAIL[gid] ||= {
            roster: [],
            assistant: null,
            roles: [],
            requests: [],
            meetings: [],
            posts: [],
            files: []
          });
          detail.roster ||= [];
          if (!detail.roster.some(r => r.p === id))
            detail.roster.push({
              p: id,
              role: 'Member',
              roleAr: 'عضو',
              joined: new Date().getFullYear().toString(),
              att: 0
            });
          if (g) g.members = detail.roster.length;
        });
        if (PHOTOS.new) {
          PHOTOS[id] = PHOTOS.new;
          delete PHOTOS.new;
        }
        if (!(await persist())) {
          saving = false;
          el.querySelectorAll('#person-save,#person-save-next').forEach(b => (b.disabled = false));
          return;
        }
        D.PARISH.people = PEOPLE.length;
        closeOverlays();
        toast(t('Parishioner saved', 'حُفظ المؤمن'), `${lat} · ${ar}`, 'success');
        if (addNext) {
          bus.refresh();
          newPersonDrawer();
        } else go('person/' + id);
      }
      el.querySelector('#person-save').addEventListener('click', () => save(false));
      el.querySelector('#person-save-next').addEventListener('click', () => save(true));
    }
  });
}

/* ---------------- archived ----------------
   Archiving takes a person out of the active lists and keeps their history; here they can be
   restored, or reviewed for permanent deletion. */
function archivedPeople() {
  return (
    <div className="tabbody">
      <C.InlineAlert
        tone="info"
        title={t('Archived records remain restorable', 'تبقى السجلات المؤرشفة قابلة للاسترجاع')}
        body={t(
          'Archive removes a person from active lists and preserves linked history. Permanent deletion requires an unlinked record and typed confirmation.',
          'تزيل الأرشفة الشخص من اللوائح النشطة وتحفظ السجلات المرتبطة به. يتطلّب الحذف النهائي سجلاً بلا روابط وتأكيداً بكتابة الاسم.'
        )}
      />
      <Table
        cols={[
          { label: t('Name', 'الاسم') },
          { label: t('Archived', 'أُرشف') },
          { label: t('By', 'بواسطة'), cls: 'hide-sm' },
          { label: '', cls: 'shrink' }
        ]}
        rows={ARCHIVED.map(p => ({
          key: p.id,
          cells: [
            <a href={`#/person/${p.id}`}>
              <b>{isAr() ? p.ar : p.lat}</b>
            </a>,
            <span className="mono dim">{fmtDate(p.archived)}</span>,
            <span className="dim">{(isAr() ? person(p.archivedBy)?.ar : person(p.archivedBy)?.lat) || '—'}</span>,
            <span className="row" style={{ gap: '6px' }}>
              <button className="btn btn-secondary btn-dense" data-act={`restore:${p.id}`}>
                {t('Restore', 'استرجاع')}
              </button>{' '}
              <button className="btn btn-danger-quiet btn-dense" data-delete-archived={p.id}>
                {t('Review deletion', 'مراجعة الحذف')}
              </button>
            </span>
          ]
        }))}
        empty={
          <Empty
            glyph="people"
            title={t('Nobody is archived', 'لا أحد مؤرشف')}
            body={t(
              'Archive someone from their row menu; they can be restored here.',
              'أرشف شخصاً من قائمة صفّه؛ ويمكن استرجاعه هنا.'
            )}
          />
        }
      />
    </div>
  );
}
