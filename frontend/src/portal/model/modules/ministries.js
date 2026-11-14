/* Purpose: the Ministries module's connection to ParishLife.Api: groups (ministries) with their leaders,
   members, join applications, meetings, attendance, formation, belongings and volunteer sign-up sheets,
   and the member-facing ministry requests.
   Main members: keys, routes, load (fills GROUPS, GROUP_DETAIL, VOLUNTEERS, SIGNUP_SHEETS and
   ATTENDANCE_SERIES), save (sends changes to groups, meeting times, meetings, attendance and belongings),
   and the workflows a diff cannot express: ministryAction, applicationAction, ministryRequests,
   requestDecision, requestMembership, addMembers, endMembership, appointLeader, endLeader, saveFormation,
   approveFormation, recordCompletion, reviewCompletion, reopenCompletion, lendItem and loanAction.
   Details, routes and gaps: docs/frontend-modules/ministries.md.

   The API pages with ?size=&cursor= (not ?continuation=), answers 404 (not 403) when an account lacks the
   duty for a read, and hides most ministry data behind a duty: office (ministries.manage), leader, or one
   of the leader's duties (attendance, formation, resources, volunteers). So every per-ministry read is
   optional: a refused read leaves that part empty instead of failing the load. */
import { api, newOperationId, session } from '../api.js';
import { loadNames, nameOf } from '../names.js';

export const keys = ['GROUPS', 'GROUP_DETAIL', 'VOLUNTEERS', 'SIGNUP_SHEETS', 'ATTENDANCE_SERIES'];
export const routes = ['groups', 'ministryrequests', 'attendance', 'volunteers'];

const enc = encodeURIComponent;
const base = parishId => `parishes/${enc(parishId)}`;
export const KINDS = { Ministry: 'خدمة', Choir: 'جوقة', Class: 'صف', Committee: 'لجنة', Team: 'فريق' };
const OPEN_JOIN = ['Submitted', 'AwaitingPriest', 'Returned'];
const WINDOW_BACK_DAYS = 180,
  WINDOW_FORWARD_DAYS = 90,
  ATTENDANCE_DAYS = 90;

/* ---------- transport helpers ---------- */

/* A read the account may not be allowed (403, or the API's 404 for "no duty") gives `empty`. */
export const quiet = (promise, empty) =>
  Promise.resolve(promise).catch(e => (e.status === 403 || e.status === 404 ? empty : Promise.reject(e)));

/* Every page of a list (?size=&cursor=), up to a limit. */
export async function pages(path, limit = 2000) {
  const items = [];
  let cursor = '';
  do {
    const page = await api(`${path}${path.includes('?') ? '&' : '?'}size=100${cursor ? `&cursor=${enc(cursor)}` : ''}`);
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}

/* Runs fn over items, a few at a time. */
async function pool(items, fn, size = 5) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

/* ---------- time ---------- */

/* An instant as the wall-clock date and time in a time zone. */
export function localParts(instant, zone) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const o = Object.fromEntries(f.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  return { d: `${o.year}-${o.month}-${o.day}`, t: `${o.hour}:${o.minute}` };
}
/* The instant at which a time zone's clock shows a date and time. */
export function zonedInstant(d, t, zone) {
  const [y, mo, da] = d.split('-').map(Number),
    [h, mi] = t.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = localParts(guess, zone),
      [py, pmo, pda] = p.d.split('-').map(Number),
      [ph, pmi] = p.t.split(':').map(Number);
    guess += wall - Date.UTC(py, pmo - 1, pda, ph, pmi);
  }
  return new Date(guess);
}
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const day = instant => String(instant || '').slice(0, 10);

/* ---------- API values ↔ the portal's attendance words ---------- */

const ATTENDANCE_IN = { Present: 'present', Late: 'present', Excused: 'excused', Absent: 'absent' };
const ATTENDANCE_OUT = { present: 'Present', excused: 'Excused', absent: 'Absent', '': 'NotRecorded' };

/* ---------- load ---------- */

/* Which ministries this account can reach in the parish, and with which leader duties. */
async function reach(parish) {
  const office = !!parish.roles?.includes('priest') || !!parish.capabilities?.includes('ministries.manage');
  const capacities = await api('me/capacities').catch(() => []);
  const led = new Map();
  for (const c of capacities || [])
    if (c.kind === 'MinistryLeader' && c.parishId === parish.id && c.ministryId)
      led.set(c.ministryId, [...new Set([...(led.get(c.ministryId) || []), ...(c.capabilities || [])])]);
  return { office, led };
}

const has = (access, ministryId, ...duties) =>
  access.office || duties.some(duty => access.led.get(ministryId)?.includes(duty));
const leads = (access, ministryId) => access.office || access.led.has(ministryId);

const personName = (d, id) => d.PEOPLE?.find(p => p.id === id);

export async function load(parish, d) {
  const access = await reach(parish);
  if (!access.office && !access.led.size) return;
  const root = base(parish.id);

  const rows = access.office
    ? await quiet(pages(`${root}/ministries`), [])
    : (await pool([...access.led.keys()], id => quiet(api(`${root}/ministries/${enc(id)}`), null))).filter(Boolean);
  const ministries = rows.filter(r => r?.value && r.value.status !== 'Archived');

  const accountPerson = new Map(); // leaders are accounts; the portal shows people
  const detail = await pool(
    ministries,
    async ({ value: m, version }) => {
      const id = m.id,
        seat = `${root}/ministries/${enc(id)}`;
      const [leaders, roster, applications, programs, enrollments, stock, loans, opportunities] = await Promise.all([
        quiet(pages(`${seat}/leadership`), []),
        quiet(pages(`${seat}/roster`), []),
        leads(access, id) ? quiet(pages(`${seat}/applications?kind=Join`), []) : [],
        has(access, id, 'formation.record', 'formation.review') ? quiet(pages(`${seat}/formation/programs`), []) : [],
        has(access, id, 'formation.record', 'formation.review')
          ? quiet(pages(`${seat}/formation/enrollments`), [])
          : [],
        has(access, id, 'resources.custody') ? quiet(pages(`${seat}/stock`), []) : [],
        has(access, id, 'resources.custody') ? quiet(pages(`${seat}/loans`), []) : [],
        has(access, id, 'volunteers.coordinate') ? quiet(pages(`${seat}/volunteering/opportunities`), []) : []
      ]);
      const meetings = await loadMeetings(root, id);
      const attending = has(access, id, 'attendance.record', 'attendance.review');
      const team = await pool(
        opportunities.filter(o => o.value.status !== 'Cancelled'),
        async o => ({
          opportunity: o,
          assignments: await quiet(pages(`${seat}/volunteering/opportunities/${enc(o.value.id)}/assignments`), [])
        }),
        3
      );
      await pool(
        meetings.filter(m => m.status === 'Confirmed' && attending),
        m => loadSheet(root, id, m),
        3
      );
      for (const l of leaders) if (l.value.effective) accountPerson.set(l.value.accountId, null);
      return { m, version, leaders, roster, applications, programs, enrollments, stock, loans, team, meetings };
    },
    3
  );

  /* leader names through the shared lookup; leader account → person where the account may read the link (people.write) */
  await loadNames(parish.id, [...accountPerson.keys()]);
  await pool(
    [...accountPerson.keys()],
    async account => {
      const link = await quiet(api(`${root}/person-account-links/${enc(account)}`), null);
      accountPerson.set(account, link?.value?.active ? link.value.personId : null);
    },
    5
  );

  const volunteers = new Map(),
    sheets = [],
    series = [];
  for (const x of detail) {
    const { m } = x;
    const led = x.leaders.filter(l => l.value.effective);
    const roster = x.roster
      .filter(r => r.current)
      .map(r => ({
        p: r.personId,
        role: 'Member',
        roleAr: 'عضو',
        joined: String(new Date(r.joinedAt).getFullYear()),
        joinedAt: r.joinedAt,
        att: 0
      }));
    const leaders = led.map(l => ({
      accountId: l.value.accountId,
      personId: accountPerson.get(l.value.accountId) || null,
      name: nameOf(parish.id, l.value.accountId),
      role: l.value.role,
      duties: l.value.duties || [],
      version: l.version
    }));
    const roles = led.map(l => {
      const leader = l.value.role === 'Leader';
      return [
        accountPerson.get(l.value.accountId) || null,
        leader ? 'Leader' : 'Assistant',
        leader ? 'مسؤول' : 'مساعد'
      ];
    });
    for (const [pid, role, roleAr] of roles) {
      const row = roster.find(r => r.p === pid);
      if (row) Object.assign(row, { role, roleAr });
    }
    const leaderPerson = roles.find(r => r[1] === 'Leader')?.[0] || null,
      assistantPerson = roles.find(r => r[1] === 'Assistant')?.[0] || null;

    d.GROUPS.push({
      id: m.id,
      name: m.name,
      ar: m.nameAr || '',
      cat: m.kind,
      catAr: KINDS[m.kind] || m.kind,
      leader: leaderPerson,
      ...(assistantPerson ? { assistant: assistantPerson } : {}),
      members: roster.length,
      meets: m.meetingTimes || '',
      meetsAr: m.meetingTimesAr || '',
      vis: m.publicListed ? 'public' : 'private',
      status: m.status,
      purpose: m.purpose,
      purposeAr: m.purposeAr || '',
      publicInformation: m.publicInformation || '',
      publicInformationAr: m.publicInformationAr || '',
      eligibilityPolicyReference: m.eligibilityPolicyReference || '',
      applicationsOpen: !!m.applicationsOpen,
      publicListed: !!m.publicListed,
      version: x.version
    });

    /* formation: the approved program revision holds enrollments; a draft (new or revising it) is what editing changes */
    const programOf = row =>
      row && {
        id: row.value.id,
        version: row.version,
        title: row.value.title,
        titleAr: row.value.titleAr || '',
        status: row.value.status
      };
    const approvedRow = x.programs.find(p => p.value.status === 'Approved'),
      draftRow = x.programs.find(p => p.value.status === 'Draft');
    const program = approvedRow?.value;
    const enrolled = x.enrollments.filter(e => program && e.value.programId === program.id);
    const enrollments = Object.fromEntries(
      enrolled.map(e => [e.value.personId, { id: e.value.id, version: e.version, status: e.value.status }])
    );
    const shown = (draftRow || approvedRow)?.value;
    const milestones = (shown?.milestones || []).map(ms => ({
      id: ms.key,
      key: ms.key,
      name: ms.title,
      ar: ms.titleAr || '',
      description: ms.description || '',
      descriptionAr: ms.descriptionAr || '',
      prerequisiteKeys: ms.prerequisiteKeys || [],
      clergyApproval: !!ms.clergyApproval,
      approved: !!program?.milestones?.some(a => a.key === ms.key),
      legacyCount: 0,
      completions: Object.fromEntries(
        enrolled.flatMap(e =>
          e.value.milestones
            .filter(p => p.key === ms.key && p.status === 'Completed')
            .map(p => [e.value.personId, { date: p.achievedOn || day(p.completedAt), notes: '' }])
        )
      ),
      progress: Object.fromEntries(
        enrolled.flatMap(e =>
          e.value.milestones
            .filter(p => p.key === ms.key && p.status !== 'Completed')
            .map(p => [e.value.personId, { status: p.status, explanation: p.applicantExplanation || '' }])
        )
      )
    }));

    const stock = x.stock
      .filter(s => s.value.status !== 'Retired')
      .map(s => ({
        id: s.value.id,
        name: s.value.name,
        ar: s.value.nameAr || '',
        qty: s.value.total,
        lent: s.value.onLoan || 0,
        location: s.value.storage || '',
        locationAr: s.value.storageAr || '',
        version: s.version
      }));
    const resourceLoans = x.loans.map(l => ({
      id: l.value.id,
      version: l.version,
      resourceId: l.value.stockId,
      borrower: personName(d, l.value.personId)?.lat || '',
      personId: l.value.personId,
      qty: l.value.quantity,
      status: l.value.status,
      purpose: l.value.purpose || '',
      overdue: !!l.value.overdue,
      outcome: l.value.outcome || '',
      followUp: !!l.value.followUpRequired,
      checkedOutAt: day(l.value.issuedAt),
      due: day(l.value.dueAt),
      returnedAt: day(l.value.returnedAt)
    }));

    d.GROUP_DETAIL[m.id] = {
      assistant: assistantPerson,
      roles,
      leaders,
      formation: { approved: programOf(approvedRow) || null, draft: programOf(draftRow) || null, enrollments },
      requests: x.applications
        .filter(a => OPEN_JOIN.includes(a.value.status))
        .map(a => ({
          p: a.value.personId,
          at: day(a.value.submittedAt),
          id: a.value.id,
          status: a.value.status,
          version: a.version
        })),
      meetings: x.meetings.filter(mt => mt.status !== 'Cancelled'),
      posts: [],
      files: [],
      belongings: stock,
      resourceLoans,
      tasks: [],
      milestones,
      history: [],
      roster,
      automations: [],
      messagingRules: [],
      budget: { fund: 'general', allocated: 0, spent: 0 }
    };
    for (const mt of x.meetings)
      if (mt.sheet && mt.status === 'Confirmed') series.push([mt.startsAt, mt.sheet.presentCount + mt.sheet.lateCount]);
    for (const mt of x.meetings) {
      delete mt.sheet;
      delete mt.startsAt;
    }

    for (const t of x.team) {
      const o = t.opportunity.value;
      const open = t.assignments.filter(a => !['Declined', 'Cancelled'].includes(a.value.status));
      sheets.push({
        id: o.id,
        ministryId: m.id,
        what: o.title,
        whatAr: o.titleAr || '',
        position: o.position,
        slots: o.capacity,
        taken: o.capacity - o.remaining,
        deadline: day(o.startsAt),
        status: o.status,
        version: t.opportunity.version
      });
      for (const a of open) {
        const v = volunteers.get(a.value.personId) || {
          p: a.value.personId,
          skills: [],
          skillsAr: [],
          clearance: '',
          until: null,
          training: [],
          avail: [],
          hours: 0,
          assignments: 0,
          ministries: new Set()
        };
        v.assignments += 1;
        v.ministries.add(m.id);
        volunteers.set(a.value.personId, v);
      }
    }
  }
  d.SIGNUP_SHEETS = sheets;
  d.ATTENDANCE_SERIES = series
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(s => s[1]);

  /* hours come from the verified hours the API holds for each person in each ministry */
  await pool(
    [...volunteers.values()],
    async v => {
      let minutes = 0;
      for (const id of v.ministries) {
        if (!has(access, id, 'volunteers.coordinate')) continue;
        const hours = await quiet(pages(`${root}/ministries/${enc(id)}/volunteering/people/${enc(v.p)}/hours`), []);
        minutes += hours.filter(h => h.value.status === 'Verified').reduce((n, h) => n + h.value.minutes, 0);
      }
      v.hours = Math.round((minutes / 60) * 10) / 10;
    },
    5
  );
  d.VOLUNTEERS = [...volunteers.values()].map(({ ministries, ...v }) => v);
}

/* A ministry's meetings in the last six and next three months, 30 days per request (the API's limit). */
async function loadMeetings(root, ministryId) {
  const now = Date.now(),
    day30 = 30 * 86400000,
    out = new Map();
  const windows = [];
  for (let at = now - WINDOW_BACK_DAYS * 86400000; at < now + WINDOW_FORWARD_DAYS * 86400000; at += day30)
    windows.push([at, at + day30]);
  const lists = await pool(
    windows,
    ([from, to]) =>
      quiet(
        pages(
          `${root}/ministries/${enc(ministryId)}/meetings?start=${enc(new Date(from).toISOString())}&end=${enc(new Date(to).toISOString())}`
        ),
        []
      ),
    4
  );
  for (const m of lists.flat()) out.set(m.id, m);
  const meetings = [...out.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return Promise.all(
    meetings.map(async m => {
      const zone = m.timeZone || browserZone(),
        from = localParts(m.startsAt, zone),
        to = localParts(m.endsAt, zone);
      const item = {
        id: m.id,
        d: from.d,
        t: from.t,
        end: to.d === from.d ? to.t : '',
        title: m.title,
        titleAr: m.titleAr || '',
        place: m.locationDescription || '',
        description: m.agenda || '',
        kind: 'group',
        status: m.status,
        timeZone: zone,
        participants: [],
        rsvp: { yes: 0, no: 0, none: 0 },
        done: false,
        attendance: {},
        startsAt: m.startsAt
      };
      if (m.status === 'Confirmed' && m.rsvpOpen) {
        const replies = await quiet(pages(`${root}/ministries/${enc(ministryId)}/meetings/${enc(m.id)}/rsvps`), []);
        item.rsvp.yes = replies.filter(r => r.response === 'Yes').length;
        item.rsvp.no = replies.filter(r => r.response === 'No').length;
      }
      return item;
    })
  );
}

/* The attendance sheet of a meeting that has started, if one was opened, into the meeting. */
async function loadSheet(root, ministryId, meeting) {
  if (
    Date.parse(meeting.startsAt) > Date.now() ||
    Date.now() - Date.parse(meeting.startsAt) > ATTENDANCE_DAYS * 86400000
  )
    return;
  const seat = `${root}/ministries/${enc(ministryId)}/meetings/${enc(meeting.id)}/attendance`;
  const sheet = await quiet(api(seat), null);
  if (!sheet) return;
  meeting.sheet = sheet.value;
  if (!sheet.value.snapshotComplete) return;
  const rows = await quiet(pages(`${seat}/rows`), []);
  for (const row of rows) {
    const value = ATTENDANCE_IN[row.value.status];
    if (value) meeting.attendance[row.value.personId] = value;
  }
  meeting.done = sheet.value.status === 'Closed' || Object.keys(meeting.attendance).length > 0;
}

/* ---------- save ---------- */

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byId = list => new Map((list || []).map(x => [x.id, x]));
const reasonNote = 'Done in the parish portal.';

/* What the API stores of a group; the portal's other group fields are derived or have no API field. */
const GROUP_FIELDS = [
  'name',
  'ar',
  'cat',
  'purpose',
  'purposeAr',
  'publicInformation',
  'publicInformationAr',
  'eligibilityPolicyReference'
];
const MEETING_FIELDS = ['d', 't', 'end', 'title', 'titleAr', 'place', 'description'];
/* Group detail the API has no equivalent for yet: a change to any of these is reported, not saved. */
const DETAIL_UNSUPPORTED = [
  'roles',
  'leaders',
  'formation',
  'requests',
  'roster',
  'posts',
  'files',
  'resourceLoans',
  'tasks',
  'milestones',
  'history',
  'budget',
  'automations',
  'messagingRules',
  'assistant',
  'qrRevoked'
];

const ministryBody = g => {
  if (!KINDS[g.cat]) throw new Error('Choose what kind of group this is: Ministry, Choir, Class, Committee or Team.');
  return {
    name: String(g.name || '').trim(),
    nameAr: String(g.ar || '').trim() || null,
    kind: g.cat,
    purpose: String(g.purpose || '').trim(),
    purposeAr: String(g.purposeAr || '').trim() || null,
    eligibilityPolicyReference: String(g.eligibilityPolicyReference || '').trim() || null,
    publicInformation: String(g.publicInformation || '').trim() || null,
    publicInformationAr: String(g.publicInformationAr || '').trim() || null
  };
};
/* The usual meeting times are kept apart from the approved description, so they can change on an active group. */
async function saveMeetingTimes(root, id, g) {
  const row = await api(`${root}/ministries/${enc(id)}`);
  await api(`${root}/ministries/${enc(id)}/meeting-times`, 'PUT', {
    operationId: newOperationId(),
    version: row.version,
    meetingTimes: String(g.meets || '').trim() || null,
    meetingTimesAr: String(g.meetsAr || '').trim() || null
  });
}

export async function save(before, now, parish) {
  const root = base(parish.id);
  let unsupported = false,
    saved = false;

  /* groups: create, edit (drafts only: the API refuses the rest), archive */
  const was = byId(before.GROUPS),
    is = byId(now.GROUPS);
  for (const g of is.values()) {
    const old = was.get(g.id);
    if (!old) {
      const created = await api(`${root}/ministries`, 'POST', { operationId: newOperationId(), ...ministryBody(g) });
      if ((g.meets || g.meetsAr) && created?.id) await saveMeetingTimes(root, created.id, g);
      saved = true;
      continue;
    }
    if (GROUP_FIELDS.some(k => g[k] !== old[k])) {
      const row = await api(`${root}/ministries/${enc(g.id)}`);
      await api(`${root}/ministries/${enc(g.id)}`, 'PUT', {
        operationId: newOperationId(),
        version: row.version,
        ...ministryBody(g)
      });
      saved = true;
    }
    if (['meets', 'meetsAr'].some(k => (g[k] || '') !== (old[k] || ''))) {
      await saveMeetingTimes(root, g.id, g);
      saved = true;
    }
    if (['vis', 'leader', 'assistant'].some(k => !same(g[k], old[k]))) unsupported = true;
  }
  for (const old of was.values())
    if (!is.has(old.id)) {
      const row = await api(`${root}/ministries/${enc(old.id)}`);
      await api(`${root}/ministries/${enc(old.id)}/actions`, 'POST', {
        operationId: newOperationId(),
        version: row.version,
        action: 'archive',
        reason: reasonNote
      });
      saved = true;
    }

  /* each group's detail */
  const detailBefore = before.GROUP_DETAIL || {},
    detailNow = now.GROUP_DETAIL || {};
  for (const gid of Object.keys(detailNow)) {
    if (!was.has(gid)) continue; // a group not yet in the API has nothing to attach to
    const b = detailBefore[gid] || {},
      n = detailNow[gid];
    if (DETAIL_UNSUPPORTED.some(k => !same(b[k] ?? null, n[k] ?? null) && !(isEmpty(b[k]) && isEmpty(n[k]))))
      unsupported = true;
    const seat = `${root}/ministries/${enc(gid)}`;

    /* belongings → stock */
    const stockBefore = byId(b.belongings),
      stockNow = byId(n.belongings);
    for (const s of stockNow.values()) {
      const old = stockBefore.get(s.id);
      if (old && ['name', 'ar', 'qty', 'location', 'locationAr'].every(k => same(old[k], s[k]))) continue;
      const body = {
        operationId: newOperationId(),
        name: String(s.name || '').trim(),
        nameAr: String(s.ar || '').trim() || null,
        storage: String(s.location || '').trim() || null,
        storageAr: String(s.locationAr || '').trim() || null,
        total: Number(s.qty) || 0,
        status: 'Active'
      };
      if (old?.version) await api(`${seat}/stock/${enc(s.id)}`, 'PUT', { ...body, version: old.version });
      else if (!old) await api(`${seat}/stock`, 'POST', body);
      saved = true;
    }
    for (const old of stockBefore.values())
      if (!stockNow.has(old.id)) {
        await api(`${seat}/stock/${enc(old.id)}`, 'PUT', {
          operationId: newOperationId(),
          version: old.version,
          name: old.name,
          nameAr: old.ar || null,
          storage: old.location || null,
          storageAr: old.locationAr || null,
          total: Number(old.qty) || 0,
          status: 'Retired'
        });
        saved = true;
      }

    /* meetings */
    const meetBefore = byId(b.meetings),
      meetNow = byId(n.meetings);
    const zone = [...meetNow.values()].find(m => m.timeZone)?.timeZone || browserZone();
    for (const m of meetNow.values()) {
      const old = meetBefore.get(m.id);
      if (m.kind === 'committee' || m.participants?.length) {
        if (!old) {
          unsupported = true; // choosing who is invited has no API field
          continue;
        }
      }
      if (!old) {
        await createMeeting(seat, m, zone);
        saved = true;
        continue;
      }
      if (MEETING_FIELDS.some(k => !same(m[k], old[k]))) {
        const row = await api(`${seat}/meetings/${enc(m.id)}`);
        await api(`${seat}/meetings/${enc(m.id)}`, 'PUT', {
          ...meetingBody(m, old.timeZone || zone),
          version: row.version
        });
        saved = true;
      }
      if (old.status === 'Draft' && m.status === 'Confirmed') {
        const row = await api(`${seat}/meetings/${enc(m.id)}`);
        await api(`${seat}/meetings/${enc(m.id)}/actions`, 'POST', {
          operationId: newOperationId(),
          version: row.version,
          action: 'confirm'
        });
        saved = true;
      }
      const changed = Object.keys({ ...old.attendance, ...m.attendance }).filter(
        pid => (old.attendance?.[pid] || '') !== (m.attendance?.[pid] || '')
      );
      if (changed.length) {
        await recordAttendance(seat, m, changed);
        saved = true;
      }
    }
    for (const old of meetBefore.values())
      if (!meetNow.has(old.id)) {
        const row = await api(`${seat}/meetings/${enc(old.id)}`);
        await api(`${seat}/meetings/${enc(old.id)}/actions`, 'POST', {
          operationId: newOperationId(),
          version: row.version,
          action: 'cancel',
          reason: reasonNote
        });
        saved = true;
      }
  }

  /* volunteers: nothing in the portal's volunteer record exists in the API (see the module doc) */
  if (!same(before.VOLUNTEERS, now.VOLUNTEERS)) unsupported = true;
  /* sign-up sheets: a deleted one is cancelled; creating and editing need a ministry and a position */
  const sheetsBefore = byId(before.SIGNUP_SHEETS),
    sheetsNow = byId(now.SIGNUP_SHEETS);
  for (const old of sheetsBefore.values())
    if (!sheetsNow.has(old.id)) {
      await api(`${root}/ministries/${enc(old.ministryId)}/volunteering/opportunities/${enc(old.id)}/actions`, 'POST', {
        operationId: newOperationId(),
        version: old.version,
        action: 'cancel',
        reason: reasonNote
      });
      saved = true;
    }
  for (const s of sheetsNow.values()) {
    const old = sheetsBefore.get(s.id);
    if (!old || !same(old, s)) unsupported = true;
  }
  if (!same(before.ATTENDANCE_SERIES, now.ATTENDANCE_SERIES)) unsupported = true;
  return { unsupported, saved };
}

const isEmpty = v =>
  v == null || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' ? !Object.keys(v).length : v === '');

function meetingBody(m, zone) {
  const startsAt = zonedInstant(m.d, m.t, zone);
  const endsAt = m.end ? zonedInstant(m.d, m.end, zone) : new Date(startsAt.getTime() + 3600000); // no end given: one hour
  return {
    operationId: newOperationId(),
    title: String(m.title || '').trim() || 'Group meeting',
    titleAr: String(m.titleAr || '').trim() || null,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timeZone: zone,
    agenda: String(m.description || '').trim() || null,
    locationDescription: String(m.place || '').trim() || null,
    rsvpMode: 'Optional',
    rsvpDeadline: null,
    rsvpPolicyReference: null
  };
}
async function createMeeting(seat, m, zone) {
  await api(`${seat}/meetings`, 'POST', meetingBody(m, zone));
}

/* Opens the meeting's attendance sheet if needed, builds its expected roster, then records the changes. */
async function recordAttendance(seat, meeting, personIds) {
  const at = `${seat}/meetings/${enc(meeting.id)}/attendance`;
  let sheet = await quiet(api(at), null);
  if (!sheet) {
    const row = await api(`${seat}/meetings/${enc(meeting.id)}`);
    sheet = await api(at, 'POST', { operationId: newOperationId(), meetingVersion: row.version });
  }
  for (let i = 0; !sheet.value.snapshotComplete && i < 200; i++)
    sheet = await api(`${at}/snapshot`, 'POST', { operationId: newOperationId(), version: sheet.version });
  if (!sheet.value.snapshotComplete) throw new Error('The attendance roster is still being prepared. Try again.');
  const rows = new Map((await pages(`${at}/rows`)).map(r => [r.value.personId, r]));
  const entries = personIds.map(pid => {
    const row = rows.get(pid);
    if (!row)
      throw new Error(
        'Attendance can only be recorded for people on the meeting’s expected roster (members when the sheet was opened).'
      );
    return {
      personId: pid,
      version: row.version,
      status: ATTENDANCE_OUT[meeting.attendance?.[pid] || ''],
      correctionReason: row.value.recordedAt ? reasonNote : null
    };
  });
  const changes = entries.filter(e => rows.get(e.personId).value.status !== e.status);
  for (let i = 0; i < changes.length; i += 25)
    sheet = await api(`${at}/records`, 'POST', {
      operationId: newOperationId(),
      version: sheet.version,
      entries: changes.slice(i, i + 25)
    });
}

/* ---------- workflows the screens call directly ---------- */

/* A ministry's lifecycle step: approve, publish, unpublish, open-applications, close-applications. */
export async function ministryAction(ministryId, action, reason) {
  const seat = `${base(session.parishId)}/ministries/${enc(ministryId)}`;
  const row = await api(seat);
  return api(`${seat}/actions`, 'POST', {
    operationId: newOperationId(),
    version: row.version,
    action,
    reason: String(reason || '').trim() || reasonNote
  });
}

/* A step on a join application in the group's roster tab: approve (priest) or recommend (leader), decline
   (priest) or return for information (leader). */
export function applicationAction(ministryId, application, action, { reference = '', reason = '' } = {}) {
  const parish = session.parishes.find(p => p.id === session.parishId),
    priest = !!parish?.roles?.includes('priest');
  const step =
    action === 'approve'
      ? application.status === 'WithdrawalRequested'
        ? 'approve-withdrawal'
        : priest
          ? 'approve'
          : 'recommend'
      : priest
        ? 'decline'
        : 'return';
  return api(
    `${base(session.parishId)}/ministries/${enc(ministryId)}/applications/${enc(application.id)}/actions`,
    'POST',
    {
      operationId: newOperationId(),
      version: application.version,
      action: step,
      reason: String(reason || '').trim() || null,
      eligibilityReviewReference: String(reference || '').trim() || null
    }
  );
}

const REQUEST_STATUS = {
  Submitted: 'requested',
  AwaitingPriest: 'awaiting-priest',
  WithdrawalRequested: 'withdrawal-requested',
  Returned: 'returned',
  Approved: 'approved',
  Declined: 'declined',
  Withdrawn: 'withdrawn'
};
const requestOf = (a, version, extra) => ({
  id: a.id,
  version,
  ministryId: a.ministryId,
  personId: a.personId,
  kind: a.kind === 'Leave' ? 'leave' : 'join',
  status:
    a.kind === 'Leave' && a.status === 'AwaitingPriest' ? 'leave-requested' : REQUEST_STATUS[a.status] || a.status,
  reason: a.reason || '',
  leader_at: a.recommendedAt || null,
  ...extra
});

/* What the ministry-requests page shows: ministries to explore in each parish the account follows or
   belongs to (the public, published ones), its own applications, and the open ones it may review. */
export async function ministryRequests(names = {}) {
  const requests = [],
    ministries = [];
  const mine = new Set();
  await pool(
    session.parishes,
    async parish => {
      const root = base(parish.id);
      const published = await quiet(pages(`public/parishes/${enc(parish.id)}/ministries`), []);
      await pool(
        published,
        async m => {
          const seat = `${root}/ministries/${enc(m.id)}`;
          const [membership, own] = await Promise.all([
            quiet(api(`${seat}/membership/mine`), null),
            quiet(pages(`${seat}/applications/mine`), [])
          ]);
          ministries.push({
            id: m.id,
            parish: parish.id,
            name: m.name,
            parishName: parish.name,
            description: m.publicInformation || m.purpose,
            member: !!membership?.current
          });
          for (const a of own) {
            mine.add(a.value.id);
            requests.push(
              requestOf(a.value, a.version, {
                parish_id: parish.id,
                parishName: parish.name,
                group_id: m.id,
                groupName: m.name,
                name: session.user?.name || '',
                own: true,
                canReview: false
              })
            );
          }
        },
        3
      );
    },
    2
  );
  /* applications to review in the open parish: leaders see joins to their groups, priests also departures */
  const open = session.parishes.find(p => p.id === session.parishId);
  if (open) {
    const root = base(open.id);
    const reach_ = await reach(open);
    const groups = reach_.office
      ? await quiet(pages(`${root}/ministries`), [])
      : (await pool([...reach_.led.keys()], id => quiet(api(`${root}/ministries/${enc(id)}`), null))).filter(Boolean);
    await pool(
      groups.filter(g => g?.value?.status === 'Active'),
      async ({ value: g }) => {
        for (const kind of ['Join', 'Leave']) {
          const found = await quiet(pages(`${root}/ministries/${enc(g.id)}/applications?kind=${kind}`), []);
          for (const a of found)
            if (!mine.has(a.value.id) && !['Approved', 'Declined', 'Withdrawn'].includes(a.value.status))
              requests.push(
                requestOf(a.value, a.version, {
                  parish_id: open.id,
                  parishName: open.name,
                  group_id: g.id,
                  groupName: g.name,
                  name: names[a.value.personId] || '',
                  own: false,
                  canReview: true,
                  priest: !!open.roles?.includes('priest')
                })
              );
        }
      },
      3
    );
  }
  return { requests, ministries };
}

/* An action on an application from the ministry-requests page. */
export function requestDecision(r, action, { reason = '', reference = '' } = {}) {
  const seat = `${base(r.parish_id)}/ministries/${enc(r.ministryId || r.group_id)}/applications/${enc(r.id)}/actions`;
  const step = r.own
    ? 'withdraw'
    : action === 'approve'
      ? r.status === 'withdrawal-requested'
        ? 'approve-withdrawal'
        : r.priest
          ? 'approve'
          : 'recommend'
      : r.status === 'withdrawal-requested'
        ? 'deny-withdrawal'
        : r.priest
          ? 'decline'
          : 'return';
  return api(seat, 'POST', {
    operationId: newOperationId(),
    version: r.version,
    action: step,
    reason: String(reason || '').trim() || null,
    eligibilityReviewReference: String(reference || '').trim() || null
  });
}

/* Asks to join, or to leave (with the applicant's private note, kept apart from the application). */
export async function requestMembership(g, { reason = '' } = {}) {
  const seat = `${base(g.parish)}/ministries/${enc(g.id)}`;
  const application = await api(`${seat}/applications`, 'POST', {
    operationId: newOperationId(),
    kind: g.member ? 'Leave' : 'Join'
  });
  const note = String(reason || '').trim();
  if (g.member && note)
    await api(`${seat}/applications/${enc(application.id)}/private-reason`, 'PUT', {
      operationId: newOperationId(),
      reason: note
    });
  return application;
}

/* ---------- roster, leadership, formation and loans (called from the group screens, then hydrate) ---------- */

const seatOf = ministryId => `${base(session.parishId)}/ministries/${enc(ministryId)}`;
const fresh = async path => (await api(path)).version;

/* Adds existing parish people: each becomes an assisted join application with the actual instruction or
   consent evidence the preparer records; a different priest then approves it with the eligibility review. */
export async function addMembers(ministryId, personIds, evidence) {
  for (const personId of personIds)
    await api(`${seatOf(ministryId)}/applications`, 'POST', {
      operationId: newOperationId(),
      kind: 'Join',
      personId,
      representationEvidence: String(evidence || '').trim()
    });
}

/* A priest ends a current membership (roster removal), pinning the interval shown on screen. */
export function endMembership(ministryId, row, reason) {
  return api(`${seatOf(ministryId)}/roster/${enc(row.p)}/end`, 'POST', {
    operationId: newOperationId(),
    joinedAt: row.joinedAt,
    reason: String(reason || '').trim()
  });
}

/* A priest appoints a roster member's reviewed account as Leader or Assistant, with evidence and the duties
   granted; `replace` (an outgoing leader from GROUP_DETAIL.leaders) makes it an immediate handover. */
export async function appointLeader(ministryId, personId, { role = 'Leader', duties = [], evidence = '', replace = null } = {}) {
  const root = base(session.parishId);
  const link = await api(`${root}/person-account-links/by-person/${enc(personId)}`).catch(e => {
    if (e.status === 404 || e.status === 403)
      throw new Error('This person has no reviewed account link the office can see, so they cannot be appointed.');
    throw e;
  });
  return api(`${seatOf(ministryId)}/leadership`, 'POST', {
    operationId: newOperationId(),
    ministryVersion: await fresh(seatOf(ministryId)),
    accountId: link.value.accountId,
    role,
    duties,
    startsAt: new Date(Date.now() - 5000).toISOString(),
    endsAt: null,
    evidenceReference: String(evidence || '').trim(),
    replaceAccountId: replace?.accountId || null,
    replaceVersion: replace?.version || null
  });
}

/* A priest ends a leader's or assistant's appointment. */
export function endLeader(ministryId, leader, reason) {
  return api(`${seatOf(ministryId)}/leadership/${enc(leader.accountId)}/end`, 'POST', {
    operationId: newOperationId(),
    version: leader.version,
    reason: String(reason || '').trim()
  });
}

/* Saves the milestone list as the formation draft: edits the open draft, or starts one (revising the approved
   program when there is one). Prerequisites that name removed or later milestones are dropped. */
export async function saveFormation(ministryId, formation, milestones, title = {}) {
  const seat = `${seatOf(ministryId)}/formation/programs`;
  const keys = [];
  const body = milestones.map(m => {
    const item = {
      key: m.key,
      title: String(m.name || '').trim(),
      titleAr: String(m.ar || '').trim() || null,
      description: String(m.description || '').trim() || null,
      descriptionAr: String(m.descriptionAr || '').trim() || null,
      prerequisiteKeys: (m.prerequisiteKeys || []).filter(k => keys.includes(k)),
      clergyApproval: !!m.clergyApproval
    };
    keys.push(m.key);
    return item;
  });
  const current = formation?.draft || formation?.approved;
  const head = {
    title: String(title.title || current?.title || '').trim() || 'Formation',
    titleAr: String(title.titleAr ?? current?.titleAr ?? '').trim() || null,
    milestones: body
  };
  if (formation?.draft)
    return api(`${seat}/${enc(formation.draft.id)}`, 'PUT', {
      operationId: newOperationId(),
      version: await fresh(`${seat}/${enc(formation.draft.id)}`),
      ...head
    });
  return api(seat, 'POST', {
    operationId: newOperationId(),
    supersedesProgramId: formation?.approved?.id || null,
    ...head
  });
}

/* A priest approves the formation draft with the reference of the review actually done. */
export async function approveFormation(ministryId, program, reference) {
  const seat = `${seatOf(ministryId)}/formation/programs/${enc(program.id)}`;
  return api(`${seat}/actions`, 'POST', {
    operationId: newOperationId(),
    version: await fresh(seat),
    action: 'approve',
    approvalReference: String(reference || '').trim()
  });
}

/* One milestone step on an enrollment, with the enrollment's current version. */
async function step(ministryId, enrollmentId, body) {
  const seat = `${seatOf(ministryId)}/formation/enrollments/${enc(enrollmentId)}`;
  return api(`${seat}/milestones`, 'POST', { operationId: newOperationId(), version: await fresh(seat), ...body });
}

/* Records evidence that members reached a milestone of the approved program: enrolls them if needed, starts the
   milestone and submits the evidence reference with the date. A different reviewer then completes it. */
export async function recordCompletion(ministryId, formation, key, personIds, { date, evidence }) {
  const program = formation?.approved;
  if (!program) throw new Error('A priest must approve the formation program before completions are recorded.');
  for (const personId of personIds) {
    let enrollment = formation.enrollments?.[personId];
    if (!enrollment) {
      const seat = `${seatOf(ministryId)}/formation/programs/${enc(program.id)}`;
      enrollment = await api(`${seat}/enrollments`, 'POST', {
        operationId: newOperationId(),
        personId,
        programVersion: await fresh(seat)
      });
    }
    const current = (await api(`${seatOf(ministryId)}/formation/enrollments/${enc(enrollment.id)}`)).value;
    const status = current.milestones.find(m => m.key === key)?.status;
    const evidenceBody = { milestoneKey: key, evidenceReference: evidence, achievedOn: date, source: 'Course' };
    if (status === 'Enrolled') await step(ministryId, enrollment.id, { milestoneKey: key, action: 'start' });
    if (status === 'Enrolled' || status === 'InProgress')
      await step(ministryId, enrollment.id, { ...evidenceBody, action: 'submit-evidence' });
    else if (status === 'NeedsInformation')
      await step(ministryId, enrollment.id, { ...evidenceBody, action: 'resubmit' });
  }
}

/* A reviewer (not the recorder) reviews the submitted evidence and completes the milestone. */
export async function reviewCompletion(ministryId, formation, key, personId, reference) {
  const enrollment = formation?.enrollments?.[personId];
  if (!enrollment) return;
  const current = (await api(`${seatOf(ministryId)}/formation/enrollments/${enc(enrollment.id)}`)).value;
  if (current.milestones.find(m => m.key === key)?.status === 'EvidenceSubmitted')
    await step(ministryId, enrollment.id, { milestoneKey: key, action: 'review', reviewReference: reference });
  await step(ministryId, enrollment.id, { milestoneKey: key, action: 'complete' });
}

/* A priest reopens a completed milestone for review (the screen's "remove completion"). */
export function reopenCompletion(ministryId, formation, key, personId, reason) {
  const enrollment = formation?.enrollments?.[personId];
  if (!enrollment) return Promise.resolve();
  return step(ministryId, enrollment.id, { milestoneKey: key, action: 'reopen', reason: String(reason || '').trim() });
}

/* A custodian lends an item to a current member: request on the member's behalf, approve, and issue it with
   the due date and the condition at issue. */
export async function lendItem(ministryId, stockId, personId, { qty, due, condition, purpose = '' }) {
  const loan = await api(`${seatOf(ministryId)}/loans`, 'POST', {
    operationId: newOperationId(),
    stockId,
    quantity: qty,
    purpose: String(purpose || '').trim() || null,
    personId
  });
  await loanAction(ministryId, loan, 'approve');
  return loanAction(ministryId, loan, 'issue', {
    dueAt: zonedInstant(due, '23:59', browserZone()).toISOString(),
    condition
  });
}

/* One loan step (approve, decline, cancel, issue, return, check, report-missing, close) with the loan's current version. */
export async function loanAction(ministryId, loan, action, fields = {}) {
  const seat = `${seatOf(ministryId)}/loans/${enc(loan.id)}`;
  return api(`${seat}/actions`, 'POST', { operationId: newOperationId(), version: await fresh(seat), action, ...fields });
}
