# Owner's checklists: where each item is covered

On 21 November 2026 the owner's six checklists were compared with these prompts. Each item below says where it is handled:

- **Already covered:** the original prompts already had it, and nothing was changed.
- **Strengthened:** the prompts covered part of it, and an item was added for the rest.
- **Added:** the prompts did not cover it, so a new item was added.

Item references use the form `03 C1`, which means Agent 03, Part C, item 1. A bare number such as `04.8` means item 8 of that agent's scope.

## 1. Ways a normal user breaks the app

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Double-tapped pay | Added | 03 C1 (idempotent server), 05 C1 (pending button), 09.14 (test) |
| 2 | Capital letter in the email | Strengthened | 03 A20 (normalization), 03 C3, 09.14 |
| 3 | Apostrophe in a name | Added | 03 C4, 09.14 |
| 4 | iPhone photo upload (HEIC) | Strengthened | 03 B17 (uploads), 03 C5, 09.14 |
| 5 | Password reset email | Strengthened | 03 B15, 08.12 (SPF/DKIM/DMARC), 09.6, 03 C7 (link scanners) |
| 6 | Another time zone | Added | 03 C9, 09.14 |
| 7 | Lost signal after paying | Strengthened | 03 B18 (webhooks), 03 C2, 09.14 |
| 8 | No delete button | Already covered | 03 B20, 06 B11, 09.8 |
| 9 | Hid my email (Apple relay) | Added | 03 C8, 09.14 |
| 10 | 10,000 at once (pooling, caching, load test) | Added | 04.8, 09.17 |

## 2. Ways the app runs up a huge bill

| # | Item | Status | Where |
|---|---|---|---|
| 1 | AI in a loop all night | Added | 07.7 |
| 2 | Whole book pasted into the chat | Already covered | 07.4 (input and upload caps, per-user limits) |
| 3 | Free trial every day | Added | 03 C10 |
| 4 | 10,000 fake accounts | Strengthened | 03 B10 (signup rate limit), 03 C10 |
| 5 | 5 GB profile picture | Strengthened | 03 B17 (size limits), 03 C6 (enforced before reading, quotas) |
| 6 | Generate x100 at once | Added | 03 C13, 07.8 |
| 7 | Invite spam x10,000 | Added | 03 C11 |
| 8 | Demo video x1,000,000 | Strengthened | 08.10 (spend caps), 04.9 (CDN, signed URLs) |
| 9 | Your AI, my app | Added | 07.9 |
| 10 | Login code x10,000 | Strengthened | 03 B10, 03 C12 (per phone, email and IP) |

## 3. Showing up on Google

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Server-render pages | Added | 06.16, 09.16 |
| 2 | Real links | Added | 05 C7 |
| 3 | Search Console | Added | 06.20 |
| 4 | sitemap.xml | Already covered | 06.15 |
| 5 | Hunt stray noindex | Added | 06.17, 09.16 |
| 6 | Real 404s | Strengthened | 05 B6 (page design), 06.18 (HTTP status), 09.16 |
| 7 | One URL per page | Strengthened | 06.15 (canonical), 08.11 (www), 06.19 |
| 8 | Unique title per page | Already covered | 06.15 |
| 9 | Same content on mobile | Added | 05 C8 |
| 10 | Image alt text | Already covered | 05 B2 |
| 11 | Structured data | Already covered | 06.15 |
| 12 | Core Web Vitals | Strengthened | 04 baseline, 08.6, 04.10 (targets) |
| 13 | Fact-check AI content | Added | 06.21 |
| 14 | Claim Google Business Profile | Added | 06.20 |

## 4. Signs an app was vibe coded

| # | Item | Status | Where |
|---|---|---|---|
| 1 | API keys in the frontend | Already covered | 02 B1 |
| 2 | No row-level security | Already covered | 03 A12, 03 B3, 03 B19 |
| 3 | Paywall hidden with CSS | Added | 03 C14 |
| 4 | Login checked in the browser | Strengthened | 03 B19, 03 C14 |
| 5 | /admin with no password | Already covered | 03 B8 |
| 6 | No rate limiting | Already covered | 03 B10 |
| 7 | Anyone can delete your data | Strengthened | 03 B19, 03 C17 |
| 8 | Signup you forgot to turn off | Added | 03 C15 |
| 9 | Emails in every API response | Added | 03 C16 |
| 10 | No security headers | Already covered | 03 B12 |
| 11 | Email confirmation off | Already covered | 03 B16, 09.7 |
| 12 | Packages that don't exist | Added | 02 B9 |
| 13 | Outdated framework (Next.js) | Strengthened | 02 B5, 02 B10 |
| 14 | Empty catch blocks | Added | 02 B11 |
| 15 | "Something went wrong" | Strengthened | 05 B6, 05 C5 |
| 16 | Rocket emoji in console.log | Added | 02 B11 |
| 17 | A comment on every line | Added | 02 B11 |
| 18 | One 2,000-line component | Added | 05 C9 |
| 19 | useEffect for everything | Added | 05 C9 |
| 20 | key = index | Added | 05 C9 |
| 21 | Same function four times | Added | 02 B11 |
| 22 | Dead code everywhere | Already covered | 02 B6 |
| 23 | Zero tests | Already covered | 09.1–09.13 |
| 24 | Commit message "fix" | Added | 08.16 |
| 25 | README full of emojis | Added | 08.15 (amended) |
| 26 | Folder tree in the README | Added | 08.15 (amended) |
| 27 | .env on GitHub | Already covered | 02 A1, 02 B3 |
| 28 | Fix one bug, break three | Strengthened | 08.1 (CI), 09.3 (regression tests), 08.16 (branch protection) |
| 29 | AI has prod database access | Added | 08.18 |
| 30 | You can't explain your own code | Added | 08.17 |

## 5. Ways the app gets sued

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Marketing without consent | Strengthened | 06 B3 (opt-ins), 06.23 (sending) |
| 2 | No DMCA agent | Strengthened | 06 B14 (takedown process), 06.24 |
| 3 | Unencrypted data | Strengthened | 03 B3, 03 C18 |
| 4 | No AI policy guidelines | Added | 06.22 |
| 5 | FaceID without consent | Added | 03 C19, 06.26 |
| 6 | Meta pixel before cookies | Already covered | 06 B2, 06 B6 |
| 7 | No alt text | Already covered | 05 B2 |
| 8 | No age gate | Strengthened | 06 B13 (COPPA), 06.25 |
| 9 | No unsubscribe | Strengthened | 06 B13 (CAN-SPAM), 06.23 |
| 10 | No proof of AI claims | Strengthened | 06 B8 (claims), 06.22 |

## 6. Tells that the app was vibe coded

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Buttons wait for the server | Strengthened | 04.5 (optimistic UI), 05 C1 |
| 2 | Blank loading screens | Strengthened | 05 B6 (skeletons), 05 C3 |
| 3 | Screens open empty | Strengthened | 05 B6 (empty states), 05 C4 |
| 4 | Missing tap animations | Added | 05 C2 |
| 5 | No offline support | Added | 05 C6 |

## Totals

| Status | Count |
|---|---|
| Already covered | 17 |
| Strengthened | 25 |
| Added | 37 |
| **Total** | **79** |
