/* Homepage editor (Super Admin): the platform-wide wording of the public homepage.
   Parish details, Mass times, events and announcements come from each parish;
   this sets the opening lines, a seasonal announcement, stories and which sections show. */
import { useState } from 'react';
import { api } from '../model/api.js';
import { t } from '../../lib/i18n.js';
import { openDrawer, closeOverlays, toast } from '../ui/ui.jsx';
import { HOME_DEFAULTS, HOME_SECTIONS, HOME_IMAGES } from '../../lib/site-defaults.js';

const LANGS = [['en', 'English', 'ltr'], ['ar', 'العربية', 'rtl']];

function Pair({ name, label, value = {}, limit, rows = 0, placeholder = {} }) {
  return <div className="home-pair"><span className="label">{label}</span><div className="formgrid">{LANGS.map(([lang, title, dir]) => {
    const attrs = { className: rows ? 'textarea' : 'input', name: `${name}.${lang}`, lang, dir, maxLength: limit, placeholder: placeholder[lang] || '', 'aria-label': label + ', ' + title, defaultValue: value[lang] || '' };
    return <label key={lang} className="home-lang"><span>{title}</span>{rows ? <textarea {...attrs} rows={rows} /> : <input {...attrs} />}</label>;
  })}</div></div>;
}
const Shown = ({ name, checked, label = t('Show on the homepage', 'إظهار على الصفحة الرئيسية') }) =>
  <label className="check home-shown"><input type="checkbox" name={name} defaultChecked={!!checked} /><span>{label}</span></label>;
const Text = ({ name, label, value, help = '', list = '' }) =>
  <label className="formrow"><span className="label">{label}</span><input className="input" name={name} defaultValue={value || ''} dir="ltr" maxLength="2000" list={list || undefined} />{help ? <span className="help">{help}</span> : null}</label>;

/* Read every named field back into the content object the API expects. */
function collect(form) {
  const data = {};
  for (const el of form.querySelectorAll('[name]')) {
    const path = el.name.split('.');
    let at = data;
    path.slice(0, -1).forEach((key, i) => { at = at[key] ??= /^\d+$/.test(path[i + 1]) ? [] : {}; });
    at[path.at(-1)] = el.type === 'checkbox' ? el.checked : el.value;
  }
  data.stories = (data.stories || []).filter(Boolean);
  return data;
}

let storyKey = 0;
function Stories({ initial }) {
  const [stories, setStories] = useState(() => initial.map(s => ({ ...s, key: ++storyKey })));
  /* each story keeps its own fields while it moves; the names follow its new place */
  const move = (i, step) => setStories(list => { const next = [...list]; [next[i], next[i + step]] = [next[i + step], next[i]]; return next; });
  const add = e => {
    const list = e.currentTarget.parentElement.querySelector('[data-stories]');
    setStories(s => [...s, { title: { en: '', ar: '' }, body: { en: '', ar: '' }, image: '', link: '', published: false, key: ++storyKey }]);
    requestAnimationFrame(() => list.querySelector('[data-story]:last-child input[lang]')?.focus());
  };
  return <><div data-stories="">{stories.length ? stories.map((s, i) => <article key={s.key} className="home-story" data-story={i}>
    <header><h4>{t('Story', 'قصة')} {i + 1}</h4><div>
      <button type="button" className="btn btn-secondary btn-dense" data-story-move={`${i}:-1`} disabled={!i} aria-label={t('Move story earlier', 'نقل القصة إلى الأعلى')} onClick={() => move(i, -1)}>{t('Earlier', 'أعلى')}</button>
      <button type="button" className="btn btn-secondary btn-dense" data-story-move={`${i}:1`} disabled={i >= stories.length - 1} aria-label={t('Move story later', 'نقل القصة إلى الأسفل')} onClick={() => move(i, 1)}>{t('Later', 'أسفل')}</button>
      <button type="button" className="btn btn-secondary btn-dense" data-story-remove={i} onClick={() => setStories(list => list.filter(x => x !== s))}>{t('Remove', 'إزالة')}</button></div></header>
    <input type="hidden" name={`stories.${i}.id`} defaultValue={s.id || ''} />
    <Pair name={`stories.${i}.title`} label={t('Title', 'العنوان')} value={s.title} limit={120} />
    <Pair name={`stories.${i}.body`} label={t('Text', 'النص')} value={s.body} limit={600} rows={3} />
    <div className="formgrid"><Text name={`stories.${i}.image`} label={t('Image', 'الصورة')} value={s.image} help={t('A photograph shipped with the site, or an HTTPS image link.', 'صورة مرفقة بالموقع أو رابط صورة HTTPS.')} list="home-images" />
      <Text name={`stories.${i}.link`} label={t('Link (optional)', 'رابط (اختياري)')} value={s.link} help={t('An HTTPS address, a page such as public.html?parish=…, or a section such as #map.', 'عنوان HTTPS أو صفحة مثل public.html?parish=… أو قسم مثل ‎#map.')} /></div>
    <Shown name={`stories.${i}.published`} checked={s.published} label={t('Published', 'منشورة')} />
  </article>) : <p className="help">{t('No stories yet.', 'لا قصص بعد.')}</p>}</div>
    <button type="button" className="btn btn-secondary" data-story-add="" disabled={stories.length >= 8} onClick={add}>{t('Add a story', 'إضافة قصة')}</button></>;
}

export async function editHomepage() {
  let data;
  try { data = await api('workspace/site-content'); }
  catch (error) { toast(t('Could not open the homepage editor', 'تعذّر فتح محرّر الصفحة الرئيسية'), error.message, 'danger'); return; }
  const c = data.content, D = HOME_DEFAULTS;
  /* the form sits in the drawer's body and its button in the foot; they share the save */
  const shared = { setError: () => {}, setBusy: () => {} };
  function Editor() {
    const [error, setError] = useState('');
    shared.setError = setError;
    return <form className="home-editor" noValidate>
      <datalist id="home-images">{HOME_IMAGES.map(([src, en, ar]) => <option key={src} value={src}>{t(en, ar)}</option>)}</datalist>
      <fieldset><legend>{t('Opening', 'الافتتاح')}</legend>
        <Pair name="hero.title" label={t('Headline', 'العنوان الرئيسي')} value={c.hero.title} limit={140} placeholder={D.hero.title} />
        <Pair name="hero.subtitle" label={t('Introduction', 'المقدّمة')} value={c.hero.subtitle} limit={320} rows={3} placeholder={D.hero.subtitle} /></fieldset>
      <fieldset><legend>{t('Announcement', 'إعلان')}</legend>
        <p className="help">{t('A short line under the header for a feast, an appeal or a change that concerns every parish.', 'سطر قصير تحت الترويسة لعيد أو نداء أو تغيير يعني جميع الرعايا.')}</p>
        <Pair name="announcement.text" label={t('Announcement', 'الإعلان')} value={c.announcement.text} limit={280} rows={2} />
        <Pair name="announcement.linkLabel" label={t('Link text', 'نص الرابط')} value={c.announcement.linkLabel} limit={60} />
        <Text name="announcement.link" label={t('Link (optional)', 'رابط (اختياري)')} value={c.announcement.link} />
        <Shown name="announcement.published" checked={c.announcement.published} /></fieldset>
      <fieldset><legend>{t('Stories', 'قصص')}</legend>
        <p className="help">{t('Up to eight slides: a feast, a restored church, a parish milestone. Only published stories appear, in this order.', 'حتى ثماني شرائح: عيد، كنيسة رُمّمت، محطة في حياة رعية. تظهر القصص المنشورة فقط وبهذا الترتيب.')}</p>
        <Stories initial={c.stories} /></fieldset>
      <fieldset><legend>{t('About ParishLife', 'عن ParishLife')}</legend>
        <Pair name="about.title" label={t('Title', 'العنوان')} value={c.about.title} limit={140} placeholder={D.about.title} />
        <Pair name="about.body" label={t('Text', 'النص')} value={c.about.body} limit={2400} rows={5} placeholder={D.about.body} />
        <Shown name="about.published" checked={c.about.published} /></fieldset>
      <fieldset><legend>{t('Join', 'الانضمام')}</legend>
        <Pair name="join.title" label={t('Title', 'العنوان')} value={c.join.title} limit={140} placeholder={D.join.title} />
        <Pair name="join.body" label={t('Text', 'النص')} value={c.join.body} limit={600} rows={3} placeholder={D.join.body} />
        <Shown name="join.published" checked={c.join.published} /></fieldset>
      <fieldset><legend>{t('Sections', 'الأقسام')}</legend>
        <p className="help">{t('Sections with nothing published stay hidden on their own; turn one off here to hide it even when it has content.', 'تبقى الأقسام التي لا محتوى منشوراً فيها مخفية تلقائياً؛ أطفئ أي قسم هنا لإخفائه حتى لو كان فيه محتوى.')}</p>
        <div className="home-sections">{HOME_SECTIONS.map(([key, en, ar]) => <Shown key={key} name={`sections.${key}`} checked={c.sections[key] !== false} label={t(en, ar)} />)}</div></fieldset>
      <p className="help-error" role="alert">{error}</p>
    </form>;
  }
  function Save() {
    const [busy, setBusy] = useState(false);
    const save = async e => {
      const form = e.currentTarget.closest('.drawer').querySelector('form.home-editor');
      setBusy(true); shared.setError('');
      try {
        await api('workspace/site-content', 'PUT', { revision: data.revision, content: collect(form) });
        closeOverlays();
        toast(t('Homepage published', 'نُشرت الصفحة الرئيسية'), t('Visitors see the changes the next time the page loads.', 'يرى الزوّار التغييرات عند تحميل الصفحة مجدداً.'), 'success');
      } catch (error) { shared.setError(error.message); setBusy(false); }
    };
    return <button type="button" className="btn btn-primary" data-home-save="" style={{ marginInlineStart: 'auto' }} disabled={busy} onClick={save}>{t('Save and publish', 'حفظ ونشر')}</button>;
  }
  openDrawer({
    large: true,
    title: t('Homepage', 'الصفحة الرئيسية'),
    sub: t('The public page every visitor sees first. Each parish’s details, Mass times, events and announcements come from that parish; these fields set the wording around them. Leave a field empty to keep the built-in wording shown in grey.',
      'الصفحة العامة التي يراها كل زائر أولاً. تأتي معلومات كل رعية ومواعيد قداديسها وأحداثها وإعلاناتها من الرعية نفسها؛ وتحدّد هذه الحقول النص المحيط بها. اترك أي حقل فارغاً للإبقاء على النص الافتراضي الظاهر بالرمادي.'),
    body: <Editor />,
    foot: <><a className="btn btn-secondary" href="public.html" target="_blank" rel="noopener">{t('View homepage', 'عرض الصفحة الرئيسية')}</a><Save /></>
  });
}
