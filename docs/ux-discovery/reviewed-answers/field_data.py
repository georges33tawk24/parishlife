"""Proposed trilingual field definitions and explicit per-form bindings."""
# key | EN | Arabic | French | validation type | privacy profile
RAW_FIELDS = '''
recordId|Reference|المرجع|Référence|id|S
parishId|Parish|الرعية|Paroisse|ref|O
actorId|Recorded by|سجّله|Saisi par|system|S
revision|Revision|الإصدار|Révision|system|S
createdAt|Created at|تاريخ الإنشاء|Date de création|system|S
updatedAt|Updated at|تاريخ التحديث|Date de mise à jour|system|S
givenName|Given name|الاسم|Prénom|name|I
familyName|Family name|اسم العائلة|Nom de famille|name|I
nameEn|Supplied English name|الاسم بالإنكليزية كما قُدّم|Nom anglais fourni|name|I
nameAr|Supplied Arabic name|الاسم بالعربية كما قُدّم|Nom arabe fourni|name|I
nameFr|Supplied French name|الاسم بالفرنسية كما قُدّم|Nom français fourni|name|I
birthSurname|Birth surname|اسم العائلة عند الولادة|Nom de naissance|name|I
title|Title|العنوان|Titre|text|O
clergyTitle|Clergy title|الرتبة الكنسية|Titre ecclésiastique|choice|I
birthDate|Date of birth|تاريخ الولادة|Date de naissance|date|I
datePrecision|Date precision|دقة التاريخ|Précision de la date|precision|I
reportedDeathDate|Reported date of death|تاريخ الوفاة المبلّغ عنه|Date de décès déclarée|date|I
deceasedVerified|Deceased status verified|التحقّق من الوفاة|Décès vérifié|decision|I
email|Email|البريد الإلكتروني|Adresse e-mail|email|A
phone|Phone with country code|رقم الهاتف مع رمز البلد|Téléphone avec indicatif|phone|A
username|Username|اسم المستخدم|Nom d’utilisateur|text|A
password|Password|كلمة المرور|Mot de passe|password|X
confirmPassword|Confirm password|تأكيد كلمة المرور|Confirmer le mot de passe|password|X
currentPassword|Current password|كلمة المرور الحالية|Mot de passe actuel|password|X
contactVerification|Contact verification|التحقّق من وسيلة الاتصال|Vérification du contact|verification|S
language|Interface language|لغة الواجهة|Langue de l’interface|language|A
noticeAccepted|Required notice acknowledged|الإقرار بالاطلاع على الإشعار المطلوب|Prise de connaissance requise|consent|A
sessionId|Session|الجلسة|Session|ref|S
recoveryMethod|Recovery method|طريقة استعادة الحساب|Méthode de récupération|choice|S
identityMethod|Identity check method|طريقة التحقّق من الهوية|Méthode de contrôle d’identité|choice|D
verificationNote|Verification note|ملاحظة التحقّق|Note de vérification|long|D
targetAccount|Intended account|الحساب المقصود|Compte concerné|ref|S
personId|Person|الشخص|Personne|ref|I
expiryAt|Expiry date and time|تاريخ ووقت الانتهاء|Date et heure d’expiration|datetime|O
invitePurpose|Invitation purpose|الغرض من الدعوة|Objet de l’invitation|text|O
deliveryMethod|Delivery method|طريقة التسليم|Mode de remise|choice|O
deliveryRecorded|Actual delivery recorded|تسجيل التسليم الفعلي|Remise effective enregistrée|decision|D
relationship|Relationship to subject|الصلة بصاحب الطلب|Lien avec la personne concernée|choice|I
authorityScope|Representation scope|نطاق التمثيل|Portée de la représentation|long|D
authorityEvidence|Authority evidence|إثبات الصلاحية|Justificatif d’autorité|file|D
primaryParish|Primary parish|الرعية الأساسية|Paroisse principale|ref|A
following|Follow this parish|متابعة هذه الرعية|Suivre cette paroisse|boolean|A
membershipDecision|Membership decision|قرار العضوية|Décision d’adhésion|decision|O
fieldId|Field to correct|الحقل المطلوب تصحيحه|Champ à corriger|choice|O
originalValue|Original value|القيمة الأصلية|Valeur initiale|text|I
proposedValue|Proposed value|القيمة المقترحة|Valeur proposée|text|I
currentValue|Current value|القيمة الحالية|Valeur actuelle|text|I
appliedValue|Applied value|القيمة المعتمدة|Valeur appliquée|text|I
reason|Reason|السبب|Motif|long|O
applicantMessage|Message to applicant|رسالة إلى مقدّم الطلب|Message au demandeur|long|O
internalNote|Internal staff note|ملاحظة داخلية للموظفين|Note interne|long|D
recordPurpose|Record purpose/source|الغرض من السجل ومصدره|Objet et source du dossier|long|O
personStatus|Person status|حالة الشخص|Statut de la personne|choice|O
country|Country|البلد|Pays|text|O
region|Region/governorate|المنطقة أو المحافظة|Région ou gouvernorat|text|O
district|District|القضاء|District|text|O
town|Town/locality|البلدة أو المحلة|Localité|text|O
sector|Sector|الحي|Secteur|text|O
address|Address|العنوان البريدي|Adresse|long|D
addressOverride|Individual address override|عنوان فردي مختلف|Adresse individuelle distincte|long|D
occupation|Occupation|المهنة|Profession|text|O
skills|Skills|المهارات|Compétences|long|G
bloodType|Reported blood type|فصيلة الدم المبلّغ عنها|Groupe sanguin déclaré|choice|M
medicalAlert|Relevant declared care alert|تنبيه رعاية ذي صلة كما أُبلغ عنه|Alerte de soins déclarée pertinente|long|M
photo|Profile photograph|الصورة الشخصية|Photo de profil|image|D
directoryConsent|Directory disclosure consent|الموافقة على النشر في الدليل|Consentement à la publication dans l’annuaire|consent|K
publicityConsent|Photo/name publicity permission|الإذن بنشر الصورة أو الاسم|Autorisation de publier photo ou nom|consent|K
communicationPreference|Optional communication choices|خيارات التواصل الاختياري|Préférences de communication facultative|choice|A
consentVersion|Consent wording version|إصدار نص الموافقة|Version du consentement|ref|K
sourcePersonIds|Candidate/source people|الأشخاص المرشحون أو المصدر|Personnes candidates ou sources|refs|I
survivorPersonId|Surviving person record|سجل الشخص المحتفَظ به|Dossier de personne conservé|ref|I
fieldResolutions|Field conflict decisions|قرارات تعارض الحقول|Décisions sur les champs en conflit|long|D
impactSummary|Impact summary|ملخص الأثر|Résumé des conséquences|long|D
householdId|Household|الأسرة|Foyer|ref|O
householdContact|Household contact|جهة الاتصال بالأسرة|Contact du foyer|ref|O
relatedPersonId|Related person|الشخص المرتبط|Personne liée|ref|I
relationshipType|Relationship type|نوع الصلة|Type de lien|choice|I
effectiveFrom|Effective from|ساري من|Prend effet le|datetime|O
effectiveTo|Effective until|ساري حتى|Valable jusqu’au|datetime|O
envelopeId|Household envelope number|رقم ظرف التبرعات للأسرة|Numéro d’enveloppe du foyer|text|F
sourceFile|Source file|ملف المصدر|Fichier source|file|D
sourceOwner|Source owner|المسؤول عن المصدر|Responsable de la source|text|O
sourceHash|Source fingerprint|بصمة المصدر|Empreinte de la source|system|S
columnMapping|Column mapping|مطابقة الأعمدة|Correspondance des colonnes|long|O
rowOutcome|Row outcome|نتيجة الصف|Résultat de la ligne|system|O
importMode|Import mode|طريقة الاستيراد|Mode d’importation|choice|O
sourceParish|Source parish|رعية المصدر|Paroisse d’origine|text|I
sourceDiocese|Source diocese|أبرشية المصدر|Diocèse d’origine|text|I
sourceCountry|Source country|بلد المصدر|Pays d’origine|text|I
sacramentType|Sacrament or service type|نوع السر أو الخدمة|Type de sacrement ou de service|choice|I
celebrationDate|Actual celebration date|تاريخ الاحتفال الفعلي|Date réelle de célébration|date|I
celebrationTime|Actual celebration time|وقت الاحتفال الفعلي|Heure réelle de célébration|time|I
celebrant|Actual celebrant|الكاهن المحتفل فعليًا|Célébrant effectif|text|I
registerNumber|Official register number|رقم السجل الرسمي|Numéro du registre officiel|text|I
registerBook|Register book|دفتر السجل|Volume du registre|text|I
registerPage|Register page|صفحة السجل|Page du registre|text|I
sourceEvidence|Source evidence|إثبات المصدر|Justificatif de la source|file|D
origin|Submission origin|مصدر تقديم الطلب|Origine de la demande|choice|O
requester|Requester|مقدّم الطلب|Demandeur|ref|O
subject|Subject person|الشخص المعني|Personne concernée|ref|I
requestType|Request type|نوع الطلب|Type de demande|choice|O
urgency|Urgency|درجة الاستعجال|Urgence|choice|D
preferredDate|Preferred date|التاريخ المفضّل|Date souhaitée|date|O
preferredTimes|Preferred times|الأوقات المفضّلة|Horaires souhaités|long|O
description|Description|الوصف|Description|long|O
assignee|Current assignee|المكلّف الحالي|Responsable actuel|ref|O
dueAt|Due date and time|الموعد النهائي|Date et heure limites|datetime|O
lastContactAt|Last actual contact|آخر تواصل فعلي|Dernier contact effectif|datetime|O
receivedAt|Actual receipt time|وقت الاستلام الفعلي|Date de réception effective|datetime|O
nextAction|Next action|الإجراء التالي|Prochaine action|text|O
requirementVersion|Applied requirement version|إصدار المتطلبات المطبّق|Version des exigences appliquée|ref|I
requirementItem|Required item|البند المطلوب|Élément requis|text|D
requirementStatus|Evidence status|حالة الإثبات|Statut du justificatif|evidenceStatus|D
waiverAuthority|Waiver authority|صاحب صلاحية الإعفاء|Autorité accordant la dérogation|ref|D
instructionPriest|Authorizing priest|الكاهن صاحب القرار|Prêtre ayant donné l’instruction|ref|D
instructionStage|Exact instructed decision|القرار المحدد المبلّغ|Décision précise communiquée|choice|D
instructionWhen|Instruction received at, if known|وقت تلقي التعليمات إن عُرف|Date de l’instruction si connue|datetime|D
instructionChannel|Instruction received by|وسيلة تلقي التعليمات|Mode de réception de l’instruction|choice|D
instructionStatement|Confirm prior priest instruction|تأكيد صدور تعليمات سابقة من الكاهن|Confirmer l’instruction préalable du prêtre|consent|D
fatherName|Father’s supplied name|اسم الأب كما قُدّم|Nom du père fourni|name|I
motherName|Mother’s supplied name|اسم الأم كما قُدّم|Nom de la mère fourni|name|I
guardian|Verified guardian|الولي المتحقَّق من صفته|Représentant légal vérifié|ref|K
godparents|Godparents/sponsors|العرّابون|Parrains et marraines|long|I
adultBaptism|Adult baptism route|مسار معمودية البالغ|Parcours de baptême adulte|boolean|I
priorSacrament|Verified prior sacrament reference|مرجع سر سابق متحقَّق منه|Référence vérifiée d’un sacrement antérieur|ref|I
formationEvidence|Formation evidence|إثبات التنشئة|Justificatif de formation|file|G
rite|Approved rite/jurisdiction|الطقس أو المرجعية المعتمدة|Rite ou juridiction approuvé|choice|I
linkedBaptism|Linked baptism entry|قيد المعمودية المرتبط|Acte de baptême lié|ref|I
partnerOne|First partner|الطرف الأول|Premier partenaire|ref|I
partnerTwo|Second partner|الطرف الثاني|Second partenaire|ref|I
externalPartner|Outside-parish partner details|بيانات الطرف من خارج الرعية|Détails du partenaire externe|long|I
witnesses|Witnesses|الشهود|Témoins|long|I
externalCelebrant|External celebrant authority|صلاحية الكاهن من خارج الرعية|Autorisation du célébrant externe|long|D
specialReview|Special clergy review required|الحاجة إلى مراجعة كنسية خاصة|Examen ecclésiastique particulier requis|decision|D
externalPermission|External authorization reference|مرجع الإذن الخارجي|Référence d’autorisation externe|text|D
actualOccurred|Celebration actually occurred|حصول الاحتفال فعليًا|Célébration effectivement réalisée|decision|I
appointmentLocation|Visit/appointment location|مكان الزيارة أو الموعد|Lieu de visite ou de rendez-vous|long|D
publicTitle|Approved public title|العنوان العام المعتمد|Titre public approuvé|text|U
correctionFields|Official facts to amend|الوقائع الرسمية المطلوب تعديلها|Faits officiels à rectifier|long|I
competentApproval|Competent authority approval|موافقة المرجع المختص|Approbation de l’autorité compétente|ref|D
affectedCertificates|Affected certificate versions|إصدارات الإفادات المتأثرة|Versions d’attestations concernées|refs|D
certificateType|Certificate type|نوع الإفادة|Type d’attestation|choice|I
sourceEntry|Approved source entry|القيد المصدر المعتمد|Acte source approuvé|ref|I
plannedSacrament|Planned sacramental case|طلب السر المخطط له|Dossier sacramentel prévu|ref|I
documentLanguage|Document language|لغة المستند|Langue du document|language|I
documentLayout|Approved document layout|تنسيق المستند المعتمد|Présentation approuvée du document|choice|I
copyQuantity|Number of copies|عدد النسخ|Nombre d’exemplaires|integer|O
documentPurpose|Document purpose|الغرض من المستند|Objet du document|text|D
templateVersion|Approved template version|إصدار النموذج المعتمد|Version du modèle approuvé|ref|I
signatureEvidence|Actual signature evidence|إثبات التوقيع الفعلي|Preuve de signature effective|file|D
bishopDecision|Bishop acceptance decision|قرار قبول الأسقف|Décision d’acceptation de l’évêque|decision|D
bishopReason|Bishop return reason|سبب الإعادة من الأسقف|Motif du renvoi par l’évêque|long|D
resubmissionNote|Resubmission note|ملاحظة إعادة التقديم|Note de nouvelle soumission|long|D
issueDate|Actual issue date|تاريخ الإصدار الفعلي|Date réelle de délivrance|date|I
legacyFlag|Legacy issuance|إصدار سابق|Délivrance ancienne|decision|I
fileId|File/version|الملف أو الإصدار|Fichier ou version|ref|D
recipient|Verified recipient|المستلم المتحقَّق منه|Destinataire vérifié|ref|D
recipientAuthority|Recipient authority check|التحقّق من صلاحية المستلم|Contrôle de l’autorité du destinataire|long|D
releaseConfirmed|Correct document and recipient confirmed|تأكيد صحة المستند والمستلم|Document et destinataire confirmés|consent|D
collectedAt|Actual collection time|وقت التسلم الفعلي|Date de retrait effectif|datetime|D
fileName|File name|اسم الملف|Nom du fichier|text|D
fileType|Detected file type|نوع الملف المتحقَّق منه|Type de fichier détecté|system|D
fileSize|File size|حجم الملف|Taille du fichier|system|D
pageCount|Page count|عدد الصفحات|Nombre de pages|integer|D
fileUpload|Attach file|إرفاق ملف|Joindre un fichier|file|D
paperReceived|Original/paper received|استلام الأصل أو النسخة الورقية|Original ou document papier reçu|decision|D
verifiedBy|Actual verifier|المتحقّق الفعلي|Vérificateur effectif|ref|D
verifiedAt|Verification time|وقت التحقّق|Date de vérification|datetime|D
eventId|Event/occurrence|النشاط أو الموعد المحدد|Événement ou occurrence|ref|G
eventType|Event type|نوع النشاط|Type d’événement|choice|G
startAt|Start date and time|تاريخ ووقت البدء|Date et heure de début|datetime|O
endAt|End date and time|تاريخ ووقت الانتهاء|Date et heure de fin|datetime|O
timeZone|Parish time zone|المنطقة الزمنية للرعية|Fuseau horaire paroissial|zone|O
allDay|All-day occupancy|إشغال طوال اليوم|Occupation sur toute la journée|boolean|O
recurrence|Repeat rule|قاعدة التكرار|Règle de récurrence|long|O
occurrenceScope|Occurrence change scope|نطاق تعديل المواعيد|Portée de modification des occurrences|choice|O
exceptions|Dated exceptions/cancellations|الاستثناءات أو الإلغاءات المؤرخة|Exceptions ou annulations datées|long|O
resourceIds|Rooms/equipment|القاعات أو المعدات|Salles ou matériel|refs|O
setupMinutes|Setup minutes|دقائق التجهيز|Minutes de préparation|integer|O
cleanupMinutes|Cleanup minutes|دقائق التنظيف|Minutes de remise en état|integer|O
clergyAssignment|Assigned priest|الكاهن المكلّف|Prêtre affecté|ref|I
audience|Audience|الجمهور المخوّل|Public autorisé|audience|O
publicDescription|Approved public description|الوصف العام المعتمد|Description publique approuvée|long|U
acknowledgment|Change acknowledged|الإقرار بالتغيير|Modification prise en compte|consent|K
planItems|Running-order items|فقرات البرنامج|Éléments du déroulement|long|G
itemDuration|Item duration in minutes|مدة الفقرة بالدقائق|Durée de l’élément en minutes|integer|G
fixedStart|Fixed item start|موعد بدء الفقرة الثابت|Début fixe de l’élément|time|G
responsiblePerson|Responsible person|الشخص المسؤول|Personne responsable|ref|G
readings|Readings|القراءات|Lectures|long|G
musicVersion|Music version|إصدار المادة الموسيقية|Version du morceau|ref|G
lyrics|Lyrics|كلمات الترنيمة|Paroles|long|G
chords|Chords|التآلفات الموسيقية|Accords|long|G
instrumentNotes|Instrument notes|ملاحظات الآلات|Notes instrumentales|long|G
musicKey|Musical key|المقام الموسيقي|Tonalité|text|G
season|Liturgical season|الموسم الليتورجي|Temps liturgique|text|G
rightsBasis|Usage rights and attribution|حقوق الاستخدام ونسبة المصدر|Droits d’utilisation et attribution|long|D
mediaLink|Approved media link|رابط الوسائط المعتمد|Lien média approuvé|url|G
ministryId|Ministry/group|الخدمة أو المجموعة|Ministère ou groupe|ref|G
groupType|Group type|نوع المجموعة|Type de groupe|choice|G
eligibility|Approved eligibility rules|شروط الأهلية المعتمدة|Critères d’admissibilité approuvés|long|G
capacity|Maximum places|العدد الأقصى للأماكن|Nombre maximal de places|integer|G
leaderReview|Leader review|مراجعة المسؤول|Examen par le responsable|decision|G
trialUntil|Trial end date|تاريخ انتهاء الفترة التجريبية|Fin de la période d’essai|date|G
departureReason|Private departure reason|سبب المغادرة الخاص|Motif de départ privé|long|L
membershipEnd|Membership end date|تاريخ انتهاء العضوية|Date de fin d’adhésion|date|G
meetingAgenda|Meeting agenda|جدول أعمال اللقاء|Ordre du jour|long|G
rsvp|Attendance intention|نية الحضور|Réponse de participation|choice|G
absenceReason|Private absence reason|سبب الغياب الخاص|Motif d’absence privé|long|D
attendanceStatus|Recorded attendance|الحضور المسجّل|Présence enregistrée|attendance|G
expectedFrom|Expected from date|تاريخ بدء توقع الحضور|Date de début de présence attendue|date|G
reportingPeriod|Reporting period|فترة التقرير|Période du rapport|text|O
loanItem|Loan item|الغرض المُعار|Bien prêté|ref|G
quantity|Quantity|الكمية|Quantité|integer|G
itemCondition|Condition|حالة الغرض|État du bien|choice|G
storage|Storage location|مكان التخزين|Lieu de stockage|text|G
borrower|Borrower|المستعير|Emprunteur|ref|D
issuedAt|Actual issue time|وقت الإعارة الفعلي|Date de remise effective|datetime|G
returnedAt|Actual return time|وقت الإعادة الفعلي|Date de retour effectif|datetime|G
returnedQuantity|Returned quantity|الكمية المعادة|Quantité rendue|integer|G
opportunity|Volunteer opportunity|فرصة التطوع|Mission de bénévolat|ref|G
position|Volunteer position|مهمة التطوع|Poste bénévole|text|G
availability|Declared availability|الأوقات المتاحة المصرّح بها|Disponibilités déclarées|long|G
trainingStatus|Verified training/screening status|حالة التدريب أو التدقيق المتحقَّق منها|Statut vérifié de formation ou contrôle|verification|D
commitmentStatus|Commitment status|حالة الالتزام|Statut de l’engagement|choice|G
replacement|Proposed replacement|البديل المقترح|Remplaçant proposé|ref|G
actualHours|Actual hours served|ساعات الخدمة الفعلية|Heures effectivement réalisées|hours|G
formVersion|Registration form version|إصدار استمارة التسجيل|Version du formulaire d’inscription|ref|G
participant|Participant|المشارك|Participant|ref|K
seatStatus|Place status|حالة المكان|Statut de la place|choice|G
consentChoice|Specific consent response|إجابة الموافقة المحددة|Réponse au consentement spécifique|consent|K
consentActor|Person giving consent|صاحب الموافقة|Personne donnant le consentement|ref|K
consentAt|Consent time|وقت الموافقة|Date du consentement|datetime|K
transportChoice|Transport option|خيار النقل|Option de transport|choice|K
transportCapacity|Transport seats|مقاعد النقل|Places de transport|integer|G
pickupPoint|Transport pickup point|نقطة الانطلاق للنقل|Point de prise en charge du transport|text|K
feeSnapshot|Agreed fee breakdown|تفصيل الرسوم المتفق عليها|Détail des frais convenus|money|F
discountWaiver|Approved discount/waiver|الحسم أو الإعفاء المعتمد|Réduction ou exonération approuvée|money|F
waitlistOrder|Waitlist order|ترتيب قائمة الانتظار|Rang sur liste d’attente|system|G
offerUntil|Place offer deadline|مهلة قبول عرض المكان|Date limite d’acceptation de la place|datetime|G
textEn|English text|النص بالإنكليزية|Texte anglais|long|U
textAr|Arabic text|النص بالعربية|Texte arabe|long|U
textFr|French text|النص بالفرنسية|Texte français|long|U
translationReview|Translation review|مراجعة الترجمة|Révision de traduction|verification|U
imageSource|Image source|مصدر الصورة|Source de l’image|text|U
caption|Image caption|شرح الصورة|Légende de l’image|text|U
altText|Image description|وصف الصورة|Description de l’image|text|U
publishAt|Publication time|وقت النشر|Date de publication|datetime|U
expireAt|Publication expiry|وقت انتهاء النشر|Fin de publication|datetime|U
pinned|Pin announcement|تثبيت الإعلان|Épingler l’annonce|boolean|U
contentCategory|Content category|فئة المحتوى|Catégorie du contenu|text|U
payer|Payer/donor|الدافع أو المتبرّع|Payeur ou donateur|ref|F
actualAmount|Actual amount received/paid|المبلغ الفعلي المقبوض أو المدفوع|Montant effectif reçu ou payé|money|F
currency|Original currency|العملة الأصلية|Devise d’origine|currency|F
method|Actual payment method|طريقة الدفع الفعلية|Mode de paiement effectif|choice|F
transactionDate|Actual transaction date|تاريخ الحركة الفعلية|Date réelle de l’opération|date|F
paymentReference|External payment reference|مرجع الدفع الخارجي|Référence externe du paiement|text|F
canonicalTransaction|Canonical transaction|الحركة المالية المرجعية|Opération financière de référence|ref|F
allocations|Purpose allocations|توزيع المبلغ بحسب الغرض|Ventilation par objet|long|F
rate|Applied exchange rate|سعر الصرف المطبّق|Taux de change appliqué|rate|F
rateDate|Rate date|تاريخ سعر الصرف|Date du taux|date|F
rateSource|Rate source|مصدر سعر الصرف|Source du taux|text|F
convertedAmount|Allocated/reporting equivalent|المعادل المخصّص أو المستخدم للتقرير|Équivalent affecté ou de présentation|money|F
unappliedCredit|Unallocated credit|الرصيد غير الموزّع|Crédit non affecté|money|F
eventSession|Active arrival session|جلسة الحضور النشطة|Session de présence active|ref|K
arrivedAt|Actual arrival time|وقت الوصول الفعلي|Heure d’arrivée effective|datetime|K
exitAt|Actual exit time|وقت المغادرة الفعلي|Heure de sortie effective|datetime|K
collector|Actual collector|الشخص الذي تسلّم المشارك|Personne ayant pris en charge le participant|ref|K
collectorCheck|Collector identity check|التحقّق من هوية المستلم|Contrôle d’identité du collecteur|long|K
pickupCode|Pickup code|رمز التسلم|Code de prise en charge|secretCode|K
pickupRestrictions|Pickup restrictions|قيود التسلم|Restrictions de prise en charge|long|K
independentExit|Approved independent departure|المغادرة المستقلة المعتمدة|Départ autonome autorisé|consent|K
paperSource|Paper fallback reference|مرجع السجل الورقي البديل|Référence du relevé papier de secours|text|K
incidentFacts|Factual incident report|الوقائع المسجّلة للحادثة|Rapport factuel d’incident|long|C
incidentLocation|Incident location|مكان الحادثة|Lieu de l’incident|text|C
involvedPeople|Involved people|الأشخاص المعنيون|Personnes concernées|refs|C
immediateResponse|Actual immediate response|الاستجابة الفورية الفعلية|Réponse immédiate effective|long|C
reviewer|Assigned reviewer|المراجع المكلّف|Examinateur désigné|ref|C
disclosureDecision|Approved disclosure decision|قرار الإفصاح المعتمد|Décision de communication approuvée|long|C
repairIssue|Resource issue|مشكلة المورد|Problème de ressource|long|O
severity|Issue severity|خطورة المشكلة|Gravité du problème|choice|O
maintenanceWindow|Maintenance period|فترة الصيانة|Période de maintenance|long|O
relocationPlan|Affected-booking plan|خطة معالجة الحجوزات المتأثرة|Plan pour les réservations affectées|long|D
repairEvidence|Repair/clearance evidence|إثبات الإصلاح أو الإجازة|Justificatif de réparation ou remise en service|file|D
serviceableQuantity|Serviceable quantity|الكمية الصالحة للاستخدام|Quantité utilisable|integer|G
stockSerial|Item serial number|الرقم التسلسلي للغرض|Numéro de série du bien|text|G
deposit|Deposit received/held|التأمين المقبوض أو المحتفَظ به|Dépôt reçu ou conservé|money|F
renter|External renter/customer|المستأجر أو العميل الخارجي|Locataire ou client externe|ref|D
agreementVersion|Agreement version|إصدار الاتفاق|Version de l’accord|ref|D
accountId|Account|الحساب|Compte|ref|S
role|Appointed role|الدور المعيّن|Rôle attribué|choice|S
scope|Exact appointment scope|نطاق التكليف المحدد|Portée précise de l’affectation|ref|S
appointingAuthority|Appointing authority|صاحب صلاحية التعيين|Autorité de nomination|ref|S
leadDesignation|Designated lead|تسمية المسؤول الرئيسي|Désignation du responsable principal|boolean|S
acceptance|Appointment accepted|قبول التكليف|Affectation acceptée|consent|S
secondApprover|Independent second approver|المعتمد الثاني المستقل|Second approbateur indépendant|ref|D
dioceseId|Diocese/archdiocese|الأبرشية|Diocèse ou archidiocèse|ref|O
officialNameEn|Official English name|الاسم الرسمي بالإنكليزية|Nom officiel anglais|name|U
officialNameAr|Official Arabic name|الاسم الرسمي بالعربية|Nom officiel arabe|name|U
officialNameFr|Official French name|الاسم الرسمي بالفرنسية|Nom officiel français|name|U
officeContact|Approved public office contact|وسيلة الاتصال العامة المعتمدة للمكتب|Contact public approuvé du bureau|text|U
officeHours|Approved office hours|أوقات المكتب المعتمدة|Horaires du bureau approuvés|long|U
headPriest|Designated head priest|كاهن الرعية المسؤول|Prêtre responsable de la paroisse|ref|I
adoptionApproval|Parish participation approved|اعتماد مشاركة الرعية|Participation paroissiale approuvée|decision|D
latitude|Verified latitude|خط العرض المتحقَّق منه|Latitude vérifiée|latitude|U
longitude|Verified longitude|خط الطول المتحقَّق منه|Longitude vérifiée|longitude|U
accessibility|Verified accessibility information|معلومات تسهيل الوصول المتحقَّق منها|Informations d’accessibilité vérifiées|long|U
bundle|Current/proposed bundle|الباقة الحالية أو المقترحة|Offre actuelle ou proposée|choice|O
sponsor|Diocesan sponsor|الجهة الأبرشية الراعية|Organisme diocésain financeur|ref|D
moduleEffects|New/history/in-flight effect|الأثر على العمل الجديد والسابق والجاري|Effet sur nouveaux dossiers, historique et dossiers en cours|long|D
collectionSource|Collection source|مصدر جمع التبرعات|Origine de la collecte|text|F
fund|Fund/restriction|الصندوق أو التخصيص|Fonds ou affectation|ref|F
campaign|Campaign|الحملة|Campagne|ref|F
anonymousGift|Anonymous gift|تبرّع مجهول الهوية|Don anonyme|boolean|F
countLines|Actual counted lines|بنود العد الفعلي|Lignes du comptage effectif|long|F
firstCounter|First counter|القائم بالعد الأول|Premier compteur|ref|F
secondCounter|Independent second counter|القائم بالعد الثاني المستقل|Second compteur indépendant|ref|F
countObservation|Independent count observation|نتيجة العد المستقل|Constat de comptage indépendant|money|F
variance|Actual count variance|فرق العد الفعلي|Écart effectif de comptage|money|F
reviewedRevision|Revision actually reviewed|الإصدار الذي روجع فعليًا|Révision effectivement examinée|ref|F
originalTransaction|Original transaction|الحركة الأصلية|Opération d’origine|ref|F
replacementTransaction|Replacement/adjustment|الحركة البديلة أو التصحيحية|Opération de remplacement ou de régularisation|ref|F
expenseType|Expense/invoice/reimbursement|نوع النفقة أو الفاتورة أو التعويض|Type de dépense, facture ou remboursement|choice|F
payee|Payee/claimant|المستفيد أو طالب التعويض|Bénéficiaire ou demandeur de remboursement|ref|F
invoiceReference|Supplier invoice reference|مرجع فاتورة المورّد|Référence de facture fournisseur|text|F
receiptEvidence|Actual receipt evidence|إثبات الإيصال الفعلي|Justificatif du paiement effectif|file|F
budget|Approved budget/revision|الموازنة المعتمدة وإصدارها|Budget approuvé et révision|ref|F
bankAccount|Bank account|الحساب المصرفي|Compte bancaire|ref|F
statementCoverage|Statement period/coverage|فترة الكشف ونطاقه|Période et couverture du relevé|text|F
bankLines|Original bank lines|بنود البنك الأصلية|Lignes bancaires originales|long|F
matchedAllocations|Matched allocation lines|بنود التوزيع المطابَقة|Lignes de ventilation rapprochées|long|F
openingBalance|Initial balance|الرصيد الافتتاحي|Solde initial|money|F
closingBalance|Reviewed closing balance|الرصيد الختامي المراجع|Solde final vérifié|money|F
ledgerType|Office entry type|نوع قيد المكتب|Type d’écriture du bureau|choice|F
transferReference|Internal transfer reference|مرجع التحويل الداخلي|Référence de transfert interne|ref|F
voucherNumber|Internal voucher number|رقم السند الداخلي|Numéro de pièce interne|text|F
recipients|Exact recipients|المستلمون المحددون|Destinataires précis|refs|D
senderCapacity|Actual sender capacity|صفة المرسل الفعلية|Qualité réelle de l’expéditeur|text|D
messageBody|Message text|نص الرسالة|Texte du message|long|D
channel|Actual delivery channel|وسيلة الإرسال الفعلية|Canal d’envoi effectif|choice|D
readAt|Actually opened at|وقت الفتح الفعلي|Date d’ouverture effective|system|D
concernCategory|Concern category|فئة الشكوى أو المسألة|Catégorie du signalement|choice|C
anonymityChoice|Identity visibility choice|خيار إظهار الهوية|Choix de visibilité de l’identité|choice|C
concernNarrative|Confidential account of concern|وصف المسألة السري|Récit confidentiel du signalement|long|C
selectedReviewers|Selected independent reviewers|المراجعون المستقلون المختارون|Examinateurs indépendants choisis|refs|C
conflictDeclaration|Conflict declaration|التصريح بتعارض المصالح|Déclaration de conflit d’intérêts|long|C
reviewerOnlyNote|Reviewer-only note|ملاحظة للمراجعين فقط|Note réservée aux examinateurs|long|C
submitterReply|Message to submitter|رسالة إلى مقدّم الشكوى|Message à l’auteur du signalement|long|C
caseOutcome|Restricted case outcome|نتيجة الملف المقيّدة|Conclusion restreinte du dossier|long|C
noteBody|Private note|الملاحظة الخاصة|Note privée|long|P
noteAudience|Explicit note sharing|المشاركة المحددة للملاحظة|Partage explicite de la note|choice|P
taskStatus|Task status|حالة المهمة|Statut de la tâche|choice|O
priority|Priority|الأولوية|Priorité|choice|O
workflowVersion|Workflow version|إصدار سير العمل|Version du processus|ref|O
steps|Steps and branches|الخطوات والتفرعات|Étapes et branches|long|O
fieldAudiences|Field visibility rules|قواعد إظهار الحقول|Règles de visibilité des champs|long|D
runAnswers|Submitted workflow answers|إجابات سير العمل المقدمة|Réponses soumises au processus|long|D
pauseMode|Pause/safety-stop mode|طريقة الإيقاف المؤقت أو الوقائي|Mode de pause ou d’arrêt de sécurité|choice|O
dataRequestType|Data request type|نوع طلب البيانات|Type de demande sur les données|choice|D
recordClasses|Record classes|فئات السجلات|Catégories de dossiers|choice|D
retentionRule|Approved retention rule|قاعدة الاحتفاظ المعتمدة|Règle de conservation approuvée|ref|D
holdReason|Preservation hold reason|سبب تعليق الإتلاف|Motif de suspension de destruction|long|D
redactions|Approved redactions|التنقيحات المعتمدة|Occultations approuvées|long|D
searchQuery|Search|البحث|Recherche|text|A
localityFilter|Locality filter|تصفية حسب المحلة|Filtre par localité|text|A
distanceRadius|Nearby radius in km|نطاق القرب بالكيلومتر|Rayon de proximité en km|integer|A
visitorLocation|Session-only visitor location|موقع الزائر لهذه الجلسة فقط|Position du visiteur pour la session seulement|location|A
sortOrder|Sort order|ترتيب النتائج|Ordre de tri|choice|A
actingRole|Selected acting role|الدور المختار للعمل|Rôle d’action sélectionné|ref|S
parishFilter|Combined parish filter|تصفية عرض الرعايا الموحّد|Filtre de la vue paroissiale combinée|refs|A
viewPreferences|View preferences|تفضيلات العرض|Préférences d’affichage|long|A
intentionText|Intention as supplied|النية كما قُدمت|Intention telle que fournie|long|D
publicWording|Approved public wording|الصياغة العامة المعتمدة|Formulation publique approuvée|long|U
visitLogistics|Necessary visit logistics|ترتيبات الزيارة الضرورية|Logistique nécessaire à la visite|long|D
appointmentTopic|Broad appointment topic|الموضوع العام للموعد|Objet général du rendez-vous|text|D
refundAmount|Actual refundable amount|المبلغ القابل للاسترداد فعليًا|Montant effectivement remboursable|money|F
refundPolicy|Applied refund policy version|إصدار سياسة الاسترداد المطبقة|Version de la politique de remboursement appliquée|ref|F
refundProof|Actual refund proof|إثبات الاسترداد الفعلي|Preuve du remboursement effectif|file|F
frequency|Expected gift frequency|دورية التبرع المتوقع|Fréquence du don attendu|choice|F
pledgeTarget|Promised amount|المبلغ المتعهد به|Montant promis|money|F
campaignTarget|Approved campaign target|هدف الحملة المعتمد|Objectif de campagne approuvé|money|F
statementRecipient|Authorized statement recipient|مستلم الكشف المخوّل|Destinataire autorisé du relevé|ref|F
publicPrayerChoice|Prayer privacy/publication choice|خيار خصوصية النية أو نشرها|Choix de confidentialité ou publication de l’intention|choice|D
exportColumns|Approved export columns|أعمدة التصدير المعتمدة|Colonnes d’exportation approuvées|choice|D
exportSelection|Selected/all matching scope|نطاق المحدد أو جميع المطابق|Portée sélectionnée ou tous les résultats|choice|D
backupCoverage|Actual backup coverage|نطاق النسخة الاحتياطية الفعلي|Couverture réelle de la sauvegarde|long|S
restoreEvidence|Actual restore evidence|إثبات الاستعادة الفعلية|Preuve de restauration effective|file|S
formationProgram|Formation program/version|برنامج التنشئة وإصداره|Programme de formation et version|ref|G
milestone|Milestone|المرحلة|Étape de formation|text|G
completionDate|Actual completion date|تاريخ الإنجاز الفعلي|Date réelle d’achèvement|date|G
'''
FIELDS={}
for line in RAW_FIELDS.strip().splitlines():
    k,en,ar,fr,typ,privacy=line.split('|')
    assert k not in FIELDS
    FIELDS[k]=dict(en=en,ar=ar,fr=fr,type=typ,privacy=privacy)

# * required at submission/final action; ? conditional as defined in context;
# unmarked optional. System metadata is rendered separately for saved records.
BINDINGS={
1:'givenName* familyName* birthDate* email? phone? password* confirmPassword* language* noticeAccepted*',
2:'username? email? phone? recoveryMethod* identityMethod? verificationNote? targetAccount? currentPassword? password? confirmPassword? sessionId?',
3:'personId* targetAccount? invitePurpose* email? phone? identityMethod* expiryAt* deliveryMethod* deliveryRecorded?',
4:'parishId* following primaryParish relationship? authorityEvidence? personId? identityMethod? verificationNote? membershipDecision? applicantMessage?',
5:'personId* fieldId* originalValue* proposedValue* currentValue? appliedValue? reason sourceEvidence? applicantMessage? internalNote?',
6:'givenName* familyName? nameEn? nameAr? nameFr? birthSurname title birthDate? datePrecision* email phone country region district town sector address addressOverride occupation skills bloodType medicalAlert photo householdId personStatus* recordPurpose* directoryConsent publicityConsent communicationPreference reportedDeathDate? deceasedVerified?',
7:'sourcePersonIds* survivorPersonId? identityMethod* sourceEvidence? fieldResolutions* impactSummary* reason* secondApprover?',
8:'householdId? title householdContact* sourcePersonIds* relatedPersonId? relationshipType? address* addressOverride email phone envelopeId effectiveFrom* effectiveTo? authorityScope? authorityEvidence?',
9:'sourceFile* sourceOwner* sourceHash* recordClasses* columnMapping* importMode* rowOutcome* impactSummary* competentApproval?',
10:'personId* sacramentType* sourceParish* sourceDiocese sourceCountry* celebrationDate? datePrecision* celebrant? registerBook? registerPage? registerNumber? sourceEvidence? verifiedBy* verifiedAt? competentApproval?',
11:'requester* subject? relationship? authorityScope? authorityEvidence? origin* requestType* email? phone? description* urgency preferredDate preferredTimes receivedAt* assignee dueAt lastContactAt applicantMessage internalNote',
12:'requester* subject? relationship? description* assignee* preferredDate preferredTimes dueAt applicantMessage internalNote completionDate?',
13:'requester* renter? relationship? phone? email? resourceIds* startAt* endAt* timeZone* setupMinutes* cleanupMinutes* description* capacity? quantity? agreementVersion? sourceEvidence? expiryAt? deposit? currency? feeSnapshot? refundPolicy? assignee*',
14:'subject* requester* givenName* familyName? nameEn? nameAr? nameFr? birthDate? datePrecision* fatherName? motherName? guardian? authorityEvidence? godparents? adultBaptism* rite* requirementVersion* requirementStatus* sourceEvidence? startAt? endAt? resourceIds? clergyAssignment? actualOccurred? celebrationDate? celebrationTime? celebrant? instructionPriest? instructionStage? instructionWhen instructionChannel? instructionStatement? registerNumber?',
15:'subject* requester* guardian? authorityEvidence? priorSacrament? formationEvidence? rite* requirementVersion* requirementStatus* eventId? startAt? clergyAssignment? actualOccurred? celebrationDate? celebrant? instructionPriest? instructionStage? instructionStatement? registerNumber?',
16:'subject* requester* guardian? rite* linkedBaptism? priorSacrament? godparents? formationEvidence? requirementVersion* requirementStatus* eventId? startAt? clergyAssignment? actualOccurred? celebrationDate? celebrant? instructionPriest? instructionStage? instructionStatement? registerNumber?',
17:'requester* partnerOne* partnerTwo* externalPartner? relationship? authorityEvidence? priorSacrament? witnesses? externalCelebrant? specialReview* externalPermission? sourceEvidence? rite* requirementVersion* requirementStatus* startAt? endAt? resourceIds? clergyAssignment? actualOccurred? celebrationDate? celebrant? instructionPriest? instructionStage? instructionStatement? registerNumber?',
18:'requester* subject* relationship* authorityEvidence? reportedDeathDate? datePrecision* email? phone? urgency* startAt? endAt? appointmentLocation* clergyAssignment? actualOccurred? celebrationDate? publicTitle? publicityConsent? deceasedVerified? applicantMessage',
19:'sourceEntry* correctionFields* originalValue* proposedValue* reason* sourceEvidence* competentApproval* affectedCertificates* appliedValue? verifiedAt?',
20:'requester* subject* relationship? authorityEvidence? certificateType* sourceEntry? plannedSacrament? documentPurpose copyQuantity* documentLanguage* documentLayout* templateVersion* requirementStatus* instructionPriest? instructionStage? instructionStatement? signatureEvidence? bishopDecision? bishopReason? resubmissionNote? issueDate? legacyFlag feeSnapshot? currency?',
21:'sourceEntry* fileId* documentLanguage* recipient* recipientAuthority* identityMethod* deliveryMethod* releaseConfirmed* expiryAt? collectedAt? deliveryRecorded? reason?',
22:'requirementItem* requirementVersion* fileUpload? fileName? fileType? fileSize? pageCount? paperReceived? requirementStatus* verifiedBy? verifiedAt? expiryAt? waiverAuthority? reason? sourceEvidence?',
23:'eventType* title* parishId* startAt* endAt* timeZone* allDay recurrence occurrenceScope? exceptions resourceIds setupMinutes cleanupMinutes clergyAssignment? ministryId? audience* publicTitle? publicDescription? publicityConsent? assignee* acknowledgment?',
24:'eventId? title* templateVersion? assignee* planItems* itemDuration? fixedStart? responsiblePerson? readings musicVersion? audience* revision*',
25:'title* language* rite? season musicKey instrumentNotes lyrics chords mediaLink rightsBasis* musicVersion? audience* sourceFile?',
26:'personId* ministryId* groupType? eligibility* capacity? consentChoice? guardian? sourceEvidence? leaderReview? trialUntil? applicantMessage',
27:'personId* ministryId* departureReason membershipEnd? impactSummary* applicantMessage? assignee*',
28:'ministryId* eventId* meetingAgenda rsvp absenceReason attendanceStatus* expectedFrom? reportingPeriod* reason? sourceFile? columnMapping?',
29:'ministryId* loanItem* quantity* borrower* itemCondition* issuedAt? dueAt* returnedAt? returnedQuantity? reason? sourceEvidence?',
30:'personId* ministryId? opportunity* position* startAt* endAt* timeZone* skills availability trainingStatus* consentChoice? guardian? commitmentStatus* replacement? actualHours? reason?',
31:'eventId* formVersion* participant* requester* guardian? authorityEvidence? birthDate? datePrecision* eligibility* seatStatus* consentVersion? consentChoice? consentActor? consentAt? transportChoice* transportCapacity? pickupPoint? feeSnapshot* discountWaiver currency* canonicalTransaction? waitlistOrder? offerUntil?',
32:'title* audience* textEn* textAr* textFr* translationReview* fileUpload imageSource? rightsBasis? caption? altText? publishAt? expireAt? pinned contentCategory publicTitle? officeContact? officeHours? accessibility? recurrence? exceptions?',
33:'payer? actualAmount* currency* transactionDate* method* paymentReference? canonicalTransaction* allocations* rate? rateDate? rateSource? convertedAmount? unappliedCredit?',
34:'eventId* participant* eventSession? seatStatus* consentVersion? requirementStatus? medicalAlert? pickupRestrictions? arrivedAt* exitAt? paperSource? reason?',
35:'eventId? incidentLocation* involvedPeople? receivedAt* incidentFacts* immediateResponse* sourceEvidence? reviewer* dueAt? disclosureDecision? caseOutcome? reason?',
36:'resourceIds* repairIssue* severity* maintenanceWindow* impactSummary* relocationPlan? assignee* dueAt? repairEvidence? competentApproval? serviceableQuantity?',
37:'loanItem* stockSerial quantity* serviceableQuantity* storage* itemCondition* resourceIds? borrower* renter? startAt* endAt* issuedAt? dueAt? returnedAt? returnedQuantity? deposit? currency? repairIssue? sourceEvidence?',
38:'accountId* role* scope* personId? clergyTitle? appointingAuthority* effectiveFrom* effectiveTo? leadDesignation acceptance? reason* currentPassword? secondApprover? impactSummary?',
39:'officialNameEn* officialNameAr* officialNameFr* dioceseId* rite* country* region district town* address? headPriest* adoptionApproval* officeContact* officeHours accessibility latitude? longitude? accountId? impactSummary? reason?',
40:'parishId* bundle* sponsor? moduleEffects* impactSummary* effectiveFrom* competentApproval? reason*',
41:'collectionSource* transactionDate* currency* method* countLines* fund* campaign? envelopeId? firstCounter* secondCounter* countObservation* variance* reviewedRevision* canonicalTransaction? reason?',
42:'originalTransaction* reason* replacementTransaction? allocations* secondApprover* affectedCertificates? statementRecipient? reviewedRevision*',
43:'expenseType* description* fund* payee* actualAmount* currency* transactionDate* invoiceReference? sourceEvidence? receiptEvidence? budget? assignee* secondApprover? canonicalTransaction? reason?',
44:'bankAccount* sourceFile* statementCoverage* bankLines* matchedAllocations* openingBalance* closingBalance* currency* secondApprover* reviewedRevision* reason?',
45:'ledgerType* actualAmount* currency* transactionDate* openingBalance? transferReference? payee? description* receiptEvidence? voucherNumber? reportingPeriod* secondApprover? canonicalTransaction? reason?',
46:'recipients* senderCapacity* title messageBody* fileUpload channel* audience* readAt? eventId? recordId?',
47:'concernCategory* urgency* anonymityChoice* concernNarrative* selectedReviewers* conflictDeclaration? sourceEvidence? reviewerOnlyNote? submitterReply? dueAt? caseOutcome? disclosureDecision?',
48:'title noteBody* personId? noteAudience* assignee? dueAt? taskStatus? priority fileUpload',
49:'title* workflowVersion* steps* fieldAudiences* eligibility* assignee* dueAt? runAnswers? pauseMode? reason?',
50:'dataRequestType* requester* relationship? identityMethod* authorityEvidence? recordClasses* impactSummary* retentionRule? holdReason? redactions? competentApproval* reason* deliveryMethod*',
51:'searchQuery localityFilter dioceseId? rite? preferredDate preferredTimes language sortOrder distanceRadius visitorLocation',
52:'actingRole? parishFilter language viewPreferences primaryParish?',
53:'requester* relationship? intentionText* publicWording? publicityConsent? preferredDate priorSacrament? eventId? actualAmount? currency? method? applicantMessage',
54:'requester* subject? relationship? authorityEvidence? appointmentLocation* preferredDate preferredTimes visitLogistics assignee? eventId? applicantMessage',
55:'requester* subject? relationship* authorityEvidence? phone? email? urgency* appointmentLocation* preferredTimes visitLogistics assignee? eventId? medicalAlert? applicantMessage',
56:'requester* relationship? appointmentTopic* preferredDate preferredTimes appointmentLocation? audience* eventId? acknowledgment?',
57:'originalTransaction* payer* refundPolicy* refundAmount* currency* allocations* reason* secondApprover* method* refundProof? canonicalTransaction?',
58:'eventId* participant* eventSession* guardian? collector? collectorCheck? pickupCode? pickupRestrictions? independentExit? exitAt* paperSource? reason? secondApprover?',
59:'payer* pledgeTarget* currency* fund* frequency* effectiveFrom* effectiveTo? communicationPreference* canonicalTransaction? allocations?',
60:'title* description* fund* campaignTarget? currency* startAt* endAt? textEn* textAr* textFr* translationReview* competentApproval*',
61:'canonicalTransaction* reportingPeriod? householdId? statementRecipient* documentLanguage* templateVersion* issueDate? originalTransaction? reason?',
62:'requester? relationship? intentionText* publicPrayerChoice* publicWording? publicityConsent? textEn? textAr? textFr? competentApproval? expireAt?',
63:'title noteBody* fileUpload',
64:'recordClasses* exportColumns* exportSelection* reportingPeriod? language* reason* backupCoverage? restoreEvidence? competentApproval?',
65:'personId* ministryId* formationProgram* milestone* priorSacrament? formationEvidence? attendanceStatus? reviewer* completionDate? reason?',
}
