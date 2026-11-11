/* My account: the profile and appearance, how the account signs in (password, email, two-factor, passkeys,
   sessions), the parishes someone follows, and the parts other modules own (their signature, record
   corrections and guest requests, which stay hidden until their routes are connected).
   Routes: GET and PUT auth/profile, POST auth/profile/appearance/preview and /reset, GET auth/me,
   GET auth/mfa/status, GET auth/capabilities; the parishes use GET me/parishes, POST and DELETE
   parishes/{id}/follow, PUT parishes/{id}/primary and the public directory.
   The API's profile is a display name, a language and the colours; the old form's first and last name, town,
   address, occupation and "about me" have no API field, so they are not shown. */
import { useEffect, useRef, useState } from 'react';
import { changeAccountPassword, changeAccountEmail } from './account-security.jsx';
import { Mfa } from './account-mfa.jsx';
import { Passkeys } from './account-passkeys.jsx';
import { Sessions } from './account-sessions.jsx';
import { GuestLinks } from './guest-links.jsx';
import { RecordCorrections } from '../records/profile-reviews.jsx';
import { api, session, loadSession } from '../../model/api.js';
import {
  loadCapabilities,
  featuresOf,
  loadProfile,
  saveProfile,
  previewAppearance,
  resetAppearance,
  mfaStatus,
  themeOf,
  appearanceOf
} from '../../model/account.js';
import { toParish } from '../../../public/api-data.js';
import { t } from '../../../lib/i18n.js';
import { passkeysSupported, passkeyMessage } from '../../model/passkeys.js';
import { sign } from '../../model/signing.js';
import { Drawing, SignaturePad } from '../../ui/signature.jsx';
import { PageHead, Panel, toast, openDrawer, closeOverlays, Icon, Paged } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { SCHEMES, schemeOf, applyTheme } from '../../../lib/theme.js';

const RELATIONSHIP = () => ({ Following: t('Following', 'متابَعة'), Member: t('Member', 'عضو') });

/* The profile as stored changes what the rest of the portal shows: the name, the colours. */
function applyProfile(profile) {
  if (session.accountUser) session.accountUser.name = profile.displayName;
  if (session.user) session.user.name = profile.displayName;
  session.preferences = { theme: themeOf(profile.appearance), language: profile.preferredLanguage };
  applyTheme(session.preferences.theme);
}
const settled = (result, saved) =>
  result.current
    ? toast(saved, '', 'success')
    : toast(
        saved,
        t(
          'Something else changed your account meanwhile, so what you see now is what is stored.',
          'غيّر شيء آخر حسابك في الأثناء، فما تراه الآن هو المحفوظ.'
        ),
        'info'
      );

export function AccountPage() {
  const [loaded, setLoaded] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [preview, setPreview] = useState(null),
    [mine, setMine] = useState([]);
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
    Promise.all([
      loadProfile(),
      api('auth/me'),
      mfaStatus().catch(() => null), // a restricted sign-in may not read it
      loadCapabilities(),
      api('me/parishes').catch(() => []),
      api('public/parishes').catch(() => null)
    ]).then(
      ([profile, account, mfa, capabilities, parishes, directory]) => {
        const seen = new Set(),
          list = [...(directory?.items || []), ...(directory?.distanceUnavailable || [])]
            .map(toParish)
            .filter(p => !seen.has(p.id) && seen.add(p.id));
        setLoaded({
          profile,
          account,
          mfa,
          features: featuresOf(capabilities),
          directory: list,
          directoryFailed: !directory
        });
        setMine(parishes || []);
      },
      e => setError(e.message)
    );
  }, []);
  const head = (
    <PageHead
      title={t('My account', 'حسابي')}
      sub={t(
        'Your profile, how you sign in, parishes and personal appearance.',
        'ملفك وطريقة دخولك ورعاياك ومظهر حسابك.'
      )}
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
  const { profile, account, mfa, features, directory } = loaded,
    theme = themeOf(profile.appearance);
  const store = (next, message) => {
    applyProfile(next);
    setLoaded(l => ({ ...l, profile: next }));
    setPreview(null);
    return message;
  };
  const appearanceFrom = form => {
    const data = Object.fromEntries(new FormData(form));
    return appearanceOf({ scheme: data.scheme, mode: data.mode, primary: data.primary });
  };
  const run = async (form, work) => {
    const buttons = [...form.querySelectorAll('button')];
    buttons.forEach(b => (b.disabled = true));
    try {
      await work();
    } catch (e) {
      toast(t('Could not save', 'تعذّر الحفظ'), e.message, 'danger');
    } finally {
      buttons.forEach(b => (b.disabled = false));
    }
  };
  const saveName = e => {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    return run(form, async () => {
      const result = await saveProfile(profile, {
        displayName: String(data.get('displayName') || '').trim(),
        preferredLanguage: String(data.get('preferredLanguage') || ''),
        appearance: profile.appearance
      });
      store(result.profile);
      settled(result, t('Saved', 'حُفظ'));
    });
  };
  const saveLook = e => {
    e.preventDefault();
    const form = e.currentTarget;
    return run(form, async () => {
      const result = await saveProfile(profile, {
        displayName: profile.displayName,
        preferredLanguage: profile.preferredLanguage,
        appearance: appearanceFrom(form)
      });
      store(result.profile);
      settled(result, t('Saved', 'حُفظ'));
    });
  };
  const showPreview = form =>
    run(form, async () => {
      const result = await previewAppearance(appearanceFrom(form));
      applyTheme(themeOf(result.appearance));
      setPreview(result);
    });
  const resetLook = form =>
    run(form, async () => {
      const result = await resetAppearance(profile);
      store(result.profile);
      settled(result, t('Appearance reset', 'أُعيد المظهر إلى الأصل'));
    });
  const affiliate = async (parish, action) => {
    setBusy(parish + action);
    try {
      setMine(
        (await (action === 'primary'
          ? api(`parishes/${encodeURIComponent(parish)}/primary`, 'PUT')
          : api(`parishes/${encodeURIComponent(parish)}/follow`, action === 'unfollow' ? 'DELETE' : 'POST'))) || []
      );
      await loadSession();
    } catch (e) {
      toast(t('Could not save', 'تعذّر الحفظ'), e.message, 'danger');
    }
    setBusy('');
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
                'Now choose your parish under My parishes: follow it for its news and events and make it your primary parish.',
                'اختر الآن رعيتك في «رعاياي»: تابعها لتصلك أخبارها ومناسباتها واجعلها رعيتك الأساسية.'
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
          <Panel title={t('My profile', 'ملفي')}>
            <p className="help">
              {t(
                'The name ParishLife shows for your account, and the language you prefer. To correct an official parish record, use My parish records below and submit it for office review.',
                'الاسم الذي يعرضه ParishLife لحسابك واللغة التي تفضّلها. لتصحيح سجل رعوي رسمي، استخدم سجلاتي الرعوية أدناه وأرسله لمراجعة المكتب.'
              )}
            </p>
            <form data-profile="" key={profile.version + 'p'} onSubmit={saveName}>
              <div className="formgrid">
                <label className="formrow">
                  <span className="label">{t('Display name', 'الاسم المعروض')}</span>
                  <input
                    className="input"
                    name="displayName"
                    required
                    maxLength="200"
                    defaultValue={profile.displayName}
                  />
                </label>
                <label className="formrow">
                  <span className="label">{t('Preferred language', 'اللغة المفضلة')}</span>
                  <Select name="preferredLanguage" defaultValue={profile.preferredLanguage}>
                    <option value="">{t('Not set', 'غير محدّدة')}</option>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                    <option value="fr">Français</option>
                  </Select>
                </label>
              </div>
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
            <form data-theme="" key={profile.version + 'a'} onSubmit={saveLook}>
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
              {preview ? (
                <p className="help" role="status" data-preview="">
                  {t(
                    `Preview, not saved yet. Text on the main color: ${preview.primaryTextContrast.toFixed(1)}:1, links: ${preview.linkContrast.toFixed(1)}:1.`,
                    `معاينة غير محفوظة بعد. تباين النص على اللون الأساسي ${preview.primaryTextContrast.toFixed(1)}:1 والروابط ${preview.linkContrast.toFixed(1)}:1.`
                  )}
                </p>
              ) : null}
              <div className="account-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-preview-appearance=""
                  onClick={e => showPreview(e.currentTarget.form)}
                >
                  {t('Preview', 'معاينة')}
                </button>
                <button className="btn btn-primary">{t('Save appearance', 'حفظ المظهر')}</button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  data-reset-appearance=""
                  onClick={e => resetLook(e.currentTarget.form)}
                >
                  {t('Reset to default', 'إعادة إلى الأصل')}
                </button>
              </div>
            </form>
          </Panel>
        </div>
        <Panel title={t('Sign-in and security', 'الدخول والأمان')}>
          <p>
            {t('Username', 'اسم المستخدم')}: <b>{account.username || '—'}</b>
          </p>
          <p>
            {t('Email', 'البريد الإلكتروني')}: <b dir="ltr">{account.email || '—'}</b>{' '}
            <span className="help">
              {account.emailConfirmed ? t('Verified', 'مُتحقّق') : t('Not confirmed by a code', 'غير مؤكّد برمز')}
            </span>
          </p>
          <div className="account-actions">
            <button
              type="button"
              className="btn btn-secondary"
              data-change-password=""
              onClick={() => changeAccountPassword(mfa)}
            >
              {t('Change password', 'تغيير كلمة المرور')}
            </button>
            {features.verification ? (
              <button
                type="button"
                className="btn btn-secondary"
                data-change-email=""
                onClick={() => changeAccountEmail(mfa)}
              >
                {t('Change email', 'تغيير البريد الإلكتروني')}
              </button>
            ) : null}
          </div>
          {features.verification ? null : (
            <p className="help">
              {t(
                'Changing the sign-in email needs a code sent by email, and this deployment has no email delivery set up yet.',
                'يحتاج تغيير بريد الدخول إلى رمز يُرسل بالبريد، ولم يُجهَّز إرسال البريد في هذه النسخة بعد.'
              )}
            </p>
          )}
          <Mfa mfa={mfa} />
          {features.passkeys ? <Passkeys mfa={mfa} key={signature} /> : null}
          <Sessions />
        </Panel>
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
              'Follow parishes for updates and choose your primary parish. Asking to become a member is not connected to the new backend yet.',
              'تابع الرعايا واختر رعيتك الأساسية. طلب العضوية غير مربوط بالخادم الجديد بعد.'
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
          {loaded.directoryFailed ? (
            <p className="help-error">{t('The parish directory could not be loaded.', 'تعذّر تحميل دليل الرعايا.')}</p>
          ) : null}
          <Paged className="account-parishes" data-paginate="">
            {directory.map(p => {
              const a = mine.find(x => x.parishId === p.id),
                name = (p.name + ' ' + p.town).toLowerCase();
              return (
                <article key={p.id} data-name={name} hidden={!name.includes(q)}>
                  <div>
                    <h3>
                      <a href={`public.html?parish=${encodeURIComponent(p.id)}`}>{p.name}</a>
                    </h3>
                    <p>
                      {p.town}
                      {a?.primary ? ' · ' + t('Primary parish', 'الرعية الأساسية') : ''}
                    </p>
                    <small>
                      {a ? RELATIONSHIP()[a.relationship] || a.relationship : t('Not following', 'غير متابَعة')}
                    </small>
                  </div>
                  <div className="account-actions">
                    <button
                      className="btn btn-secondary"
                      data-parish={p.id}
                      data-affiliation={a ? 'unfollow' : 'follow'}
                      disabled={a?.relationship === 'Member' || busy === p.id + (a ? 'unfollow' : 'follow')}
                      onClick={() => affiliate(p.id, a ? 'unfollow' : 'follow')}
                    >
                      {a ? t('Unfollow', 'إلغاء المتابعة') : t('Follow', 'متابعة')}
                    </button>
                    <button
                      className="btn btn-secondary"
                      data-parish={p.id}
                      data-affiliation="primary"
                      disabled={!a || !!a.primary || busy === p.id + 'primary'}
                      onClick={() => affiliate(p.id, 'primary')}
                    >
                      {t('Make primary', 'اختيار كأساسية')}
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
