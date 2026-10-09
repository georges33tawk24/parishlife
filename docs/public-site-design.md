# ParishLife public website and CMS design

Implemented 6 October 2026.

## Open the result

Run the existing Python server, then open `http://127.0.0.1:4399/public.html`.
The existing administrative application remains at `index.html`. Its **Member portal → Website content** screen manages the four published parish sections and opens the public parish page.

## Design and behavior

The [reference audit](reference-design-audit.md) records the connected Angry Monkey sites, their actual CSS/JS bundles, and Mahloole's local source. This implementation adapts the shared full-width section structure, centered 1200px content, spacious two-column hero, persistent navigation, restrained buttons, and photo section transitions. It keeps ParishLife's vanilla JavaScript and Python architecture.

The public palette is warm off-white and forest green, with Noto Sans and Noto Sans Arabic served locally. A photographic introduction leads into church search, town filters, parish cards, a fixed photographic section, published Mass information, public events, and a short introduction to ParishLife. The directory no longer silently opens the first parish. Each church has a dedicated URL and its own story, Mass information, events, announcements, and contact sections.

The fixed image effect uses `background-attachment: fixed`, a cover image, and a contrast overlay, as verified in Mahloole. Phone layouts and reduced-motion preferences switch to `scroll`. Decorative reveals use a one-shot IntersectionObserver; essential content stays readable without the effect.

English and Arabic share the same content and filters. Arabic reverses the layout, supports Arabic town search, and falls back to the other language when a published translation is missing. Search and town filters are preserved in the URL. Results, empty states, retry states, and unavailable parish pages have clear recovery actions. Keyboard focus, mobile navigation, event expansion, and anchor spacing were checked.

CMS changes are scoped to the website content workspace and its existing bilingual editor. Section cards show published, draft, or empty status; language readiness; current content; and an explicit edit action. The existing save-draft and publish workflow remains authoritative. Saving a section as a draft removes that section from the public page under the existing server behavior.

## Data and access

All public information comes from `/api/public/parishes` and `/api/public/parishes/{id}`. The UI does not read staff state, people records, pastoral notes, or private/group events. Published content is escaped; announcement markup uses the existing safe rich-text renderer. Missing information stays empty rather than being replaced with invented times or contact details.

The directory response now includes Arabic town names. The server serves raster images only from `assets/images/` and WOFF2 fonts only from `assets/fonts/`, alongside its existing JS/CSS rules. GET and HEAD validate the resolved filesystem target, including encoded traversal cases.

## Assets and attribution

The photographs are illustrative church interiors, not verified photographs of the listed parishes. The public footer labels them as illustrative. Parish cards use drawn church emblems instead of assigning unrelated photographs to named churches.

- `assets/images/church-interior.jpg`: [Adrien Olichon on Unsplash](https://unsplash.com/photos/a-dimly-lit-church-with-pews-and-stained-glass-windows-1UzqRbSUwNc), [image](https://images.unsplash.com/photo-1679930961329-d4131741bdd0), used under the [Unsplash license](https://unsplash.com/license).
- `assets/images/church-light.jpg`: [sunlit church photograph on Unsplash](https://unsplash.com/es/fotos/la-luz-del-sol-brilla-a-traves-de-una-vidriera-en-una-iglesia-cRVnk9Sn2cA), [image](https://images.unsplash.com/photo-1691036073374-b638e4c285f1), used under the Unsplash license.
- Noto Sans and Noto Sans Arabic regular/bold WOFF2 files were reused from the supplied Mahloole repository. SIL Open Font License notices are included in `assets/fonts/NotoSans-OFL.txt` and `assets/fonts/NotoSansArabic-OFL.txt`.

No third-party JavaScript or runtime image/font service is required by the public page. The existing administrative app retains its existing dependencies.

## Verification

- Node syntax checks passed for the public script and the changed CMS view module.
- Four focused HTTP tests in `backend/test_public_site.py` passed: bilingual directory fields; published content, event filtering and parish isolation; contact publication; and static asset/GET/HEAD boundaries.
- Browser checks covered desktop and narrow phone layouts, English/Arabic, search in both scripts, no results and reset, town filtering, parish navigation, unavailable parish recovery, repeated event expansion/collapse, retained keyboard focus, mobile menu/Escape, and desktop fixed/mobile scrolling backgrounds.
- The CMS overview and existing bilingual editor were visually checked with isolated frontend fixtures, including published/draft/empty sections and missing translations, in English and Arabic. This visual fixture did not save changes to the user's database.
- No browser errors were recorded during the public-page checks. Real touch-device behavior and authenticated CMS saving were not re-tested end to end; their underlying workflows were preserved.

Preview screenshots are in `docs/screenshots/`.
