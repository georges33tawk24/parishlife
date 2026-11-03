/* Signing with a person's own signature (backend/signatures.py): the server names what is to be
   signed and its fingerprint; the person unlocks the passkey their signature is kept with (face,
   fingerprint or PIN), and that passkey signs the fingerprint. */
import { api } from './api.js';
import { bytes, text } from './passkeys.js';

export async function signWith(options) {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: bytes(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: 'required',
      allowCredentials: options.allowCredentials.map(c => ({ ...c, id: bytes(c.id) }))
    }
  });
  const r = credential.response;
  return {
    id: credential.id,
    clientDataJSON: text(r.clientDataJSON),
    authenticatorData: text(r.authenticatorData),
    signature: text(r.signature),
    userHandle: r.userHandle ? text(r.userHandle) : ''
  };
}
/* what: { type: 'certificate', parish, id } | { type: 'letter', parish, request, title, body } | { type: 'setup', drawing } */
export const sign = async what => signWith(await api('sign/options', 'POST', what));
