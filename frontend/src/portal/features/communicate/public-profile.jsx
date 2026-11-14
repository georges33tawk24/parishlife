/* The parish's public profile, from ParishLife.Api: the office's contact details, the Arabic name and
   locality, rite, Mass/confession/office times, what a visitor should know, the feast, and the
   livestream and WhatsApp links, plus the parish's photographs. Editors (publishing.manage with MFA)
   save a draft; nothing is public until they press Publish, and Unpublish takes it down again.
   Photos are uploaded privately and each one is published on its own.
   Routes: GET/PUT /api/parishes/{id}/profile, POST .../profile/actions {publish|unpublish},
   POST .../profile/photos (multipart), POST .../profile/photos/{photoId}/actions, GET
   .../profile/photos/{photoId} (private preview).
   Main members: editPublicProfile (the draft drawer), PublicProfilePanel (status, publish, photos),
   loadProfile, toContent, saveProfile, actOnProfile, uploadPhoto, actOnPhoto (the API calls). */
import { useState } from 'react';
import { api, newOperationId } from '../../model/api.js';
import { t } from '../../../lib/i18n.js';
import { openDrawer, toast, Panel, Pill } from '../../ui/ui.jsx';
import { DrawerForm } from '../../ui/forms.jsx';
import { useLoad } from '../administration/use-load.js';

/* [field, English label, Arabic label, input type, maximum length] */
const FIELDS = [
  ['nameAr', 'Parish name in Arabic', 'اسم الرعية بالعربية', 'text', 500],
  ['localityAr', 'Locality in Arabic', 'البلدة بالعربية', 'text', 500],
  ['rite', 'Rite (English)', 'الطقس (بالإنكليزية)', 'text', 120],
  ['riteAr', 'Rite (Arabic)', 'الطقس (بالعربية)', 'text', 120],
  ['phone', 'Office phone', 'هاتف المكتب', 'tel', 40],
  ['email', 'Office email', 'بريد المكتب', 'email', 254],
  ['website', 'Parish website (HTTPS)', 'موقع الرعية (HTTPS)', 'url', 500],
  ['feastName', 'Parish feast (English)', 'عيد الرعية (بالإنكليزية)', 'text', 200],
  ['feastNameAr', 'Parish feast (Arabic)', 'عيد الرعية (بالعربية)', 'text', 200],
  ['feastDate', 'Feast day, month-day (for example: 07-20)', 'يوم العيد، الشهر-اليوم (مثلاً: 07-20)', 'text', 5],
  ['livestreamUrl', 'Livestream link (HTTPS)', 'رابط البث المباشر (HTTPS)', 'url', 500],
  ['whatsAppUrl', 'WhatsApp channel or group link', 'رابط قناة أو مجموعة واتساب', 'url', 500]
];

/* Texts with an Arabic twin: [field, English label, Arabic label, maximum length] */
const TEXTS = [
  ['address', 'Parish address', 'عنوان الرعية', 500],
  ['massTimes', 'Mass times', 'مواعيد القداديس', 2000],
  ['confessionTimes', 'Confession times', 'مواعيد الاعتراف', 2000],
  ['officeHours', 'Office hours', 'ساعات المكتب', 2000],
  ['languages', 'Languages and rite of the Masses', 'لغات القداديس وطقسها', 2000],
  ['expect', 'What to expect on a first visit', 'ماذا يتوقّع الزائر في زيارته الأولى', 2000],
  ['sacramentNotes', 'What to bring for a sacrament or a certificate', 'ما يجب إحضاره لسرّ أو شهادة', 2000],
  ['parking', 'Parking', 'ركن السيارة', 2000],
  ['accessibility', 'Accessibility information', 'معلومات إمكانية الوصول', 2000]
];

const ALL = [...FIELDS.map(f => f[0]), ...TEXTS.flatMap(([k]) => [k, k + 'Ar'])];
const base = parish => 'parishes/' + encodeURIComponent(parish) + '/profile';

export const loadProfile = parish => api(base(parish));

/* The form's values → ParishProfileContentDto. Each field is saved exactly as typed (empty means
   none); an Arabic field is never filled from the English one. */
export const toContent = (q, showClergy) => ({
  ...Object.fromEntries(ALL.map(k => [k, String(q[k] ?? '').trim() || null])),
  showClergy: !!showClergy
});

export const saveProfile = (parish, version, content) =>
  api(base(parish), 'PUT', { operationId: newOperationId(), version: version || null, profile: content });

export const actOnProfile = (parish, version, action) =>
  api(base(parish) + '/actions', 'POST', { operationId: newOperationId(), version, action });

export const actOnPhoto = (parish, photo, action) =>
  api(base(parish) + '/photos/' + encodeURIComponent(photo.id) + '/actions', 'POST', {
    operationId: newOperationId(),
    version: photo.version,
    action
  });

/* Multipart, so it bypasses the JSON client but keeps its anti-forgery token. */
export async function uploadPhoto(parish, file) {
  const { token } = await api('auth/csrf');
  const form = new FormData();
  form.append('operationId', newOperationId());
  form.append('file', file);
  const response = await fetch('/api/' + base(parish) + '/photos', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-CSRF-TOKEN': token },
    body: form
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || t('The photo could not be uploaded.', 'تعذّر رفع الصورة.'));
  return data;
}

export async function editPublicProfile(parish, refresh) {
  try {
    const { version, value } = await loadProfile(parish),
      p = value.draft || {};
    openDrawer({
      title: t('Public parish profile', 'صفحة الرعية العامة'),
      body: (
        <DrawerForm
          save={q => saveProfile(parish, version, toContent(q, q.showClergy === 'on'))}
          done={refresh}
          saved={t(
            'Draft saved. Publish it to show it on the parish page.',
            'حُفظت المسودة. انشرها لتظهر على صفحة الرعية.'
          )}
          label={t('Save draft', 'حفظ المسودة')}
        >
          <p className="help">
            {t(
              'Once published, these details are public. Use the parish office’s contact information, not personal clergy or ministry leader contacts. Fill in each language yourself; nothing is translated.',
              'بعد النشر تصبح هذه المعلومات علنية. استخدم معلومات التواصل الخاصة بمكتب الرعية لا المعلومات الشخصية للكهنة والمسؤولين. املأ كل لغة بنفسك؛ لا يُترجم شيء.'
            )}
          </p>
          <div className="formgrid">
            {FIELDS.map(([k, en, ar, type, max]) => (
              <label key={k} className="formrow">
                <span className="label">{t(en, ar)}</span>
                <input
                  className="input"
                  name={k}
                  type={type}
                  {...(k === 'feastDate' ? { pattern: '[0-1][0-9]-[0-3][0-9]', placeholder: '07-20' } : {})}
                  dir={k.endsWith('Ar') ? 'rtl' : type === 'text' ? undefined : 'ltr'}
                  defaultValue={p[k] ?? ''}
                  maxLength={max}
                />
              </label>
            ))}
          </div>
          {TEXTS.map(([k, en, ar, max]) => (
            <div key={k} className="formgrid">
              <label className="formrow">
                <span className="label">{t(en + ' (English)', ar + ' (بالإنكليزية)')}</span>
                <textarea className="textarea" name={k} rows="3" maxLength={max} defaultValue={p[k] ?? ''} />
              </label>
              <label className="formrow">
                <span className="label">{t(en + ' (Arabic)', ar + ' (بالعربية)')}</span>
                <textarea
                  className="textarea"
                  name={k + 'Ar'}
                  rows="3"
                  dir="rtl"
                  maxLength={max}
                  defaultValue={p[k + 'Ar'] ?? ''}
                />
              </label>
            </div>
          ))}
          <label className="formrow">
            <span>
              <input type="checkbox" name="showClergy" defaultChecked={!!p.showClergy} />{' '}
              {t(
                'List our clergy on the parish page (names come from current priest appointments)',
                'اعرض كهنة الرعية على صفحتها (الأسماء من تعيينات الكهنة الحالية)'
              )}
            </span>
          </label>
          <p className="help">
            {t(
              'Map coordinates are recorded separately (Location); photos are managed in the profile panel.',
              'تُسجَّل إحداثيات الخريطة على حدة (الموقع)؛ وتُدار الصور في لوحة الملف.'
            )}
          </p>
        </DrawerForm>
      )
    });
  } catch (error) {
    toast(t('Could not open parish details', 'تعذّر فتح معلومات الرعية'), error.message, 'danger');
  }
}

const STATUS = {
  NotPublished: ['Not published', 'غير منشورة', ''],
  Published: ['Published', 'منشورة', 'success'],
  PublishedWithChanges: ['Published · the draft has changes', 'منشورة · في المسودة تعديلات', 'warning']
};
const PHOTO = { Private: ['Private', 'خاصة', ''], Published: ['Published', 'منشورة', 'success'] };

/* The settings screen's panel: status, Edit, Publish/Unpublish and the photographs. A refusal from the
   API (no publishing.manage, no MFA, module off) shows as a note rather than breaking the page. */
export function PublicProfilePanel({ parish }) {
  const [busy, setBusy] = useState(false);
  const { data, error, reload } = useLoad(() => loadProfile(parish), [parish]);
  const run = async (work, done) => {
    setBusy(true);
    try {
      await work();
      if (done) toast(done, '', 'success');
      await reload();
    } catch (e) {
      toast(t('Not saved', 'لم يُحفظ'), e.message, 'danger');
    } finally {
      setBusy(false);
    }
  };
  if (error)
    return (
      <Panel title={t('Public profile', 'الملف العام')}>
        <p className="help">{error}</p>
      </Panel>
    );
  if (!data) return null;
  const v = data.value,
    [en, ar, tone] = STATUS[v.status] || STATUS.NotPublished,
    photos = (v.photos || []).filter(x => x.status !== 'Removed');
  return (
    <Panel title={t('Public profile', 'الملف العام')}>
      <p>
        <Pill label={t(en, ar)} tone={tone} />
      </p>
      <div className="toolbar">
        <button type="button" className="btn" disabled={busy} onClick={() => editPublicProfile(parish, reload)}>
          {t('Edit draft', 'تعديل المسودة')}
        </button>
        {data.version && v.status !== 'Published' ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              run(
                () => actOnProfile(parish, data.version, 'publish'),
                t('Parish details published', 'نُشرت معلومات الرعية')
              )
            }
          >
            {t('Publish', 'نشر')}
          </button>
        ) : null}
        {v.status !== 'NotPublished' ? (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() =>
              run(
                () => actOnProfile(parish, data.version, 'unpublish'),
                t('Taken off the parish page', 'أُزيلت من صفحة الرعية')
              )
            }
          >
            {t('Unpublish', 'إلغاء النشر')}
          </button>
        ) : null}
      </div>
      <h3>{t('Photographs', 'الصور')}</h3>
      <p className="help">
        {t(
          'Uploads stay private until you publish each one (JPEG, PNG or WebP, up to 5 MB, 12 photos).',
          'تبقى الصور المرفوعة خاصة إلى أن تنشر كلاً منها (JPEG أو PNG أو WebP، حتى ٥ ميغابايت، ١٢ صورة).'
        )}
      </p>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        aria-label={t('Upload a photo', 'رفع صورة')}
        onChange={e => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) run(() => uploadPhoto(parish, file), t('Photo uploaded (private)', 'رُفعت الصورة (خاصة)'));
        }}
      />
      {photos.map(photo => {
        const [pen, par, ptone] = PHOTO[photo.status] || PHOTO.Private;
        return (
          <div key={photo.id} className="listrow" style={{ paddingInline: 0 }}>
            <img
              src={'/api/' + base(parish) + '/photos/' + encodeURIComponent(photo.id)}
              alt=""
              width="64"
              height="48"
              loading="lazy"
              style={{ objectFit: 'cover' }}
            />
            <span className="grow">{photo.caption || photo.captionAr || ''}</span>
            <Pill label={t(pen, par)} tone={ptone} />
            <button
              type="button"
              className="btn btn-small"
              disabled={busy}
              onClick={() =>
                run(() => actOnPhoto(parish, photo, photo.status === 'Published' ? 'unpublish' : 'publish'))
              }
            >
              {photo.status === 'Published' ? t('Unpublish', 'إلغاء النشر') : t('Publish', 'نشر')}
            </button>
            <button
              type="button"
              className="btn btn-small"
              disabled={busy}
              onClick={() => run(() => actOnPhoto(parish, photo, 'remove'), t('Photo removed', 'أُزيلت الصورة'))}
            >
              {t('Remove', 'إزالة')}
            </button>
          </div>
        );
      })}
    </Panel>
  );
}
