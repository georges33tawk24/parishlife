/* Purpose: checks the Communications module against an in-memory stand-in for its routes: what load
   fills (broadcasts, templates, notices, the bell, website sections, prayer intentions), what save sends
   (marking a notification read), that other edits are refused, and the workflow calls' exact bodies.
   Run with `npm run check` from frontend/. */
import assert from 'node:assert/strict';
import { mockApi, json, signedIn } from '../mock-api.mjs';

const { sent, events } = mockApi((method, path, body) => {
  const P = 'parishes/P/';
  if (method === 'GET') {
    if (path.startsWith(P + 'people?')) return json(200, { items: [], continuationToken: null }); // the People module loads too
    if (path.startsWith(P + 'account-names?'))
      return json(200, [
        { accountId: 'a1', displayName: 'Office writer' },
        { accountId: 'a2', displayName: 'Office reviewer' }
      ]);
    if (path === P + 'broadcasts')
      return json(200, [
        {
          version: 'v1',
          value: {
            id: 'b1',
            audience: 'Members',
            title: 'Parish lunch',
            body: 'Sunday',
            language: 'en',
            titleAr: 'غداء الرعية',
            bodyAr: 'الأحد',
            status: 'Sent',
            updatedBy: 'a1',
            approvedBy: 'a2',
            sentAt: '2026-11-01T10:00:00Z',
            recipientCount: 12,
            skippedByPreferenceCount: 2,
            channels: [
              { channel: 'InApp', status: 'Stored' },
              { channel: 'Email', status: 'NotConfigured' }
            ]
          }
        }
      ]);
    if (path === P + 'broadcast-templates')
      return json(200, [
        {
          version: 't1',
          value: {
            id: 't1',
            name: 'Feast',
            title: 'Feast day',
            body: 'Join us',
            language: 'fr',
            status: 'Approved',
            updatedBy: 'a1',
            updatedAt: '2026-11-01T00:00:00Z'
          }
        }
      ]);
    if (path === P + 'announcements')
      return json(200, [
        {
          version: 'n1v',
          value: {
            id: 'n1',
            visibility: 'Public',
            title: 'Fair',
            body: 'Saturday',
            language: 'en',
            status: 'Draft',
            pinned: true,
            priority: 'Urgent',
            authorAccountId: 'a1'
          }
        },
        {
          version: 'n2v',
          value: {
            id: 'n2',
            visibility: 'Members',
            title: 'Old',
            body: 'x',
            language: 'en',
            status: 'Published',
            publishedAt: '2026-10-04T08:00:00Z'
          }
        }
      ]);
    if (path === P + 'website/sections')
      return json(200, [
        {
          version: 's',
          value: {
            key: 'mass-times',
            status: 'Published',
            published: {
              id: 'r1',
              version: 'rv1',
              status: 'Published',
              texts: { en: { title: 'Mass', body: 'Sunday 9:00' } }
            },
            pending: {
              id: 'r2',
              version: 'rv2',
              status: 'Draft',
              texts: { en: { title: 'Mass', body: 'Sunday 9:30' } }
            }
          }
        }
      ]);
    if (path === P + 'prayer-intentions')
      return json(200, [
        {
          version: 'p1v',
          value: {
            id: 'p1',
            text: 'For peace',
            requestedVisibility: 'AnonymousPublic',
            status: 'Received',
            submittedAt: '2026-11-02T00:00:00Z'
          }
        }
      ]);
    if (path.startsWith('notifications?size=50')) {
      if (path.includes('cursor=c2'))
        return json(200, {
          items: [
            {
              id: 'q3',
              parishId: 'Z',
              topic: 'x',
              title: 'Other parish',
              status: 'Unread',
              createdAt: '2026-11-03T09:00:00Z'
            }
          ],
          continuationToken: null
        });
      return json(200, {
        items: [
          {
            id: 'q1',
            parishId: 'P',
            topic: 'inbox.message',
            title: 'New message',
            link: '/api/parishes/P/inbox/c',
            status: 'Unread',
            createdAt: '2026-11-03T09:00:00Z'
          },
          {
            id: 'q2',
            parishId: null,
            topic: 'request.update',
            title: 'Request moved',
            status: 'Read',
            createdAt: '2026-11-02T09:00:00Z'
          },
          { id: 'q4', parishId: 'P', topic: 'x', title: 'Gone', status: 'Archived', createdAt: '2026-11-01T09:00:00Z' }
        ],
        continuationToken: 'c2'
      });
    }
    if (path === P + 'ministries?size=100')
      return json(200, { items: [{ value: { id: 'm1', name: 'Choir', status: 'Active' } }], continuationToken: null });
    return undefined;
  }
  if (path === 'notifications/q1/state') return json(200, { id: 'q1', status: 'Read' });
  if (path === P + 'broadcasts') return json(200, { id: 'b2', ...body });
  if (path.endsWith('/draft')) return json(200, { key: 'mass-times', status: 'Draft' });
  return json(200, {});
});

const { session } = await import('../../src/portal/model/api.js');
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const C = await import('../../src/portal/model/modules/communications.js');

signedIn(session, { roles: ['priest'] });
await hydrate();

assert.equal(D.MESSAGES.length, 1);
assert.deepEqual([D.MESSAGES[0].status, D.MESSAGES[0].reach, D.MESSAGES[0].skipped], ['sent', 12, 2]);
assert.equal(
  D.MESSAGES[0].channels.find(c => c.channel === 'Email').status,
  'NotConfigured',
  'email is never reported as sent'
);
assert.deepEqual([D.TEMPLATES[0].status, D.TEMPLATES[0].language], ['approved', 'fr']);
assert.deepEqual([D.MESSAGES[0].subjectAr, D.MESSAGES[0].titleAr], ['غداء الرعية', 'غداء الرعية']);
assert.deepEqual([D.NOTICES[0].urgent, D.NOTICES[0].authorId, D.NOTICES[1].urgent], [true, 'a1', false]);
assert.equal(D.NOTICES[1].ar, 'Old', 'without an Arabic version the display falls back to the title');
const N = await import('../../src/portal/model/names.js');
assert.deepEqual([N.nameOf('P', 'a1'), N.nameOf('P', 'a2')], ['Office writer', 'Office reviewer']);
assert.deepEqual(
  D.NOTICES.map(n => [n.status, n.visibility]),
  [
    ['draft', 'Public'],
    ['published', 'Members']
  ]
);
assert.equal(D.NOTICES[1].at, '2026-10-04');
assert.equal(D.PRAYERS[0].status, 'awaiting-approval');
assert.equal(D.CONTENT.massTimes.live.version, 'rv1');
assert.equal(D.CONTENT.massTimes.texts.en.body, 'Sunday 9:30', 'the working draft is what the editor shows');
assert.equal(D.CONTENT.welcome, undefined, 'a section the API does not have stays empty');
assert.deepEqual(
  D.NOTIFICATIONS.map(n => n[5]),
  ['q1', 'q2'],
  'archived and other parishes left out, all pages read'
);
assert.deepEqual([D.NOTIFICATIONS[0][3], D.NOTIFICATIONS[0][4], D.NOTIFICATIONS[1][3]], ['#/inbox', true, '']);

// marking read goes to the API; any other edit is undone and reported
D.NOTIFICATIONS[0][4] = false;
assert.equal(await persist(), true);
assert.deepEqual(sent.at(-1), ['POST', 'notifications/q1/state', { status: 'Read' }]);
D.NOTICES[0].title = 'Changed on screen';
assert.equal(await persist(), false);
assert.equal(events.at(-1).detail.includes("isn't connected"), true);
assert.equal(D.NOTICES[0].title, 'Fair');

// a member loads nothing staff-only
sent.length = 0;
signedIn(session, { roles: ['member'] });
Object.assign(session.parishes[0], { effectiveRole: 'member' });
await hydrate();
assert.deepEqual(
  [D.MESSAGES.length, D.TEMPLATES.length, D.NOTICES.length, D.CONTENT.massTimes, D.PRAYERS.length],
  [0, 0, 0, undefined, 0]
);

// workflow bodies
await C.saveBroadcast('P', { audience: 'Ministry', ministryId: 'm1', title: 'T', body: 'B', language: 'ar' });
let [method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.audience, body.ministryId, body.title, body.language],
  ['POST', 'parishes/P/broadcasts', 'Ministry', 'm1', 'T', 'ar']
);
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
await C.saveBroadcast('P', { id: 'b1', version: 'v9', audience: 'Members', templateId: 't1' });
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.version, body.templateId, body.title],
  ['PUT', 'parishes/P/broadcasts/b1', 'v9', 't1', undefined]
);
await C.broadcastAction('P', 'b1', 'v9', 'send');
assert.deepEqual(sent.at(-1)[2].action, 'send');
await C.saveWebsiteDraft('P', 'mass-times', { en: { title: 'a', body: 'b' } }, 'rv2');
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.version, Object.keys(body.texts)],
  ['PUT', 'parishes/P/website/sections/mass-times/draft', 'rv2', ['en']]
);
await C.websiteAction('P', 'mass-times', 'r2', 'rv2', 'return', 'needs French');
assert.deepEqual(sent.at(-1).slice(0, 2), ['POST', 'parishes/P/website/sections/mass-times/revisions/r2/actions']);
assert.equal(sent.at(-1)[2].reason, 'needs French');
await C.startConversation('P', 'Hello', 'Hi');
assert.equal(sent.at(-1)[2].recipientAccountId, null, 'a member writes to the office');
await C.startConversation('P', 'Hello', 'Hi', { personId: 'person1' });
assert.deepEqual(
  [sent.at(-1)[2].recipientAccountId, sent.at(-1)[2].recipientPersonId],
  [null, 'person1'],
  'staff write to a person from the people list'
);
await C.scheduleBroadcast('P', 'b1', 'v9', '2026-12-01T09:00:00Z');
assert.deepEqual(
  [sent.at(-1)[1], sent.at(-1)[2].action, sent.at(-1)[2].scheduledFor],
  ['parishes/P/broadcasts/b1/actions', 'schedule', '2026-12-01T09:00:00.000Z']
);
await C.saveBroadcast('P', { audience: 'Members', title: 'T', body: 'B', language: 'en', titleAr: 'ع', bodyAr: 'ن' });
assert.deepEqual([sent.at(-1)[2].titleAr, sent.at(-1)[2].bodyAr], ['ع', 'ن']);
await C.saveNotice('P', { visibility: 'Members', title: 'T', body: 'B', language: 'en', priority: 'Urgent' });
assert.deepEqual([sent.at(-1)[2].priority, sent.at(-1)[2].titleAr], ['Urgent', null]);
await C.saveAutomation('P', {
  name: 'Weekly',
  templateId: 't1',
  audience: 'Members',
  recurrence: 'Weekly',
  firstRunAt: '2026-12-01T09:00:00Z',
  maxRuns: '4'
});
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.templateId, body.maxRuns, body.ministryId],
  ['POST', 'parishes/P/broadcast-automations', 't1', 4, null]
);
await C.automationAction('P', 'au1', 'av1', 'pause');
assert.deepEqual(sent.at(-1).slice(0, 2), ['POST', 'parishes/P/broadcast-automations/au1/actions']);
await C.archiveConversation('P', 'c1', false);
assert.equal(sent.at(-1)[1], 'parishes/P/inbox/c1/archive?archived=false');
assert.deepEqual(await C.listMinistries('P'), [{ id: 'm1', name: 'Choir' }]);

console.log('communications: ok');
