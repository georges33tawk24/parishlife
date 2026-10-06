# ParishLife reference design audit

Reviewed on 6 October 2026. This document records design and frontend architecture, not reference-site business content. Findings come from public HTML, linked CSS/JavaScript, and the user-provided Mahloole source. Asset filenames below are the deployed versions observed during this review and can change after deployment.

## Network traced

All seven brand destinations directly linked by [Angry Monkey Corp](https://angrymonkeycorp.com/) responded successfully and their home-page stylesheet/script bundles were inspected:

| Site | Relationship | Verified visual/technical pattern |
| --- | --- | --- |
| [Agency](https://angrymonkeyagency.com/) | Corp brand | Full-viewport image hero, fixed image backgrounds, fixed navigation, broad service sections, restrained card borders |
| [Express](https://angrymonkeyexpress.com/) | Corp brand | Themed section bands, animated radial gradients, scroll reveals, mobile navigation and section tracking |
| [Cloud](https://angrymonkeycloud.com/) | Corp brand | Centered hero, library cards, strong cyan accent, spacious content columns, fixed photograph in a contact section |
| [Shield](https://angrymonkeyshield.com/) | Corp brand | Dark blue/green palette, large hero, canvas decoration, reusable gradient styles and navigation tracking |
| [Coconut Sharp](https://coconutsharp.com/) | Corp brand | Dark purple themed surfaces, mint accents, broad sections, animated gradient background, canvas hero decoration |
| [MelonCut](https://meloncut.com/) | Corp brand | Orange accent, rounded action buttons, fixed header, shared reveal and scroll-state conventions |
| [LazyBanana](https://lazybanana.net/) | Corp brand | Yellow/teal palette, wide content container, shared reveal helpers and Vanta dots decoration |
| [Mahloole](https://mahloole.com/) | User's primary reference | White, airy directory presentation; two-column hero; photo section bands; blue/green theme; fixed background photograph |

The following second-hop destinations were also opened and their HTML/asset inventories verified: [Angry Monkey client portal](https://angrymonkey.app/), [Cloud Toolbox](https://toolbox.angrymonkeycloud.com/), [Coverbox information site](https://info.coverbox.app/), [Agency guidelines](https://guidelines.angrymonkeyagency.com/AngryMonkeyAgency), and [Coconut Sharp guidelines](https://guidelines.meloncut.com/coconutsharp). The guidelines share the MelonCut.Guidelines frontend. Coverbox additionally loads Swiper 11 and AngryMonkey.Cloud.Components. The portal and Toolbox also expose Blazor assets.

Corp links to the seven brands above and the client portal. Agency links back to Corp, Express, Cloud and Coconut Sharp, and out to Coverbox and its guidelines. Cloud links to Agency, Coconut Sharp, Corp and Toolbox. Coconut Sharp links to Cloud, Corp and the client portal. MelonCut links to brand guideline pages; LazyBanana links across the brand family. Social networks, external package documentation, stores, and third-party client portfolios were identified as outbound destinations rather than recursively crawled as part of the design family.

## The common architecture

The visible consistency is supported by a shared implementation approach. The inspected sites serve Blazor HTML, a generated component-scoped `*.styles.css` bundle, a global `css/site...css` bundle, and usually a small `js/site...js` file. Many generated bundles retain component source labels such as `Components/Home/...razor.rz.scp.css`. Cloud, Coconut Sharp and live Mahloole also load `AngryMonkey.CloudBlazor/scripts/cloud-blazor.auto.js`.

The recurring page structure is a persistent header followed by full-width sections. Each section places its content inside a centered article/container, allowing the photograph or background color to span the viewport while text stays aligned. Heroes establish one headline, a brief supporting paragraph and an obvious action. Subsequent sections alternate white/light content, themed backgrounds, cards, and a compact action band before a multi-column footer.

| Reference | Width and rhythm tokens | Typography and colors |
| --- | --- | --- |
| Corp | `--maxWidth:1200px`, `--headerHeight:70px`, `--radius:10px`, transitions `.4s ease-in-out` | Gotham Pro; primary `#4040cc`, secondary `#222282`, accent `#ff5900`, text `#1f2731` |
| Cloud | `--maxWidth:1300px`, `--headerHeight:100px`, `--raduis:10px`, transitions `.3s ease-in-out`, article padding `50px` vertically / `20px` horizontally | Segoe UI, Calibri, Helvetica; cyan `#00a7ce`, gray `#666`, text `#2b2928` |
| Agency | `--maxWidth:1400px`, `--headerHeight:70px`, fixed header | Segoe UI body with AbeatbyKai/Montserrat assets; agency `#01698f`, yellow `#ffd700` |
| Coconut Sharp | `--maxWidth:1200px`, `--headerHeight:70px`, `--radius:10px`, `--spacing:40px`, transitions `.4s ease-in-out` | Gotham Pro; dark purple gradients and mint-to-pale-mint heading treatments |
| Mahloole | `article` max-width `1200px`; two-column hero; 4/2/1-column feature/category grids; 13px buttons and pill eyebrows | Noto Sans / Noto Sans Arabic; blue `#0c75c4`, green `#00dd64`, dark `#111827`, supporting text `#2c3e55` |

These are reference values, not a requirement to copy another brand's exact palette or font assets. ParishLife should use the same spatial discipline with its own consistent church-directory identity.

## Mahloole: exact fixed-background implementation

The local repository contains two applications. `Mahloole/` is the relevant current app; `Coverbox.Fix.Informative/` is a separate older implementation. They should not be treated as one set of active scripts.

The effect the user highlighted is implemented directly in CSS. In `Mahloole/Pages/Home.razor.css`, `.contact-section` starts at line 607 and combines a translucent green linear gradient with `/img/Home/Home_Contact.png`. It sets `background-size: cover`, `background-position: right center`, no repetition, and `background-attachment: fixed` at line 614. Text is centered inside a normal-flow content wrapper, so the content scrolls while the background stays attached to the viewport. The contact area has a 460px minimum content height plus 60px vertical article padding. At a viewport width of 600px or less, line 879 changes the attachment to `scroll`.

`Mahloole/Pages/Vendors.razor.css` applies the same idea to `.vendors-process-section` at line 209: a translucent blue gradient over `/img/Vendors/Vendors_RegistrationProcess.png`, cover sizing, centered position and fixed attachment at line 216. The content is a `0.75fr 1.25fr` grid with a 44px gap and 70px vertical padding.

The deployed [Mahloole scoped CSS](https://mahloole.com/Mahloole.u25kvt2w6e.styles.css) confirms the home contact photograph, gradient, and fixed-attachment behavior. This is not a JavaScript scroll-position simulation. Agency's home hero also uses fixed-attachment photographs; Cloud's `.contact` rule uses `/img/banner.jpg`, cover/center positioning and a 50vh minimum height. Coconut Sharp uses fixed attachment for animated radial gradients instead of relying only on photography.

For ParishLife, use a church photograph and readable dark overlay in one or two meaningful sections, keeping the content in document flow. Retain a static-image fallback for narrow/touch layouts and reduced-motion preferences. A fixed background should support orientation and atmosphere without obstructing search, details or forms.

## Mahloole source evidence

All paths in this table are relative to `C:/Users/User/source/repos/MahlooleInfo/`.

| Source | Evidence |
| --- | --- |
| `Mahloole/wwwroot/css/site.css:1` | Blue/green/dark custom properties |
| `Mahloole/wwwroot/css/site.css:78` | Noto Sans/Noto Sans Arabic document typography |
| `Mahloole/wwwroot/css/site.css:90` | Full-width, centered 1200px article wrapper |
| `Mahloole/wwwroot/css/site.css:165` | Shared button base and filled/outline variants |
| `Mahloole/wwwroot/css/site.css:200` | Small pill eyebrow variants |
| `Mahloole/Pages/Home.razor.css:23` | Two-column hero; 60px, weight-800 heading with tight tracking |
| `Mahloole/Pages/Home.razor.css:95` | Staggered CSS entrance animations for chips and the phone composition |
| `Mahloole/Pages/Home.razor.css:464` | Four-column features, collapsing at responsive breakpoints |
| `Mahloole/Pages/Home.razor.css:567` | Four-column category layout |
| `Mahloole/Pages/Home.razor.css:607` | Fixed photographic contact section |
| `Mahloole/Pages/Home.razor.css:879` | Mobile fallback to scrolling background |
| `Mahloole/Pages/Vendors.razor.css:209` | Second fixed-photo treatment |
| `Mahloole/Components/Layout/Header.razor.css:8` | White fixed header with subtle bottom border |
| `Mahloole/Components/Layout/Header.razor` | Brand, navigation, language selector and a separate action group |
| `Mahloole/Program.cs:8` | CloudWeb integration; scoped and global CSS bundles registered at lines 14–15 |
| `Mahloole/Components/App.razor:14` | Blazor runtime loading |
| `Mahloole/Mahloole.csproj` | .NET 10 and AngryMonkey.CloudWeb.Server dependency |

The local version is not byte-for-byte identical to production: the live site has extra navigation/content and its hero CSS starts with different visual-height variables. Local source was therefore used to understand implementation, while the deployed files were checked for the requested effect.

## JavaScript behavior worth adapting

Corp uses `IntersectionObserver` to add an appearance class once an element intersects, then unobserves it. Its small site script also updates header scroll state, handles a mobile drawer, closes it on Escape/outside click/resize, scrolls anchors with a header offset, tracks the current section, and opens FAQ items. Cloud and the other brands use similar reveal and header conventions. Agency's global script is only a small scroll-state helper, with a separate home observer. Coconut Sharp splits general reveals/counters from its decorative canvas/home behavior.

The fixed photograph does not need these scripts. The ParishLife browsing flow should remain readable if animation enhancement fails, respect reduced motion, and use real buttons/links with focus states and accessible menu state. Avoid moving the decorative canvas, counter animations, extensive marketing motion or third-party trackers into the church directory merely because the reference loads them.

## Recommended ParishLife adaptation

1. Keep a stable, simple header with church browsing as the first navigation destination and an obvious account/CMS action.
2. Lead the public interface with a brief welcoming headline, a church/location search and a church photograph. Preserve large type and generous whitespace.
3. Present churches in a clear responsive grid. Use consistent image ratios, parish names, locations and one obvious details link rather than many competing actions.
4. Use the Mahloole fixed-photo technique for a wide introductory or community band, with an overlay that preserves text contrast and a static mobile fallback.
5. Give church detail pages a coherent hierarchy: church identity and location first, then description, contact, schedule/events and other available information. Navigation to sections should account for the persistent header.
6. Carry the same colors, typography, controls and spacing into CMS screens. Group edit forms by information type, show saved/error states clearly, and preserve the current data flow.
7. Keep animations subtle and optional. Prefer a small reveal/scroll enhancement over a new visual-effects dependency.

## Public implementation references

- Corp: [global CSS](https://angrymonkeycorp.com/css/site.min.k50m093pau.css), [scoped CSS](https://angrymonkeycorp.com/AngryMonkey.Corp.ece1dyvrji.styles.css), [site script](https://angrymonkeycorp.com/js/site.min.tv2dwf2sj4.js).
- Cloud: [global CSS](https://angrymonkeycloud.com/css/site.min.7lh22r4srs.css), [scoped CSS](https://angrymonkeycloud.com/Cloud.Website.j958de4nz9.styles.css), [site script](https://angrymonkeycloud.com/js/site.gaccb5tkg0.js). Home HTML also loads Three.js and Vanta Clouds.
- Agency: [global CSS](https://angrymonkeyagency.com/css/site.min.css), [home CSS](https://angrymonkeyagency.com/css/home.min.css), [site script](https://angrymonkeyagency.com/js/site.min.js), [home script](https://angrymonkeyagency.com/js/home.min.js). Production adds version query strings.
- Coconut Sharp: [global CSS](https://coconutsharp.com/css/site.min.3c6689ji35.css), [scoped CSS](https://coconutsharp.com/CoconutShartp.Info.blxpqv1wmf.styles.css), [site script](https://coconutsharp.com/js/site.min.sqx9jo2bds.js), [home script](https://coconutsharp.com/js/home.min.z6wv0wrqz4.js).
- Mahloole: [global CSS](https://mahloole.com/css/site.min.k9m3t5dfcb.css), [scoped CSS](https://mahloole.com/Mahloole.u25kvt2w6e.styles.css), plus the local source cited above.

## Scope limits

This is a design-architecture audit of the home-page network and its loaded application bundles, not a claim to have exhaustively visited every route, authenticated app screen, client site or social destination. Public source reveals the delivered styles and behavior; it does not establish the private CMS/backend architecture of those sites. Reference assets were read for analysis rather than imported wholesale into ParishLife. Visual browser validation and ParishLife implementation are tracked separately by the main task.
