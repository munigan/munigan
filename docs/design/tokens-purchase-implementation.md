# Gear Lab purchases: implementation verification

Implemented on `codex/gear-lab-purchases` from `codex/top-gear` base `5173456`. The complete regression checkpoint was `6ddfaaa`; final presentation fixes are in `88138aa` and were rechecked as described below. No deployment, database schema migration, dependency upgrade, or simulation allowance change is included.

## Verification

All required commands completed successfully on September 12, 2026:

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed after review scratch cleanup; no source exclusions needed |
| `pnpm test` | 110 files, 832 tests passed |
| `pnpm test:integration` | 15 files, 145 tests passed |
| Native purchases/custom-items/item-enhancements files | 3 files, 6 tests passed |
| Browser purchases/purchase-reports/custom-items/item-enhancements/draft-restore/edit-report files | 18 tests passed |
| `pnpm check:design` | Passed; supplements visual comparison |
| `pnpm build` | Passed production compilation, TypeScript and static generation |
| `git diff --check` | Passed |

Total: **1,001 tests passed**. Commands ran with `env -u NO_COLOR` to avoid an inherited terminal-color warning. Plain `pnpm lint` initially found six errors only in temporary Paper JSX/browser review scripts under `.superpowers`; source lint passed with that scratch directory excluded. The unit suite retains its pre-existing jsdom navigation notice. No product lint rules were weakened.

Native verification used the existing full Warrior fixture and both item profiles, including final-only 251→264→277 acquisition, enhancements, a real two-piece set threshold, and input equivalence to ordinary gear. Browser verification used the real purchase-analysis worker. Database tests used isolated disposable schemas.

Local logs and the full A1–A18/nine-board evidence remain in [acceptance report](../../.artifacts/gear-lab-purchases/acceptance-report.md) and `../../.artifacts/gear-lab-purchases/final-*.log`. These ignored artifacts are local evidence, not committed screenshot baselines. Durable test definitions are in the repository.

## Limitations

- Short mobile layout was checked at 390×440 as a software-keyboard proxy; no physical phone keyboard was tested.
- Both item profiles use the specified Wrath purchase economy. Per-item original-era vendor evidence is documented in [tier purchase data](tier-purchase-data.md); an independent Classic vendor scrape was not performed.
- Existing server work/search limits still apply. Large searches explicitly ask the user to narrow selections rather than claim complete results.

## Implementation decisions

The following records every controller ruling, in chronological order, with its cost if wrong.

1. execute skill-requested focused subagents with explicit contracts, one implementer at a time — shared files and ordered dependencies make concurrent implementation inappropriate.

   Cost if wrong: Additional coordination time if sequential review is unnecessary.

2. create an isolated worktree under existing ignored .worktrees — authorized implementation and developer autonomy permit reversible setup without a separate confirmation.

   Cost if wrong: A separate local checkout must be retained or integrated at handoff.

3. treat missing generated modules as expected initial RED import failures, then retain behavior assertions for subsequent regression coverage.

   Cost if wrong: An import failure alone cannot prove behavior; later assertions remain necessary.

4. Task 9 acceptance tests may be green on first run; do not fabricate code changes to make finished behavior fail.

   Cost if wrong: Existing defects could be missed if acceptance assertions are weak; task review strengthened them.

5. replace temporary node_modules symlink with offline frozen-lockfile installation — Turbopack rejects out-of-root symlinks; no dependency versions changed. Browser baseline draft restore: 1 E2E passed in 14.3s; pre-existing FORCE_COLOR/NO_COLOR notice.

   Cost if wrong: Extra local disk use; lockfile and dependency versions remain unchanged.

6. use the specified common Wrath tier economy for both item profiles, backed by original-era per-item vendor evidence and identical supported tier catalog records — profiles change gear data, not the scope of the specified resource matrix. Keep the documented lack of independent Classic vendor scrape transparent; investigate any actual contradictory evidence.

   Cost if wrong: Classic-specific economy differences would require catalog correction; no independent Classic vendor scrape is claimed.

7. amend Task 5 to classify new purchase 422 diagnostics as definitive only for the initial admission attempt — otherwise the UI would incorrectly enter unresolved-network recovery after a known budget rejection. Add admission-attempt.ts/test to its file scope.

   Cost if wrong: Incorrect recovery classification could abandon a real admission; the uncertainty guard remains separately tested.

8. correct Task 7’s ambiguous instruction to invalidate uncertain attempts — preserve unresolved immutable payload/key and keep newer wallet edits as a separate draft, because discarding an ambiguous request could duplicate an already admitted job. Only rejected attempts may be discarded. Test recovery independently of newer draft readiness/catalog revision.

   Cost if wrong: Losing request identity could create duplicate jobs; the immutable attempt is covered by recovery tests.

9. frozen purchase retries retain acquisition semantics, but a newly admitted retry must recalculate allowance/schedule under current WorkPolicy; old allowed flags and iteration counts cannot bypass current limits. Existing result-iteration compatibility remains mandatory.

   Cost if wrong: A later retry can be denied when current policy is stricter.

10. add the generated namespace to shared contracts handed to every implementer — Task 3 specified it but Task 2’s extracted brief did not, allowing inconsistent independent implementation. Reserve purchase- consistently; no user input required.

   Cost if wrong: Existing hypothetical user IDs beginning with purchase- are now rejected to protect the generated namespace.

11. preserve structured per-item purchase enhancement failures through worker/UI and offer targeted repair even when preparation has no preview — changing professions can invalidate saved gems; without this, users could not repair the draft. Cost if wrong: a small extra recovery UI path.

   Cost if wrong: A small extra recovery UI path must be maintained.

12. validate costed custom reward enhancements on their effective purchase representation while retaining original intent in the draft — otherwise resetting the purchase cannot repair an invalid inherited custom override. Cost if wrong: validation boundary regression; require explicit bypass and non-bypass tests in Task 5.

   Cost if wrong: Effective/original validation boundaries need regression coverage to avoid bypasses.

13. permit inherited raw gem baselines only on effective converted-custom purchase instances — flattening raw gems into manual overrides changes automatic gem adjustment. Preserve empty ordinary rewards and candidate descriptors; freeze actual effective instances. Cost if wrong: enhancement identity mismatch, covered by auto/manual/reset and frozen tests.

   Cost if wrong: Enhancement identity could drift without sparse-gem, reset, and frozen-instance tests.

14. controller will run final broad acceptance commands after Task9 scoped test implementation and review — this provides fresh full-branch evidence without duplicating an agent broad-suite run. Task9 still runs new focused tests and visual QA, fixes actual integration failures, and reports evidence. Cost if wrong: coordination delay only; final checks remain mandatory.

   Cost if wrong: Coordination delay only; all mandatory final checks were still run.


## Final presentation follow-up

Final review found two minor design omissions, resolved in `88138aa`: the wallet now shows a fresh, localized count of included obtainable rewards, and known matching specialization variants appear first in both selection and review. All legal alternatives, ordinary inventory positions, slot/quality groups, ownership, solver identity and report ranking remain unchanged. Smite Priest and unknown/unregistered specs retain stable order because no exact registered tier counterpart is available.

The fix passed 60 focused unit/UI/locale tests, a 13-test subset after assertion refinements, all five purchase browser cases, typecheck, scoped lint/format and diff checks. The browser proves counts change from 20 to 10 when Regalia is removed, then 19 after restoration and an exclusion. The final scoped review approved both fixes with no new findings. Controller `pnpm build` and plain `pnpm lint` both passed at `88138aa` after scratch cleanup (logs `final-polish-build.log` and `final-polish-lint.log`). Unchanged database/native behavior did not require repeated suites.

Additional controller ruling, continuing the chronological list above:

15. Prioritize known specialization-to-setVariant matches only; keep Smite Priest and unknown specs in stable original order because no exact registered counterpart exists. Stat/name guesses would mislead.

    Cost if wrong: ambiguous specs do not receive a preferred-first presentation, but all legal alternatives remain available.
