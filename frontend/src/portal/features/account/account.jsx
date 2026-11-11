/* My account: the profile, the parishes someone follows, their own colours, how they sign in, and
   (for parish staff) their signature. */
import { useEffect, useRef, useState } from 'react';
import { changeAccountPassword } from './account-security.jsx';
import { GuestLinks } from './guest-links.jsx';
import { RecordCorrections } from '../records/profile-reviews.jsx';
import { api, session, loadSession } from '../../model/api.js';
import { t, isAr } from '../../../lib/i18n.js';
import { passkeysSupported, addPasskey, listPasskeys, removePasskey, passkeyMessage } from '../../model/passkeys.js';
import { sign } from '../../model/signing.js';
import { Drawing, SignaturePad } from '../../ui/signature.jsx';
import { PageHead, Panel, toast, openDrawer, closeOverlays, Icon, Paged } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { SCHEMES, schemeOf, applyTheme } from '../../../lib/theme.js';

async function save(form, body) {
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await api('account', 'PUT', body);
    toast(t('Saved', 'حُفظ'), '', 'success');
    return true;
  } catch (e) {
    toast(t('Could not save', 'تعذّر الحفظ'), e.message, 'danger');
    return false;
  } finally {
    button.disabled = false;
  }
}

const MEMBERSHIP = () => ({
  none: t('Not requested', 'لم تُطلب'),
  pending: t('Office review pending', 'بانتظار مراجعة المكتب'),
  approved: t('Approved', 'مقبولة')
});

export function AccountPage() {
  const [loaded, setLoaded] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState('');
  const [query, setQuery] = useState(''),
    [signature, setSignature] = useState(0);
  const [welcome] = useState(() => {
    try {
      const w = sessionStorage.getItem('pl-welcome') === '1';
      sessionStorage.removeItem('pl-welcome');
      return w;
    } catch {
      return false;
    }
  });
  const search = useRef(null);
  useEffect(() => {
    Promise.all([api('account'), api('public/parishes')]).then(
      ([data, directory]) => {
        setLoaded({ data, directory });
        setBusy('');
      },
      e => setError(e.message)
    );
  }, [round]);
  const head = (
    <PageHead
      title={t('My account', 'حسابي')}
      sub={t('Your profile, parishes and personal appearance.', 'ملفك ورعاياك ومظهر حسابك.')}
    />
  );
  if (error || !loaded)
    return (
      <>
        {head}
        <div data-account-content="" aria-live="polite">
          {error || t('Loading your account…', 'جارٍ تحميل الحساب…')}
        </div>
      </>
    );
  const { data, directory } = loaded,
    profile = data.profile || {},
    theme = { scheme: 'forest', mode: 'light', ...data.theme };
  const input = (key, en, ar) => (
    <label className="formrow">
      <span className="label">{t(en, ar)}</span>
      <input className="input" name={key} defaultValue={profile[key] || ''} maxLength="500" />
    </label>
  );
  const affiliate = async (parish, action) => {
    setBusy(parish + action);
    try {
      await api('account/parishes', 'POST', { parish, action });
      await loadSession();
      setRound(n => n + 1);
    } catch (e) {
      setBusy('');
      toast(t('Could not save', 'تعذّر الحفظ'), e.message, 'danger');
    }
  };
  const q = query.toLowerCase().trim();
  return (
    <>
      {head}
      <div data-account-content="" aria-live="polite">
        {welcome ? (
          <div className="account-welcome" role="status">
            <h2>{t('Welcome to ParishLife', 'أهلاً بك في ParishLife')}</h2>
            <p>
              {t(
                'Now choose your parish under My parishes: follow it for its news and events, make it your primary parish, and ask to become a member when you are ready.',
                'اختر الآن رعيتك في «رعاياي»: تابعها لتصلك أخبارها ومناسباتها، واجعلها رعيتك الأساسية، واطلب العضوية عندما تكون مستعداً.'
              )}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              data-to-parishes=""
              onClick={() => {
                search.current.closest('.panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                search.current.focus({ preventScroll: true });
              }}
            >
              {t('Choose my parish', 'اختر رعيتي')}
            </button>
          </div>
        ) : null}
        <div className="account-grid">
          <Panel title={t('Complete Profile', 'أكمل ملفك')}>
            <p className="help">
              {t(
                'Save your account details here. To correct an official record, use My parish records below and submit it for office review. You can return later.',
                'احفظ معلومات حسابك هنا. لتصحيح سجل رسمي، استخدم سجلاتي الرعوية أدناه وأرسله لمراجعة المكتب. يمكنك العودة لاحقاً.'
              )}
            </p>
            <form
              data-profile=""
              onSubmit={async e => {
                e.preventDefault();
                await save(e.currentTarget, { profile: Object.fromEntries(new FormData(e.currentTarget)) });
              }}
            >
              <div className="formgrid">
                {input('firstName', 'First name', 'الاسم')}
                {input('lastName', 'Last name', 'الشهرة')}
                {input('town', 'Town', 'البلدة')}
                {input('address', 'Address', 'العنوان')}
                {input('occupation', 'Occupation', 'المهنة')}
                {input('language', 'Preferred language', 'اللغة المفضلة')}
              </div>
              <label className="formrow">
                <span className="label">{t('About me', 'نبذة عني')}</span>
                <textarea className="textarea" name="about" maxLength="500" defaultValue={profile.about || ''} />
              </label>
              <button className="btn btn-primary">{t('Save profile', 'حفظ الملف')}</button>
            </form>
          </Panel>
          <Panel title={t('My appearance', 'المظهر الشخصي')}>
            <p className="help">
              {t(
                'These colors apply only to your dashboard. Parish websites share one public theme.',
                'تُطبّق هذه الألوان على حسابك فقط. للمواقع العامة مظهر موحّد.'
              )}
            </p>
            <form
              data-theme=""
              onSubmit={async e => {
                e.preventDefault();
                const form = e.currentTarget,
                  next = Object.fromEntries(new FormData(form));
                if (await save(form, { theme: next })) {
                  session.preferences = { theme: next };
                  applyTheme(next);
                }
              }}
            >
              <div className="palette-options">
                {SCHEMES.map(s => (
                  <label key={s.id}>
                    <input type="radio" name="scheme" value={s.id} defaultChecked={theme.scheme === s.id} />
                    <span className="palette-dot" style={{ background: s.primary }} />
                    {t(s.en, s.ar)}
                  </label>
                ))}
                <label>
                  <input type="radio" name="scheme" value="custom" defaultChecked={theme.scheme === 'custom'} />
                  {t('Custom', 'مخصّص')}
                  <input
                    type="color"
                    name="primary"
                    defaultValue={schemeOf(theme).primary}
                    aria-label={t('Choose color', 'اختر اللون')}
                  />
                </label>
              </div>
              <label className="formrow">
                <span className="label">{t('Mode', 'الوضع')}</span>
                <Select name="mode" defaultValue={theme.mode}>
                  <option value="light">{t('Light', 'فاتح')}</option>
                  <option value="dark">{t('Dark', 'داكن')}</option>
                </Select>
              </label>
              <button className="btn btn-primary">{t('Save appearance', 'حفظ المظهر')}</button>
            </form>
          </Panel>
          <Panel title={t('Sign-in and security', 'الدخول والأمان')}>
            <button type="button" className="btn btn-secondary" data-change-password="" onClick={changeAccountPassword}>
              {t('Change password', 'تغيير كلمة المرور')}
            </button>
            <p>
              {t('Username', 'اسم المستخدم')}: <b>{session.user.username}</b>
            </p>
            <div>
              {data.identities.map((i, n) => (
                <p key={n}>
                  {i.kind} · {i.value}{' '}
                  <span className="help">
                    {i.verified_at
                      ? t('Verified', 'مُتحقّق')
                      : t('Verification pending setup', 'التحقّق بانتظار الإعداد')}
                  </span>
                </p>
              ))}
            </div>
            <div className="account-passkeys" data-passkeys="">
              <Passkeys changed={() => setSignature(n => n + 1)} />
            </div>
          </Panel>
        </div>
        <div data-signature="">
          <MySignature key={signature} />
        </div>
        <div data-record-corrections="">
          <RecordCorrections />
        </div>
        <div data-guest-links="">
          <GuestLinks />
        </div>
        <Panel title={t('My parishes', 'رعاياي')}>
          <p className="help">
            {t(
              'Follow parishes for updates, choose your primary parish, and separately request parish membership for office review.',
              'تابع الرعايا واختر رعيتك الأساسية وقدّم طلب عضوية مستقلاً ليراجعه المكتب.'
            )}
          </p>
          <input
            className="input"
            type="search"
            data-parish-search=""
            placeholder={t('Search parishes', 'ابحث عن رعية')}
            aria-label={t('Search parishes', 'ابحث عن رعية')}
            ref={search}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Paged className="account-parishes" data-paginate="">
            {directory.parishes.map(p => {
              const a = data.affiliations.find(x => x.parish_id === p.id),
                name = (p.name + ' ' + p.ar + ' ' + p.town).toLowerCase();
              return (
                <article key={p.id} data-name={name} hidden={!name.includes(q)}>
                  <div>
                    <h3>
                      <a href={`public.html?parish=${encodeURIComponent(p.id)}`}>{p.name}</a>
                    </h3>
                    <p>
                      {p.town}
                      {a?.is_primary ? ' · ' + t('Primary parish', 'الرعية الأساسية') : ''}
                    </p>
                    <small>
                      {t('Membership', 'العضوية')}: {MEMBERSHIP()[a?.membership || 'none'] || a.membership}
                    </small>
                  </div>
                  <div className="account-actions">
                    <button
                      className="btn btn-secondary"
                      data-parish={p.id}
                      data-affiliation={a?.following ? 'unfollow' : 'follow'}
                      disabled={!!a?.is_primary || busy === p.id + (a?.following ? 'unfollow' : 'follow')}
                      onClick={() => affiliate(p.id, a?.following ? 'unfollow' : 'follow')}
                    >
                      {a?.following ? t('Unfollow', 'إلغاء المتابعة') : t('Follow', 'متابعة')}
                    </button>
                    <button
                      className="btn btn-secondary"
                      data-parish={p.id}
                      data-affiliation="primary"
                      disabled={!!a?.is_primary || busy === p.id + 'primary'}
                      onClick={() => affiliate(p.id, 'primary')}
                    >
                      {t('Make primary', 'اختيار كأساسية')}
                    </button>
                    <button
                      className="btn btn-primary"
                      data-parish={p.id}
                      data-affiliation="request"
                      disabled={['pending', 'approved'].includes(a?.membership) || busy === p.id + 'request'}
                      onClick={() => affiliate(p.id, 'request')}
                    >
                      {t('Request membership', 'طلب العضوية')}
                    </button>
                  </div>
                </article>
              );
            })}
          </Paged>
        </Panel>
      </div>
    </>
  );
}

/* My signature (parish staff): drawn once, kept with one of my passkeys, and used only when I
   unlock that passkey to sign a certificate or a letter. */
function MySignature() {
  const [data, setData] = useState(null),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api('account/signature').then(setData, () => {});
  }, [round]);
  if (!data?.eligible) return null;
  const me = data.signer,
    again = () => setRound(n => n + 1);
  const remove = async () => {
    setBusy(true);
    try {
      await api('account/signature/remove', 'POST', {});
      toast(t('Signature removed', 'أُزيل التوقيع'), '', 'success');
      again();
    } catch (err) {
      toast(t('Could not remove', 'تعذّرت الإزالة'), err.message, 'danger');
    }
    setBusy(false);
  };
  const edit = () => openDrawer({ title: t('My signature', 'توقيعي'), body: <SignatureForm me={me} done={again} /> });
  return (
    <Panel title={t('My signature', 'توقيعي')}>
      <div className="sig-panel">
        {me ? (
          <>
            <figure className="sig-card">
              <Drawing path={me.drawing} />
              <figcaption>
                <b>{session.user.name}</b>
                {me.title ? <span>{me.title}</span> : null}
              </figcaption>
            </figure>
            <div className="sig-facts">
              <p>
                <Icon name="lock" size={16} />
                {t('Kept with your passkey', 'محفوظ مع مفتاح المرور')} <b>{me.passkey}</b>.{' '}
                {t(
                  'Nothing is signed unless you unlock it with your face, fingerprint or PIN, over the exact document being signed.',
                  'لا يُوقَّع شيء إلا إذا فتحته بوجهك أو بصمتك أو رمزك، على الوثيقة نفسها التي تُوقَّع.'
                )}
              </p>
              <p className="help">
                {t(
                  'Each signed document carries a code anyone can check on ParishLife: who signed, when, and whether it was changed since.',
                  'تحمل كل وثيقة موقّعة رمزاً يمكن لأي شخص التحقّق منه على ParishLife: من وقّع، ومتى، وهل عُدّلت بعد ذلك.'
                )}
              </p>
              <div className="account-actions">
                <button type="button" className="btn btn-secondary" data-sig-edit="" onClick={edit}>
                  {t('Change my signature', 'تغيير توقيعي')}
                </button>
                <button type="button" className="btn btn-ghost" data-sig-remove="" disabled={busy} onClick={remove}>
                  {t('Remove', 'إزالة')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="sig-facts">
            <p>
              {t(
                'Sign certificates and letters with your own handwritten signature. It is kept with one of your passkeys, so only you can use it: each signature needs your face, fingerprint or PIN.',
                'وقّع الشهادات والرسائل بتوقيعك اليدوي. يُحفظ مع أحد مفاتيح المرور الخاصة بك فلا يستعمله أحد غيرك: كل توقيع يحتاج إلى وجهك أو بصمتك أو رمزك.'
              )}
            </p>
            {data.passkeys ? null : (
              <p className="help">
                <Icon name="info" size={15} />
                {t(
                  'First add a passkey on this device under Sign-in and security.',
                  'أضف أولاً مفتاح مرور على هذا الجهاز ضمن «الدخول والأمان».'
                )}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              data-sig-edit=""
              disabled={!(data.passkeys && passkeysSupported())}
              onClick={edit}
            >
              {t('Set up my signature', 'إعداد توقيعي')}
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function SignatureForm({ me, done }) {
  const pad = useRef(null),
    [empty, setEmpty] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const drawing = pad.current.path();
      await api('account/signature', 'POST', {
        drawing,
        title: e.currentTarget.elements.title.value,
        signature: await sign({ type: 'setup', drawing })
      });
      closeOverlays();
      toast(
        t('Signature saved', 'حُفظ التوقيع'),
        t('You can now sign certificates and letters.', 'يمكنك الآن توقيع الشهادات والرسائل.'),
        'success'
      );
      done();
    } catch (err) {
      setError(passkeyMessage(err, t));
      setBusy(false);
    }
  };
  return (
    <form className="sig-form" data-sig-form="" onSubmit={submit}>
      <p className="help">
        {t(
          'Sign inside the box with your finger, a pen or the mouse, as you sign on paper.',
          'وقّع داخل الإطار بإصبعك أو بقلم أو بالفأرة، كما توقّع على الورق.'
        )}
      </p>
      <div className="sig-pad-wrap">
        <SignaturePad
          ref={pad}
          className="sig-pad"
          role="img"
          aria-label={t('Signature pad', 'لوحة التوقيع')}
          onDraw={() => setEmpty(pad.current.empty())}
        >
          <line x1="24" x2="376" y1="112" y2="112" />
        </SignaturePad>
        <button type="button" className="btn btn-ghost btn-dense" data-sig-clear="" onClick={() => pad.current.clear()}>
          {t('Clear', 'مسح')}
        </button>
      </div>
      <label className="formrow">
        <span className="label">{t('Title under your name', 'الصفة تحت اسمك')}</span>
        <input
          className="input"
          name="title"
          maxLength="80"
          defaultValue={me?.title || ''}
          placeholder={t('Parish priest', 'كاهن الرعية')}
        />
      </label>
      <p className="help">
        <Icon name="lock" size={15} />
        {t(
          'Saving asks for your face, fingerprint or PIN: the signature is then kept with that passkey.',
          'يطلب الحفظ وجهك أو بصمتك أو رمزك: ثم يُحفظ التوقيع مع مفتاح المرور هذا.'
        )}
      </p>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={empty || busy}>
        {t('Save my signature', 'حفظ توقيعي')}
      </button>
    </form>
  );
}

/* Passkeys on this account: added from the device being used, each removable. */
const deviceName = () => {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : t('This device', 'هذا الجهاز');
};

const day = value => {
  const d = new Date(value);
  return Number.isNaN(+d) ? '' : new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-GB', { dateStyle: 'medium' }).format(d);
};

function Passkeys({ changed }) {
  const [list, setList] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState('');
  const supported = passkeysSupported();
  useEffect(() => {
    if (supported)
      listPasskeys().then(
        r => {
          setList(r.passkeys);
          setBusy('');
        },
        e => setError(e.message)
      );
  }, [round]);
  const intro = (
    <>
      <h4>{t('Passkeys', 'مفاتيح المرور')}</h4>
      <p className="help">
        {t(
          'Sign in with this device’s face, fingerprint or PIN instead of your password. Each device keeps its own passkey.',
          'ادخل بوجهك أو ببصمتك أو برمز جهازك بدلاً من كلمة المرور. لكل جهاز مفتاح مروره.'
        )}
      </p>
    </>
  );
  if (!supported)
    return (
      <>
        {intro}
        <p className="help">{t('This browser cannot use passkeys.', 'لا يدعم هذا المتصفح مفاتيح المرور.')}</p>
      </>
    );
  if (error)
    return (
      <>
        {intro}
        <p className="help-error">{error}</p>
      </>
    );
  if (!list) return intro;
  const add = async () => {
    setBusy('add');
    try {
      await addPasskey(deviceName());
      toast(
        t('Passkey added', 'أُضيف مفتاح المرور'),
        t('Next time, choose “Sign in with a passkey”.', 'في المرة المقبلة، اختر «الدخول بمفتاح مرور».'),
        'success'
      );
      setRound(n => n + 1);
      changed();
    } catch (e) {
      toast(t('Could not add the passkey', 'تعذّرت إضافة مفتاح المرور'), passkeyMessage(e, t), 'danger');
      setBusy('');
    }
  };
  const remove = async id => {
    setBusy(id);
    try {
      await removePasskey(id);
      setRound(n => n + 1);
      changed();
    } catch (e) {
      toast(t('Could not remove the passkey', 'تعذّرت إزالة مفتاح المرور'), e.message, 'danger');
      setBusy('');
    }
  };
  return (
    <>
      {intro}
      {list.length ? (
        <ul className="passkey-list">
          {list.map(k => (
            <li key={k.id}>
              <span>
                <b>{k.name}</b>
                <small>
                  {t('Added', 'أُضيف')} {day(k.created_at)}
                  {k.last_used_at ? ` · ${t('last used', 'آخر استخدام')} ${day(k.last_used_at)}` : ''}
                </small>
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                data-remove-passkey={k.id}
                disabled={busy === k.id}
                onClick={() => remove(k.id)}
              >
                {t('Remove', 'إزالة')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="btn btn-secondary" data-add-passkey="" disabled={busy === 'add'} onClick={add}>
        {t('Add a passkey on this device', 'أضف مفتاح مرور على هذا الجهاز')}
      </button>
    </>
  );
}
