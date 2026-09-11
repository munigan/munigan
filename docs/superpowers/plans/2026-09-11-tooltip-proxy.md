# Tooltip Proxy Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Execute the authorized change in this session.

**Goal:** Serve durable cached item JSON from Cloudflare and render the approved Classic Compact tooltip.
**Architecture:** Shared validated contract; private Cloudflare Worker with a per-item SQLite Durable Object; same-origin Next route; custom client tooltip with local basics and attachments.
**Tech Stack:** Next 16.3.4, React 19, Zod, Cheerio, Cloudflare Workers/SQLite Durable Objects, Vitest and Playwright.
**Spec:** docs/superpowers/specs/2026-09-11-tooltip-proxy-design.md

## Global Constraints

- Work only in `.worktrees/tooltip-proxy` from production main. Root checkout has an unrelated merge.
- No provider HTML, third-party tooltip script, arbitrary upstream URL or client secret.
- Original and Classic cache keys/data stay separate. Preserve actual enhancements and unsupported simulation status.
- Follow approved Paper dimensions and Munigan tokens. All interface copy EN/PT.
- Test before claiming completion. Preserve current production features at release.

### Task 1: Contract, parser and cached Worker

**Files:** `src/domain/tooltips/contracts.ts`, `workers/item-tooltips/**`, provider fixtures under `workers/item-tooltips/test/fixtures`.

**Interfaces:** `ItemTooltipSchema`, `ItemTooltipResponseSchema`, `ItemTooltip`, `ItemTooltipResponse`, `TooltipLine` from the shared contracts module. Item: schemaVersion 1, id, version, source `{provider,url}`, name, quality, icon nullable, itemLevel nullable, heroic, lines `{kind,text,rightText?}`, sockets string[], socketBonus nullable. Response `{item,meta:{fetchedAt,cache:"fresh"|"stale"}}`. Kinds: binding, slot, weapon, stat, effect, requirement, durability, flavor, set, description. The upstream parser/fetcher and Durable Object are Worker-private.

- [ ] Capture weapon 50730, trinket 50362, gem 40111, tier item 51225 from both actual providers.
- [ ] Write failing fixture tests for name/stats/sockets/full effects/set text, malformed/challenge HTML, executable markup and identity validation.
- [ ] Implement bounded fetch and parse plain JSON; verify fixtures.
- [ ] Write runtime tests for authentication, routing, invalid IDs, fresh hit, stale immediate response plus refreshed storage, failed refresh keeping good data, persistent cooldown and concurrent cold requests.
- [ ] Implement per-item SQLite storage, in-flight coalescing and background refresh RPC; verify runtime tests, generated bindings, typecheck and dry-run.

### Task 2: Classic Compact UI

**Files:** inventory item tooltip component/data client/styles and tests; Item.tsx; OriginalItemLink.tsx; WowheadTooltips.tsx; shell integration; EN/PT inventory messages; item tooltip e2e tests.

**Interfaces:** Consume `ItemTooltipResponseSchema` from `src/domain/tooltips/contracts.ts`. Fetch `/api/tooltips/${version}/${itemId}` on hover/focus. Root owns the Next route and Worker. UI must render full response line text plus local gem/enchant attachments. Preserve existing ItemLink props and click handlers.

- [ ] Read Item.tsx, OriginalItemLink.tsx, tooltip-viewport.ts, catalog and socket matching helpers; use exact Paper styles from the spec.
- [ ] Write failing component tests: immediate local basics; enrichment; provider failure; original routing; gap-preserving gems; actual enchant; stale request races; keyboard Escape; click-handler preservation.
- [ ] Implement a bounded deduplicating browser data cache and the Classic Compact component; remove external Wowhead renderer; update styling selectors affected by the wrapper.
- [ ] Use generic source lines for all functional text including sets and requirements; local attachment stats remain version-aware. No dangerous HTML.
- [ ] Update responsive/modal e2e tests to use deterministic JSON route fixtures and verify scrolling and positioning at narrow/short dimensions. Add hover transition/focus/Escape and touch close coverage.
- [ ] Run relevant component/browser tests and report changes, evidence and remaining concerns for independent review.

### Task 3: App relay and release

**Files:** `/src/app/api/tooltips/[version]/[id]/route.ts`, server tooltip client/tests, env example, CI, operations doc.

**Interfaces:** Consume shared response schema. Production env `ITEM_TOOLTIP_RELAY_URL` and `ITEM_TOOLTIP_RELAY_SECRET`; Worker `RELAY_SECRET`.

- [ ] Write route/client tests for fixed paths, known catalog IDs, invalid version, missing config, private authorization, mismatched response and bounded fetch errors; implement the route and public cache headers with no cached errors.
- [ ] Independently review Worker and UI, resolve findings and run combined checks.
- [ ] Deploy Worker to existing Cloudflare account; verify unauthorized rejection and both real providers, repeated cached lookup and full proc/set content.
- [ ] Configure production env using protected files/stdin; deploy web with a remote production build and domain promotion withheld until verification.
- [ ] Verify protected deployment and live release, document version/URLs and operational cache limits; commit and synchronize with latest main without disturbing root merge.
