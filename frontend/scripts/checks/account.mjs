/* Purpose: checks the account module against an in-memory stand-in for ParishLife.Api's account routes: what the
   deployment offers (capabilities), email codes, the profile and appearance, password and email change,
   two-factor and recovery codes, sessions and passkeys (sign-in and management).
   Main parts: a stand-in for the routes, a fake browser WebAuthn (navigator.credentials), then assertions on
   the exact JSON the module sends and what it loads. Run by `npm run check`. */
import assert from 'node:assert/strict';
import { mockApi, json } from '../mock-api.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let capabilities = {
    passkeys: true,
    externalProviders: [
      { provider: 'google', available: true },
      { provider: 'microsoft', available: false }
    ],
    turnstile: { enabled: false, siteKey: null, header: 'X-Turnstile-Token' },
    contactVerificationDelivery: 'ProviderConfigured'
  },
  profileStatus = 200,
  headers = {};
const profile = {
  version: 'v1',
  value: {
    accountId: 'u',
    displayName: 'Test Account',
    preferredLanguage: 'ar',
    appearance: { mode: 'dark', scheme: 'custom', primaryColor: '#123456' },
    givenNameAr: 'يوسف',
    isConfigured: true,
    updatedAt: '2026-11-01T00:00:00Z'
  }
};
const current = (version, value) => ({ version, value: { ...profile.value, ...value } });

const { sent } = mockApi((method, path, body, options) => {
  headers = options.headers;
  if (path === 'auth/capabilities') return json(200, capabilities);
  if (path === 'auth/profile' && method === 'GET')
    return profileStatus === 200 ? json(200, profile) : json(profileStatus);
  if (path === 'auth/profile' && method === 'PUT')
    return json(200, {
      operationId: body.operationId,
      status: 'Saved',
      requestedValuesAreCurrent: true,
      current: current('v2', {
        displayName: body.displayName,
        preferredLanguage: body.preferredLanguage,
        appearance: { ...body.appearance, primaryColor: body.appearance.primaryColor || '#233B32' }
      })
    });
  if (path === 'auth/profile/appearance/preview')
    return json(200, { appearance: body, primaryTextContrast: 9.5, linkContrast: 7.2, saved: false });
  if (path === 'auth/profile/appearance/reset')
    return json(200, {
      status: 'Saved',
      requestedValuesAreCurrent: true,
      current: current('v3', { appearance: { mode: 'light', scheme: 'forest', primaryColor: '#233B32' } })
    });
  if (path === 'auth/contact-verification')
    return json(202, { status: 'RequestReceived', delivery: 'ProviderConfigured' });
  if (path === 'auth/contact-verification/confirm')
    return json(200, { status: 'Verified', delivery: 'ProviderConfigured' });
  if (path === 'auth/password') return json(200, { status: 'Applied', requiresSignIn: true });
  if (path === 'auth/email-change')
    return json(200, { changeId: 'c1', newEmail: body.newEmail, status: 'Pending', delivery: 'Accepted' });
  if (path === 'auth/email-change/confirm') return json(200, { status: 'Applied', requiresSignIn: true });
  if (path === 'auth/mfa/status')
    return json(200, {
      enabled: true,
      recoveryCodesRemaining: 7,
      pendingEnrollmentExpiresAt: null,
      recoverySession: false
    });
  if (path === 'auth/mfa/enrollment')
    return json(200, {
      enrollmentId: 'e1',
      sharedKey: 'ABCD EFGH',
      authenticatorUri: 'otpauth://totp/x',
      expiresAt: '2026-11-11T10:00:00Z'
    });
  if (path === 'auth/mfa/enrollment/complete')
    return json(200, { enabled: true, recoveryCodes: ['aaaa-bbbb', 'cccc-dddd'], requiresSignIn: true });
  if (path === 'auth/mfa/recovery-codes')
    return json(200, { enabled: true, recoveryCodes: ['eeee-ffff'], requiresSignIn: true });
  if (path === 'auth/sessions')
    return json(200, [{ id: 's1', status: 'Active', isCurrent: true, authenticationMethod: 'pwd' }]);
  if (path === 'auth/sessions/s2/revoke') return json(204);
  if (path === 'auth/login/passkey/options')
    return json(200, {
      state: 'login-state',
      optionsJson: JSON.stringify({
        challenge: 'AQID',
        rpId: 'localhost',
        userVerification: 'preferred',
        allowCredentials: []
      })
    });
  if (path === 'auth/login/passkey')
    return body.state === 'login-state' && body.credential.includes('"id":"cred1"')
      ? json(200, { id: 'u', displayName: 'Test Account', accountVerified: true })
      : json(401);
  if (path === 'auth/passkeys' && method === 'GET')
    return json(200, [
      { id: 'cred1', name: 'Mac', createdAt: '2026-10-01T00:00:00Z', lastUsedAt: null, isBackedUp: true }
    ]);
  if (path === 'auth/passkeys/registration/options')
    return json(200, {
      state: 'reg-state',
      optionsJson: JSON.stringify({
        challenge: 'AQID',
        rp: { id: 'localhost', name: 'ParishLife' },
        user: { id: 'dQ', name: 'u', displayName: 'U' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        excludeCredentials: [{ type: 'public-key', id: 'BAUG' }]
      })
    });
  if (path === 'auth/passkeys/registration') return json(200, { id: 'cred2', name: body.name });
  if (path === 'auth/passkeys/cred1/remove') return json(200, { status: 'Applied', requiresSignIn: true });
  if (path === 'auth/external/pending-challenge')
    return json(200, { accountId: 'u', challenge: 'held', expiresAt: '2026-11-11T10:00:00Z' });
  if (path === 'account/signature' && method === 'GET')
    return json(200, { eligible: true, version: null, signature: null });
  if (path === 'account/signature')
    return json(200, { eligible: true, version: 's1', signature: { ...body, updatedAt: '2026-11-11T10:00:00Z' } });
  if (path === 'account/signature/remove') return json(200, { eligible: true, version: null, signature: null });
  if (path === 'account/records')
    return json(200, [
      { parishId: 'P', parishName: 'Saint Test', personId: 'p1', givenName: 'A', familyName: 'B', corrections: [] }
    ]);
  if (path === 'parishes/P/profile-corrections') return json(200, { id: 'c1', status: 'Pending', fields: body.fields });
  if (path === 'parishes/P/membership-requests') return json(200, { id: 'm1', status: 'Submitted' });
  if (path === 'parishes/P/membership-requests/mine') return json(200, [{ id: 'm1', status: 'Submitted' }]);
});

// a fake browser: no built-in WebAuthn JSON helpers, so the module's own converters are used
const asked = [];
const buffer = (...n) => new Uint8Array(n).buffer;
Object.defineProperty(globalThis, 'window', {
  value: { PublicKeyCredential: function PublicKeyCredential() {} },
  configurable: true
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    credentials: {
      get: async options => (
        asked.push(['get', options]),
        {
          id: 'cred1',
          rawId: buffer(1),
          type: 'public-key',
          response: {
            clientDataJSON: buffer(1, 2),
            authenticatorData: buffer(3),
            signature: buffer(4),
            userHandle: buffer(5)
          },
          getClientExtensionResults: () => ({})
        }
      ),
      create: async options => (
        asked.push(['create', options]),
        {
          id: 'cred2',
          rawId: buffer(2),
          type: 'public-key',
          response: { clientDataJSON: buffer(1), attestationObject: buffer(9), getTransports: () => ['internal'] },
          getClientExtensionResults: () => ({})
        }
      )
    }
  }
});

const account = await import('../../src/portal/model/account.js');
const passkeys = await import('../../src/portal/model/passkeys.js');
const { session } = await import('../../src/portal/model/api.js');
const { MODULES } = await import('../../src/portal/model/modules/index.js');
const accountModule = MODULES.find(m => m.routes.includes('account'));
const last = () => sent[sent.length - 1];

// what the deployment offers
let f = account.featuresOf(await account.loadCapabilities());
assert.deepEqual(f, { passkeys: true, verification: true, turnstile: false, external: ['google'] });
assert.deepEqual(
  account.featuresOf({ ...capabilities, turnstile: { enabled: true }, contactVerificationDelivery: 'NotConfigured' }),
  { passkeys: true, verification: false, turnstile: true, external: ['google'] },
  'with the bot check on, external sign-in is still offered (its token rides in the form); with no provider, no email codes'
);
assert.deepEqual(account.featuresOf(null), { passkeys: false, verification: false, turnstile: false, external: [] });

// the module: the saved appearance becomes the portal's colours; a refused or failed read leaves the defaults
assert.ok(accountModule && accountModule.keys.length === 0);
await accountModule.load();
assert.deepEqual(session.preferences.theme, { scheme: 'custom', mode: 'dark', primary: '#123456' });
profileStatus = 403;
await accountModule.load();
assert.equal(session.preferences, undefined);
profileStatus = 200;
assert.deepEqual(await accountModule.save(), { unsupported: false, saved: false });

// the profile: one conditional update with the version; presets send no colour of their own
const loaded = await account.loadProfile();
assert.equal(loaded.version, 'v1');
assert.equal(loaded.displayName, 'Test Account');
let saved = await account.saveProfile(loaded, {
  displayName: 'New Name',
  preferredLanguage: '',
  appearance: account.appearanceOf({ scheme: 'navy', mode: 'light' })
});
assert.deepEqual(Object.keys(last()[2]).sort(), [
  'about',
  'address',
  'appearance',
  'displayName',
  'familyName',
  'familyNameAr',
  'givenName',
  'givenNameAr',
  'occupation',
  'operationId',
  'preferredLanguage',
  'town',
  'townAr',
  'version'
]);
assert.equal(last()[2].givenNameAr, 'يوسف', 'the stored details travel with a name-only save');
assert.equal(last()[2].town, null, 'an empty detail is sent as null, never copied from the other language');
await account.saveProfile(loaded, {
  displayName: 'New Name',
  preferredLanguage: '',
  appearance: account.appearanceOf({ scheme: 'navy', mode: 'light' }),
  details: { givenName: ' Youssef ', givenNameAr: '', about: 'line one\nline two' }
});
assert.deepEqual(
  [last()[2].givenName, last()[2].givenNameAr, last()[2].about, last()[2].familyName],
  ['Youssef', null, 'line one\nline two', null]
);
assert.match(last()[2].operationId, uuid);
assert.equal(last()[2].version, 'v1');
assert.equal(last()[2].preferredLanguage, null);
assert.deepEqual(last()[2].appearance, { mode: 'light', scheme: 'navy', primaryColor: null });
assert.equal(saved.profile.version, 'v2');
assert.equal(saved.current, true);
await account.saveProfile(loaded, {
  displayName: 'New Name',
  preferredLanguage: 'en',
  appearance: account.appearanceOf({ scheme: 'custom', mode: 'dark', primary: '#abcdef' })
});
assert.deepEqual(last()[2].appearance, { mode: 'dark', scheme: 'custom', primaryColor: '#ABCDEF' });
const look = await account.previewAppearance(account.appearanceOf({ scheme: 'teal', mode: 'light' }));
assert.equal(look.primaryTextContrast, 9.5);
assert.equal(last()[1], 'auth/profile/appearance/preview');
const reset = await account.resetAppearance(loaded);
assert.deepEqual(Object.keys(last()[2]).sort(), ['operationId', 'version']);
assert.deepEqual(account.themeOf(reset.profile.appearance), { scheme: 'forest', mode: 'light' });

// email codes: the bot-check token travels in its header, the code is stripped of spaces
await account.requestVerificationCode('a@b.org', 'tok');
assert.deepEqual(last(), ['POST', 'auth/contact-verification', { email: 'a@b.org' }]);
assert.equal(headers['X-Turnstile-Token'], 'tok');
await account.requestVerificationCode('a@b.org');
assert.equal(headers['X-Turnstile-Token'], undefined);
await account.confirmVerificationCode('a@b.org', '123 456');
assert.deepEqual(last(), ['POST', 'auth/contact-verification/confirm', { email: 'a@b.org', code: '123456' }]);

// password and email: fresh proof, an operation id, the code only when there is one
await account.changePassword({ password: 'old-password-1234', code: '' }, 'brand-new-password-1');
assert.deepEqual(Object.keys(last()[2]).sort(), ['currentPassword', 'newPassword', 'operationId']);
await account.changePassword({ password: 'old-password-1234', code: '654321' }, 'brand-new-password-1');
assert.equal(last()[2].currentCode, '654321');
const change = await account.beginEmailChange({ password: 'p', code: '111111' }, 'new@b.org');
assert.equal(last()[1], 'auth/email-change');
assert.deepEqual([last()[2].newEmail, last()[2].currentPassword, last()[2].currentCode], ['new@b.org', 'p', '111111']);
await account.confirmEmailChange({ password: 'p', code: '' }, change.changeId, '999 888');
assert.deepEqual(
  [last()[1], last()[2].changeId, last()[2].code, 'currentCode' in last()[2]],
  ['auth/email-change/confirm', 'c1', '999888', false]
);

// two-factor: staged enrollment, then the new authenticator's code with the current proof
assert.equal((await account.mfaStatus()).recoveryCodesRemaining, 7);
const staged = await account.beginMfa({ password: 'p', code: '111111' });
assert.equal(staged.enrollmentId, 'e1');
const codes = await account.completeMfa({ password: 'p', code: '111111' }, 'e1', '222 222');
assert.deepEqual(
  [last()[2].enrollmentId, last()[2].currentPassword, last()[2].code, last()[2].currentCode],
  ['e1', 'p', '222222', '111111']
);
assert.deepEqual(codes.recoveryCodes, ['aaaa-bbbb', 'cccc-dddd']);
await account.replaceRecoveryCodes({ password: 'p', code: '333333' });
assert.deepEqual(
  [last()[1], last()[2].currentPassword, last()[2].currentCode],
  ['auth/mfa/recovery-codes', 'p', '333333']
);

// sessions
assert.equal((await account.loadSessions())[0].isCurrent, true);
await account.revokeSession('s2');
assert.deepEqual(last(), ['POST', 'auth/sessions/s2/revoke', undefined]);

// passkey sign-in: options (with the bot-check token), the browser's assertion, then the account
assert.equal(passkeys.passkeysSupported(), true);
const outcome = await passkeys.signInWithPasskey('tok');
assert.equal(headers['X-Turnstile-Token'], undefined, 'the login request itself carries no bot-check header');
assert.equal(outcome.account.id, 'u');
const [, request] = asked.find(a => a[0] === 'get');
assert.ok(request.publicKey.challenge instanceof Uint8Array, 'the challenge reaches the browser as bytes');
assert.deepEqual([...request.publicKey.challenge], [1, 2, 3]);
const loginBody = sent.find(s => s[1] === 'auth/login/passkey')[2];
assert.deepEqual(Object.keys(loginBody).sort(), ['credential', 'state']);
const assertion = JSON.parse(loginBody.credential);
assert.equal(assertion.id, 'cred1');
assert.equal(assertion.response.userHandle, 'BQ');
assert.equal(assertion.response.clientDataJSON, 'AQI');

// passkey management: proof first, then the attestation with an operation id and a name; removal ends sessions
assert.equal((await passkeys.listPasskeys())[0].id, 'cred1');
const added = await passkeys.addPasskey('My Mac', { password: 'p', code: '' });
assert.equal(added.id, 'cred2');
const opts = sent.find(s => s[1] === 'auth/passkeys/registration/options')[2];
assert.deepEqual(opts, { currentPassword: 'p' });
const [, creation] = asked.find(a => a[0] === 'create');
assert.deepEqual([...creation.publicKey.user.id], [117]);
assert.deepEqual([...creation.publicKey.excludeCredentials[0].id], [4, 5, 6]);
const registration = sent.find(s => s[1] === 'auth/passkeys/registration')[2];
assert.deepEqual(Object.keys(registration).sort(), ['credential', 'name', 'operationId', 'state']);
assert.match(registration.operationId, uuid);
assert.equal(JSON.parse(registration.credential).response.attestationObject, 'CQ');
assert.equal((await passkeys.removePasskey('cred1', { password: 'p', code: '123456' })).requiresSignIn, true);
assert.deepEqual(
  [last()[1], last()[2].currentPassword, last()[2].currentCode, uuid.test(last()[2].operationId)],
  ['auth/passkeys/cred1/remove', 'p', '123456', true]
);

// an unknown passkey says so in plain words
try {
  const real = globalThis.navigator.credentials.get;
  globalThis.navigator.credentials.get = async () => ({ ...(await real({})), id: 'other' });
  await passkeys.signInWithPasskey();
  assert.fail('should have been refused');
} catch (error) {
  assert.equal(error.status, 401);
  assert.match(error.message, /did not sign you in/);
}

// a provider round trip back to the portal: the held authenticator step is fetched once, as a POST
assert.equal((await account.pendingExternalChallenge()).challenge, 'held');
assert.deepEqual(last(), ['POST', 'auth/external/pending-challenge', undefined]);

// my own signature image: first save without a version, removal with it; nothing about passkeys or signing
assert.equal((await account.loadSignature()).signature, null);
const sig = await account.saveSignature(null, { drawing: 'M1 2L3 4', title: ' Priest ', titleAr: '' });
assert.deepEqual(Object.keys(last()[2]).sort(), ['drawing', 'operationId', 'title', 'titleAr', 'version']);
assert.deepEqual([last()[2].version, last()[2].title, last()[2].titleAr], [null, 'Priest', null]);
await account.removeSignature(sig.version);
assert.deepEqual([last()[1], last()[2].version], ['account/signature/remove', 's1']);
assert.match(last()[2].operationId, uuid);

// my parish records, and corrections through the parish's own office review
assert.equal((await account.loadRecords())[0].personId, 'p1');
await account.proposeCorrection('P', [{ field: 'Contact', newValue: 'x@y.org', evidence: null }]);
assert.deepEqual(Object.keys(last()[2]).sort(), ['fields', 'operationId']);
assert.equal(last()[1], 'parishes/P/profile-corrections');

// the membership request form
await account.requestMembership('P', {
  givenName: ' Rita ',
  familyName: 'Haddad',
  birthDate: '',
  contact: '',
  note: 'Hi'
});
assert.deepEqual(last(), [
  'POST',
  'parishes/P/membership-requests',
  {
    operationId: last()[2].operationId,
    givenName: 'Rita',
    familyName: 'Haddad',
    birthDate: null,
    contact: null,
    locality: null,
    note: 'Hi'
  }
]);
assert.equal((await account.myMembershipRequests('P'))[0].status, 'Submitted');

console.log(
  'account: capabilities, email codes, profile and details, security changes, passkeys, sessions, signature image, parish records, membership requests ok'
);
