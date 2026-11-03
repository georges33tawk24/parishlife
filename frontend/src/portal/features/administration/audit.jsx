/* The audit trail: who did what and when, including access to restricted records. */
import { t } from '../../../lib/i18n.js';
import { S } from '../../model/store.js';
import { Icon, PageHead, Who, Pill, Table, Empty } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { AUDIT, person } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

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
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Audit trail', 'سجل التدقيق') }]}
        title={L('Audit trail', 'سجل التدقيق')}
        sub={L(
          'Who did what, and when. Available to authorized clergy and administrators in this parish. Audit records cannot be edited.',
          'من فعل ماذا ومتى. متاح للكهنة والمديرين المخوّلين في الرعية. لا يمكن تعديل سجل التدقيق.'
        )}
        actions={
          <button className="btn btn-secondary" data-act="export">
            <Icon name="export" size={17} />
            {L('Export', 'تصدير')}
          </button>
        }
      />{' '}
      <div className="toolbar">
        <div className="grow" style={{ maxWidth: '300px' }}>
          <C.SearchClear ph={L('Person or action', 'الشخص أو الإجراء')} id="asearch" data-find="" />
        </div>{' '}
        <C.BGroup
          items={[
            L('All', 'الكل'),
            L('Approvals', 'الموافقات'),
            L('Sensitive access', 'وصول حسّاس'),
            L('Failures', 'الإخفاقات')
          ]}
          sel={kind}
          k="auditKind"
        />
      </div>{' '}
      <Table
        cols={[
          { label: L('When', 'الوقت'), cls: 'hide-sm', sort: true },
          { label: L('Who', 'من'), cls: 'hide-md' },
          { label: L('What', 'ماذا') },
          { label: L('Kind', 'النوع'), cls: 'shrink' }
        ]}
        rows={AUDIT.filter(a => !kind || a.kind === ONLY[kind]).map(a => ({
          attrs: 'data-find-item',
          cells: [
            <span className="mono dim" dir="ltr">
              {a.at}
            </span>,
            a.who && person(a.who) ? <Who p={person(a.who)} /> : a.actorName || '—',
            L(a.what, a.whatAr),
            <Pill label={KINDS[a.kind][0]} tone={KINDS[a.kind][1]} />
          ]
        }))}
        empty={
          <Empty
            glyph="shield"
            title={L('Nothing of this kind was recorded', 'لم يُسجَّل شيء من هذا النوع')}
            body={L('Choose All to see every event.', 'اختر «الكل» لرؤية كل الأحداث.')}
          />
        }
      />{' '}
      <div className="find-empty" hidden>
        <Empty
          glyph="search"
          title={L('No event matches', 'لا حدث يطابق')}
          body={L('Try a name, or part of the action.', 'جرّب اسماً أو جزءاً من الإجراء.')}
        />
      </div>{' '}
      <C.InlineAlert
        tone="info"
        title={L('Opening a restricted record is itself an event', 'فتح سجل مقيّد هو بحدّ ذاته حدث')}
        body={L(
          'Staff are told this when the permission is granted, not discovered afterwards.',
          'يُبلَّغ الموظّفون بذلك عند منح الصلاحية، لا يكتشفونه لاحقاً.'
        )}
      />
    </>
  );
}

audit.mount = host => {};
