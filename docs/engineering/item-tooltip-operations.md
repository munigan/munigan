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
