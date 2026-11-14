/* The record of what happened in this parish, read from ParishLife.Api (model/modules/administration.js).
   With audit.read it is the parish's general audit trail: every recorded action, who did it (by name when
   the account-names lookup reveals it) and when, without free-text reasons. Without it, only the parish's
   operating-status changes and the history of its open workflow runs. Finance and private-case records are
   not part of this trail. Main member: audit. */
import { t } from '../../../lib/i18n.js';
import { S } from '../../model/store.js';
import { PageHead, Pill, Table, Empty } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { AUDIT } from '../../model/data.js';
import { auditTime } from '../../shared/audit-words.js';

const L = (en, ar) => t(en, ar);

export function audit() {
  const KINDS = {
    approve: [L('Approval', 'موافقة'), 'success'],
    create: [L('Created', 'إنشاء'), 'info'],
    settings: [L('Change', 'تغيير'), 'info'],
    error: [L('Declined or cancelled', 'رفض أو إلغاء'), 'danger']
  };
  const ONLY = [null, 'approve', 'error'],
    kind = S.ui.auditKind || 0;
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Audit trail', 'سجل التدقيق') }]}
        title={L('Audit trail', 'سجل التدقيق')}
        sub={L(
          'Recorded changes to this parish. Records cannot be edited.',
          'التغييرات المسجّلة في هذه الرعية. لا يمكن تعديل السجلات.'
        )}
      />
      <C.InlineAlert
        tone="info"
        title={L('Read only', 'للقراءة فقط')}
        body={L(
          'Accounts with the audit permission see every recorded action in this parish; others see status changes and workflow activity only. Reasons, finance and private cases are not shown here.',
          'يرى أصحاب صلاحية التدقيق كل إجراء مسجّل في هذه الرعية؛ ويرى الآخرون تغييرات الحالة ونشاط مسارات العمل فقط. الأسباب والمالية والحالات الخاصة لا تظهر هنا.'
        )}
      />{' '}
      <div className="toolbar">
        <div className="grow" style={{ maxWidth: '300px' }}>
          <C.SearchClear ph={L('Action', 'الإجراء')} id="asearch" data-find="" />
        </div>{' '}
        <C.BGroup
          items={[L('All', 'الكل'), L('Approvals', 'الموافقات'), L('Declined or cancelled', 'رفض أو إلغاء')]}
          sel={kind}
          k="auditKind"
        />
      </div>{' '}
      <Table
        cols={[
          { label: L('When', 'الوقت'), cls: 'hide-sm', sort: true },
          { label: L('Who', 'من') },
          { label: L('What', 'ماذا') },
          { label: L('Kind', 'النوع'), cls: 'shrink' }
        ]}
        rows={AUDIT.filter(a => !kind || a.kind === ONLY[kind]).map(a => ({
          attrs: 'data-find-item',
          cells: [
            <span className="mono dim" dir="ltr">
              {auditTime(a.at)}
            </span>,
            a.actorName || '—',
            a.what,
            <Pill label={KINDS[a.kind][0]} tone={KINDS[a.kind][1]} />
          ]
        }))}
        empty={<Empty glyph="shield" title={L('Nothing recorded yet', 'لم يُسجَّل شيء بعد')} />}
      />
    </>
  );
}

audit.mount = () => {};
