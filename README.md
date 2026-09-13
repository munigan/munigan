# WoW Droptimizer

Anonymous Top Gear for level-80 Wrath 3.3.5a characters. Import equipped and carried-bag items, select owned copies, lock slots, and compare complete combinations with the native Poli93 simulator. Gems and enchants stay attached to their original copies.

Choose **Item version** in the run panel: **Original WotLK 3.3.5a** (default for new imports) or **Blizzard Wrath Classic**. The choice controls item stats, native item effects, inventory/result item levels and tooltip data, and is saved in drafts and reports. Pre-selector drafts/reports remain Classic. Original Mjolnir Runestone uses item level 226, 102 crit and a 665 armor-penetration proc; Classic uses 239, 115 and 751. Switching versions preserves supported manual selections and excludes newly unsupported bag items.

Original mode uses a pinned source-derived item profile with 878 static item overrides and 28 effect groups. Twelve items with unavailable/unverified Original mechanics are explicitly unsupported; see the [audit and sources](data/wotlk/original-items-audit.json). Class mechanics and shared encounter behavior remain those of the pinned simulator. Original hover/focus tooltips are labeled stats previews with verified effect summaries where available and links to full original item details; Classic uses Wowhead tooltips. Unsupported bag items remain passive and collapsed by default.

This branch implements the **local Top Gear release slice** with a connected Trigger.dev Development environment. Hosted workers, staging tests, production budgets and Warmane client parity remain pending. Boss/Raid Droptimizer, token redemption and billing are outside this slice.

## Run locally

Prerequisites: Node 24, pnpm 10, Git, Go (the build downloads Go 1.23.4), PostgreSQL 16. On macOS, PostgreSQL can be installed with `brew install postgresql@16`.

```sh
pnpm install --frozen-lockfile
pnpm setup:local
```

The setup script creates an isolated PostgreSQL cluster in ignored `.cache/pgdata`, listening only on `127.0.0.1:55435`, writes `.env.local` with a random encryption key, builds the pinned native simulator if missing, and applies the schema. It does not modify other databases. Set `PG_BIN` if PostgreSQL is installed elsewhere. Do not use this local trust-authentication setup as a public database.

For the configured Trigger.dev Development flow, start these in three terminals:

```sh
pnpm dev
```

```sh
pnpm trigger:dev
```

```sh
pnpm jobs:dispatch:watch
```

Open [Top Gear](http://127.0.0.1:3000/top-gear). The dispatcher sends admitted jobs to Trigger's `top-gear` task. Development mode executes the native worker on your machine, separately from Next.js, and persists results in PostgreSQL. The configured project is `proj_tbzzdkaotlbspettqxxh`; the development secret stays in ignored `.env.local`. The CLI uses your existing login. Fresh checkouts need `pnpm exec trigger login` and the project's Development secret key set locally.

For a fully local flow without Trigger, run `pnpm worker` instead of the Trigger dev server and dispatcher. Do not run both worker modes against the same database. Both modes enforce a shared concurrency limit of two.

For Docker instead, run `docker compose up -d` and use `postgresql://wotlk:local-development-only@127.0.0.1:55435/wow_top_gear` in `.env.local`. Generate `CAPABILITY_KEY` with `openssl rand -hex 32`, then run `pnpm sim:build` and `pnpm db:migrate`. Use either Docker or the isolated local cluster on port 55435.

## Import and use

Use the [Wrath WowSims Exporter](https://github.com/Poli93/wowsimsexporter-wotlk-335) character and bag exports (`/wse`). Full Poli93 JSON and profile links are supported as an alternative character input. Bank items are outside the scope. The current named-glyph adapter expects English glyph names; a simulator profile avoids this limitation.

The **Warmane Armory** import option accepts a character name and realm (Icecrown, Lordaeron, Blackrock or Onyxia). It reads equipped items, gems, enchants, race/class and professions from one public profile request. Talents and glyphs use the spec preset selected during review; check them before running. Bags remain an optional addon export. See [implementation and source notes](docs/engineering/warmane-import-research.md).

Imported fields, including explicit zero/false values and empty enhancements, take precedence over presets. Missing settings use the selected simulator preset. Simple/legacy rotations must be switched to Automatic or APL before import. Crafting professions do not require 450 to simulate; imported gear, enchant, gem and profession restrictions still apply. Only known lower-rank gathering professions are blocked, because the engine applies maximum-rank Mining, Skinning and Herbalism bonuses. Profession ranks never block draft restore: saved gear, selections and settings reopen for review, with imported ranks visible under Professions and readiness errors displayed beside Run.

Only valid equipped items start selected after import; supported bag items must be selected manually. Unsupported bag entries remain visible as passive icons with tooltips and are automatically excluded. They have no selection controls or navigation actions. Item icons/names show tooltips for the chosen item version and preserve the instance’s gems and enchant; local details remain available if external services are blocked. Invalid equipped gear blocks submission. The free allowance is up to 120 sets per run, including the equipped reference. The allowance is an upper bound; the worker removes illegal or mechanically identical inputs before charging actual work. Paired-slot order is preserved.

The equipped set is always evaluated once. If locks or selection exclude it, it remains reference-only. Every gain is versus that original set, including negative gains. Reports retain every result, paginate at 20 rows, show all 17 slots, and distinguish numerical highest DPS from a fewer-swaps recommendation within pairwise uncertainty. A partial or canceled run never claims exhaustive coverage. Retry creates a new report and can reuse completed work at the same policy and input version.

## Unrestricted local testing

Set `APP_ENV=local` and `LOCAL_UNLIMITED_ADMISSION=1` in the development app and worker environments. This explicit opt-in is ignored when `NODE_ENV=production`. It removes the set/search caps, daily capacity, account/browser/connection quotas, queue backlog cap, job deadline, and queue-age expiry. It does not change item legality or the Frost/token balances entered for purchases.

The local iterations slider defaults to 500 and supports 500–6,000 in steps of 500. Its selected value is saved in the draft and frozen with each job; editing a report restores it. `TOP_GEAR_ITERATIONS` can set a valid local default, and the OAuth preview harness preserves this environment setting. Without the opt-in, the existing server-controlled iteration policy and admission limits remain unchanged.

Actual execution remains bounded to two concurrent jobs, finite per-set iterations, two attempts per set, and the native per-set process watchdog (`SIM_TIMEOUT_SECONDS`, default 60 seconds). Cancellation, leases, and recovery remain active. Uncapped local jobs do not reserve or spend the shared daily quota ledger.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:sim
pnpm test:item-data
pnpm check:design
pnpm check:specs
pnpm test:e2e
pnpm build
```

Database tests create and drop randomly named `tg_test_*` schemas. Native tests need `pnpm sim:build`. Browser tests need the local database and `pnpm worker`; Playwright starts Next.js when needed. Test input gear is clearly labeled source fixture data; the product never fabricates DPS.

## Pinned data and deployment

`pnpm sim:build` verifies the Original data and builds native host and Linux amd64 binaries with both item profiles. `pnpm data:generate` extracts Classic defaults, APL decisions, catalogs and equipment tables from the engine commit. `pnpm data:limits` extracts 3.3.5 equip-limit categories; `python3 tools/data/original-items.py` generates Original item overrides and their effect audit from pinned, hash-checked SQL without executing it. Restrictions, Original data and source hashes are checked in. `tools/simulator/apply-original-profile.py` applies narrowly checked native hooks to the pinned checkout; shared class/encounter mechanics remain Poli93. Rebuild after any profile change and bump its revision before changing shipped mechanics.

See [compatibility and release evidence](docs/engineering/top-gear-compatibility.md), [worker operations](docs/engineering/top-gear-operations.md), and the [focused implementation plan](docs/superpowers/plans/2026-09-08-top-gear-implementation.md).

Trigger Development is configured and a real eight-set browser run completed through its queue. A deployment dry run also verified that the executable Linux binary is included in the bundle. Hosted execution still needs a remotely reachable PostgreSQL database, hosted environment variables and the documented staging checks. No cloud worker deployment or production launch has been performed. See [Trigger setup evidence](docs/engineering/top-gear-trigger.md).

Simulator and generated source retain the [upstream license](public/licenses/Poli93-wotlk.txt). Item artwork is displayed from Wowhead's icon CDN using cached icon names; item text and functionality remain available if artwork fails. Warcraft assets belong to their respective rights holders. Inter and Barlow Condensed are provided through Fontsource with their bundled licenses.
