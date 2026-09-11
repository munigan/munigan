# Warmane import reliability investigation

Verified 2026-09-11. This note extends, rather than replaces, [the original integration research](warmane-import-research.md). The reported example is **Munigaan / Onyxia**.

## Finding

Poli93's active automatic importer sends the browser request through an existing Cloudflare Worker at `idansim.tjyeee.workers.dev`. Droptimizer's Node route fetches `armory.warmane.com` directly. Poli93 does **not** implement a special client retry algorithm: its active request is a single `fetch(apiUrl)` call. Both importers request only the profile, leaving talents and glyphs unchanged. These are facts visible in the [deployed source map](https://poli93.github.io/wotlk/bundle/preset_utils-7237e184.chunk.js.map), `ui/core/components/importers.ts` lines 657–866, and [our importer](../../src/server/warmane/armory.ts), lines 201–238.

The same character and our exact parser succeed locally and against the Worker's response, while the production route returns `warmaneUnavailable`. This isolates the observed discrepancy to the deployed retrieval path rather than unsupported gear or character data. A difference in the upstream network path or Warmane's treatment of requests from the production host is the leading explanation. **The precise upstream HTTP status or network exception from production has not been observed**, so a specific claim of a Warmane 429, 403, IP ban, or timeout would be premature. See live evidence below.

## Which source is actually deployed

The [live Death Knight page](https://poli93.github.io/wotlk/deathknight/) references `preset_utils-7237e184.chunk.js`. Its [JavaScript bundle](https://poli93.github.io/wotlk/bundle/preset_utils-7237e184.chunk.js) has a [public source map](https://poli93.github.io/wotlk/bundle/preset_utils-7237e184.chunk.js.map) containing complete TypeScript source text:

| Source-map entry | Embedded source | Relevant lines |
| --- | --- | --- |
| `sourcesContent[25]` | `../../../ui/core/components/importers.ts` | 657–866: active automatic importer; 1303–1606: active manual importer |
| `sourcesContent[74]` | `../../../ui/core/individual_sim_ui.ts` | 465–473: actual import-menu bindings |

The menu binds **Warmane Armory** to `IndividualWarmaneImporter`; **Warmane Armory (Manual)** binds to `IndividualWarmaneAutoImporter`. The latter's class name is misleading. Two earlier implementations between the active classes are block-commented and are not the active automatic path. [Source map](https://poli93.github.io/wotlk/bundle/preset_utils-7237e184.chunk.js.map).

The [public branch list](https://api.github.com/repos/Poli93/wotlk/branches?per_page=100) contained only `master` and `patch-1` when checked. Neither branch's `ui/core/components/importers.ts` contained `Warmane`:

- [`master`, commit `563e4a08cb15729f1fdcbcf68e6d68224553bfef`](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/ui/core/components/importers.ts).
- [`patch-1`, commit `72636cf2b7adb12f75e9f9950f33e4d43ca0646d`](https://github.com/Poli93/wotlk/blob/72636cf2b7adb12f75e9f9950f33e4d43ca0646d/ui/core/components/importers.ts).

Thus inspecting only the normal GitHub source branch misses this feature. The [published-site repository tree](https://api.github.com/repos/Poli93/poli93.github.io/git/trees/main?recursive=1) was also inspected: 309 entries, untruncated, with built assets and no identified source for this Warmane Worker. The generic `net_worker.js` and `sim_worker.js` assets are not evidence of the separately hosted Cloudflare Worker's internals.

Retrieved file SHA-256 values:

| File | SHA-256 |
| --- | --- |
| Live Death Knight HTML | `f32261ad0b6f2e6483389728cf3d205fe43fa377ccdde3432b001127f2ab9b26` |
| `preset_utils-7237e184.chunk.js` | `a631052a596ec43f3b46688d579936ecf9287efeeaeaa53a251711ff47c16a57` |
| `preset_utils-7237e184.chunk.js.map` | `8b0d8fa66fda3196790c297a10af87415298e04e5bb10e3cc15003528e80880b` |
| Extracted `importers.ts` | `ae06b695fffa141844d26967da71efe71f1b1598670617f71a60f25d567a9147` |

The extracted importer is byte-for-byte identical to the retained `/tmp/warmane-importers.ts` from the previous investigation despite the new bundle filename. Fresh retrieval copies are in `/tmp/poli93-reliability/`; these are temporary research artifacts, not runtime dependencies.

## Active automatic import: full behavior relevant to reliability

All line references in this section refer to embedded `ui/core/components/importers.ts` from the [current source map](https://poli93.github.io/wotlk/bundle/preset_utils-7237e184.chunk.js.map).

1. **Input:** the character name is trimmed, must be nonempty, and retains its case. The realm comes from a dropdown containing Onyxia, Icecrown, Lordaeron, and Blackrock. Both values are URL-encoded. There is no additional normalization or name validation (lines 673, 699–708).
2. **Endpoint:** for the reported example, the exact requested URL is `https://idansim.tjyeee.workers.dev/?character=Munigaan&server=Onyxia&page=profile` (lines 666, 708).
3. **UI concurrency:** the Import button is disabled while the request and parsing run, and restored in `finally` (lines 710–711, 727–730).
4. **Request:** `await fetch(apiUrl)` has no second argument (line 714). The active importer supplies no custom headers, credential mode, redirect setting, explicit timeout, retry/backoff loop, cache mode, local response cache, or fallback URL. Standard browser behavior therefore applies; this does **not** prove the browser, CDN, or Worker cannot cache responses.
5. **HTTP errors:** any non-2xx response raises an error that includes its status and tells the user to verify inputs or retry later (lines 715–716). That message is generic and does not establish that every non-2xx response represents rate limiting.
6. **Response:** it reads `response.text()` regardless of `Content-Type`; an empty response or fewer than 100 characters fails, otherwise HTML parsing begins (lines 719–724).
7. **Identity:** `DOMParser` parses the document. The importer uses the class of the currently open simulator, tries to infer the race from `.level-race-class`, and otherwise preserves the existing race. It does not verify the returned character name, realm, level, or actual class (lines 733–749).
8. **Professions:** recognized profession names at rank 350 or higher are retained, at most two. This affects imported configuration, not request success (lines 752–775).
9. **Gear:** it requires at least one `a[rel^="item="]`, then reads item, enchant, and gem data and determines slots from `.item-slot` container positions. It does not require every expected slot container. Missing gem mappings become zero with a console warning; zero gem positions are preserved (lines 777–858).
10. **Apply:** the shared completion method resolves equipment against the simulator database, sets race/gear and any imported professions, and reports success or success with missing item/enchant IDs. Because the automatic importer passed the current simulator class, the shared class comparison does not independently validate the character's actual class (lines 89–149, 737, 860).
11. **Talents and glyphs:** the automatic importer passes an empty talent string and null glyphs, leaving those settings untouched; it then shows a reminder. The source comment attributes this single-profile design to limiting Warmane requests (lines 860–864).

The comment at lines 662–665 describes the Worker as a server-side HTML fetcher adding CORS headers and claims Warmane had dropped an anti-bot check. That is the source author's explanation at the time; it is **not independent evidence of Warmane's current anti-bot policy**.

## Differences from Droptimizer

| Aspect | Poli93 automatic importer | Droptimizer |
| --- | --- | --- |
| Network path | Browser → existing Cloudflare Worker → upstream implementation unknown | Browser → Node API route → Warmane directly |
| Explicit outgoing request controls | None in browser `fetch` call | `Accept: text/html`, `redirect: error`, 12-second abort signal, `cache: no-store` |
| Profile requests per import | One | One |
| Explicit retries | None | None |
| Talent/glyph requests | None | None |
| HTML validation | Broad item-link presence; lenient identity and slot handling | Exact name/realm/race/class/level and complete slot-container validation |
| Upstream failure reporting | Reports non-2xx HTTP status | Maps non-404 non-2xx and unexpected fetch/read errors to the same 503 `warmaneUnavailable` |

Sources: [Poli93 source map](https://poli93.github.io/wotlk/bundle/preset_utils-7237e184.chunk.js.map), embedded importer lines 657–866; [our importer](../../src/server/warmane/armory.ts), lines 91–198 and 201–238; [our Node API route](../../src/app/api/import/warmane/route.ts), lines 6–20.

Stricter parsing could explain some differences in apparent success for malformed profiles, but it does **not** explain the specific `warmaneUnavailable` response reproduced here. Expected parser failures use separate codes such as `warmaneInvalidProfile`, `warmaneNotFound`, or `warmaneUnknownGem`. An unexpected exception would still be folded into `warmaneUnavailable`, so instrumentation is needed to exclude that completely. [Our importer](../../src/server/warmane/armory.ts), lines 67–83, 91–198, 235–237.

## Live evidence

The following read-only probes were performed in the main investigation at approximately **2026-09-11 16:29–16:30 UTC**. Source inspection above made no duplicate requests to Warmane or its proxy.

| Request / execution | Observed result |
| --- | --- |
| Local execution of the actual `importWarmaneCharacter({name: 'Munigaan', realm: 'Onyxia'})` under Node with `tsx` | Succeeded; the original outgoing fetch returned HTTP 200 in 592 ms. Parsed Orc Death Knight with 17 equipped slots. |
| [Production import route](https://munigan.app/api/import/warmane?name=Munigaan&realm=Onyxia) | HTTP 503 with the exact `warmaneUnavailable` message twice. The first completed in 286.6 ms, which is inconsistent with this request exhausting the configured 12-second timeout. |
| [Current Poli93 Worker endpoint](https://idansim.tjyeee.workers.dev/?character=Munigaan&server=Onyxia&page=profile) | HTTP 200 in 573 ms, 31,287 response bytes. Our exact `parseWarmaneProfile` function parsed it successfully as the same character with 17 equipped slots. |

Additional response observations:

- Local direct Warmane response: `Content-Type: text/html; charset=UTF-8`, `Server: cloudflare`, no `Location` or `Retry-After` header.
- Second production route response: `x-vercel-cache: MISS`, `Cache-Control: no-store`, `x-vercel-id: gru1::iad1::4zr7w-1789144200136-40ede9c9115d`. These are our application's response headers, not visibility into its upstream Warmane response.
- Worker response: `Content-Type: application/json; charset=UTF-8` despite carrying HTML accepted by our parser, `Access-Control-Allow-Origin: *`; no `Cache-Control`, `Age`, `CF-Cache-Status`, or `Retry-After` header observed. This does not establish whether the Worker's implementation uses internal caching.

The production route deliberately collapses the upstream status and unexpected errors into the public error, and the inspected code does not log the original cause. The HTTP 503 observed at `munigan.app` therefore must not be reported as a confirmed HTTP 503 from Warmane. [Error conversion](../../src/server/warmane/armory.ts), lines 215–216 and 235–237; [API response mapping](../../src/app/api/import/warmane/route.ts), lines 15–20.

The production runtime logs were checked using Vercel CLI 59.16.0:

```sh
pnpm dlx vercel@latest logs --project wow-droptimizer --environment production --query '/api/import/warmane' --since 15m --limit 10 --json
```

The two matching requests (`4zr7w-1789144200136-40ede9c9115d` and `s6bkv-1789144175532-7e3a62ad9484`) on deployment `dpl_BcLKsWU3Jctp24qXAAeeKraZpL7w` report serverless responses with status 503 and cache MISS, but have empty `logs`, `traceId`, and `message`. Thus the recorded logs do not recover the hidden upstream cause.

## What remains unknown

The Worker's source was not located. Its upstream URL construction, headers, cookies, redirect behavior, egress, caching, retries, alternative data sources, and error translation cannot be inferred completely from a successful public response or from the frontend comment. The public source establishes a different server/network path, not the internal mechanism that makes it more reliable for this character.

A targeted production diagnostic should preserve the original upstream status or fetch exception and timing. That would distinguish a Warmane denial/rate limit from a rejected redirect, DNS/TLS/network failure, or other exception.

For a reliability fix, test an application-owned Cloudflare relay with the existing strict parser: it reproduces the architectural difference observed to succeed while making the relay's behavior inspectable. A short, bounded cache for valid character profiles could reduce repeated upstream requests, but caching is a proposed improvement, not a confirmed Poli93 feature. Preserve upstream diagnostics in either design. Adding blind retries alone is not a difference supported by Poli93's active client source. No application code or deployment was changed during this investigation.
