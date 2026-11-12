/* Writing and publishing a notice (an announcement): the form for a draft, and publish and withdraw.
   Main functions: noticeForm, publishNotice, withdrawNotice.

   A notice is a draft until someone with permission publishes it. A public notice also needs the
   publishing permission, and a published notice is not edited in place: it is withdrawn with a reason. */
import { useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { Select } from '../../ui/components.jsx';
import { openDrawer, openModal, closeOverlays, toast } from '../../ui/ui.jsx';
import { session } from '../../model/api.js';
import { saveNotice, noticeAction } from '../../model/modules/communications.js';
import { confirmAction } from '../../shared/dialogs.jsx';
import { ok } from '../../shared/dialog-helpers.jsx';
import { LanguageSelect, useMinistries, useSubmit, reload } from './messaging-dialogs.jsx';

const L = (en, ar) => t(en, ar);

function NoticeForm({ notice }) {
  const ministries = useMinistries(session.parishId);
  const [visibility, setVisibility] = useState(notice?.visibility || 'Members');
  const { error, busy, submit } = useSubmit(async q => {
    if (visibility === 'Ministry' && !q.ministryId) throw new Error(L('Choose a ministry.', 'اختر الخدمة.'));
    await saveNotice(session.parishId, {
      id: notice?.id,
      version: notice?.version,
      visibility,
      ministryId: q.ministryId,
      title: q.title.trim(),
      body: q.body.trim(),
      category: (q.category || '').trim(),
      language: q.language,
      pinned: q.pinned === 'on',
      expiresAt: q.expiresAt ? new Date(q.expiresAt + 'T23:59:59').toISOString() : null
    });
    closeOverlays();
    await reload();
    ok(
      L('Draft saved', 'حُفظت المسودة'),
      L('It is not visible to anyone until it is published.', 'لا يراها أحد حتى تُنشر.')
    );
  });
  return (
    <form onSubmit={submit}>
      <label className="formrow">
        <span className="label">{L('Who can see it', 'من يراه')}</span>
        <Select value={visibility} onChange={e => setVisibility(e.target.value)}>
          <option value="Members">{L('Parish members', 'أعضاء الرعية')}</option>
          <option value="Ministry">{L('The members of a ministry', 'أعضاء خدمة')}</option>
          <option value="Public">{L('Anyone, on the public page', 'الجميع في الصفحة العامة')}</option>
        </Select>
      </label>
      {visibility === 'Ministry' ? (
        <label className="formrow">
          <span className="label">{L('Ministry', 'الخدمة')}</span>
          <Select name="ministryId" defaultValue={notice?.ministryId || ''} required>
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
      <label className="formrow">
        <span className="label">{L('Language', 'اللغة')}</span>
        <LanguageSelect defaultValue={notice?.language || 'en'} />
      </label>
      <label className="formrow">
        <span className="label">{L('Title', 'العنوان')}</span>
        <input className="input" name="title" required maxLength="300" defaultValue={notice?.title || ''} />
      </label>
      <label className="formrow">
        <span className="label">{L('Notice', 'الإعلان')}</span>
        <textarea
          className="textarea"
          name="body"
          required
          maxLength="20000"
          rows="8"
          defaultValue={notice?.body || ''}
        />
      </label>
      <label className="formrow">
        <span className="label">{L('Category (optional)', 'الفئة (اختياري)')}</span>
        <input className="input" name="category" maxLength="100" defaultValue={notice?.category || ''} />
      </label>
      <label className="formrow">
        <span className="label">{L('Stop showing after (optional)', 'إيقاف العرض بعد (اختياري)')}</span>
        <input
          className="input"
          name="expiresAt"
          type="date"
          defaultValue={notice?.expiresAt ? notice.expiresAt.slice(0, 10) : ''}
        />
      </label>
      <label className="check">
        <input type="checkbox" name="pinned" defaultChecked={!!notice?.pinned} />
        <span>{L('Pin it to the top', 'تثبيته في الأعلى')}</span>
      </label>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Save draft', 'حفظ المسودة')}
      </button>
    </form>
  );
}

export const noticeForm = (notice = null) =>
  openDrawer({
    title: notice ? L('Edit draft notice', 'تعديل مسودة الإعلان') : L('New notice', 'إعلان جديد'),
    body: <NoticeForm notice={notice} />
  });

export function publishNotice(n) {
  confirmAction({
    title: L('Publish this notice?', 'نشر هذا الإعلان؟'),
    body:
      n.visibility === 'Public'
        ? L(
            'Anyone can read it on the public parish page. It cannot be edited after it is published; it can be withdrawn.',
            'يستطيع الجميع قراءته في صفحة الرعية العامة. لا يُعدَّل بعد النشر؛ يمكن سحبه.'
          )
        : L(
            'The people it is meant for can read it in the app. It cannot be edited after it is published; it can be withdrawn.',
            'يستطيع المعنيون به قراءته في التطبيق. لا يُعدَّل بعد النشر؛ يمكن سحبه.'
          ),
    cta: L('Publish', 'نشر'),
    then: async () => {
      try {
        await noticeAction(session.parishId, n.id, n.version, 'publish');
        await reload();
        ok(L('Published', 'نُشر'), n.title);
      } catch (error) {
        toast(L('Not published', 'لم يُنشر'), error.message, 'danger');
      }
    }
  });
}

function WithdrawForm({ n }) {
  const { error, busy, submit } = useSubmit(async q => {
    await noticeAction(session.parishId, n.id, n.version, 'withdraw', q.reason.trim());
    closeOverlays();
    await reload();
    ok(L('Withdrawn', 'سُحب'), n.title);
  });
  return (
    <form onSubmit={submit}>
      <label className="formrow">
        <span className="label">{L('Reason', 'السبب')}</span>
        <textarea className="textarea" name="reason" required maxLength="2000" rows="3" />
      </label>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-danger" disabled={busy}>
        {L('Withdraw the notice', 'سحب الإعلان')}
      </button>
    </form>
  );
}
export const withdrawNotice = n =>
  openModal({ title: L('Withdraw this notice?', 'سحب هذا الإعلان؟'), body: <WithdrawForm n={n} /> });
