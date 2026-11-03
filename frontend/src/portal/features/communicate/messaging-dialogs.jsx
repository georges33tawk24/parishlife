/* Writing to people: composing a message to a person, group or audience, reminders, broadcasts and
   ready-made designs. */
import { Select } from '../../ui/components.jsx';
import { paint } from '../../ui/html.js';
import { t } from '../../../lib/i18n.js';
import { Icon, toast, openDrawer, closeOverlays, Avatar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { download } from '../../shell/actions.jsx';
import { memberAction } from '../../model/member-data.js';
import { curGroup, ok, val } from '../../shared/dialog-helpers.jsx';
import { need } from '../../shared/dialogs.jsx';
import { pickPerson } from '../records/people-dialogs.jsx';

const L = (en, ar) => t(en, ar);

export function compose(audience = 'all', { subject = '', body = '', bodyAr = '', title } = {}) {
  if (audience === 'eparchy')
    return toast(
      L('Eparchy delivery is not connected', 'خدمة الإرسال إلى الأبرشية غير موصولة'),
      L('Use the Eparchy contact outside this application.', 'تواصل مع الأبرشية خارج هذا التطبيق.'),
      'warning'
    );
  const person = D.person(audience);
  const groupAudience = audience === 'group';
  const [aen, aar] = person
    ? [person.lat, person.ar]
    : groupAudience
      ? [D.group(curGroup())?.name || 'Ministry', D.group(curGroup())?.ar || 'الخدمة']
      : [L('All members', 'كل الأعضاء'), L('All members', 'كل الأعضاء')];
  openDrawer({
    large: true,
    title: title || L('New message', 'رسالة جديدة'),
    sub: L(
      'Delivered inside ParishLife to accounts in this parish. External channels are not connected.',
      'تصل داخل ParishLife إلى الحسابات في هذه الرعية. القنوات الخارجية غير موصولة.'
    ),
    body: (
      <>
        <div className="formrow">
          <label className="label">{L('Send to', 'إرسال إلى')}</label>{' '}
          {groupAudience ? (
            <Select id="mgroup">
              {D.GROUPS.map(g => (
                <option value={g.id} selected={!!(g.id === curGroup())}>
                  {L(g.name, g.ar)}
                </option>
              ))}
            </Select>
          ) : (
            <div className="chipfield" style={{ cursor: 'default' }}>
              <span className="tag">
                {person ? <Avatar p={person} cls="avatar-sm" /> : <Icon name="groups" size={14} />} {L(aen, aar)}
              </span>
            </div>
          )}
        </div>{' '}
        <C.Field label={L('Subject', 'الموضوع')} value={subject} id="msubj" req={true} />{' '}
        <C.Textarea label={L('Message — English', 'الرسالة — إنكليزي')} id="msgen" max={480} value={body} />{' '}
        <C.Textarea label={L('Message — Arabic', 'الرسالة — عربي')} id="msgar" max={480} ar={true} value={bodyAr} />{' '}
        <p className="help">
          {L(
            'Both versions appear together in the recipient’s in-app message or update.',
            'تظهر النسختان معاً في رسالة المستلِم أو المستجد داخل التطبيق.'
          )}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="msend" style={{ marginInlineStart: 'auto' }}>
          <Icon name="msg" size={16} />
          {L('Send in app', 'إرسال داخل التطبيق')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#msend').addEventListener('click', async () => {
        const subject = val(el, '#msubj'),
          english = val(el, '#msgen'),
          arabic = val(el, '#msgar');
        if (!need(el, '#msubj', L('Enter a subject', 'أدخل الموضوع')) || (!english && !arabic))
          return toast(L('Enter a subject and message', 'أدخل الموضوع والرسالة'), '', 'warning');
        const message = [english, arabic].filter(Boolean).join('\n\n');
        try {
          if (person)
            await memberAction('staffMessage', { recipientPersonId: person.id, title: subject, body: message });
          else
            await memberAction('publish', {
              kind: 'announcement',
              groupId: groupAudience ? val(el, '#mgroup') : null,
              title: subject,
              body: message
            });
          closeOverlays();
          ok(L('Delivered in ParishLife', 'أُرسلت داخل ParishLife'), L(aen, aar));
        } catch (error) {
          toast(L('Message was not delivered', 'لم تُرسَل الرسالة'), error.message, 'danger');
        }
      });
    }
  });
}

export function remind(context = 'rota') {
  toast(
    L('External reminders are not connected', 'التذكيرات الخارجية غير موصولة'),
    L(
      'Use in-app announcements for the group, or contact people outside ParishLife.',
      'استخدم المستجدات داخل التطبيق للمجموعة، أو تواصل خارج ParishLife.'
    ),
    'warning'
  );
}

export function broadcast() {
  toast(
    L('Emergency broadcast is not connected', 'البثّ الطارئ غير موصول'),
    L(
      'Use the parish’s established emergency contact procedure. No message was sent from this application.',
      'استخدم إجراء الطوارئ المعتمد في الرعية. لم يُرسَل شيء من التطبيق.'
    ),
    'warning'
  );
}

/** Ready-made parish design: fill date and place, then export the rendered design. */
export function designTemplate(i) {
  const tp = D.TEMPLATES[+i] || D.TEMPLATES[0];
  const svg = (date, place, width = '600', height = '800') => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width={width} height={height}>
      <rect width="600" height="800" fill="#233B32" />
      <rect x="28" y="28" width="544" height="744" fill="none" stroke="#EDF0E8" strokeOpacity=".45" />{' '}
      <text x="300" y="130" fill="#EDF0E8" fontFamily="Inter,Arial" fontSize="18" letterSpacing="4" textAnchor="middle">
        {D.PARISH.name.toUpperCase()}
      </text>{' '}
      <text x="300" y="170" fill="#EDF0E8" fillOpacity=".7" fontFamily="Arial" fontSize="22" textAnchor="middle">
        {D.PARISH.nameAr}
      </text>{' '}
      <text x="300" y="380" fill="#FFFFFF" fontFamily="Inter,Arial" fontSize="52" fontWeight="600" textAnchor="middle">
        {tp.name}
      </text>{' '}
      <text x="300" y="440" fill="#FFFFFF" fillOpacity=".8" fontFamily="Arial" fontSize="34" textAnchor="middle">
        {tp.ar}
      </text>{' '}
      <line x1="220" y1="500" x2="380" y2="500" stroke="#EDF0E8" />{' '}
      <text x="300" y="560" fill="#FFFFFF" fontFamily="Inter,Arial" fontSize="26" textAnchor="middle">
        {date}
      </text>{' '}
      <text x="300" y="600" fill="#FFFFFF" fillOpacity=".75" fontFamily="Inter,Arial" fontSize="20" textAnchor="middle">
        {place}
      </text>{' '}
      <text x="300" y="720" fill="#EDF0E8" fillOpacity=".6" fontFamily="Inter,Arial" fontSize="14" textAnchor="middle">
        Hadath · Maronite
      </text>
    </svg>
  );
  openDrawer({
    large: true,
    title: L(tp.name, tp.ar),
    sub: L(
      'The parish name is already on it. Fill in the date and place, then download.',
      'اسم الرعية موجود. املأ التاريخ والمكان ثم نزّل التصميم.'
    ),
    body: (
      <div className="grid g2" style={{ gap: '20px', alignItems: 'start' }}>
        <div>
          <C.Field
            label={L('Date and time', 'التاريخ والوقت')}
            value={L('Thursday 24 December, 23:00', 'الخميس ٢٤ كانون الأول، ٢٣:٠٠')}
            id="dgdate"
          />{' '}
          <C.Field
            label={L('Place', 'المكان')}
            value={L('Upper Church, Saint Elias', 'الكنيسة العليا، مار الياس')}
            id="dgplace"
          />{' '}
          <C.InlineAlert
            tone="info"
            title={L('Print or share', 'اطبع أو شارك')}
            body={L(
              'The file is a vector, so it prints sharp at A4 or A3.',
              'الملف متّجهي، فيُطبع واضحاً على A4 أو A3.'
            )}
          />
        </div>{' '}
        <div id="dgprev" style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', boxShadow: 'var(--e2)' }} />
      </div>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <Select
          id="dgformat"
          aria-label={L('Download format', 'صيغة التنزيل')}
          style={{ width: 'auto', marginInlineStart: 'auto' }}
        >
          <option value="svg">SVG</option>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
        </Select>{' '}
        <button className="btn btn-primary" id="dgdl">
          <Icon name="export" size={16} />
          {L('Download', 'تنزيل')}
        </button>
      </>
    ),
    onMount(el) {
      /* the preview is drawn by React as the fields change; the download is that drawing at full size */
      const prev = el.querySelector('#dgprev');
      const draw = () => paint(prev, svg(val(el, '#dgdate'), val(el, '#dgplace'), '100%', undefined));
      const artworkOf = () => {
        const art = prev.querySelector('svg').cloneNode(true);
        art.setAttribute('width', '600');
        art.setAttribute('height', '800');
        return new XMLSerializer().serializeToString(art);
      };
      el.querySelectorAll('#dgdate,#dgplace').forEach(i2 => i2.addEventListener('input', draw));
      draw();
      el.querySelector('#dgdl').addEventListener('click', async () => {
        const format = val(el, '#dgformat'),
          base = tp.name.toLowerCase().replace(/\s+/g, '-');
        const artwork = artworkOf();
        if (format === 'svg') {
          download(`${base}.svg`, artwork, 'image/svg+xml');
          ok(L('Design downloaded', 'نُزّل التصميم'), `${base}.svg`);
          return;
        }
        const url = URL.createObjectURL(new Blob([artwork], { type: 'image/svg+xml;charset=utf-8' }));
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const canvas = document.createElement('canvas');
          canvas.width = 1200;
          canvas.height = 1600;
          const context = canvas.getContext('2d');
          if (format === 'jpeg') {
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
          const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.94));
          if (!blob) throw new Error('Could not render the image.');
          const link = document.createElement('a'),
            output = URL.createObjectURL(blob);
          link.href = output;
          link.download = `${base}.${format}`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(output), 1000);
          ok(L('Design downloaded', 'نُزّل التصميم'), link.download);
        } catch (error) {
          toast(L('Could not export image', 'تعذّر تصدير الصورة'), error.message, 'danger');
        } finally {
          URL.revokeObjectURL(url);
        }
      });
    }
  });
}

/** A row's own menu — edit, duplicate, and a destructive action kept last and apart. */
export function composeToPerson() {
  pickPerson({ title: L('Message a person', 'مراسلة شخص'), cta: L('Continue', 'متابعة'), onPick: p => compose(p.id) });
}
