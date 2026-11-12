/* The record of what happened in this parish, as far as ParishLife.Api lets it be read: the parish's
   operating-status changes and the history of its open workflow runs (model/modules/administration.js).
   The API has no general audit trail to read yet, so file opens, approvals and exports are not listed.
   Main member: audit. */
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
        title={L('Only part of the trail can be read yet', 'يمكن قراءة جزء من السجل فقط حالياً')}
        body={L(
          'ParishLife records more than this, but the API only lets the parish read its operating-status changes and workflow activity. Opened files, approvals elsewhere and exports are not listed.',
          'تسجّل «حياة الرعية» أكثر من ذلك، لكن الواجهة لا تتيح للرعية إلا قراءة تغييرات حالتها التشغيلية ونشاط مسارات العمل. الملفات المفتوحة والموافقات الأخرى والتصديرات غير مدرجة.'
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
          { label: L('What', 'ماذا') },
          { label: L('Kind', 'النوع'), cls: 'shrink' }
        ]}
        rows={AUDIT.filter(a => !kind || a.kind === ONLY[kind]).map(a => ({
          attrs: 'data-find-item',
          cells: [
            <span className="mono dim" dir="ltr">
              {auditTime(a.at)}
            </span>,
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
