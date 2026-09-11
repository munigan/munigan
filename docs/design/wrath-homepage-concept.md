# Wrath homepage — Frozen Armory

## Scope revision

The user narrowed this exploration to only the Wrath logo / “Built for Wrath” / “WotLK · 3.3.5a” block and the blue Lich King homepage background. Applied those changes to the existing [Homepage / Shared top navigation design](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/F-0), artboard `A2E-0`. Existing copy, navigation, tool sections, buttons, and footer are unchanged. Gear Lab artwork is unchanged; the green Naxxramas direction is reserved for Gear Lab.

The user then approved applying this limited revision to the application, including `margin-left: -16px` on the identity section. Implemented in `HomeHero.tsx`, `HomePage.tsx`, and `home.css`, with “Built for Wrath” translated for both supported locales. `public/images/wrath-logo.png` is the unchanged logo asset exported into Paper from Warcraft Wiki; Next Image serves optimized sizes. The existing `icecrown.webp` matches the approved blue artwork and now uses the Paper crop, opacity, and fading within the homepage hero. Gear Lab code and shared styles were not modified.

Deployed to [munigan.app](https://munigan.app) on September 11, 2026, from commit `7766eea94e1f37d2e0ad50abe8b4891638683cb2` on `main`. Vercel deployment `dpl_5WGm5BU6keVivwZ1Y8tktdCHv3AY` is ready and aliased to the production domain. The release contains only the five homepage source/translation files and logo, applied onto the verified production commit `1458dde34d2cd9c526bc457c7fd62b8530762f88`. Production build, full lint, formatting, translation parity, four homepage/SEO/locale browser tests, and both languages at 320px, 390px, and 1440px passed. Live checks confirmed the logo loads, the margin is `-16px`, there is no horizontal overflow or browser runtime error, and Top Gear remains available.

The broader desktop and mobile explorations below remain references, not the implementation scope. Do not apply their rewritten headline, new sections, or layout changes.

September 11, 2026. Design exploration in Paper; no application implementation.

Editable designs: [26 munigan.app · Wrath homepage](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/S-0).

- Desktop: `LDW-0`, 1440px wide; export: [WRATH-HOME.desktop.png](exports/WRATH-HOME.desktop.png).
- Mobile: `LKT-0`, 390px wide; export: [WRATH-HOME.mobile.png](exports/WRATH-HOME.mobile.png).
- Hero preview: [WRATH-HOME.hero.png](exports/WRATH-HOME.hero.png).

## Design intent

Make the supported game and expansion obvious before the user scrolls. The original Wrath of the Lich King logo sits in the hero beside an explicit “Built for Wrath / WotLK · 3.3.5a” label. Munigan retains its own brand in the navigation. The main copy names World of Warcraft and Wrath of the Lich King in readable text, so identifying the product does not depend on artwork alone.

“Your next upgrade. Ready for Northrend.” connects the existing upgrade message to the expansion. The familiar “Find my best gear” action sits next to the artwork, above the fold. A substantially brighter crop of the existing Icecrown scene gives the page recognizable environmental character. The gear preview and its actual WoW icons explain the utility below it; example DPS figures remain explicitly illustrative.

The existing Paper homepage uses “Gear Lab” for the tool entry; this concept follows that naming and describes Top Gear simulations within it. This is not a separate product-renaming decision. Planned tools retain their planned status.

## Visual system

Mood candidates: glacial, frozen armory, moonlit citadel. Chosen: frozen armory, combining the scene with a practical tool interface.

Reuse the document's existing tokens: Munigan canvas #090A0C, panels #17191D, primary text #F3F4F6, secondary text #B2BEC7, frost detail #9CD6F0, action green #78E34D. Green concentrates attention on the CTA and simulation gains. Frost blue marks expansion context. The logo retains its original colors.

Space Grotesk carries the brand and headings; Inter carries descriptions and controls. Desktop hero type is 64/68px and mobile 42/46px. Desktop gutters are 64px; mobile gutters are 24px. Both artboards use content-driven height.

Mobile places the logo, expansion label, headline, and full-width CTA first. Artwork fades behind the upper part of the hero. Tool introduction, example result, steps, and planned tools then stack vertically.

## Asset provenance

- Original Wrath logo: Blizzard Entertainment artwork, sourced from [Warcraft Wiki's WrathLogo.png](https://warcraft.wiki.gg/wiki/File:WrathLogo.png), [image asset](https://warcraft.wiki.gg/images/WrathLogo.png?3aa4fd). The original expansion logo is used, without a Classic label.
- Icecrown illustration: existing project/Paper artwork, reused from the current homepage; local equivalent `public/images/icecrown.webp`. Provenance already recorded in `implementation-notes.md`.
- Gear icons: copied from the existing Paper homepage sample preview, matching the existing application's sample items. No new simulation result was calculated.
- No new AI imagery was generated.

## Review

Reviewed desktop and mobile screenshots for spacing, typography, contrast, alignment, content fit, and repetition. Corrected low-contrast step headings and the mobile step section's inherited desktop padding. Verified mobile content order and placed both artboards together on the new Paper page. Existing homepage artboards were preserved.
