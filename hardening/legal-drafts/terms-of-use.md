# Terms of use: review draft (Agent 06, Part A)

> **DRAFT. Not for publication.** This must be reviewed by a lawyer licensed in Lebanon before any of it is published. It is not legal advice.
> Prepared 21 November 2026 on branch `hardening/06-legal`.

**Starting point.** The terms of use are already published in English and Arabic (`frontend/terms.html`). The owner approved them on 21 November 2026 (`docs/operations/legal-pages.md`). This draft keeps that text, checks it against the code, against the contents the hardening prompt requires and against the law that applies, and proposes each change in English and Arabic.

**Markers.** `[PLACEHOLDER: …]` marks a fact only the owner can supply. `[COUNSEL: …]` marks a legal point for the lawyer. **OWNER DECISION** marks wording that would change what users have already agreed to. Under the hardening rules it is not published until the owner says yes.

---

## A. Fact check: the published text against the code

| # | Published statement | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | "ParishLife runs this service at parish-life.org" | **Incomplete** | No legal entity is named, and a contract needs a party. → T1 |
| 2 | Do not get around the bot check or security controls, or use automated tools to collect data | Verified | Turnstile (`TurnstileVerifier`), rate limits (`Program.cs`: 200 requests per minute, 20 for authentication) |
| 3 | Parish staff, clergy and platform operators sign in with an authenticator app as a second step | Verified | `StaffAppointmentAccess` (`RequireMfaAsync`), `ClergyAuthority`, `AccountDirectory.RequireOperatorAsync` |
| 4 | If you sign in with Google or Microsoft, their own terms apply | Verified | Provider sign-in only when it is configured (`ExternalSignInService`) |
| 5 | "We or a parish may suspend an account or limit access" | **Imprecise** | Only platform operators suspend a sign-in account (`AccountStatusService`, `AccountStatusChange`). A parish can suspend a staff appointment (`StaffAppointmentService`) or end a membership, which limits access, but it cannot suspend the account. → T10 |
| 6 | "To close your account, write to privacy@parish-life.org" | **Not supported by the code today** | Account deletion is refused (`CosmosIdentityStore.DeleteAsync` → `DeletionRequiresReview`). Operators can only suspend an account. A manual closure procedure is needed (privacy draft, row 32). |
| 7 | Records and decisions remain with the parish and the Church authorities | Fits | Documents and certificates are parish records (`Certificate`, `RequestLetter`, `DocumentSignature`) |
| 8 | Availability not promised | Fits | No service-level commitment exists anywhere in the code or docs |

No statement is contradicted outright. Rows 5 and 6 need the wording or the procedure fixed.

---

## B. Required contents (prompt, Part A item 2)

| Required item | In the published text? | Proposed change |
| --- | --- | --- |
| Acceptable use | Yes | none |
| Accounts | Yes; no minimum age | T2 |
| Payments and subscriptions (renewal, cancellation) | **No.** Nothing is sold online today. | T3 states that. Subscription terms belong in a separate parish agreement (see `refund-policy.md`). |
| Intellectual property | **No** | T4 |
| User content and licences | Partly ("Parish content") | T5, T6 |
| Disclaimers | Partly ("Availability") | T7 |
| Limitation of liability | **No.** The owner chose to have none (`legal-pages.md`). | T8 (**OWNER DECISION**) |
| Indemnity | **No** | T9: recommended **not** in the member terms |
| Termination | Yes | T10 |
| Governing law | Yes (Lebanon) | none |
| Dispute resolution | **No** | T12 |
| Changes to the terms | Yes, with no notice | T11 |
| (Extra) Which language prevails, severability | **No** | T13 |

---

## C. Law check

- **Lebanon: Law No. 81/2018.** It recognises contracts made electronically, so acceptance at sign-up ("By creating an account you accept…") is a workable mechanism. No record of which version a user accepted is kept today. That is Part B item 3. `[COUNSEL: confirm the formal requirements for electronic acceptance.]`
- **Lebanon: Code of Obligations and Contracts.** It is understood that no one may exclude liability in advance for their own fraud or gross fault, and T8 is written to respect that. `[COUNSEL: confirm the article and its scope.]`
- **Lebanon: Consumer Protection Law No. 659/2005, as amended by Law No. 265/2014.** Clauses that are abusive toward consumers are unenforceable. Members use ParishLife for free, which may take them outside the law's scope. `[COUNSEL: confirm whether the law applies to a free service, and that T7, T8 and T11 are not abusive.]`
- **Minors.** Accounts are allowed from age 13 (owner decision). The age of majority in Lebanon is 18. `[COUNSEL: confirm whether account holders aged 13 to 17 can accept these terms without a guardian.]` The owner's decision stays as it is; only the wording is flagged.
- **If EU users are confirmed.** Consumers keep the mandatory protection of their own country's law, whatever law the terms choose (Rome I, Art. 6), and the EU Unfair Terms Directive applies. T12 already preserves mandatory protection. A US DMCA agent would be needed only if users can upload content and US users are served (Part B item 24). Today it is **not applicable**.

---

## D. Proposed changes

Each item names where it goes in `frontend/terms.html`. English is given first, then Arabic. Keep both texts in step and update the effective date (`[EFFECTIVE DATE]`) on both.

### T1. About these terms: replace the first sentence
**EN**
> These terms are an agreement between you and [PLACEHOLDER: legal name of the operator] ("ParishLife", "we"), [PLACEHOLDER: registered address], which runs the service at parish-life.org.

**AR**
> هذه الشروط اتفاق بينك وبين [PLACEHOLDER: legal name of the operator] ("ParishLife" أو "نحن")، [PLACEHOLDER: registered address]، التي تدير الخدمة على parish-life.org.

### T2. New section after "About these terms": "Who may use ParishLife"
*Why:* the minimum age appears only in the privacy policy, and the terms are the contract.

**EN**
> You must be 13 or older to create an account. [COUNSEL: whether users aged 13 to 17 need a parent's or guardian's agreement.] Parish staff and clergy use ParishLife in their role, for their parish.

**AR**
> يجب أن يكون عمرك ١٣ سنة أو أكثر لإنشاء حساب. [COUNSEL: whether users aged 13 to 17 need a parent's or guardian's agreement.] يستخدم موظفو الرعايا والكهنة ParishLife في إطار دورهم ولصالح رعيتهم.

### T3. New section: "Cost and payments"
*Why:* the prompt requires a payments section. Verified: there is no payment provider and no online payment. Parish finance records offline gifts and receipts only.

**EN**
> Using ParishLife as a member is free. ParishLife takes no payments online. Gifts, fees and refunds that a parish records are between you and that parish. A parish's use of ParishLife may be covered by a separate agreement between the parish and us [PLACEHOLDER: name of the parish service agreement, once it exists].

**AR**
> استخدام ParishLife مجاني للمؤمنين. لا يقبل ParishLife أي دفع عبر الإنترنت. التبرّعات والرسوم والمبالغ المستردّة التي تسجّلها رعية هي شأن بينك وبين تلك الرعية. وقد يخضع استخدام الرعية لـ ParishLife لاتفاق منفصل بينها وبيننا [PLACEHOLDER: name of the parish service agreement, once it exists].

### T4. New section: "ParishLife's rights"
**EN**
> ParishLife's software, design, name and logo belong to [PLACEHOLDER: legal name of the operator] or its licensors. We give you a personal, non-exclusive right, which you cannot transfer, to use ParishLife for the purposes in these terms. Do not copy, resell or reverse engineer it, except as the law allows. Open-source parts of ParishLife remain under their own licences.

**AR**
> برمجيات ParishLife وتصميمه واسمه وشعاره ملك لـ [PLACEHOLDER: legal name of the operator] أو لمن رخّص لها. نمنحك حقاً شخصياً غير حصري وغير قابل للنقل لاستخدام ParishLife للأغراض المذكورة في هذه الشروط. لا تنسخه ولا تعِد بيعه ولا تفكّك برمجيته، إلا بالقدر الذي يسمح به القانون. تبقى الأجزاء المفتوحة المصدر من ParishLife خاضعة لتراخيصها الخاصة.

### T5. Parish content: replace the section
*Why:* it gives ParishLife the licence it needs to host and show content, including on public pages, and says who owns what.

**EN**
> Records, documents and pages a parish creates belong to that parish, and the parish is responsible for them. You keep any rights you have in what you send or upload. You allow ParishLife to store, copy, display and transmit it only as needed to run the service for you and your parish, including on the parish's public page when the parish chooses to publish it. Send only content you have the right to share. What you send to a parish is shared with that parish so it can act on it.

**AR**
> السجلات والوثائق والصفحات التي تنشئها رعية هي ملك تلك الرعية، وهي المسؤولة عنها. تحتفظ بأي حقوق لك فيما ترسله أو ترفعه. وتسمح لـ ParishLife بحفظه ونسخه وعرضه ونقله بالقدر اللازم فقط لتشغيل الخدمة لك ولرعيتك، ومن ذلك على صفحة الرعية العامة حين تختار الرعية نشره. لا ترسل إلا محتوى يحقّ لك مشاركته. ما ترسله إلى رعية يُشارك معها لتتمكّن من متابعته.

### T6. New section: "Reporting content"
*Why:* message reporting exists in the code (`MessageReport`). A visible route for other content is needed (Part B item 14).

**EN**
> To report a message, use the report option on that message. To report other content that is unlawful, abusive or infringes your rights, write to privacy@parish-life.org [PLACEHOLDER: or a separate abuse or legal address]. We may remove content or limit access while we look into it.

**AR**
> للإبلاغ عن رسالة، استعمل خيار الإبلاغ عليها. وللإبلاغ عن أي محتوى آخر مخالف للقانون أو مسيء أو يمسّ حقوقك، راسلنا على privacy@parish-life.org [PLACEHOLDER: or a separate abuse or legal address]. قد نزيل المحتوى أو نقيّد الوصول إليه ريثما ننظر في الأمر.

### T7. Availability: add after the existing sentence
**EN**
> ParishLife is provided as it is and as available. Information a parish publishes, such as Mass times and events, comes from that parish; check with the parish when it matters. Nothing in these terms limits a right that the law does not allow us to limit.

**AR**
> يُقدَّم ParishLife كما هو وبحسب توفّره. المعلومات التي تنشرها رعية، كمواعيد القداديس والنشاطات، مصدرها تلك الرعية؛ فتحقّق منها لدى الرعية حين يكون الأمر مهمّاً. لا شيء في هذه الشروط يقيّد حقاً لا يسمح القانون بتقييده.

### T8. New section: "Our responsibility" (**OWNER DECISION**, optional)
*Why:* the prompt lists limitation of liability. The owner chose to have none (`legal-pages.md`: "no limitation clause"). Adding one changes what users agreed to, so it is offered only for the owner and counsel to decide. If the owner says no, leave the terms as they are and record "Not applicable: owner decision".

**EN**
> To the extent the law allows, we are not responsible for indirect loss, for loss caused by a parish's records or decisions, for loss caused by the use of your account by someone you let use it, or for events beyond our reasonable control. Nothing in these terms limits our responsibility for fraud or gross fault, or for anything the law does not allow us to limit.

**AR**
> في حدود ما يسمح به القانون، لسنا مسؤولين عن الأضرار غير المباشرة، ولا عن الأضرار الناتجة عن سجلات رعية أو قراراتها، ولا عن الأضرار الناتجة عن استخدام حسابك من قِبل شخص سمحت له بذلك، ولا عن الأحداث الخارجة عن سيطرتنا المعقولة. لا شيء في هذه الشروط يحدّ من مسؤوليتنا عن الغشّ أو الخطأ الجسيم، أو عن أي أمر لا يسمح القانون بالحدّ منه.

### T9. Indemnity: recommended *not* to add to the member terms
*Why:* asking free individual members (some aged 13 to 17) to indemnify the operator is likely unenforceable and unfair. Parishes are the ones that enter data about other people. Put an indemnity in the **parish service agreement** instead (Needs your action). A clause to give counsel for that agreement:

> The parish will cover ParishLife's reasonable costs from a claim by a third party that arises from records or content the parish entered or published in breach of the law or of this agreement. [PLACEHOLDER: cap, procedure and notice, to be set by counsel.]

(English only: this is for a separate agreement, not the published terms.)

### T10. Suspension and closing: replace the section
*Why:* row 5 (who can suspend what) and row 6 (closure). It also adds notice if the service ends.

**EN**
> We may suspend or close an account, and a parish may end your access to its records, if the account breaks these terms or puts other people or the service at risk. Where we can, we will tell you why. You can stop using ParishLife at any time; to close your account, write to privacy@parish-life.org. What happens to your data then is explained in the privacy policy. If we stop offering ParishLife, we will give at least [PLACEHOLDER: notice period] notice and help parishes take a copy of their records.

**AR**
> يجوز لنا تعليق حساب أو إغلاقه، ويجوز للرعية إنهاء وصولك إلى سجلاتها، إذا خالف الحساب هذه الشروط أو عرّض الآخرين أو الخدمة للخطر. وحيث أمكن نُعلمك بالسبب. يمكنك التوقّف عن استخدام ParishLife متى شئت؛ ولإغلاق حسابك راسلنا على privacy@parish-life.org. ما يحدث لبياناتك عندها مشروح في سياسة الخصوصية. وإذا توقّفنا عن تقديم ParishLife، نعطي إشعاراً قبل [PLACEHOLDER: notice period] على الأقل ونساعد الرعايا على أخذ نسخة من سجلاتها.

### T11. Changes: replace the section
**EN**
> We may change these terms. For a change that matters, we will tell account holders in ParishLife at least [PLACEHOLDER: notice period, for example 30 days] before it takes effect, and post the new text here with a new effective date. If you do not agree, you can close your account before then. Using ParishLife after that date means you accept the new terms.

**AR**
> قد نغيّر هذه الشروط. وفي حال تغيير مهمّ، نُعلم أصحاب الحسابات في ParishLife قبل [PLACEHOLDER: notice period, for example 30 days] على الأقل من سريانه، وننشر النص الجديد هنا مع تاريخ سريان جديد. إذا لم توافق، يمكنك إغلاق حسابك قبل ذلك التاريخ. ومتابعة استخدام ParishLife بعده تعني قبولك الشروط الجديدة.

### T12. Contact and law: replace the section
**EN**
> Questions: privacy@parish-life.org. These terms are governed by the laws of Lebanon. If a dispute arises, write to us first, and we will try to settle it amicably within [PLACEHOLDER: period, for example 30 days]. Otherwise the courts of [PLACEHOLDER: city, for example Beirut] have jurisdiction. This does not take away any protection that mandatory law gives you.

**AR**
> للأسئلة: privacy@parish-life.org. تخضع هذه الشروط لقوانين لبنان. إذا نشأ خلاف، راسلنا أولاً وسنسعى إلى تسويته ودّياً خلال [PLACEHOLDER: period, for example 30 days]. وإلا فالاختصاص لمحاكم [PLACEHOLDER: city, for example Beirut]. ولا يحرمك ذلك من أي حماية يمنحك إياها القانون الإلزامي.

### T13. New closing section: "General"
*Why:* the site is bilingual, and nothing currently says which text prevails if they differ.

**EN**
> If a clause is found invalid, the rest still applies. These terms and the privacy policy are the whole agreement between you and us about ParishLife. The English and Arabic texts have the same meaning; if they differ, the [PLACEHOLDER: Arabic or English] text prevails.

**AR**
> إذا تبيّن أن بنداً غير صالح، يبقى الباقي نافذاً. هذه الشروط وسياسة الخصوصية هي كامل الاتفاق بينك وبيننا بشأن ParishLife. للنصّين العربي والإنكليزي المعنى نفسه؛ وإذا اختلفا، يُعتمد النص [PLACEHOLDER: Arabic or English].

### T14. Arabic effective date
> تاريخ السريان: [EFFECTIVE DATE, written in Arabic]

---

## E. Placeholders and decisions in this draft

- `[PLACEHOLDER: legal name of the operator]`, `[PLACEHOLDER: registered address]` (T1, T4)
- `[PLACEHOLDER: name of the parish service agreement]` (T3); `[PLACEHOLDER: abuse or legal address]` (T6)
- `[PLACEHOLDER: notice period]` (T10, T11); `[PLACEHOLDER: amicable settlement period]`, `[PLACEHOLDER: city of the competent courts]` (T12); `[PLACEHOLDER: prevailing language]` (T13); `[EFFECTIVE DATE]`
- **OWNER DECISION:** T8 (limitation of liability). Every other change adds wording without taking away anything users have agreed to, but the owner reviews each changed sentence anyway (`PROJECT_CONTEXT.md`).
- `[COUNSEL]`: minors aged 13 to 17 (T2); electronic acceptance; liability limits under the Code of Obligations and Contracts and Law 659/2005 (T8); the indemnity clause for the parish agreement (T9).
