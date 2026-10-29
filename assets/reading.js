/* Easier reading, on the public site and the sign-in screen: the size of the text (A, A+, A++)
   and Simple view (nothing moves on its own, and the usual mouse pointer), remembered on this
   device. It runs in the page's head, so a page is drawn at the visitor's size from its first
   frame. The control is put into every [data-ease-slot] and follows the page's language.

   html[data-text="2"|"3"] scales every font size on the page (--fs in site.css and auth.css);
   html[data-simple] stops the motion (home-motion.js, church.css, auth.css). */
(() => {
  const root = document.documentElement;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* private mode */ } };
  const apply = () => {
    const size = read('pl-text');
    if (size === '2' || size === '3') root.dataset.text = size; else delete root.dataset.text;
    if (read('pl-simple') === '1') root.dataset.simple = ''; else delete root.dataset.simple;
  };
  apply();

  const WORDS = {
    en: { button: 'Text size', title: 'Easier reading', size: 'Text size', sizes: ['Normal text', 'Larger text', 'Largest text'],
      simple: 'Simple view', hint: 'Nothing moves on its own, and the usual mouse pointer' },
    ar: { button: 'حجم الخط', title: 'قراءة أسهل', size: 'حجم الخط', sizes: ['نص عادي', 'نص أكبر', 'أكبر نص'],
      simple: 'عرض مبسّط', hint: 'لا شيء يتحرّك من تلقاء نفسه، ومؤشّر الفأرة المعتاد' }
  };
  let count = 0;
  const markup = id => {
    const w = WORDS[root.lang === 'ar' ? 'ar' : 'en'], size = root.dataset.text || '1';
    return `<button type="button" class="ease-toggle" data-ease-toggle aria-expanded="false" aria-controls="${id}"><span class="ease-glyph" aria-hidden="true">A<small>A</small></span><span class="ease-word">${w.button}</span></button>
      <div class="ease-panel" id="${id}" role="group" aria-labelledby="${id}-title" hidden>
        <p class="ease-title" id="${id}-title">${w.title}</p>
        <p class="ease-label" id="${id}-size">${w.size}</p>
        <div class="ease-sizes" role="group" aria-labelledby="${id}-size">${['A', 'A+', 'A++'].map((t, i) => `<button type="button" data-text-size="${i + 1}" aria-pressed="${String(i + 1) === size}" aria-label="${w.sizes[i]}"><span class="ease-a ease-a${i + 1}" aria-hidden="true">${t}</span></button>`).join('')}</div>
        <label class="ease-simple"><input type="checkbox" data-simple-view${'simple' in root.dataset ? ' checked' : ''}><span><b>${w.simple}</b><small>${w.hint}</small></span></label>
      </div>`;
  };
  const mountAll = () => document.querySelectorAll('[data-ease-slot]').forEach(slot => {
    if (slot.dataset.easeLang === root.lang && slot.firstChild) return;
    slot.dataset.easeLang = root.lang;
    slot.classList.add('ease');
    slot.innerHTML = markup(`ease-${++count}`);
  });
  const panelOf = toggle => document.getElementById(toggle.getAttribute('aria-controls'));
  const close = (keep, refocus) => document.querySelectorAll('[data-ease-toggle][aria-expanded="true"]').forEach(toggle => {
    if (toggle === keep) return;
    toggle.setAttribute('aria-expanded', 'false');
    panelOf(toggle).hidden = true;
    if (refocus) toggle.focus();
  });
  const sync = () => {
    const size = root.dataset.text || '1';
    document.querySelectorAll('[data-text-size]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.textSize === size)));
    document.querySelectorAll('[data-simple-view]').forEach(input => { input.checked = 'simple' in root.dataset; });
  };

  document.addEventListener('click', e => {
    const size = e.target.closest('[data-text-size]');
    if (size) {
      write('pl-text', size.dataset.textSize === '1' ? '' : size.dataset.textSize);
      apply(); sync();
      dispatchEvent(new Event('resize'));   // the page measures itself again at the new size
      return;
    }
    const toggle = e.target.closest('[data-ease-toggle]');
    if (toggle) {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      close(toggle);
      toggle.setAttribute('aria-expanded', String(open));
      panelOf(toggle).hidden = !open;
      if (open) { sync(); panelOf(toggle).querySelector('[aria-pressed="true"]')?.focus(); }
      return;
    }
    if (!e.target.closest('[data-ease-slot]')) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(null, true); });
  document.addEventListener('change', e => {
    if (!e.target.matches('[data-simple-view]')) return;
    write('pl-simple', e.target.checked ? '1' : '');
    apply();
    location.reload();   // the page's motion is set up as it loads, so it loads again without it
  });
  const start = () => {
    mountAll();
    new MutationObserver(mountAll).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(mountAll).observe(root, { attributes: true, attributeFilter: ['lang'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
