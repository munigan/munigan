# WotLK gear optimizer and Droptimizer

Date: 2026-09-08

Status: Written product and architecture specification approved in conversation on 2026-09-08. The user requested two implementation plans: create and refine the design in Paper MCP first, then implement application code against the approved design. No application implementation has started.

## 1. Product and scope

Build a public website for Warmane-compatible World of Warcraft 3.3.5a DPS optimization using Poli93's WotLK simulator CLI. Onyxia is the initial use case; realm is not a product setting or a simulation dependency. Users select content, difficulty, and encounter settings directly.

The first public release covers every DPS specialization supported by the pinned simulator. Tank survival and healing optimization are outside scope. A supported-spec manifest must distinguish variants within a class and map each to its importer, presets, CLI configuration, and validation fixtures. Do not advertise unvalidated variants as supported.

Three tools share the same character, inventory, simulation, and equipment rules:

- **Top Gear:** find the highest simulated DPS among legal combinations of selected owned items.
- **Boss Droptimizer:** rank eligible drops from one boss by their value when combined with selected owned items.
- **Raid Droptimizer:** apply the same evaluation across a selected raid and difficulty, with item ranking and boss grouping.

All three are initially free and anonymous. Raid Droptimizer will require an account and paid access when billing is introduced later. Free tools must remain usable without sign-in.

Deferred: billing, mandatory accounts, automatic gem/enchant optimization, cap-preserving optimization constraints, plans requiring multiple future drops, talent optimization, Armory integration, and additional standalone simulation tools. Bank scanning is not a launch requirement; equipped gear and carried bags are.

## 2. Imported character and simulator presets

Prefer the existing 3.3.5 exporter over a new addon. Poli93's exporter has separate character and bag outputs. Accept both, and also accept supported full Poli93 simulator JSON/profile links. Explain the two-paste workflow inline.

Preserve all supported exported information: class, race, talents, glyphs, professions, equipped items, bag items, individual gems and enchants, and applicable character/spec options. Preserve full simulator settings when supplied by a simulator profile. Read character identifiers for display only; realm never changes mechanics. Reject incompatible expansion data rather than interpreting it as Wrath.

Use simulator presets and defaults from the exact same source version as the worker binary. Expose compatible choices for rotations, talents, consumes, buffs/debuffs, encounter settings, and spec options where upstream defines them. Do not invent a universal preset shared across classes. Resolve automatic rotation selection with the same rules as the pinned upstream version.

On initial import, supplied supported values take precedence over defaults. Missing values use the chosen compatible preset. Subsequent explicit edits override either. Distinguish missing values from explicit false, zero, empty sockets, or unenchanted items. A new character import replaces the character snapshot; reconciling retained encounter settings is explicit. Changing a preset only changes its displayed setting category and never silently replaces imported talents, professions, or inventory.

Show an import summary identifying imported values, preset values, and unresolved fields. Do not silently discard unknown item IDs or invalid gems/enchants. Invalid equipped items block submission until corrected. Unsupported bag entries remain visible with reasons and require acknowledgment before exclusion. Spec ambiguity requires selection before submission.

Bag input belongs to the current character snapshot and is replaced on reimport, not blindly appended. Keep legitimate duplicate copies, including items with different enhancements, while preventing a repeated paste from multiplying inventory. Gear from simulator presets is illustrative and never becomes owned inventory automatically. Simulator profiles lacking bags show an explicit equipped-only inventory state.

The existing addon code scans bags 0–4 and exports glyph names. Confirm actual in-game output, locale handling, duplicate counts, and item-cache behavior with fixtures. Do not claim bank, token, or currency coverage merely because bag gear export exists. Where redemption resources are missing, permit explicit user entry; unknown resources do not satisfy prerequisites.

## 3. Comparison semantics

Let C be currently equipped gear and O the legal equipment combinations using selected owned items and locks. The currently equipped set must remain available as a reference. For a fixed simulation configuration S:

- B is the best simulated owned combination found in O.
- Top Gear gain is DPS(B, S) minus DPS(C, S).
- For an obtainable drop d, B(d) is the best combination found using O plus one copy of d.
- Drop gain is DPS(B(d), S) minus DPS(B, S).

Percentage gain is 100 times the absolute gain divided by that tool's reference DPS (C for Top Gear, B for drops). If reference DPS is zero, show the absolute result and an unavailable percentage rather than dividing by zero.

Baseline optimization must use the same selected inventory and constraints as every candidate. Always include B among the allowed outcomes for each drop: acquiring an optional item cannot remove existing choices. A drop with no useful outcome is reported as no improvement, not as a negative acquisition value. The gain from simply rearranging owned items belongs to Top Gear, never to the drop.

Freeze talents, glyphs, professions, race, buffs, consumes, encounter, rotation configuration, and spec options for the entire job. An automatic rotation policy may resolve differently with equipment only where this matches upstream behavior; record that policy in the report. No automatic talent or consumable search.

Evaluate one new drop independently at a time. Never sum gains to predict a complete future set. Do not accidentally put all raid drops into a single owned-gear candidate pool. If candidate exploration discovers a better owned baseline, update and re-evaluate affected comparisons before final publication; provisional rankings are labeled provisional.

Top Gear defaults to imported equipped and bag items selected, with controls to narrow the search and lock equipped slots. Locks and exclusions are visible in setup and reports. Oversized requests require reducing selection before admission; no silent deletion of potentially useful items based solely on item level, armor class, or static stat weights.

### Equipment validity

Track item instances and quantities, slot eligibility, class/spec/profession restrictions, unique-equipped categories, weapon handedness, dual-wield rules, sockets, enhancement legality, and set membership. Apply Warmane-compatible 3.3.5 rules from validated data. Include lower armor types when legally usable; conventional best-in-slot assumptions must not exclude a valid DPS candidate.

Try legal paired-slot placements. Do not collapse ring, weapon, or trinket permutations until equivalence is demonstrated for the simulator and rotation, since slot order can affect effects. A one-handed drop can combine with an owned off-hand; one new drop does not grant its missing partner.

### Gems, enchants, and caps

Owned items retain their existing enhancements, including empty sockets and missing enchants. New loot receives a user-selected deterministic gem/enchant setup, previewed per item before submission. There is no search over enhancement variants in this release. Resolve socket counts, meta requirements, and profession restrictions across the resulting set. Invalid enhancements cannot be simulated as legal; legal but inactive bonuses must be represented faithfully and disclosed.

Report relevant hit/expertise and set-bonus changes using the actual character and encounter context. Do not treat a universal cap as a mandatory constraint. DPS is the objective; automatic compensation through owned equipment is permitted. Future enhancement optimization can add a separate adjusted result with explicit changes and optional cap constraints.

## 4. Loot catalog and tier tokens

Maintain a versioned catalog of raid, size, difficulty, boss, item, and acquisition data independently from simulation mechanics. Support WotLK raid content present in the simulator through verified mappings. Only expose raid/difficulty combinations with complete reviewed loot tables; launch coverage must be listed and checked explicitly rather than inferred from item presence. Boss selection specifies loot source, not a promise to reproduce that boss's encounter mechanics.

Use upstream item identifiers and reuse source metadata where adequate. Audit actual boss mappings, difficulty variants, faction variants, set membership, and token requirements. Fill verified gaps in our catalog. Keep acquisition metadata separate from combat item definitions and document provenance. No runtime scraping dependency for routine simulations.

A token is an acquisition opportunity with alternative legal redemption recipes. Each recipe records output, quantity, eligible class, prerequisite item instances, and required currencies/resources. Simulate each reward with the user's owned gear. Rank a token by its strongest immediately feasible redemption, with alternatives expandable. Set bonuses are calculated on the resulting full set.

Consume prerequisite items/resources when the recipe requires it. A consumed lower-tier item cannot remain available in the same candidate set. One token grants only one redemption, not all alternatives. Identical reward simulations may be reused while preserving their different acquisition sources.

If prerequisites are missing or unknown, label the reward as requiring additional resources and exclude it from immediately usable rankings. A conditional preview may still show its simulated outcome, clearly separate from actionable upgrades. Include already-owned redemption resources only if exported reliably or explicitly entered. Unknown state is never treated as owned.

Do not copy retail personal-loot expected-value or bonus-roll priority metrics. The initial ranking is by DPS benefit, with optional boss grouping and best available drop per boss; it makes no claim about drop probability, winning loot, or time to acquire it.

## 5. Raidbots reference and proposed experience

### Evidence collected

On 2026-09-08, inspected the live Raidbots landing page, Top Gear, and Droptimizer in the browser. Used synthetic retail character/equipment input solely to reveal setup controls. Inspected source selection, raid difficulty, item-slot/boss grouping, candidate items, imported equipment, quick navigation, enhancement controls, and validation states. No simulation, purchase, account creation, or setup-sharing submission was made. The synthetic character lacked valid talents; its simulation eligibility is not evidence of actual simulator behavior.

Live observations: tool tabs share imported character context; input becomes a character summary; gear is grouped by equipment slot; Droptimizer lets users group items by slot or boss and include/exclude candidates; advanced settings expand inline; a persistent action area keeps the run control visible. The live page describes comparisons against equipped gear. Official support documentation describes one-item replacements and separately explains result grouping and sidegrades. Completed reports and queue behavior were researched through documentation, not tested live.

### Interaction design

Retain the recognizable journey: **Import → Select gear or loot → Review setup → Simulate → Compare**. Three tool tabs share the current character and setup without losing work. The import step offers character export, bag export, and full simulator profile modes, with concise instructions. After import, collapse the large text field into a compact character summary with an Edit import action.

Use a two-column desktop workspace: the main column contains item selection or results; a narrower persistent summary shows character/spec, encounter preset, inventory coverage, selection count, enhancement assumptions, search estimate, and the primary action. Mobile uses one column and a compact bottom action area that does not cover content or keyboard focus.

Top Gear uses slot groups with readable item names, icon, item level, Equipped/Bag source, enhancement summary, explicit selection, and lock state. Paired slots show quantity and placement clearly. Provide select-all/clear controls scoped to a group and a selected-items filter. Do not import retail upgrade currencies, catalysts, talent-search panels, or unused controls.

Droptimizer starts with raid, supported size/difficulty, and boss or entire raid selection. Show item eligibility and redemption requirements before submission. Provide item/boss grouping, source labels, and inclusion controls. Excluding items changes the report's stated coverage; a partial selection is never labeled a complete raid assessment.

Results lead with the baseline and the player's next decision. Top Gear shows current versus recommended equipment. Drop rankings show item/token, source, absolute and percentage gain, resulting DPS, and uncertainty status. Expand a result to show every required swap, enhancements on the new item, prerequisite consumption, and stat/set changes. Show the complete recommended set in details. Use text and aligned bars to compare gains; keep exact values accessible.

Surface provisional, complete, failed, canceled, expired, and limited-search states distinctly. Users can leave and revisit an unguessable report URL. Progress reports actual completed work and phases (baseline, comparisons, refinement), avoiding invented queue positions or overly precise finish times.

### Visual direction and acceptance

Proposed direction: restrained WotLK-inspired dark surfaces, icy blue/cyan accents for actions and selection, warm restrained highlights for major gains, and class/item colors for identity. Use an original layout and typography hierarchy. Item imagery supports recognition, while text remains readable without tooltips. Upstream brand assets are not the product identity.

Better design means measurable usability: key character and baseline context stays visible, primary actions are consistent, errors sit beside the relevant input, advanced settings are progressively disclosed, and source/selection state is never conveyed only by color. Keyboard access, visible focus, labeled controls, responsive layouts, sufficient contrast, reduced-motion support, and screen-reader progress announcements are acceptance criteria. Long names must be readable on demand without relying on hover.

No finished visual mockup has been approved. Create the visual design in Paper MCP, refine it with the user, and record approval of the final handoff before starting application coding. The design implementation plan precedes the code implementation plan; the code plan references the approved Paper screens, tokens, and interaction specifications.

## 6. Architecture and contracts

Use the application for validation, request admission, access policy, lightweight catalog delivery, and presentation. Run expensive candidate generation, simulation, and aggregation on Trigger.dev managed infrastructure. The web framework and database provider are implementation-plan selections; neither may change these boundaries or introduce a login requirement for free tools.

| Module | Input/output and responsibility |
| --- | --- |
| Import adapter | Export text/profile → normalized snapshot plus diagnostics; depends on format and simulator schemas |
| Preset catalog | Spec/version → named presets and defaults; depends on pinned upstream settings |
| Equipment rules | Inventory, constraints, acquisition recipe → legal combinations; independent of hosting |
| Loot catalog | Raid/difficulty/boss/class → eligible acquisitions and provenance; independent of realm |
| Comparison planner | Frozen request → baseline and independent candidate work; applies equipment rules |
| Simulator adapter | Canonical sim input → structured DPS/stat/error output; encapsulates CLI details |
| Task orchestration | Work units → durable progress, retries, and final report; depends on Trigger.dev |
| Access/admission policy | Caller/tool/estimated workload → allowed request and reserved budget; no simulation logic |
| Report store/presenter | Results and provenance → immutable report and user-facing views |

Core records: CharacterSnapshot, ItemInstance, SimulationSettings, AcquisitionRecipe, ComparisonRequest, WorkUnit, SimulationResult, Report. Each request includes engine, schema, preset, catalog, and optimizer versions; inventory identity, selected items/locks, enhancement choices, encounter and rotation configuration, and search budget. Never trust client-supplied item stats, entitlement, or execution cost.

Store profiles locally in the browser for anonymous convenience. Store immutable job inputs and reports durably in application-controlled storage. Reports must not depend on Trigger.dev log retention. Keep raw exports out of routine logs. Report links grant read access only; a separate anonymous capability authorizes cancellation or management. Records are not publicly indexed. Display configurable report expiry when creating a report; expired links give an explicit state.

Reuse simulation results only when canonical effective inputs and relevant versions match, including enhancements, slots, seed policy, and precision. Exclude display-only names from internal computational identity, but never expose another user's profile or report through cache reuse. Reimport or configuration changes create a new snapshot rather than rewriting existing reports.

## 7. Trigger.dev execution and cost control

Package a pinned Linux CLI binary in the task image. Invoke it as a controlled subprocess with generated input files and bounded output. Keep the application and simulator adapter independent enough to move execution later without redesigning the product.

A coordinating job resolves the snapshot, calculates the owned baseline, dispatches candidate work, and assembles the report. Every CPU-consuming work unit uses an explicit shared global simulation queue and concurrency cap. Child tasks do not inherit queue limits automatically; queue configuration must enforce the cap across Top Gear, boss, and raid workloads. Limit subprocess CPU parallelism and memory to the chosen machine resources. Do not launch unbounded local processes within a task.

Keep orchestration lightweight. Partition simulations by bounded baseline/candidate work rather than creating a task for each Monte Carlo iteration. Persist completed work and reuse it across retries. If the baseline cannot be established, dependent comparisons do not produce a final ranking. Candidate failure produces a partial report with an explicit retry path, not a false zero-gain result.

Submission is server-side and idempotent. Atomically reserve work budget and admit a job; duplicate clicks do not schedule duplicate simulations. Anonymous session limits and IP-based throttling provide practical controls without pretending to identify a person reliably. Global admission limits and compute budgets remain necessary even when anonymous identifiers are reset.

Fixed concurrency is not fixed spending. Bound admitted search work, run duration, queued-job lifetime, attempts, and total outstanding work. Use spending alerts and a global admission stop. Set exact operating limits from representative per-spec benchmarks before public launch, not from speculative promises. A configuration with missing production limits must fail closed for new jobs. Validation failures are not retried; transient execution failures get a small bounded retry budget. Cancellation terminates active subprocesses and suppresses pending work.

The existing bulk CLI emits simplified CSV-like names/slots/DPS output, insufficient for all report contracts. Validate the underlying bulk engine's legal-combination behavior and detailed APIs. Preserve existing mechanics while exposing structured IDs, configurations, counts, statistics, and errors through a small CLI extension if necessary; alternatively re-simulate finalists with the CLI's detailed single-simulation path. This compatibility decision is a required early engineering validation, not an assumption of current capability.

## 8. Search quality and numerical reporting

Use direct simulations to rank candidates. Upstream fast mode is a candidate for staged refinement, not proof of a global optimum. For manageable searches enumerate all legal selected combinations; larger supported searches may use an explicitly labeled bounded search. If a request cannot run within a declared budget, ask the user to reduce selection before queuing. No hidden substitution of static stat-weight estimates for final DPS results.

Carry the best owned set into each candidate evaluation, preserve promising alternatives through refinement, and re-simulate finalists and baseline at comparable precision. Record tested/estimated combination counts, iterations, seed policy, search strategy, exclusions, and termination reason. Exact numeric values can be sorted while results within uncertainty are marked effectively tied; prefer fewer changes among such alternatives without falsifying their measured values.

Distinguish per-iteration DPS standard deviation from uncertainty of the mean. Finalists need suitable output to calculate and validate uncertainty. Independent validation runs can estimate comparison uncertainty from their mean standard errors; paired-seed methods require actual paired-difference variance. Do not claim precision from a fixed percentage copied from Raidbots. A report whose uncertainty cannot be evaluated must say so, and cannot claim a decisive tiny improvement.

Reports say "best combination found" unless candidate coverage and search completion justify a stronger statement. Even exhaustive candidate enumeration produces a simulated estimate, not a guarantee of real-fight DPS. A work budget interruption does not silently become a completed exhaustive search.

## 9. Future paid access

Keep Top Gear, Boss Droptimizer, and Raid Droptimizer as distinct server-side capabilities sharing the engine. At launch all are granted anonymously, subject to workload limits. Record usage independently of billing. No subscription provider, checkout UI, or mandatory account flow is needed now.

Later, the raid capability can require authenticated paid access before job creation. Store the admission decision with the job so accepted work has stable policy. Price/limit decisions must account for repeated free boss requests covering a raid; do not assume a raid paywall eliminates equivalent aggregate compute through free tools. Pricing, entitlements beyond raid access, paid queue priority, and treatment of historical reports are future product decisions, not implemented scope.

## 10. Validation and delivery boundaries

Implement in dependency order, with independently reviewable milestones:

1. **Import and simulation foundation:** exporter fixtures, supported-spec/preset manifest, canonical snapshots, CLI compatibility, Trigger.dev execution, detailed result extraction, and benchmarks.
2. **Owned-gear optimization:** legal equipment generation, inventory quantities, constraints, staged search, baseline/refinement, and Top Gear reports.
3. **Loot comparisons:** audited raid catalogs, recipes/tokens, independent drop evaluation, boss and raid reports, resumable orchestration.
4. **Public release experience:** reference-informed UI, anonymous report access, progress/error states, quotas/budget admission, accessibility, and end-to-end validation.

The implementation plan must give each milestone bounded tasks and verification gates. Broad addon rewrites, simulator mechanic changes, and a separate billing subsystem remain outside this specification unless the user expands the scope.

Required evidence before launch:

- Round-trip character and bag fixtures preserve enhancements, active talents/glyphs, professions, empty slots, duplicate copies, and locale limitations without silently dropping data.
- A representative fixture for every supported DPS specialization matches the pinned simulator's equivalent configuration within measured uncertainty. Include pets, dual wield, two-handed/off-hand transitions, and spec-specific options.
- Equipment tests cover unique restrictions, item counts, paired slots, enhancement legality, meta activation, profession restrictions, and tier thresholds.
- Token tests cover alternatives, class/difficulty eligibility, insufficient resources, consumed prerequisites, and a single redemption per token.
- A targeted example proves a drop becomes useful through an owned hit/expertise compensating swap; another proves baseline rearrangement gain is not credited to a drop.
- Search tests demonstrate exhaustive coverage on a small known inventory, honest labeling of bounded search, and sensible near-tie reporting.
- Orchestration tests cover shared concurrency across child tasks, idempotency, budget reservation, cancellation, retry without repeating completed work, partial failure, and stale queued jobs.
- Cache tests invalidate on mechanically meaningful settings/version changes and prevent report/profile disclosure across anonymous users.
- Public-flow tests cover anonymous import → selection → report for all three tools, refresh/revisit, expired reports, unavailable catalog entries, and denial before task dispatch when future entitlement policy is exercised in a test.
- Desktop/mobile and keyboard review confirms readable item names, visible source/selection/lock state, unobscured primary actions, and clear baseline/required-swap reporting.

## 11. Sources and research boundaries

Remote heads observed on 2026-09-08, to be used as initial compatibility candidates rather than silently tracking latest:

- Poli93/wotlk master: `563e4a08cb15729f1fdcbcf68e6d68224553bfef`.
- Poli93/wowsimsexporter-wotlk-335 main: `e69635092425bf4beadca22570fc7b975a73c95e`.

Primary references:

- [Poli93 live simulator](https://poli93.github.io/wotlk/) — explicitly targets Warmane 3.3.5a.
- [Simulator source](https://github.com/Poli93/wotlk) and [bulk CLI](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/cmd/wowsimcli/cmd/bulk_replace.go).
- [Simulation schema](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/proto/api.proto), [importers](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/ui/core/components/importers.ts), and [example presets](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/ui/rogue/presets.ts).
- [3.3.5 exporter](https://github.com/Poli93/wowsimsexporter-wotlk-335) and [export implementation](https://github.com/Poli93/wowsimsexporter-wotlk-335/blob/e69635092425bf4beadca22570fc7b975a73c95e/WowSimsExporter/WowSimsExporter.lua).
- [Raidbots Top Gear](https://www.raidbots.com/simbot/topgear) and [Droptimizer](https://www.raidbots.com/simbot/droptimizer) — live setup inspection described above.
- [Droptimizer behavior](https://support.raidbots.com/article/59-droptimizer-how-does-it-work) — documented one-drop comparisons and report grouping; dated documentation is not evidence of every current feature.
- [Top Gear sidegrades](https://support.raidbots.com/article/61-top-gear-sidegrades) — reporting inspiration, not a statistical threshold to copy.
- [Trigger.dev build extensions](https://trigger.dev/docs/config/extensions/overview), [queues](https://trigger.dev/docs/queue-concurrency), [max duration](https://trigger.dev/docs/runs/max-duration), and [pricing](https://trigger.dev/pricing).

No in-game exporter validation, CLI build, performance benchmark, full loot audit, or Trigger.dev deployment was performed during brainstorming. These are explicit engineering gates above. Retain required upstream license notices and user-visible simulator attribution when reusing code/data; inspect each additional asset/data source's terms before incorporating it.
