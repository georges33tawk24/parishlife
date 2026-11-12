/* Purpose: the account module's connection to the portal's load cycle: the signed-in account's saved appearance.
   Main members: keys (none: an account's profile is not a parish collection), routes (the account page),
   load (reads GET auth/profile and sets the colours and mode the portal paints with), save (nothing to send).

   The profile itself (name, language, colours) is read and saved by the My account page through
   model/account.js with the profile's version. Here it is only loaded after every sign-in and reload so the
   person's own colours apply on every page. The portal's other preferences (PREFS in model/data.js) belong to
   the settings screens and are not account preferences. */
import { session } from '../api.js';
import { loadProfile, themeOf } from '../account.js';

export const keys = [];
export const routes = ['account'];

export async function load() {
  try {
    const profile = await loadProfile();
    session.preferences = { theme: themeOf(profile.appearance), language: profile.preferredLanguage };
  } catch {
    // A restricted sign-in or an acting capacity may not read the personal profile (403), and a failed read
    // must not stop the portal loading: the default colours stay.
    session.preferences = undefined;
  }
}

export const save = async () => ({ unsupported: false, saved: false });
