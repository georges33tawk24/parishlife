/* My account → My appearance: the colours and light or dark mode of the signed-in account's own portal.
   The choice is stored on the account (PUT auth/profile, with the profile's version), not on this device, so it
   follows the person to any device they sign in on: every sign-in reads it back (model/modules/account.js) and
   paints with it. A change is shown at once and saved on its own a moment later (owner, 27 November 2026: a colour
   preference must be remembered without hunting for a button); the Save button saves at once. Preview asks the API
   for the contrast figures without saving (POST auth/profile/appearance/preview); Reset goes back to the default
   (POST auth/profile/appearance/reset).
   Main member: Appearance({ profile, store }), where store(profile) applies and keeps the profile as stored. */
import { useEffect, useRef, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { session } from '../../model/api.js';
import {
  loadProfile,
  saveProfile,
  previewAppearance,
  resetAppearance,
  themeOf,
  appearanceOf
} from '../../model/account.js';
import { Panel, toast } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { SCHEMES, schemeOf, applyTheme, modeOf } from '../../../lib/theme.js';

const appearanceFrom = form => {
  const data = Object.fromEntries(new FormData(form));
  return appearanceOf({ scheme: data.scheme, mode: data.mode, primary: data.primary });
};

export function Appearance({ profile, store }) {
  const theme = themeOf(profile.appearance, profile.configured);
  const [preview, setPreview] = useState(null),
    [status, setStatus] = useState(''),
    [round, setRound] = useState(0); // a reset draws the form again from the stored choice
  /* Saves run one after another, each with the version the previous one returned. */
  const latest = useRef(profile),
    queue = useRef(Promise.resolve()),
    timer = useRef(0);
  latest.current = profile.version === latest.current.version ? latest.current : profile;
  useEffect(() => () => clearTimeout(timer.current), []);
  /* The account's version also moves when it signs in on another device; the choice just made is then sent again
     once on the current version, with the other profile fields as stored now. */
  const onCurrent = async work => {
    try {
      return await work(latest.current);
    } catch (e) {
      if (e.status !== 409 && e.code !== 'write_conflict') throw e;
      latest.current = await loadProfile();
      return work(latest.current);
    }
  };

  const save = form =>
    (queue.current = queue.current.then(async () => {
      setStatus(t('Saving…', 'جارٍ الحفظ…'));
      try {
        const appearance = appearanceFrom(form);
        const result = await onCurrent(now =>
          saveProfile(now, { displayName: now.displayName, preferredLanguage: now.preferredLanguage, appearance })
        );
        latest.current = result.profile;
        store(result.profile);
        setPreview(null);
        setStatus(
          result.current
            ? t(
                'Saved to your account. It is used on every device you sign in on.',
                'حُفظ في حسابك، ويُستعمل على كل جهاز تدخل منه.'
              )
            : t(
                'Something else changed your account meanwhile, so what you see now is what is stored.',
                'غيّر شيء آخر حسابك في الأثناء، فما تراه الآن هو المحفوظ.'
              )
        );
      } catch (e) {
        applyTheme(session.preferences?.theme); // back to what is stored
        setStatus('');
        toast(t('Could not save', 'تعذّر الحفظ'), e.message, 'danger');
      }
    }));
  /* A change shows at once and is saved shortly after, so a colour being dragged is saved once. */
  const changed = e => {
    if (!['scheme', 'mode', 'primary'].includes(e.target.name)) return;
    const form = e.currentTarget;
    if (e.target.name === 'primary') form.querySelector('input[name="scheme"][value="custom"]').checked = true;
    applyTheme(themeOf(appearanceFrom(form)));
    setStatus(t('Not saved yet…', 'لم يُحفظ بعد…'));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(form), 700);
  };
  const submit = e => {
    e.preventDefault();
    clearTimeout(timer.current);
    save(e.currentTarget);
  };
  const showPreview = async form => {
    try {
      const result = await previewAppearance(appearanceFrom(form));
      applyTheme(themeOf(result.appearance));
      setPreview(result);
    } catch (e) {
      toast(t('Could not preview', 'تعذّرت المعاينة'), e.message, 'danger');
    }
  };
  const reset = () => {
    clearTimeout(timer.current);
    queue.current = queue.current.then(async () => {
      try {
        const result = await onCurrent(resetAppearance);
        latest.current = result.profile;
        store(result.profile);
        setPreview(null);
        setRound(n => n + 1);
        setStatus('');
        toast(t('Appearance reset', 'أُعيد المظهر إلى الأصل'), '', 'success');
      } catch (e) {
        toast(t('Could not save', 'تعذّر الحفظ'), e.message, 'danger');
      }
    });
  };

  return (
    <Panel title={t('My appearance', 'المظهر الشخصي')}>
      <p className="help">
        {t(
          'These colors apply only to your dashboard, on every device you sign in on. Parish websites share one public theme.',
          'تُطبّق هذه الألوان على حسابك فقط، على كل جهاز تدخل منه. للمواقع العامة مظهر موحّد.'
        )}
      </p>
      <form data-theme="" key={round} onSubmit={submit} onChange={changed}>
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
          <Select name="mode" defaultValue={modeOf(theme)}>
            <option value="light">{t('Light', 'فاتح')}</option>
            <option value="dark">{t('Dark', 'داكن')}</option>
          </Select>
        </label>
        {preview ? (
          <p className="help" data-preview="">
            {t(
              `Preview, not saved yet. Text on the main color: ${preview.primaryTextContrast.toFixed(1)}:1, links: ${preview.linkContrast.toFixed(1)}:1.`,
              `معاينة غير محفوظة بعد. تباين النص على اللون الأساسي ${preview.primaryTextContrast.toFixed(1)}:1 والروابط ${preview.linkContrast.toFixed(1)}:1.`
            )}
          </p>
        ) : null}
        <p className="help" role="status" data-appearance-status="">
          {status}
        </p>
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
          <button type="button" className="btn btn-ghost" data-reset-appearance="" onClick={reset}>
            {t('Reset to default', 'إعادة إلى الأصل')}
          </button>
        </div>
      </form>
    </Panel>
  );
}
