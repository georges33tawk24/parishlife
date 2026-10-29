from render_specs import *
from field_data import FIELDS, BINDINGS

PROFILES={
'A':('Account holder; authenticated identity service; no office browse merely from staff rank','Holder edits own preferences/contact through corresponding security flow','After save preferences remain editable; identity changes require reauthentication/verification','Own lookup only; never public identity enumeration','Own-account export only; no notification contact value; never unrelated print'),
'O':('Eligible scoped office/domain operator and own applicant projection where explicitly supplied','Applicant before handling; then eligible operator for allowed stage','Approved/closed source facts locked; corrections append version','Permitted operational search; no public exposure unless separately published','Only approved operational print/export; notification reference/next-action summary only'),
'I':('Identity/official-record reviewer; own verified subject projection; clergy for assigned official facts','Office prepares; member proposes; clergy approves official changes','Official entry/issuance snapshot immutable; ordinary profile change never rewrites it','Authorized identity/reference search only; restrict names of minors/sensitive relations','Approved document fields only; no private matching evidence or third-party identity in ordinary messages'),
'D':('Need-to-know preparation/reviewer/sender/recipient set on exact parent record','Supplying applicant for own draft/upload; exact verifier or authorized owner afterward','Verified/closed versions read-only; replacement/correction retains provenance','Not global/full-text/public search; exact authorized case lookup only','No ordinary notifications/public print; purpose-specific permitted evidence/review export only'),
'M':('Assigned event/care/safeguarding operators with a specific care purpose','Subject/verified guardian supplies; qualified policy reviewer handles correction','Event-linked snapshot protected; mark declared/unverified unless genuine review supports more','Never ordinary People/global search, directory or general statistics','Only authorized care roster/details; omit from notification previews and ordinary exports'),
'F':('Granted finance field scope; donor identity separately granted; own payer projection only','Finance entry role before posting; independent approver/payer/reconciler for separate actions','Posted/closed facts immutable; attributed reversal/reclassification after close','Finance search only within grant; no public/donor leakage through People','Authorized finance reports/receipts; original currency visible; no amounts in ordinary preview notices'),
'C':('Exact selected eligible concern reviewers or assigned incident handlers; own submitter/reporter projection','Submitter supplies own narrative/evidence; authorized handlers append; no silent rewrite','Original statements preserved; amendment and restricted audience history','Dedicated case search only; unrelated users see no case/count/suggestion','Purpose-reviewed redacted exceptional export; neutral notices only; never general audit body'),
'P':('Account author only; WF48 explicit task/current-priest share if chosen','Author; explicitly eligible task assignee may update only shared task','Prior versions restricted; sharing withdrawal ends future access; approved retention governs deletion','Dedicated own/shared notebook lookup; never global staff index','No general export/print; author-purpose output only; private body excluded from notifications'),
'L':('Departure applicant and eligible assigned parish priests only; leader/admin/bishop has no reason access by rank','Applicant supplies private reason; priest appends review without silently rewriting applicant statement','Preserve private original and decision history; roster end does not make reason public','Only own-applicant/private priest departure queue; no ordinary leader/global index','Leader receives neutral end/effective date only; reason excluded from ordinary notification, roster print and export'),
'U':('Authorized draft editors/reviewers; after publication exact approved public/member/group audience','Scoped editor prepares; publisher/domain authority approves','Published version immutable; new draft distinct from live; official names approved separately','Published approved public text may be indexed; draft never public','Approved published fields on public outputs; no private linked evidence or original notes'),
'S':('Own account/system metadata as permitted; exact authorized technical/appointment operators','Service-maintained except explicit appointer/context-choice actions','Immutable identifiers/audit/time; grant changes append history','Exact authorized audit/account lookup only; no secrets or general enumeration','Sanitized metadata only to authorized auditor; no credential export'),
'K':('Verified guardian/participant purpose projection and assigned event/safeguarding operators','Verified giver records consent; reviewer confirms basis; trained operator records actual pickup','Versioned consent/pickup snapshot; changed wording/authority needs renewed review','No ordinary public/global search; event/participant exact lookup only','Minimal restricted event roster; no public directory/preview; collector/medical detail not broadly exported'),
'X':('Holder supplies over authenticated protected flow; credential verifier only','Holder or authorized identity-reviewed reset flow; never staff readback','Never stored in authoring drafts/audit; hash/verification service handles secret','Never searchable, logged, exported, printed or notified','No password/confirmation/current-password in any output; clear after submit/error/logout')}

TYPE_RULES={
'id':('Server-generated stable unique reference','PL-EX-001','No fabricated replacement for unknown; generated after real save','Read-only; duplicate operation returns existing reference'),
'system':('Actual server/operation-derived value','revision 4; actual UTC timestamp','Unknown remains unavailable, never seed success','Read-only; service validates authoritative value'),
'name':('Supplied Unicode text, 1–200 characters; preserve spelling/script','Maya Haddad / مايا حداد','Unknown script variants remain not supplied; at least one supplied name for provisional person','Enter the supplied name; do not generate a translation or placeholder'),
'text':('Plain Unicode text, proposed maximum 500 characters','Fictional office reference EX-12','Optional blank is not a factual zero/false','Enter no more than 500 characters; final size is proposed product limit'),
'long':('Unicode multiline text, proposed maximum 10,000 characters','Fictional explanation with no real parishioner data','Optional blank remains not recorded','Enter no more than 10,000 characters; restrict audience before submit'),
'ref':('Authorized stable record reference, or explicitly marked supplied external reference where workflow permits','Person EX-P01; external witness pending match','Unlinked applicant supplies facts; no exposed office record picker','Select a permitted matching record or mark external/unknown; recheck scope and archived status'),
'refs':('Explicit set of authorized stable references; no hidden all-record selection','EX-P01, EX-P02','Empty only where optional; no automatic name-based links','Remove duplicates and select only permitted records; preview selection count'),
'date':('ISO date for storage; localized exact/year/approximate/unknown representation','2026-11-14; year 1980 when precision is year','Precision explicitly Unknown/Approximate/Year only; no invented day/month','Enter a valid date matching precision; birth/death/actual event cannot be future facts'),
'datetime':('Date + time + IANA zone; store instant and relevant parish-local representation','2026-11-14 10:30 Asia/Beirut','Unknown optional historical instruction time stays unknown; no backdated audit','Enter valid local date/time and resolve daylight-saving ambiguity; end must follow start'),
'time':('Actual local HH:mm with source event zone','10:35','Do not round an actual supplied celebration time; optional unknown labeled','Enter valid time; missing date/zone resolved before booking'),
'email':('One syntactically valid email address; do not claim verification from syntax','person@example.invalid','No email allowed when phone route suffices; unknown office contact is not verified','Check the address; account uniqueness failures use neutral response, not another identity'),
'phone':('Country code plus plausible international number; display retains supplied format','+961 … (fictional masked example)','No personal phone is explicit; guardian/office contact has separate authority','Enter country code and number; overseas numbers are not rejected by Lebanese-only prefixes'),
'password':('Proposed 16–200 characters; allow spaces/Unicode/paste/password managers; block compromised/common values','Use a private passphrase; never put a real example password in this pack','No unknown/default password; confirmation must match; current password verified','Use 16–200 characters; confirmation must match; never echo the entered secret'),
'precision':('Exact / Year only / Approximate / Unknown','Unknown','Unknown is a real value, not 1 January','Select precision consistent with entered date; exact-age gate needs review when not exact'),
'verification':('Not supplied / Unverified / Under review / Verified / Rejected / Expired; actual method and actor required','Unverified','Unknown or missing is never Verified','Record the actual verification basis, reviewer and time; unavailable provider cannot verify'),
'language':('English (en) / French (fr) / Arabic (ar); document layout separately chosen','Arabic','Interface default can be explicit user/browser suggestion; never fabricate official names','Choose a supported language; final document needs approved template and supplied names'),
'consent':('Not requested / Pending / Accepted / Declined / Withdrawn; record giver, scope/version/source/time','Accepted from reviewed paper version EX-C2','No prechecked optional consent; blank is not Accepted','Confirm the exact statement/version yourself or record reviewed paper provenance; no household-wide blanket acceptance'),
'boolean':('Explicit Yes / No, with Not recorded for legacy values where applicable','No','Missing legacy value is not positive permission','Choose the actual value; no permission inferred from unchecked/omitted history'),
'decision':('Pending / Accepted / Returned / Declined / Cancelled; specific workflow names take precedence','Returned with applicant-safe reason','Unknown historical approval remains Unknown, not Accepted','Only eligible decision actor may commit; require reason for return/decline and full prerequisites'),
'choice':('Exact field-specific values listed in the options table below','A listed value or explicitly approved domain entry','Unknown/Not applicable only where field/policy permits','Select one reviewed value; do not use arbitrary free text to bypass policy'),
'file':('PDF/JPEG/PNG; proposed maximum 10 MB/file, 20 files/case; detected MIME and content validation; PDF over 20 pages needs office review','fictional-evidence.pdf','No file is fine only if optional or reviewed paper receipt/waiver substitutes','Unsupported/oversized/failed file remains not received; no silent truncation; replacement creates version'),
'image':('JPEG/PNG; proposed 10 MB; preview/crop/rotate; publication basis separate','Approved fictional emblem','Optional, initials/neutral fallback','Choose supported image within limit; failed image does not discard other form values'),
'url':('Allowed https URL with destination preview; no executable/javascript/data link','https://example.invalid/resource','Optional missing link means unavailable playback','Enter permitted HTTPS link; no credential/token-bearing public URL'),
'integer':('Nonnegative integer; positive quantity/copy/count when used to reserve/issue; maximum constrained by actual stock/capacity','2 copies; 15 setup minutes','Unknown capacity is not unlimited; review before admitting/booking','Enter whole number within actual permitted capacity; cannot return more stock than issued'),
'money':('Decimal original amount and currency; receipt/refund positive, reversal typed separately; USD 2 decimals, LBP proposed whole-unit ledger precision','USD 25.00; LBP 900000','Blank is unrecorded; fee waiver/no charge is explicit zero in fee snapshot only','Enter actual amount/currency; allocation/reversal equations must reconcile; never merge currency cash balances'),
'currency':('USD / LBP initially; additional actual currency requires finance-approved ledger support','LBP','No silent default conversion','Select original currency; event currency locked once participants exist'),
'rate':('Positive decimal, proposed up to 8 decimal places, with explicit currency direction/date/source','Fictional 90000 LBP per USD','Missing means no equivalent calculated; not a live exchange quote','Enter positive rate and both currency directions/source/date; historical values not overwritten'),
'hours':('Nonnegative decimal hours, proposed quarter-hour display; actual source retained','2.5','Unrecorded is not zero completed hours','Enter actual served hours; confirm independent reviewer before approval'),
'zone':('Approved IANA time-zone identifier for owning parish','Asia/Beirut','No guessing from viewer/device; configured parish zone needed','Choose valid parish zone; show local/optional viewer equivalent distinctly'),
'audience':('Author private / Named recipients / Selected group(s) / Office-clergy / Members / Public; permitted subset by record type','Selected ministry EX-G01','Default private/restricted until publish authority chooses','Choose eligible audience; expanding audience rechecks attachments and approval'),
'attendance':('Not recorded / Present / Late / Absent / Excused / Not expected','Late','Unrecorded never inferred Absent','Select actual status for the exact meeting/person; closed period needs correction'),
'secretCode':('Random participant/event-session code; verify with separate collector identity, never code alone','Masked ••••','Unavailable code uses verified guardian/lead fallback, not invented code','Keep code private; incorrect/lost code routes to authorized identity check; no ordinary export'),
'latitude':('Decimal from −90 to 90 with approved source','33.0 (fictional only)','Unknown coordinates excluded from radius match','Enter verified latitude within range; no name-based guess'),
'longitude':('Decimal from −180 to 180 with approved source','35.0 (fictional only)','Unknown coordinates excluded from radius match','Enter verified longitude within range; latitude and longitude reviewed together'),
'location':('Browser coordinates only after user action, session-only purpose','Temporary visitor location','Denied/unavailable uses manual locality search','Never require location to browse; clear precise coordinates on request/end of session')}

OPTIONS={
'clergyTitle':'Only competent-authority approved ecclesiastical titles; existing Deacon/Priest/Bishop eligibility requires real appointment/title policy (U02).',
'recoveryMethod':'Verified real contact challenge / Reviewed manual member recovery / Reviewed privileged recovery / Lost-device review.',
'identityMethod':'In-person original checked / Existing reviewed office invitation / Verified contact plus sufficient matching facts / Independently reviewed representative evidence. A phone/surname match alone is insufficient.',
'deliveryMethod':'Verified office collection / Office-reviewed authenticated download / Real verified-contact download challenge / Manual private invitation handoff. Postal delivery only if actual parish procedure approved.',
'relationship':'Self / Verified parent or guardian / Authorized adult representative / Funeral-family contact / Other pending review.',
'membershipDecision':'Needs information / Link approved / Declined / Withdrawn / Membership departure reviewed.',
'fieldId':'Only fields the own-record correction UI explicitly supports; excludes login identities, register number, signature and another adult’s fields.',
'personStatus':'Provisional / Active / Inactive / Reported deceased / Verified deceased / Archived; membership is separate.',
'bloodType':'Unknown / A+ / A− / B+ / B− / AB+ / AB− / O+ / O−, always declared/unverified unless source proves more.',
'communicationPreference':'Optional in-app community updates on/off; each genuinely configured external channel on/off; required own-case/security availability remains.',
'relationshipType':'Parent / Child / Spouse / Sibling / Step relationship / Adoptive relationship / Guardian / Unrelated co-resident / Other verified relation / Unknown; sensitive relation visibility restricted.',
'importMode':'Validate only / Commit all validated rows / Explicit valid-row-only commit with exclusions.',
'sacramentType':'Baptism / First Communion / Confirmation or chrismation / Marriage / Funeral-service record where actually approved / Verified external reference. Supported subset and official labels require U02.',
'origin':'Public guest / Signed-in unlinked / Linked member / Office telephone / Office in person / Office paper / Historical source.',
'requestType':'Supported Baptism / Communion / Confirmation/chrismation / Marriage / Funeral / Certificate / Facility / Mass intention / Blessing / Sick visit / Priest appointment / Ministry inquiry / General request.',
'urgency':'Routine / Time-sensitive with date/reason / Urgent pastoral contact advised; no automatic emergency dispatch.',
'requirementStatus':'Missing / Uploaded / Paper received / Under review / Verified / Rejected-illegible / Expired / Waived under competent policy.',
'instructionStage':'Proposed allow-list: case acceptance; official-entry approval after actual celebration/readiness; certificate preparation approval. Final stages require clergy approval U04; excludes signature, episcopal decision and release authority.',
'instructionChannel':'In person / Telephone / Written instruction / Other recorded actual channel; optional unknown instruction time remains unknown.',
'rite':'Only jurisdiction-approved launch values supplied under U02; no inferred universal or national rite list.',
'specialReview':'Not assessed / Required / Not required by approved policy / Permission pending / Permission verified; never automated religious eligibility.',
'certificateType':'Only actual competent-authority approved extracts/types from U05; prepared forms are not proof of official issuance.',
'documentLayout':'Approved single-language / Approved bilingual / Approved trilingual; availability depends on supplied templates, not language selector alone.',
'bishopDecision':'Not applicable under explicit policy / Awaiting / Accepted / Returned; legacy missing metadata stays Unknown historic.',
'legacyFlag':'Contemporaneous current issue / Legacy issued with actual provenance / Legacy needs individual review.',
'eventType':'Mass/liturgy / Sacramental celebration / Ministry meeting / Parish activity / Pastoral appointment / Volunteer duty / Facility-maintenance block.',
'occurrenceScope':'This occurrence / This and future eligible occurrences / Entire eligible series; completed facts not rewritten.',
'groupType':'Ministry / Choir / Catechism or formation class / Committee / Temporary event team / Other approved group.',
'rsvp':'Yes / No / Undecided / Not requested; changes until published deadline, default meeting start.',
'itemCondition':'Good / Needs inspection / Damaged / Missing / Unusable / Repaired and cleared.',
'commitmentStatus':'Invited / Offered / Awaiting confirmation / Confirmed / Declined / Cancellation requested / Cancelled / Completed.',
'seatStatus':'Submitted without hold / Reserved / Waitlisted / Offer pending / Confirmed / Cancelled / Withdrawn / Legacy needs review.',
'transportChoice':'No selection yet / Own transport / Specific approved route/seat option; exact route list/cost supplied per event.',
'method':'Cash actually received/paid / Verified bank transfer / Verified OMT where actually used / Claimed transfer pending verification. No card/gateway success without provider.',
'severity':'Routine repair / Disruptive unavailable resource / Immediate unsafe resource; qualified clearance remains required.',
'role':'Super Admin / Bishop via controlled ecclesiastical onboarding / Archdiocese Admin / Assigned priest / Parish Admin / Secretary / Treasurer / Ministry leader / Finance viewer; selected reviewer grants are independent.',
'bundle':'Presence / Office / Community / Complete under the explicitly reviewed feature matrix; manual billing baseline.',
'expenseType':'Supplier invoice (not yet paid) / Purchase request / Actual direct purchase / Reimbursement claim / Reimbursement paid / Reversal/adjustment.',
'ledgerType':'Initial balance (once/currency) / Allowance transfer in / Actual purchase / Return transfer / Reversal/adjustment.',
'channel':'In-app / Manual recorded handoff/call / Configured verified external channel; unavailable channels never report delivery.',
'concernCategory':'Approved Operational conduct / Interpersonal conduct / Restricted safeguarding-sensitive / Other; actual category/referral definitions require independent owner U07.',
'anonymityChoice':'Identified with separately scoped identity access / Anonymous to reviewers with explained technical limits.',
'noteAudience':'Author only / Named eligible priest(s) for this task / Current priests assigned to this parish with future-reader warning; member personal notes remain author only.',
'taskStatus':'Draft / Open / In progress / Waiting / Completed / Cancelled / Archived; reopen adds event.',
'priority':'Routine / Time-sensitive / High with reason; does not override authority/prerequisites.',
'pauseMode':'Allow new runs / Pause new runs, existing continue / Explicit safety-stop affected runs, with impact review.',
'dataRequestType':'Own-data access / Correction / Account closure / Restricted deletion review / Retention expiry review / Disclosure complaint.',
'recordClasses':'Account / Person/household / Official register/certificate / Request/evidence / Financial / Incident / Concern / Pastoral/private note / Message / Published content / Audit; one or explicit set.',
'sortOrder':'Chosen-language name / Locality / Verified approximate distance when available; operational collections additionally date/status as permitted.',
'frequency':'One-time promise / Weekly / Monthly / Quarterly / Annual / Explicit dated installments; actual receipts remain separate.',
'publicPrayerChoice':'Clergy private (default) / Anonymous public after review / Named public with explicit authority and reviewed wording.',
'exportColumns':'Explicit permitted column allow-list shown in preview; denied/private fields cannot be added by preference or query.',
'exportSelection':'Selected IDs / All records matching fixed authorized filters / Complete collection only with explicit full-scope grant.'}

# Actual localized validation sentences; resolved with each field's own label below.
ERRORS={
'id':('This reference is generated after a successful save.','Ce numéro est généré après un enregistrement réussi.','يُنشأ هذا المرجع بعد نجاح الحفظ.'),
'system':('This value is maintained by the service.','Cette valeur est gérée par le service.','تُدار هذه القيمة بواسطة الخدمة.'),
'name':('Enter the supplied name, up to 200 characters; do not invent a translation.','Saisissez le nom fourni, avec au plus 200 caractères ; ne créez pas de traduction.','أدخل الاسم كما قُدّم، بحد أقصى 200 حرف، ولا تختلق ترجمة.'),
'text':('Use no more than 500 characters.','Utilisez au maximum 500 caractères.','استخدم ما لا يزيد على 500 حرف.'),
'long':('Use no more than 10,000 characters and check the intended audience.','Utilisez au maximum 10 000 caractères et vérifiez les destinataires autorisés.','استخدم ما لا يزيد على 10000 حرف وتحقّق من الجمهور المخوّل.'),
'ref':('Select a permitted matching record, or explicitly record an allowed external reference.','Sélectionnez un dossier correspondant autorisé, ou indiquez explicitement une référence externe permise.','اختر سجلًا مطابقًا مسموحًا به، أو سجّل بوضوح مرجعًا خارجيًا مسموحًا به.'),
'refs':('Select only permitted records and remove duplicate selections.','Sélectionnez uniquement des dossiers autorisés et supprimez les doublons.','اختر السجلات المسموح بها فقط وأزل الاختيارات المكررة.'),
'date':('Enter a valid date matching the stated precision; do not replace an unknown date with a guess.','Saisissez une date valide correspondant à la précision indiquée ; ne remplacez pas une date inconnue par une estimation inventée.','أدخل تاريخًا صحيحًا يطابق الدقة المحددة، ولا تستبدل التاريخ المجهول بتخمين.'),
'datetime':('Enter a valid date, time and time zone; the end must follow the start.','Saisissez une date, une heure et un fuseau valides ; la fin doit suivre le début.','أدخل تاريخًا ووقتًا ومنطقة زمنية صحيحة؛ يجب أن تكون النهاية بعد البداية.'),
'time':('Enter a valid local time without rounding the actual supplied time.','Saisissez une heure locale valide sans arrondir l’heure réellement fournie.','أدخل وقتًا محليًا صحيحًا من دون تقريب الوقت الفعلي المقدّم.'),
'email':('Check the email format; entering an address does not verify it.','Vérifiez le format de l’adresse ; la saisie ne constitue pas une vérification.','تحقّق من صيغة البريد؛ إدخال العنوان لا يعني التحقّق منه.'),
'phone':('Include the country code; international numbers are accepted.','Indiquez l’indicatif du pays ; les numéros internationaux sont acceptés.','أضف رمز البلد؛ تُقبل الأرقام الدولية.'),
'password':('Use 16–200 characters; password confirmation must match.','Utilisez de 16 à 200 caractères ; la confirmation doit correspondre au mot de passe.','استخدم من 16 إلى 200 حرف؛ يجب أن يطابق تأكيد كلمة المرور الكلمة الأصلية.'),
'precision':('Choose Exact, Year only, Approximate or Unknown consistently with the supplied date.','Choisissez une date exacte, une année seule, une date approximative ou inconnue selon l’information fournie.','اختر تاريخًا دقيقًا أو سنة فقط أو تقريبيًا أو مجهولًا بما يطابق المعلومات المقدّمة.'),
'verification':('Verification requires an actual method, qualified reviewer and outcome.','La vérification exige une méthode réelle, un examinateur habilité et un résultat.','يتطلب التحقّق طريقة فعلية ومراجعًا مخوّلًا ونتيجة مسجّلة.'),
'language':('Choose English, French or Arabic; an official document also needs an approved template.','Choisissez l’anglais, le français ou l’arabe ; un document officiel exige aussi un modèle approuvé.','اختر الإنكليزية أو الفرنسية أو العربية؛ ويتطلب المستند الرسمي أيضًا نموذجًا معتمدًا.'),
'consent':('Record the actual response, authorized person, wording version and date; blank is not consent.','Enregistrez la réponse réelle, la personne habilitée, la version du texte et la date ; une case vide ne vaut pas consentement.','سجّل الإجابة الفعلية وصاحب الصلاحية وإصدار النص والتاريخ؛ الفراغ لا يعني الموافقة.'),
'boolean':('Choose the actual value; an unknown historical value grants no permission.','Choisissez la valeur réelle ; une valeur historique inconnue n’accorde aucune autorisation.','اختر القيمة الفعلية؛ القيمة السابقة المجهولة لا تمنح أي إذن.'),
'decision':('Only the eligible authority may decide after prerequisites; give a reason for return or refusal.','Seule l’autorité habilitée décide après les prérequis ; indiquez le motif d’un renvoi ou refus.','صاحب الصلاحية وحده يقرر بعد استيفاء المتطلبات؛ اذكر سبب الإعادة أو الرفض.'),
'choice':('Choose an approved listed value; an unsupported option cannot bypass review.','Choisissez une valeur approuvée de la liste ; une option non prise en charge ne peut contourner l’examen.','اختر قيمة معتمدة من القائمة؛ لا يجوز لخيار غير مدعوم تجاوز المراجعة.'),
'file':('Use PDF, JPEG or PNG, at most 10 MB per file and 20 files per case; larger evidence needs office review.','Utilisez PDF, JPEG ou PNG, au plus 10 Mo par fichier et 20 fichiers par dossier ; les pièces plus volumineuses nécessitent un examen au bureau.','استخدم PDF أو JPEG أو PNG، بحد أقصى 10 ميغابايت للملف و20 ملفًا للطلب؛ وتحتاج الملفات الأكبر إلى مراجعة المكتب.'),
'image':('Choose a JPEG or PNG image within 10 MB and review it before sending.','Choisissez une image JPEG ou PNG de 10 Mo au maximum et vérifiez-la avant l’envoi.','اختر صورة JPEG أو PNG لا تتجاوز 10 ميغابايت وراجعها قبل الإرسال.'),
'url':('Use an approved HTTPS address without private access tokens.','Utilisez une adresse HTTPS approuvée sans jeton d’accès privé.','استخدم عنوان HTTPS معتمدًا من دون رموز وصول خاصة.'),
'integer':('Enter a whole number within the permitted quantity or actual capacity.','Saisissez un nombre entier respectant la quantité autorisée ou la capacité réelle.','أدخل عددًا صحيحًا ضمن الكمية المسموحة أو السعة الفعلية.'),
'money':('Enter the actual amount and original currency; allocations must reconcile.','Saisissez le montant réel et la devise d’origine ; les ventilations doivent être équilibrées.','أدخل المبلغ الفعلي والعملة الأصلية؛ يجب أن تتطابق توزيعات المبلغ.'),
'currency':('Choose USD or LBP; do not change a locked event currency.','Choisissez USD ou LBP ; ne modifiez pas la devise verrouillée d’un événement.','اختر USD أو LBP؛ لا تغيّر عملة نشاط مقفلة.'),
'rate':('Enter a positive rate, currency direction, actual date and source.','Saisissez un taux positif, le sens de conversion, la date réelle et la source.','أدخل سعر صرف موجبًا واتجاه التحويل والتاريخ الفعلي والمصدر.'),
'hours':('Enter actual hours served; approval requires the designated independent reviewer.','Saisissez les heures réellement effectuées ; l’approbation exige l’examinateur indépendant désigné.','أدخل ساعات الخدمة الفعلية؛ يتطلب الاعتماد المراجع المستقل المعيّن.'),
'zone':('Choose the owning parish’s valid IANA time zone.','Choisissez le fuseau IANA valide de la paroisse concernée.','اختر المنطقة الزمنية الصحيحة للرعية وفق معرّف IANA.'),
'audience':('Choose only an authorized audience and review file access before broadening it.','Choisissez uniquement un public autorisé et vérifiez l’accès aux fichiers avant de l’élargir.','اختر جمهورًا مخوّلًا فقط وراجع صلاحيات الملفات قبل توسيع النطاق.'),
'attendance':('Record the actual status for this person and meeting; unknown is not absent.','Enregistrez le statut réel de cette personne à cette réunion ; inconnu ne signifie pas absent.','سجّل الحالة الفعلية لهذا الشخص واللقاء؛ المجهول لا يعني الغياب.'),
'secretCode':('Keep the code private; verify the collector’s identity separately.','Gardez le code confidentiel ; vérifiez séparément l’identité de la personne qui vient chercher le participant.','حافظ على سرية الرمز وتحقّق من هوية المستلم بصورة منفصلة.'),
'latitude':('Enter verified latitude between −90 and 90.','Saisissez une latitude vérifiée entre −90 et 90.','أدخل خط عرض متحقّقًا منه بين ‎−90 و90.'),
'longitude':('Enter verified longitude between −180 and 180.','Saisissez une longitude vérifiée entre −180 et 180.','أدخل خط طول متحقّقًا منه بين ‎−180 و180.'),
'location':('Location is optional and session-only; use manual locality search if unavailable.','La localisation est facultative et limitée à la session ; utilisez la recherche par localité si elle est indisponible.','الموقع اختياري ولهذه الجلسة فقط؛ استخدم البحث عن المحلة يدويًا عند عدم توفره.')}

TYPE_RULES['evidenceStatus']=('Missing / Uploaded / Paper received / Under review / Verified / Rejected-illegible / Expired / Waived','Paper received','Receipt alone is not verification; unknown never Verified','Use the actual outcome and reviewer; rejected item requests replacement; waiver requires competent authority')
ERRORS['evidenceStatus']=ERRORS['verification']

def conditional(k,n):
    c={
'email':'At least one usable email or phone is supplied; identity/recovery may require a real verified route.',
'phone':'At least one usable phone or email; direct pastoral logistics needs actual contact method.',
'familyName':'Required only if supplied/needed by approved official template; unknown provisional intake must remain possible.',
'nameEn':'Before output requiring this supplied name/script; not a provisional-person gate.',
'nameAr':'Before output requiring supplied Arabic spelling; unknown intake allowed.',
'nameFr':'Before output requiring supplied French/Latin spelling; identical supplied Latin spelling may be valid.',
'birthDate':'Exact age/official fact requires evidence; otherwise precision/unknown recorded and eligibility review blocks unsafe final step.',
'bloodType':'Omitted from the ordinary default person form; show only for a documented approved care purpose and specifically authorized readers. Declared value is not clinical verification.',
'medicalAlert':'Only for a documented relevant event/care purpose with assigned restricted staff. Omitted from ordinary person lists/search and general export.',
'sourceEntry':'Required for certificate issuance/release; planned case allowed only while waiting for source.',
'plannedSacrament':'Only certificate waiting for a planned celebration; exact source linked after official approval.',
'fatherName':'Only if known and required by approved person/sacramental template; adult/unknown-parent routes allow not supplied.',
'motherName':'Only if known and required by approved template; never force false parental data.',
'guardian':'When verified minor/dependent representation/consent is required by approved policy.',
'authorityEvidence':'When subject/requester/collector differ or representation is disputed; minimal verified basis, not routine unnecessary identity-copy collection.',
'instructionPriest':'Only when secretary records an already-given case-specific priest decision; must be eligible at action time.',
'instructionStage':'Required for secretary recording route; choose exact permitted decision on this case.',
'instructionStatement':'Secretary recording route only: affirm actual prior instruction; no independent secretary decision.',
'instructionChannel':'Secretary recording route: record actual known channel; do not invent evidence.',
'instructionWhen':'Record actual known instruction time; unknown is permitted and differs from immutable entry timestamp.',
'externalPermission':'Required at relevant final gate when competent clergy identifies outside/special authority need.',
'signatureEvidence':'Required before document considered personally signed; never filled by proxy approval instruction.',
'bishopDecision':'New certificate proposed default: required after signature; explicit approved exception/legacy status separately labeled.',
'bishopReason':'Required on bishop return; restricted clergy/preparation audience only.',
'resubmissionNote':'Required when a returned certificate is revised/resubmitted; material changes repeat signature and review.',
'consentChoice':'Before event confirmation/check-in where approved event policy requires; not required to reserve a pending place.',
'consentVersion':'When consent is requested; pin exact reviewed wording and purpose.',
'consentActor':'When consent exists; verify subject/guardian purpose scope.',
'consentAt':'Actual giver/received-paper time; never backdate system entry.',
'rate':'Only when a real conversion/allocation or labeled reporting equivalent is calculated.',
'rateDate':'Required whenever rate is used; original transaction date/rate basis recorded separately.',
'rateSource':'Required with any applied rate; no invented current rate.',
'convertedAmount':'Only when rate/direction/source present; remain separate from actual original currency.',
'currentPassword':'Protected authenticated identity/admin changes; no account password requested by ordinary office intake.',
'secondApprover':'Independent approval for posted corrections, refunds, period close or protected administrative change; own role switch never counts.',
'collector':'Required for collected pickup except separately approved independent departure.',
'collectorCheck':'Required on ordinary handover; a matching pickup code does not replace it.',
'pickupCode':'Only genuinely issued event-session code; lost/unavailable invokes verified identity/lead procedure.',
'independentExit':'Only when actual event and guardian/participant policy expressly allows it.',
'eventId':'Required for a live scheduled plan/check-in/registration; legacy/unlinked remains not operational. Incident can be expressly parish-wide.',
'publicTitle':'Only when event publicly published; use generic sacramental/service title unless separate naming permission.',
'publicityConsent':'Only when actual identifiable publication is proposed; not combined with ordinary service request.',
'reason':'Required for refusal, cancellation, correction, privilege/authority change, exceptional waiver or override; optional ordinary draft context.',
'expiryAt':'Required for invitation, temporary hold and finite document release; not certificate validity or deletion deadline.',
}
    return c.get(k,'Required only when the corresponding named action/variant is selected; exact dependency is described in this form’s workflow card. Unknown factual/domain policy remains an explicit input and blocks that dependent final action, not legitimate draft intake.')

def render_fields():
    # Correct overstrict source-draft bindings: address unknown and noncertificate release.
    BINDINGS[8]=BINDINGS[8].replace('address*','address')
    BINDINGS[21]=BINDINGS[21].replace('sourceEntry*','sourceEntry?')
    BINDINGS[6]=BINDINGS[6].replace('bloodType medicalAlert','bloodType? medicalAlert?')
    lines=['# Field dictionary and form bindings','',
    'Proposed field-level specification for all 65 retained journey forms. EN/AR/FR labels and errors are draft translations requiring named language/domain review. Official religious wording and jurisdiction-specific mandatory checklists remain U02/U05; this dictionary does not invent them. A required-at-final field never becomes an impossible intake requirement when the workflow explicitly permits provisional/unknown information.', '',
    '## How to read the rows','',
    'Each form row has a unique `<form>.<key>` field ID. Master type/privacy definitions below are normative parts of every binding, not omitted details. `Required` means at the named submission/action in the linked workflow; `Conditional` gives its exact common condition below and the specific workflow action must be selected. Optional unknowns remain not supplied. System fields are generated, not applicant input. Before implementation, compare this proposed dictionary with every actual retained input; differences require design review, not automatic field deletion.', '',
    'All saved records have actual immutable ID, owning scope, created/updated actor/time and revision. Account creation/recovery/public search/context preference do not require an invented parish. Imported/historical original event times are separate fields from current entry time. Sensitive raw values, passwords, tokens and allegations never enter general audit; audit records only a restricted field identifier/change event and authorized private history as appropriate.', '',
    '## Privacy, editing, locking and output profiles','',table(['Profile','View','Edit','Lock/version rule','Search','Notification/print/export'],[(k,*v) for k,v in PROFILES.items()]),'',
    '## Allowed values, examples, unknowns and validation','',table(['Type','Allowed values','Fictional example','Unknown / not applicable','Validation / EN guidance'],[(k,*v) for k,v in TYPE_RULES.items()]),'',
    '## Enumerated field options','',table(['Field','Explicit options / domain input'],OPTIONS.items()),'',
    '## Error copy','',
    'Required: EN “Enter {label}.” / FR “Renseignez {label}.” / AR “أدخل {label}.” Conditional: EN “Complete {label} before this action.” / FR “Complétez {label} avant cette action.” / AR “أكمل {label} قبل هذا الإجراء.” Validation: EN “Check {label}: {localized rule}.” / FR “Vérifiez {label} : {règle localisée}.” / AR “تحقّق من {label}: {القاعدة المترجمة}.” These templates resolve per field to the explicit type/option rule; all rule/help translations must be reviewed before claiming complete localization.', '',
    'Specific blocking errors: EN “This item changed. Compare the current version before saving.” / FR “Cet élément a changé. Comparez la version actuelle avant d’enregistrer.” / AR “تغيّر هذا السجل. قارن الإصدار الحالي قبل الحفظ.” EN “Your access changed. This action was not completed.” / FR “Vos accès ont changé. Cette action n’a pas été effectuée.” / AR “تغيّرت صلاحياتك. لم يُنفّذ هذا الإجراء.” EN “File not uploaded. The saved request is unchanged; retry this file only.” / FR “Fichier non téléversé. La demande enregistrée est conservée ; réessayez uniquement ce fichier.” / AR “لم يُرفع الملف. يبقى الطلب المحفوظ كما هو؛ أعد محاولة رفع هذا الملف فقط.”', '',
    '## Field catalog','',table(['Key','English label','العربية','Français','Purpose / type','Privacy/edit/lock/output'],[(k,v['en'],v['ar'],v['fr'],'Collect/derive '+v['en'].lower()+' for the specific named journey; '+v['type'],v['privacy']) for k,v in FIELDS.items()]),'']
    lines += ['## Resolved per-field error copy','',table(['Field','EN required / invalid','FR obligatoire / invalide','AR مطلوب / غير صالح'],[(k,'Enter '+v['en']+'. '+ERRORS[v['type']][0],'Renseignez '+v['fr']+'. '+ERRORS[v['type']][1],'أدخل '+v['ar']+'. '+ERRORS[v['type']][2]) for k,v in FIELDS.items()]),'']
    inventory=[]
    for w in WORKFLOWS:
        wid=w[0];n=int(wid[2:]);fid=f'FM{n:02}'
        rows=[]
        tokens=BINDINGS[n].split()
        used=[]
        for token in tokens:
            k=token.rstrip('*?');mark=token[-1] if token[-1] in '*?' else ''
            assert k in FIELDS,(fid,k)
            assert k not in used,(fid,k)
            used.append(k);f=FIELDS[k]
            required='Required for specified action' if mark=='*' else 'Conditional: '+conditional(k,n) if mark=='?' else 'Optional; blank remains not supplied'
            if f['type'] in {'system','id'}: source='System derived; read-only actual record metadata'
            elif k in {'originalValue','currentValue','reviewedRevision','requirementVersion','formVersion','templateVersion','sourceEntry','fund','eventId','clergyAssignment','eligibility','capacity','refundPolicy'}: source='Prefill from permission-checked selected source/template; display provenance; user may change only through named owning workflow'
            elif k in {'appliedValue','competentApproval','verifiedBy','bishopDecision','secondApprover','deceasedVerified','contactVerification'}:source='Actual authorized reviewer/action; never applicant-authenticated assertion presented as independent approval'
            else:source='Supplied by eligible actor named in workflow; member prefill uses only own/verified-representation fields; guest sees no office record picker'
            lock='System immutable' if f['type'] in {'system','id','password','secretCode'} else 'Profile '+f['privacy']+' plus workflow stage; closed/approved source snapshots never overwritten'
            rows.append((fid+'.'+k,f['en']+' / '+f['ar']+' / '+f['fr'],required,source,f['type']+'; '+OPTIONS.get(k,'see explicit type rules'),f['privacy'],lock,'Actual field-change event in same restricted parent history; secret values excluded'))
            inventory.append(dict(id=fid+'.'+k,form=fid,workflow=wid,key=k,required=required,privacy=f['privacy']))
        lines += [f'## {fid}','',f'**{w[1]}** — [entry, stages and exceptions](workflow-specifications.md#{wid.lower()}). Purpose: {w[3]}', '',
        table(['Field ID','EN / AR / FR label','Required/conditional/unknown','Source/prefill','Allowed values and error rule','View/edit/output profile','Lock point','Audit'],rows),'',
        'Form acceptance: missing required values produce linked field error/summary without data loss; an allowed Unknown is not silently replaced. Recheck chosen references/scope/revision at commit. Compare keyboard/phone/Arabic reflow and all output profiles against this specific field list. Exact official text/domain requirements remain an approval dependency, not a blank form template.', '']
    write('field-dictionary.md','\n'.join(lines));write('field-inventory.json',json.dumps(inventory,ensure_ascii=False,indent=2))
    print(f'{len(FIELDS)} field definitions, {len(BINDINGS)} forms, {len(inventory)} explicit field bindings.')

if __name__=='__main__':render_fields()
