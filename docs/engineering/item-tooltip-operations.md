# Item tooltip service

The browser requests `/api/tooltips/{classic|original}/{itemId}`. Next.js validates the ID against the finite local item/gem/icon catalog and calls the private Cloudflare Worker at `/v1/items/{version}/{id}`. The Worker fetches a fixed provider endpoint, parses its HTML into typed plain text, validates the JSON contract and returns the item plus cache metadata. The browser renders Classic Compact using Munigan tokens and the actual local gem/enchant choices. The third-party global Wowhead tooltip script is removed.

## Configuration

- Worker: `wow-droptimizer-item-tooltips`, in the same Cloudflare account as the Armory relay.
- SQLite Durable Object: `ITEMS` / `ItemTooltipCache`, migration `v1`.
- Worker secret: `RELAY_SECRET`.
- Server-only Vercel variables: `ITEM_TOOLTIP_RELAY_URL` (HTTPS origin) and sensitive `ITEM_TOOLTIP_RELAY_SECRET`.
- Classic upstream: `https://nether.wowhead.com/wotlk/tooltip/item/{id}`.
- Original upstream: `https://wotlk.cavernoftime.com/item={id}`.

Never expose the secret in a `NEXT_PUBLIC_` variable. No browser proxy, provider JavaScript or arbitrary caller-supplied URL is involved. Original never falls back to Classic; the local version-specific catalog is the UI fallback when no remote details exist.

## Freshness

The durable key is `v1-p2:{version}:{id}`. A successful snapshot is fresh for seven days. Afterwards it returns immediately as `meta.cache=stale`, with its original `meta.fetchedAt`, while Worker `waitUntil` owns an RPC that refreshes the item. Concurrent refreshes and cold reads coalesce inside the object's in-flight promise. The snapshot remains in SQLite across object eviction and deployments.

There is no age-based deletion of successful Wrath item data. A failed refresh never overwrites it. Cold failures and unsuccessful refreshes persist a five-minute cooldown; cold 404s use a day. A valid upstream Retry-After can extend cooldown to at most one day. This prevents repeatedly requesting an unavailable item. There is no scheduled crawler; refreshes are driven by actual reads.

The private Worker returns `no-store`. The public Next endpoint caches fresh JSON for five minutes in browsers and one hour in the CDN, allowing a day of CDN stale-while-revalidate and seven days of stale-if-error. Responses already marked stale use one minute plus five minutes of CDN stale-while-revalidate so refreshed data can become visible quickly. These HTTP caches reduce object reads; the seven-day source freshness and persistent last-good behavior are implemented inside Cloudflare. Errors are never publicly cached. The bounded browser memory cache also deduplicates hover/focus requests and retries errors after one minute.

Upstream fetches have a ten-second overall deadline and 512 KiB body limit, including streams; redirects are rejected. Next uses a twelve-second deadline and the same size limit. No provider exception messages or raw HTML are returned on failure. The UI continues to show useful local catalog details when the relay is unconfigured, a first lookup fails or an unknown item has no upstream information.

## Verification and deployment

Install root dependencies with `pnpm install --frozen-lockfile`, then `npm ci` under `workers/item-tooltips`. Run `npm test`, `npm run typecheck`, `npm run types -- --check` and `npm run dry-run` there. The CI `item-tooltips` job executes the same checks. Provider fixtures cover a weapon, trinket, gem and tier armor; runtime tests cover durable hits, stale refresh, refresh failure, source separation, coalescing, cooldown, auth, body bounds and stalled streams.

Deploy from this package with authenticated Wrangler. On the first deployment, pass a protected ignored secret JSON file using `--secrets-file`; subsequent deployments retain the secret. Set matching Vercel server variables through stdin, then use a remote production build with `vercel deploy --prod --skip-domain --yes`. Verify the protected deployment API and browser tooltip before promoting the alias. Do not use local prebuilt artifacts created with Vercel sensitive-variable placeholders.

For cache invalidation after an incompatible parser or contract change, increment both the JSON schema and durable key namespace, updating app validation with the Worker. For a compatible correction needing immediate refresh, change the key namespace deliberately and allow requested items to repopulate; retain the previous deployment/schema for rollback. Routine deployments preserve existing cache entries.

Cloudflare logs `tooltip.refresh` with version, item ID, outcome and sanitized status. A `tooltip.refresh-rpc-failed` event denotes a background RPC problem. Inspect `meta.fetchedAt` and `meta.cache` on the public response to distinguish an old snapshot from a new fetch. These are public item descriptions; no character names, inventory or personal account data enter this service.

## Worker verification — 2026-09-11

Worker version `0907242b-dd6b-408b-9147-869e49e1a60d` deployed at `https://wow-droptimizer-item-tooltips.diego-encoder.workers.dev` (830.91 KiB, 223.76 KiB gzip, 56 ms startup). Unauthenticated requests returned 401. Authenticated cold reads returned 200 for weapon 50730, trinket 50362, gem 40111 and tier item 51225 from both providers at 18:51:25–18:51:32 UTC. All included source-specific JSON and expected functional lines. Cold reads took 606–1,290 ms; a repeated weapon read took 146 ms and reused the exact original retrieval timestamp.

Worker validation: 25 runtime/parser tests passed, both TypeScript checks, generated declaration check and deploy dry-run passed. Backend review caught source truncation at both a partial table and the boundary before the effects table; regression tests now reject both without replacing saved data. Final backend re-review approved the correction.

## Application validation

The final implementation incorporates main `7a72b43`, including the Gear Lab route, source icons, preset improvements and raid-training work. Enchant previews and attachments use the application's localized `enchantDescription` rather than asking the item endpoint for a spell or recipe; spell source links remain available and editing behavior is preserved.

Validation passed: 92 files / 637 app unit and component tests, 25 Worker runtime/parser tests, TypeScript, ESLint, design/spec checks, and ten maintained tooltip/enhancement browser checks plus a real-response visual capture. Browser coverage includes both item versions, full effects, 320px/390px and short viewports, internal scroll, keyboard focus/Escape, modal placement, touch inspection/close, exact socket editing, offscreen dismissal and owned enchant hover/focus/editing. Source text is rendered as escaped React text; local labels and enchant descriptions are available in English and Portuguese.

Final review approved both specification and code quality after two interaction fixes: only one item, gem or enchant tooltip can be open at once, and tapping either the icon or name of a non-editable inventory item opens inspection. Editable items retain their existing editing action. Both have focused component and browser regressions.


## Application deployment — 2026-09-11

Application source commit `7d87629` was remotely built and deployed as `dpl_3kQz5yEBxpx4DMvQR6yNpBjaCdAB` at `https://wow-droptimizer-kyo4ftpeo-diego-fernandes-projects.vercel.app`, then promoted to `https://munigan.app`. The protected build passed compilation, TypeScript and static generation. Before promotion, both provider endpoints returned complete trinket data with the corrected slot classification; an unknown catalog item returned 404 and an invalid version returned 400, both with `no-store`.

Live verification completed at `2026-09-11T19:05:07.216Z`. Both Deathbringer's Will variants returned 200 with provider-specific JSON and the full 30-second effect. An original Koltira's Helmet lookup populated a new cache entry. A repeated classic trinket request was a Vercel cache HIT in 26 ms and preserved the Worker retrieval timestamp. Unknown and invalid lookups retained their expected uncached errors.

Live browser verification confirmed keyboard focus first shows local details, then enriches the owned tooltip with armor, stats, effects, sockets and full set references from Cavern of Time. Exactly one tooltip was visible; Escape dismissed it. The document loaded no Wowhead or Cavern of Time scripts. The Gear Lab import page remained available after navigation. Maintained browser tests cover the remaining hover, touch, modal and enhancement interactions.

The previous custom-domain deployment was `dpl_8wfjt3UVxREBTPPwYgzhoipoaraN` (`https://wow-droptimizer-5drzizv8g-diego-fernandes-projects.vercel.app`). To roll back the web application, promote that deployment; its existing environment and Warmane importer are independent of the tooltip service. The Worker may remain available with its private authentication and preserved snapshots.


## Enchant layout correction — 2026-09-11

Source commit `eadc054` fixes two CSS collisions exposed by Lightweave Embroidery and Chest - Major Spirit: a broad header span selector gave the icon frame `flex: 1`, and generic component-layer tooltip styles overrode the compact rules in the base layer. The expanding title now has an explicit class shared by item, gem and enchant headers. Enchant overrides live in the components layer alongside the generic tooltip styles, with sufficient specificity to preserve their intended padding and typography.

The browser regression first reproduced a 90×32 px frame and then the incorrect `6px 9px` padding. After correction, both enchant names passed at 1440 px and 390 px widths, with square frames, 16 px padding, 13/20 px body text and no horizontal overflow. All 11 tooltip/enhancement browser checks, 34 component tests, TypeScript, focused ESLint and diff-check passed; scoped code review approved the changes.

The production build passed and `dpl_91SPwQN1VgpAZXd8b8VSo5LdvBQr` (`https://wow-droptimizer-ii5wadisb-diego-fernandes-projects.vercel.app`) was promoted to munigan.app. Live browser measurements confirmed both reported enchants use 32×32 px frames, 16 px padding and 13/20 px body text without horizontal overflow. No Worker deployment or cache invalidation was needed.

## Tooltip loading state — 2026-09-11

Source commit `bef9935` implements the approved Paper loading design: known catalog details remain visible, four effect skeleton lines and two requirement bars appear after 120 ms, and the status becomes reassuring after two seconds. Skeleton shapes pulse in opacity over 1.4 seconds; ready details reveal over 120 ms. Reduced motion disables both animations. Cached data and complete ordinary gems open directly; meta gems retain enrichment feedback. Failed requests stop the skeleton and can retry on a later reopen without restarting loading on a mere re-hover.

Validation passed: 41 focused component tests, 12 tooltip/enhancement browser tests, TypeScript, focused ESLint, design checks and scoped review. The browser regression verifies actual animation duration, reduced motion, delayed enrichment and stable 336 px width; its screenshot was visually reviewed. Production compilation, TypeScript and static generation passed.

Deployment `dpl_5MhdsuJisDfFPuCW6Pm24Q9nDRAS` at `https://wow-droptimizer-b9t0at5xl-diego-fernandes-projects.vercel.app` was verified and promoted to munigan.app. The protected deployment returned complete original trinket JSON; the public Gear Lab page and generated CSS contain the approved loading copy and pulse rules. No Worker deployment was required. The previous application deployment is `dpl_91SPwQN1VgpAZXd8b8VSo5LdvBQr` for rollback.

## Quiet enrichment status — 2026-09-11

Source `c7c90d5` revises the loading design after feedback on a fully enhanced chest item: known catalog content now remains contiguous with no body or requirement placeholders. A single footer status says “Fetching additional details…” with a small pulsing dot; unknown items retain four body skeleton lines. Cached details, local-complete gems, failures, retries and reduced-motion support remain intact. The obsolete two-second status transition was removed.

Validation: 27 component tests, all 12 tooltip/enhancement browser tests, TypeScript, focused lint, formatting, design checks and scoped review passed. A browser screenshot confirmed the compact footer layout. Production build `dpl_GU6rXRUhw7h46KpG6ZmSybKsycti` (`https://wow-droptimizer-lxow4ctl5-diego-fernandes-projects.vercel.app`) passed and was promoted to munigan.app after verifying its page and CSS. The public page and dot styles were also verified. No Worker change was needed.

## Hover opening delay — 2026-09-11

Source `59302c3` adds a cancellable 250 ms hover delay to custom item/gem popovers and sets Base UI enchant triggers to the same delay. Keyboard focus and touch inspection stay immediate. Leaving, blurring, dismissing, unmounting or changing item identity cancels pending opening; ownership cleanup remains independent of identity changes.

All 29 item component tests, 12 tooltip/enhancement browser tests, TypeScript, focused lint and scoped review passed. Production build `dpl_7wTkEL3vyc1SiMKH6Je46iD2Nxdc` (`https://wow-droptimizer-jy8lg7zmk-diego-fernandes-projects.vercel.app`) passed, its Gear Lab page was verified, and it was promoted to munigan.app. No Worker changes were required.
