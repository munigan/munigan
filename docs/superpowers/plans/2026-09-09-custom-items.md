# Custom items implementation

Approved Paper: https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/G-0

Implement the batch picker, using existing Base UI dialogs/selects, item tooltips, gray table surfaces, and green selection controls. Search by name/ID, exact phase, min/max item level, source, and armor/weapon type. Slot context is fixed; paired slots share a group. Preserve checked candidates across filters. Add commits the batch, Close cancels it.

## Data and boundaries

Reuse the existing versioned catalog and pinned simulator. Poli93's `ui/core/proto_utils/database.ts` loads a static UI database; `ui/core/player.ts` filters eligible items by source, type, and faction. The local pinned checkout is `.cache/wotlk`, upstream https://github.com/Poli93/wotlk. No new live catalog dependency or simulator database override.

Custom inventory instances use a distinct `custom` source, zero initial enchants/gems, and stable IDs. Existing enhancement preparation applies user settings per tested combination. The imported equipped baseline is unchanged. Deduplicate catalog IDs already in inventory; permit at most 100 custom candidates in addition to the existing 217 imported inventory limit. Keep the existing simulation work allowance unchanged.

## Steps

1. Add domain tests for compatible catalog queries, combined filters, batch add/remove, duplicate protection, draft/server round trips, and enhanced simulation inputs.
2. Implement catalog browsing and candidate mutations as independent domain functions. Extend request validation to admit verified custom instances and reject ineligible/forged candidates.
3. Build composed picker filters/results/rows/footer. Limit rendered results with incremental loading, retain selection across filters, support mobile and keyboard focus.
4. Add entry rows and Custom badges/removal to inventory. Reuse saved drafts and selection updates. Surface invalid custom candidates after settings changes so they can be removed.
5. Verify unit, type, lint and browser flows: batch addition, owned items, filters, cancellation, restoration, removal, request payload, mobile scroll/focus and existing selection regression.

## Acceptance

- Every slot group has an Add custom item entry, including empty groups when expanded.
- Desktop and mobile match approved Paper structure; only results scroll on normal dialog heights.
- Item icons/tooltips and class-appropriate stat columns use the current item version.
- Adding/removing updates selected sets and draft without changing equipped references.
- Search/filter interactions do not schedule simulation work or fetch catalog items.
- Invalid custom items cannot bypass server admission.

## Completed verification

- 43 equipment/request domain tests and 2 real native simulator tests pass. Original and Classic candidates include automatic gem/enchant overrides without mutating their equipped baseline.
- 3 new browser tests and 6 selection/draft regression tests pass. Covered phase/source/armor/name/ID filters, batch selection across empty results, owned-item exclusion, cancellation/focus return, mobile layout, add/remove, draft restore and intercepted job submission.
- Type checking and targeted ESLint pass. Desktop/mobile screenshots reviewed against the Paper layout; corrected responsive controls and remove-icon sizing.
- Independent code review found no blocking issues. Added coverage for profession ranks, real opposite-faction admission, unsupported item data, and 100/101 custom-candidate limits.
- Catalog filtering is local and uses the existing 8,043-item pinned database; result rendering starts at 60 items with incremental loading. Actual catalog availability is constrained by version and verified equipment rules.
