/* The eparchy view (bishop access): parishioners across the parishes the account may see, by
   parish, and the priest assignments. */
import { nodesOr, paint } from '../../ui/html.js';
import { t, num, fmtDate } from '../../../lib/i18n.js';
import { is } from '../../model/store.js';
import { Icon, PageHead, Panel, Pill, Table, Empty, TabBar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { api } from '../../model/api.js';
import { PARISH, PARISHES, EPARCHY_NEWS } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

export function eparchy(tab = '') {
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Eparchy', 'الأبرشية') }]}
        title={L(PARISH.eparchy, PARISH.eparchyAr)}
        sub={L(
          'Aggregated across the parishes you hold a role in. Restricted parish records are never exposed here by default.',
          'مجمَّع عبر الرعايا التي لك دور فيها. ولا تُكشف السجلات المقيّدة هنا افتراضياً.'
        )}
        actions={
          <button className="btn btn-secondary" data-act="export">
            <Icon name="export" size={17} />
            {L('Export', 'تصدير')}
          </button>
        }
      />
      <TabBar
        base="eparchy"
        items={[
          ['', 'Parishes', 'الرعايا'],
          ['news', 'Announcements', 'الإعلانات'],
          ['aggregate', 'Aggregates', 'التجميعات']
        ]}
        active={tab}
      />
    </>
  );
  if (tab === 'news')
    return (
      <>
        {head}
        <Table
          cols={[
            { label: L('Announcement', 'الإعلان') },
            { label: L('Date', 'التاريخ') },
            { label: L('Shared with parishes', 'مشترك مع الرعايا'), cls: 'shrink' },
            { label: '', cls: 'shrink' }
          ]}
          rows={EPARCHY_NEWS.map(n => ({
            cells: [
              <b>{L(n.title, n.ar)}</b>,
              <span className="mono dim">{fmtDate(n.at)}</span>,
              n.shared ? (
                <Pill label={L('Shared', 'مشترك')} tone="success" />
              ) : (
                <Pill label={L('Clergy only', 'للإكليروس فقط')} tone="info" />
              ),
              <button className="btn btn-secondary btn-dense" data-act={`doc:${L(n.title, n.ar)}`}>
                {L('Open', 'فتح')}
              </button>
            ]
          }))}
        />
      </>
    );
  if (tab === 'aggregate')
    return (
      <>
        {head}
        <div className="grid g2">
          <C.Kpi
            k={L('People across accessible parishes', 'المؤمنون في الرعايا المتاحة')}
            v={num(PARISHES.reduce((a, p) => a + p.people, 0))}
            sub={`${PARISHES.length} ${L('parishes', 'رعايا')}`}
          />{' '}
          <C.Kpi
            k={L(`Sacraments registered, ${new Date().getFullYear()}`, `الأسرار المسجَّلة ${new Date().getFullYear()}`)}
            v={num(PARISHES.reduce((a, p) => a + (p.sacramentsYear || 0), 0))}
            sub={L('across accessible registers', 'في السجلات المتاحة')}
          />
        </div>{' '}
        <Panel title={L('Parishioners by parish', 'المؤمنون حسب الرعية')}>
          <C.BarChart
            rows={PARISHES.map(p => ({ label: L(p.name, p.ar), v: p.people, max: 2200, text: num(p.people) }))}
          />
        </Panel>{' '}
        <C.InlineAlert
          tone="info"
          title={L('Small groups are not broken out', 'لا تُفصَّل المجموعات الصغيرة')}
          body={L(
            'An aggregate never splits a figure so far that an individual could be identified by elimination.',
            'لا يقسّم التجميع رقماً إلى حدّ يسمح بتحديد شخص بالاستبعاد.'
          )}
        />
      </>
    );
  return (
    <>
      {head}
      {
        <Table
          cols={[
            { label: L('Parish', 'الرعية'), sort: true },
            { label: L('Town', 'البلدة'), cls: 'hide-sm' },
            { label: L('Your role there', 'دورك فيها'), cls: 'hide-sm' },
            { label: L('People', 'المؤمنون'), cls: 'num', sort: true },
            { label: L('Households', 'العائلات'), cls: 'num hide-sm' },
            { label: '', cls: 'shrink' }
          ]}
          rows={PARISHES.map(p => ({
            cells: [
              <span className="row" style={{ gap: '10px' }}>
                <span className="avatar">{L(p.name, p.ar).slice(0, 1)}</span> <b>{L(p.name, p.ar)}</b>
              </span>,
              <span className="dim">{L(p.town, p.townAr)}</span>,
              <span className="chip">{L(p.role, p.roleAr)}</span>,
              <span className="num">{num(p.people)}</span>,
              <span className="num dim">{num(p.households)}</span>,
              L(p.name, p.ar) === L(PARISH.name, PARISH.nameAr) ? (
                <Pill label={L('Current', 'الحالية')} tone="success" />
              ) : (
                <button className="btn btn-secondary btn-dense" data-act={`parish-switch:${p.id}`}>
                  {L('Switch to', 'التبديل إليها')}
                </button>
              )
            ]
          }))}
        />
      }{' '}
      {
        <C.InlineAlert
          tone="info"
          title={L('Every record belongs to one parish', 'كل سجل يخصّ رعية واحدة')}
          body={L(
            'Groups, facilities, events and financial records are all owned by a parish, and a person’s memberships are recorded explicitly rather than inferred.',
            'المجموعات والمرافق والأحداث والسجلات المالية كلها مملوكة لرعية، وانتساب الشخص يُسجَّل صراحةً لا استنتاجاً.'
          )}
        />
      }
    </>
  );
}

eparchy.mount = host => {};

export function assignments() {
  if (!is('bishop'))
    return (
      <Empty
        glyph="shield"
        title={L('Bishop access required', 'تتطلّب صلاحية المطران')}
        body={L('Only the bishop can assign parish priests.', 'المطران وحده يعيّن كهنة الرعايا.')}
      />
    );
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Archdiocese', 'الأبرشية') }, { label: L('Priest assignments', 'تعيينات الكهنة') }]}
        title={L('Priest assignments', 'تعيينات الكهنة')}
        sub={L(
          'Read-only view of clergy assignments. Changes are made by an operator on the parish server.',
          'عرض تعيينات الكهنة للقراءة فقط. يجري المشغّل التغييرات على خادم الرعية.'
        )}
      />
      <div id="assignment-body" className="tabbody">
        <p className="dim">{L('Loading assignments…', 'جارٍ تحميل التعيينات…')}</p>
      </div>
    </>
  );
}

assignments.mount = async host => {
  const body = host.querySelector('#assignment-body');
  if (!body) return;
  try {
    const data = await api('assignments');
    paint(
      body,
      data.priests.length ? (
        data.priests.map(priest => (
          <section className="panel" style={{ marginBottom: '16px' }} data-priest={priest.id}>
            <div className="panel-h">
              <h3>{priest.name}</h3>
            </div>
            <div className="panel-b">
              <div className="stack" style={{ gap: '10px' }}>
                {nodesOr(
                  data.parishes
                    .filter(p => priest.parishes.includes(p.id))
                    .map(p => (
                      <div className="listrow">
                        <span>
                          {L(p.name, p.ar)} · {L(p.town, p.townAr)}
                        </span>
                      </div>
                    )),
                  <p className="help">{L('No assigned parishes.', 'لا رعايا معيّنة.')}</p>
                )}
              </div>
            </div>
          </section>
        ))
      ) : (
        <Empty
          glyph="people"
          title={L('No priest accounts yet', 'لا حسابات كهنة بعد')}
          body={L(
            'Create a priest account on the server, then assign its parishes here.',
            'أنشئ حساب كاهن على الخادم ثم عيّن رعاياه هنا.'
          )}
        />
      )
    );
  } catch (e) {
    paint(body, <div className="alert alert-danger">{e.message}</div>);
  }
};
