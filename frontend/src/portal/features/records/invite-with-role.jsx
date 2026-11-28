/* Purpose: one step to invite a person to complete their account and, for the parish's controller, give them a role at the same time
   (owner decision, 23 November 2026). The person opens the private link, signs up or signs in with their own password, and the role
   applies when they accept. Priests and ministry leaders are appointed elsewhere (the bishop; the priest).
   Main members: ROLE_PRESETS, inviteWithRole (opens the form, then shows the link), unlinkAccount (the office undoes a wrong link). */
import { useRef, useState } from 'react';
import { openDrawer, openModal, toast } from '../../ui/ui.jsx';
import { bus } from '../../model/store.js';
import { DrawerForm } from '../../ui/forms.jsx';
import { t } from '../../../lib/i18n.js';
import { api, loadSession, session, newOperationId } from '../../model/api.js';
import { PermissionPicker } from '../administration/permission-picker.jsx';

export const ROLE_PRESETS = {
  none: [],
  secretary: [
    'people.read',
    'people.write',
    'requests.manage',
    'sacraments.record',
    'documents.release',
    'schedule.read',
    'schedule.manage',
    'registrations.manage',
    'registrations.checkin',
    'communications.manage',
    'facilities.manage'
  ],
  treasurer: ['finance.read', 'finance.enter', 'finance.approve', 'finance.post', 'people.read', 'reports.read']
};

const showLink = (p, result) => {
  const link = new URL('index.html', location.href);
  link.hash = 'invite=' + new URLSearchParams({ p: session.parishId, i: result.id, t: result.token });
  openModal({
    title: t('Account invitation', 'دعوة الحساب'),
    body: (
      <>
        <p>{p.lat}</p>
        <p>
          {t(
            'Send this private link to the person (WhatsApp or email). They open it, sign up or sign in with their own password, and are linked to this record. The link expires after seven days.',
            'أرسل هذا الرابط الخاص إلى الشخص (واتساب أو بريد). يفتحه ويسجّل أو يدخل بكلمة مروره الخاصة فيُربط بهذا السجل. تنتهي الدعوة بعد سبعة أيام.'
          )}
        </p>
        {result.roleAllows?.length ? (
          <p className="help">
            {t(
              'Their role applies when they accept. Staff must also turn on the authenticator in My account.',
              'يُطبَّق دوره عند القبول. على الموظفين أيضاً تفعيل المصادِق في حسابي.'
            )}
          </p>
        ) : null}
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
};

function InviteForm({ p }) {
  const [kind, setKind] = useState('none');
  const issued = useRef(null);
  return (
    <DrawerForm
      label={t('Create the link', 'إنشاء الرابط')}
      save={async (v, form) => {
        const allows = kind === 'custom' ? new FormData(form).getAll('allow') : ROLE_PRESETS[kind];
        if (kind === 'custom' && !allows.length)
          throw new Error(t('Tick at least one permission.', 'اختر صلاحية واحدة على الأقل.'));
        issued.current = await api(
          `parishes/${encodeURIComponent(session.parishId)}/people/${encodeURIComponent(p.id)}/invitations`,
          'POST',
          { operationId: newOperationId(), allows }
        );
      }}
      // DrawerForm closes the drawer after saving; then the link is shown.
      done={() => showLink(p, issued.current)}
    >
      <label className="formrow">
        <span className="label">{t('Role in the parish', 'الدور في الرعية')}</span>
        <select className="select" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="none">{t('Parishioner (no office access)', 'من أبناء الرعية (بلا صلاحيات مكتب)')}</option>
          <option value="secretary">{t('Secretary', 'أمين السرّ')}</option>
          <option value="treasurer">{t('Treasurer', 'أمين الصندوق')}</option>
          <option value="custom">{t('Choose permissions…', 'اختيار الصلاحيات…')}</option>
        </select>
        <span className="help">
          {t(
            'Priests are appointed by the bishop, and ministry leaders by the priest.',
            'يعيّن المطران الكهنة، ويعيّن الكاهن قادة الأخويات.'
          )}
        </span>
      </label>
      {kind === 'custom' ? <PermissionPicker /> : null}
    </DrawerForm>
  );
}

export function inviteWithRole(p) {
  openDrawer({ title: t('Invite to complete account', 'دعوة لإكمال الحساب'), sub: p.lat, body: <InviteForm p={p} /> });
}

/* The office undoes a person record's link to a sign-in account (for example one accepted by the wrong account). The record and the
   account both stay; a new invitation can then be sent to the right person. */
export function unlinkAccount(p) {
  openDrawer({
    title: t('Unlink account', 'فكّ ربط الحساب'),
    sub: p.lat,
    body: (
      <DrawerForm
        label={t('Unlink', 'فكّ الربط')}
        saved={t('Account unlinked', 'فُكّ ربط الحساب')}
        save={v =>
          api(
            `parishes/${encodeURIComponent(session.parishId)}/people/${encodeURIComponent(p.id)}/account-link/remove`,
            'POST',
            { operationId: newOperationId(), reason: v.reason }
          )
        }
        // The record is no longer linked; the account's own name returns at the top right without signing out.
        done={async () => {
          await loadSession().catch(() => {});
          bus.refresh();
        }}
      >
        <p className="help">
          {t(
            'The sign-in account is no longer linked to this record. Nothing is deleted. Send a new invitation to the right person afterwards.',
            'لا يعود حساب الدخول مرتبطاً بهذا السجل. لا يُحذف شيء. أرسل بعدها دعوة جديدة إلى الشخص الصحيح.'
          )}
        </p>
        <label className="formrow">
          <span className="label">{t('Reason', 'السبب')}</span>
          <textarea className="textarea" name="reason" required maxLength="500" />
        </label>
      </DrawerForm>
    )
  });
}
