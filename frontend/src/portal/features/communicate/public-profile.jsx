/* The parish's public profile: the office's contact details, Mass times and what a visitor should
   know, published on the parish page. */
import { api } from '../../model/api.js';
import { t } from '../../../lib/i18n.js';
import { openDrawer, toast } from '../../ui/ui.jsx';
import { DrawerForm } from '../../ui/forms.jsx';

const FIELDS = [
  ['phone', 'Office phone', 'هاتف المكتب', 'tel'],
  ['email', 'Office email', 'بريد المكتب', 'email'],
  ['address', 'Parish address', 'عنوان الرعية', 'text'],
  ['website', 'Parish website (HTTPS)', 'موقع الرعية (HTTPS)', 'url'],
  ['officeHours', 'Office hours', 'ساعات المكتب', 'text'],
  ['confessionTimes', 'Confession times', 'مواعيد الاعتراف', 'text'],
  ['accessibility', 'Accessibility information', 'معلومات إمكانية الوصول', 'text'],
  ['latitude', 'Latitude (optional)', 'خط العرض (اختياري)', 'number'],
  ['longitude', 'Longitude (optional)', 'خط الطول (اختياري)', 'number'],
  ['feastName', 'Parish feast (for example: Feast of Saint Elias)', 'عيد الرعية (مثلاً: عيد مار الياس)', 'text'],
  ['feastDate', 'Feast day, month-day (for example: 07-20)', 'يوم العيد، الشهر-اليوم (مثلاً: 07-20)', 'text'],
  ['languages', 'Languages and rite of the Masses', 'لغات القداديس وطقسها', 'text'],
  ['parking', 'Parking', 'ركن السيارة', 'text'],
  ['livestream', 'Livestream link (HTTPS)', 'رابط البث المباشر (HTTPS)', 'url'],
  ['whatsapp', 'WhatsApp channel or group link', 'رابط قناة أو مجموعة واتساب', 'url']
];

const TEXTS = [
  ['massTimes', 'Mass times (English)', 'مواعيد القداديس (الإنكليزية)'],
  ['massTimesAr', 'Mass times (Arabic)', 'مواعيد القداديس (العربية)'],
  ['expect', 'What to expect on a first visit', 'ماذا يتوقّع الزائر في زيارته الأولى'],
  [
    'sacramentNotes',
    'What to bring for a baptism, a wedding or a certificate',
    'ما يجب إحضاره للمعمودية أو الإكليل أو الشهادة'
  ],
  ['gallery', 'Gallery · one HTTPS image URL per line (up to 12)', 'الصور · رابط HTTPS واحد في كل سطر (حتى ١٢)']
];

export async function editPublicProfile(parish, refresh) {
  try {
    const data = await api('workspace/public-profile?parish=' + encodeURIComponent(parish)),
      p = data.profile;
    const save = q =>
      api('workspace/public-profile', 'PUT', {
        ...q,
        parish,
        revision: data.revision,
        gallery: q.gallery
          .split(/\r?\n/)
          .map(x => x.trim())
          .filter(Boolean)
      });
    openDrawer({
      title: t('Public parish profile', 'صفحة الرعية العامة'),
      body: (
        <DrawerForm
          save={save}
          done={refresh}
          saved={t('Parish details published', 'نُشرت معلومات الرعية')}
          label={t('Publish parish details', 'نشر معلومات الرعية')}
        >
          <p className="help">
            {t(
              'These details are public. Use the parish office’s contact information, rather than personal clergy or ministry leader contacts.',
              'هذه المعلومات علنية. استخدم معلومات التواصل الخاصة بمكتب الرعية بدلاً من المعلومات الشخصية للكهنة والمسؤولين.'
            )}
          </p>
          <div className="formgrid">
            {FIELDS.map(([k, en, ar, type]) => (
              <label key={k} className="formrow">
                <span className="label">{t(en, ar)}</span>
                <input
                  className="input"
                  name={k}
                  type={type}
                  step={type === 'number' ? 'any' : undefined}
                  {...(k === 'feastDate' ? { pattern: '[0-1][0-9]-[0-3][0-9]', placeholder: '07-20', dir: 'ltr' } : {})}
                  defaultValue={p[k] ?? ''}
                  maxLength="2000"
                />
              </label>
            ))}
          </div>
          {TEXTS.map(([k, en, ar]) => (
            <label key={k} className="formrow">
              <span className="label">{t(en, ar)}</span>
              <textarea
                className="textarea"
                name={k}
                rows="4"
                maxLength={k === 'gallery' ? undefined : 2000}
                defaultValue={k === 'gallery' ? p.gallery.join('\n') : (p[k] ?? '')}
              />
            </label>
          ))}
          <p className="help">
            {t(
              'Leave the gallery empty to use the default photographs. Coordinates place the parish on the map of Lebanon on the ParishLife homepage and sort it for nearby visitors; without them it is shown at its town centre when the town is known.',
              'اترك الصور فارغة لاستخدام الصور الافتراضية. تضع الإحداثيات الرعية على خريطة لبنان في الصفحة الرئيسية لـ ParishLife وتساعد على ترتيبها للزوّار القريبين؛ ومن دونها تظهر في وسط بلدتها إذا كانت البلدة معروفة.'
            )}
          </p>
        </DrawerForm>
      )
    });
  } catch (error) {
    toast(t('Could not open parish details', 'تعذّر فتح معلومات الرعية'), error.message, 'danger');
  }
}
