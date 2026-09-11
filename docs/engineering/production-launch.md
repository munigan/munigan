# First production release

Published 2026-09-09.

## Current worker — parallel Top Gear execution

Released 2026-09-11. Trigger Production **20260911.1** ([deployment](https://cloud.trigger.dev/projects/v3/proj_tbzzdkaotlbspettqxxh/deployments/mshu2wqo)) uses Medium 2x (2 vCPU, 4 GB) and up to two native processes per job. Reference results persist before candidates start; cancellation, retries, lease fencing, and durable resumption remain enforced. Each run logs phase timings. The global queue/admission cap remains two jobs; sampling and the pinned simulator are unchanged.

Hosted verification recomputed a captured 96-set/500-iteration Frost DK request. Trigger execution fell from **150.560 s to 36.676 s**; all 96 persisted simulation results were identical. Total run cost including invocation changed from **$0.00510640 to $0.00625992**. [Live report](https://munigan.app/reports/fCp9MhybzeWKQG79NNKi3S9DPVcMOINlOdF6EsV4YH4). Full evidence and limits: [performance investigation](top-gear-performance.md).

Verification: 424 unit/UI tests, 19 database integration tests, native persisted-result parity, TypeScript, project lint excluding unrelated nested `.worktrees` artifacts, formatting, worker packaging, and the real hosted run passed. No website deployment or Git commit/push was performed.

## Current production — Buffs & settings redesign

Released 2026-09-10 at https://munigan.app.

- Vercel deployment: `dpl_4SFrDjCbvToxvgeAWgfXtsN85rKp` ([inspection](https://vercel.com/diego-fernandes-projects/wow-droptimizer/4SFrDjCbvToxvgeAWgfXtsN85rKp)); production ready and aliased to munigan.app.
- Deployment URL: https://wow-droptimizer-67ct2afqa-diego-fernandes-projects.vercel.app.
- All seven settings sections now use the approved Paper layout, staged Apply/Cancel, responsive navigation, compact controls and search. Buffs use a responsive two-column grid; glyph descriptions remain in picker options; engineering toggles have consistent bordered controls; pet scrolls are grouped beneath pet food. Shared item tooltip hit areas are constrained and Selected only is removed.
- Verification: frozen install, TypeScript, full ESLint, 234 unit/UI tests and Vercel production build passed. Five settings/tooltip browser flows passed against production, including all sections, English/Portuguese, desktop/mobile, Apply/Cancel and invalid JSON recovery. Both localized homepages and Top Gear returned HTTP 200.
- A real production comparison using the redesigned settings (30-second encounter, zero duration variation, Bloodlust off) completed both gear combinations. No browser runtime errors.
- Verification report: https://munigan.app/reports/YyvEX3keM-Mv2cqSa9cyhZvJoRc8MPyzpGpzmKZN0dY.
- Existing Trigger worker retained; no worker or simulation-contract changes required for this release.

## Previous production — enhancement dialog visual refinements

Released 2026-09-10 at https://munigan.app.

- Vercel deployment: `dpl_AMj9m9Jj1QrVCAv8Kz94zGtMX86Y` ([inspection](https://vercel.com/diego-fernandes-projects/wow-droptimizer/AMj9m9Jj1QrVCAv8Kz94zGtMX86Y)); production ready and aliased to munigan.app.
- Deployment URL: https://wow-droptimizer-jzvzrvlkh-diego-fernandes-projects.vercel.app.
- Darker sidebar, results and controls matching the custom-item dialog; active navigation with a green edge indicator and status dot; search and selects on one desktop row with responsive stacking.
- Verification: frozen install, TypeScript, full ESLint, 232 unit/UI tests, and Vercel production build passed. All three editor browser flows passed against production, covering Apply/Cancel/reset, draft restore, focused-field navigation, English/Portuguese and mobile overflow. Computed styles confirmed dark backgrounds, equal control heights, single-row desktop alignment and the 2px active indicator.
- Trigger `20260910.1` retained; these refinements do not change worker or simulation contracts. No new simulation was needed for this visual-only release; the preceding release's live two-set report remains available below.

## Previous production — per-item gems, enchants and UI refinements

Released 2026-09-10 at https://munigan.app.

- Vercel deployment: `dpl_DxEu51x3bSLkogxcVCsBMJT14wFg` ([inspection](https://vercel.com/diego-fernandes-projects/wow-droptimizer/DxEu51x3bSLkogxcVCsBMJT14wFg)); production ready and aliased to munigan.app.
- Deployment URL: https://wow-droptimizer-9fiezisst-diego-fernandes-projects.vercel.app.
- Trigger Production: `20260910.1` ([deployment](https://cloud.trigger.dev/projects/v3/proj_tbzzdkaotlbspettqxxh/deployments/kwfu548j)), deployed successfully before the dependent website.
- Per-item gem/enchant editor with automatic previews, manual overrides, profession and set-limit validation, independent checkbox selection, direct socket/enchant entry, and preserved imported reference. Enchant formula artwork, hidden unsupported enchant controls, icons-only row previews, aligned modal sidebar, consistent search/select controls, and mobile equipment/filter layout refinements.
- Verification: frozen dependency install, TypeScript, full ESLint, all 232 unit/UI tests, 10 database orchestration tests, 5 native simulator tests, rebuilt pinned Linux simulator, and Vercel production build passed. The latest three editor browser flows passed before release.
- Live verification: both localized homepages returned 200; imported a character, edited an equipped candidate's gem through the dialog, confirmed the saved override and icons-only preview, checked the 390px layout, and ran a 30-second/two-set comparison. Both sets completed, the manual gem `40112` survived into the candidate result, and the original reference remained separate. Browser runtime errors: none.
- Verification report: https://munigan.app/reports/QofSvgQr-8F5vBtyZJ3oEZssIGrQUcoiXUvfocpL4iU.
- Existing project/domain, database and secrets retained. Prior Warmane hosted-import limitation was not part of this release verification.

## Previous production — draft flow, import and responsive layout updates

Released 2026-09-10 at https://munigan.app.

- Vercel deployment: `dpl_2RnkRxNiRy7P1wwGQ8xGjjbfAfjC` ([inspection](https://vercel.com/diego-fernandes-projects/wow-droptimizer/2RnkRxNiRy7P1wwGQ8xGjjbfAfjC)); ready and aliased to munigan.app.
- Deployment URL: https://wow-droptimizer-5nfphqo59-diego-fernandes-projects.vercel.app.
- Includes the compact character draft summary on a surface background with the original text-only restore action; Top Gear navigation resets while preserving drafts; report editing opens equipment selection; Warmane import option and Munigan placeholder; 1,600px shared content limit; enlarged homepage artwork positioned at 30% vertically.
- Verification: frozen install, TypeScript, full ESLint, 191 unit/UI tests, 16 relevant browser checks and Vercel production build passed.
- Live checks passed for both localized homepages at 3,440px (1,600px content, 50%/30% background position, no overflow), addon import into equipment selection, draft reset and restoration across reload, and editing an existing production report directly into equipment selection. No browser runtime errors or new simulations.
- Known production limitation: Warmane import returned HTTP 503 / `warmaneUnavailable` for Barbarius/Icecrown and Shamaj/Blackrock. Direct and local-server Barbarius imports returned 200 during the same check. The failure is specific to the hosted request path; the exact upstream cause is unconfirmed. Addon and simulator-profile imports remain available.
- Trigger `20260909.2` retained; no worker or simulation-contract changes in this release.

## Previous production — glyph import compatibility and grouped sidebar

Released 2026-09-09 at https://munigan.app.

- Vercel deployment: `dpl_3iUPfcEMCtrH1uKwxi6FWS5ruoiq` ([inspection](https://vercel.com/diego-fernandes-projects/wow-droptimizer/3iUPfcEMCtrH1uKwxi6FWS5ruoiq)); ready and aliased to munigan.app.
- Deployment URL: https://wow-droptimizer-d3qysnchl-diego-fernandes-projects.vercel.app.
- Original-exporter “Glyph of Enslave Demon” now maps to the same Warlock minor glyph as “Glyph of Subjugate Demon” (43393). Unknown and wrong-class names remain rejected.
- Approved grouped sidebar with bottom language selector and active indicator flush against the viewport's left edge.
- Verification: frozen dependency install, TypeScript, ESLint, all 166 unit/UI tests and Vercel production build passed. The sidebar's 14 navigation/localization browser tests passed before release.
- Live browser verification imported the original glyph name, selected a Warlock preset, and confirmed glyph 43393 in the saved selection. Both localized homepages returned 200, the active indicator measured x=0, and no browser page errors occurred. The smoke script initially used an exact heading name without the selected-item count; the corrected locator passed.
- Trigger `20260909.2` retained; no worker, simulation or persistence contract changes. The live check exercised import/selection without submitting a simulation.

## Previous production — English and Brazilian Portuguese

Released 2026-09-09 at https://munigan.app.

- Vercel deployment: `dpl_JDtyMsmZXk8mLbmF2RpPZkouDW2c` ([inspection](https://vercel.com/diego-fernandes-projects/wow-droptimizer/JDtyMsmZXk8mLbmF2RpPZkouDW2c)); ready and aliased to munigan.app.
- Deployment URL: https://wow-droptimizer-gtilvgu2g-diego-fernandes-projects.vercel.app.
- Prerendered homepages: `/en-us` and `/pt-br`. `/` returns a temporary 307 based on the preference cookie, browser language and English fallback. Tool/report URLs stay unchanged.
- Localized interface, errors, numeric formatting, homepage metadata, reciprocal hreflang/sitemap and Portuguese 1200×630 Paper social image. WoW proper names and simulator input remain English/canonical.
- Language changes preserve unsaved imports, exact draft data, picker/settings state, report page/selection/scroll and polling. Alternate dictionaries load on demand; production-mode English homepage did not download Portuguese messages.
- Verification: 162 unit/UI tests, 13 database integration tests, 14 homepage/i18n browser checks and 31 affected workflow browser checks passed. TypeScript, ESLint, production build and whitespace checks passed. Reviewed desktop/390px application screens in both languages.
- Live checks passed for negotiated root, cookie priority, both localized homepages and OG assets, existing report/stats in both languages, report privacy headers, and legacy domain redirects preserving query parameters.
- Live Top Gear retained an unfinished export during in-place switching, saved the language across reloads, and made no simulation submission. Browser page errors: none.
- Existing Vercel/Neon/Trigger infrastructure and free limits retained. Trigger `20260909.2` remains compatible: this release changes web presentation/API diagnostic metadata without changing simulation formulas, job input or persisted report contracts.

## Previous production — munigan.app redesign


Redeployed from the current workspace on 2026-09-09 after the munigan.app redesign and custom-item feature.

- Website: https://munigan.app
- Vercel deployment: `dpl_4rNCrACm1jCUgW9CMbP56W1YcNUs` ([inspection](https://vercel.com/diego-fernandes-projects/wow-droptimizer/4rNCrACm1jCUgW9CMbP56W1YcNUs)).
- Trigger Production: `20260909.2`, deployed successfully before the website.
- Existing Vercel project, Neon database, capability key, limits, and free-tier services retained.
- Production `APP_ORIGIN` is `https://munigan.app`; public canonical, sitemap and OG image URLs use this origin.
- Vercel verified the apex domain. The old `wow-droptmizer.munigan.app` host permanently redirects with status 308, preserving paths and query strings.
- Verification: typecheck, lint, all 119 unit/UI tests, 9 homepage/custom-picker browser tests, and the Vercel production build passed.
- A real production import added custom helmet 50712, submitted successfully from the new origin, and completed two sets through Trigger/Neon. [Verification report](https://munigan.app/reports/y1hyzT8N4fVQ0tpQ_fp3JjuOrwJjUSqPELVWfPZG_Vs). Anonymous access remains read-only; reports carry `noindex, nofollow, noarchive`.
- Verified the live canonical URL, OG image response, robots sitemap, legacy report redirect, and rendered result table. A temporary smoke script's exact heading locator omitted the displayed result count; verification was completed using the accessible results table instead.

The original release record below is historical.

- Website: https://wow-droptmizer.munigan.app
- Repository: https://github.com/diego3g/wow-droptimizer (private), production branch `main`.
- Vercel project: `wow-droptimizer`, personal Hobby workspace `diego-fernandes-projects`, region `iad1`.
- Neon resource: `wow-droptimizer`, existing Neon integration, **Free**, Washington DC (`iad1`), optional Neon Auth disabled. Connected only to Vercel Production.
- Trigger.dev: Munigan / WoW Droptmizer, project `proj_tbzzdkaotlbspettqxxh`, **Free**, Production version `20260909.1`.

The subdomain intentionally uses `wow-droptmizer` (the exact user-specified hostname); the repository and project names use `wow-droptimizer`.

## Runtime

Vercel accepts a durable PostgreSQL job, then dispatches its outbox after the response. Trigger runs the pinned Linux simulator with two concurrent simulation jobs. The `top-gear-recovery` scheduled task reconciles leases, expires abandoned jobs, and retries pending dispatches every ten minutes in Production. Local native execution remains available without Trigger credentials.

Database pools have four connections, five-second idle cleanup, and Vercel pool lifecycle handling. Neon can suspend between recovery sweeps when there is no app traffic. Sweeps still consume the Free plan's compute allowance; free hosting is capacity-limited. Trigger Free stops running tasks after its included credits are exhausted. No paid plan or add-on was enabled.

Production admission: 120 sets per run (`TOP_GEAR_MAX_UNITS=600000`), 500 iterations per set, 900-second job deadline, 200,000,000 global daily work units (`GLOBAL_DAILY_UNITS=200000000`), and 20 queued jobs maximum. On 2026-09-11, the shared daily budget increased 100× from 2,000,000 units. Each attempted combination consumes 5,000 units; admission reserves two attempts per estimated combination and releases unused capacity on settlement. The daily budget resets at midnight UTC. Per-browser and per-IP limits remain 20 and 40 admitted jobs per day.

`APP_ORIGIN` is the custom HTTPS hostname. Vercel supplies `x-vercel-forwarded-for` for hashed per-source admission limits. Production uses a separate Neon database and fresh capability key. Local reports were not migrated.

## Verification

- Typecheck, ESLint, production build, design/spec checks passed.
- 74 unit/UI tests, 12 database integration tests, and 45 native simulator tests passed.
- Existing local browser simulation test passed after the dispatch change.
- Production recovery task completed against Neon: `run_06g8d45bsoco1bn9ujihccra01`.
- A live browser imported Munigaan's supplied equipment/professions/glyphs and one bag helmet, selected the bag item, and completed four combinations using Original WotLK data.
- Production report: https://wow-droptmizer.munigan.app/reports/LHTrkWZJl7z_aNNndGDStuIBBcIwAULha_t5MPUQ2Uw
- Anonymous report API returned `canManage: false`, complete/exhaustive coverage, and four rows. Mjolnir displayed item level 226.
- Custom domain verified by Vercel and accessed successfully over HTTPS.

The first CLI website build failed because `.vercelignore` excluded fixtures while TypeScript still checked source tests. Including the shared test files fixed the production build.

## Subsequent releases

1. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, and the relevant tests.
2. For simulator/native changes, run `pnpm sim:build` to regenerate the pinned Linux executable. `dist/` is intentionally not committed.
3. For worker changes, run `pnpm trigger:deploy` and confirm the production version succeeds **before** pushing dependent web changes. Trigger secrets are configured in its Production environment; `.env.local` must never be uploaded as hosted configuration.
4. Push to GitHub `main`. Vercel's Git connection deploys the website automatically. An explicit release from this linked checkout is also available with `pnpm dlx vercel@59.14.0 --prod --scope diego-fernandes-projects`.
5. Verify one small simulation at the custom hostname and the corresponding Trigger Production run.

Environment values are held by the providers and the ignored, mode-0600 `.env.production.local`. Do not print or commit them. Retain the production capability key; changing it requires a deliberate migration strategy for existing reports. `.vercelignore` excludes `.env*`, local cache, and worker artifacts from web uploads.

The website and worker deploy separately. Automatic Trigger builds from GitHub are not configured for this first release; follow step 3 when changing worker code. Before introducing the planned paid tools, revisit Vercel Hobby's personal/non-commercial restrictions and the provider plans.

## Discord accounts and retained reports

Follow [authentication operations](authentication-operations.md) for direct migration configuration, retention-aware worker-first deployment, disabled-by-default enrollment/saving, exact Discord callbacks, rollback and the mandatory real-provider release gate. Saved nonempty reports have no automatic age-based expiry until explicit deletion. Preserve the existing `CAPABILITY_KEY` and all historic report capabilities. Production rollout remains blocked until real consent, cancellation, cross-device library access and deletion are verified on the configured origin.
