/* The certificate itself: drawn as SVG in English or Arabic, previewed, printed and downloaded. */
import { Fragment } from 'react';
import { paint, markup } from '../../ui/html.js';
import { t, fmtDateIn } from '../../../lib/i18n.js';
import { Icon, openModal, openMenu, toast } from '../../ui/ui.jsx';
import { printSheet, saveBlob, svgToPng, fileName } from '../../shared/print.js';
import { PARISH, person } from '../../model/data.js';
import { docRecord, certificateSheet } from '../../model/modules/sacraments.js';
import { DOC_LANGS, KIND, kindLabel, nameIn, today, zoned } from './records-shared.jsx';

const L = (en, ar) => t(en, ar);

/* ---------- the document itself: one A4 vector sheet ----------
   The same drawing is the thumbnail, the full-size view, the printed page and the PNG and SVG
   downloads, so they can never disagree. Units are millimetres on an A4 page. */
const INK = '#233B32',
  SECONDARY = '#607068',
  RULE = '#DCE2DB';

const EN_FONT = "Inter,'Helvetica Neue','Segoe UI',Arial,sans-serif";

const AR_FONT = "'IBM Plex Sans Arabic','Geeza Pro','Segoe UI',Tahoma,Arial,sans-serif";

const ANY_FONT = "Inter,'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif";

const MONO_FONT = "'IBM Plex Mono',Menlo,Consolas,monospace";

const hasArabic = v => /[؀-ۿ]/.test(String(v || ''));

const docTitle = s => (s.kind === 'certificate' ? L('Certificate', 'الشهادة') : L('Register extract', 'خلاصة القيد'));

const docIssued = s => s.kind === 'certificate' && s.status === 'issued' && !!s.issuedAt;

const docLangLabel = lang => (DOC_LANGS().find(([k]) => k === lang) || DOC_LANGS()[2])[1];

export function certificateSVG(s, lang = 'bilingual') {
  const record = (s.kind === 'certificate' ? docRecord(s) : s) || s;
  const p = person(s.person) || { lat: '', ar: '' };
  const ar = lang !== 'english',
    en = lang !== 'arabic',
    both = ar && en;
  const dl = lang === 'arabic' ? 'ar' : lang === 'english' ? 'en' : '';
  const tx = (x, y, str, o = {}) =>
    str ? (
      <text
        x={x}
        y={y}
        fontFamily={o.font || EN_FONT}
        fontSize={o.size || 4.6}
        fontWeight={o.weight || 400}
        fill={o.fill || INK}
        textAnchor={o.anchor || 'middle'}
        direction={o.rtl ? 'rtl' : undefined}
        letterSpacing={o.spacing ? o.spacing : undefined}
        opacity={o.opacity ? o.opacity : undefined}
      >
        {o.upper ? String(str).toUpperCase() : str}
      </text>
    ) : (
      ''
    );
  const arT = (x, y, str, o = {}) => tx(x, y, str, { font: AR_FONT, rtl: true, ...o });
  let y = 0;
  const out = [];
  /* frame, corner marks and the seal */
  out.push(
    <>
      <rect width="210" height="297" fill="#FFFFFF" />{' '}
      <rect x="8" y="8" width="194" height="281" fill="none" stroke={SECONDARY} strokeWidth=".6" />{' '}
      <rect x="11" y="11" width="188" height="275" fill="none" stroke={SECONDARY} strokeWidth=".25" opacity=".55" />{' '}
      {[
        [11, 11],
        [199, 11],
        [11, 286],
        [199, 286]
      ].map(([cx, cy], i) => (
        <rect
          key={i}
          x={cx - 1.4}
          y={cy - 1.4}
          width="2.8"
          height="2.8"
          fill={SECONDARY}
          opacity=".7"
          transform={`rotate(45 ${cx} ${cy})`}
        />
      ))}{' '}
      <circle cx="105" cy="33" r="10" fill="none" stroke={SECONDARY} strokeWidth=".7" />{' '}
      <path d="M105 26.5v13M98.5 33h13" stroke={SECONDARY} strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
  /* who issues it */
  y = 55;
  if (ar) {
    out.push(
      arT(105, y, PARISH.eparchyAr, { size: 7.2, weight: 600, fill: SECONDARY }),
      arT(105, y + 8.5, `${PARISH.nameAr} — ${PARISH.townAr}`, { size: 4.8, fill: SECONDARY })
    );
    y += 20;
  }
  if (en) {
    out.push(
      tx(105, y, PARISH.eparchy, { size: 5.4, weight: 600, spacing: 0.5, upper: true }),
      tx(105, y + 6.5, `${PARISH.name} — ${PARISH.town}`, { size: 3.9, fill: SECONDARY })
    );
    y += 15;
  }
  out.push(
    <>
      <path d={`M80 ${y} H101 M109 ${y} H130`} stroke={SECONDARY} strokeWidth=".3" />
      <rect
        x="103.3"
        y={y - 1.7}
        width="3.4"
        height="3.4"
        fill="none"
        stroke={SECONDARY}
        strokeWidth=".3"
        transform={`rotate(45 105 ${y})`}
      />
    </>
  );
  /* what it certifies, and for whom */
  y += 15;
  if (ar) {
    out.push(arT(105, y, KIND[record.kind]?.[1] || '', { size: 8, weight: 600 }));
    y += 8.5;
  }
  if (en) {
    out.push(tx(105, y, KIND[record.kind]?.[0] || '', { size: 4.4, spacing: 1.1, upper: true, fill: SECONDARY }));
    y += 6;
  }
  y += 6;
  if (both)
    out.push(
      tx(26, y, 'This certifies that', { size: 3.6, anchor: 'start', fill: SECONDARY }),
      arT(184, y, 'نشهد بأنّ', { size: 4, anchor: 'start', fill: SECONDARY })
    );
  else
    out.push(
      ar
        ? arT(105, y, 'نشهد بأنّ', { size: 4, fill: SECONDARY })
        : tx(105, y, 'This certifies that', { size: 3.6, fill: SECONDARY })
    );
  y += 15;
  if (ar) {
    out.push(arT(105, y, p.ar, { size: 11, weight: 600 }));
    y += 10;
  }
  if (en) {
    out.push(tx(105, y, p.lat, { size: 5.6, spacing: 0.25, fill: SECONDARY }));
    y += 6;
  }
  /* the facts, each on a ruled line: English label, value, Arabic label */
  const rows = [
    [
      record.date > today() ? 'Scheduled for' : 'Celebrated on',
      record.date > today() ? 'مجدول في' : 'تاريخ الاحتفال',
      fmtDateIn(record.date, dl)
    ],
    ['Celebrant', 'المحتفل', record.celebrantName || '—'],
    ...[
      ['godparents', 'Godparents / witnesses', 'الإشبين / الشهود'],
      ['father', 'Father', 'الأب'],
      ['mother', 'Mother', 'الأم'],
      ['place', 'Place', 'المكان']
    ]
      .filter(([k]) => record[k])
      .map(([k, enL, arL]) => [enL, arL, record[k]])
  ];
  const step = rows.length > 4 ? 9 : 10.5;
  y += 10;
  for (const [enL, arL, val] of rows) {
    const vo = { size: 4.6, weight: 600, font: ANY_FONT, rtl: hasArabic(val) };
    if (both)
      out.push(
        tx(26, y, enL, { size: 3.9, anchor: 'start', fill: SECONDARY }),
        tx(105, y, val, vo),
        arT(184, y, arL, { size: 4.3, anchor: 'start', fill: SECONDARY })
      );
    else if (en)
      out.push(
        tx(26, y, enL, { size: 4, anchor: 'start', fill: SECONDARY }),
        tx(184, y, val, { ...vo, anchor: hasArabic(val) ? 'start' : 'end' })
      );
    else
      out.push(
        arT(184, y, arL, { size: 4.5, anchor: 'start', fill: SECONDARY }),
        tx(26, y, val, { ...vo, anchor: hasArabic(val) ? 'end' : 'start' })
      );
    out.push(<path d={`M26 ${y + 2.6} H184`} stroke={RULE} strokeWidth=".25" strokeDasharray=".8 1.2" />);
    y += step;
  }
  /* where it is written: book, page and entry */
  const boxY = Math.max(y + 6, 214);
  const cap = (enL, arL) =>
    lang === 'arabic' ? arL : lang === 'english' ? enL.toUpperCase() : `${enL.toUpperCase()} · ${arL}`;
  [
    [57, 57, cap('Book / page', 'الدفتر / الصفحة'), record.book || '—'],
    [119, 34, cap('Entry', 'القيد'), record.reg]
  ].forEach(([x, w, lbl, val]) => {
    out.push(
      <rect x={x} y={boxY} width={w} height="15" rx="1.2" fill="none" stroke={RULE} strokeWidth=".4" />,
      tx(x + w / 2, boxY + 5, lbl, {
        size: lang === 'arabic' ? 3.2 : 2.5,
        spacing: lang === 'arabic' ? 0 : 0.3,
        fill: SECONDARY,
        font: ANY_FONT,
        rtl: lang === 'arabic'
      }),
      tx(x + w / 2, boxY + 11.6, val, { size: 4.4, weight: 600, font: MONO_FONT })
    );
  });
  /* signature and seal */
  const sigY = 260;
  out.push(
    <>
      <path d={`M26 ${sigY} H86`} stroke={INK} strokeWidth=".3" />{' '}
      <circle
        cx="160"
        cy={sigY - 5}
        r="11.5"
        fill="none"
        stroke={SECONDARY}
        strokeWidth=".35"
        strokeDasharray="1.2 1.2"
        opacity=".8"
      />
    </>
  );
  /* The priest signs the paper by hand and the parish seals it; the API holds no drawing of a signature. Only an
     electronic authorization is printed: its code, which anyone can check on the public verification page. */
  const signed = docIssued(s) && s.authorizationCode ? { code: s.authorizationCode } : null;
  const roleY = sigY + 5;
  if (en) out.push(tx(56, roleY, 'Parish priest', { size: 3.4, fill: SECONDARY }));
  if (ar) out.push(arT(56, roleY + (en ? 5 : 0), 'كاهن الرعية', { size: 3.8, fill: SECONDARY }));
  if (signed?.code)
    out.push(
      tx(
        105,
        283.4,
        `${en ? 'Electronically authorized · check code' : 'مفوَّضة إلكترونياً · رمز التحقّق'} ${signed.code} · ${location.host}/public.html?verify=${signed.code}`,
        { size: 2.7, fill: SECONDARY, font: ANY_FONT, rtl: !en }
      )
    );
  if (docIssued(s) && s.copyStatement && en)
    out.push(tx(105, signed?.code ? 274.4 : 278.6, s.copyStatement, { size: 2.4, fill: SECONDARY, font: ANY_FONT }));
  out.push(
    tx(160, sigY - 4, ar && !en ? 'الختم' : 'SEAL', {
      size: ar && !en ? 3.6 : 2.8,
      spacing: ar && !en ? 0 : 0.4,
      fill: SECONDARY,
      font: ANY_FONT,
      opacity: 0.85,
      rtl: ar && !en
    })
  );
  if (docIssued(s))
    out.push(
      tx(
        105,
        signed?.code ? 278.6 : 283,
        `${en ? 'Issued' : 'صدرت في'} ${fmtDateIn(zoned(s.issuedAt) || String(s.issuedAt || '').slice(0, 10), dl)}`,
        { size: 3, fill: SECONDARY, font: ANY_FONT, rtl: !en }
      )
    );
  else
    out.push(
      <g transform="rotate(-28 105 150)" opacity=".1">
        {en ? tx(105, ar ? 146 : 154, 'UNISSUED PREVIEW', { size: 13, weight: 700, spacing: 2, fill: SECONDARY }) : ''}
        {ar ? arT(105, en ? 162 : 154, 'معاينة غير صادرة', { size: 12, weight: 700, fill: SECONDARY }) : ''}
      </g>
    );
  const label = `${KIND[record.kind]?.[0] || ''} — ${p.lat}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 210 297"
      width="210mm"
      height="297mm"
      role="img"
      aria-label={label}
    >
      {out.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </svg>
  );
}

/* the thumbnail card: small paper, click to see it full size, download in three forms */
export function docCard(s, lang) {
  const record = (s.kind === 'certificate' ? docRecord(s) : s) || s,
    p = person(s.person) || {};
  return (
    <section className="panel doccard">
      <div className="panel-h">
        <h3>{docTitle(s)}</h3>{' '}
        <span className="seg doclang" role="group" aria-label={L('Document language', 'لغة الوثيقة')}>
          {DOC_LANGS().map(([k, lab], i) => (
            <button key={i} type="button" aria-pressed={lang === k} data-go={`certificate/${s.id}/${k}`}>
              {lab}
            </button>
          ))}
        </span>
      </div>{' '}
      <div className="panel-b doccard-b">
        <button
          type="button"
          className="docthumb"
          data-docview=""
          title={L('Click to view full size', 'انقر للعرض بالحجم الكامل')}
        >
          {certificateSVG(s, lang)}
          <span className="docthumb-hint">
            <Icon name="search" size={14} />
            {L('View', 'عرض')}
          </span>
        </button>{' '}
        <div className="docmeta">
          <b>
            {kindLabel(record.kind)} · {nameIn(p)}
          </b>{' '}
          <span className="t-caption dim">
            A4 · {docLangLabel(lang)} ·{' '}
            <span className="mono" dir="ltr">
              {record.reg}
            </span>
          </span>{' '}
          <p className={`docstate${docIssued(s) ? ' ok' : ''}`}>
            <Icon name={docIssued(s) ? 'check' : 'info'} size={15} />
            {docIssued(s)
              ? L('Signed and issued — ready to print or send.', 'موقّعة وصادرة — جاهزة للطباعة أو الإرسال.')
              : s.kind === 'certificate'
                ? L(
                    'Preview only — the certificate is not signed or issued yet.',
                    'معاينة فقط — لم تُوقَّع الشهادة ولم تصدر بعد.'
                  )
                : L('Preview of the register entry — not a certificate.', 'معاينة لقيد السجل — ليست شهادة.')}
          </p>{' '}
          <div className="docacts">
            <button type="button" className="btn btn-primary btn-dense" data-docview="">
              <Icon name="doc" size={16} />
              {L('View full size', 'عرض بالحجم الكامل')}
            </button>{' '}
            <button
              type="button"
              className="btn btn-secondary btn-dense"
              data-docdl=""
              aria-haspopup="menu"
              aria-expanded="false"
            >
              <Icon name="export" size={16} />
              {L('Download', 'تنزيل')}
              <Icon name="chevD" size={14} />
            </button>{' '}
            <button type="button" className="btn btn-secondary btn-dense" data-docprint="">
              <Icon name="print" size={16} />
              {L('Print', 'طباعة')}
            </button>{' '}
            {docIssued(s) ? (
              <button type="button" className="btn btn-ghost btn-dense" data-act="share-cert">
                <Icon name="msg" size={16} />
                {L('Send on WhatsApp', 'إرسال على واتساب')}
              </button>
            ) : (
              ''
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const docFile = (s, lang, ext) => {
  const record = (s.kind === 'certificate' ? docRecord(s) : s) || s;
  return `${fileName(s.kind === 'certificate' ? 'certificate' : 'register-extract', KIND[record.kind]?.[0].split(' ')[0], person(record.person)?.lat, record.reg.replace(/\//g, '-'), lang)}.${ext}`;
};

export function printDoc(s, lang, pdf = false) {
  if (pdf)
    toast(
      L('Saving as PDF', 'الحفظ كـPDF'),
      L('In the print window, choose “Save as PDF” as the printer.', 'في نافذة الطباعة، اختر «حفظ كـPDF» بدل الطابعة.'),
      'success'
    );
  printSheet({
    title: docFile(s, lang, 'pdf').replace(/\.pdf$/, ''),
    margin: '0',
    body: certificateSVG(s, lang),
    css: 'html,body{width:210mm;height:297mm;overflow:hidden}svg{display:block;width:210mm;height:297mm}'
  });
}

export function downloadMenu(anchor, s, lang) {
  openMenu(
    anchor,
    [
      { label: L('PDF — print or save', 'PDF — طباعة أو حفظ'), icon: 'doc', fn: () => printDoc(s, lang(), true) },
      ...(s.kind === 'certificate' && Object.keys(s.snapshot || {}).length
        ? [
            {
              label: L('Parish sheet (approved wording)', 'ورقة الرعية (النص المعتمد)'),
              icon: 'doc',
              hint: 'HTML',
              fn: async () => {
                try {
                  saveBlob(`${s.reg}.html`, await certificateSheet(s.id));
                  toast(L('Sheet saved', 'حُفظت الورقة'), `${s.reg}.html`, 'success');
                } catch (e) {
                  toast(L('The sheet could not be made', 'تعذّر إنشاء الورقة'), e.message, 'danger');
                }
              }
            }
          ]
        : []),
      {
        label: L('Image (PNG)', 'صورة (PNG)'),
        icon: 'export',
        hint: '1240×1754',
        fn: async () => {
          try {
            saveBlob(docFile(s, lang(), 'png'), await svgToPng(certificateSVG(s, lang()), 1240, 1754));
            toast(L('Image saved', 'حُفظت الصورة'), docFile(s, lang(), 'png'), 'success');
          } catch {
            toast(
              L('The image could not be made', 'تعذّر إنشاء الصورة'),
              L('Try the PDF instead.', 'جرّب PDF بدلاً منها.'),
              'danger'
            );
          }
        }
      },
      {
        label: L('Vector file (SVG)', 'ملف متّجه (SVG)'),
        icon: 'export',
        fn: () => {
          saveBlob(docFile(s, lang(), 'svg'), new Blob([markup(certificateSVG(s, lang()))], { type: 'image/svg+xml' }));
          toast(L('File saved', 'حُفظ الملف'), docFile(s, lang(), 'svg'), 'success');
        }
      }
    ],
    { width: 250 }
  );
}

/* full size, with its own language switch so the reader can compare without leaving */
export function viewDoc(s, lang) {
  let cur = lang;
  const record = (s.kind === 'certificate' ? docRecord(s) : s) || s;
  openModal({
    wide: true,
    title: `${docTitle(s)} — ${nameIn(person(s.person))}`,
    sub: (
      <>
        A4 ·{' '}
        <span className="mono" dir="ltr">
          {record.reg}
        </span>{' '}
        · {docIssued(s) ? L('issued', 'صادرة') : L('preview, not issued', 'معاينة، غير صادرة')}
      </>
    ),
    body: (
      <>
        <div className="docview-bar">
          <span className="seg" role="group" aria-label={L('Document language', 'لغة الوثيقة')}>
            {DOC_LANGS().map(([k, lab], i) => (
              <button key={i} type="button" aria-pressed={cur === k} data-vlang={k}>
                {lab}
              </button>
            ))}
          </span>
        </div>{' '}
        <div className="docviewer" id="docviewer">
          {certificateSVG(s, cur)}
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-secondary" id="dv_dl" aria-haspopup="menu" style={{ marginInlineStart: 'auto' }}>
          <Icon name="export" size={16} />
          {L('Download', 'تنزيل')}
          <Icon name="chevD" size={14} />
        </button>{' '}
        <button className="btn btn-primary" id="dv_print">
          <Icon name="print" size={16} />
          {L('Print', 'طباعة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelectorAll('[data-vlang]').forEach(b =>
        b.addEventListener('click', () => {
          cur = b.dataset.vlang;
          el.querySelectorAll('[data-vlang]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          paint(el.querySelector('#docviewer'), certificateSVG(s, cur));
        })
      );
      el.querySelector('#dv_dl').addEventListener('click', e => downloadMenu(e.currentTarget, s, () => cur));
      el.querySelector('#dv_print').addEventListener('click', () => printDoc(s, cur));
    }
  });
}
