/* The music library: hymns by title, occasion, Mass part and language, each with its key
   (transposable), lyrics, sheets, recordings and rights. */
import { joinNodes, nodesOr } from '../../ui/html.js';
import { Select } from '../../ui/components.jsx';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { S, bus } from '../../model/store.js';
import { Icon, PageHead, Panel, Table, Empty, openDrawer, openModal, toast, TabBar, Avatar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { printSheet } from '../../shared/print.js';
import { MUSIC, SETLISTS, musicInfo, person } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

const LANG_AR = {
  Arabic: 'عربي',
  Syriac: 'سرياني',
  English: 'إنكليزي',
  French: 'فرنسي',
  'Roman liturgical': 'طقسي روماني'
};

const PART_AR = {
  Entrance: 'الدخول',
  Trisagion: 'التقديسات',
  Offertory: 'التقدمة',
  Communion: 'المناولة',
  Veneration: 'السجود للصليب',
  Recessional: 'الختام'
};

export function music(id, tab = '') {
  if (id) return hymn(id, tab);
  const f = S.ui.music || {};
  const shown = MUSIC.filter(
    m => (!f.occ || m.occasion === f.occ) && (!f.part || m.part === f.part) && (!f.lang || m.lang === f.lang)
  );
  const choice = (key, all, allAr, values) => (
    <Select defaultValue={f[key]} style={{ width: 'auto' }} data-mfilter={key} aria-label={L(all, allAr)}>
      <option value="">{L(all, allAr)}</option>
      {values.map(([v, en, ar], i) => (
        <option key={i} value={v}>
          {L(en, ar)}
        </option>
      ))}
    </Select>
  );
  const uniq = pick =>
    [
      ...new Map(
        MUSIC.map(m => pick(m))
          .filter(x => x[0])
          .map(x => [x[0], x])
      ).values()
    ].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = shown.map(m => ({
    cls: 'clickable',
    attrs: `data-hymn="${m.id}" data-find-item`,
    cells: [
      <>
        <b style={{ font: '500 14px/20px var(--sans)' }}>{m.title}</b>{' '}
        <small className="t-caption dim" style={{ display: 'block', fontFamily: 'var(--arabic)' }}>
          {m.ar}
        </small>
      </>,
      <span className="dim">{L(m.occasion, m.occasionAr)}</span>,
      <span className="dim">{L(m.part, PART_AR[m.part] || m.part)}</span>,
      <span className="mono">{m.key}</span>,
      <span className="chip">{L(m.lang, LANG_AR[m.lang] || m.lang)}</span>,
      <span className="row" style={{ gap: '6px' }}>
        {musicInfo(m).lyrics?.length || musicInfo(m).chords ? <Icon name="doc" size={17} cls="dimmer" /> : ''}
        {m.youtubeUrl || m.anghamiUrl || m.otherUrl ? <Icon name="music" size={17} cls="dimmer" /> : ''}
      </span>,
      <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-dense" data-act={`to-service:${m.id}`}>
          {L('Add to service', 'أضف إلى الخدمة')}
        </button>
        {CR.recBtn('hymn', m.id)}
      </span>
    ]
  }));
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Communicate', 'التواصل') }, { label: L('Music library', 'مكتبة الألحان') }]}
        title={L('Music and worship resources', 'الألحان وموارد العبادة')}
        sub={L(
          'Catalogued by title, language, composer, occasion, Mass part, feast and season, with the key, the arrangement and the instrument notes attached.',
          'مفهرسة بالعنوان واللغة والملحّن والمناسبة وجزء القدّاس والعيد والزمن، مع المقام والتوزيع وملاحظات الآلات.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" id="setlist">
              <Icon name="doc" size={17} />
              {L('Setlists', 'لوائح الألحان')}
            </button>{' '}
            <button className="btn btn-primary" data-act="hymn-new">
              <Icon name="plus" size={17} />
              {L('Add hymn', 'إضافة لحن')}
            </button>
          </>
        }
      />{' '}
      <div className="toolbar" style={{ marginBottom: '16px' }}>
        <div className="grow" style={{ maxWidth: '320px' }}>
          <C.SearchClear
            ph={L('Title, occasion or first line', 'العنوان أو المناسبة أو المطلع')}
            id="msearch"
            data-find=""
          />
        </div>{' '}
        {choice(
          'occ',
          'All occasions',
          'كل المناسبات',
          uniq(m => [m.occasion, m.occasion, m.occasionAr])
        )}{' '}
        {choice(
          'part',
          'All Mass parts',
          'كل أجزاء القدّاس',
          uniq(m => [m.part, m.part, PART_AR[m.part] || m.part])
        )}{' '}
        {choice(
          'lang',
          'All languages',
          'كل اللغات',
          uniq(m => [m.lang, m.lang, LANG_AR[m.lang] || m.lang])
        )}{' '}
        {f.occ || f.part || f.lang ? (
          <button className="btn btn-ghost btn-dense" data-act="music-clear">
            {L('Clear filters', 'مسح المرشّحات')}
          </button>
        ) : (
          ''
        )}
      </div>{' '}
      <Table
        cols={[
          { label: L('Hymn', 'اللحن'), sort: true },
          { label: L('Occasion', 'المناسبة'), cls: 'hide-sm', sort: true },
          { label: L('Mass part', 'جزء القدّاس'), cls: 'hide-md' },
          { label: L('Key', 'المقام'), cls: 'shrink' },
          { label: L('Language', 'اللغة'), cls: 'shrink hide-md' },
          { label: L('Files', 'الملفات'), cls: 'shrink hide-sm' },
          { label: '', cls: 'shrink' }
        ]}
        rows={rows}
        empty={
          <Empty
            glyph="music"
            title={L('No hymn matches', 'لا لحن يطابق')}
            body={L('Try another occasion, part or language.', 'جرّب مناسبة أو جزءاً أو لغة أخرى.')}
            action={
              <button className="btn btn-secondary btn-dense" data-act="music-clear">
                {L('Clear filters', 'مسح المرشّحات')}
              </button>
            }
          />
        }
      />{' '}
      <div className="find-empty" hidden>
        <Empty
          glyph="search"
          title={L('No hymn matches', 'لا لحن يطابق')}
          body={L('Try part of the title or the occasion.', 'جرّب جزءاً من العنوان أو المناسبة.')}
        />
      </div>
    </>
  );
}

/* Transposition moves every chord on a chord line by semitones; lyric lines are left alone. */
const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FLAT = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

const moveNote = (n, by) => {
  const i = NOTES_SHARP.indexOf(FLAT[n] || n);
  return i < 0 ? n : NOTES_SHARP[(i + by + 120) % 12];
};

const CHORD = /^([A-G][b#]?)(m|maj7|m7|7|sus2|sus4|dim|aug|add9)?(\/[A-G][b#]?)?$/;

function transpose(text, by) {
  if (!by) return text;
  return text
    .split('\n')
    .map(line => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      if (!words.length || !words.every(w => CHORD.test(w))) return line;
      return line.replace(/[A-G][b#]?(?:maj7|m7|m|7|sus2|sus4|dim|aug|add9)?(?:\/[A-G][b#]?)?/g, c => {
        const [, root, rest = '', bass = ''] = c.match(CHORD);
        return moveNote(root, by) + rest + (bass ? '/' + moveNote(bass.slice(1), by) : '');
      });
    })
    .join('\n');
}

const transposeKey = (key, by) => {
  const m = String(key || '').match(/^([A-G][b#]?)(.*)$/);
  return m ? moveNote(m[1], by) + m[2] : key;
};

const HTABS = () => [
  ['', 'Lyrics', 'الكلمات'],
  ['chords', 'Chords', 'الأوتار'],
  ['notes', 'Instrument notes', 'ملاحظات الآلات'],
  ['versions', 'Versions', 'الإصدارات'],
  ['rights', 'Rights', 'الحقوق']
];

const safeMusicLink = (value, host) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (!host || url.hostname === host || url.hostname.endsWith(`.${host}`))
      ? url.href
      : '';
  } catch {
    return '';
  }
};

function hymn(id, tab) {
  const m = MUSIC.find(x => x.id === id);
  if (!m)
    return (
      <>
        {
          <PageHead
            crumbs={[{ label: L('Music library', 'مكتبة الألحان'), href: '#/music' }]}
            title={L('Hymn not found', 'اللحن غير موجود')}
          />
        }{' '}
        {
          <Empty
            glyph="music"
            title={L('This hymn is no longer in the library', 'هذا اللحن لم يعد في المكتبة')}
            body={L('It may have been deleted.', 'ربما حُذف.')}
            action={
              <a className="btn btn-primary btn-dense" href="#/music">
                {L('Music library', 'مكتبة الألحان')}
              </a>
            }
          />
        }
      </>
    );
  const d = musicInfo(m),
    shift = (S.ui.transpose || {})[m.id] || 0;
  const musicLinks = [
    ['YouTube', safeMusicLink(m.youtubeUrl, 'youtube.com') || safeMusicLink(m.youtubeUrl, 'youtu.be')],
    ['Anghami', safeMusicLink(m.anghamiUrl, 'anghami.com')],
    ['Other link', safeMusicLink(m.otherUrl, '')]
  ].filter(([, url]) => url);
  const head = (
    <>
      <div className="pagehead">
        <div className="entityhead" style={{ width: '100%' }}>
          <div className="id">
            <nav className="crumbs">
              <a href="#/music">{L('Music library', 'مكتبة الألحان')}</a>
              <span className="sep">/</span>
              <span>{m.title}</span>
            </nav>{' '}
            <h1 style={{ font: '600 26px/34px var(--sans)', letterSpacing: '-.02em' }}>
              {m.title} {m.key ? <span className="pill">{m.key}</span> : ''}
              <span className="pill">{L(m.lang, LANG_AR[m.lang] || m.lang)}</span>
            </h1>{' '}
            <div className="meta" style={{ fontFamily: 'var(--arabic)' }}>
              {[m.ar, L(m.occasion, m.occasionAr), L(m.part, PART_AR[m.part] || m.part)].filter(Boolean).join(' · ')}
            </div>
          </div>{' '}
          <div className="acts">
            {musicLinks.length ? (
              <button className="btn btn-secondary" data-act={`play:${m.id}`}>
                <Icon name="play" size={17} />
                {L('Listen online', 'استمع عبر الإنترنت')}
              </button>
            ) : (
              ''
            )}{' '}
            <button className="btn btn-secondary" data-hymn-print={m.id}>
              <Icon name="print" size={17} />
              {L('Print sheet', 'طباعة النوتة')}
            </button>{' '}
            <button className="btn btn-primary" data-act={`to-service:${m.id}`}>
              <Icon name="plus" size={17} />
              {L('Add to service', 'أضف إلى الخدمة')}
            </button>
          </div>
        </div>
      </div>
      <TabBar base={'music/' + m.id} items={HTABS()} active={tab} />
    </>
  );
  const T = {
    '': () => (
      <div className="splitview">
        <Panel
          title={L('Lyrics', 'الكلمات')}
          tight={true}
          more={
            <button className="btn btn-ghost btn-dense" data-act={`hymn-text:${m.id}|lyrics`}>
              <Icon name={d.lyrics.length ? 'edit' : 'plus'} size={15} />
              {d.lyrics.length ? L('Edit', 'تعديل') : L('Add lyrics', 'إضافة الكلمات')}
            </button>
          }
        >
          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{L('Syriac', 'سرياني')}</th>
                <th>{L('Arabic', 'عربي')}</th>
                <th>{L('English', 'إنكليزي')}</th>
              </tr>
            </thead>
            <tbody>
              {d.lyrics.length ? (
                ''
              ) : (
                <tr>
                  <td colSpan="3" className="dim">
                    {L('No lyrics entered yet.', 'لا كلمات بعد.')}
                  </td>
                </tr>
              )}
              {d.lyrics.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontSize: '16px' }}>{r[0]}</td>
                  <td style={{ fontFamily: 'var(--arabic)', fontSize: '16px' }}>{r[1]}</td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>{' '}
        <div className="sidecol">
          {musicLinks.length ? (
            <Panel title={L('Listen online', 'استمع عبر الإنترنت')}>
              {musicLinks.map(([label, url], i) => (
                <a
                  key={i}
                  className="btn btn-secondary btn-dense"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ margin: '4px' }}
                >
                  {label}
                </a>
              ))}
            </Panel>
          ) : (
            ''
          )}{' '}
        </div>
      </div>
    ),
    chords: () => (
      <div className="splitview">
        <Panel
          title={L('Chord chart', 'جدول الأوتار') + (shift ? ` · ${shift > 0 ? '+' : ''}${shift}` : '')}
          more={
            <button className="btn btn-ghost btn-dense" data-act={`hymn-text:${m.id}|chords`}>
              <Icon name={d.chords ? 'edit' : 'plus'} size={15} />
              {d.chords ? L('Edit', 'تعديل') : L('Add chords', 'إضافة الأوتار')}
            </button>
          }
        >
          {d.chords ? (
            <pre className="mono" style={{ fontSize: '13px', lineHeight: '24px', whiteSpace: 'pre-wrap', margin: 0 }}>
              {transpose(d.chords, shift)}
            </pre>
          ) : (
            <p className="dim">{L('No chord chart yet.', 'لا جدول أوتار بعد.')}</p>
          )}
        </Panel>{' '}
        <div className="sidecol">
          <Panel title={L('Transpose', 'النقل')}>
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <span className="chip">{m.key || '—'}</span>
              <Icon name="arrowR" size={16} cls="dimmer" />{' '}
              <span className="chip chip-on">{transposeKey(m.key, shift) || '—'}</span>
            </div>{' '}
            <div className="presets" style={{ marginTop: '12px' }}>
              {[-2, -1, 0, 1, 2].map((n, i) => (
                <button key={i} aria-pressed={n === shift} data-act={`transpose:${m.id}|${n}`}>
                  {n > 0 ? '+' + n : n === 0 ? '0' : '−' + -n}
                </button>
              ))}
            </div>{' '}
            <C.InlineAlert
              tone="warning"
              title={L('A scanned PDF cannot be transposed', 'الـPDF الممسوح لا يُنقَل')}
              body={L(
                'Structured chord text transposes cleanly. ParishLife says so rather than producing a wrong sheet.',
                'النصّ الوتري المنظَّم يُنقَل بلا مشاكل. ويقول «حياة الرعية» ذلك بدل إنتاج نوتة خاطئة.'
              )}
            />
          </Panel>
        </div>
      </div>
    ),
    notes: () => (
      <div style={{ maxWidth: '760px' }}>
        <Panel title={L('Instrument notes', 'ملاحظات الآلات')} tight={true}>
          {nodesOr(
            d.notes.map(([inst, instAr, en, ar], ni) => (
              <div key={ni} className="listrow" style={{ paddingInline: 0, alignItems: 'flex-start' }}>
                <span className="chip" style={{ flex: 'none' }}>
                  {L(inst, instAr)}
                </span>{' '}
                <span className="grow">{L(en, ar)}</span>
                <C.IconBtn ico="edit" label={L('Edit', 'تعديل')} data-act={`inst-edit:${m.id}|${ni}`} />
              </div>
            )),
            <p className="dim" style={{ padding: '18px', margin: 0 }}>
              {L('No instrument notes yet.', 'لا ملاحظات آلات بعد.')}
            </p>
          )}
        </Panel>
      </div>
    ),
    versions: () => (
      <div style={{ maxWidth: '760px' }}>
        <Panel title={L('Version history', 'سجل الإصدارات')}>
          {d.versions.length ? (
            ''
          ) : (
            <p className="dim" style={{ margin: 0 }}>
              {L('No earlier versions.', 'لا إصدارات سابقة.')}
            </p>
          )}
          <div className="timeline">
            {d.versions.map(([en, ar, when, by], i) => (
              <div key={i} className={`tl-item ${i === 0 ? 'accent' : ''}`}>
                <div className="when">
                  {fmtDate(when)} · {isAr() ? person(by).ar : person(by).lat}
                </div>{' '}
                <div className="what">
                  {L(en, ar)}
                  {i === 0 ? (
                    <span className="pill pill-success">
                      <span className="dot" />
                      {L('current', 'الحالي')}
                    </span>
                  ) : (
                    ''
                  )}
                </div>{' '}
                {i ? (
                  <button
                    className="btn btn-secondary btn-dense"
                    style={{ marginTop: '8px' }}
                    data-act={`hymn-restore:${m.id}|${i}`}
                  >
                    {L('Restore', 'استرجاع')}
                  </button>
                ) : (
                  ''
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    ),
    rights: () => (
      <div className="splitview">
        <Panel title={L('Copyright and permitted uses', 'الحقوق والاستعمالات المسموحة')}>
          <dl className="dl">
            <dt>{L('Composer', 'الملحّن')}</dt>
            <dd>{L(d.composer, d.composerAr)}</dd>
            <dt>{L('Copyright', 'الحقوق')}</dt>
            <dd>{L(d.copyright, d.copyrightAr)}</dd>
            <dt>{L('Attribution', 'الإسناد')}</dt>
            <dd>{L('Not required', 'غير مطلوب')}</dd>
          </dl>{' '}
          <div className="divider" />{' '}
          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            {d.uses.map((u, i) => (
              <span key={i} className="chip chip-on">
                <Icon name="check" size={13} /> {u}
              </span>
            ))}{' '}
            <span className="chip">{L('Sell', 'بيع')}</span>
          </div>
        </Panel>{' '}
        <div className="sidecol">
          <Panel title={L('Instrument tuning', 'دوزان الآلات')}>
            <p className="t-body dim" style={{ fontSize: '14px', lineHeight: '22px' }}>
              {L(
                'A built-in tuner is deliberately not part of ParishLife. Choirs already use a phone app for it, and building one would take time away from the library, the setlists and the service plans that only a parish system can do.',
                'الدوزان المدمج ليس جزءاً من «حياة الرعية» عن قصد. الجوقات تستعمل تطبيقاً على الهاتف أصلاً، وبناء واحد يأخذ وقتاً من المكتبة واللوائح وخطط الخدمة التي لا يقوم بها سوى نظام الرعية.'
              )}
            </p>{' '}
            <span className="pill">{L('Deferred — external tool', 'مؤجَّل — أداة خارجية')}</span>
          </Panel>{' '}
          <Panel title={L('Offline copies', 'نسخ للعمل بلا إنترنت')}>
            <p className="t-body dim" style={{ fontSize: '14px' }}>
              {L(
                'Downloadable and offline copies are offered only where the licence allows it. Where it does not, the item can still be projected but not distributed.',
                'النسخ القابلة للتنزيل والعمل بلا إنترنت تُتاح فقط حيث يسمح الترخيص. وحيث لا يسمح يبقى العرض ممكناً لا التوزيع.'
              )}
            </p>{' '}
            <C.SwitchRow
              label={L('Allow choir members to download', 'السماح لأعضاء الجوقة بالتنزيل')}
              checked={true}
              pref="music.download"
            />
          </Panel>
        </div>
      </div>
    )
  };
  return (
    <>
      {head}
      {(T[tab] || T[''])()}
    </>
  );
}

music.mount = host => {
  host.querySelector('[data-hymn-print]')?.addEventListener('click', e => {
    const m = MUSIC.find(item => item.id === e.currentTarget.dataset.hymnPrint);
    if (!m) return;
    const detail = musicInfo(m),
      hasLyrics = !!detail.lyrics?.length,
      hasChords = !!detail.chords;
    if (!hasLyrics && !hasChords)
      return toast(L('No lyrics or chords to print', 'لا كلمات أو أوتار للطباعة'), '', 'warning');
    openModal({
      title: L('Print hymn sheet', 'طباعة ورقة اللحن'),
      body: (
        <>
          <p>{L(m.title, m.ar)}</p>
          <div className="formrow">
            <label className="label" htmlFor="hymn-print-choice">
              {L('Include', 'تضمين')}
            </label>
            <Select id="hymn-print-choice">
              {hasLyrics ? <option value="lyrics">{L('Lyrics', 'الكلمات')}</option> : ''}
              {hasChords ? <option value="chords">{L('Chords', 'الأوتار')}</option> : ''}
              {hasLyrics && hasChords ? <option value="both">{L('Lyrics and chords', 'الكلمات والأوتار')}</option> : ''}
            </Select>
          </div>
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="hymn-print-go">
            {L('Print', 'طباعة')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#hymn-print-go').addEventListener('click', () => {
          const choice = el.querySelector('#hymn-print-choice').value,
            lyrics = joinNodes(
              detail.lyrics.map(row => row.filter(Boolean).join(' · ')),
              <br />
            );
          const body = (
            <>
              <h1>{L(m.title, m.ar)}</h1>
              {choice !== 'chords' ? (
                <section>
                  <h2>{L('Lyrics', 'الكلمات')}</h2>
                  <p>{lyrics}</p>
                </section>
              ) : (
                ''
              )}
              {choice !== 'lyrics' ? (
                <section>
                  <h2>{L('Chords', 'الأوتار')}</h2>
                  <pre>{detail.chords}</pre>
                </section>
              ) : (
                ''
              )}
            </>
          );
          printSheet({ title: L(m.title, m.ar), body, margin: '15mm' });
        });
      }
    });
  });
  host.querySelectorAll('[data-mfilter]').forEach(sel =>
    sel.addEventListener('change', () => {
      S.ui.music = { ...(S.ui.music || {}), [sel.dataset.mfilter]: sel.value };
      bus.refresh();
    })
  );
  host.querySelectorAll('[data-hymn]').forEach(tr =>
    tr.addEventListener('click', e => {
      if (e.target.closest('button,a,input')) return;
      location.hash = '#/music/' + tr.dataset.hymn;
    })
  );
  host.querySelector('#setlist')?.addEventListener('click', () =>
    openDrawer({
      title: L('Setlists', 'لوائح الألحان'),
      sub: L(
        'Setlists come from the hymns in each service plan. To change one, change the plan.',
        'تأتي اللوائح من الألحان في كل خطة خدمة. لتغييرها غيّر الخطة.'
      ),
      body: nodesOr(
        SETLISTS.map((s, i) => (
          <div key={i} className="listrow">
            <span className="grow">
              <b>{L(s.name, s.ar)}</b>{' '}
              <small>
                {s.items.length} {L('hymns', 'ألحان')}
                {s.service ? ` · ${L('linked to a service', 'مرتبطة بخدمة')}` : ''}
              </small>
            </span>{' '}
            <button className="btn btn-secondary btn-dense" data-act={`setlist-open:${s.id}`}>
              {L('Open', 'فتح')}
            </button>
          </div>
        )),
        <Empty
          glyph="music"
          title={L('No setlists yet', 'لا لوائح بعد')}
          body={L('Put hymns in order for a Mass or a feast.', 'رتّب الألحان لقدّاس أو عيد.')}
        />
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Close', 'إغلاق')}
          </button>{' '}
        </>
      )
    })
  );
};
