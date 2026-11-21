# Cookie policy: review draft (Agent 06, Part A)

> **DRAFT. Not for publication.** This must be reviewed by a lawyer licensed in Lebanon before it is published (Part B publishes it as `cookies.html`). It is not legal advice.
> Prepared 21 November 2026 on branch `hardening/06-legal`. It is a new document: no cookie policy exists today. The privacy policy has a short cookies section.

**Status after Part B (22 November 2026).** Published as `frontend/public/cookies.html` (both languages), with these updates:
- The account-linked keys (`pl-anniversaries-…`, `pl-finance-session:…`, `pl-admin-opened`) are now cleared at sign-out by Agent 03's `forgetAccountStorage`.
- The visit beacon (`src/lib/beacon.js`) also causes the anti-forgery cookie on the public site.
- Google Fonts is limited to printed sheets, because the portal and product page now use `/assets/fonts`.

Turnstile's own cookies remain unverified in a browser.

Section 1 is the inventory for maintainers, with code references. Sections 2 and 3 are the text to publish, in English and Arabic. Keep all three in step whenever the code adds a cookie or a storage key.

---

## 1. Inventory (from the code, 21 November 2026)

**How it was found:**
- I searched `ParishLife.Api` for `Cookie`, `Cookies.Append`, `SignInScheme`, `AddOAuth` and `AddIdentityCookies`.
- I searched `frontend/src`, `frontend/*.html` and `frontend/public` for `localStorage`, `sessionStorage`, `indexedDB`, `caches.`, `document.cookie` and `cookieStore`.
- I read `frontend/public/sw.js`.
- On production I made two read-only requests: a GET of `/privacy.html` (no `Set-Cookie`) and a GET of `/api/auth/csrf` (it sets the anti-forgery cookie only).

**What the search found:**
- No `document.cookie`, IndexedDB or `cookieStore` use.
- No analytics, advertising, social, video or map embeds. YouTube, Anghami and OpenStreetMap appear only as plain links.
- Azure App Service's `ARRAffinity` cookies are not set: production returned no `Set-Cookie` on page requests. If session affinity is ever turned on, add `ARRAffinity` and `ARRAffinitySameSite` to this list.

### 1a. Cookies set by ParishLife (first party, parish-life.org)

| Name | Set by (code) | Purpose | Category | Duration | Attributes |
| --- | --- | --- | --- | --- | --- |
| `__Host-ParishLife` | `Program.cs` (`ConfigureApplicationCookie`), `AccountCookieService` | Keeps you signed in | Strictly necessary | Browser session: no Expires attribute, deleted when the browser closes or at sign-out. The sign-in inside it ends 8 hours after sign-in (15 minutes for a recovery sign-in) and activity does not extend it. | HttpOnly, Secure, SameSite=Strict, Path=/ |
| `__Host-ParishLife.Csrf` | `Program.cs` (`AddAntiforgery`); issued by `GET /api/auth/csrf` | Protects forms against cross-site request forgery | Strictly necessary | Browser session (confirmed on production) | HttpOnly, Secure, SameSite=Strict, Path=/ |
| `.AspNetCore.Correlation.<random>` | ASP.NET Core OAuth handler (`AddOAuth` in `ServiceCollectionExtensions`) | Ties the return from Google or Microsoft to the sign-in that started it, so it cannot be forged | Strictly necessary | 15 minutes at most (framework default), deleted on return | HttpOnly, Secure, SameSite=None |
| `Identity.External` | ASP.NET Core Identity (`AddIdentityCookies`, `SignInScheme = IdentityConstants.ExternalScheme`) | Holds the provider's answer for the moment between the provider's return and the end of sign-in | Strictly necessary | 5 minutes at most (framework default), deleted when sign-in completes (`ExternalSignInService`, `SignOutAsync(ExternalScheme)`) | HttpOnly, SameSite=Lax, Secure over HTTPS (framework defaults) |
| `__Host-ParishLife.ExternalMfa` | `ExternalSignInService.HoldPendingChallenge` | Carries a pending two-step sign-in challenge after a Google or Microsoft round trip, so it never appears in an address | Strictly necessary | 10 minutes at most, deleted when read | HttpOnly, Secure, SameSite=Strict, Path=/, encrypted |

The framework cookies (`.AspNetCore.Correlation.*` and `Identity.External`) are named and timed by ASP.NET Core's defaults. Their names are confirmed in the framework assemblies; their timings follow the framework defaults. Check them in a browser during Part B.

### 1b. Browser storage set by ParishLife (first party)

| Key | Storage | Set by (code) | Purpose | Category | Duration |
| --- | --- | --- | --- | --- | --- |
| `pl-lang` | localStorage | `src/lib/i18n.js`, `src/public/App.jsx`, `src/landing/Landing.jsx`; read by every page's head script | Your language (English or Arabic) | Preferences | Until you clear site data |
| `pl-text` | localStorage | `src/reading/EasyReading.jsx` | Text size (A+, A++); removed at the default size | Preferences (accessibility) | Until cleared or reset |
| `pl-simple` | localStorage | `src/reading/EasyReading.jsx` | "Simple view": no motion, plain pointer | Preferences (accessibility) | Until cleared or reset |
| `pl-rail` | localStorage | `src/portal/shell/Portal.jsx` (`save`) | Whether the portal's side menu is collapsed | Preferences | Until cleared |
| `pl-anniversaries-<account id>` | localStorage | `src/portal/features/records/sacraments.jsx` | Layout of the anniversaries list (grouped or combined). **The key contains the account's internal ID** and is not removed at sign-out. | Preferences | Until cleared |
| `pl-finance-session:<parish id>` | localStorage | `src/portal/model/modules/finance.js` | The finance counting session last opened for that parish | Preferences | Until cleared, or until no session is chosen. Not removed at sign-out. |
| `pl-notice` | sessionStorage | `src/portal/features/account/account-security.jsx`; read once and removed in `Auth.jsx` | Explains on the sign-in page why every session was just signed out | Strictly necessary | Until read, or until the tab closes |
| `pl-admin-opened` | sessionStorage | `src/portal/features/administration/workspace.jsx` | Operators only: parishes and archdioceses opened by reference in this tab | Preferences | Until the tab closes |
| `parishlife-public-v2` | Cache Storage, through the service worker `/sw.js` | `frontend/public/sw.js`, registered only by the public site (`src/public/main.jsx`, HTTPS only) | An offline copy of the public pages, their files, and the public parish and Mass-time data they last showed. It never keeps the portal, signed-in data, private links or document checks. The network is always tried first. | Functional (offline access) | Until a newer version replaces it, or you clear site data |

`pl-welcome` is read and removed in `account.jsx`, but nothing in the current code sets it, so it is not listed in the published text.

### 1c. Third parties

| Provider | Where it loads | Cookies or storage | What it receives | Status |
| --- | --- | --- | --- | --- |
| **Cloudflare Turnstile** (`challenges.cloudflare.com`, script and iframe) | Sign-in and sign-up (portal `index.html`) and the public request form, only when a Turnstile site key is configured (`src/lib/turnstile.js`) | Cloudflare says Turnstile "never looks for cookies … or uses cookies to collect or store information" (Cloudflare blog). The Turnstile Privacy Addendum (section 6) calls its signals strictly necessary and refers to Cloudflare's cookie policy. Cloudflare's cookie list includes challenge-platform cookies (`cf_chl_rc_i`, `cf_chl_rc_ni`, `cf_chl_rc_m`), which may be set on `challenges.cloudflare.com` inside the iframe. Pre-clearance (`cf_clearance`) applies only to zones Cloudflare proxies, and parish-life.org is not proxied (production answers with `Server: Kestrel` and no `CF-Ray`). | IP address, TLS fingerprint, user agent, site key and origin (Turnstile Privacy Addendum) | **Could not verify in a browser in Part A.** In Part B, open the sign-in page and check DevTools → Application → Cookies and Storage for `challenges.cloudflare.com`. |
| **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) | Portal and sign-in (`index.html`), product page (`landing.html`), printed sheets (`src/portal/shared/print.js`). Not on the public site or the legal pages. | None. Google's Fonts privacy FAQ says the API does not set or log cookies. | IP address, requested URL, user agent and referrer | Disclosed. Recommendation: host the fonts on the site (Part B item 6), which removes this row. |
| **Google / Microsoft sign-in** (`accounts.google.com`, `login.microsoftonline.com`, `login.live.com`) | Only when you choose "Continue with Google or Microsoft" | Their own cookies, on their own domains, under their own policies. ParishLife sets none of them. | What you give them to sign in | Disclosed |

---

## 2. Published text (English)

> **Cookie policy**
> Effective date: [EFFECTIVE DATE]
>
> This page lists every cookie and every item ParishLife keeps in your browser, and why. ParishLife uses no advertising, analytics or tracking cookies. How we handle personal data is explained in the [privacy policy](privacy.html).
>
> **Cookies ParishLife sets**
>
> | Cookie | What it does | Type | How long |
> | --- | --- | --- | --- |
> | `__Host-ParishLife` | Keeps you signed in | Necessary | Until you sign out or close the browser; the sign-in ends after 8 hours at most |
> | `__Host-ParishLife.Csrf` | Protects forms against forgery | Necessary | Until you close the browser |
> | `.AspNetCore.Correlation.…` | Protects a Google or Microsoft sign-in | Necessary | 15 minutes at most |
> | `Identity.External` | Completes a Google or Microsoft sign-in | Necessary | 5 minutes at most |
> | `__Host-ParishLife.ExternalMfa` | Holds a two-step sign-in check after Google or Microsoft | Necessary | 10 minutes at most |
>
> **What ParishLife keeps in your browser**
>
> | Item | What it does | Type | How long |
> | --- | --- | --- | --- |
> | `pl-lang` | Your language | Preference | Until you clear it |
> | `pl-text`, `pl-simple` | Text size and Simple view | Preference | Until you change or clear it |
> | `pl-rail` | Whether the portal's side menu is collapsed | Preference | Until you clear it |
> | `pl-anniversaries-…` | How the anniversaries list is shown | Preference | Until you clear it |
> | `pl-finance-session:…` | The finance counting session you last opened | Preference | Until you clear it |
> | `pl-notice` | Why you were signed out, shown once | Necessary | Until shown, or the tab closes |
> | `pl-admin-opened` | Platform operators only: records opened in this tab | Preference | Until the tab closes |
> | Offline copy (`parishlife-public-v2`) | Lets the public pages, and the parishes and Mass times they last showed, open without a connection. It never keeps the members portal or anything signed in. | Functional | Until replaced by a newer version, or you clear it |
>
> **Other services**
>
> - **Cloudflare Turnstile** checks that a person, not a bot, is using the sign-in, sign-up and request forms. It processes technical information about your browser and connection. Cloudflare states that Turnstile does not use cookies to collect or store information. See Cloudflare's Turnstile privacy addendum.
> - **Google Fonts** supplies the fonts of the members portal and the product page. It sets no cookies, but your browser sends Google your IP address and browser details.
> - **Google and Microsoft** set their own cookies on their own sites if you choose to sign in with them.
>
> **Your choices**
>
> Everything above is either needed for ParishLife to work or only remembers choices you made, so there is nothing to switch on or off. You can delete these items at any time in your browser's settings (site data for parish-life.org). If you do, you will be signed out and your preferences will return to their defaults.
>
> **Changes and contact**
>
> We will update this page, with a new effective date, before ParishLife sets any new cookie or stored item. Questions: privacy@parish-life.org.

---

## 3. Published text (Arabic)

> **سياسة ملفات تعريف الارتباط**
> تاريخ السريان: [EFFECTIVE DATE]
>
> تعدّد هذه الصفحة كل ملف تعريف ارتباط وكل عنصر يحفظه ParishLife في متصفّحك، وسبب ذلك. لا يستخدم ParishLife أي ملفات إعلانية أو تحليلية أو تتبّعية. طريقة تعاملنا مع البيانات الشخصية مشروحة في [سياسة الخصوصية](privacy.html?lang=ar).
>
> **ملفات تعريف الارتباط التي يضعها ParishLife**
>
> | الملف | وظيفته | النوع | مدّته |
> | --- | --- | --- | --- |
> | `__Host-ParishLife` | يبقيك داخلاً | ضروري | حتى تخرج أو تغلق المتصفّح؛ وينتهي الدخول بعد ٨ ساعات على الأكثر |
> | `__Host-ParishLife.Csrf` | يحمي النماذج من التزوير | ضروري | حتى تغلق المتصفّح |
> | `.AspNetCore.Correlation.…` | يحمي الدخول عبر Google أو Microsoft | ضروري | ١٥ دقيقة على الأكثر |
> | `Identity.External` | يُكمل الدخول عبر Google أو Microsoft | ضروري | ٥ دقائق على الأكثر |
> | `__Host-ParishLife.ExternalMfa` | يحفظ تحقّق الدخول بخطوتين بعد Google أو Microsoft | ضروري | ١٠ دقائق على الأكثر |
>
> **ما يحفظه ParishLife في متصفّحك**
>
> | العنصر | وظيفته | النوع | مدّته |
> | --- | --- | --- | --- |
> | `pl-lang` | لغتك | تفضيل | حتى تحذفه |
> | `pl-text`، `pl-simple` | حجم النص والعرض المبسّط | تفضيل | حتى تغيّره أو تحذفه |
> | `pl-rail` | طيّ القائمة الجانبية في البوّابة أو فتحها | تفضيل | حتى تحذفه |
> | `pl-anniversaries-…` | طريقة عرض لائحة الذكريات السنوية | تفضيل | حتى تحذفه |
> | `pl-finance-session:…` | جلسة العدّ المالية التي فتحتها آخر مرّة | تفضيل | حتى تحذفه |
> | `pl-notice` | سبب خروجك، يُعرض مرّة واحدة | ضروري | حتى يُعرض أو تُغلق النافذة |
> | `pl-admin-opened` | لمشغّلي المنصّة فقط: السجلات المفتوحة في هذه النافذة | تفضيل | حتى تُغلق النافذة |
> | نسخة دون اتصال (`parishlife-public-v2`) | تتيح فتح الصفحات العامة، والرعايا ومواعيد القداديس التي عرضتها آخر مرّة، دون اتصال. لا تحفظ أبداً بوّابة المؤمنين أو أي محتوى بعد الدخول. | وظيفي | حتى تحلّ محلّها نسخة أحدث أو تحذفها |
>
> **خدمات أخرى**
>
> - **Cloudflare Turnstile** يتحقّق من أن شخصاً، لا برنامجاً آلياً، يستخدم نماذج الدخول وإنشاء الحساب والطلبات. يعالج معلومات تقنية عن متصفّحك واتصالك. وتقول Cloudflare إن Turnstile لا يستخدم ملفات تعريف الارتباط لجمع المعلومات أو حفظها. راجع ملحق الخصوصية الخاص بـ Turnstile لدى Cloudflare.
> - **Google Fonts** يوفّر خطوط بوّابة المؤمنين وصفحة التعريف بالمنتج. لا يضع ملفات تعريف ارتباط، لكن متصفّحك يرسل إلى Google عنوان IP وتفاصيل المتصفّح.
> - **Google وMicrosoft** تضعان ملفاتهما الخاصة على موقعيهما إذا اخترت الدخول عبرهما.
>
> **خياراتك**
>
> كل ما سبق إمّا ضروري لعمل ParishLife وإمّا يتذكّر خيارات اخترتها فقط، فلا شيء يحتاج إلى تفعيل أو إيقاف. يمكنك حذف هذه العناصر متى شئت من إعدادات متصفّحك (بيانات الموقع parish-life.org). إذا فعلت، تخرج من حسابك وتعود تفضيلاتك إلى وضعها الافتراضي.
>
> **التغييرات والتواصل**
>
> نحدّث هذه الصفحة، مع تاريخ سريان جديد، قبل أن يضع ParishLife أي ملف أو عنصر جديد. للأسئلة: privacy@parish-life.org.

---

## 4. Notes for review

- **Lebanon.** Law 81/2018 has no cookie-consent rule (`[COUNSEL: confirm]`). A notice like this one, with no banner, fits a site that sets only necessary and preference items.
- **If EU users are confirmed.**
  - Under ePrivacy Art. 5(3), the cookies are exempt as strictly necessary.
  - Preference keys that the user sets directly (language, text size) are generally treated as exempt.
  - Whether the offline copy is exempt is `[COUNSEL]`. If it is not, register the service worker only after consent.
  - Google Fonts would need consent or hosting on the site (Part B item 6).
  - Part B item 2 (the consent banner) is needed only if a non-essential item is added or EU users are confirmed. Today nothing would need blocking, apart from Google Fonts, which is better hosted on the site.
- **Handoff.** `pl-anniversaries-<account id>` and `pl-finance-session:<parish id>` stay after sign-out on a shared computer. This was sent to Agent 03 (`hardening/handoffs/from-06-legal.md`).
