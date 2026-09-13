# Task 2 report: atomic Gear Lab commands

## Result

Extended the vanilla Gear Lab store with the domain editing commands from the
task brief. Each action reads the latest draft and publishes at most one state
update. Resource modal saves validate the complete result before Zustand
publishes it, settings saves merge their owned profile fields into the latest
snapshot, and eligibility revalidation is limited to inventory, item-version,
and profile changes.

The store preserves physical instance IDs when toggling owned gear, delegates
purchase/custom/enhancement edits to the existing domain functions, validates
class-specific gear variants, normalizes sparse enhancement comparisons, and
retains state identity for equal edits.

## TDD evidence

Red command:

```text
pnpm vitest run --project unit src/features/inventory/state/gear-lab-store.test.ts
Test Files  1 failed (1)
Tests       10 failed | 4 passed (14)
```

The failures were the expected missing-action failures, including
`toggleItem is not a function`, `setResourceQuantity is not a function`, and
`saveResource is not a function`.

Green verification:

```text
pnpm vitest run --project unit src/features/inventory/state/gear-lab-store.test.ts \
  src/domain/purchases/state.test.ts \
  src/domain/purchases/enhancements.test.ts \
  src/domain/equipment/custom-items.test.ts \
  src/domain/equipment/item-enhancements.test.ts
Test Files  5 passed (5)
Tests       54 passed (54)

pnpm typecheck
tsc --noEmit
exit 0
```

No browser, build, harness, or worker command was run.

## Review fixes

Added regression coverage for replacing the only resource while purchase
exclusions and enhancement overrides exist. The red run showed those choices
were reset to empty objects. `saveResource` now validates the variant, writes
the new balance, and only then removes the prior balance, so the purchase input
object remains present throughout the atomic computation.

Added regression coverage for catalog repair after both item-version and
settings/profile changes. The red run showed `purchases` had already been
removed by implicit repair. Those edits now preserve the purchase catalog
revision and stale choices; the explicit `revalidatePurchases()` command owns
repair and returns `[9999998, 9999999]` or `[9999998]` for the existing notice.

Review red command:

```text
pnpm vitest run --project unit src/features/inventory/state/gear-lab-store.test.ts
Test Files  1 failed (1)
Tests       3 failed | 14 passed (17)
```

Focused green command:

```text
pnpm vitest run --project unit src/features/inventory/state/gear-lab-store.test.ts
Test Files  1 passed (1)
Tests       17 passed (17)
```
