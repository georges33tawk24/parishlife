/* Homepage editor (Super Admin): the platform-wide wording of the public homepage.
   Parish details, Mass times, events and announcements come from each parish;
   this sets the opening lines, a seasonal announcement, stories and which sections show. */
import { api } from '../api.js';
import { t } from '../i18n.js';
import { esc, openDrawer, closeOverlays, toast } from '../ui.js';
import { HOME_DEFAULTS, HOME_SECTIONS, HOME_IMAGES } from '../site-defaults.js';

const LANGS = [['en', 'English', 'ltr'], ['ar', 'العربية', 'rtl']];

function pair(name, label, value = {}, limit, rows = 0, placeholder = {}) {
  return `<div class="home-pair"><span class="label">${label}</span><div class="formgrid">${LANGS.map(([lang, title, dir]) => {
    const attrs = `class="${rows ? 'textarea' : 'input'}" name="${name}.${lang}" lang="${lang}" dir="${dir}" maxlength="${limit}" placeholder="${esc(placeholder[lang] || '')}" aria-label="${esc(label + ', ' + title)}"`;
    return `<label class="home-lang"><span>${title}</span>${rows ? `<textarea ${attrs} rows="${rows}">${esc(value[lang] || '')}</textarea>` : `<input ${attrs} value="${esc(value[lang] || '')}">`}</label>`;
  }).join('')}</div></div>`;
}
const shown = (name, checked, label = t('Show on the homepage', 'إظهار على الصفحة الرئيسية')) =>
  `<label class="check home-shown"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
const text = (name, label, value, help = '', list = '') =>
  `<label class="formrow"><span class="label">${label}</span><input class="input" name="${name}" value="${esc(value || '')}" dir="ltr" maxlength="2000" ${list ? `list="${list}"` : ''}>${help ? `<span class="help">${help}</span>` : ''}</label>`;

function story(s, i, count) {
  return `<article class="home-story" data-story="${i}">
    <header><h4>${t('Story', 'قصة')} ${i + 1}</h4><div>
      <button type="button" class="btn btn-secondary btn-dense" data-story-move="${i}:-1" ${i ? '' : 'disabled'} aria-label="${t('Move story earlier', 'نقل القصة إلى الأعلى')}">${t('Earlier', 'أعلى')}</button>
      <button type="button" class="btn btn-secondary btn-dense" data-story-move="${i}:1" ${i < count - 1 ? '' : 'disabled'} aria-label="${t('Move story later', 'نقل القصة إلى الأسفل')}">${t('Later', 'أسفل')}</button>
      <button type="button" class="btn btn-secondary btn-dense" data-story-remove="${i}">${t('Remove', 'إزالة')}</button></div></header>
    <input type="hidden" name="stories.${i}.id" value="${esc(s.id || '')}">
    ${pair(`stories.${i}.title`, t('Title', 'العنوان'), s.title, 120)}
    ${pair(`stories.${i}.body`, t('Text', 'النص'), s.body, 600, 3)}
    <div class="formgrid">${text(`stories.${i}.image`, t('Image', 'الصورة'), s.image, t('A photograph shipped with the site, or an HTTPS image link.', 'صورة مرفقة بالموقع أو رابط صورة HTTPS.'), 'home-images')}
    ${text(`stories.${i}.link`, t('Link (optional)', 'رابط (اختياري)'), s.link, t('An HTTPS address, a page such as public.html?parish=…, or a section such as #map.', 'عنوان HTTPS أو صفحة مثل public.html?parish=… أو قسم مثل ‎#map.'))}</div>
    ${shown(`stories.${i}.published`, s.published, t('Published', 'منشورة'))}
  </article>`;
}

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

export async function editHomepage() {
  let data;
  try { data = await api('workspace/site-content'); }
  catch (error) { toast(t('Could not open the homepage editor', 'تعذّر فتح محرّر الصفحة الرئيسية'), error.message, 'danger'); return; }
  const c = data.content, D = HOME_DEFAULTS;
  let stories = c.stories.map(s => ({...s}));
  openDrawer({
    large: true,
    title: t('Homepage', 'الصفحة الرئيسية'),
    sub: t('The public page every visitor sees first. Each parish’s details, Mass times, events and announcements come from that parish; these fields set the wording around them. Leave a field empty to keep the built-in wording shown in grey.',
           'الصفحة العامة التي يراها كل زائر أولاً. تأتي معلومات كل رعية ومواعيد قداديسها وأحداثها وإعلاناتها من الرعية نفسها؛ وتحدّد هذه الحقول النص المحيط بها. اترك أي حقل فارغاً للإبقاء على النص الافتراضي الظاهر بالرمادي.'),
    body: `<form class="home-editor" novalidate>
      <datalist id="home-images">${HOME_IMAGES.map(([src, en, ar]) => `<option value="${esc(src)}">${esc(t(en, ar))}</option>`).join('')}</datalist>
      <fieldset><legend>${t('Opening', 'الافتتاح')}</legend>
        ${pair('hero.title', t('Headline', 'العنوان الرئيسي'), c.hero.title, 140, 0, D.hero.title)}
        ${pair('hero.subtitle', t('Introduction', 'المقدّمة'), c.hero.subtitle, 320, 3, D.hero.subtitle)}</fieldset>
      <fieldset><legend>${t('Announcement', 'إعلان')}</legend>
        <p class="help">${t('A short line under the header for a feast, an appeal or a change that concerns every parish.', 'سطر قصير تحت الترويسة لعيد أو نداء أو تغيير يعني جميع الرعايا.')}</p>
        ${pair('announcement.text', t('Announcement', 'الإعلان'), c.announcement.text, 280, 2)}
        ${pair('announcement.linkLabel', t('Link text', 'نص الرابط'), c.announcement.linkLabel, 60)}
        ${text('announcement.link', t('Link (optional)', 'رابط (اختياري)'), c.announcement.link)}
        ${shown('announcement.published', c.announcement.published)}</fieldset>
      <fieldset><legend>${t('Stories', 'قصص')}</legend>
        <p class="help">${t('Up to eight slides: a feast, a restored church, a parish milestone. Only published stories appear, in this order.', 'حتى ثماني شرائح: عيد، كنيسة رُمّمت، محطة في حياة رعية. تظهر القصص المنشورة فقط وبهذا الترتيب.')}</p>
        <div data-stories></div>
        <button type="button" class="btn btn-secondary" data-story-add>${t('Add a story', 'إضافة قصة')}</button></fieldset>
      <fieldset><legend>${t('About ParishLife', 'عن ParishLife')}</legend>
        ${pair('about.title', t('Title', 'العنوان'), c.about.title, 140, 0, D.about.title)}
        ${pair('about.body', t('Text', 'النص'), c.about.body, 2400, 5, D.about.body)}
        ${shown('about.published', c.about.published)}</fieldset>
      <fieldset><legend>${t('Join', 'الانضمام')}</legend>
        ${pair('join.title', t('Title', 'العنوان'), c.join.title, 140, 0, D.join.title)}
        ${pair('join.body', t('Text', 'النص'), c.join.body, 600, 3, D.join.body)}
        ${shown('join.published', c.join.published)}</fieldset>
      <fieldset><legend>${t('Sections', 'الأقسام')}</legend>
        <p class="help">${t('Sections with nothing published stay hidden on their own; turn one off here to hide it even when it has content.', 'تبقى الأقسام التي لا محتوى منشوراً فيها مخفية تلقائياً؛ أطفئ أي قسم هنا لإخفائه حتى لو كان فيه محتوى.')}</p>
        <div class="home-sections">${HOME_SECTIONS.map(([key, en, ar]) => shown(`sections.${key}`, c.sections[key] !== false, t(en, ar))).join('')}</div></fieldset>
      <p class="help-error" role="alert"></p>
    </form>`,
    foot: `<a class="btn btn-secondary" href="public.html" target="_blank" rel="noopener">${t('View homepage', 'عرض الصفحة الرئيسية')}</a>
      <button type="button" class="btn btn-primary" data-home-save style="margin-inline-start:auto">${t('Save and publish', 'حفظ ونشر')}</button>`,
    onMount(el) {
      const form = el.querySelector('form'), list = form.querySelector('[data-stories]'), add = form.querySelector('[data-story-add]');
      const paint = () => {
        list.innerHTML = stories.map((s, i) => story(s, i, stories.length)).join('') || `<p class="help">${t('No stories yet.', 'لا قصص بعد.')}</p>`;
        add.disabled = stories.length >= 8;
      };
      const sync = () => { stories = collect(form).stories; };
      paint();
      add.onclick = () => { sync(); stories.push({title:{en:'', ar:''}, body:{en:'', ar:''}, image:'', link:'', published:false}); paint(); list.querySelector('[data-story]:last-child input[lang]')?.focus(); };
      list.addEventListener('click', e => {
        const move = e.target.closest('[data-story-move]'), remove = e.target.closest('[data-story-remove]');
        if (!move && !remove) return;
        sync();
        if (remove) stories.splice(Number(remove.dataset.storyRemove), 1);
        else {
          const [i, step] = move.dataset.storyMove.split(':').map(Number);
          [stories[i], stories[i + step]] = [stories[i + step], stories[i]];
        }
        paint();
      });
      const save = el.querySelector('[data-home-save]'), alert = form.querySelector('[role=alert]');
      save.onclick = async () => {
        save.disabled = true; alert.textContent = '';
        try {
          await api('workspace/site-content', 'PUT', {revision:data.revision, content:collect(form)});
          closeOverlays();
          toast(t('Homepage published', 'نُشرت الصفحة الرئيسية'), t('Visitors see the changes the next time the page loads.', 'يرى الزوّار التغييرات عند تحميل الصفحة مجدداً.'), 'success');
        } catch (error) { alert.textContent = error.message; save.disabled = false; }
      };
    }
  });
}
