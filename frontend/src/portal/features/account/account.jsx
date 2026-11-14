/* My account: the profile (display name, language and the optional personal details) and appearance, how the
   account signs in (password, email, two-factor, passkeys, sessions), my own signature image, my parish records
   (with corrections for office review), requests made before signing in, and the parishes someone follows, with
   the membership request form.
   Routes: GET and PUT auth/profile, POST auth/profile/appearance/preview and /reset, GET auth/me,
   GET auth/mfa/status, GET auth/capabilities, GET/POST account/signature and POST account/signature/remove;
   the parishes use GET me/parishes, POST and DELETE parishes/{id}/follow, PUT parishes/{id}/primary,
   POST parishes/{id}/membership-requests and the public directory.
   The personal details are the account holder's own and visible only to them; they never change a parish record. */
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
  appearanceOf,
  DETAILS,
  loadSignature,
  saveSignature,
  removeSignature,
  requestMembership
} from '../../model/account.js';
import { toParish } from '../../../public/api-data.js';
import { t } from '../../../lib/i18n.js';
import { Drawing, SignaturePad } from '../../ui/signature.jsx';
import { PageHead, Panel, toast, openDrawer, closeOverlays, Icon, Paged } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { SCHEMES, schemeOf, applyTheme } from '../../../lib/theme.js';

const RELATIONSHIP = () => ({ Following: t('Following', 'متابَعة'), Member: t('Member', 'عضو') });
/* The optional personal details shown on the profile form: [field, English label, Arabic label, maximum, direction] */
const DETAIL_FIELDS = [
  ['givenName', 'First name', 'الاسم', 100],
  ['givenNameAr', 'First name in Arabic', 'الاسم بالعربية', 100, 'rtl'],
  ['familyName', 'Last name', 'الشهرة', 100],
  ['familyNameAr', 'Last name in Arabic', 'الشهرة بالعربية', 100, 'rtl'],
  ['town', 'Town', 'البلدة', 200],
  ['townAr', 'Town in Arabic', 'البلدة بالعربية', 200, 'rtl'],
  ['address', 'Address', 'العنوان', 300],
  ['occupation', 'Occupation', 'المهنة', 200]
];

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
        appearance: profile.appearance,
        details: Object.fromEntries(DETAILS.map(k => [k, data.get(k)]))
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
                {DETAIL_FIELDS.map(([k, en, ar, max, dir]) => (
                  <label className="formrow" key={k}>
                    <span className="label">{t(en, ar)}</span>
                    <input className="input" name={k} maxLength={max} dir={dir} defaultValue={profile.details[k]} />
                  </label>
                ))}
              </div>
              <label className="formrow">
                <span className="label">{t('About me', 'نبذة عني')}</span>
                <textarea className="textarea" name="about" maxLength="1000" defaultValue={profile.details.about} />
              </label>
              <p className="help">
                {t(
                  'These details are visible only to you. They do not change what any parish holds about you.',
                  'هذه المعلومات تظهر لك وحدك ولا تغيّر ما تسجّله أي رعية عنك.'
                )}
              </p>
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
              'Follow parishes for updates and choose your primary parish. To become a member, send a request: the parish office checks your identity first.',
              'تابع الرعايا واختر رعيتك الأساسية. لتصبح عضواً أرسل طلباً: يتحقق مكتب الرعية من هويتك أولاً.'
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
                    {a?.relationship === 'Member' ? null : (
                      <button
                        className="btn btn-primary"
                        data-parish={p.id}
                        data-affiliation="request"
                        onClick={() =>
                          openDrawer({
                            title: t('Request membership', 'طلب العضوية') + ' · ' + p.name,
                            body: <MembershipForm parish={p} done={() => api('me/parishes').then(setMine, () => {})} />
                          })
                        }
                      >
                        {t('Request membership', 'طلب العضوية')}
                      </button>
                    )}
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

/* My signature: an image of my handwritten signature, kept privately with my account. It is only an image: it
   signs nothing, and whether it may appear on certificates or letters is still an open decision. */
function MySignature() {
  const [data, setData] = useState(null),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    loadSignature().then(setData, () => setData(null));
  }, [round]);
  if (!data?.eligible) return null;
  const me = data.signature,
    again = () => setRound(n => n + 1);
  const remove = async () => {
    setBusy(true);
    try {
      await removeSignature(data.version);
      toast(t('Signature removed', 'أُزيل التوقيع'), '', 'success');
      again();
    } catch (err) {
      toast(t('Could not remove', 'تعذّرت الإزالة'), err.message, 'danger');
    }
    setBusy(false);
  };
  const edit = () =>
    openDrawer({
      title: t('My signature', 'توقيعي'),
      body: <SignatureForm version={data.version} me={me} done={again} />
    });
  return (
    <Panel title={t('My signature', 'توقيعي')}>
      <div className="sig-panel">
        {me ? (
          <>
            <figure className="sig-card">
              <Drawing path={me.drawing} />
              <figcaption>
                <b>{session.user?.name}</b>
                {me.title || me.titleAr ? <span>{t(me.title || me.titleAr, me.titleAr || me.title)}</span> : null}
              </figcaption>
            </figure>
            <div className="sig-facts">
              <p>
                <Icon name="lock" size={16} />
                {t(
                  'Kept privately with your account. It is an image only and does not sign anything by itself.',
                  'محفوظ بخصوصية مع حسابك. إنه صورة فقط ولا يوقّع شيئاً بنفسه.'
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
                'Draw your handwritten signature once and keep it with your account. Only you can see it here.',
                'ارسم توقيعك اليدوي مرة واحدة واحفظه مع حسابك. لا يراه هنا أحد غيرك.'
              )}
            </p>
            <button type="button" className="btn btn-primary" data-sig-edit="" onClick={edit}>
              {t('Set up my signature', 'إعداد توقيعي')}
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function SignatureForm({ version, me, done }) {
  const pad = useRef(null),
    [empty, setEmpty] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = e.currentTarget.elements;
    try {
      await saveSignature(version, {
        drawing: pad.current.path(),
        title: form.title.value,
        titleAr: form.titleAr.value
      });
      closeOverlays();
      toast(t('Signature saved', 'حُفظ التوقيع'), '', 'success');
      done();
    } catch (err) {
      setError(err.message);
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
        <input className="input" name="title" maxLength="80" defaultValue={me?.title || ''} />
      </label>
      <label className="formrow">
        <span className="label">{t('Title in Arabic', 'الصفة بالعربية')}</span>
        <input className="input" name="titleAr" dir="rtl" maxLength="80" defaultValue={me?.titleAr || ''} />
      </label>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={empty || busy}>
        {t('Save my signature', 'حفظ توقيعي')}
      </button>
    </form>
  );
}

/* Asking a parish office for membership: the office checks identity and links the account to the right person.
   Following stays a separate preference. */
function MembershipForm({ parish, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await requestMembership(parish.id, Object.fromEntries(new FormData(e.currentTarget)));
      closeOverlays();
      toast(
        t('Membership request sent', 'أُرسل طلب العضوية'),
        t('The parish office will review it.', 'سيراجعه مكتب الرعية.'),
        'success'
      );
      done();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  const field = (name, en, ar, props = {}) => (
    <label className="formrow">
      <span className="label">{t(en, ar)}</span>
      <input className="input" name={name} {...props} />
    </label>
  );
  return (
    <form data-membership-form="" onSubmit={submit}>
      <div className="formgrid">
        {field('givenName', 'Given name', 'الاسم', { required: true, maxLength: 100 })}
        {field('familyName', 'Family name', 'الشهرة', { required: true, maxLength: 100 })}
        {field('birthDate', 'Date of birth', 'تاريخ الميلاد', { type: 'date' })}
        {field('contact', 'Phone or email', 'الهاتف أو البريد', { maxLength: 300 })}
        {field('locality', 'Town', 'البلدة', { maxLength: 200 })}
      </div>
      <label className="formrow">
        <span className="label">{t('Note for the office', 'ملاحظة للمكتب')}</span>
        <textarea className="textarea" name="note" maxLength="1000" />
      </label>
      <p className="help">
        {t(
          'The office checks your identity before linking your account to your parish record.',
          'يتحقق المكتب من هويتك قبل ربط حسابك بسجلك في الرعية.'
        )}
      </p>
      <p role="alert" className="help-error">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {t('Send request', 'إرسال الطلب')}
      </button>
    </form>
  );
}
