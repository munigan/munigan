# Per-item gems and enchants

Status: approved with row interaction adjustments; implemented in the web app on 2026-09-10.

Paper: https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/J-0

## Screens

1. Equipment rows: resolved gem/enchant previews, including automatic values, with a concise override summary.
2. Gem editor: item/socket navigation on the left, searchable single-choice results on the right.
3. Enchant editor: the same shell with compatible enchant choices and optional unavailable results.
4. Validation states: an affected gear combination, targeted recovery actions, and profession restrictions.
5. Mobile: full-screen editor, compact socket navigation, scrolling results and sticky actions.

These are stages of one proposed experience, not competing visual variations. Match the approved custom-item picker: Inter, 24px desktop padding, 16px mobile padding, existing surface/border/action tokens, 8px dialog radius, 4px controls, and an X close action. Enchant choices use WoW catalog artwork, preferring formula/item icons; gems use the existing catalog art. Example item data is Fleshrending Gauntlets (50037), item level 264, yellow/red sockets and +6 Strength socket bonus. The extra socket in the example comes from Blacksmithing.

## Entry and editing

- Clicking the row opens editing for equipped, bag and custom candidates. Only the selection checkbox checks/unchecks the item. There is no Customize button. Item-name hover continues to show the tooltip.
- The row action opens the first socket, or Enchant when the item has no sockets. Socket/gem and enchant icons are direct shortcuts into their corresponding editor section, with accessible names.
- The item identity and source remain visible. Each socket and the enchant has its own Automatic or Manual state.
- Automatic follows the existing sidebar preparation rules, including preservation of imported enhancements where those rules preserve them. Its displayed value is a preview, not a guarantee of a particular automatic gem in every combination: set-level meta/JC handling can adapt automatic sockets.
- Choosing a gem/enchant makes that field manual. An explicit empty socket or No enchant also counts as a manual choice and cannot be filled automatically.
- Manual choices take precedence over sidebar settings. Resetting a field to Automatic or resetting the whole item returns to the existing preparation behavior; it does not erase the imported reference.
- Switching sockets retains all unsaved edits. Apply changes saves all edits on this item at once; Cancel, X and Escape discard pending edits. Keep the interaction consistent with the custom-item picker and return focus to the initiating control.
- The edited candidate participates in tested combinations. The original imported equipped reference remains intact, including when the edited candidate came from Equipped. Candidate/reference identity must account for enhancement-only changes in preparation, work keys, persisted reports and simulation input.
- The first version edits one configuration per physical item candidate; it does not create multiple enhancement variants automatically.

## Finding enhancements

- Search by name, item ID where applicable, or stat terminology; show gem icons and stat descriptions.
- Restrict meta sockets to meta gems and ordinary sockets to non-meta gems. For ordinary sockets, different colors remain selectable. An optional Match socket color filter narrows choices for the bonus.
- Display socket bonus active/inactive state with its stat amount. A legal color mismatch can disable the bonus without becoming an error.
- Rank relevant stats for the character/spec using the existing picker approach. Do not label this ordering as simulated DPS.
- Hide enchant previews, navigation and title references entirely for item types without enchant support. Items without sockets or enchant options do not open an empty editor.
- Filter enchants by item slot, weapon/hand type, class and profession eligibility. Include applicable class-specific choices such as runeforges. Ordinary enchants do not require the wearer to be an enchanter.
- Hide unavailable choices by default. Show unavailable reveals disabled options with readable requirements; it never makes them selectable.
- Empty search state: “No matching gems” or “No matching enchants,” plus Clear search. Keep pending choices and the footer intact.
- On mobile, the socket strip replaces the left column. Keep search and the current socket context visible while browsing the results. The full list, including Automatic and empty choices, remains available by scrolling.

## Validation and recovery

Separate item errors from equipment-set restrictions. Do not total gems across mutually exclusive candidates in the pool.

- Item-level errors: incompatible enchant, wrong meta/non-meta socket, missing profession or rank, or an unavailable profession socket. Block applying a newly invalid choice and put a readable reason beside it.
- Ring enchants require Enchanting. Blacksmithing's wrist/hand sockets require the appropriate profession/rank (400 in current rules). Belt buckles are a separate source of an extra socket, not a Blacksmithing-only perk for the wearer. Engineering enhancements have their own requirements.
- If a required profession level is unknown, explain what needs verification instead of claiming the requirement has been met. If profession/settings changes invalidate an existing override, retain it visibly as an issue and link to a fix; do not silently delete it.
- Jewelcrafting: reserve room for manually chosen Dragon's Eyes first. Automatic sockets may adapt around them. More than three manually fixed JC gems in one actual set makes that set invalid, not the entire pool.
- Show a warning with the number of excluded combinations and let the user inspect an affected set. Affected items offer Edit item and Reset item actions. Reset item releases all its overrides and recomputes conflicts; editing allows returning only an individual field to Automatic. Explain that this changes the candidate wherever it is used.
- Skip invalid combinations while clearly displaying the number of valid sets in the run action. If none remain, disable running and link to the first conflict. Counts in the Paper examples are illustrative.
- Enforce unique-gem limits, such as Nightmare Tear, across each complete set as well.
- Meta activation is evaluated per set. Automatic sockets can try to satisfy it around fixed choices. An inactive meta is a warning about a lost effect, not an illegal socket or automatically invalid gear set. Respect intentional overrides and make the inactive effect visible in the results.
- Pair color with words and symbols; do not rely on green/red alone. Use subtle keyboard focus, accessible radio/checkbox semantics, and readable disabled explanations.

## Reference and review

The interaction was informed by [Poli93's gear picker](https://github.com/Poli93/wotlk/blob/master/ui/core/components/gear_picker.tsx), which has a separate enchant tab and per-socket gem tabs. The local pinned source and existing `gemming.ts`, `sockets.ts`, and `validate.ts` informed the proposal's distinction between item and set rules. Exact profession/rank and item restrictions should continue to come from the versioned catalog/rule data, not presentation text.

The design preserves the app's batch-apply interaction rather than adopting the simulator's immediate equip behavior. Screens were reviewed in Paper for type hierarchy, contrast, aligned result rows and controls, and desktop/mobile fit. Paper was updated to reflect the approved row shortcuts and SVG checkbox icons. The app uses Base UI checkbox controls with SVG indicators. No production deployment is part of this implementation.


## Verification

- Row, editor and domain tests cover checkbox independence, targeted fields, automatic previews, explicit empty values, Apply/Cancel/reset, profession eligibility, unique/JC limits and imported-reference preservation.
- Browser checks cover custom-item compatibility, draft restoration, EN-US/PT-BR, focus return, desktop and mobile layout.
- Native simulator and worker/report regressions verify enhancement-only candidates retain a separate comparison against the imported reference.
- Automatic values are candidate previews: JC/meta preparation can adapt them for each complete set. Combination validation examines actual loadouts, with bounded checks for very large selections.
