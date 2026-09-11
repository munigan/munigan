# Owned item tooltips

The user selected Classic Compact in Paper and requested an owned Cloudflare Worker that parses Wowhead and Cavern of Time into JSON, with a long stale-while-revalidate cache, rendered using our design.

## Contract and boundaries

`GET /v1/items/{classic|original}/{id}` on a private Worker returns a versioned `ItemTooltipResponse`. The app exposes the same data through `/api/tooltips/{version}/{id}` and keeps the bearer secret server-side. IDs are positive integers at most 1,000,000; public requests must reference an item, gem or icon known to our catalog. No arbitrary URLs or provider HTML reach the client.

Classic uses `https://nether.wowhead.com/wotlk/tooltip/item/{id}`; original uses `https://wotlk.cavernoftime.com/item={id}`. Their data must never be mixed. The parser extracts name, quality, icon, item level, heroic status, typed text lines (including full effects, requirements and sets), socket colors and socket bonus. Unknown functional lines remain readable descriptions. Third-party scripts, markup and event handlers are never executed or rendered.

## Cache and failures

One SQLite Durable Object per schema/version/item stores the last validated JSON, fetch timestamp and retry deadline. Successful items are fresh for seven days. Stale data returns immediately while a Worker `waitUntil` RPC refreshes it. Refreshes coalesce per item. Successful data is retained until replaced, including during provider failures; age and freshness are returned explicitly. Failures never overwrite successful data. Cold failures use a five-minute cooldown, cold 404s one day, respecting bounded upstream Retry-After. Provider fetches have a ten-second deadline and a 512 KiB body limit with redirects rejected. Browser/CDN caching is shorter than the persistent freshness window so refreshes remain observable. No scheduled crawler or bulk warmup is needed.

## Classic Compact UI

Paper: https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/U-0

Use the approved exact neutral Munigan tokens: surface #17191D, control border #494C53, text #F3F4F6, muted #A5A8AF, effect green #78E34D, epic #D3AAEF. Width 336px (280px gems), padding 16px, radius 4px, shadow 0 8px 24px #0005. Inter body 13px/20px, name 15px/20px semibold, header icon 36px, sections spaced 12px; socket icon lane 16px and gap 8px. Footer has a 1px divider and 12px padding above.

Render cached/local catalog basics immediately, enrich on hover/focus, deduplicate browser requests, bound memory and retry errors. Preserve gem indices and original empty socket positions; trailing export padding creates no extra slots. Compute socket bonus state with existing domain helpers. Show the actual enchant and gem stats, unsupported simulator status where applicable, source/version and full source requirements/effects. Loading or provider failure must not replace useful basics with a blank tooltip. Source text may remain English; app labels use EN/PT messages.

Hover and keyboard focus open; tooltip is hoverable with an 8px anchor gap; Escape dismisses without closing the enclosing dialog. Viewport margin 8px, height constrained with internal scrolling. Touch inspection has an explicit close control. Preserve existing link and gear-edit actions, passive bag icon semantics, and operation inside modal dialogs. Remove Wowhead's global tooltip script when all item links use our component.

## Verification and release

Captured provider fixtures cover a weapon, trinket, gem and tier item. Test source/version separation, complete effects/sets, unsafe HTML, malformed documents, body/time bounds, authentication, cold/hit/stale/error caching and concurrent requests in the Workers runtime. Test app relay validation, custom tooltip interactions/attachments, both versions and responsive/modal browser behavior. Independently review before deployment. Deploy the separate Worker using the existing account, configure private production env vars, verify a protected web deployment, then release with the latest main changes preserved.
