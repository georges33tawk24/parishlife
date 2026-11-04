/* The signed-in member's own view of their parishes (M): their person record, groups, meetings,
   events, content, notes and to-dos, loaded from the server and refreshed after each change. */
import { parishAPI, session } from './api.js';

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
  requestOptions: { subjects: [], preparation: {}, phone: '', venues: [], busy: [] }
};

export async function loadMember() {
  Object.assign(M, await parishAPI('member'));
  M.loadedFor = `${session.user?.id}:${session.parishId}`;
  return M;
}

export const memberAction = (op, values = {}) => parishAPI('member', 'POST', { op, ...values });
