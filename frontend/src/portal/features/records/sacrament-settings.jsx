/* The priest's sacrament settings: the parish's own preparation requirement lists (typed by the parish in
   English and/or Arabic; there is no built-in list) and his signature image for printed certificates.
   Main functions: openRequirementLists (the lists, editable by a priest, readable by the office) and
   openSignatureImage (draw or upload, replace or remove his own image).
   The signature image is a picture for the paper only: it is not an electronic signature, proves no approval,
   and is kept privately (only he reads it here; certificate readers see the copy attached when he signed). */
import { useEffect, useRef, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { is, bus } from '../../model/store.js';
import { openDrawer, closeOverlays, toast } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { SignaturePad } from '../../ui/signature.jsx';
import * as API from '../../model/modules/sacraments.js';
import { KIND, kindLabel } from './records-shared.jsx';

const L = (en, ar) => t(en, ar);

/* One line per requirement: "English | Arabic" (either side may be empty). */
const toLines = set => (set?.items || []).map(i => `${i.label || ''} | ${i.labelAr || ''}`).join('\n');
function fromLines(text, previous) {
  return text
    .split('\n')
    .map(line => line.split('|').map(part => part.trim()))
    .filter(([label = '', labelAr = '']) => label || labelAr)
    .map(([label = '', labelAr = ''], i) => {
      // a line that is unchanged keeps its key, so what cases already recorded for it stays
      const same = previous?.items.find(item => item.label === label && item.labelAr === labelAr);
      return { key: same?.key || `item_${Date.now().toString(36)}_${i}`, label, labelAr };
    });
}

function RequirementLists() {
  const kinds = Object.keys(KIND).filter(k => API.apiKind(k));
  const [kind, setKind] = useState(kinds[0]);
  const set = API.requirementSetFor(kind);
  const [text, setText] = useState(toLines(set));
  const [block, setBlock] = useState(!!set?.blockScheduling);
  const [busy, setBusy] = useState(false);
  const priest = is('priest');
  const choose = next => {
    const chosen = API.requirementSetFor(next);
    setKind(next);
    setText(toLines(chosen));
    setBlock(!!chosen?.blockScheduling);
  };
  const save = async () => {
    setBusy(true);
    try {
      await API.saveRequirementSet(kind, fromLines(text, set), block);
      closeOverlays();
      bus.refresh();
      toast(
        L('Requirements saved', 'حُفظت المتطلبات'),
        L(
          'New cases use this list; open cases update when the office chooses to.',
          'تعتمد الحالات الجديدة هذه اللائحة؛ وتُحدَّث الحالات المفتوحة حين يختار المكتب ذلك.'
        ),
        'success'
      );
    } catch (e) {
      setBusy(false);
      toast(L('Could not save the requirements', 'تعذّر حفظ المتطلبات'), e.message, 'danger');
    }
  };
  return (
    <>
      <div className="formrow">
        <label className="label" htmlFor="reqset_kind">
          {L('Sacrament', 'السرّ')}
        </label>
        <Select id="reqset_kind" value={kind} onChange={e => choose(e.target.value)}>
          {kinds.map(k => (
            <option key={k} value={k}>
              {kindLabel(k)}
            </option>
          ))}
        </Select>
      </div>
      <div className="formrow">
        <label className="label" htmlFor="reqset_lines">
          {L('Requirements — one per line: English | Arabic', 'المتطلبات — سطر لكل متطلب: إنكليزي | عربي')}
        </label>
        <textarea
          id="reqset_lines"
          className="textarea"
          rows={8}
          value={text}
          readOnly={!priest}
          onChange={e => setText(e.target.value)}
        />
        <span className="help">
          {set
            ? L('Saved list. An empty list clears it.', 'لائحة محفوظة. اللائحة الفارغة تمحوها.')
            : L('This parish has no list for this sacrament yet.', 'لا لائحة لهذا السرّ في الرعية بعد.')}
        </span>
      </div>
      <label className="check">
        <input type="checkbox" checked={block} disabled={!priest} onChange={e => setBlock(e.target.checked)} />{' '}
        <span>
          {L(
            'Confirm a celebration date only when every requirement is met',
            'لا يُؤكَّد موعد الاحتفال إلا بعد استيفاء كل المتطلبات'
          )}
        </span>
      </label>
      {priest ? (
        <button className="btn btn-primary" style={{ marginTop: '14px' }} disabled={busy} onClick={save}>
          {L('Save the list', 'حفظ اللائحة')}
        </button>
      ) : (
        <p className="help">{L('Only a priest changes these lists.', 'الكاهن وحده يغيّر هذه اللوائح.')}</p>
      )}
    </>
  );
}

export const openRequirementLists = () =>
  openDrawer({
    title: L('Preparation requirements', 'متطلبات التحضير'),
    sub: L(
      'The parish’s own list for each sacrament. Accepted requests get a copy as their checklist.',
      'لائحة الرعية الخاصة بكل سرّ. تأخذ الطلبات المقبولة نسخة منها كلائحة تحضير.'
    ),
    body: <RequirementLists />
  });

/* The drawing as a PNG: the pad's path stroked on a white-free (transparent) 800 × 280 canvas. */
function drawingToPng(path) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 280;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1b2a4a';
  ctx.stroke(new Path2D(path));
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('The drawing could not be made into an image.'))),
      'image/png'
    )
  );
}

function SignatureImage() {
  const pad = useRef(null),
    file = useRef(null);
  const [current, setCurrent] = useState(null);
  const [preview, setPreview] = useState('');
  const [empty, setEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    try {
      const mine = await API.mySignatureImage();
      setCurrent(mine);
      setPreview(mine?.hasImage ? await API.mySignatureImageData() : '');
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    refresh();
  }, []);
  const run = async (step, done) => {
    setBusy(true);
    setError('');
    try {
      await step();
      await refresh();
      pad.current?.clear();
      if (file.current) file.current.value = '';
      toast(done, '', 'success');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };
  const upload = () =>
    run(
      async () => {
        const chosen = file.current?.files?.[0];
        const image = chosen || (pad.current && !pad.current.empty() ? await drawingToPng(pad.current.path()) : null);
        if (!image) throw new Error(L('Draw your signature or choose an image.', 'ارسم توقيعك أو اختر صورة.'));
        await API.uploadSignatureImage(image);
      },
      L('Signature image saved', 'حُفظت صورة التوقيع')
    );
  const remove = () =>
    run(() => API.removeSignatureImage(current.version), L('Signature image removed', 'أُزيلت صورة التوقيع'));
  return (
    <>
      <p className="alert alert-warning">
        {L(
          'This is a picture of your handwritten signature, attached to certificates you approve so it prints on the paper. It is not an electronic signature and proves nothing on its own; the wet-signed and sealed paper remains the official document.',
          'هذه صورة لتوقيعك بخط اليد، تُرفق بالشهادات التي تعتمدها لتُطبع على الورقة. ليست توقيعاً إلكترونياً ولا تُثبت شيئاً وحدها؛ وتبقى الورقة الموقَّعة باليد والمختومة هي الوثيقة الرسمية.'
        )}
      </p>
      {preview ? (
        <div className="formrow">
          <span className="label">{L('Current image', 'الصورة الحالية')}</span>
          <img
            src={preview}
            alt={L('Your signature image', 'صورة توقيعك')}
            style={{ maxWidth: '100%', maxHeight: '120px' }}
          />
        </div>
      ) : current ? (
        <p className="help">{L('You have no signature image.', 'لا صورة توقيع لديك.')}</p>
      ) : (
        ''
      )}
      <div className="sig-pad-wrap">
        <SignaturePad
          ref={pad}
          className="sig-pad"
          role="img"
          aria-label={L('Signature pad', 'لوحة التوقيع')}
          onDraw={() => setEmpty(pad.current.empty())}
        >
          <line x1="24" x2="376" y1="112" y2="112" />
        </SignaturePad>
        <button type="button" className="btn btn-ghost btn-dense" onClick={() => pad.current.clear()}>
          {L('Clear', 'مسح')}
        </button>
      </div>
      <div className="formrow">
        <label className="label" htmlFor="sigimg_file">
          {L('Or choose a PNG or JPEG image (up to 1 MB)', 'أو اختر صورة PNG أو JPEG (حتى 1 ميغابايت)')}
        </label>
        <input id="sigimg_file" ref={file} type="file" accept="image/png,image/jpeg" onChange={() => setEmpty(false)} />
      </div>
      <p className="help-error" role="alert">
        {error}
      </p>
      <div className="row" style={{ gap: '8px' }}>
        <button className="btn btn-primary" disabled={busy || empty} onClick={upload}>
          {current?.hasImage ? L('Replace the image', 'استبدال الصورة') : L('Save the image', 'حفظ الصورة')}
        </button>
        {current?.hasImage ? (
          <button className="btn btn-ghost" disabled={busy} onClick={remove}>
            {L('Remove', 'إزالة')}
          </button>
        ) : (
          ''
        )}
      </div>
    </>
  );
}

export const openSignatureImage = () =>
  openDrawer({
    title: L('My signature image', 'صورة توقيعي'),
    sub: L(
      'Kept privately for this parish. Certificates already approved keep the image they were approved with.',
      'تُحفظ بشكل خاص لهذه الرعية. تحتفظ الشهادات المعتمدة سابقاً بالصورة التي اعتُمدت بها.'
    ),
    body: <SignatureImage />
  });
