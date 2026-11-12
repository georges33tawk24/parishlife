/* Editing one section of the parish website, in English, French and Arabic, and moving it through review.
   Main functions: contentEdit (the editor), decidePrayer (a priest's decision on a prayer intention).

   A section is saved as a draft (the live text stays online), submitted for review once all three
   languages are written, and then a priest other than the author publishes or returns it. A live section is
   taken down with unpublish and a reason. The API keeps the live revision and the one being worked on, not
   a longer history. */
import { useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { toast, openDrawer, openModal, closeOverlays } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { session } from '../../model/api.js';
import {
  SECTIONS,
  LANGUAGES,
  saveWebsiteDraft,
  websiteAction,
  decideIntention
} from '../../model/modules/communications.js';
import { ok } from '../../shared/dialog-helpers.jsx';
import { LANGUAGE_NAMES, reload, useSubmit } from './messaging-dialogs.jsx';

const L = (en, ar) => t(en, ar);

export const SECTION_NAMES = {
  welcome: ['Welcome message', 'رسالة الترحيب'],
  history: ['Parish history and patron saint', 'تاريخ الرعية والشفيع'],
  massTimes: ['Mass and confession information', 'معلومات القداديس والاعتراف'],
  contact: ['Contact and visiting information', 'معلومات التواصل والزيارة'],
  sacraments: ['Sacraments and certificates', 'الأسرار والشهادات']
};

const isPriest = () => (session.user?.roles || []).includes('priest');

function SectionEditor({ portalKey, apiKey }) {
  const c = D.CONTENT[portalKey],
    pending = c?.pending,
    live = c?.live,
    waiting = pending?.status === 'AwaitingReview';
  const [message, setMessage] = useState('');
  const texts = c?.texts || {};

  const collect = form => {
    const out = {};
    for (const lang of LANGUAGES) {
      const title = (form.get(`title_${lang}`) || '').trim(),
        body = (form.get(`body_${lang}`) || '').trim();
      if (!title && !body) continue;
      if (!title || !body)
        throw new Error(
          L(
            `Give ${LANGUAGE_NAMES[lang][0]} both a title and text, or leave it empty.`,
            `أعطِ ${LANGUAGE_NAMES[lang][1]} عنواناً ونصاً معاً، أو اتركها فارغة.`
          )
        );
      out[lang] = { title, body };
    }
    if (!Object.keys(out).length) throw new Error(L('Write at least one language.', 'اكتب بلغة واحدة على الأقل.'));
    return out;
  };
  const draft = async form => saveWebsiteDraft(session.parishId, apiKey, collect(form), pending?.version);

  const { error, busy, submit } = useSubmit(async () => {
    const form = new FormData(document.getElementById('section-form'));
    const action = message;
    const reason = (form.get('reason') || '').trim();
    if (action === 'draft' || action === 'submit') {
      const section = await draft(form);
      if (action === 'submit') {
        const p = section.pending;
        await websiteAction(session.parishId, apiKey, p.id, p.version, 'submit');
      }
    } else if (action === 'publish')
      await websiteAction(session.parishId, apiKey, pending.id, pending.version, 'publish');
    else if (action === 'return') {
      if (!reason) throw new Error(L('Say why it is being returned.', 'اذكر سبب إعادته.'));
      await websiteAction(session.parishId, apiKey, pending.id, pending.version, 'return', reason);
    } else if (action === 'unpublish') {
      if (!reason) throw new Error(L('Say why it is being taken down.', 'اذكر سبب إزالته.'));
      await websiteAction(session.parishId, apiKey, live.id, live.version, 'unpublish', reason);
    }
    closeOverlays();
    await reload();
    ok(
      {
        draft: L('Draft saved', 'حُفظت المسودة'),
        submit: L('Submitted for review', 'أُرسل للمراجعة'),
        publish: L('Published', 'نُشر'),
        return: L('Returned for changes', 'أُعيد للتعديل'),
        unpublish: L('Taken down', 'أُزيل')
      }[action],
      L(...SECTION_NAMES[portalKey])
    );
  });

  return (
    <form id="section-form" onSubmit={submit}>
      {c?.status === 'Unpublished' && c.unpublishReason ? (
        <p className="help">
          {L('Taken down: ', 'أُزيل: ')}
          {c.unpublishReason}
        </p>
      ) : null}
      {pending?.status === 'Returned' ? (
        <p className="help-error">
          {L('Returned for changes: ', 'أُعيد للتعديل: ')}
          {pending.returnReason}
        </p>
      ) : null}
      {waiting ? (
        <p className="help">
          {L(
            'Waiting for a priest other than the author to publish it or send it back. It cannot be edited meanwhile.',
            'بانتظار كاهن غير كاتبه لينشره أو يعيده. لا يُعدَّل في هذه الأثناء.'
          )}
        </p>
      ) : null}
      {live ? (
        <p className="help">
          {L('Live now (published ', 'منشور الآن (نُشر ')}
          {live.publishedAt ? new Date(live.publishedAt).toLocaleDateString() : ''}
          {L('). Saving here changes a draft, not the live text.', '). الحفظ هنا يغيّر مسودة لا النص المنشور.')}
        </p>
      ) : null}
      {apiKey === 'sacraments' ? (
        <p className="help">
          {L(
            'This text introduces the request buttons on your public page. Mention anything families should know first.',
            'يقدّم هذا النص أزرار الطلبات في صفحتك العامة. اذكر ما يجب أن تعرفه العائلات أولاً.'
          )}
        </p>
      ) : null}
      {LANGUAGES.map(lang => (
        <fieldset key={lang} className="formrow" disabled={waiting} style={{ border: 0, padding: 0 }}>
          <span className="label">{L(...LANGUAGE_NAMES[lang])}</span>
          <input
            className="input"
            name={`title_${lang}`}
            maxLength="200"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            placeholder={L('Title', 'العنوان')}
            aria-label={`${L('Title', 'العنوان')} – ${L(...LANGUAGE_NAMES[lang])}`}
            defaultValue={texts[lang]?.title || ''}
          />
          <textarea
            className="input"
            name={`body_${lang}`}
            rows="5"
            maxLength="20000"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            placeholder={L('Text', 'النص')}
            aria-label={`${L('Text', 'النص')} – ${L(...LANGUAGE_NAMES[lang])}`}
            defaultValue={texts[lang]?.body || ''}
          />
        </fieldset>
      ))}
      <p className="help">
        {L(
          'All three languages are needed before it can be submitted for review.',
          'تلزم اللغات الثلاث قبل إرساله للمراجعة.'
        )}
      </p>
      {isPriest() && (waiting || live) ? (
        <label className="formrow">
          <span className="label">
            {L('Reason (needed to return or take down)', 'السبب (يلزم للإعادة أو الإزالة)')}
          </span>
          <input className="input" name="reason" maxLength="1000" />
        </label>
      ) : null}
      <p className="help-error" role="alert">
        {error}
      </p>
      <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
        {!waiting ? (
          <>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setMessage('draft')}>
              {L('Save draft', 'حفظ مسودة')}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => setMessage('submit')}>
              {L('Submit for review', 'إرسال للمراجعة')}
            </button>
          </>
        ) : null}
        {isPriest() && waiting ? (
          <>
            <button className="btn btn-primary" disabled={busy} onClick={() => setMessage('publish')}>
              {L('Publish', 'نشر')}
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setMessage('return')}>
              {L('Return for changes', 'إعادة للتعديل')}
            </button>
          </>
        ) : null}
        {isPriest() && live ? (
          <button className="btn btn-danger" disabled={busy} onClick={() => setMessage('unpublish')}>
            {L('Take the live text down', 'إزالة النص المنشور')}
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function contentEdit(key = 'history') {
  if (!SECTION_NAMES[key]) key = 'history';
  const apiKey = SECTIONS.find(s => s[0] === key)[1];
  openDrawer({
    large: true,
    title: L(...SECTION_NAMES[key]),
    sub: L(
      'Write in all three languages, submit it, and a priest other than the author publishes it.',
      'اكتب باللغات الثلاث وأرسله، فينشره كاهن غير كاتبه.'
    ),
    body: <SectionEditor portalKey={key} apiKey={apiKey} />
  });
}

/* What a priest may do with a prayer intention depends on how far the person allowed it to go. */
const CHOICES = {
  ClergyPrivate: ['keep-private', 'decline'],
  AnonymousPublic: ['publish-anonymous', 'keep-private', 'decline'],
  IdentifiedPublic: ['publish-identified', 'publish-anonymous', 'keep-private', 'decline']
};
const CHOICE_LABELS = {
  'publish-identified': ['Publish with their name', 'نشر مع اسمه'],
  'publish-anonymous': ['Publish without a name', 'نشر دون اسم'],
  'keep-private': ['Keep it between the priest and them', 'إبقاؤها بين الكاهن وصاحبها'],
  decline: ['Decline', 'رفض']
};

function Decision({ p }) {
  const { error, busy, submit } = useSubmit(async q => {
    await decideIntention(session.parishId, p.id, p.version, q.decision);
    closeOverlays();
    await reload();
    ok(L('Decision saved', 'حُفظ القرار'));
  });
  return (
    <form onSubmit={submit}>
      <p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>
        {p.body}
      </p>
      <label className="formrow">
        <span className="label">{L('Decision', 'القرار')}</span>
        <Select name="decision" required>
          {(CHOICES[p.requested] || CHOICES.ClergyPrivate).map(c => (
            <option key={c} value={c}>
              {L(...CHOICE_LABELS[c])}
            </option>
          ))}
        </Select>
      </label>
      <p className="help">
        {L('A public use never goes beyond what the person allowed.', 'لا يتجاوز النشر ما سمح به صاحب النية.')}
      </p>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Save decision', 'حفظ القرار')}
      </button>
    </form>
  );
}
export const decidePrayer = p => {
  if (!isPriest()) return toast(L('Only a priest decides', 'الكاهن وحده يقرّر'), '', 'warning');
  openModal({ title: L('Prayer intention', 'نيّة صلاة'), body: <Decision p={p} /> });
};
