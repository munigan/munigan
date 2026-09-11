# Munigan design implementation

The approved source is [WoW Droptimizer in Paper](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/7-0), using the neutral revision on desktop/mobile pages. Legacy blue/gold artboards are not implementation references.

## Component boundaries

- `components/ui/Button` composes Base UI Button with variant/size defaults. For navigation render a Next Link and set `nativeButton={false}` and `role="link"`. Tailwind merging makes caller utilities override defaults predictably.
- `components/ui/Dialog` owns only modal mechanics: portal, backdrop, popup, focus trap, Escape dismissal and restoration. Feature components compose titles, descriptions, actions and content. No duplicated document-level focus traps.
- `components/ui/Tabs` supplies keyboard navigation and controlled selection; feature code retains its settings category state.
- `components/ui/layout` supplies small compositional heading/layout elements. Item rendering stays in the existing shared ItemIcon/ItemLink implementation so tooltip behavior and item-version data remain consistent.
- Shared Tailwind theme tokens are in `app/tokens.css`. Compatibility styling is in the base layer; feature styles are in the components layer; utilities override both. Do not add new global unlayered feature rules.
- The homepage is server-rendered and assembled from HomeHero, SampleReport and HowItWorks. Sample item previews use the same ItemIcon as tools, inside a small client boundary. Marketing copy and navigation render without JavaScript.
- Import, settings and reports retain existing state/requests. Presentation components receive values and callbacks; simulator/enumeration/import validation code is unchanged.

## Brand assets

- Paper Social preview: 1200 × 630, `public/images/home-social.png` exported from Paper. Logo + headline + faded Icecrown artwork, with original/Classic support line.
- Paper App icon: existing Munigan shield centered on #090A0C. `app/icon.svg` is the resolution-independent favicon; ICO and Apple PNG are derived from that vector.
- `public/images/icecrown.webp` is an optimized copy of the approved Paper art asset (original 896 × 1200). It is decorative, never contains product content.

## Search visibility

`lib/site.ts` is the single public origin/identity. Only the homepage is listed in the sitemap and opts into indexing. Its canonical, Open Graph, Twitter and WebApplication data use the production origin. Report routes carry noindex/nofollow metadata plus an X-Robots-Tag header and no-referrer policy. Reports deliberately remain crawlable in robots.txt so crawlers can see noindex; this is not access control. Top Gear's interactive setup is noindex/follow.

No production deployment is part of this implementation.

## Checks completed

- Homepage metadata and visible content verified in a production build with JavaScript disabled.
- Desktop and mobile homepage captures checked at 390, 768 and 1440 pixels; independent review also checked 320–1440 pixels.
- 77 unit/UI tests include Base UI link/ref composition, modal focus return and keyboard tabs.
- Browser coverage includes real local DPS runs, Original/Classic versions, drafts, settings edits, report run states and tooltips.
- Classic tooltip hosting was adapted to Base UI's portaled modal boundary after a real-run regression test exposed the old native-dialog-only lookup.
- Design references and approval manifest now include the approved Munigan revision alongside retained legacy references.

Final combined run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm build && pnpm check:design && pnpm check:specs` — all passed (77 unit/UI tests, 23 browser tests). Both independent reviews have no open findings.
