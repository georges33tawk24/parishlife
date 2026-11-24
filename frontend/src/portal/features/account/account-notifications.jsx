/* Purpose: "How ParishLife reaches you" on My account: email, push notifications on this device, and WhatsApp, each
   shown only when this site has it set up (GET notifications/channels).
   Main members: Reach (the panel), WhatsAppForm (number, then the code it receives).
   Notices and parish announcements always stay in ParishLife; these channels send a copy with a link to sign in.
   Email goes only to a confirmed address. Push is per device and asks the browser's permission. WhatsApp needs the
   number proven with a code; proving it turns WhatsApp on, removing it turns it off. */
import { useEffect, useState } from 'react';
import {
  loadChannels,
  saveChannel,
  pushSupported,
  pushOnThisDevice,
  enablePush,
  disablePush,
  startWhatsApp,
  confirmWhatsApp,
  removeWhatsApp,
  sendTest
} from '../../model/notify.js';
import { api } from '../../model/api.js';
import { t } from '../../../lib/i18n.js';
import { toast } from '../../ui/ui.jsx';

function WhatsAppForm({ channels, done }) {
  const [phone, setPhone] = useState(channels.whatsAppPhone || ''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(channels.whatsAppStatus === 'Pending'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const run = async work => {
    setBusy(true);
    setError('');
    try {
      done(await work());
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return (
    <div className="formrow" data-whatsapp-form="">
      <label className="formrow">
        <span className="label">{t('WhatsApp number (with country code)', 'رقم واتساب (مع رمز البلد)')}</span>
        <input
          className="input"
          dir="ltr"
          inputMode="tel"
          placeholder="+961 3 123 456"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy || !phone.trim()}
        onClick={() =>
          run(async () => {
            const result = await startWhatsApp(phone);
            setSent(true);
            return result;
          })
        }
      >
        {sent ? t('Send a new code', 'أرسل رمزاً جديداً') : t('Send a code on WhatsApp', 'أرسل رمزاً عبر واتساب')}
      </button>
      {sent ? (
        <>
          <label className="formrow">
            <span className="label">{t('Code received on WhatsApp', 'الرمز الذي وصلك عبر واتساب')}</span>
            <input
              className="input"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength="6"
              value={code}
              onChange={e => setCode(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || code.trim().length !== 6}
            onClick={() => run(() => confirmWhatsApp(code))}
          >
            {t('Confirm the number', 'تأكيد الرقم')}
          </button>
        </>
      ) : null}
      <p className="help-error" role="alert">
        {error}
      </p>
    </div>
  );
}

/* What "Send a test notification" found on each channel ("sent" only when the service accepted it). */
const OUTCOME = outcome =>
  ({
    sent: t('sent', 'أُرسل'),
    'no-device': t('no device turned on', 'لا جهاز مفعّل'),
    'no-address': t('no confirmed email', 'لا بريد مؤكَّد'),
    'no-number': t('no confirmed number', 'لا رقم مؤكَّد'),
    'not-enabled': t('off', 'متوقّف'),
    failed: t('could not be sent, try again later', 'تعذّر الإرسال، حاول لاحقاً')
  })[outcome] || outcome;

export function Reach() {
  const [channels, setChannels] = useState(null),
    [tested, setTested] = useState(null),
    [prefs, setPrefs] = useState(null),
    [here, setHere] = useState(false),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    Promise.all([loadChannels(), api('notifications/preferences'), pushOnThisDevice().catch(() => false)]).then(
      ([c, p, h]) => {
        setChannels(c);
        setPrefs(p);
        setHere(h);
      },
      e => setError(e.message)
    );
  }, []);
  if (error) return <p className="help-error">{error}</p>;
  if (!channels || !prefs || !(channels.email || channels.push || channels.whatsApp)) return null;
  const toggle = async (channel, on) => {
    setBusy(channel);
    try {
      setPrefs(await saveChannel(channel, on));
    } catch (err) {
      toast(t('Not saved', 'لم يُحفظ'), err.message, 'danger');
    }
    setBusy('');
  };
  const pushHere = async on => {
    setBusy('device');
    try {
      setChannels(on ? await enablePush(channels.pushPublicKey) : await disablePush());
      setHere(on);
    } catch (err) {
      toast(
        t('Notifications not turned on', 'لم تُفعَّل الإشعارات'),
        err.code === 'push_permission_denied'
          ? t(
              'This browser blocked notifications for ParishLife. Allow them in the browser’s site settings, then try again.',
              'حظر هذا المتصفح إشعارات ParishLife. اسمح بها من إعدادات الموقع في المتصفح ثم حاول مجدداً.'
            )
          : err.message,
        'danger'
      );
    }
    setBusy('');
  };
  const Switch = ({ channel, label, disabled }) => (
    <label className="formrow" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="checkbox"
        data-channel={channel}
        checked={!!prefs[channel]}
        disabled={disabled || busy === channel}
        onChange={e => toggle(channel, e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
  return (
    <div className="account-passkeys" data-reach="">
      <h4>{t('How ParishLife reaches you', 'كيف يتواصل معك ParishLife')}</h4>
      <p className="help">
        {t(
          'Your notices and parish announcements are always in ParishLife. Here you can also get a short copy with a link to sign in.',
          'إشعاراتك وإعلانات الرعية موجودة دائماً في ParishLife. ويمكنك هنا أن تتلقّى أيضاً نسخة قصيرة مع رابط للدخول.'
        )}
      </p>
      {channels.email ? (
        <>
          <Switch channel="email" label={t('Email', 'البريد الإلكتروني')} disabled={!channels.emailAddressConfirmed} />
          {channels.emailAddressConfirmed ? null : (
            <p className="help">{t('Confirm your email address first.', 'أكّد بريدك الإلكتروني أولاً.')}</p>
          )}
        </>
      ) : null}
      {channels.push ? (
        <>
          <Switch channel="push" label={t('Push notifications', 'الإشعارات الفورية')} />
          {pushSupported() ? (
            <button
              type="button"
              className="btn btn-secondary"
              data-push-device={here ? 'on' : 'off'}
              disabled={busy === 'device' || !prefs.push}
              onClick={() => pushHere(!here)}
            >
              {here
                ? t('Stop notifications on this device', 'أوقف الإشعارات على هذا الجهاز')
                : t('Turn on notifications on this device', 'فعّل الإشعارات على هذا الجهاز')}
            </button>
          ) : (
            <p className="help">
              {t(
                'This browser cannot show notifications. On an iPhone, first add ParishLife to the Home Screen.',
                'لا يستطيع هذا المتصفح عرض الإشعارات. على iPhone، أضف ParishLife أولاً إلى الشاشة الرئيسية.'
              )}
            </p>
          )}
          <p className="help">
            {t(
              `${channels.pushDevices} device(s) receive notifications.`,
              `${channels.pushDevices} جهاز يتلقّى الإشعارات.`
            )}
          </p>
        </>
      ) : null}
      <button
        type="button"
        className="btn btn-secondary"
        data-test-notification=""
        disabled={busy === 'test'}
        onClick={async () => {
          setBusy('test');
          setTested(null);
          try {
            setTested(await sendTest());
            setChannels(await loadChannels()); // a gone device may have been removed
          } catch (err) {
            setTested({ error: err.message });
          }
          setBusy('');
        }}
      >
        {t('Send a test notification', 'أرسل إشعاراً تجريبياً')}
      </button>
      {tested ? (
        <p className="help" role="status" data-test-result="">
          {tested.error ||
            [
              channels.push ? `${t('Push', 'الإشعارات الفورية')}: ${OUTCOME(tested.push)}` : null,
              channels.email ? `${t('Email', 'البريد')}: ${OUTCOME(tested.email)}` : null,
              channels.whatsApp ? `${t('WhatsApp', 'واتساب')}: ${OUTCOME(tested.whatsApp)}` : null,
              t(`${tested.remainingToday} test(s) left today.`, `بقي ${tested.remainingToday} اختبار اليوم.`)
            ]
              .filter(Boolean)
              .join(' · ')}
        </p>
      ) : null}
      {channels.whatsApp ? (
        channels.whatsAppStatus === 'Verified' ? (
          <>
            <Switch channel="whatsApp" label={t('WhatsApp', 'واتساب') + ' · ' + channels.whatsAppPhone} />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy === 'remove'}
              onClick={async () => {
                setBusy('remove');
                try {
                  setChannels(await removeWhatsApp());
                  setPrefs(await api('notifications/preferences'));
                } catch (err) {
                  toast(t('Not removed', 'لم يُحذف'), err.message, 'danger');
                }
                setBusy('');
              }}
            >
              {t('Remove this number', 'احذف هذا الرقم')}
            </button>
          </>
        ) : (
          <WhatsAppForm
            channels={channels}
            done={async next => {
              setChannels(next);
              if (next.whatsAppStatus === 'Verified') {
                setPrefs(await api('notifications/preferences'));
                toast(
                  t('WhatsApp confirmed', 'تم تأكيد واتساب'),
                  t('Notices will also arrive there.', 'ستصلك الإشعارات هناك أيضاً.'),
                  'success'
                );
              }
            }}
          />
        )
      ) : null}
    </div>
  );
}
