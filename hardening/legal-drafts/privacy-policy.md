# Privacy policy: review draft (Agent 06, Part A)

> **DRAFT. Not for publication.** This must be reviewed by a lawyer licensed in Lebanon before any of it is published. It is not legal advice.
> Prepared 21 November 2026 on branch `hardening/06-legal`.

**Status after Part B (22 November 2026).** Published in `frontend/privacy.html` (both languages):
- P2 (a–i), P5 without placeholders, P8, P10, P11, the factual sentence of P13, P14 and P15.
- Google Fonts is limited to printed sheets (P16, interim). Agent 03's new features are described: self-service copy and closure, password reset, and the 13+ confirmation.
- Rows 32 and 33 of the fact check are now supported by the code.

Still drafts, for the owner and the lawyer: P1, P3, P4, P6 (periods), P7 (objection, response time, complaints), P9 (guardians), P12, the breach sentence of P13, and the GDPR changes in C2.

**Starting point.** The privacy policy is already published in English and Arabic (`frontend/privacy.html`). The owner approved it on 21 November 2026, and its sources are in `docs/operations/legal-pages.md`. This draft keeps that text. It does four things:

- **A.** It checks each statement in the published text against the code.
- **B.** It checks the published text against the contents the hardening prompt requires.
- **C.** It checks the text against the law that applies: Lebanon's Law No. 81 of 2018. It also explains what would change under the GDPR, which applies only if EU users are confirmed. They are not confirmed yet.
- **D.** It proposes each added or changed passage in English, with an Arabic version for each.

**Markers.** `[PLACEHOLDER: …]` marks a fact only the owner can supply. `[ASSUMPTION: …]` marks something that was not confirmed in the code. `[COUNSEL: …]` marks a legal point for the lawyer. No entity name, address or registration number is invented.

---

## A. Fact check: the published text against the code

Verdicts:
- **Verified**: the code does what the text says.
- **Imprecise**: true, but it could mislead.
- **Incomplete**: the code collects or does more than the text says.
- **Not supported**: the text promises something the code cannot do today.
- **Could not verify**: the fact depends on Azure settings or third parties, which cannot be checked from the repository.

| # | Published statement (English) | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Account data: username, email, display name, language and colours, optional profile details | **Incomplete** | `ParishUser`, `AccountProfile` (given/family names in two scripts, town, address, occupation, "about") match. The account also holds the parishes you follow (`ParishFollow`), notification choices (`NotificationPreferences`), private notes and to-dos (`PersonalWorkspaceItem`, stored encrypted, `docs/operations/personal-workspace.md`), and a drawn signature and title (`AccountSignature`). → P2 |
| 2 | Password stored only as a one-way hash | Verified | ASP.NET Core Identity hasher; `ServiceCollectionExtensions` (`AddIdentityCore`, minimum length 16) |
| 3 | Authenticator key and recovery codes stored protected | Verified | `ParishUser.AuthenticatorKey`, `ProtectedRecoveryCodes`; Data Protection in `CosmosIdentityStore` |
| 4 | Passkeys: only the public key is stored | Verified | `AccountPasskey`; `PasskeyService` keeps the ceremony state in a protected one-use value, not a cookie |
| 5 | Google/Microsoft: a hashed identifier; at sign-up, the provider-confirmed name and email | Verified | `AccountExternalLogin.SubjectHash`; `ExternalIdentityClaims`; scopes `openid email profile` (`ExternalProviderOptions`) |
| 6 | Sessions: when each sign-in started and how | Verified | `AccountSession(Id, AccountId, SecurityStamp, CreatedAt, ExpiresAt, Revoked, AuthenticationMethod)`. No IP address or device is stored. |
| 7 | Parish records: name, family, contact, households, sacraments, certificates, membership, attendance, registrations, contributions, receipts, letters | **Incomplete** | Also kept:<br>• date of birth and rite (`Person`);<br>• address, occupation, skills, date and evidence of death (`PersonFacts`);<br>• relationships (`PersonRelationship`);<br>• consents (`PersonConsent`);<br>• catechism and formation progress (`Formation*`);<br>• volunteering (`Volunteer*`);<br>• prayer intentions (`PrayerIntention`);<br>• people authorised to collect a child, with their authority (`AuthorizedCollector`);<br>• check-in and evacuation rolls (`PresentRoster`, `Evacuation*`);<br>• facility renters (`Renter`);<br>• clergy signature images (`ClergySignatureImage`).<br>→ P2 |
| 8 | Sensitive records protected at rest and readable only by designated roles | Verified | `PersonMedical`, `PastoralNote`, `Concern`, `Incident` (protected content), as recorded in `legal-pages.md` |
| 9 | Requests and messages to a parish, with files; guest requests store name and contact | **Incomplete** | `ParishRequest`, `RequestMessage`, `EvidenceFile` match. The inbox (`Conversation`, `InboxMessage`) also covers staff-to-staff messages. A reported message can be read by platform operators (`MessageReport`, `docs/operations/communications.md` N02). → P2, P8 |
| 10 | Audit records of who changed what and when | Verified | `AuditRecord` (actor, action, resource, time, reason, acting appointment). No IP address is stored. |
| 11 | Anonymous site counts: no IP, device, visitor ID or search text | Verified | `SiteMetric` (Day, Kind, Language, ParishId, Shard, Count) |
| 12 | Technical logs of requests and errors | **Could not verify** (contents and retention) | `TelemetryExtensions`: OpenTelemetry to Azure Monitor, only when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set. Request telemetry normally records the request URL, which includes query text such as a directory search (`GET /api/public/parishes?q=`). Azure Monitor derives an approximate location from the IP address and masks the IP by default. That default is an Azure setting and was not checked. Application logs avoid personal data: the log statements carry failure types only. → handoff to Agent 08 |
| 13 | No selling, no advertising, no advertising or analytics trackers | Verified | No tracker in `frontend/`. The production page policy (checked by GET on 21 Nov 2026) allows scripts only from the site and `challenges.cloudflare.com`, and styles and fonts only from the site and Google Fonts. |
| 14 | Who can see it (you, parish roles, bishop, operators, public) | **Incomplete** | Operators also:<br>• review reported messages (N02);<br>• approve requests to recover two-step sign-in (`MfaRecoveryRequest`);<br>• can take private backup snapshots (`DataSnapshotManifest`, `docs/operations/data-snapshot-and-recovery.md`).<br>→ P8, P6 |
| 15 | Azure France Central hosts the database, files, keys and monitoring | Could not verify from code | This is the deployment setting recorded in `PROJECT_CONTEXT.md` and `docs/operations/frontend-hosting.md` |
| 16 | Cloudflare: DNS and Turnstile | Verified | `frontend/src/lib/turnstile.js`, `TurnstileVerifier`. Production answers with `Server: Kestrel` and no `CF-Ray` header, so Cloudflare does not proxy the site's traffic (HEAD request, 21 Nov 2026). "DNS only" is therefore accurate. |
| 17 | Google and Microsoft only if you choose to sign in with them | Verified | Each provider exists only when it is configured (`RegisterAuthenticationCapabilities`) |
| 18 | Resend sends only the email-confirmation codes | Verified | `ResendContactCodeDelivery` is registered only when `Email:Provider`, `Email:ResendApiKey` and `Email:From` are all set; `ContactVerification.Purpose`. Resend receives the email address and the code. |
| 19 | Google Fonts on the members portal and the product page | Verified | `index.html` (sign-in and portal), `landing.html`, `src/portal/shared/print.js` (printed sheets). The public site and the legal pages host their fonts themselves (`/assets/fonts`). |
| 20 | No newsletters, marketing email, text messages or online payments | Verified | Broadcast channels report NotConfigured. There is no payment provider. Parishes can send **in-app** announcements (`Broadcast`), which are not email. |
| 21 | Session cookie: up to 8 hours, ended at sign-out | **Imprecise** | `__Host-ParishLife` is a browser-session cookie with no Expires attribute (`AccountCookieService`: `IsPersistent = false`), so it also goes when the browser closes. The sign-in inside it ends 8 hours after sign-in, and activity does not extend it (`SlidingExpiration = false`). A recovery sign-in ends after 15 minutes (`AccountSessionService`). → P14 |
| 22 | Security cookie against form forgery | Verified | `__Host-ParishLife.Csrf` (`Program.cs`). Production sets it as a browser-session cookie, `Secure; SameSite=Strict; HttpOnly` (GET `/api/auth/csrf`, 21 Nov 2026). |
| 23 | Short-lived cookies during a Google or Microsoft sign-in (minutes) | Verified | `.AspNetCore.Correlation.*` (15 minutes, framework default), `Identity.External` (5 minutes, framework default), `__Host-ParishLife.ExternalMfa` (10 minutes at most, `ExternalSignInService`) |
| 24 | Language, reading preferences and screen choices in browser storage | Verified | See `cookie-policy.md`. One key, `pl-anniversaries-<account id>`, contains the account's internal ID, and neither it nor `pl-finance-session:<parish id>` is cleared at sign-out. → handoff to Agent 03 |
| 25 | A copy of the public pages for offline use | Verified | `public/sw.js` (Cache Storage `parishlife-public-v2`), registered only by the public site (`src/public/main.jsx`) |
| 26 | "All of these are needed for the site to work" | Imprecise | The cookies are strictly necessary. The preference keys and the offline copy are functional rather than strictly necessary. This is fine under Lebanese law and matters only under EU ePrivacy rules (section C2). |
| 27 | Records kept until removal; nothing deleted automatically | Verified | Cosmos time-to-live is disabled and checked (`InfrastructureReadiness`). "No retention classes are approved" (`CapabilityService`). |
| 28 | Sessions end after 8 hours, sign-in codes after a few minutes | **Imprecise** | Email codes last 15 minutes (`ContactVerificationService`). Passkey ceremonies last 5 minutes. A recovery sign-in lasts 15 minutes. → P6 |
| 29 | Backups: restore point in the last 7 days; deleted files recoverable for 30 days | **Could not verify**; **Incomplete** | These are Azure settings. Operator snapshots also exist, and they have no retention period or storage place set (`data-snapshot-and-recovery.md`: "U15 inputs"). → P6 |
| 30 | Technical logs deleted after 90 days | **Could not verify** | `legal-pages.md` itself says this must be confirmed in Azure |
| 31 | In-app rights (profile, password, sign-in methods, sessions, own data, corrections, closure) | Verified | `PersonDataService` (`me/data`, closure requests), `ProfileCorrection`, account routes |
| 32 | By request: "a copy of your data, deleting your account" | **Not supported by the code today** | There is no export file ("an exportable own-data file" is listed as not implemented in `person-facts-and-consents.md`). Account deletion is refused (`CosmosIdentityStore.DeleteAsync` returns `DeletionRequiresReview`), and operators can only suspend an account (`AccountStatusService`). The promise can be kept only by a manual procedure, and none exists yet. → Needs your action; handoff to Agent 03 |
| 33 | Accounts are for people aged 13 or older | **Not enforced** | Sign-up asks for no age or date of birth (`RegisterAccountDto`, `Auth.jsx`). The rule exists only in the text. This is Part B item 25. |
| 34 | Governed by the laws of Lebanon | Matches the owner's decision | `OWNER-QUESTIONS.md` 21a |
| 35 | Arabic section: "تاريخ السريان: 21 November 2026" | Cosmetic | The date is in English inside the Arabic text. → P15 |

No statement is flatly contradicted by the code. Row 32 is the serious one: the policy promises account deletion and a copy of your data, and the code has no way to deliver either.

---

## B. Required contents (prompt, Part A item 1)

| Required item | In the published text? | Proposed change |
| --- | --- | --- |
| What data is collected | Yes, incomplete (rows 1, 7, 9) | P2 |
| Why | Yes, one sentence | P3 |
| Legal basis for each purpose | **No** | P3 |
| Retention periods | Partly; "until removal" with no periods | P6 (periods are an owner decision, question 15) |
| Third parties and processors | Yes | P5, P8, P14 |
| International transfers | **No** | P5 |
| Rights: access, correction, deletion, portability, objection, opt-out of sale or sharing | Access, correction and deletion: yes. Objection: **no**. Portability: "a copy" only. Sale: "we do not sell". | P3, P7 |
| How to exercise rights | Email only; no response time or identity check | P7 |
| Contact | Email only; **no legal entity or address** | P1 |
| Children's data | Two sentences | P9 |
| AI data use | **No**, and the product uses no AI (no model calls in the code) | P10 |
| Biometrics (Part B item 26, wording needed now) | **No** | P11 |
| Security | **No** | P13 |
| Changes to the policy | One sentence, no notice | P12 |
| Effective date | Yes | Set `[EFFECTIVE DATE]` when the changes are published |

---

## C. Law check

### C1. Lebanon: Law No. 81 of 10 October 2018 on Electronic Transactions and Personal Data

Source for the summary below: DLA Piper, *Data Protection Laws of the World: Lebanon* (last reviewed in 2022). Article numbers were not confirmed. `[COUNSEL: confirm each point and its article against the Official Gazette text.]`

| Requirement (as summarised) | Status of the published policy | Action |
| --- | --- | --- |
| Data collected fairly, for specific and legitimate purposes; relevant, not excessive, accurate and up to date | Fits in principle | Part B item 4 (data minimisation) |
| Tell people who the controller is | **Gap.** "ParishLife" is not a legal person. | P1, plus the operator's legal details (Needs your action) |
| Tell people the purposes | Present | P3 makes it per purpose |
| Tell people whether answers are mandatory, and what happens if they don't answer | **Gap** | P4 |
| Tell people who receives the data | Present | P5, P8 add detail |
| Right of access and correction | Present (in app and by email) | P7 |
| Right to object for legitimate reasons, including to marketing | **Gap** | P7 |
| Declaration to the Ministry of Economy and Trade before processing, with exemptions (for example for non-profits processing their members' data) | **Not addressed** | Needs your action: counsel to decide whether ParishLife, each parish, or both must file. |
| Licence for health, genetic and sex-life data (with the Ministry of Public Health) | **Not addressed.** Parishes can keep medical and allergy notes (`PersonMedical`). | Needs your action: counsel to decide whether a licence is needed. If it is, keep medical notes switched off until it is granted. |
| Security measures suited to the risk | Not stated | P13 |
| Unsolicited marketing email needs consent | Not applicable today: no marketing email | Revisit if a newsletter is added |
| Cross-border transfers | The law is reported to be silent | Disclose anyway (P5) |
| Regulator | None. Enforcement is through the courts. | P7 names the courts, not a data protection authority |

Religion is not listed as a special category in the summary. Even so, every record in ParishLife shows a person's church membership. `[COUNSEL: confirm whether any other Lebanese rule (for example on personal status records) limits processing of religious affiliation.]`

### C2. If EU (or UK) users are confirmed: what the GDPR would change

This does not apply today. Users are Lebanese parishes. Diaspora parishes are "Not provided" in `PROJECT_CONTEXT.md`. If one EU parish joins:

1. **Roles.** For parish records the parish is the controller and ParishLife is its processor. The operator would need a written data processing agreement with each parish (Art. 28). ParishLife stays the controller for accounts, security logs and site counts.
2. **Special categories (Art. 9).** Sacraments and membership reveal religious belief, and medical notes are health data. For parishes the likely basis is Art. 9(2)(d) (a religious not-for-profit body, for its members). Health notes otherwise need explicit consent. In Germany, Catholic bodies apply the Church's own data protection law (KDG) under Art. 91. `[COUNSEL]`
3. **Notice contents (Art. 13 and 14).** All of the following become mandatory:
   - a legal basis for each purpose (P3);
   - fixed retention periods, not "until asked";
   - the rights to portability, restriction and withdrawal of consent;
   - the right to complain to a supervisory authority;
   - the source of the data when the parish entered it.
4. **EU representative (Art. 27).** One is needed if the operator has no EU establishment. Needs your action.
5. **Transfers.** Hosting in France is inside the EU. Transfers to US providers need the EU–US Data Privacy Framework or standard contractual clauses. Lebanon has no EU adequacy decision, so operators working from Lebanon need standard contractual clauses too.
6. **Children (Art. 8).** The age of digital consent is 13 to 16, depending on the country. "Accounts from 13" is lawful only in countries that set 13.
7. **Cookies (ePrivacy).** Loading Google Fonts from Google's servers sends visitors' IP addresses to Google. A German court (LG München I, 20 January 2022, 3 O 17493/20) held this unlawful without consent. Host the fonts on the site instead (Part B item 6). Preference storage is probably exempt from consent. Whether the offline copy is exempt is a `[COUNSEL]` question.
8. **Breaches.** Notify the authority within 72 hours (Art. 33) and, if the risk is high, the people affected (Art. 34). A process is needed.
9. **Records and assessments.** A record of processing (Art. 30) is needed, and a DPIA is likely (Art. 35: large-scale special categories and children). A DPO may be required (Art. 37).

The proposed wording below (P3, P5, P7) is written so that it works under both laws, so few changes would be needed if EU users arrive.

---

## D. Proposed changes

Each item names where it goes in `frontend/privacy.html` and whether it adds or replaces text. English is given first, then Arabic. Keep the two texts in step, and update the effective date on both when publishing.

### P1. Who runs ParishLife: replace both paragraphs of the first section
*Why:* Law 81 requires the controller to be identified, and it also explains the parish/ParishLife split in plain terms.

**EN**
> ParishLife is run by [PLACEHOLDER: legal name of the operator], [PLACEHOLDER: registered address], registered under [PLACEHOLDER: registration number and register]. For any privacy question or request, write to privacy@parish-life.org, or by post to the address above.
>
> Each parish decides what it records about its people and is responsible for those records. ParishLife keeps and processes them for the parish, only to provide the service. ParishLife itself is responsible for accounts, sign-in security, technical logs and the anonymous site counts.

**AR**
> يدير ParishLife [PLACEHOLDER: legal name of the operator]، [PLACEHOLDER: registered address]، المسجّلة تحت الرقم [PLACEHOLDER: registration number and register]. لأي سؤال أو طلب يتعلّق بالخصوصية، راسلنا على privacy@parish-life.org أو بالبريد على العنوان أعلاه.
>
> كل رعية تقرّر ما تسجّله عن أبنائها وهي المسؤولة عن هذه السجلات. يحفظها ParishLife ويعالجها لصالح الرعية ولتقديم الخدمة فقط. أمّا ParishLife نفسه فمسؤول عن الحسابات وأمان الدخول والسجلات التقنية والإحصاءات المجهولة للموقع.

### P2. What we store: complete the list
*Why:* rows 1, 7 and 9. Each item below is stored by the code today.

**(a) "Your account": add at the end of the bullet**

EN
> It also holds the parishes you follow, your notification choices, your own notes and to-do list (visible only to you and stored encrypted), and, if you add one, the signature you draw and the title shown with it on documents you sign.

AR
> ويحفظ أيضاً الرعايا التي تتابعها، وخيارات الإشعارات، وملاحظاتك وقائمة مهامك الخاصة (لا يراها غيرك وتُحفظ مشفّرة)، وإن أضفتهما، التوقيع الذي ترسمه واللقب الذي يظهر معه على الوثائق التي توقّعها.

**(b) "Parish records about you": replace the list after the colon**

EN
> name, date of birth and family details, contact details and address, rite, occupation and skills, households and relationships, sacraments and certificates, parish and ministry membership, catechism and formation progress, attendance, volunteering, registrations, contributions and receipts, consents you have given the parish, date of death, and letters or documents the parish issues.

AR
> الاسم وتاريخ الولادة وتفاصيل العائلة، ووسائل التواصل والعنوان، والطقس، والمهنة والمهارات، والأسر وصلات القرابة، والأسرار والشهادات، والعضوية في الرعية والأخويات، والتعليم المسيحي ومسار التنشئة، والحضور والتطوّع والتسجيلات، والتبرّعات والإيصالات، والموافقات التي أعطيتها للرعية، وتاريخ الوفاة، والرسائل أو الوثائق التي تصدرها الرعية.

**(c) New bullet after "Sensitive records"**

EN
> **Children's safety records**, only where a parish uses them: who may collect a child and on what authority, and check-in and evacuation rolls. Only the parish office records these.

AR
> **سجلات سلامة الأطفال**، فقط حيث تستخدمها الرعية: من يحقّ له استلام الطفل وبأي صفة، ولوائح الحضور والإخلاء. لا يسجّلها إلا مكتب الرعية.

**(d) New bullet**

EN
> **Prayer intentions** you send to a parish, with the visibility you choose.

AR
> **نوايا الصلاة** التي ترسلها إلى رعية، مع درجة الظهور التي تختارها.

**(e) New bullet**

EN
> **Clergy signatures:** images of a priest's or bishop's signature, used only on documents they sign.

AR
> **تواقيع الإكليروس:** صور توقيع الكاهن أو المطران، تُستعمل فقط على الوثائق التي يوقّعها.

**(f) New bullet**

EN
> **People who rent parish facilities:** name, organisation and a responsible contact, seen only by the parish's facilities and finance staff.

AR
> **مستأجرو مرافق الرعية:** الاسم والجهة وشخص مسؤول للتواصل، ولا يراها إلا موظفو المرافق والمالية في الرعية.

**(g) New bullet**

EN
> **Help with two-step sign-in:** if you lose your authenticator and ask for help, your request and how it was reviewed.

AR
> **المساعدة في الدخول بخطوتين:** إذا فقدت تطبيق المصادقة وطلبت المساعدة، يُحفظ طلبك وكيف رُوجع.

**(h) New bullet** (verified: `PublicDirectoryService.NearbyAsync` computes distances and stores nothing)

EN
> **Your location**, only if you press "Near me" in the parish directory. Your browser sends your position to work out distances; it is not stored.

AR
> **موقعك**، فقط إذا ضغطت "بالقرب مني" في دليل الرعايا. يرسل متصفّحك موقعك لحساب المسافات، ولا يُحفظ.

**(i) "Requests and messages": replace the bullet**

EN
> **Requests and messages** you send to a parish, and messages in the parish inbox, with any files you attach. Without an account, a request also stores the name and contact details you give and the details of the request.

AR
> **الطلبات والرسائل** التي ترسلها إلى رعية، والرسائل في بريد الرعية الداخلي، مع أي ملفات ترفقها. ومن دون حساب، يحفظ الطلب أيضاً الاسم ووسيلة التواصل التي تعطيها وتفاصيل الطلب.

### P3. Why: replace the section with purposes and their legal basis
*Why:* the prompt requires a legal basis for each purpose. The GDPR would require it too (C2). Under Law 81 it gives the "specific, legitimate purposes" in a form people can read.

**EN**
> We use your data only for these purposes:
>
> | Purpose | What is used | Why we may |
> | --- | --- | --- |
> | Your account and sign-in | Account, sign-in methods, sessions, account emails | To provide the service you asked for |
> | Parish records and services | Parish records, requests, messages | The parish's pastoral and administrative purposes and its duties under Church law, and your consent where the parish asks for it |
> | Sensitive records | Medical or allergy notes, pastoral notes, concerns, incident reports | Your explicit consent, or protecting a person's safety or life [COUNSEL: confirm, and confirm any licence needed under Law 81/2018] |
> | Security, preventing abuse, trustworthy records | Bot check, technical logs, audit records | Our legitimate interest, and the parish's, in a secure service and reliable records |
> | Knowing which public pages are used | Anonymous daily counts | No personal data is used |
>
> We do not sell your data or share it with anyone for their advertising, we show no advertising, and we use no advertising or analytics trackers.

**AR**
> نستعمل بياناتك لهذه الأغراض فقط:
>
> | الغرض | ما يُستعمل | لماذا يحقّ لنا |
> | --- | --- | --- |
> | حسابك ودخولك | الحساب وطرق الدخول والجلسات ورسائل البريد الخاصة بالحساب | لتقديم الخدمة التي طلبتها |
> | سجلات الرعية وخدماتها | سجلات الرعية والطلبات والرسائل | الأغراض الرعوية والإدارية للرعية وواجباتها بحسب القانون الكنسي، وموافقتك حين تطلبها الرعية |
> | السجلات الحسّاسة | الملاحظات الطبية أو عن الحساسية، والملاحظات الرعوية، والشكاوى، وتقارير الحوادث | موافقتك الصريحة، أو حماية سلامة شخص أو حياته [COUNSEL: confirm, and confirm any licence needed under Law 81/2018] |
> | الأمان ومنع إساءة الاستخدام وموثوقية السجلات | فحص البرامج الآلية والسجلات التقنية وسجلات التدقيق | مصلحتنا المشروعة ومصلحة الرعية في خدمة آمنة وسجلات موثوقة |
> | معرفة الصفحات العامة المستعملة | إحصاءات يومية مجهولة | لا تُستعمل أي بيانات شخصية |
>
> لا نبيع بياناتك ولا نشاركها مع أحد لإعلاناته، ولا نعرض إعلانات، ولا نستخدم أدوات تتبّع إعلانية أو تحليلية.

### P4. New section after "Why": "Required and optional information"
*Why:* Law 81 requires telling people whether answers are mandatory and what happens if they don't answer. `[ASSUMPTION: forms mark the required fields. Checked in Part B item 3.]`

**EN**
> Fields marked as required are needed to create an account, to send a request, or for the parish to keep a record. Without them we cannot provide that service. Everything else is optional, and leaving it out has no other consequence.

**AR**
> الحقول المعلَّمة بأنها مطلوبة ضرورية لإنشاء حساب أو إرسال طلب أو لتحفظ الرعية سجلاً. من دونها لا نستطيع تقديم تلك الخدمة. أمّا الباقي فاختياري، وتركه لا يترتّب عليه أي أثر آخر.

### P5. New section after "Services we use": "Where your data is processed"
*Why:* international transfers are not disclosed today, yet data goes to France and to US providers.

**EN**
> ParishLife stores its data with Microsoft Azure in the France Central region, in the European Union. Cloudflare, Google, Microsoft and Resend may handle the limited data described above in other countries, including the United States. The people who run ParishLife work from [PLACEHOLDER: country or countries from which platform operators access the service]. We use only providers that commit to protecting the data they handle [PLACEHOLDER: name the data processing terms accepted with each provider].

**AR**
> يحفظ ParishLife بياناته لدى Microsoft Azure في منطقة France Central داخل الاتحاد الأوروبي. وقد تعالج Cloudflare وGoogle وMicrosoft وResend البيانات المحدودة المذكورة أعلاه في بلدان أخرى، منها الولايات المتحدة. ويعمل القائمون على ParishLife من [PLACEHOLDER: country or countries from which platform operators access the service]. لا نستخدم إلا مزوّدين يلتزمون بحماية البيانات التي يعالجونها [PLACEHOLDER: name the data processing terms accepted with each provider].

### P6. How long we keep it: replace the section
*Why:* rows 28 to 30. Operator snapshots are missing from the published text. Retention periods are owner question 15, which is still open, so placeholders hold them. This is not a change to an owner decision.

**EN**
> Records are kept until you or your parish ask for them to be removed (see below); nothing is deleted automatically today. [PLACEHOLDER: retention period for each kind of record, once decided (owner question 15).] Official, financial and safeguarding records that a parish must keep are kept even after a closure request.
>
> A sign-in ends after 8 hours (15 minutes for a recovery sign-in). Email codes expire after 15 minutes.
>
> Backups: the database can be restored to any point in the last 7 days, and deleted files can be recovered for 30 days [ASSUMPTION: Azure settings, to be confirmed]. Backup copies made by the platform operators are kept for [PLACEHOLDER: retention of operator snapshots] in [PLACEHOLDER: where they are stored].
>
> Technical logs are deleted automatically after [PLACEHOLDER: confirm 90 days in Azure]. The anonymous site counts contain no personal data and are kept [PLACEHOLDER: period, or "without a time limit"].

**AR**
> تُحفظ السجلات إلى أن تطلب أنت أو رعيتك إزالتها (انظر أدناه)؛ ولا يُحذف شيء تلقائياً حالياً. [PLACEHOLDER: retention period for each kind of record, once decided (owner question 15).] السجلات الرسمية والمالية وسجلات الحماية التي يجب على الرعية حفظها تبقى حتى بعد طلب الإغلاق.
>
> ينتهي الدخول بعد ٨ ساعات (و١٥ دقيقة لدخول الاسترداد). وتنتهي رموز البريد الإلكتروني بعد ١٥ دقيقة.
>
> النسخ الاحتياطية: يمكن استعادة قاعدة البيانات إلى أي لحظة في آخر ٧ أيام، ويمكن استرجاع الملفات المحذوفة خلال ٣٠ يوماً [ASSUMPTION: Azure settings, to be confirmed]. أمّا النسخ الاحتياطية التي يعدّها مشغّلو المنصّة فتُحفظ مدّة [PLACEHOLDER: retention of operator snapshots] في [PLACEHOLDER: where they are stored].
>
> تُحذف السجلات التقنية تلقائياً بعد [PLACEHOLDER: confirm 90 days in Azure]. ولا تتضمّن الإحصاءات المجهولة للموقع أي بيانات شخصية، وتُحفظ [PLACEHOLDER: period, or "without a time limit"].

### P7. Your rights and choices: replace the "By request" bullet and add a closing paragraph
*Why:* it adds the right to object (Law 81), correction or deletion, a response time, an identity check and where to complain. **Today the code cannot export data or delete an account (row 32).** Before this text is published, the operator needs a manual procedure, or Agent 03's deletion flow.

**EN**
> - **By request** to privacy@parish-life.org:
>   - a copy of your data in a common electronic format;
>   - correction, completion or deletion of data that is wrong, incomplete or no longer needed;
>   - deleting your account;
>   - objecting, for legitimate reasons, to a use of your data;
>   - anything you cannot do in the app.
>
> We may ask you to confirm your identity first, and we answer within [PLACEHOLDER: response time, for example 30 days]. When a parish holds the record, we pass your request to that parish and tell you we have done so. If you are not satisfied with our answer, you can take the matter to the competent authorities or courts in Lebanon.

**AR**
> - **بطلب** إلى privacy@parish-life.org:
>   - نسخة من بياناتك بصيغة إلكترونية شائعة؛
>   - تصحيح البيانات الخاطئة أو الناقصة أو التي لم تعد ضرورية، أو إكمالها أو حذفها؛
>   - حذف حسابك؛
>   - الاعتراض، لأسباب مشروعة، على استعمال لبياناتك؛
>   - أي أمر لا تستطيع فعله في التطبيق.
>
> قد نطلب منك أولاً تأكيد هويتك، ونجيب خلال [PLACEHOLDER: response time, for example 30 days]. وحين تكون الرعية هي التي تحفظ السجل، نحيل طلبك إليها ونُعلمك بذلك. وإن لم تكن راضياً عن جوابنا، يمكنك رفع الأمر إلى السلطات أو المحاكم المختصّة في لبنان.

### P8. Who can see it: replace the platform operators bullet
*Why:* row 14.

**EN**
> The people who run ParishLife (platform operators), for setup, support and security. This includes reviewing a message that someone reports to them and requests for help with two-step sign-in.

**AR**
> القائمون على ParishLife (مشغّلو المنصّة)، للإعداد والدعم والأمان، ومن ذلك مراجعة رسالة يُبلَّغون عنها وطلبات المساعدة في الدخول بخطوتين.

### P9. Children: replace the section
*Why:* it says how children's data is handled and how a parent can act, without changing the owner's decision that parents do not act for children *in the app*.

**EN**
> Accounts are for people aged 13 or older. We do not knowingly create an account for anyone younger, and we close one if we learn of it. Parishes may record children in their parish records, including sacraments, registrations and who may collect them. Only the parish office records them, and parents or guardians do not act for children in the app. A parent or guardian can ask the parish, or write to privacy@parish-life.org, to see, correct or remove a child's data. [COUNSEL: confirm whether account holders aged 13 to 17 need a parent's or guardian's agreement under Lebanese law.]

**AR**
> الحسابات لمن بلغ ١٣ سنة أو أكثر. لا ننشئ عن علم حساباً لمن هو أصغر، ونغلقه إذا علمنا به. قد تسجّل الرعايا الأطفال في سجلاتها، ومن ذلك الأسرار والتسجيلات ومن يحقّ له استلامهم. لا يسجّلهم إلا مكتب الرعية، ولا يتصرّف الأهل أو الأوصياء عن الأطفال في التطبيق. يمكن لأحد الوالدين أو للوصي أن يطلب من الرعية، أو أن يراسل privacy@parish-life.org، للاطّلاع على بيانات الطفل أو تصحيحها أو إزالتها. [COUNSEL: confirm whether account holders aged 13 to 17 need a parent's or guardian's agreement under Lebanese law.]

### P10. New section: "Artificial intelligence and automated decisions"
*Why:* the prompt requires an AI section. The code makes no model calls (re-checked: no OpenAI, Anthropic, Azure AI, Semantic Kernel or Gemini).

**EN**
> ParishLife does not use artificial intelligence to analyse your data, and no decision about you is made by automated means alone.

**AR**
> لا يستخدم ParishLife الذكاء الاصطناعي لتحليل بياناتك، ولا يُتّخذ أي قرار بشأنك بوسائل آلية وحدها.

### P11. New sentence in "What we store", after the passkey sentence
*Why:* Part B item 26 needs this wording.

**EN**
> If you unlock a passkey with your face or fingerprint, that check happens on your device; ParishLife never receives or stores biometric data.

**AR**
> إذا فتحت مفتاح المرور بوجهك أو ببصمتك، يجري هذا التحقّق على جهازك؛ ولا يتلقّى ParishLife أي بيانات بيومترية ولا يحفظها.

### P12. Changes: replace the section
**EN**
> If we make a change that matters, we will tell account holders in ParishLife at least [PLACEHOLDER: notice period, for example 30 days] before it takes effect, and post the new text here with its effective date. Earlier versions are available on request.

**AR**
> إذا أجرينا تغييراً مهمّاً، نُعلم أصحاب الحسابات في ParishLife قبل [PLACEHOLDER: notice period, for example 30 days] على الأقل من سريانه، وننشر النص الجديد هنا مع تاريخ سريانه. النسخ السابقة متاحة بطلب.

### P13. New section before "How long we keep it": "How we protect it"
*Why:* Law 81 has a security duty, and the policy says nothing about security. Each claim was verified: HSTS and HTTPS redirect (`Program.cs`); multi-factor sign-in for staff, clergy and operators; protected sensitive records; `AuditRecord`.

**EN**
> We protect data with encrypted connections, access limited by role and appointment, two-step sign-in for parish staff, clergy and platform operators, extra protection at rest for sensitive records, and audit records of changes. No system is perfectly secure. If a breach affects your data, we will tell the parish concerned, and tell you where the law requires it or the risk to you justifies it.

**AR**
> نحمي البيانات باتصالات مشفّرة، وبوصول محصور بحسب الدور والتعيين، وبالدخول بخطوتين لموظفي الرعايا والكهنة ومشغّلي المنصّة، وبحماية إضافية للسجلات الحسّاسة عند التخزين، وبسجلات تدقيق للتغييرات. لا يوجد نظام آمن تماماً. وإذا تعرّضت بياناتك لاختراق، نُعلم الرعية المعنية، ونُعلمك حين يفرض القانون ذلك أو حين يبرّره الخطر عليك.

### P14. Cookies and storage: replace bullets 1 and 3 and the closing paragraph
*Why:* rows 21, 23 and 26, and the facts about the third parties (`cookie-policy.md`).

**EN**
> - A sign-in cookie that keeps you signed in. It is deleted when you sign out or close the browser, and the sign-in inside it ends 8 hours after you signed in.
> - Short-lived cookies during a Google or Microsoft sign-in (15 minutes at most).
>
> The cookies are strictly necessary; the stored preferences and the offline copy only remember your choices and the pages you opened. ParishLife sets no advertising or tracking cookies. Cloudflare states that Turnstile does not use cookies to collect or store information; it is provided under Cloudflare's own privacy policy. Google Fonts sets no cookies but receives your IP address. Every cookie and stored item is listed in the [cookie policy](cookies.html).

**AR**
> - ملف دخول يبقيك داخلاً. يُحذف عند الخروج أو إغلاق المتصفّح، وينتهي الدخول الذي يحمله بعد ٨ ساعات من دخولك.
> - ملفات قصيرة الأمد أثناء الدخول عبر Google أو Microsoft (١٥ دقيقة على الأكثر).
>
> ملفات تعريف الارتباط ضرورية تماماً؛ أمّا التفضيلات المحفوظة والنسخة المتاحة دون اتصال فتتذكّر خياراتك والصفحات التي فتحتها فقط. لا يضع ParishLife ملفات إعلانية أو تتبّعية. تقول Cloudflare إن Turnstile لا يستخدم ملفات تعريف الارتباط لجمع المعلومات أو حفظها، وهي تقدّمه وفق سياسة الخصوصية الخاصة بها. لا يضع Google Fonts ملفات تعريف ارتباط لكنه يتلقّى عنوان IP الخاص بك. كل ملف وكل عنصر محفوظ مذكور في [سياسة ملفات تعريف الارتباط](cookies.html?lang=ar).

(`cookies.html` does not exist yet. It is published in Part B.)

### P15. Arabic effective date
**AR**
> تاريخ السريان: [EFFECTIVE DATE, written in Arabic, for example ٢١ تشرين الثاني ٢٠٢٦]

### P16. Services we use: Google Fonts bullet (interim, until fonts are hosted on the site in Part B)
*Why:* this is accurate, and it tells readers what Google receives. Once the fonts are hosted on the site, delete the bullet in both languages.

**EN**
> **Google Fonts:** the members portal and the product page load their fonts from Google, so your browser sends Google your IP address and browser details. Google states that this service sets no cookies.

**AR**
> **Google Fonts:** تحمّل بوّابة المؤمنين وصفحة التعريف بالمنتج خطوطهما من Google، فيرسل متصفّحك إلى Google عنوان IP وتفاصيل المتصفّح. وتقول Google إن هذه الخدمة لا تضع ملفات تعريف ارتباط.

---

## E. Placeholders and decisions in this draft

- `[PLACEHOLDER: legal name of the operator]`, `[PLACEHOLDER: registered address]`, `[PLACEHOLDER: registration number and register]` (P1)
- `[PLACEHOLDER: country or countries from which platform operators access the service]`, `[PLACEHOLDER: name the data processing terms accepted with each provider]` (P5)
- `[PLACEHOLDER: retention period for each kind of record]` (owner question 15), `[PLACEHOLDER: retention of operator snapshots]`, `[PLACEHOLDER: where they are stored]`, `[PLACEHOLDER: confirm 90 days in Azure]`, `[PLACEHOLDER: period for site counts]` (P6)
- `[PLACEHOLDER: response time]` (P7); `[PLACEHOLDER: notice period]` (P12); `[EFFECTIVE DATE]` (P15)
- `[COUNSEL]` items: the basis for sensitive records and a licence under Law 81 (P3); minors aged 13 to 17 (P9); the declaration to the Ministry of Economy and Trade (C1); religious affiliation (C1)
- `[ASSUMPTION]` items: the Azure backup settings (P6); forms mark their required fields (P4)
