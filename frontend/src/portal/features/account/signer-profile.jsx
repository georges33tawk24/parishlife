/* Purpose: the name printed under a priest's electronic authorization of certificates and letters
   (GET/PUT /api/me/signer-profile, personal capacity only). Signing itself happens on the letter or
   certificate, with a fresh authenticator code for each act; nothing here signs anything, and no drawn
   signature image is kept by ParishLife.Api.
   Main functions: SignerProfilePanel (on My account, for parish clergy), SignerProfileForm (also used where
   a priest signs before a name is set). Requests-only file, kept in the account folder. */
import { useEffect, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { Panel, toast } from '../../ui/ui.jsx';
import { session } from '../../model/api.js';
import { getSignerProfile, saveSignerProfile } from '../../model/modules/requests.js';

const L = (en, ar) => t(en, ar);

/** Saves the printed name; `profile` is the current one ({ printedName, version }) or null. */
export function SignerProfileForm({ profile, saved }) {
  const [name, setName] = useState(profile?.printedName || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await saveSignerProfile(name.trim(), profile?.version);
      const next = { ...result.value, version: result.version };
      toast(L('Printed name saved', 'حُفظ الاسم المطبوع'), '', 'success');
      saved?.(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="formrow" data-signer-profile="" onSubmit={submit}>
      <label className="label" htmlFor="signer-name">
        {L('Name printed under your authorization', 'الاسم المطبوع تحت توقيعك')}
      </label>
      <input
        id="signer-name"
        className="input"
        minLength="2"
        maxLength="200"
        required
        dir="auto"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      {error ? <p className="help help-error">{error}</p> : null}
      <button className="btn btn-primary btn-dense" type="submit" disabled={busy || name.trim().length < 2}>
        {L('Save', 'حفظ')}
      </button>
    </form>
  );
}

/** On My account, for an account that is a priest in one of its parishes. Hidden when the API does not answer. */
export function SignerProfilePanel() {
  const priest = !!session.parishes?.some(p => p.roles?.includes('priest'));
  const [profile, setProfile] = useState(undefined);
  useEffect(() => {
    if (priest) getSignerProfile().then(setProfile, () => setProfile(false));
  }, [priest]);
  if (!priest) return null;
  if (profile === undefined || profile === false) return null;
  return (
    <Panel title={L('Electronic authorization', 'التوقيع الإلكتروني')}>
      <p className="help">
        {L(
          'Certificates and letters you authorize carry this name, a code anyone can check, and the time. Each authorization needs a fresh code from your authenticator app. Unless the archdiocese has approved an electronic-signature arrangement, the result is for reference only and the wet-signed, sealed paper is the official document.',
          'تحمل الشهادات والرسائل التي توقّعها هذا الاسم ورمزاً يمكن لأي شخص التحقّق منه والوقت. يحتاج كل توقيع إلى رمز جديد من تطبيق المصادقة. ما لم توافق الأبرشية على ترتيب للتوقيع الإلكتروني، تبقى النتيجة للاطّلاع فقط والورقة الموقّعة يدوياً والمختومة هي الوثيقة الرسمية.'
        )}
      </p>
      <SignerProfileForm key={profile?.version || 'new'} profile={profile} saved={setProfile} />
    </Panel>
  );
}
