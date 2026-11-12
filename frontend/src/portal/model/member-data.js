/* Purpose: the signed-in member's own view of their parish (M), loaded from ParishLife.Api and changed
   through memberAction. The member pages (features/member/) read M and call memberAction(op, values).
   Main functions: loadMember (fills M from the member routes), memberAction (one portal action → API
   calls), loadActivity (the cross-parish "My parish life" page), activityAction.

   What is connected: the person linked to this account, ministries the parish lists publicly where the
   member belongs, their meetings, RSVP and attendance, formation, volunteering, announcements,
   schedule, notifications, concerns, profile corrections, consents, own data and closure requests, and the
   account-private notes and tasks. What the API has no route for stays empty (M.content resources,
   messages, preferences); see docs/frontend-modules/member.md.
   Fields owned by the requests module (M.requests, M.requestOptions) are left alone here. */
import { api, newOperationId, session, notConnected } from './api.js';

export const M = {
  parish: {},
  person: {},
  site: {},
  groups: [],
  meetings: [],
  events: [],
  content: [],
  notes: [],
  todos: [],
  commitments: {},
  preferences: {},
  concerns: [],
  review: [],
  leaderConcerns: [],
  complaintPermissions: [],
  profileRequests: [],
  volunteerReview: [],
  profileReview: [],
  managedGroups: [],
  formation: [],
  reviewers: [],
  categories: [],
  notifications: [],
  requests: [],
  requestOptions: { subjects: [], preparation: {}, phone: '', venues: [], busy: [] },
  parishes: [],
  home: { unreadNotifications: 0, parishes: [] },
  membershipRequests: [],
  consents: [],
  ownData: null,
  closureRequests: []
};

const DAY = 86400000;
const enc = encodeURIComponent;
/* The API refused or does not have this: leave the part empty. A server fault still fails the load. */
const soft = async (promise, fallback) => {
  try {
    return await promise;
  } catch (error) {
    if ([400, 403, 404, 409, 422].includes(error.status)) return fallback;
    throw error;
  }
};
/* Every page of a list that pages with size and cursor, up to a limit. */
async function pages(path, limit = 500) {
  const items = [];
  let cursor = '';
  do {
    const page = await api(`${path}${path.includes('?') ? '&' : '?'}size=100${cursor ? `&cursor=${enc(cursor)}` : ''}`);
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}
const values = rows => (rows || []).map(r => ({ ...r.value, version: r.version }));
const pid = () => session.parishId;
const inParish = path => `parishes/${enc(pid())}/${path}`;

/* A moment as the date and time on the clock of the zone it happened in. */
function clock(iso, zone) {
  if (!iso) return { date: '', time: '' };
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: '', time: '' };
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(at);
  } catch {
    return clock(iso, '');
  }
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const name = x => `${x.givenName || ''} ${x.familyName || ''}`.trim();
const isEmail = x => /@/.test(x || '');

/* ---------- loading ---------- */

const ATTENDANCE = { Present: 'present', Late: 'late', Absent: 'absent', Excused: 'excused' };
const NOTIFICATION_ROUTES = [
  ['concern', 'myconcerns'],
  ['request', 'myrequests'],
  ['membership', 'activity'],
  ['profile', 'myprofile'],
  ['ministry', 'mymeetings'],
  ['meeting', 'mymeetings'],
  ['volunteer', 'mycommitments'],
  ['formation', 'myformation']
];
const routeFor = topic =>
  NOTIFICATION_ROUTES.find(([prefix]) => String(topic || '').startsWith(prefix))?.[1] || 'membernotifications';

/* Concern categories are the ones the API accepts (SubmitConcernDto). */
const CONCERN_CATEGORIES = ['Operational', 'Interpersonal', 'Safeguarding', 'Other'];

async function ministries(link) {
  if (!link) return [];
  const listed = await soft(pages(`public/parishes/${enc(pid())}/ministries`), []);
  const mine = await Promise.all(
    listed.map(async m => {
      const membership = await soft(api(inParish(`ministries/${enc(m.id)}/membership/mine`)), null);
      return membership?.current ? { ...m, joinedAt: membership.joinedAt } : null;
    })
  );
  return mine.filter(Boolean);
}

async function meetingsOf(groups) {
  const now = Date.now();
  const windows = [
    [now - 31 * DAY, now],
    [now, now + 31 * DAY],
    [now + 31 * DAY, now + 62 * DAY]
  ];
  const rows = (
    await Promise.all(
      groups.flatMap(g =>
        windows.map(async ([from, to]) => {
          const list = await soft(
            pages(
              `parishes/${enc(pid())}/ministries/${enc(g.id)}/meetings?start=${enc(new Date(from).toISOString())}&end=${enc(new Date(to).toISOString())}`
            ),
            []
          );
          return list.map(m => ({ ...m, group: g.name }));
        })
      )
    )
  ).flat();
  const seen = new Set();
  const meetings = rows
    .filter(m => m.status !== 'Cancelled' && !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = meetings.filter(m => Date.parse(m.startsAt) < now).slice(-40);
  const upcoming = meetings.filter(m => Date.parse(m.startsAt) >= now).slice(0, 40);
  const attendance = new Map(
    await Promise.all(
      past.map(async m => [
        m.id,
        await soft(api(inParish(`ministries/${enc(m.ministryId)}/meetings/${enc(m.id)}/attendance/mine`)), null)
      ])
    )
  );
  const replies = new Map(
    await Promise.all(
      upcoming
        .filter(m => m.rsvpOpen)
        .map(async m => [
          m.id,
          await soft(api(inParish(`ministries/${enc(m.ministryId)}/meetings/${enc(m.id)}/rsvp`)), null)
        ])
    )
  );
  return meetings.map(m => {
    const when = clock(m.startsAt, m.timeZone);
    const done = Date.parse(m.startsAt) < now;
    const reply = replies.get(m.id);
    return {
      id: m.id,
      groupId: m.ministryId,
      group: m.group,
      title: m.title,
      date: when.date,
      time: when.time,
      location: m.locationDescription || '',
      description: m.agenda || '',
      organizer: '',
      attendance: done ? ATTENDANCE[attendance.get(m.id)?.status] || 'unrecorded' : 'upcoming',
      rsvpEnabled: !!m.rsvpOpen && !done && reply?.value?.canChange !== false,
      rsvp: reply?.value?.recorded
        ? { status: reply.value.response, reason: '', version: reply.version }
        : reply
          ? { status: '', reason: '', version: reply.version }
          : null,
      resources: []
    };
  });
}

async function volunteering(groups) {
  const perGroup = await Promise.all(
    groups.map(async g => {
      const base = `ministries/${enc(g.id)}/volunteering`;
      const [open, mine] = await Promise.all([
        soft(pages(inParish(`${base}/opportunities/open`)), []),
        soft(pages(inParish(`${base}/assignments/mine`)), [])
      ]);
      return { g, open: values(open), mine: values(mine) };
    })
  );
  const content = [],
    commitments = {};
  for (const { g, open, mine } of perGroup) {
    for (const o of open) {
      const when = clock(o.startsAt, '');
      content.push({
        id: o.id,
        kind: 'opportunity',
        groupId: g.id,
        title: `${o.title} · ${o.position}`,
        body: [when.date, o.location, o.requirements].filter(Boolean).join(' · '),
        category: '',
        at: o.startsAt,
        read: true,
        selfSignup: !!o.selfSignup
      });
    }
    for (const a of mine) {
      const status = { Invited: 'invited', AwaitingConfirmation: 'volunteer', Confirmed: 'confirmed' }[a.status];
      if (status) commitments[a.opportunityId] = { status, assignmentId: a.id, version: a.version, groupId: g.id };
    }
  }
  return { content, commitments };
}

async function formationOf(groups) {
  const rows = await Promise.all(
    groups.map(async g => [
      g,
      values(await soft(pages(inParish(`ministries/${enc(g.id)}/formation/enrollments/mine`)), []))
    ])
  );
  return rows.flatMap(([g, list]) =>
    list
      .filter(e => e.status !== 'Withdrawn')
      .map(e => ({
        id: e.id,
        groupId: g.id,
        name: e.programTitle,
        description: '',
        completion: e.completedAt ? { date: e.completedAt.slice(0, 10) } : null
      }))
  );
}

async function scheduleOf() {
  const from = new Date(),
    to = new Date(from.getTime() + 90 * DAY);
  const items = await soft(api(`me/schedule?from=${enc(from.toISOString())}&to=${enc(to.toISOString())}`), []);
  return (items || []).map(i => {
    const when = clock(i.startsAt, i.timeZone);
    return {
      id: `${i.kind}-${i.sourceId}`,
      title: i.title,
      titleAr: i.title,
      d: when.date,
      t: when.time,
      location: i.location || '',
      description: `${i.parishName} · ${i.status}`,
      kind: i.kind,
      source: i.kind,
      parishId: i.parishId,
      parishName: i.parishName
    };
  });
}

/* PersonalItemDto → the portal's note or task */
const note = x => ({
  id: x.id,
  title: x.title || '',
  body: x.body,
  category: x.category || '',
  tags: x.tags || [],
  reminder: '',
  meetingId: '',
  pinned: false,
  updatedAt: x.updatedAt,
  status: x.status,
  version: x.version
});
const todo = x => ({
  id: x.id,
  title: x.title || x.body,
  body: x.body,
  due: x.dueAt ? x.dueAt.slice(0, 10) : '',
  done: x.status === 'Completed',
  status: x.status,
  version: x.version
});

async function workspace() {
  const items = values(await soft(pages('me/personal-workspace'), []));
  const live = items.filter(x => !['Archived', 'Cancelled'].includes(x.status));
  return { notes: live.filter(x => x.kind === 'Note').map(note), todos: live.filter(x => x.kind === 'Task').map(todo) };
}

const concernRow = (x, entries) => ({
  id: x.id,
  reference: String(x.id).slice(0, 8).toUpperCase(),
  subject: x.summary,
  description: x.details,
  category: x.category,
  urgency: x.urgency,
  status: x.status,
  anonymous: !!x.anonymous,
  nextAction: x.nextAction || '',
  assignedToMe: !!x.assignedToMe,
  created_at: x.createdAt,
  version: x.version,
  updates: (entries || []).map(e => ({
    at: e.at,
    status: e.kind,
    text: e.body,
    internal: '',
    fromReviewer: !!e.fromReviewer
  }))
});
async function concernsFrom(path) {
  const rows = values(await soft(api(inParish(path)), []));
  return Promise.all(
    rows.map(async x => concernRow(x, await soft(api(inParish(`concerns/${enc(x.id)}/entries`)), [])))
  );
}

export async function loadMember() {
  const key = `${session.user?.id}:${session.parishId}`;
  const parish = session.parishes.find(p => p.id === session.parishId) || {};
  const [link, ownData, home, mine, notifications, consents, closure, applications, corrections, announcements] =
    await Promise.all([
      soft(api(inParish('person-account-links/mine')), null),
      soft(api(inParish('me/data')), null),
      soft(api('me/home'), null),
      soft(api('me/parishes'), []),
      soft(pages('notifications'), []),
      soft(api(inParish('me/consents')), []),
      soft(api(inParish('me/data-closure-requests')), []),
      soft(api(inParish('membership-requests/mine')), []),
      soft(api(inParish('profile-corrections/mine')), []),
      soft(api(inParish('announcements/mine')), [])
    ]);
  const personId = link?.value?.personId || '';
  const groups = await ministries(personId);
  const [meetings, volunteer, formation, events, workspaceItems, concerns, reviewers, assigned] = await Promise.all([
    meetingsOf(groups),
    volunteering(groups),
    formationOf(groups),
    scheduleOf(),
    workspace(),
    concernsFrom('concerns/mine'),
    soft(api(inParish('concerns/reviewers')), []),
    concernsFrom('concerns/assigned')
  ]);
  const named = ownData ? name(ownData) : session.user?.name || '';
  const contact = ownData?.contact || '';
  const facts = ownData?.facts;
  const mineHere = (mine || []).find(p => p.parishId === session.parishId);
  const person = {
    id: personId,
    lat: named,
    ar: named,
    born: ownData?.birthDate || '',
    phone: contact && !isEmail(contact) ? contact : '',
    email: contact && isEmail(contact) ? contact : '',
    address: [facts?.addressDetail, facts?.town].filter(Boolean).join(', '),
    status: mineHere?.relationship === 'Member' ? 'member' : ''
  };
  Object.assign(M, {
    parish: { id: parish.id || '', name: parish.name || '' },
    person,
    groups: groups.map(g => ({ id: g.id, name: g.name, category: g.kind, position: '' })),
    meetings,
    events,
    content: [
      ...(announcements || []).map(a => ({
        id: a.id,
        kind: 'announcement',
        groupId: a.ministryId || '',
        title: a.title,
        body: a.body,
        category: a.category || '',
        pinned: !!a.pinned,
        at: a.publishedAt || '',
        read: true,
        archived: false
      })),
      ...volunteer.content
    ],
    commitments: volunteer.commitments,
    formation,
    notes: workspaceItems.notes,
    todos: workspaceItems.todos,
    concerns,
    reviewers: (reviewers || []).map(r => ({ id: r.id, name: r.description, categories: r.categories })),
    categories: CONCERN_CATEGORIES.map(n => ({ name: n, active: true })),
    review: assigned,
    complaintPermissions: assigned.length ? ['Review', 'Respond', 'Resolve'] : [],
    profileRequests: values(corrections).flatMap(c =>
      c.fields.map(f => ({
        id: c.id,
        field: f.field,
        requested_value: f.newValue,
        status: c.status,
        version: c.version
      }))
    ),
    notifications: (notifications || [])
      .filter(n => n.status !== 'Archived')
      .map(n => ({
        id: n.id,
        kind: n.topic,
        title: n.title,
        body: '',
        at: n.createdAt,
        read: n.status !== 'Unread',
        route: routeFor(n.topic)
      })),
    parishes: mine || [],
    home: { unreadNotifications: home?.unreadNotifications || 0, parishes: home?.parishes || [] },
    membershipRequests: applications || [],
    consents: values(consents),
    ownData,
    closureRequests: closure || []
  });
  M.loadedFor = key;
  return M;
}

/* ---------- actions ---------- */

const act = (path, action, item, extra = {}) =>
  api(path, 'POST', { operationId: newOperationId(), version: item.version, action, ...extra });

async function saveNote(v) {
  const old = v.id ? M.notes.find(x => x.id === v.id) : null;
  if (v.delete) return act(`me/personal-workspace/${enc(v.id)}/actions`, 'archive', old);
  const body = {
    operationId: newOperationId(),
    kind: 'Note',
    saveAsDraft: false,
    title: v.title || null,
    body: v.body,
    category: v.category || null,
    tags: v.tags || []
  };
  return old
    ? api(`me/personal-workspace/${enc(old.id)}`, 'PUT', { ...body, version: old.version })
    : api('me/personal-workspace', 'POST', body);
}
async function saveTodo(v) {
  const old = v.id ? M.todos.find(x => x.id === v.id) : null;
  if (v.delete) return act(`me/personal-workspace/${enc(v.id)}/actions`, 'archive', old);
  if (old && v.done !== undefined)
    return act(`me/personal-workspace/${enc(v.id)}/actions`, v.done ? 'complete' : 'reopen', old);
  const body = {
    operationId: newOperationId(),
    kind: 'Task',
    saveAsDraft: false,
    title: v.title,
    body: old?.body && old.body !== old.title ? old.body : v.title,
    tags: [],
    dueAt: v.due ? `${v.due}T00:00:00Z` : null
  };
  return old
    ? api(`me/personal-workspace/${enc(old.id)}`, 'PUT', { ...body, version: old.version })
    : api('me/personal-workspace', 'POST', body);
}

async function rsvp(v) {
  const m = M.meetings.find(x => x.id === v.meetingId);
  if (!m) throw new Error('That meeting is no longer on your list.');
  return api(inParish(`ministries/${enc(m.groupId)}/meetings/${enc(m.id)}/rsvp`), 'PUT', {
    operationId: newOperationId(),
    version: m.rsvp?.version || null,
    response: v.status === 'yes' ? 'Yes' : 'No'
  });
}

async function volunteer(v) {
  const have = M.commitments[v.id];
  const opportunity = M.content.find(x => x.kind === 'opportunity' && x.id === v.id);
  const base = ministry => `ministries/${enc(ministry)}/volunteering`;
  if (v.status === 'withdrawn') {
    if (!have) return null;
    return act(
      `parishes/${enc(pid())}/${base(have.groupId)}/assignments/${enc(have.assignmentId)}/actions`,
      have.status === 'confirmed' ? 'request-cancel' : 'decline',
      have
    );
  }
  if (v.status !== 'volunteer') throw new Error(notConnected);
  if (have?.status === 'invited')
    return act(
      `parishes/${enc(pid())}/${base(have.groupId)}/assignments/${enc(have.assignmentId)}/actions`,
      'accept',
      have
    );
  if (!opportunity) throw new Error('That opportunity is no longer open.');
  return api(inParish(`${base(opportunity.groupId)}/opportunities/${enc(opportunity.id)}/assignments`), 'POST', {
    operationId: newOperationId()
  });
}

const CORRECTION_FIELDS = ['GivenName', 'FamilyName', 'BirthDate', 'Contact'];

async function concernAction(v) {
  const item = M.review.find(x => x.id === v.id);
  if (!item) throw new Error('That case is no longer assigned to you.');
  const concern = `concerns/${enc(item.id)}`;
  let version = item.version;
  const fresh = async () => (version = (await api(inParish(concern))).version);
  if (v.action)
    await act(inParish(`${concern}/actions`), v.action, { version }, v.nextAction ? { nextAction: v.nextAction } : {});
  for (const [kind, text] of [
    ['InformationRequest', v.infoRequest],
    ['MessageToSubmitter', v.publicText],
    ['ReviewerNote', v.internalText]
  ]) {
    if (!text) continue;
    await api(inParish(`${concern}/entries`), 'POST', { operationId: newOperationId(), kind, body: text });
  }
  await fresh();
  return null;
}

/* One portal action → the API. Throws the "not connected" message for anything with no route. */
export async function memberAction(op, v = {}) {
  switch (op) {
    case 'rsvp':
      return rsvp(v);
    case 'note':
      return saveNote(v);
    case 'todo':
      return saveTodo(v);
    case 'volunteer':
      return volunteer(v);
    case 'profileRequest': {
      if (!CORRECTION_FIELDS.includes(v.field)) throw new Error(notConnected);
      return api(inParish('profile-corrections'), 'POST', {
        operationId: newOperationId(),
        fields: [{ field: v.field, newValue: v.value }]
      });
    }
    case 'profileWithdraw':
      return api(inParish(`profile-corrections/${enc(v.id)}/withdraw`), 'POST');
    case 'concern': {
      const details = [
        v.description,
        v.peopleInvolved && `People involved: ${v.peopleInvolved}`,
        v.happenedAt && `When: ${v.happenedAt}`
      ]
        .filter(Boolean)
        .join('\n\n');
      return api(inParish('concerns'), 'POST', {
        operationId: newOperationId(),
        category: v.category,
        urgency: 'Normal',
        summary: v.subject,
        details,
        anonymous: !!v.anonymous,
        reviewerIds: v.reviewers || [],
        implicatedAccountIds: []
      });
    }
    case 'concernFollowUp':
      return api(inParish(`concerns/${enc(v.id)}/entries`), 'POST', {
        operationId: newOperationId(),
        kind: 'SubmitterMessage',
        body: v.message
      });
    case 'concernUpdate':
      return concernAction(v);
    case 'notificationRead':
      return api(`notifications/${enc(v.id)}/state`, 'POST', { status: 'Read' });
    case 'notificationReadAll':
      for (const n of M.notifications.filter(x => !x.read))
        await api(`notifications/${enc(n.id)}/state`, 'POST', { status: 'Read' });
      return null;
    case 'consentWithdraw':
      return api(inParish(`me/consents/${enc(v.id)}/withdraw`), 'POST', {
        operationId: newOperationId(),
        version: M.consents.find(x => x.id === v.id)?.version,
        reason: v.reason || null
      });
    case 'closureRequest':
      return api(inParish('me/data-closure-requests'), 'POST', {
        operationId: newOperationId(),
        details: v.details || null
      });
    default:
      throw new Error(notConnected);
  }
}

/* ---------- "My parish life": every parish this account follows ---------- */

/* The account-level view: parishes (with unread counts and membership state), what is coming up across
   them, and the latest notifications. */
export async function loadActivity() {
  const [home, parishes, events, notifications] = await Promise.all([
    soft(api('me/home'), null),
    soft(api('me/parishes'), []),
    scheduleOf(),
    soft(pages('notifications', 50), [])
  ]);
  const applications = await Promise.all(
    (parishes || []).map(async p => [
      p.parishId,
      await soft(api(`parishes/${enc(p.parishId)}/membership-requests/mine`), [])
    ])
  );
  return {
    home,
    parishes: parishes || [],
    events,
    notifications: notifications.filter(n => n.status !== 'Archived'),
    applications: Object.fromEntries(applications)
  };
}

/* The public directory, so a member can find a parish to follow. */
export async function directory() {
  const page = await soft(api('public/parishes'), null);
  return [...(page?.items || []), ...(page?.distanceUnavailable || [])];
}

export function activityAction(op, v = {}) {
  const parish = `parishes/${enc(v.parishId)}`;
  switch (op) {
    case 'follow':
      return api(`${parish}/follow`, 'POST');
    case 'unfollow':
      return api(`${parish}/follow`, 'DELETE');
    case 'primary':
      return api(`${parish}/primary`, 'PUT');
    case 'apply':
      return api(`${parish}/membership-requests`, 'POST', {
        operationId: newOperationId(),
        givenName: v.givenName,
        familyName: v.familyName,
        birthDate: v.birthDate || null,
        contact: v.contact || null,
        locality: v.locality || null,
        note: v.note || null
      });
    case 'withdraw':
      return api(`${parish}/membership-requests/${enc(v.id)}/withdraw`, 'POST');
    default:
      throw new Error(notConnected);
  }
}
