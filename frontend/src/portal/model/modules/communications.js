/* Purpose: the Communications module's connection to ParishLife.Api: broadcasts and their templates,
   notices (announcements), the notification bell, the parish website's sections and prayer intentions,
   plus the inbox calls the inbox screens make directly.
   Main members: keys, routes, load, save (what the portal's data layer calls); SECTIONS (the website
   sections the editor offers); and the workflow calls the screens use (saveBroadcast, broadcastAction,
   saveTemplate, templateAction, saveNotice, noticeAction, saveWebsiteDraft, websiteAction,
   decideIntention, listMinistries, the inbox calls and the exact-message review calls).

   What the portal calls each collection:
     MESSAGES       the parish's broadcasts (staff only), one per BroadcastDto
     TEMPLATES      broadcast templates (staff only)
     NOTICES        announcements (staff only)
     NOTIFICATIONS  the account's in-app notices, as the bell expects them:
                    [icon, [en, ar], [when, when], link, unread, id]
     CONTENT        the website sections by the editor's key: the live revision and the one being worked on
     PRAYERS        prayer intentions (priests only)
   Everything here only records what the API stored. External delivery (email, SMS, push, WhatsApp) has no
   provider behind the API, so nothing here says that anything was sent outside the app. Only the
   notification-read change goes through save(); every other change is a workflow call from a screen,
   followed by hydrate(). Any other edit to these collections is undone and reported. */
import { api, newOperationId } from '../api.js';

export const keys = ['MESSAGES', 'TEMPLATES', 'NOTICES', 'NOTIFICATIONS', 'CONTENT', 'PRAYERS'];
export const routes = ['inbox', 'mymessages', 'messaging', 'notices', 'portal'];

const enc = encodeURIComponent;
const base = id => `parishes/${enc(id)}`;

/* The sections of the parish website the editor offers: the editor's key and the API's section key.
   The public site reads the same keys (it ignores case and punctuation). */
export const SECTIONS = [
  ['welcome', 'welcome'],
  ['history', 'history'],
  ['massTimes', 'mass-times'],
  ['contact', 'contact'],
  ['sacraments', 'sacraments']
];
export const LANGUAGES = ['en', 'fr', 'ar'];

/* Priests hold every office permission; other accounts need the capability. The API decides in the end. */
export const can = (parish, capability) =>
  !!parish?.roles?.includes('priest') || !!parish?.capabilities?.includes(capability);

/* "Not allowed here" and "not there" leave a collection empty. */
const soft = promise => promise.catch(e => (e.status === 403 || e.status === 404 ? null : Promise.reject(e)));

/* ---------- projections ---------- */

const lower = s => String(s || '').toLowerCase();

/* BroadcastDto (with its version) → the portal's message row */
const toMessage = ({ value: b, version }) => ({
  id: b.id,
  version,
  subject: b.title,
  subjectAr: b.title,
  body: b.body,
  language: b.language,
  audience: b.audience,
  ministryId: b.ministryId || null,
  templateId: b.templateId || null,
  status: lower(b.status), // draft, approved, sent, cancelled
  channels: b.channels || [],
  reach: b.recipientCount,
  skipped: b.skippedByPreferenceCount,
  when: b.sentAt || b.approvedAt || '',
  updatedBy: b.updatedBy,
  approvedBy: b.approvedBy || null,
  sentBy: b.sentBy || null,
  cancelReason: b.cancelReason || null
});

/* BroadcastTemplateDto (with its version) → the portal's template */
const toTemplate = ({ value: t, version }) => ({
  id: t.id,
  version,
  name: t.name,
  ar: t.name,
  title: t.title,
  body: t.body,
  language: t.language,
  status: lower(t.status), // draft, approved, retired
  updatedBy: t.updatedBy,
  updatedAt: t.updatedAt,
  approvedBy: t.approvedBy || null
});

/* AnnouncementDto (with its version, when staff read it) → the portal's notice */
const toNotice = ({ value: a, version }) => ({
  id: a.id,
  version: version || null,
  title: a.title,
  ar: a.title,
  body: a.body,
  category: a.category || '',
  language: a.language,
  visibility: a.visibility, // Public, Members or Ministry
  ministryId: a.ministryId || null,
  pinned: !!a.pinned,
  expiresAt: a.expiresAt || null,
  status: lower(a.status), // draft, published, withdrawn
  at: a.publishedAt ? a.publishedAt.slice(0, 10) : '',
  publishedAt: a.publishedAt || null
});

/* PrayerIntentionDto (with its version) → the portal's prayer request */
const INTENTION_STATUS = {
  Received: 'awaiting-approval',
  PublishedAnonymous: 'approved',
  PublishedIdentified: 'approved',
  KeptPrivate: 'private',
  Declined: 'declined'
};
const toPrayer = ({ value: p, version }) => ({
  id: p.id,
  version,
  body: p.text,
  bodyAr: p.text,
  displayName: p.displayName || '',
  requested: p.requestedVisibility || '', // ClergyPrivate, AnonymousPublic or IdentifiedPublic
  vis: p.requestedVisibility === 'ClergyPrivate' ? 'private' : 'moderated',
  status: INTENTION_STATUS[p.status] || lower(p.status),
  apiStatus: p.status,
  at: p.submittedAt ? p.submittedAt.slice(0, 10) : ''
});

/* WebsiteSectionDto → what the editor needs: the live revision, the one being worked on, and the text to show.
   `texts` is the working copy when there is one, otherwise the live text, by language ({ title, body }). */
const toSection = dto => {
  const live = dto.published || null,
    pending = dto.pending || null;
  return {
    key: dto.key,
    status: dto.status, // Draft, Published or Unpublished
    unpublishReason: dto.unpublishReason || null,
    live,
    pending,
    texts: (pending || live)?.texts || {}
  };
};

/* NotificationDto → the bell's tuple. A notice's link is an API path, not a portal page, so only the
   topics whose page is known get a link; the others show without one. */
const bellIcon = n => (n.topic === 'inbox.message' ? 'msg' : 'bell');
const bellLink = (n, parish) =>
  n.topic === 'inbox.message' ? (parish?.effectiveRole === 'member' ? '#/mymessages' : '#/inbox') : '';
const when = iso => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ['', ''];
  const at = locale =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Beirut' }).format(d);
  return [at('en-GB'), at('ar')];
};
const toBell = (n, parish) => [
  bellIcon(n),
  [n.title, n.title],
  when(n.createdAt),
  bellLink(n, parish),
  n.status === 'Unread',
  n.id
];

/* Pages of the notifications feed ({ items, continuationToken }, asked for with size and cursor). */
async function notifications(limit = 200) {
  const items = [];
  let cursor = '';
  do {
    const page = await api(`notifications?size=50${cursor ? `&cursor=${enc(cursor)}` : ''}`);
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}

/* ---------- load ---------- */

export async function load(parish, d) {
  const staff = can(parish, 'communications.manage'),
    editor = can(parish, 'publishing.manage'),
    priest = !!parish.roles?.includes('priest');
  const p = base(parish.id);
  const [broadcasts, templates, notices, sections, intentions, feed] = await Promise.all([
    staff ? soft(api(`${p}/broadcasts`)) : null,
    staff ? soft(api(`${p}/broadcast-templates`)) : null,
    staff ? soft(api(`${p}/announcements`)) : null,
    editor ? soft(api(`${p}/website/sections`)) : null,
    priest ? soft(api(`${p}/prayer-intentions`)) : null,
    soft(notifications())
  ]);
  d.MESSAGES = (broadcasts || []).map(toMessage);
  d.TEMPLATES = (templates || []).map(toTemplate);
  d.NOTICES = (notices || []).map(toNotice);
  d.PRAYERS = (intentions || []).map(toPrayer);
  d.CONTENT = {};
  for (const [portalKey, apiKey] of SECTIONS) {
    const row = (sections || []).find(s => s.value.key === apiKey);
    if (row) d.CONTENT[portalKey] = toSection(row.value);
  }
  d.NOTIFICATIONS = (feed || [])
    .filter(n => n.status !== 'Archived' && (!n.parishId || n.parishId === parish.id))
    .map(n => toBell(n, parish));
}

/* ---------- save ---------- */

/* Marking a notification read is the one change made by editing the collection. Everything else goes
   through the workflow calls below, so any other change to these collections cannot be saved. */
export async function save(before, now) {
  const changed = k => JSON.stringify(before[k]) !== JSON.stringify(now[k]);
  let unsupported = ['MESSAGES', 'TEMPLATES', 'NOTICES', 'CONTENT', 'PRAYERS'].some(changed),
    saved = false;
  if (changed('NOTIFICATIONS')) {
    const was = new Map((before.NOTIFICATIONS || []).map(n => [n[5], n]));
    if ((now.NOTIFICATIONS || []).length !== was.size) unsupported = true;
    for (const n of now.NOTIFICATIONS || []) {
      const old = was.get(n[5]);
      if (!old) unsupported = true;
      else if (old[4] && !n[4]) {
        await api(`notifications/${enc(n[5])}/state`, 'POST', { status: 'Read' });
        saved = true;
      } else if (JSON.stringify(old) !== JSON.stringify(n)) unsupported = true;
    }
  }
  return { unsupported, saved };
}

/* ---------- broadcasts and templates ---------- */

/* A new broadcast draft, or an edit of a draft (with the version the API returned). A template id copies
   an approved template's wording; otherwise the title, body and language are sent. */
export function saveBroadcast(parishId, b) {
  const body = {
    operationId: newOperationId(),
    version: b.id ? b.version : undefined,
    audience: b.audience,
    ministryId: b.audience === 'Ministry' ? b.ministryId : null,
    templateId: b.templateId || null,
    ...(b.templateId ? {} : { title: b.title, body: b.body, language: b.language })
  };
  return b.id
    ? api(`${base(parishId)}/broadcasts/${enc(b.id)}`, 'PUT', body)
    : api(`${base(parishId)}/broadcasts`, 'POST', body);
}
/* approve, send or cancel (a reason is required to cancel) against the exact version read */
export const broadcastAction = (parishId, id, version, action, reason) =>
  api(`${base(parishId)}/broadcasts/${enc(id)}/actions`, 'POST', {
    operationId: newOperationId(),
    version,
    action,
    reason: reason || null
  });
export const audiencePreview = (parishId, id) => api(`${base(parishId)}/broadcasts/${enc(id)}/audience-preview`);

export function saveTemplate(parishId, t) {
  const body = {
    operationId: newOperationId(),
    version: t.id ? t.version : undefined,
    name: t.name,
    title: t.title,
    body: t.body,
    language: t.language
  };
  return t.id
    ? api(`${base(parishId)}/broadcast-templates/${enc(t.id)}`, 'PUT', body)
    : api(`${base(parishId)}/broadcast-templates`, 'POST', body);
}
/* approve (by someone other than the author) or retire */
export const templateAction = (parishId, id, version, action) =>
  api(`${base(parishId)}/broadcast-templates/${enc(id)}/actions`, 'POST', {
    operationId: newOperationId(),
    version,
    action
  });

/* The parish's ministries, for choosing an audience: [{ id, name }] */
export async function listMinistries(parishId) {
  const items = [];
  let cursor = '';
  do {
    const page = await soft(api(`${base(parishId)}/ministries?size=100${cursor ? `&cursor=${enc(cursor)}` : ''}`));
    items.push(...(page?.items || []).map(r => r.value));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < 500);
  return items.filter(m => !m.status || lower(m.status) !== 'closed').map(m => ({ id: m.id, name: m.name }));
}

/* ---------- notices (announcements) ---------- */

export function saveNotice(parishId, n) {
  const body = {
    operationId: newOperationId(),
    version: n.id ? n.version : undefined,
    visibility: n.visibility,
    ministryId: n.visibility === 'Ministry' ? n.ministryId : null,
    title: n.title,
    body: n.body,
    category: n.category || null,
    language: n.language,
    pinned: !!n.pinned,
    expiresAt: n.expiresAt || null
  };
  return n.id
    ? api(`${base(parishId)}/announcements/${enc(n.id)}`, 'PUT', body)
    : api(`${base(parishId)}/announcements`, 'POST', body);
}
/* publish or withdraw (a reason is required to withdraw) */
export const noticeAction = (parishId, id, version, action, reason) =>
  api(`${base(parishId)}/announcements/${enc(id)}/actions`, 'POST', {
    operationId: newOperationId(),
    version,
    action,
    reason: reason || null
  });

/* ---------- prayer intentions ---------- */

/* publish-anonymous, publish-identified, keep-private or decline */
export const decideIntention = (parishId, id, version, decision) =>
  api(`${base(parishId)}/prayer-intentions/${enc(id)}/decision`, 'POST', {
    operationId: newOperationId(),
    version,
    decision
  });

/* ---------- website sections ---------- */

/* Saves the working draft. `texts` is { en, fr, ar } with { title, body }; a language may be left out until
   the section is submitted. `version` is the working revision's version, when there is one. */
export const saveWebsiteDraft = (parishId, apiKey, texts, version) =>
  api(`${base(parishId)}/website/sections/${enc(apiKey)}/draft`, 'PUT', {
    operationId: newOperationId(),
    version: version || undefined,
    texts
  });
/* submit, return, publish or unpublish a revision (a reason is required to return or unpublish) */
export const websiteAction = (parishId, apiKey, revisionId, version, action, reason) =>
  api(`${base(parishId)}/website/sections/${enc(apiKey)}/revisions/${enc(revisionId)}/actions`, 'POST', {
    operationId: newOperationId(),
    version,
    action,
    reason: reason || null
  });

/* ---------- inbox ---------- */

export const conversations = parishId => soft(api(`${base(parishId)}/inbox`)).then(r => r || []);
export const receivedBroadcasts = parishId => soft(api(`${base(parishId)}/broadcasts/mine`)).then(r => r || []);
export const ownReports = parishId => soft(api(`${base(parishId)}/inbox/reports/mine`)).then(r => r || []);
/* Opening a conversation marks it read for this account. */
export const messages = (parishId, id) => api(`${base(parishId)}/inbox/${enc(id)}`);
/* A member writes to the parish office; office staff may write to a linked parishioner's account. */
export const startConversation = (parishId, subject, body, recipientAccountId) =>
  api(`${base(parishId)}/inbox`, 'POST', {
    operationId: newOperationId(),
    subject,
    body,
    recipientAccountId: recipientAccountId || null
  });
export const postMessage = (parishId, id, body) =>
  api(`${base(parishId)}/inbox/${enc(id)}/messages`, 'POST', { operationId: newOperationId(), body });
export const archiveConversation = (parishId, id, archived) =>
  api(`${base(parishId)}/inbox/${enc(id)}/archive?archived=${archived ? 'true' : 'false'}`, 'POST');
export const conversationOutcome = (parishId, id) => api(`${base(parishId)}/inbox/${enc(id)}/notification-outcome`);
export const messageOutcome = (parishId, conversationId, id) =>
  api(`${base(parishId)}/inbox/${enc(conversationId)}/messages/${enc(id)}/notification-outcome`);
export const reportMessage = (parishId, conversationId, id, explanation) =>
  api(`${base(parishId)}/inbox/${enc(conversationId)}/messages/${enc(id)}/reports`, 'POST', {
    operationId: newOperationId(),
    explanation
  });

/* ---------- exact-message review (platform operators only) ---------- */

export const reviewQueue = async parishId => {
  const [reports, reviews] = await Promise.all([
    soft(api(`${base(parishId)}/message-reports`)),
    soft(api(`${base(parishId)}/message-reviews`))
  ]);
  return { reports: reports || [], reviews: reviews || [] };
};
export const closeReport = (parishId, id, version, note, reporterOutcome) =>
  api(`${base(parishId)}/message-reports/${enc(id)}/close`, 'POST', {
    operationId: newOperationId(),
    version,
    note,
    reporterOutcome
  });
export const requestReview = (parishId, report, reason) =>
  api(`${base(parishId)}/message-reviews`, 'POST', {
    operationId: newOperationId(),
    conversationId: report.conversationId,
    messageId: report.messageId,
    reportId: report.id,
    reason
  });
export const decideReview = (parishId, id, version, approve, reason, accessMinutes) =>
  api(`${base(parishId)}/message-reviews/${enc(id)}/decision`, 'POST', {
    operationId: newOperationId(),
    version,
    approve,
    reason,
    accessMinutes: approve ? accessMinutes : null
  });
export const readReviewedMessage = (parishId, id) => api(`${base(parishId)}/message-reviews/${enc(id)}/message`);
export const closeReview = (parishId, id, version, note, reporterOutcome) =>
  api(`${base(parishId)}/message-reviews/${enc(id)}/close`, 'POST', {
    operationId: newOperationId(),
    version,
    note,
    reporterOutcome: reporterOutcome || null
  });
