/* Editing one section of the parish website. */
import { paint } from '../../ui/html.js';
import { t } from '../../../lib/i18n.js';
import { toast, openDrawer, closeOverlays } from '../../ui/ui.jsx';
import * as D from '../../model/data.js';
import { persist } from '../../model/persist.js';
import { ok, refresh, val } from '../../shared/dialog-helpers.jsx';

const L = (en, ar) => t(en, ar);

export function contentEdit(key = 'history') {
  const sections = {
    welcome: ['Welcome message', 'رسالة الترحيب'],
    history: ['Parish history and patron saint', 'تاريخ الرعية والشفيع'],
    massTimes: ['Mass and confession information', 'معلومات القداديس والاعتراف'],
    contact: ['Contact and visiting information', 'معلومات التواصل والزيارة'],
    sacraments: ['Sacraments and certificates', 'الأسرار والشهادات']
  };
  if (!sections[key]) key = 'history';
  const c = D.CONTENT[key] || { en: '', ar: '', published: false };
  openDrawer({
    large: true,
    title: L(...sections[key]),
    sub: L('Edit both languages, preview, then save a draft or publish.', 'حرّر اللغتين وعاين ثم احفظ مسودة أو انشر.'),
    body: (
      <>
        {key === 'sacraments' ? (
          <p className="help" style={{ margin: '0 0 16px' }}>
            {L(
              'This text introduces the request buttons on your public page: baptism, First Communion, confirmation, marriage, funeral and certificates. Mention anything families should know first, such as preparation sessions or documents. Without it, a short default introduction is shown.',
              'يقدّم هذا النص أزرار الطلبات في صفحتك العامة: المعمودية والمناولة الأولى والميرون والإكليل والجنّاز والشهادات. اذكر ما يجب أن تعرفه العائلات أولاً، مثل لقاءات التحضير أو المستندات. ومن دونه تظهر مقدّمة قصيرة افتراضية.'
            )}
          </p>
        ) : (
          ''
        )}
        <div className="formrow">
          <label className="label" htmlFor="ce-en">
            English
          </label>
          <textarea className="input" id="ce-en" rows="6" maxLength="10000" defaultValue={c.en || ''} />
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="ce-ar">
            العربية
          </label>
          <textarea className="input" id="ce-ar" rows="6" maxLength="10000" dir="rtl" defaultValue={c.ar || ''} />
        </div>{' '}
        <div className="panel" style={{ marginTop: '14px' }}>
          <div className="panel-b">
            <b>{L('Preview', 'معاينة')}</b>
            <div id="ce-preview" className="stack" style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }} />
          </div>
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-secondary" id="ce_draft">
          {L('Save draft', 'حفظ مسودة')}
        </button>{' '}
        <button className="btn btn-primary" id="ce_go" style={{ marginInlineStart: 'auto' }}>
          {L('Publish', 'نشر')}
        </button>
      </>
    ),
    onMount(el) {
      const preview = () => {
        paint(
          el.querySelector('#ce-preview'),
          <>
            <p>
              <b>English</b>
              <br />
              {el.querySelector('#ce-en').value || '—'}
            </p>
            <p dir="rtl">
              <b>العربية</b>
              <br />
              {el.querySelector('#ce-ar').value || '—'}
            </p>
          </>
        );
      };
      el.querySelectorAll('#ce-en,#ce-ar').forEach(field => field.addEventListener('input', preview));
      preview();
      const save = async published => {
        const en = val(el, '#ce-en'),
          ar = val(el, '#ce-ar');
        if (published && (!en || !ar))
          return toast(L('Enter both languages before publishing', 'أدخل اللغتين قبل النشر'), '', 'warning');
        const previous = D.CONTENT[key];
        D.CONTENT[key] = { en, ar, published };
        if (!(await persist())) {
          if (previous) D.CONTENT[key] = previous;
          else delete D.CONTENT[key];
          return;
        }
        closeOverlays();
        refresh();
        ok(
          published ? L('Published', 'نُشر') : L('Draft saved', 'حُفظت المسودة'),
          L('Parish content saved', 'حُفظ محتوى الرعية')
        );
      };
      el.querySelector('#ce_go').addEventListener('click', () => save(true));
      el.querySelector('#ce_draft').addEventListener('click', () => save(false));
    }
  });
}
