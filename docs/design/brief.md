# WoW Droptimizer design brief

Status: reviewed draft revision 4, awaiting full-design approval. Editable source is the user-created [WoW Droptimizer Paper file](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/2-0). No application implementation has started.

Audience: Warmane 3.3.5a players comparing owned equipment and raid acquisitions. Realm is not a primary setting. All launch tools work anonymously; free Top Gear has a visible combination allowance.

Direction: moonlit stone, selected from glacial, moonlit stone, armory, and instrument panel. Charcoal/slate surfaces, pale silver typography, ice-blue actions, and restrained amber gains. Inter supports controls/data; Barlow Condensed 600 supports display headings. Fonts were verified through Paper. Tokens are exported exactly in `tokens.css`.

Desktop: 1440px canvas and 1280px content. Selection uses a 928px inventory and 320px compact run panel; reports use the full content width. Item/action lanes remain fixed; names flex and wrap. Paper artboards have content-driven height. Responsive designs include 390px core flows, 320px import/report, 200% text treatments, a 768px report and focused import with keyboard space.

Evidence: actual Raidbots setup and completed Top Gear report reviewed; see `raidbots-top-gear-observations.md`. Names/item levels and listed sources were checked against the [pinned Poli93 database](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/assets/database/db.json). Fictional character and simulation values are illustrative, not calculated. Real item artwork now comes from verified Wowhead Wrath metadata and ZAM icon URLs; see `item-assets.json` and `wowhead-item-assets.md`. No AI imagery or Raidbots brand assets were used.

Measured contrast: primary text/canvas 16.73:1, muted text/surface 8.49:1, action/canvas 11.61:1, gain/surface 9.26:1, interactive control border/surface 3.58:1. Decorative dividers have lower contrast and are not the sole cue for an interactive control.

Revision 2 implements the user’s clarification: ranked complete Top Gear sets and an explicit free allowance, including the blocked state. Final operating limits and report expiry remain engineering decisions informed by benchmarks; 300,000 budget units, 60 standard combinations, and 30 days are illustrative design fixtures.

Revision 3 follows the request for less text and a closer Raidbots experience: 40px tool headings, 40–48px item icons, one-line selection rows, a 17-slot gear preview, compact set rankings with explicit changed-slot labels, and a full-width raid loot table. Long explanations move into details and disclosures. The free allowance remains visible and enforced in the intended behavior. Item rarity colors supplement the existing slate/ice palette.

Revision 4 completes 17 desktop, 25 mobile/responsive and 10 state/reference boards plus the consolidated component library. See `coverage.md` and `handoff.md`. Mobile uses inline actions and a separate run-summary page rather than an overlay drawer. Shared controls retain the compact icon-led direction; conditional explanations appear only in relevant details or recovery states. All launch tools remain anonymous and free. Full-design user approval is pending; no application implementation has started.
