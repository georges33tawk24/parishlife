/* Households: the list (cards or table), one household with its members and envelope, and
   exporting them. */
import { nodesOr } from '../../ui/html.js';
import { t } from '../../../lib/i18n.js';
import { S, bus } from '../../model/store.js';
import { Icon, PageHead, Panel, Who, Table, Empty, SearchField, toast, Avatar, Paged } from '../../ui/ui.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { saveBlob, fileName } from '../../shared/print.js';
import { HOUSEHOLDS, person } from '../../model/data.js';
import { label, relLabel } from './people-shared.jsx';
import { familyTree } from './family-tree.jsx';

/* ---------------- households ---------------- */
export function exportHouseholds(ids) {
  const selected = HOUSEHOLDS.filter(h => ids.includes(h.id));
  if (!selected.length) return toast(t('Select at least one household', 'اختر عائلة واحدة على الأقل'), '', 'warning');
  const headings = [
    'Household ID',
    'Family (English)',
    'Family (Arabic)',
    'Town',
    'Address',
    'Envelope',
    'Contact person',
    'Person ID',
    'Name (English)',
    'Name (Arabic)',
    'Relationship',
    'Related to',
    'Phone',
    'Date of birth'
  ];
  const rows = selected.flatMap(h => {
    const members = h.members.map(person).filter(Boolean);
    return (members.length ? members : [null]).map(p => [
      h.id,
      h.name,
      h.ar,
      t(h.town, h.townAr),
      t(h.address, h.addressAr),
      h.envelope || '',
      label(person(h.head)),
      p?.id || '',
      p?.lat || '',
      p?.ar || '',
      p ? relLabel(p, h) : '',
      label(person(p?.relativeTo)),
      p?.phone || '',
      p?.born || ''
    ]);
  });
  const cell = value => {
    const s = String(value ?? '');
    return '"' + (/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
  };
  saveBlob(
    fileName(selected.length === 1 ? selected[0].name : 'households', new Date().toLocaleDateString('sv-SE')) + '.csv',
    new Blob(['\uFEFF' + [headings, ...rows].map(row => row.map(cell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8'
    })
  );
}

export function households() {
  const selected = new Set(S.ui.householdSelection || []);
  const selectBox = h => (
    <input
      type="checkbox"
      data-household-select={h.id}
      defaultChecked={!!selected.has(h.id)}
      aria-label={t('Select household', 'اختيار العائلة') + ' ' + t(h.name, h.ar)}
    />
  );
  const open = h => (
    <a className="btn btn-ghost btn-dense" href={`#/household/${h.id}`}>
      {t('Open household', 'فتح العائلة')}
    </a>
  );
  const cards = HOUSEHOLDS.map((h, i) => {
    const members = h.members.map(person).filter(Boolean);
    return (
      <section key={i} className="panel" data-find-item="" data-household-id={h.id}>
        <div className="panel-b">
          <div className="row" style={{ gap: '12px', alignItems: 'flex-start' }}>
            {selectBox(h)}
            <span className="avatar avatar-lg">{t(h.name, h.ar).slice(0, 2)}</span>{' '}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', font: '600 16px/22px var(--sans)' }}>{t(h.name, h.ar)}</b>{' '}
              <small className="t-caption dim">
                {t(h.town, h.townAr)}
                {h.envelope ? (
                  <>
                    {' '}
                    · {t('Offering envelope', 'مظروف العطاء')} <span className="mono">{h.envelope}</span>
                  </>
                ) : (
                  ''
                )}
              </small>
            </div>
            {CR.recBtn('household', h.id)}
          </div>{' '}
          <p className="t-caption dim" style={{ marginTop: '12px' }}>
            {t(h.address, h.addressAr) || t('No address yet', 'لا عنوان بعد')}
          </p>{' '}
          <div className="divider" />{' '}
          <div className="row" style={{ gap: '8px' }}>
            <span className="avatar-stack">
              {members.map((m, i) => (
                <Avatar key={i} p={m} cls="avatar-sm" />
              ))}
            </span>{' '}
            <span className="t-caption dim">
              {members.length} {t(members.length === 1 ? 'member' : 'members', 'أفراد')}
            </span>{' '}
            <span style={{ marginInlineStart: 'auto' }}>{open(h)}</span>
          </div>
        </div>
      </section>
    );
  });
  const tableView = (
    <Table
      cols={[
        { label: t('Select', 'اختيار'), cls: 'shrink' },
        { label: t('Family', 'العائلة'), sort: true },
        { label: t('Town', 'البلدة'), cls: 'hide-sm' },
        { label: t('Offering envelope', 'مظروف العطاء'), cls: 'shrink' },
        { label: t('Members', 'الأفراد'), cls: 'num' },
        { label: '', cls: 'shrink' }
      ]}
      rows={HOUSEHOLDS.map(h => ({
        attrs: `data-find-item data-household-id="${h.id}"`,
        cells: [
          selectBox(h),
          <b>{t(h.name, h.ar)}</b>,
          <span className="dim">{t(h.town, h.townAr)}</span>,
          <span className="mono">{h.envelope || '—'}</span>,
          <span className="num">{h.members.length}</span>,
          <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
            {open(h)}
            {CR.recBtn('household', h.id)}
          </span>
        ]
      }))}
      empty={
        <Empty
          glyph="family"
          title={t('No households yet', 'لا عائلات بعد')}
          body={t(
            'Add the first one — a household is linked by home and envelope number.',
            'أضف الأولى — العائلة مرتبطة بالمنزل ورقم المظروف.'
          )}
          action={
            <button className="btn btn-primary btn-dense" data-act="household-new">
              {t('New household', 'عائلة جديدة')}
            </button>
          }
        />
      }
    />
  );
  return (
    <>
      <PageHead
        crumbs={[{ label: t('Records', 'السجلات') }, { label: t('Households', 'العائلات') }]}
        title={t('Households', 'العائلات')}
        sub={t(
          `${HOUSEHOLDS.length} households · select existing people and enter their shared address once`,
          `${HOUSEHOLDS.length} عائلة · اختر الأشخاص المسجّلين وأدخل عنوانهم المشترك مرة واحدة`
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-household-export="filtered">
              <Icon name="export" size={17} />
              {t('Export filtered households', 'تصدير العائلات المصفّاة')}
            </button>{' '}
            <button className="btn btn-primary" data-act="household-new">
              <Icon name="plus" size={17} />
              {t('New household', 'عائلة جديدة')}
            </button>
          </>
        }
      />{' '}
      <div className="toolbar" style={{ marginBottom: '16px' }}>
        <div className="grow" style={{ maxWidth: '320px' }}>
          <SearchField ph={t('Family name or envelope', 'اسم العائلة أو المظروف')} data-find="" />
        </div>{' '}
        <button className="btn btn-secondary btn-dense" data-household-export="selected" disabled={!selected.size}>
          {t('Export selected households', 'تصدير العائلات المحدّدة')}{' '}
          <span data-household-count="">{selected.size}</span>
        </button>{' '}
        <button className="btn btn-ghost btn-dense" data-household-select-all="">
          {t('Select visible', 'اختيار المعروض')}
        </button>{' '}
        <span className="seg" role="group" aria-label={t('View', 'العرض')}>
          <button aria-pressed={S.ui.hhView !== 'table'} data-act="hh-view:cards">
            {t('Cards', 'بطاقات')}
          </button>{' '}
          <button aria-pressed={S.ui.hhView === 'table'} data-act="hh-view:table">
            {t('Table', 'جدول')}
          </button>
        </span>
      </div>{' '}
      {S.ui.hhView === 'table' ? (
        tableView
      ) : HOUSEHOLDS.length ? (
        <Paged className="gridcards">{cards}</Paged>
      ) : (
        tableView
      )}{' '}
      <p className="help" style={{ marginTop: '18px' }}>
        {t(
          'New households reuse existing people. Review suggested surname matches, select several members, and enter one shared address. No people or households are merged automatically. An offering-envelope identifier is optional.',
          'تستخدم العائلات الجديدة أشخاصاً مسجّلين. راجع اقتراحات اسم العائلة، واختر عدة أفراد، وأدخل عنواناً مشتركاً واحداً. لا تُدمج السجلات تلقائياً. رمز مظروف العطاء اختياري.'
        )}
      </p>{' '}
      <div className="find-empty" hidden>
        <Empty
          glyph="search"
          title={t('No household matches', 'لا عائلة مطابقة')}
          body={t('Try part of the family name or the envelope number.', 'جرّب جزءاً من اسم العائلة أو رقم المظروف.')}
        />
      </div>
    </>
  );
}

households.mount = host => {
  const visibleIds = (pageOnly = false) =>
    [...host.querySelectorAll('[data-household-id]')]
      .filter(row => !row.hidden && row.style.display !== 'none' && (!pageOnly || row.dataset.pageHidden !== 'true'))
      .map(row => row.dataset.householdId);
  const selected = new Set((S.ui.householdSelection || []).filter(id => HOUSEHOLDS.some(h => h.id === id)));
  const update = () => {
    S.ui.householdSelection = [...selected];
    host.querySelector('[data-household-count]').textContent = selected.size;
    host.querySelector('[data-household-export="selected"]').disabled = !selected.size;
  };
  host.querySelectorAll('[data-household-select]').forEach(box =>
    box.addEventListener('change', () => {
      box.checked ? selected.add(box.dataset.householdSelect) : selected.delete(box.dataset.householdSelect);
      update();
    })
  );
  host.querySelector('[data-household-select-all]')?.addEventListener('click', () => {
    visibleIds(true).forEach(id => selected.add(id));
    host
      .querySelectorAll('[data-household-select]')
      .forEach(box => (box.checked = selected.has(box.dataset.householdSelect)));
    update();
  });
  host
    .querySelectorAll('[data-household-export]')
    .forEach(button =>
      button.addEventListener('click', () =>
        exportHouseholds(button.dataset.householdExport === 'selected' ? [...selected] : visibleIds())
      )
    );
};

export function householdView(id = '') {
  const h = HOUSEHOLDS.find(x => x.id === id);
  if (!h)
    return (
      <Empty
        glyph="family"
        title={t('Household not found', 'العائلة غير موجودة')}
        body={t('This household may have been removed.', 'ربما أزيلت هذه العائلة.')}
        action={
          <a className="btn btn-primary" href="#/households">
            {t('Back to households', 'العودة إلى العائلات')}
          </a>
        }
      />
    );
  const members = h.members.map(person).filter(Boolean);
  const view = S.ui.householdDetailView || 'both';
  return (
    <>
      <PageHead
        crumbs={[{ label: t('Households', 'العائلات'), href: '#/households' }, { label: t(h.name, h.ar) }]}
        title={t(h.name, h.ar)}
        sub={t(`${members.length} household members`, `${members.length} أفراد`)}
        actions={
          <>
            <button className="btn btn-secondary" data-household-export-id={h.id}>
              <Icon name="export" size={17} />
              {t('Export this household', 'تصدير هذه العائلة')}
            </button>
            {CR.recBtn('household', h.id)}
          </>
        }
      />
      <div className="toolbar" style={{ margin: '18px 0' }}>
        <span className="seg" role="group" aria-label={t('Household view', 'عرض العائلة')}>
          {[
            ['list', 'List', 'قائمة'],
            ['tree', 'Tree', 'شجرة'],
            ['both', 'Both', 'كلاهما']
          ].map(([key, en, ar], i) => (
            <button key={i} data-hh-detail-view={key} aria-pressed={view === key}>
              {t(en, ar)}
            </button>
          ))}
        </span>
      </div>{' '}
      <div className="splitview">
        <div className="stack" style={{ gap: '16px' }}>
          {view === 'list' ? '' : <Panel title={t('Family tree', 'شجرة العائلة')}>{familyTree(h, h.head)}</Panel>}{' '}
          {view === 'tree' ? (
            ''
          ) : (
            <Panel title={t('Members and relationships', 'الأفراد وصلاتهم')} tight={true}>
              {nodesOr(
                members.map((m, i) => (
                  <a key={i} className="listrow" href={`#/person/${m.id}`}>
                    <Who p={m} />
                    <span className="grow" />
                    <span className="dim">{relLabel(m, h)}</span>
                  </a>
                )),
                <Empty
                  glyph="family"
                  title={t('No members', 'لا أفراد')}
                  body={t('Add a member from a person record.', 'أضف فرداً من سجلّه.')}
                />
              )}
            </Panel>
          )}
        </div>{' '}
        <div className="sidecol">
          <Panel title={t('Household details', 'تفاصيل العائلة')}>
            <dl className="dl">
              <dt>{t('Head', 'ربّ العائلة')}</dt>
              <dd>{h.head ? <a href={`#/person/${h.head}`}>{label(person(h.head))}</a> : '—'}</dd>
              <dt>{t('Giving envelope number', 'رقم مظروف العطاء')}</dt>
              <dd>{h.envelope || '—'}</dd>
              <dt>{t('Address', 'العنوان')}</dt>
              <dd>{t(h.address, h.addressAr)}</dd>
              <dt>{t('Town', 'البلدة')}</dt>
              <dd>{t(h.town, h.townAr)}</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}

householdView.mount = host => {
  host
    .querySelector('[data-household-export-id]')
    ?.addEventListener('click', e => exportHouseholds([e.currentTarget.dataset.householdExportId]));
  host.querySelectorAll('[data-hh-detail-view]').forEach(button =>
    button.addEventListener('click', () => {
      S.ui.householdDetailView = button.dataset.hhDetailView;
      bus.refresh();
    })
  );
};
