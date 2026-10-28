/* Homepage content, mirroring backend/site_content.py: edited by the super
   administrator, read by the public site. Empty text falls back to the
   homepage's built-in wording; unpublished blocks and stories stay drafts. */
import { need, NOW, tokenHex } from './py.js';
import { history, isSuperAdmin } from './workspace.js';

const SECTIONS = ['week','map','requests','times','news','stories','verse','about','join'];
const BLOCKS = {hero:{title:140,subtitle:320},announcement:{text:280,linkLabel:60},about:{title:140,body:2400},join:{title:140,body:600}};
const LINK = /^(?:https:\/\/\S{1,490}|#[A-Za-z][A-Za-z0-9_-]{0,60}|\/(?![/\\])[^\s\\]{0,200}|public\.html\S{0,200})$/;
const IMAGE = /^(?:https:\/\/\S{1,1990}|assets\/images\/[A-Za-z0-9_-]{1,80}\.(?:jpg|jpeg|png|webp))$/;
const STORY_ID = /^[a-z0-9-]{1,40}$/;
const size = value => [...value].length;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function empty() {
  const data = {};
  for (const [name, fields] of Object.entries(BLOCKS)) data[name] = Object.fromEntries(Object.keys(fields).map(field => [field, {en:'',ar:''}]));
  Object.assign(data.announcement, {link:'',published:false});
  data.about.published = true;
  data.join.published = true;
  data.stories = [];
  data.sections = Object.fromEntries(SECTIONS.map(key => [key, true]));
  return data;
}

async function stored(c) {
  const row = await c.first("SELECT revision,data FROM pl_site_content WHERE key='homepage'");
  return row ? [row.revision, {...empty(), ...JSON.parse(row.data)}] : [0, empty()];
}

function text(value, limit) {
  value = isObject(value) ? value : {};
  const result = {en:String(value.en || '').trim(), ar:String(value.ar || '').trim()};
  need(size(result.en) <= limit && size(result.ar) <= limit, `Keep each homepage field within ${limit.toLocaleString('en-US')} characters.`);
  return result;
}

function address(value, pattern, message) {
  value = String(value || '').trim();
  need(!value || pattern.test(value), message);
  return value;
}

function clean(q) {
  need(isObject(q), 'Homepage content is missing.');
  const data = {};
  for (const [name, fields] of Object.entries(BLOCKS)) {
    const block = isObject(q[name]) ? q[name] : {};
    data[name] = Object.fromEntries(Object.entries(fields).map(([field, limit]) => [field, text(block[field], limit)]));
    if (name !== 'hero') data[name].published = block.published === true;
    if (name === 'announcement') data[name].link = address(block.link, LINK, 'Use an HTTPS link, a page path or a section link such as #map.');
  }
  const stories = q.stories === undefined ? [] : q.stories;
  need(Array.isArray(stories) && stories.length <= 8, 'Add up to eight stories.');
  data.stories = stories.map(story => {
    need(isObject(story), 'Each story needs a title.');
    const id = String(story.id || '') || tokenHex(6);
    need(STORY_ID.test(id), 'A story identifier is invalid.');
    const item = {id, title:text(story.title, 120), body:text(story.body, 600),
      image:address(story.image, IMAGE, 'Use an HTTPS image link for each story.'),
      link:address(story.link, LINK, 'Use an HTTPS link, a page path or a section link for each story.'),
      published:story.published === true};
    need(item.title.en || item.title.ar, 'Give each story a title in English or Arabic.');
    return item;
  });
  need(new Set(data.stories.map(s => s.id)).size === data.stories.length, 'Story identifiers must be unique.');
  const sections = isObject(q.sections) ? q.sections : {};
  data.sections = Object.fromEntries(SECTIONS.map(key => [key, sections[key] !== false]));
  return data;
}

/* The published projection: drafts and unpublished stories never leave the server. */
function publicView(data) {
  const result = {hero:data.hero, sections:data.sections,
    stories:data.stories.filter(s => s.published).map(({id,title,body,image,link}) => ({id,title,body,image,link}))};
  const {published, ...note} = data.announcement;
  if (published && (note.text.en || note.text.ar)) result.announcement = note;
  // About and Join keep their built-in wording when published empty; unpublished hides them.
  for (const name of ['about','join']) {
    const {published: shown, ...block} = data[name];
    if (shown) result[name] = block;
  }
  return result;
}

export async function siteContent(c, u, path, method, q) {
  if (path === '/api/public/site' && method === 'GET') return publicView((await stored(c))[1]);
  if (path !== '/api/workspace/site-content' || !u) return null;
  need(await isSuperAdmin(c, u), 'Only the super administrator edits the homepage.', 403);
  const [revision, data] = await stored(c);
  if (method === 'GET') return {revision, content:data};
  need(method === 'PUT', 'Method not allowed.', 405);
  need(q.revision === revision, 'The homepage changed since you opened it. Reopen the editor before saving.', 409);
  const content = clean(q.content);
  c.run("INSERT INTO pl_site_content VALUES('homepage',?,?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
    JSON.stringify(content), revision + 1, u.id, NOW());
  history(c, u, '*', 'site.homepage.updated', {revision:revision + 1});
  return {ok:true, revision:revision + 1};
}
