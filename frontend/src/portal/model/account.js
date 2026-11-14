/* Purpose: the account module's calls to ParishLife.Api (Controllers/Accounts), one function per route, so the
   sign-in screen and My account share them and the check can drive them.
   Main functions: loadCapabilities, featuresOf, requestVerificationCode, confirmVerificationCode, loadProfile,
   saveProfile, previewAppearance, resetAppearance, themeOf, changePassword, beginEmailChange, confirmEmailChange,
   mfaStatus, beginMfa, completeMfa, replaceRecoveryCodes, loadSessions, revokeSession, externalSignInPath,
   pendingExternalChallenge, loadSignature, saveSignature, removeSignature, loadRecords, proposeCorrection, requestMembership,
   myMembershipRequests. DETAILS lists the optional personal profile fields.

   What changes sign-in (password, email, two-factor, passkeys) needs the current password and, when the account
   has two-factor, a current authenticator code: `proof` turns the form's { password, code } into those fields.
   Several of those routes sign the account out afterwards (the result says RequiresSignIn); the screens then send
   the person back to sign-in. Secrets typed here go straight into the request and are not kept. */
import { api, newOperationId } from './api.js';

/* ---------- what this deployment offers (GET auth/capabilities, anonymous) ---------- */
let known = null;
export const loadCapabilities = () =>
  (known ??= api('auth/capabilities').catch(() => {
    known = null; // ask again next time; until then nothing optional is offered
    return {};
  }));
/* The optional sign-in features this deployment really has. External providers are a form post; with the bot check
   on, its token travels as the turnstileToken form field. */
export const featuresOf = c => ({
  passkeys: !!c?.passkeys,
  verification: c?.contactVerificationDelivery === 'ProviderConfigured',
  turnstile: !!c?.turnstile?.enabled,
  external: (c?.externalProviders || []).filter(p => p.available).map(p => p.provider)
});

const checked = turnstile => (turnstile ? { 'X-Turnstile-Token': turnstile } : {});
const proof = ({ password, code } = {}) => ({ currentPassword: password, ...(code ? { currentCode: code } : {}) });

/* ---------- email verification by code (anonymous) ---------- */
export const requestVerificationCode = (email, turnstile) =>
  api('auth/contact-verification', 'POST', { email }, checked(turnstile));
export const confirmVerificationCode = (email, code) =>
  api('auth/contact-verification/confirm', 'POST', { email, code: String(code || '').replace(/\s+/g, '') });

/* ---------- profile and appearance ---------- */
/* AccountAppearanceDto ⇄ the theme the portal paints with ({ scheme, primary, mode }). */
export const themeOf = appearance => ({
  scheme: appearance?.scheme || 'forest',
  mode: appearance?.mode || 'light',
  ...(appearance?.scheme === 'custom' ? { primary: appearance.primaryColor } : {})
});
export const appearanceOf = theme => ({
  mode: theme.mode === 'dark' ? 'dark' : 'light',
  scheme: theme.scheme || 'forest',
  // a preset's colour is the API's own; only a custom scheme sends one
  primaryColor: theme.scheme === 'custom' ? String(theme.primary || '').toUpperCase() : null
});
/* Versioned<AccountProfileDto> → { version, displayName, preferredLanguage, appearance, configured, updatedAt } */
/* The optional personal details: private to the account holder, never an official parish record. Arabic twins are
   typed, never derived from the Latin text. */
export const DETAILS = [
  'givenName',
  'givenNameAr',
  'familyName',
  'familyNameAr',
  'town',
  'townAr',
  'address',
  'occupation',
  'about'
];
const detailsOf = source => Object.fromEntries(DETAILS.map(k => [k, String(source?.[k] ?? '').trim() || null]));
const profileOf = ({ value, version }) => ({
  version,
  details: Object.fromEntries(DETAILS.map(k => [k, value[k] || ''])),
  displayName: value.displayName,
  preferredLanguage: value.preferredLanguage || '',
  appearance: value.appearance,
  configured: !!value.isConfigured,
  updatedAt: value.updatedAt
});
export const loadProfile = async () => profileOf(await api('auth/profile'));
/* Saves display name, language and appearance in one conditional update; returns the profile as stored. */
/* The API replaces every detail as sent, so the stored ones go along unless new ones are given. */
export async function saveProfile(profile, { displayName, preferredLanguage, appearance, details = profile.details }) {
  const result = await api('auth/profile', 'PUT', {
    operationId: newOperationId(),
    version: profile.version,
    displayName,
    preferredLanguage: preferredLanguage || null,
    appearance,
    ...detailsOf(details)
  });
  return { profile: profileOf(result.current), current: result.requestedValuesAreCurrent, status: result.status };
}
/* The API checks the colour and works out readable text, link and focus colours without saving anything. */
export const previewAppearance = appearance => api('auth/profile/appearance/preview', 'POST', appearance);
export async function resetAppearance(profile) {
  const result = await api('auth/profile/appearance/reset', 'POST', {
    operationId: newOperationId(),
    version: profile.version
  });
  return { profile: profileOf(result.current), current: result.requestedValuesAreCurrent, status: result.status };
}

/* ---------- password and email ---------- */
/* Every session ends afterwards, this one included (PasswordChangeResultDto.requiresSignIn). */
export const changePassword = (credentials, newPassword) =>
  api('auth/password', 'POST', { operationId: newOperationId(), ...proof(credentials), newPassword });
/* Step one sends a code to the new address; EmailChangeDto { changeId, newEmail, status, delivery, expiresAt }. */
export const beginEmailChange = (credentials, newEmail) =>
  api('auth/email-change', 'POST', { operationId: newOperationId(), ...proof(credentials), newEmail });
/* Step two proves the code; the account is signed out and signs in with the new address. */
export const confirmEmailChange = (credentials, changeId, code) =>
  api('auth/email-change/confirm', 'POST', {
    operationId: newOperationId(),
    ...proof(credentials),
    changeId,
    code: String(code || '').replace(/\s+/g, '')
  });

/* ---------- two-factor (authenticator app) and recovery codes ---------- */
/* { enabled, recoveryCodesRemaining, pendingEnrollmentExpiresAt, recoverySession } */
export const mfaStatus = () => api('auth/mfa/status');
/* Stage a new authenticator: { enrollmentId, sharedKey, authenticatorUri, expiresAt }. Nothing changes until it is proven. */
export const beginMfa = credentials =>
  api('auth/mfa/enrollment', 'POST', { operationId: newOperationId(), ...proof(credentials) });
/* Prove the staged authenticator with a code from it. `credentials.code` is the code of the authenticator in use
   today (only when two-factor is already on); `authenticatorCode` is the new authenticator's. Returns the
   recovery codes, once, and signs every session out. */
export const completeMfa = (credentials, enrollmentId, authenticatorCode) =>
  api('auth/mfa/enrollment/complete', 'POST', {
    operationId: newOperationId(),
    enrollmentId,
    currentPassword: credentials.password,
    code: String(authenticatorCode || '').replace(/\s+/g, ''),
    ...(credentials.code ? { currentCode: credentials.code } : {})
  });
/* New recovery codes replace the old ones; also signs every session out. */
export const replaceRecoveryCodes = credentials =>
  api('auth/mfa/recovery-codes', 'POST', {
    operationId: newOperationId(),
    currentPassword: credentials.password,
    currentCode: credentials.code
  });

/* ---------- sessions ---------- */
/* AccountSessionDto[]: { id, createdAt, expiresAt, revoked, isCurrent, authenticationMethod, status } */
export const loadSessions = async () => (await api('auth/sessions')) || [];
export const revokeSession = id => api(`auth/sessions/${encodeURIComponent(id)}/revoke`, 'POST');

/* ---------- external sign-in (Google, Microsoft) ---------- */
export const externalSignInPath = provider => `/api/auth/external/${encodeURIComponent(provider)}/sign-in`;
/* A round trip that asked to come back to the portal may leave an authenticator step; the API hands it over once. */
export const pendingExternalChallenge = () => api('auth/external/pending-challenge', 'POST');

/* ---------- my own signature image (private; an image only, it signs nothing) ---------- */
/* { eligible, version, signature: { drawing, title, titleAr, updatedAt } | null } */
export const loadSignature = () => api('account/signature');
export const saveSignature = (version, { drawing, title, titleAr }) =>
  api('account/signature', 'POST', {
    operationId: newOperationId(),
    version: version || null,
    drawing,
    title: String(title || '').trim() || null,
    titleAr: String(titleAr || '').trim() || null
  });
export const removeSignature = version =>
  api('account/signature/remove', 'POST', { operationId: newOperationId(), version });

/* ---------- my parish records: only my own linked person in each parish ---------- */
/* [{ parishId, parishName, personId, givenName, familyName, birthDate, contact, corrections: [{ version, value }] }] */
export const loadRecords = async () => (await api('account/records')) || [];
/* Through the parish's existing office review: fields [{ field, newValue, evidence }], field one of GivenName,
   FamilyName, BirthDate, Contact (names and birth date need evidence). */
export const proposeCorrection = (parishId, fields) =>
  api(`parishes/${encodeURIComponent(parishId)}/profile-corrections`, 'POST', {
    operationId: newOperationId(),
    fields
  });

/* ---------- membership requests (office-reviewed; following never implies membership) ---------- */
export const requestMembership = (parishId, form) =>
  api(`parishes/${encodeURIComponent(parishId)}/membership-requests`, 'POST', {
    operationId: newOperationId(),
    givenName: String(form.givenName || '').trim(),
    familyName: String(form.familyName || '').trim(),
    birthDate: form.birthDate || null,
    contact: String(form.contact || '').trim() || null,
    locality: String(form.locality || '').trim() || null,
    note: String(form.note || '').trim() || null
  });
export const myMembershipRequests = async parishId =>
  (await api(`parishes/${encodeURIComponent(parishId)}/membership-requests/mine`)) || [];
