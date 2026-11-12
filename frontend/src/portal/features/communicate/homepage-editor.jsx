/* Homepage editor (platform operators): the platform-wide wording of the public homepage, through the
   API's draft and publish routes (GET/PUT /api/administration/homepage/draft, POST .../publish,
   GET .../revisions). A draft never changes the live page; publishing sends the version that was saved,
   and the API refuses it until every chosen section has its text in English, French and Arabic.
   Main member: editHomepage. */
import { useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { openDrawer, toast } from '../../ui/ui.jsx';
import * as A from '../../model/modules/administration-api.js';

const LANGS = [
  ['en', 'English', 'ltr'],
  ['fr', 'Français', 'ltr'],
  ['ar', 'العربية', 'rtl']
];
const SECTIONS = [
  ['hero', 'Opening', 'الافتتاح'],
  ['announcement', 'Announcement', 'إعلان'],
  ['stories', 'Stories', 'قصص'],
  ['about', 'About ParishLife', 'عن ParishLife'],
  ['join', 'Join', 'الانضمام']
];
const SINGLE = ['hero', 'announcement', 'about', 'join'];
const blank = id => ({ id, texts: {}, linkUrl: '' });

/* One block: its text in each language, and an optional link. */
function Block({ block, onChange, linkLabel = true }) {
  const text = lang => block.texts?.[lang] || { title: '', body: '', linkLabel: '' };
  const set = (lang, field, value) =>
    onChange({ ...block, texts: { ...block.texts, [lang]: { ...text(lang), [field]: value } } });
  return (
    <>
      {LANGS.map(([lang, name, dir]) => (
        <div key={lang} className="home-lang" lang={lang} dir={dir}>
          <span className="label">{name}</span>
          <input
            className="input"
            maxLength="200"
            aria-label={`${t('Title', 'العنوان')}, ${name}`}
            placeholder={t('Title', 'العنوان')}
            value={text(lang).title}
            onChange={e => set(lang, 'title', e.target.value)}
          />
          <textarea
            className="textarea"
            rows="3"
            maxLength="5000"
            aria-label={`${t('Text', 'النص')}, ${name}`}
            placeholder={t('Text', 'النص')}
            value={text(lang).body}
            onChange={e => set(lang, 'body', e.target.value)}
          />
          {linkLabel ? (
            <input
              className="input"
              maxLength="80"
              aria-label={`${t('Link text', 'نص الرابط')}, ${name}`}
              placeholder={t('Link text (optional)', 'نص الرابط (اختياري)')}
              value={text(lang).linkLabel || ''}
              onChange={e => set(lang, 'linkLabel', e.target.value)}
            />
          ) : null}
        </div>
      ))}
      <label className="formrow">
        <span className="label">{t('Link (optional)', 'رابط (اختياري)')}</span>
        <input
          className="input"
          dir="ltr"
          maxLength="500"
          value={block.linkUrl || ''}
          onChange={e => onChange({ ...block, linkUrl: e.target.value })}
        />
        <span className="help">
          {t('An https address or a path on this site.', 'عنوان https أو مسار في هذا الموقع.')}
        </span>
      </label>
    </>
  );
}

/* The body is the draft as a controlled form; Save draft stores it, Publish stores then publishes it. */
function Editor({ initial }) {
  const [content, setContent] = useState(() => ({
    order: initial.value?.content.order || [],
    hero: initial.value?.content.hero || null,
    announcement: initial.value?.content.announcement || null,
    about: initial.value?.content.about || null,
    join: initial.value?.content.join || null,
    stories: initial.value?.content.stories || []
  }));
  const [version, setVersion] = useState(initial.version || null),
    [readiness, setReadiness] = useState(initial.value?.readiness || []),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const toggle = key =>
    setContent(c => {
      const on = c.order.includes(key);
      const order = SECTIONS.map(([k]) => k).filter(k => (k === key ? !on : c.order.includes(k)));
      return { ...c, order, ...(SINGLE.includes(key) && !on && !c[key] ? { [key]: blank(key) } : {}) };
    });
  const save = async () => {
    const draft = await A.saveHomepageDraft({ version, content });
    setVersion(draft.version);
    setReadiness(draft.value.readiness);
    return draft;
  };
  const run = (name, work) => async () => {
    setBusy(name);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e.message);
    }
    setBusy('');
  };
  const addStory = () => setContent(c => ({ ...c, stories: [...c.stories, blank(`story-${c.stories.length + 1}`)] }));
  return (
    <div className="home-editor">
      <p className="help">
        {t(
          'The public page every visitor sees first. Each parish’s details come from that parish; these fields set the wording around them. A draft does not change the live page.',
          'الصفحة العامة التي يراها كل زائر أولاً. تأتي معلومات كل رعية منها؛ وتحدّد هذه الحقول النص المحيط بها. المسوّدة لا تغيّر الصفحة المنشورة.'
        )}
      </p>
      <fieldset>
        <legend>{t('Sections shown', 'الأقسام الظاهرة')}</legend>
        {SECTIONS.map(([key, en, ar]) => (
          <label key={key} className="check">
            <input type="checkbox" checked={content.order.includes(key)} onChange={() => toggle(key)} />
            {t(en, ar)}
          </label>
        ))}
      </fieldset>
      {SINGLE.filter(k => content.order.includes(k)).map(key => (
        <fieldset key={key} data-home-block={key}>
          <legend>{t(...SECTIONS.find(([k]) => k === key).slice(1))}</legend>
          <Block
            block={content[key] || blank(key)}
            onChange={b => setContent(c => ({ ...c, [key]: b }))}
            linkLabel={key !== 'about'}
          />
        </fieldset>
      ))}
      {content.order.includes('stories') ? (
        <fieldset data-home-block="stories">
          <legend>{t('Stories', 'قصص')}</legend>
          {content.stories.map((story, i) => (
            <article key={i} className="home-story" data-story={i}>
              <header>
                <h4>
                  {t('Story', 'قصة')} {i + 1}
                </h4>
                <button
                  type="button"
                  className="btn btn-secondary btn-dense"
                  onClick={() => setContent(c => ({ ...c, stories: c.stories.filter((_, j) => j !== i) }))}
                >
                  {t('Remove', 'إزالة')}
                </button>
              </header>
              <label className="formrow">
                <span className="label">{t('Key', 'المفتاح')}</span>
                <input
                  className="input"
                  dir="ltr"
                  maxLength="40"
                  pattern="[a-z0-9-]+"
                  value={story.id}
                  onChange={e =>
                    setContent(c => ({
                      ...c,
                      stories: c.stories.map((s, j) => (j === i ? { ...s, id: e.target.value } : s))
                    }))
                  }
                />
                <span className="help">
                  {t(
                    'A short lowercase key such as spring-pilgrimage.',
                    'مفتاح قصير بأحرف صغيرة مثل spring-pilgrimage.'
                  )}
                </span>
              </label>
              <Block
                block={story}
                onChange={b => setContent(c => ({ ...c, stories: c.stories.map((s, j) => (j === i ? b : s)) }))}
              />
            </article>
          ))}
          <button type="button" className="btn btn-secondary" data-story-add="" onClick={addStory}>
            {t('Add a story', 'إضافة قصة')}
          </button>
        </fieldset>
      ) : null}
      <fieldset>
        <legend>{t('Ready to publish', 'جاهزة للنشر')}</legend>
        {readiness.length ? (
          <ul data-home-readiness="">
            {readiness.map(r => (
              <li key={r.language}>
                <b>{r.language.toUpperCase()}</b>{' '}
                {r.complete ? t('complete', 'مكتملة') : `${t('missing', 'ناقص')}: ${r.missing.join(', ')}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="help">{t('Save the draft to check each language.', 'احفظ المسوّدة للتحقق من كل لغة.')}</p>
        )}
        <label className="formrow">
          <span className="label">{t('Reason for publishing (optional)', 'سبب النشر (اختياري)')}</span>
          <input className="input" maxLength="500" value={reason} onChange={e => setReason(e.target.value)} />
        </label>
      </fieldset>
      <p className="help-error" role="alert">
        {error}
      </p>
      <div className="row" style={{ gap: '10px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          data-home-save=""
          disabled={!!busy}
          onClick={run('save', async () => {
            await save();
            toast(t('Draft saved', 'حُفظت المسوّدة'), '', 'success');
          })}
        >
          {t('Save draft', 'حفظ المسوّدة')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-home-publish=""
          disabled={!!busy}
          onClick={run('publish', async () => {
            const draft = await save();
            await A.publishHomepage({ version: draft.version, reason: reason || null });
            toast(t('Homepage published', 'نُشرت الصفحة الرئيسية'), '', 'success');
          })}
        >
          {t('Publish', 'نشر')}
        </button>
      </div>
    </div>
  );
}

export async function editHomepage() {
  let draft;
  try {
    /* no draft yet is a 404: start from an empty one */
    draft = await A.homepageDraft().catch(e => (e.status === 404 ? { value: null, version: null } : Promise.reject(e)));
  } catch (error) {
    toast(t('Could not open the homepage editor', 'تعذّر فتح محرّر الصفحة الرئيسية'), error.message, 'danger');
    return;
  }
  openDrawer({
    large: true,
    title: t('Homepage', 'الصفحة الرئيسية'),
    body: <Editor initial={draft} />,
    foot: (
      <a className="btn btn-secondary" href="public.html" target="_blank" rel="noopener">
        {t('View homepage', 'عرض الصفحة الرئيسية')}
      </a>
    )
  });
}
