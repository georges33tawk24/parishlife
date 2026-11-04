/* Music dialogs: playing a recording, setlists, sheet music, and editing a hymn's text. */
import { t, fmtDate } from '../../../lib/i18n.js';
import { me } from '../../model/store.js';
import { Icon, toast, openDrawer, openModal, closeOverlays } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { persist } from '../../model/persist.js';
import { ok, refresh, val } from '../../shared/dialog-helpers.jsx';

const L = (en, ar) => t(en, ar);

export function play(mid) {
  const m = D.MUSIC.find(x => x.id === mid);
  if (!m) return;
  const links = [m.youtubeUrl, m.anghamiUrl, m.otherUrl].filter(Boolean);
  const safe = links.find(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  });
  if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
  else
    toast(
      L('No playable recording linked', 'لا تسجيل مرتبط للتشغيل'),
      L(
        'Add a real YouTube, Anghami, or recording link to this hymn.',
        'أضف رابط يوتيوب أو أنغامي أو تسجيل حقيقي لهذا اللحن.'
      ),
      'warning'
    );
}

export function setlistOpen(id) {
  const s = D.SETLISTS.find(x => x.id === id) || D.SETLISTS[0];
  openDrawer({
    title: L(s.name, s.ar),
    sub: s.service
      ? L('Linked to Sunday Mass 10:30', 'مرتبطة بقدّاس الأحد ١٠:٣٠')
      : L('Not linked to a service yet', 'غير مرتبطة بخدمة بعد'),
    body: s.items.map((mid, i) => {
      const m = D.MUSIC.find(x => x.id === mid);
      return m ? (
        <div key={i} className="listrow" style={{ paddingInline: 0 }}>
          <span className="mono dim" style={{ width: '22px' }}>
            {i + 1}
          </span>
          <span className="grow">
            <b>{m.title}</b>{' '}
            <small style={{ fontFamily: 'var(--arabic)' }}>
              {m.ar} · {m.key}
            </small>
          </span>{' '}
          <button className="iconbtn" data-play={m.id} aria-label={L('Play', 'استماع')}>
            <Icon name="play" size={16} />
          </button>
        </div>
      ) : (
        ''
      );
    }),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-primary" id="sl_print" style={{ marginInlineStart: 'auto' }}>
          <Icon name="print" size={16} />
          {L('Print choir folder', 'طباعة ملف الجوقة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => play(b.dataset.play)));
      el.querySelector('#sl_print').addEventListener('click', () => {
        closeOverlays();
        setTimeout(() => window.print(), 250);
      });
    }
  });
}

export function sheetOpen(id) {
  const s = D.SIGNUP_SHEETS.find(x => x.id === id);
  if (!s) return;
  const assigned = s.people || [],
    legacy = Math.max(0, (s.taken || 0) - assigned.length);
  openDrawer({
    title: L(s.what, s.whatAr),
    sub: `${s.taken} / ${s.slots} · ${L('closes', 'يقفل')} ${fmtDate(s.deadline)}`,
    body: (
      <>
        {legacy ? (
          <p className="alert alert-info">
            {legacy}{' '}
            {L(
              'previously filled places have no names saved; these remain reserved.',
              'مراكز مُعبّأة سابقاً بلا أسماء محفوظة؛ تبقى محجوزة.'
            )}
          </p>
        ) : (
          ''
        )}{' '}
        <p className="help">
          {L(
            'Select several volunteers, then save. Unchecking a named volunteer removes them from this sheet.',
            'اختر عدة متطوعين ثم احفظ. إزالة علامة متطوع مسمّى تُخرجه من اللائحة.'
          )}
        </p>{' '}
        <div className="choice-grid" style={{ marginTop: '14px' }}>
          {D.VOLUNTEERS.map(v => D.person(v.p))
            .filter(Boolean)
            .map((p, i) => (
              <label key={i} className="check">
                <input
                  type="checkbox"
                  name="sheet-person"
                  defaultValue={p.id}
                  defaultChecked={!!assigned.includes(p.id)}
                />
                <span>{L(p.lat, p.ar)}</span>
              </label>
            ))}
        </div>{' '}
        <p className="help">
          {L('Capacity', 'السعة')}: {s.slots} · {L('previously filled without names', 'محجوز سابقاً بلا أسماء')}:{' '}
          {legacy}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="sh_save" style={{ marginInlineStart: 'auto' }}>
          {L('Save participants', 'حفظ المشاركين')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#sh_save').addEventListener('click', async () => {
        const people = [...el.querySelectorAll('[name="sheet-person"]:checked')].map(x => x.value);
        if (people.length + legacy > s.slots)
          return toast(
            L('Sheet is full', 'اللائحة ممتلئة'),
            L('Increase capacity or remove a participant.', 'زد السعة أو أزل مشاركاً.'),
            'warning'
          );
        s.people = people;
        s.taken = legacy + people.length;
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Participants saved', 'حُفظ المشاركون'), `${s.taken} / ${s.slots}`);
      });
    }
  });
}

export function textEdit({ title, label, value, onSave, max = 400, help = '', ph = '' }) {
  openModal({
    title,
    body: <C.Textarea label={label} id="txe" max={max} value={value} help={help} ph={ph} />,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="txok" style={{ marginInlineStart: 'auto' }}>
          {L('Save', 'حفظ')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#txok').addEventListener('click', () => {
        onSave(val(el, '#txe'));
        closeOverlays();
        refresh();
        ok(L('Saved', 'حُفظ'));
      });
    }
  });
}

/** Lyrics are typed one verse per line, the three scripts split by "|"; the chord chart is plain text. */
export function hymnText(mid, what) {
  const d = D.musicInfo(D.MUSIC.find(m => m.id === mid) || { id: mid });
  if (what === 'chords')
    return textEdit({
      title: L('Chord chart', 'جدول الأوتار'),
      label: L('Chords above the words', 'الأوتار فوق الكلمات'),
      value: d.chords,
      max: 3000,
      ph: 'Dm      Gm     A7     Dm',
      onSave: v => {
        d.chords = v;
      },
      help: L(
        'A line of chords alone transposes; lines of words are left as they are.',
        'سطر الأوتار وحده يُنقَل؛ أسطر الكلمات تبقى كما هي.'
      )
    });
  textEdit({
    title: L('Lyrics', 'الكلمات'),
    label: L('One verse per line', 'بيت في كل سطر'),
    value: d.lyrics.map(r => r.join(' | ')).join('\n'),
    max: 4000,
    ph: 'Syriac | عربي | English',
    help: L(
      'Separate the Syriac, Arabic and English with a vertical bar: |',
      'افصل السرياني والعربي والإنكليزي بخطّ عمودي: |'
    ),
    onSave: v => {
      d.lyrics = v
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean)
        .map(x => {
          const c = x.split('|').map(y => y.trim());
          return [c[0] || '', c[1] || '', c[2] || ''];
        });
    }
  });
}

/** Restoring an old version adds it as the new current one, so the history is never rewritten. */
export function hymnRestore(mid, i) {
  const d = D.musicInfo(D.MUSIC.find(m => m.id === mid) || { id: mid }),
    v = d.versions[+i];
  if (!v) return;
  d.versions.unshift([`Restored — ${v[0]}`, `استرجاع — ${v[1]}`, D.TODAY.toISOString().slice(0, 10), me()?.id || v[3]]);
  refresh();
  ok(L('Version restored', 'استُرجع الإصدار'), L(v[0], v[1]), {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        d.versions.shift();
        refresh();
      }
    }
  });
}
