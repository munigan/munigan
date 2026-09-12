# Gear Lab: tokens and purchase planning

Status: implemented and verified on `codex/gear-lab-purchases`, September 12, 2026. This document retains the approved design and implementation decisions. See [verification and decisions](tokens-purchase-implementation.md).

## Outcome

A player enters the currencies and tier tokens they have. Gear Lab includes the compatible rewards and compares affordable complete gear sets alongside their selected inventory. The report explains which pieces to obtain, their upgrade prerequisites, the resources spent, and what remains.

For example, 100 Emblems of Frost and one heroic T9 Regalia allow the optimizer to compare one affordable T10 purchase together with one T9 redemption. It cannot equip several newly purchased T10 pieces whose combined Frost cost exceeds 100. A token is an upper limit on redemptions; the winning set may leave it unused.

## Design source

[Paper: 34 munigan.app · Tokens & purchase planning](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/10-0), inspected September 12, 2026. The corrected designs use the Add custom item dialog and current Gear Lab selection page as references.

| Board | Node | Implementation surface |
| --- | --- | --- |
| 01 · Gear Lab / Tokens and currencies | TZ1-0 | Wallet above existing slot groups; compact run summary |
| 02 · Add resource / Tier 10 | U4M-0 | T10 resource and quality choices, quantity |
| 03 · Add resource / Tier 9 | U6B-0 | T9 currency, Trophy, heroic Regalia choices |
| 04 · Purchasable gear / Costs and upgrade paths | U6C-0 | Eligible items, costs, prerequisites, exclusions |
| 05 · Results / Recommended purchase plan | UA6-0 | Purchase details for the selected result |
| 06 · Mobile / Tokens and currencies | UBU-0 | Responsive wallet and existing inventory |
| 07 · Mobile / Add a resource | UBV-0 | Full viewport resource dialog |
| 08 · Mobile / Purchase plan | UJC-0 | Purchase steps and remaining balances |
| 09 · Resource states / Prerequisites, editing and unused tokens | UJD-0 | Missing prerequisites, editing, zero spend |

Paper quantities, eligible-item counts, iteration counts, and DPS numbers are illustrations. Production values must come from the catalog, run policy, and simulation results.

## Global constraints

- Plan and implement within the existing Next.js 16.3.4, React 19.2.8, TypeScript 5.9.3, Base UI 1.8.0, Zod 4.5.4, and next-intl 4.14.2 stack; use Node 24.x and pnpm 10.33.0.
- Read the installed Next.js guides before writing framework code; do not upgrade dependencies for this feature.
- Support both `original` and `classic` item profiles and both `en-US` and `pt-BR` locales.
- Keep existing inventory selection, four slot filters, per-slot Add custom item, item enhancement editing, and full report gear/stat comparisons.
- Reuse shared Dialog, Button, and NumberInput components and the existing CSS tokens; do not introduce a separate visual theme.
- Enforce the current server WorkPolicy; do not increase simulation allowances or native simulator iterations to accommodate purchases.
- Treat entered balances as simulation inputs scoped to a draft, never as an account wallet or an actual purchase operation.
- Preserve legacy drafts, requests, and reports that have no purchase inputs.
- Keep reports reproducible using frozen purchase inputs, recipes, and acquisition details; never reprice a stored report from the current wallet.
- Do not let hypothetical custom items satisfy physical upgrade prerequisites or bypass purchase costs for tier rewards controlled by this planner.

## Scope

Ship T9 and T10 currency/token planning, purchasable-item inclusion and exclusion, cost-aware combination generation, purchase explanations, and draft/report restoration together. Cover all compatible tier set variants in the supported catalog, including alternative tank/healer variants that a supported character can equip. Prioritize relevant variants visually without silently removing legal choices.

The proposed first release does not include arbitrary manual item groups. That was the initial exploration before the token approach. Omit the mockup's Advanced item groups link until that separate feature exists. Also excluded: shopping transactions, automatic character resource imports, account-wide balances, non-tier vendor purchases, and native simulator changes.

## Resource model and purchase rules

The UI presents recognizable resources and the reward quality they unlock. Do not represent every quality as a generic, interchangeable “T10 token.” Currency and upgrade marks have different rules.

| Reward | Resources for a new piece | Required previous piece |
| --- | --- | --- |
| T9 232 | Triumph: 30 hands/shoulder; 50 head/chest/legs | None |
| T9 245 | 1 Trophy plus Triumph: 45 hands/shoulder; 75 head/chest/legs | None |
| T9 258 | 1 compatible heroic Regalia | None |
| T10 251 | Frost: 60 hands/shoulder; 95 head/chest/legs | None |
| T10 264 | 1 compatible normal Mark | Matching 251 piece |
| T10 277 | 1 compatible heroic Mark | Matching 264 piece |

These are the intended Wrath purchase rules. The implementation must verify every reward ID, vendor cost, and predecessor mapping against item/vendor evidence before committing the production manifest; the current app catalog does not contain a price graph. The tier overviews provide context, but are not sufficient evidence for every item: [T9 set overview](https://www.wowhead.com/wotlk/guide/raids/tier-9-sets-overview), [T10 set overview](https://www.wowhead.com/wotlk/guide/raids/tier-10-sets-overview).

Token families are Vanquisher (death knight, rogue, mage, druid), Protector (warrior, hunter, shaman), and Conqueror (paladin, priest, warlock). Regalia and normal/heroic Marks each retain their family. Class, faction, supported item profile, and equipment legality must all agree with the reward.

One Triumph balance is shared by both T9 currency tiers. Normal and heroic Marks have separate balances. Editing a resource replaces its balance; adding an existing resource opens its edit state. Quantities are nonnegative integers. Removing the final resource disables purchase planning and returns to the ordinary inventory-only workflow.

## Acquisition semantics

1. Build a plan for the entire final set. Sum its actual costs by resource, and require every total to be at most the entered balance. Do not optimize each token independently or add individual DPS gains.
2. Allow zero spend and unused balances. A lower tier, an owned alternative, or an existing set bonus may produce a better complete set than spending every token.
3. An imported equipped or bag item can satisfy an upgrade prerequisite even when it is not selected as final gear. Selection controls candidate equipment, not physical ownership.
4. A prerequisite is consumed once. It cannot also be equipped in the final set or reused for another purchase. Buying a prerequisite charges its currency before the upgrade token is charged. Intermediate pieces appear as purchase steps, not as extra equipped items.
5. Preserve the exact set variant and slot through an upgrade: a tank shoulder is not a DPS shoulder prerequisite. Do not infer relationships from an English item name or item level alone.
6. Explore alternate acquisition paths when a final item can use an owned prerequisite or a newly purchased one. Only discard a path when another uses no more of any resource and does not eliminate a distinct physical ownership option.
7. Simulate identical final gear once. Choose a deterministic affordable acquisition explanation for it; acquisition path differences do not change its DPS ranking.
8. Keep the current equipped baseline as a reference with zero purchase spend. Generated items use existing gem/enchant automation and explicit overrides. Consuming an old item does not automatically transfer its gems or enchant.
9. Missing prerequisites explain why an item cannot be obtained. They do not block unrelated affordable purchases.

Custom-item behavior: when purchase planning is active, selected custom items matching registered T9/T10 rewards become costed candidates. Preserve their enhancement intent, but do not retain a second free copy in the search. Other custom items keep their existing simulation behavior. Label these rows “Uses resources” so the change is visible. Disabling purchase planning restores the existing custom-item behavior. This prevents a manually added tier item from invalidating the meaning of an affordable result.

Equivalent-path tie-break: prefer a componentwise cheaper acquisition plan; for incomparable costs use a stable order that preserves heroic Marks, Regalia, normal Marks, Trophies, then Frost and Triumph, followed by consumed-instance and recipe IDs. This chooses an explanation for identical gear only. It does not rank different gear sets or imply a market value for resources.

## User flow and states

### Gear Lab

Place Tokens and currencies above the current inventory groups. Resource rows show icon, name, quality/context, quantity, edit, and remove. Add a resource opens a local draft dialog. Save applies all its inputs together; Cancel, Escape, and close discard only unsaved dialog edits and return focus to the trigger.

The wallet summary shows how many compatible purchases are included. Review purchasable gear exposes reward slots, item links, item levels, costs, exact upgrade paths, owned prerequisites, and reasons an option is unavailable. Selecting a resource includes individually attainable rewards by default; the joint optimizer still enforces the combined budget. Excluding a reward prevents that final item from being equipped, but does not prohibit buying it as an intermediate prerequisite. Explain that distinction in the exclusion helper text.

Retain exclusions and purchase enhancement overrides separately for each item profile. Recalculate after changes to balances, exclusions, inventory, equipment, enhancements, character settings, or profile. Do not enable comparison with a stale analysis result. A new character import clears resource inputs; changing settings or the profile for the same character preserves balances and revalidates candidates.

Use these distinct states: calculating, ready with exact feasible set count, no legal sets, allowance exceeded, search limit reached, and catalog revision changed. An incomplete search must not be labeled exhaustive or display its partial count as an upper bound. Explain how to reduce selected items or exclude rewards when the search limit is reached.

### Results

Keep the ranked combinations, full 17-slot set, baseline comparison, stats, and existing recommendation behavior. The purchase panel follows the selected row and shows ordered purchases/upgrades, consumed owned pieces, spent amounts, and remaining balances. Every row's numbers use the balances submitted with that run.

A selected owned-only set displays “No purchases needed” and all entered resources remaining. Partial reports retain their existing incomplete-coverage treatment; do not describe them as the proven best possible purchase plan. Selecting the equipped reference shows zero spend without implying the reference satisfies the user's candidate selections.

Edit in Gear Lab restores the original input inventory, wallet, exclusions, and overrides. Purchased candidates must not become owned items through report editing. Retry and resume use the frozen run plan. Viewing a result does not deduct balances from any draft.

### Visual and accessibility requirements

- Use `src/app/tokens.css`: canvas `#07080a`, surface `#17191d`, border `#25272c`, text `#f3f4f6`, muted `#a5a8af`, action/gain `#78e34d`, danger `#f58d88`. Paper's older generic blue tokens are not the app palette.
- Use Inter for body copy and Barlow Condensed for display headings. Desktop page titles are 52/52 bold; mobile 38px. Modal titles follow Add custom item: 24/30 desktop and 22/28 mobile.
- Panels use 8px radius; controls use 4px. Desktop resource dialog is 720px wide with 24px header/body padding. Row separators and selected row fill `#191c21` follow inventory selection.
- Reuse 44px standard controls, 44px close-button hit area, and 46px primary dialog action. Keep text labels for quality and resource state; color alone is insufficient.
- Preserve the flexible inventory column, 360px run sidebar, 32px gap, and current collapse at 900px. Keep the mobile slot filters in their existing 2×2 arrangement below 640px.
- On mobile the dialog fills the viewport, keeps header/actions reachable, and scrolls its fields. Short viewports and the software keyboard must not trap the Save button off screen.
- Maintain keyboard focus, visible focus styles, input labels, grouped quality choices, removal accessible names, and polite status announcements for settled recalculations.

## Persistence and trust boundaries

The request contains resource inputs, not client-authoritative prices, generated inventory, acquisition plans, or calculated allowances. The server rebuilds and validates those values using its catalog. Incoming `source: "purchase"` inventory is rejected.

Add a purchase schema version and recipe revision independent of the existing global snapshot version tuple. Legacy requests without the optional purchase block continue unchanged. A stale purchase draft retains its balances and user choices for revalidation, but cannot submit until it acknowledges the current recipe revision. Already admitted work uses its frozen data even after the catalog changes.

Existing job request, plan, and report JSONB fields can hold the new information. No SQL schema migration or account balance table is required. Keep generated purchase candidates out of user input inventory limits; apply explicit bounds to resource keys, quantities, exclusions, and overrides, and retain the existing search-node and simulation-unit limits.

## Acceptance cases

| ID | Case | Required result |
| --- | --- | --- |
| A1 | 100 Frost, one heroic Regalia | Every candidate obeys both balances; compatible T9 and T10 choices are optimized together |
| A2 | 120 Frost | Two 60-cost pieces may coexist; adding any further new piece cannot exceed the balance |
| A3 | One Regalia, many compatible rewards | At most one newly redeemed 258 item per final set |
| A4 | 60 Frost and one normal Mark | A matching 251 → 264 chain can be acquired; charge 60 Frost and one Mark |
| A5 | Owned matching 251 and one normal Mark | Upgrade costs one Mark and no Frost; owned piece is consumed once |
| A6 | Owned 251 and only a heroic Mark | 277 reward explains the missing normal Mark/264 prerequisite; unrelated items remain available |
| A7 | One normal and one heroic Mark, adequate Frost | Buy 251, upgrade to 264, then 277; each resource charged once |
| A8 | Tank prerequisite, DPS reward | Cross-variant upgrade rejected |
| A9 | Custom 251 item and one normal Mark, no Frost | Custom item does not count as an owned prerequisite |
| A10 | Zero-spend set wins | Show no purchases and unchanged balances; do not force token use |
| A11 | Profile switch and draft/report editing | Preserve profile-specific exclusions/overrides; never promote generated items to ownership |
| A12 | Same gear through multiple acquisition paths | One simulation, affordable deterministic explanation |
| A13 | Large raw product, small affordable set space | Admit based on feasible distinct simulations when bounded analysis completes |
| A14 | Search bound reached | Block submission with an explicit search-limit state; never claim exhaustive coverage |
| A15 | Forged generated items/costs, negative/fractional quantities | Reject at request admission before reservation |
| A16 | Desktop, 390px mobile, keyboard, Portuguese | Follow the existing modal/selection conventions and keep all actions usable |
| A17 | Wallet/catalog changes after report creation | Stored costs and balances remain unchanged; edit starts a separately revalidated draft |
| A18 | No purchase inputs | Existing selection, simulation keys, reports, and draft behavior remain unchanged |



### Implementation clarifications

- Purchase instances use the reserved `purchase-${profile}-${itemId}` namespace and are never accepted as original submitted inventory.
- Converted custom rewards retain original enhancement intent in the draft. Their effective generated instance may carry the custom raw gem baseline and sparse override so automatic gemming keeps its existing behavior; ordinary new rewards start empty. An explicit purchase override or empty reset marker suppresses inherited custom intent.
- Invalid purchase enhancements retain a structured profile/item identity so the editor can offer a targeted repair even if candidate preparation fails.
- An uncertain admission retains its original immutable request and idempotency key. Later wallet edits are a separate draft; recovery cannot silently submit a second run.
- Authorized retries retain frozen recipes and acquisition choices, but any new admission rechecks the current work allowance and iteration policy.

### Implementation acceptance evidence — September 12, 2026

The implemented flow is covered by `tests/e2e/purchases.spec.ts` and `tests/e2e/purchase-reports.spec.ts`. It uses the actual browser purchase worker, preserves original inventory through drafts/submission/report editing, and renders frozen per-row acquisition explanations. Native acceptance in `tests/integration/purchases-sim.test.ts` verifies both item profiles, final-only upgraded gear, explicit enhancements, and a real two-piece set threshold with identical native input to equivalent ordinary equipment. Shared Triumph exhaustion and two-token redemption are covered in `src/domain/purchases/acquisition.test.ts`; admission rejects forged prices/IDs and invalid quantities before reservation in `tests/integration/purchase-admission.test.ts`.

All nine approved surfaces were compared with their exported Paper JSX and the running application. The implementation retains the existing app header, typography, 17-slot comparison, stats and controls. Dialog measurements match the current custom picker: 24/30px desktop and 22/28px mobile titles, 24px/20px horizontal padding and 46px primary actions. The resource dialog uses its approved 720px desktop width and fills 390px mobile screens; at 390×440 its contents scroll to a fully reachable footer. Desktop, 900px breakpoint, mobile, keyboard, Escape/focus return and Portuguese wrapping were exercised.

Durable local evidence (ignored, not image baselines): [acceptance matrix and verification report](../../.artifacts/gear-lab-purchases/acceptance-report.md), [desktop purchase plan](../../.artifacts/gear-lab-purchases/board-05-plan-panel.png), [mobile purchase plan](../../.artifacts/gear-lab-purchases/board-08-plan-panel.png), [mobile resource footer](../../.artifacts/gear-lab-purchases/board-07-resource-short-footer.png), and [Portuguese wallet](../../.artifacts/gear-lab-purchases/portuguese-mobile.png). All required broad checks passed; results and limitations are recorded in [implementation verification](tokens-purchase-implementation.md).
