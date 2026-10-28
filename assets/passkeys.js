import { api } from './api.js';

/* Passkeys: signing in with the phone's or computer's own lock (face, fingerprint or PIN)
   instead of a password. The server checks every signature (backend/sign_in.py). */
const bytes = text => Uint8Array.from(atob(String(text).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(text).length + 3) % 4)), ch => ch.charCodeAt(0));
const text = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const passkeysSupported = () => !!(window.PublicKeyCredential && navigator.credentials?.create);

export async function signInWithPasskey() {
  const options = await api('passkey/options', 'POST', {});
  const credential = await navigator.credentials.get({ publicKey: {
    challenge: bytes(options.challenge), rpId: options.rpId, timeout: options.timeout, userVerification: options.userVerification, allowCredentials: [] } });
  const r = credential.response;
  return api('passkey/login', 'POST', { id: credential.id, clientDataJSON: text(r.clientDataJSON), authenticatorData: text(r.authenticatorData),
    signature: text(r.signature), userHandle: r.userHandle ? text(r.userHandle) : '' });
}

export async function addPasskey(name) {
  const o = await api('account/passkeys/options', 'POST', {});
  const credential = await navigator.credentials.create({ publicKey: { ...o, challenge: bytes(o.challenge), user: { ...o.user, id: bytes(o.user.id) },
    excludeCredentials: o.excludeCredentials.map(c => ({ ...c, id: bytes(c.id) })) } });
  return api('account/passkeys', 'POST', { id: credential.id, clientDataJSON: text(credential.response.clientDataJSON),
    attestationObject: text(credential.response.attestationObject), name });
}
export const listPasskeys = () => api('account/passkeys');
export const removePasskey = id => api('account/passkeys/remove', 'POST', { id });

/* The browser's own words when someone closes the passkey window are not for showing. */
export const passkeyMessage = (error, t) => error?.name === 'NotAllowedError' || error?.name === 'AbortError'
  ? t('The passkey request was cancelled or timed out.', 'أُلغي طلب مفتاح المرور أو انتهت مهلته.')
  : error?.name === 'InvalidStateError' ? t('This device already has a passkey for your account.', 'لهذا الجهاز مفتاح مرور لحسابك بالفعل.')
  : error?.name === 'SecurityError' ? t('Passkeys work only on the ParishLife address itself, over a secure connection.', 'تعمل مفاتيح المرور على عنوان ParishLife نفسه عبر اتصال آمن فقط.')
  : error?.message || t('The passkey could not be used.', 'تعذّر استخدام مفتاح المرور.');
