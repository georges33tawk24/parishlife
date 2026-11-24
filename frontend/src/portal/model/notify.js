/* Purpose: how the signed-in person is reached outside the app: email, push notifications on this device, and WhatsApp.
   Main functions: loadChannels, saveChannel (one on/off choice, keeping the rest of the preferences), pushSupported,
   pushOnThisDevice, enablePush, disablePush, startWhatsApp, confirmWhatsApp, removeWhatsApp, sendTest.
   Routes: GET notifications/channels, GET/PUT notifications/preferences, POST notifications/push-devices(/remove),
   POST notifications/whatsapp(/confirm|/remove), POST notifications/test. A channel the API reports unconfigured is not offered. */
import { api } from './api.js';

/* { email, emailAddressConfirmed, push, pushPublicKey, pushDevices, whatsApp, whatsAppPhone, whatsAppStatus } */
export const loadChannels = () => api('notifications/channels');

/* channel: 'email' | 'push' | 'whatsApp'. The preferences route replaces the whole record, so the current one is read first. */
export async function saveChannel(channel, on) {
  const current = await api('notifications/preferences');
  return api('notifications/preferences', 'PUT', {
    mutedTopics: current?.mutedTopics || [],
    language: current?.language || 'en',
    digestOptional: !!current?.digestOptional,
    [channel]: !!on
  });
}

/* ---------- push on this device ---------- */
export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const fromBase64Url = text => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};
const toBase64Url = buffer =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const registration = async () => {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
};

/* Whether this browser already has a subscription (it may belong to another account on a shared device). */
export async function pushOnThisDevice() {
  if (!pushSupported()) return false;
  const existing = await navigator.serviceWorker.getRegistration();
  return !!(existing && (await existing.pushManager.getSubscription()));
}

/* Asks the browser for permission, subscribes with the site's public key and registers the device. */
export async function enablePush(publicKey) {
  if ((await Notification.requestPermission()) !== 'granted') {
    const error = new Error('denied');
    error.code = 'push_permission_denied';
    throw error;
  }
  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey) }));
  return api('notifications/push-devices', 'POST', {
    endpoint: subscription.endpoint,
    p256dh: toBase64Url(subscription.getKey('p256dh')),
    auth: toBase64Url(subscription.getKey('auth')),
    label: navigator.userAgentData?.platform || null
  });
}

/* Stops notifications to this device: removes it on the API, then unsubscribes the browser. */
export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = reg && (await reg.pushManager.getSubscription());
  if (!subscription) return loadChannels();
  const result = await api('notifications/push-devices/remove', 'POST', { endpoint: subscription.endpoint });
  await subscription.unsubscribe().catch(() => {});
  return result;
}

/* ---------- WhatsApp ---------- */
/* phone: international form with a plus sign. A code arrives on WhatsApp; confirming it turns WhatsApp notices on. */
export const startWhatsApp = phone =>
  api('notifications/whatsapp', 'POST', { phone: String(phone || '').replace(/[\s-]/g, '') });
export const confirmWhatsApp = code =>
  api('notifications/whatsapp/confirm', 'POST', { code: String(code || '').replace(/\s+/g, '') });
export const removeWhatsApp = () => api('notifications/whatsapp/remove', 'POST');

/* ---------- test ---------- */
/* A fixed test message to the caller alone, on every channel they set up (one a minute, five a day):
   { push, email, whatsApp, remainingToday }, each sent | no-device | no-address | no-number | not-enabled | failed. */
export const sendTest = () => api('notifications/test', 'POST');
