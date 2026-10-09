/* Shared, deliberately small data helpers for plans and attendance. */
import { S } from './store.js';
import { SERVICE, SERVICE_PLANS } from './data.js';
import { persist } from './persist.js';

export const copyOrder = order => (order || []).map(item => ({ ...item }));
export const allPlans = () => [SERVICE, ...SERVICE_PLANS];
export const planById = id => allPlans().find(plan => plan.id === id);
export const currentPlan = () => planById(S.route === 'services' && S.params[0] === 'plan' ? S.params[1] : '') || SERVICE;

const clone = value => JSON.parse(JSON.stringify(value));
const minutes = value => { const [h,m] = String(value || '00:00').split(':').map(Number); return h*60+m; };
const clock = value => `${String(Math.floor(value/60)%24).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
let draft = null;
let guardInstalled = false;

export function normalizePlanOrder(plan, mode = 'sort') {
  let cursor = minutes(plan.time || '09:00');
  for (const item of plan.order) {
    if (!/^\d{2}:\d{2}$/.test(item.start || '')) item.start = clock(cursor);
    cursor = minutes(item.start) + Math.max(1, Number(item.dur) || 1);
  }
  if (mode === 'sort') plan.order.sort((a,b) => minutes(a.start) - minutes(b.start));
  if (mode === 'reflow') {
    cursor = minutes(plan.time || '09:00');
    for (const item of plan.order) { item.start = clock(cursor); cursor += Math.max(1, Number(item.dur) || 1); }
  }
  plan.order.forEach((item,index) => { item.sequence = index + 1; });
  return plan;
}

function installGuard() {
  if (guardInstalled || typeof window === 'undefined') return;
  guardInstalled = true;
  window.addEventListener('beforeunload', event => {
    if (!planDirty()) return;
    event.preventDefault(); event.returnValue = '';
  });
}

export function beginPlanDraft(id) {
  if (draft?.id === id) return draft.value;
  const source = planById(id); if (!source) return null;
  draft = { id, value: normalizePlanOrder(clone(source)), baseline: clone(source) };
  installGuard();
  return draft.value;
}
export const workingPlan = id => draft?.id === id ? draft.value : beginPlanDraft(id);
export const planDirty = () => !!draft && JSON.stringify(draft.value) !== JSON.stringify(normalizePlanOrder(clone(draft.baseline)));
export const discardPlanDraft = () => { draft = null; };
/** Called by the router before it changes route or parish. */
export function confirmPlanNavigation(nextHash) {
  if (!planDirty()) { discardPlanDraft(); return true; }
  if (nextHash && typeof location !== 'undefined' && nextHash === location.hash) return true;
  if (typeof window !== 'undefined' && !window.confirm('Leave this service plan? Your unsaved changes will be discarded.')) return false;
  discardPlanDraft(); return true;
}
export async function savePlanDraft() {
  if (!draft) return false;
  const source = planById(draft.id); if (!source) return false;
  const previous = clone(source);
  Object.assign(source, normalizePlanOrder(clone(draft.value)));
  if (!await persist()) { Object.assign(source, previous); return false; }
  draft = null;
  return true;
}
export const planTotalMinutes = plan => plan.order.reduce((total,item)=>total+Math.max(0,Number(item.dur)||0),0);

export const meetingId = meeting => meeting.id || `mt-${meeting.d}-${meeting.t}`;
export const attendanceValue = (meeting, personId) => meeting.attendance?.[personId] || '';
export const attendanceCounts = (meetings, roster) => {
  const counts = { present: 0, excused: 0, absent: 0, unrecorded: 0 };
  for (const meeting of meetings) for (const member of roster) {
    if(meeting.participants?.length && !meeting.participants.includes(member.p))continue;
    const value = attendanceValue(meeting, member.p);
    counts[value || 'unrecorded'] += 1;
  }
  return counts;
};
