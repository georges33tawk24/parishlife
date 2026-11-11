/* Purpose: the list of portal modules connected to ParishLife.Api.
   Main member: MODULES. Each module is a file in this folder exporting
     keys    the view-model collections (model/data.js) it owns,
     routes  the portal pages it feeds (the others show a "not connected" notice),
     load(parish, d)    fills its collections in d from the API (d starts empty),
     save(before, now, parish)  sends what changed between two snapshots; returns
                                { unsupported, saved } (unsupported changes are undone and reported).
   A collection no module owns cannot be saved: a change to it is undone with a message.
   To connect a module, add its file here, one import and one entry. See docs/frontend-modules/. */
import * as people from './people.js';
import * as administration from './administration.js';

export const MODULES = [people, administration];
