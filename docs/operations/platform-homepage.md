# Platform homepage content (X08)

Edited and published only by current, verified MFA platform operators acting as themselves. The editor contract is the *proposed* X08 matrix entry, not approved policy; one operator both edits and publishes (no second approver).

## Routes
- `GET|PUT /api/administration/homepage/draft` — read / save the single working draft. Save needs the current `Version` (omitted on an existing draft = `version_required`; stale = `write_conflict`).
- `POST /api/administration/homepage/publish` — publish exactly the draft `Version` you reviewed. Refused with `homepage_translation_incomplete` unless at least one section is ordered and every ordered block has a title and body in `en`, `fr` and `ar`.
- `GET /api/administration/homepage/revisions` — immutable history; the previous live revision becomes `Superseded`.
- `GET /api/public/homepage?lang=en|fr|ar` — anonymous; only the live revision, in the requested language (English for an unsupported one), with no operator or draft information. 404 until something is published.

## Content rules
- Sections: `hero`, `announcement`, `stories`, `about`, `join`; `order` lists each at most once. Singleton block ids are the section key. Stories need unique lowercase keys (2–40 chars), at most 50 (a payload-size bound, not a product maximum).
- Text is plain text (title ≤ 200, body ≤ 5000, link label ≤ 80; control characters other than line breaks/tabs refused). The frontend must render it as text, never as HTML.
- A link is an absolute `https` URL without credentials or a path starting with a single `/`. `http`, `javascript:`, `data:`, `mailto:`, protocol-relative and whitespace-containing links are refused.
- Saving a draft never changes the live page.

## Not delivered
Uploaded images/assets, scheduled publication, revert-to-revision, separate approver, delegated editors, and the frontend editor. Local tests do not prove live Cosmos behavior.
