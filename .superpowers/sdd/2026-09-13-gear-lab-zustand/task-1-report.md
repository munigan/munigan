# Task 1 report: scoped Gear Lab store

## Result

- Added exact dependency `zustand@5.0.15`. Registry metadata declares React `>=18.0.0`; the project uses React `19.2.8`.
- Added a vanilla `createGearLabStore` factory. Every call creates an independent store with no browser API use.
- Added `replaceDraft`, which applies the existing Gear Lab draft defaults and unsupported bag-item normalization and increments the session epoch for replacement/reset.
- Added `setIterations`, which validates availability, finite range, and step alignment against the supplied `WorkPolicy`. A valid precision-only edit preserves snapshot, selection, purchases, actions, and epoch references; rejected and unchanged edits preserve the complete state reference.
- Added a client `GearLabProvider` with one lazily created store per mount, optional test injection, direct store access, selector subscriptions, and a clear missing-provider error.

## TDD evidence

The store suite was run before `gear-lab-store.ts` existed and failed with the expected `Cannot find module './gear-lab-store'`. After the minimal implementation it passed 4 tests.

The provider suite was then run before `GearLabProvider.tsx` existed and failed with the expected unresolved `./GearLabProvider` import. After the minimal implementation it passed 5 tests.

Final verification after formatting:

```text
pnpm exec vitest run --project unit src/features/inventory/state/gear-lab-store.test.ts
Test Files  1 passed (1)
Tests       4 passed (4)

pnpm exec vitest run --project ui src/features/inventory/state/GearLabProvider.test.tsx
Test Files  1 passed (1)
Tests       5 passed (5)

pnpm typecheck
tsc --noEmit (exit 0)
```

## Baseline context

The root-owned baseline in `.artifacts/gear-lab-zustand/baseline.md` used a reproducible React Profiler UI harness because a live browser profiler API was unavailable. Across five edits each, iteration changes caused one wallet and inventory commit, no worker post, and one draft write; checkbox and resource edits caused two wallet and inventory commits, one worker post, and one draft write. These are harness measurements rather than browser latency measurements.

## Concerns

- The provider's optional `store` prop is intended for tests and other existing Client Components. A vanilla store is not serializable and must not be passed across a Server-to-Client component boundary.
- This task establishes the scoped state layer only. Existing runtime UI remains on its prior local state until the later integration task.
