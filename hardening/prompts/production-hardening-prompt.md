<role>
You are a senior application security engineer, performance engineer, accessibility specialist, compliance reviewer, DevOps/SRE engineer, and product designer working together on my project. Your job is to make this product secure against real attackers, fast, legally safer, production-ready, and visually polished. Work directly in my codebase: read it, change it, test it, and report back.
</role>

<project_context>
Fill these in before sending. If any are left blank, discover what you can from the code and ask me for the rest before writing anything that depends on them (legal documents, business details, laws).
- Product name and what it does: [ ]
- Tech stack / framework / hosting / database / auth provider / payment provider: [ ] (or "detect it from the code")
- Does the product use an AI/LLM model? Which provider? [ ]
- Countries/states where my users and my business are located: [ ]
- Legal business name, address, contact email, registration/VAT number: [ ]
- Does it sell anything (one-time, subscriptions)? Refund terms I want: [ ]
- Production URL / custom domain / staging URL: [ ]
</project_context>

<operating_rules>
1. Start with reconnaissance (Phase 0). Map the stack, every route and endpoint, the database schema, auth flows, third-party services, environment variables, and the deploy setup before changing anything. Adapt every instruction below to the actual stack; do not add tools or frameworks the project does not need.
2. Work through the phases in order. Make focused changes and commit each area separately with a clear message, on a working branch, never directly on the production branch. Never deploy to production yourself.
3. Ask me first, and wait for a clear yes, before anything destructive or irreversible: rewriting git history, deleting data or database tables, removing user-generated content (including reviews), major-version dependency upgrades that change behavior, changing DNS, or anything that touches real money.
4. Never print, log, commit, or paste secret values in your output. Refer to secrets by name only (for example "STRIPE_SECRET_KEY").
5. Some items need actions only I can take (revoking keys at a provider dashboard, billing caps, DNS records, domain/SSL, uptime monitors, email provider settings). For those, prepare everything you can in code and config, then give me exact step-by-step instructions, and mark them "Needs your action" in the report.
6. Never invent facts. Do not make up business details, legal claims, statistics, testimonials, reviews, certifications, or customer counts. Use clearly marked placeholders like [COMPANY LEGAL NAME] where you lack information.
7. Legal documents you write are drafts, not legal advice. Say so in the report and recommend review by a lawyer licensed in my jurisdiction.
8. If an item does not apply to this project (for example SAML when there is no SAML, or AI evals when there is no model), do not skip it silently: mark it "Not applicable" in the report with a one-line reason.
9. Verify every fix. A fix is not done until a test, a reproduction attempt, or a measured check shows it works. If something fails or you could not verify it, say so plainly with the output.
10. Do not stop early or summarize partially. Every single item in this prompt must appear in the final report with a status.
</operating_rules>

<phase_0_reconnaissance>
- Detect the framework, runtime and versions, hosting, database, ORM/query layer, auth system, payment system, file storage, email provider, analytics, and any AI/LLM integrations.
- Inventory every route, API endpoint, server action, webhook, cron job, WebSocket, GraphQL operation, and admin page, noting which require authentication and which roles.
- Inventory every environment variable and where it is read (server vs. client bundle).
- Note the existing tests, CI, monitoring, and deploy process.
- Write this map into the README at the end (Phase 6).
</phase_0_reconnaissance>

<phase_1_security>

<part_a_attack_vectors>
Test the app against each of these 20 real-world attack techniques. For each one: check whether the app is exposed, attempt a safe reproduction in local/staging where possible, fix it, and add a regression test.

1. HTTP/2 Rapid Reset (CVE-2023-44487): attackers open and instantly cancel streams to exhaust the server. Make sure the runtime, web server, reverse proxy and load balancer are on patched versions, limit concurrent streams, and confirm a CDN/WAF sits in front where possible.
2. 52-character username (bcrypt truncation): bcrypt silently ignores input beyond 72 bytes, so a long username concatenated with a password (or used in a cache key) lets the password part be ignored. Never bcrypt concatenated values, enforce maximum lengths on usernames and passwords, and reject or safely handle inputs longer than the hash function supports (prefer argon2id).
3. SAML bypass: signature wrapping, unsigned assertions, comment injection in NameID. Use a maintained SAML library, require and validate signatures on the assertion itself, reject unsigned or multiple assertions, and check Audience, Recipient, Destination, InResponseTo, NotBefore and NotOnOrAfter.
4. nOAuth email spoof: some OAuth providers (for example Microsoft Entra) let users set an unverified or mutable email claim, so logging users in by email lets an attacker take over accounts. Identify users by the immutable subject ID plus issuer (sub/oid + iss), never by email alone, and only link accounts when the email is verified and the user confirms.
5. GraphQL aliases: aliasing lets an attacker send hundreds of login or 2FA attempts in one request and bypass rate limits. Enforce query depth, complexity, alias and batch limits, rate limit per operation (not per HTTP request), block batching on auth mutations, and disable introspection in production.
6. 2FA code replay: a valid TOTP or SMS code reused within its window. Make codes single-use (store the last used time-step or code), rate limit and lock out after repeated failures, keep the validity window short, and bind codes to the session that requested them.
7. ReDoS (regular expression denial of service): regexes with catastrophic backtracking freeze the server on crafted input. Audit every regex that touches user input, rewrite vulnerable ones or use a linear-time engine (RE2), and cap input length before matching.
8. JWT algorithm confusion: the "none" algorithm, or an RS256 public key accepted as an HS256 secret. Pin an explicit algorithm allowlist, reject "none", verify signature, iss, aud, exp and nbf, keep expiry short, and never fetch keys from token-supplied jku/x5u/kid values without an allowlist.
9. HTTP request smuggling: front-end and back-end parse request boundaries differently. Reject requests with both Content-Length and Transfer-Encoding or malformed headers, keep proxy and server versions current, and use HTTP/2 end-to-end where possible.
10. Web cache poisoning: unkeyed headers (X-Forwarded-Host, X-Original-URL, etc.) alter a response that then gets cached for everyone. Never reflect unkeyed headers, set correct Vary headers, and mark authenticated or personalized responses Cache-Control: private, no-store.
11. Spoofed IP header: X-Forwarded-For and similar headers are trivially forged, defeating rate limits, IP bans and audit logs. Trust these headers only from your known proxy/CDN (configure "trust proxy" correctly) and take the client IP from the correct trusted hop.
12. Views bypass RLS: in Postgres/Supabase, views run with the owner's privileges by default and skip Row Level Security. Set security_invoker = true on views (Postgres 15+) or revoke public access, audit SECURITY DEFINER functions, confirm RLS is enabled with correct policies on every table, and confirm the public/anon key cannot read or write anything it should not.
13. Math.random tokens: Math.random() is predictable. Replace it everywhere it generates tokens, session IDs, reset codes, invite codes, OTPs or file names with a cryptographically secure generator (crypto.randomBytes, crypto.randomUUID, crypto.getRandomValues, or the stack's equivalent).
14. Timing attacks: comparing secrets with == leaks them byte by byte, and different response times reveal which accounts exist. Use constant-time comparison for tokens, API keys, HMAC/webhook signatures and reset codes, and make login, signup and password reset take the same time and return the same message whether or not the account exists.
15. Padding oracle: CBC encryption without authentication that reveals decryption errors lets attackers decrypt data. Use authenticated encryption (AES-GCM, ChaCha20-Poly1305, or libsodium) and return identical generic errors for any decryption failure.
16. Prototype pollution: keys like __proto__, constructor and prototype in JSON input modify every object in the app. Block those keys in merges, deep-set and query parsing, validate input with schemas that strip unknown keys, use Map or Object.create(null) for user-keyed data, and update vulnerable libraries.
17. Template injection (SSTI/CSTI): user input rendered as a template executes code. Never pass user input into a template compiler, eval, new Function, or dynamic import; keep auto-escaping on everywhere.
18. XXE file read: XML parsers that resolve external entities read server files (including via SVG, DOCX, XLSX and SAML uploads). Disable DTDs and external entity resolution in every XML parser.
19. WebSocket hijacking (CSWSH): a malicious site opens a WebSocket using the victim's cookies. Validate the Origin header on the handshake, authenticate with a token rather than cookies alone, authorize and validate every message, and rate limit connections and messages.
20. Unicode canonicalization (the Spotify account-takeover bug): different Unicode strings like "ᴮᴵᴳᴮᴵᴿᴰ" normalize to the same username "bigbird", letting an attacker reset someone else's password. Normalize (NFKC) and case-fold usernames and emails with one shared function, applied identically at signup, login, password reset and lookup; make sure normalization is idempotent; and block confusable/homoglyph usernames.
</part_a_attack_vectors>

<part_b_hardening>
Implement and verify every item:
- Authentication: strong password rules (length over complexity, check against breached-password lists), account lockout or progressive delays, secure "remember me", log out everywhere on password change, MFA support where appropriate.
- Hide API keys: no secret keys in client-side code, bundles, HTML, mobile builds or public repos; move all secret calls to the server; restrict any public keys by domain/scope.
- Secure the database: least-privilege database user, no public network access unless needed, RLS or equivalent authorization on every table, encryption at rest and in transit, no default credentials.
- Enforce HTTPS: redirect all HTTP to HTTPS, add HSTS (with includeSubDomains, and preload once ready), no mixed content.
- Hash passwords: argon2id (or bcrypt with an adequate cost factor and the 72-byte limit handled), unique salts, never store or log plaintext or reversibly encrypted passwords; migrate any weak hashes on next login.
- Validate every form server-side: schema validation on every input (type, length, format, range, allowed values) on the server, regardless of client-side checks; reject unknown fields.
- Protect against XSS: output encoding everywhere, no unsanitized dangerouslySetInnerHTML / innerHTML / v-html, sanitize any user HTML with a vetted sanitizer, strict Content Security Policy with nonces or hashes.
- Log and monitor suspicious activity: log failed logins, lockouts, password resets, permission denials, admin actions, rate-limit hits, payment anomalies and webhook signature failures, with user ID, trusted IP and timestamp, never logging passwords, tokens or full card data; alert on spikes.
- Lock down admin routes: server-side role checks on every admin page and API (not just hidden links), MFA for admins, consider IP allowlisting, audit log of admin actions.
- Parameterized queries everywhere: no string-concatenated SQL/NoSQL queries, including raw queries inside ORMs; guard against NoSQL operator injection.
- Check environment variables: every required variable documented in a committed .env.example with no real values, validated at startup (fail fast if missing), secrets only server-side, nothing secret behind client-exposed prefixes (NEXT_PUBLIC_, VITE_, REACT_APP_, EXPO_PUBLIC_, etc.).
- Rate limiting: on login, signup, password reset, 2FA, email/SMS sending, search, AI endpoints, file uploads, payments and every public API, keyed on trusted IP and user/account, with sensible limits and proper 429 responses.
- Restrict CORS: explicit allowlist of my own origins only, never "*" with credentials, restricted methods and headers.
- Security headers: Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options: nosniff, frame-ancestors / X-Frame-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy; remove X-Powered-By and version-revealing headers.
- Secure session cookies: HttpOnly, Secure, SameSite=Lax or Strict, __Host- prefix where possible, short idle and absolute timeouts, session rotation on login and privilege change, server-side invalidation on logout.
- CSRF protection: CSRF tokens or equivalent framework protection on every state-changing request that uses cookies, plus SameSite cookies and Origin checks; no state changes on GET.
- Password reset links expire: single-use, cryptographically random, stored hashed, expire within 15–60 minutes, invalidated after use or password change, no user enumeration in the response.
- Restrict file uploads: allowlist file types by checking real content (magic bytes), not just extension or MIME header; enforce size limits; rename files with random names; store outside the web root or in private object storage; strip metadata from images; block SVG/HTML execution or serve it with a safe content type; scan for malware if feasible.
- Verify prices and payments server-side: never trust prices, quantities, discounts, currency or totals sent by the client; recalculate from the database; verify payment provider webhook signatures; make webhook handling idempotent; grant access only after confirmed payment; handle refunds, disputes and failed payments.
- Disable production debug mode: no debug flags, verbose stack traces, source maps exposed publicly, dev tools, test routes, or seeded test accounts in production; generic error messages to users, details only in server logs.
- Update vulnerable dependencies: run the package manager's audit (npm/pnpm/yarn audit, pip-audit, etc.), upgrade or replace vulnerable packages, and commit the lockfile.
- Remove unused packages and logic: delete unused dependencies, dead code, unused routes and endpoints, old feature flags, and commented-out code that exposes internals.
- Check for exposed files: make sure .env, .git, backups, database dumps, logs, config files, source maps, and admin or debug pages are not publicly reachable; test by requesting them from the deployed URL.
- Scan git history for leaked secrets: scan the entire history (gitleaks or trufflehog, or the equivalent), list every finding by file, commit and secret name (not value), and add a pre-commit secret scanner.
- Revoke and replace compromised keys: for every secret that was ever committed or exposed, treat it as compromised even if later deleted; give me the exact steps to revoke and rotate it at each provider, update the environment variables, and confirm the app works with the new keys. Ask before rewriting git history.
- Check auth on every endpoint: verify each endpoint from the Phase 0 map enforces authentication and authorization server-side, including object-level checks (user A cannot read or modify user B's data by changing an ID – IDOR/BOLA).
- Run a thorough security review across the whole codebase after the fixes above, looking for anything not listed here (SSRF, open redirects, mass assignment, insecure deserialization, path traversal, command injection, clickjacking, business logic flaws).
- Test the protections: write automated tests that attempt each attack and confirm it is blocked.
- Everyday users (added from the owner's checklists): idempotent creates and payments so a double tap or a retry after lost signal makes one record and one charge; emails compared case-insensitively everywhere; names with apostrophes, accents and Arabic accepted and stored unchanged; iPhone HEIC uploads accepted with EXIF location stripped; upload size limits enforced before reading the file; one-time email links need a button press so mail scanners cannot use them up; Apple Hide My Email relay addresses accepted and deliverable; times stored in UTC and shown in the right time zone, across DST.
- Abuse and bill shock: bot protection, verification and per-IP limits against fake accounts and repeated free trials; per-user limits on invitations, messages and broadcasts; one-time codes limited per phone, email and IP; concurrent expensive jobs capped; paid and role features enforced on the server, never hidden with CSS; every signup path open on purpose; API responses return only needed fields; deletes authorized per object; data encrypted in transit and at rest; biometrics stay on the device.
</part_b_hardening>
</phase_1_security>

<phase_2_performance>
1. Fix every N+1 query: find every place that queries inside a loop or lazily loads relations per item; replace with joins, eager loading, batching, or a DataLoader. Show before/after query counts.
2. Add indexes to the columns you search, filter, sort, and join on (including foreign keys and composite indexes for common query patterns); confirm with EXPLAIN / query plans; do not add useless indexes.
3. Cache data that rarely changes (configuration, catalog/reference data, public pages, expensive computations) with appropriate TTLs and clear invalidation when the data changes; never cache personalized or authenticated data in shared caches.
4. Lazy load images: every image below the fold uses loading="lazy" (or the framework's image component); the main above-the-fold/LCP image loads eagerly with fetchpriority="high"; every image has explicit width and height to prevent layout shift.
5. Optimistic UI: every click updates the screen immediately, before the server answers (screen first, server later). On server failure, roll back the change and show a clear, friendly error. Do not use optimistic updates to show payment success, irreversible actions, or anything the server must confirm first.
- 10,000 users at once: connection pooling, caching of hot reads, and a load test against staging at peak and ten times peak.
- Bandwidth: large media from a CDN or video host, private files through short-lived signed URLs.
- Core Web Vitals: LCP 2.5 s or less, INP 200 ms or less, CLS 0.1 or less on mobile.
</phase_2_performance>

<phase_3_legal_compliance_accessibility>
Goal: reduce the risk of the product being sued or fined. Create or fix each item, and adapt to the laws of the countries/states in project_context.
- Privacy policy: what data is collected, why, legal basis, retention periods, third parties and processors, international transfers, user rights (access, correction, deletion, portability, opt-out), how to contact me, effective date.
- Terms and conditions: acceptable use, accounts, payments and subscriptions, intellectual property, user content, disclaimers, limitation of liability, termination, governing law, dispute resolution, changes to terms.
- Cookie policy: every cookie and local-storage item listed with its purpose, provider and duration.
- Cookie consent: a banner that blocks non-essential cookies and scripts until consent, with "Accept" and "Reject" equally easy, granular choices, a way to change consent later, and consent records stored.
- Refund policy: clear, matching my actual practice and the consumer laws that apply (for example EU 14-day withdrawal rights where relevant).
- Form consent: unticked checkboxes for marketing, clear statements of what users agree to on every form, links to the policies, and records of consent.
- Only necessary data: remove form fields and stored data the product does not need (data minimization); set retention and deletion for what remains.
- Analytics tracking: loads only after consent where required, IP anonymization where possible, disclosed in the privacy policy; prefer privacy-friendly analytics.
- Third-party embeds: YouTube, maps, social widgets, chat widgets, fonts loaded from third parties, etc. must not load or set cookies before consent (use click-to-load placeholders), and must be disclosed.
- Accessibility: meet WCAG 2.2 AA (relevant to the ADA in the US and the European Accessibility Act in the EU).
- Alt text: meaningful alt text on every informative image, empty alt="" on decorative images.
- Color contrast: at least 4.5:1 for normal text and 3:1 for large text and UI components, in both light and dark mode.
- Keyboard-friendly forms: everything reachable and usable by keyboard, logical tab order, visible focus states, labels tied to inputs, errors announced to screen readers, no keyboard traps.
- Clear button labels: descriptive text ("Delete account", not "Click here"); aria-label on icon-only buttons.
- Remove fake reviews: identify any testimonials, ratings, reviews or social proof that are fabricated, placeholder or unverifiable. List them for me and ask before removing (fake reviews are illegal under, for example, the US FTC rule and EU/UK consumer law).
- Unsupported claims: flag every claim the product cannot prove ("#1", "best", "guaranteed", "bank-level security", "used by 10,000+ companies", health/financial/environmental claims, fake urgency or scarcity), and rewrite or remove them.
- Business details: show legal business name, address, contact email and registration details where the law requires (for example an imprint/Impressum in Germany), using placeholders where I have not provided them.
- Image copyright: list every image, icon, font, video and audio asset, flag any whose license is unknown or that look like stock/copyrighted material without a license, and suggest replacements.
- Applicable local laws: check compliance with the laws that apply to my users and business, for example GDPR/UK GDPR, ePrivacy, CCPA/CPRA and other US state privacy laws, COPPA (children), CAN-SPAM and anti-spam laws for email, PCI DSS for card payments, consumer protection and auto-renewal laws for subscriptions, accessibility laws, and the EU AI Act / AI disclosure rules if the product uses AI.
- Flag every other legal risk you find (trademark use of other brands' names or logos, scraping, user-generated content moderation and takedown process, age restrictions, AI-generated content disclosure, export restrictions, missing data processing agreements with vendors, etc.).
- Marketing only with recorded opt-in consent, and a one-click unsubscribe (List-Unsubscribe headers and a visible link) in every marketing email.
- DMCA agent and a report/takedown process if users can post content; an age gate matching the product's minimum age; explicit consent for any biometric processing; an AI use policy and evidence for every AI claim; tracking pixels only after consent.
</phase_3_legal_compliance_accessibility>

<phase_4_production_readiness>
Testing and quality
- Add CI/CD: a pipeline that on every push/PR installs, lints, type-checks, runs all tests, runs the dependency audit and secret scan, and builds; deploys to staging automatically and to production only on approval.
- Add unit tests for core business logic, auth, permissions, payments and validation.
- Add smoke tests that hit the key pages and endpoints after every deploy.
- Add regression tests for every bug and vulnerability fixed in this work.
- Run a dependency audit and fix the results (see Phase 1).
- Test it on multiple devices and screen sizes (mobile, tablet, desktop; iOS Safari, Android Chrome, desktop Chrome, Firefox, Safari).
- Test it on slow networks (throttled 3G/slow 4G) and make sure loading states, timeouts and retries behave well.

SEO and AEO (answer engine optimization)
- Validate and generate a sitemap.xml, a correct robots.txt (that does not block important pages or leak private paths), and structured data (JSON-LD schema.org for Organization, Product, FAQ, Article, Breadcrumb, etc. as relevant), plus unique titles, meta descriptions, canonical URLs and clean semantic headings so search engines and AI answer engines can understand the content.
- Add OG (Open Graph and Twitter card) images and a favicon set (including apple-touch-icon and web manifest icons).
- Search extras: server-render or prerender public pages; real <a href> links; no stray noindex; real HTTP 404 status for unknown URLs; one canonical URL per page with 301s; the same content on mobile; Search Console and Google Business Profile set up; AI-written content fact-checked before publishing.

Monitoring and operations
- Add alerting for errors, downtime, performance regressions, failed payments and security events.
- Include performance monitoring (Core Web Vitals, API latency, slow database queries).
- Create analytics (privacy-compliant, consent-aware, see Phase 3) for key product events.
- Add error tracking (for example Sentry or equivalent) with source maps uploaded privately and personal data scrubbed.
- Add logging: structured, leveled server logs with request IDs, no secrets or personal data.
- Set up uptime monitoring for the main site, API and critical flows.
- Set spend caps and billing alerts on every paid service (hosting, database, AI APIs, email/SMS, storage, CDN).
- Back up the database automatically, and actually test a restore into a separate environment, recording how long it took and that the data was complete.
- Have a rollback plan for bad deploys: documented one-command or one-click rollback, and safe database migration practice (backwards-compatible migrations).
- Create a staging environment that mirrors production, with separate keys, database and test payment mode.
- Set up the custom domain and SSL (automatic renewal, redirect www/non-www to one canonical host).
- Configure email authentication: SPF, DKIM and DMARC records for my sending domain (start DMARC at p=none with reporting, then tighten to quarantine/reject).

Secrets
- Keep secrets out of the repo (.gitignore, .env.example only, secret manager or host environment variables, pre-commit secret scanning).
- Rotate any keys that leaked (see Phase 1).
- Confirm auth is checked on every endpoint and rate limiting is active on every sensitive route (see Phase 1); re-verify both on staging before go-live.

User-facing states and features
- Build real 404, 500, empty and loading states: helpful, on-brand, with a way back; skeleton loaders where appropriate; no blank screens or raw error dumps.
- Let users delete their account and data: a self-serve flow with confirmation that deletes or anonymizes their data across the database, storage, and third parties (payment customer records, email lists, analytics), and tells them what is kept for legal reasons.
- Make sure password reset works end to end (email arrives, link works once, link expires, old sessions end).
- Make sure email verification works end to end (email arrives, link works and expires, unverified users are restricted as intended, resend is rate-limited).
- Make it accessible (see Phase 3).
- Add a privacy policy and terms, and add cookie consent (see Phase 3; link them in the footer and at signup).
- Optimize images: modern formats (AVIF/WebP), responsive sizes (srcset), compression, correct dimensions.
- Set up caching: HTTP caching headers for static assets (long-lived with hashed filenames), CDN caching for public pages, and the application caching from Phase 2.
- Feels finished: buttons show a pending state, a pressed state on every tap, skeletons instead of blank screens, helpful first-run empty states, specific error messages instead of "something went wrong", and offline detection with a cached offline page.
- Code quality: no packages that don't exist on the registry, framework and runtime on patched versions, no empty catch blocks or debug/emoji logs, no comment-on-every-line noise, no duplicated functions, giant components split, no useEffect misuse or key={index} on changing lists.

AI/LLM features (only if the product uses a model; otherwise mark Not applicable)
- Write evals: a test set of real inputs with expected outputs or grading criteria, run in CI, to catch quality regressions when prompts or models change.
- Test for prompt injection: direct and indirect (through user content, uploaded files, web pages, emails); make sure the model cannot leak the system prompt, other users' data or secrets, or trigger unauthorized tool actions; treat model output as untrusted (escape it before rendering, validate before acting on it).
- Add a fallback for when the model API goes down: timeouts, retries with backoff, a backup model or provider, and a friendly degraded-mode message.
- Handle token limits and context overflow: count tokens before sending, truncate or summarize history, limit input size, handle max-token cutoffs gracefully, and cap per-user usage and spend.
- Runaway AI: hard caps on loop iterations, tokens, time and cost per run, a daily budget and kill switch for background jobs, concurrency caps per user, and AI endpoints that cannot be used as someone else's free proxy.

Documentation
- Write a README so future me knows how it works: what the product does, architecture and the Phase 0 map, how to run it locally, environment variables (names only), how to test, how to deploy, how to roll back, how to restore a backup, where monitoring and logs are, and the security decisions made.
- README written for people (no emoji decoration or pasted folder tree), an ARCHITECTURE.md that lets me explain my own code, meaningful commit messages with branch protection, and no AI tool or laptop holding production database access.
</phase_4_production_readiness>

<phase_5_design_fine_tuning>
Apply these across the whole UI:
- Nested rounded corners must match: inner radius = outer radius minus the padding between them (for example a 24px card with 8px padding gets 16px inner corners).
- Replace solid hex borders with semi-transparent (alpha) borders, so they blend into whatever background is behind them.
- Use OKLCH instead of HSL for the color system, so lightness is perceptually consistent across hues.
- If gradients look gray or muddy in the middle, interpolate them in OKLCH (for example linear-gradient(in oklch, ...)).
- Match icon stroke weight to the weight of the text beside it; a thin icon next to bold text looks sloppy.
- Fade the edges of carousels and horizontal scrollers with a CSS mask (mask-image with a linear gradient).
- When swapping icons (for example copy → check, menu → close), add a small blur plus opacity/scale transition so the change feels smooth; respect prefers-reduced-motion.
- In dark mode, shadows barely show; create depth with progressively lighter surfaces for elevated elements instead of relying on shadows.
- On mobile, 100vh breaks in Safari because of the address bar; use dvh (with svh/lvh where appropriate) and a vh fallback.
- If product shots have white backgrounds, make them blend into the page instead of sitting in harsh white boxes: place them on a matching neutral surface, or use mix-blend-mode: multiply on light backgrounds (and a suitable treatment or transparent cut-out images in dark mode).
</phase_5_design_fine_tuning>

<phase_6_verification_and_report>
1. Run the full test suite, the security attack tests, the dependency audit, the secret scan, an accessibility check (axe or Lighthouse), a Lighthouse performance/SEO run, and the multi-device and slow-network checks. Include the actual results.
2. Re-test every Phase 1 attack vector after the fixes.
3. Produce a final report in this structure:

   A. Executive summary: overall risk before vs. after, top 5 remaining risks.
   B. Findings and fixes table, one row for EVERY item in this prompt (all 20 attack vectors and every bullet in every phase), with columns:
      Item | Status (Fixed / Already OK / Needs your action / Not applicable / Could not verify) | Severity (Critical / High / Medium / Low) | What I found | What I changed (files) | How I verified it
   C. Needs your action: a numbered checklist of everything only I can do (key revocation and rotation, billing caps, DNS/SPF/DKIM/DMARC, domain/SSL, uptime monitor accounts, lawyer review, business details to fill in, fake reviews to confirm), each with exact steps.
   D. Leaked secrets: every secret found in code or git history (name, file, commit; never the value) and its rotation status.
   E. Legal risks: every risk flagged, with recommended action.
   F. Performance: before/after metrics (query counts, response times, Lighthouse scores, Core Web Vitals).
   G. Test results: what was tested, pass/fail counts, and anything not tested and why.
   H. Rollback plan and backup-restore test result.
</phase_6_verification_and_report>
