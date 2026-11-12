/* Purpose: passkeys against ParishLife.Api: signing in with the phone's or computer's own lock (face,
   fingerprint or PIN) instead of a password, and adding, listing and removing a signed-in account's passkeys.
   Main functions: passkeysSupported, signInWithPasskey, listPasskeys, addPasskey, removePasskey, passkeyMessage,
   bytes and text (base64url helpers the signing code still uses).

   Routes (PasskeysController): POST auth/login/passkey/options and auth/login/passkey (anonymous),
   GET auth/passkeys, POST auth/passkeys/registration/options, POST auth/passkeys/registration,
   POST auth/passkeys/{credentialId}/remove (signed in; the three that change a passkey need the current password,
   and the authenticator code when the account has two-factor).
   The API hands the browser the WebAuthn options as a JSON string (optionsJson) with an opaque state to send
   back, and wants the browser's credential back as a JSON string (PublicKeyCredential.toJSON()). Browsers that
   lack parseCreationOptionsFromJSON, parseRequestOptionsFromJSON or toJSON are served by the converters below. */
import { api, newOperationId } from './api.js';

export const bytes = text =>
  Uint8Array.from(
    atob(String(text).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(text).length + 3) % 4)),
    ch => ch.charCodeAt(0)
  );
export const text = buffer =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const passkeysSupported = () =>
  !!(window.PublicKeyCredential && navigator.credentials?.create && navigator.credentials?.get);

/* ---------- WebAuthn JSON ⇄ the browser's objects, for browsers without the built-in helpers ---------- */
const descriptor = c => ({ ...c, id: bytes(c.id) });
export function creationOptions(json) {
  if (window.PublicKeyCredential?.parseCreationOptionsFromJSON)
    return PublicKeyCredential.parseCreationOptionsFromJSON(json);
  return {
    ...json,
    challenge: bytes(json.challenge),
    user: { ...json.user, id: bytes(json.user.id) },
    excludeCredentials: (json.excludeCredentials || []).map(descriptor)
  };
}
export function requestOptions(json) {
  if (window.PublicKeyCredential?.parseRequestOptionsFromJSON)
    return PublicKeyCredential.parseRequestOptionsFromJSON(json);
  return { ...json, challenge: bytes(json.challenge), allowCredentials: (json.allowCredentials || []).map(descriptor) };
}
/* The credential as the JSON the API verifies. */
export function credentialJSON(credential) {
  if (typeof credential.toJSON === 'function') return JSON.stringify(credential.toJSON());
  const r = credential.response,
    response = { clientDataJSON: text(r.clientDataJSON) };
  if (r.attestationObject) {
    response.attestationObject = text(r.attestationObject);
    response.transports = r.getTransports?.() || [];
  } else {
    response.authenticatorData = text(r.authenticatorData);
    response.signature = text(r.signature);
    if (r.userHandle) response.userHandle = text(r.userHandle);
  }
  return JSON.stringify({
    id: credential.id,
    rawId: text(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
    response
  });
}

/* Signs in with a passkey. Returns { account } or, when the account also has two-factor, { twoFactor: challenge }
   to finish with completeTwoFactor (model/api.js). `turnstile` is the bot-check token when the API asks for one. */
export async function signInWithPasskey(turnstile) {
  const ceremony = await api(
    'auth/login/passkey/options',
    'POST',
    {},
    turnstile ? { 'X-Turnstile-Token': turnstile } : {}
  );
  const credential = await navigator.credentials.get({ publicKey: requestOptions(JSON.parse(ceremony.optionsJson)) });
  if (!credential) throw Object.assign(new Error('cancelled'), { name: 'NotAllowedError' });
  let result;
  try {
    result = await api('auth/login/passkey', 'POST', { state: ceremony.state, credential: credentialJSON(credential) });
  } catch (error) {
    if (error.status === 401)
      error.message = 'That passkey did not sign you in. It may be unknown here, or its account is not verified yet.';
    throw error;
  }
  return result?.requiresTwoFactor ? { twoFactor: result.challenge } : { account: result };
}

/* What the API asks for before it changes a sign-in method: the current password and, with two-factor, a code. */
const proof = ({ password, code }) => ({ currentPassword: password, ...(code ? { currentCode: code } : {}) });

export const listPasskeys = () => api('auth/passkeys');

/* Adds a passkey on this device. Returns the new PasskeyDto. */
export async function addPasskey(name, credentials) {
  const ceremony = await api('auth/passkeys/registration/options', 'POST', proof(credentials));
  const credential = await navigator.credentials.create({
    publicKey: creationOptions(JSON.parse(ceremony.optionsJson))
  });
  if (!credential) throw Object.assign(new Error('cancelled'), { name: 'NotAllowedError' });
  return api('auth/passkeys/registration', 'POST', {
    operationId: newOperationId(),
    state: ceremony.state,
    credential: credentialJSON(credential),
    name: String(name || '').slice(0, 100) || null
  });
}

/* Removing a passkey ends every session, this one included (the API's rule): the result says RequiresSignIn. */
export const removePasskey = (id, credentials) =>
  api(`auth/passkeys/${encodeURIComponent(id)}/remove`, 'POST', {
    operationId: newOperationId(),
    ...proof(credentials)
  });

/* The browser's own words when someone closes the passkey window are not for showing. */
export const passkeyMessage = (error, t) =>
  error?.name === 'NotAllowedError' || error?.name === 'AbortError'
    ? t('The passkey request was cancelled or timed out.', 'أُلغي طلب مفتاح المرور أو انتهت مهلته.')
    : error?.name === 'InvalidStateError'
      ? t('This device already has a passkey for your account.', 'لهذا الجهاز مفتاح مرور لحسابك بالفعل.')
      : error?.name === 'SecurityError'
        ? t(
            'Passkeys work only on the ParishLife address itself, over a secure connection.',
            'تعمل مفاتيح المرور على عنوان ParishLife نفسه عبر اتصال آمن فقط.'
          )
        : error?.message || t('The passkey could not be used.', 'تعذّر استخدام مفتاح المرور.');
