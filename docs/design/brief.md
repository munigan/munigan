# WoW Droptimizer design brief

Status: draft revision 2, awaiting user refinement. Editable source is the user-created [WoW Droptimizer Paper file](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/2-0). No application implementation has started.

Audience: Warmane 3.3.5a players comparing owned equipment and raid acquisitions. Realm is not a primary setting. All launch tools work anonymously; free Top Gear has a visible combination allowance.

Direction: moonlit stone, selected from glacial, moonlit stone, armory, and instrument panel. Charcoal/slate surfaces, pale silver typography, ice-blue actions, and restrained amber gains. Inter supports controls/data; Barlow Condensed 600 supports display headings. Fonts were verified through Paper. Tokens are exported exactly in `tokens.css`.

Desktop: 1440px canvas, 1280px content, 928px primary column, 32px gap, 320px summary. Item/action lanes remain fixed; names flex and wrap. Paper artboards have content-driven height. Responsive screen design is still pending.

Evidence: actual Raidbots setup and completed Top Gear report reviewed; see `raidbots-top-gear-observations.md`. Names/item levels and listed sources were checked against the [pinned Poli93 database](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/assets/database/db.json). Fictional character and simulation values are illustrative, not calculated. Icons are original simple SVG symbols for this draft, not final item artwork. No AI imagery or copied Raidbots brand assets were used.

Measured contrast: primary text/canvas 16.73:1, muted text/surface 8.49:1, action/canvas 11.61:1, gain/surface 9.26:1, interactive control border/surface 3.58:1. Decorative dividers have lower contrast and are not the sole cue for an interactive control.

Revision 2 implements the user’s clarification: ranked complete Top Gear sets and an explicit free allowance, including the blocked state. Final operating limits and report expiry remain engineering decisions informed by benchmarks; 300,000 budget units, 60 standard combinations, and 30 days are illustrative design fixtures.
