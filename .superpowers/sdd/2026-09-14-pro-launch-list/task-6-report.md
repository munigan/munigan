# Task 6 report

## Implemented

- Added a policy-derived combination-limit helper. The UI now distinguishes a real count excess from empty/invalid selections, unknown policy, readiness failures, and service errors.
- Rebuilt the sidebar as three surfaces: player identity, run configuration, and either the free action or the PRO prelaunch invitation.
- Added localized exact and upper-bound combination copy, including singular/plural forms and an explicit uncertainty message for upper bounds.
- Replaced the disclosure with a Base UI tooltip supporting hover, focus, touch toggle, and Escape dismissal.
- Kept iterations locked to the server policy value, aligned the slider/marks/labels with shared geometry, and added the `iterations_limit` PRO action after a blocked attempt.
- Added cancelable pre-OAuth draft/import preservation and a focus/scroll callback for Reduce selection that leaves the request untouched.

## TDD evidence

RED command:

`pnpm exec vitest run --project unit src/features/inventory/free-run-state.test.ts --project ui src/features/inventory/RunAllowance.test.tsx`

Expected failures: `free-run-state` did not exist; the 144-count UI had no Add credits action; upper-bound copy was absent; and a blocked iteration attempt had no See PRO action. Result: 2 test files failed, with 3 UI failures plus the missing helper module.

GREEN command:

`pnpm exec vitest run --project unit src/features/inventory/free-run-state.test.ts src/server/jobs/policy.test.ts --project ui src/features/inventory/RunAllowance.test.tsx src/features/inventory/TopGearApp.admission.test.tsx`

Result: 4 files passed, 26 tests passed. Output contained only Vitest timing/advisory information.

Additional verification:

- `pnpm typecheck` — passed.
- Scoped ESLint over all changed TypeScript/TSX files — passed with no output.
- `git diff --check` — passed with no output.
- Controller browser measurement: all six slider marker/label centers aligned exactly. Final end-to-end browser checks remain assigned to Task 7.

## Files changed

- `src/features/inventory/free-run-state.ts` and test
- `src/features/inventory/ProRunNotice.tsx`
- `src/features/inventory/RunSetup.tsx`
- `src/features/inventory/RunAllowance.tsx` and test
- `src/features/inventory/RunIterations.tsx`
- `src/features/inventory/TopGearApp.tsx` and admission test
- `src/features/inventory/InventorySelector.tsx`
- `src/features/inventory/inventory-design.css`
- `messages/en-US/inventory.json`
- `messages/pt-BR/inventory.json`

## Self-review

Re-read the brief against the diff. Server policy values and admission behavior remain unchanged; all PRO thresholds and explanatory numbers come from the loaded policy. Error precedence, upper-bound truthfulness, repeated iteration attempts, touch/keyboard tooltip use, storage failure cancellation, draft restoration, and focus-only reduction are covered. No remaining concern found.
