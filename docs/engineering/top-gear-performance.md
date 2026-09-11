# Top Gear performance investigation — 2026-09-11

The initial investigation identified bounded parallel evaluation of gear sets, paired with enough hosted CPU, as the strongest measured opportunity. At baseline, Production used Small 1x, with 0.5 vCPU and 0.5 GB RAM. Database round trips and repeated native initialization remain additional optimization targets.

## Implementation and full worker verification

Following approval, the worker now persists the reference first, then runs a bounded candidate pool. Hosted Top Gear selects Medium 2x (2 vCPU, 4 GB) and uses up to two processes, capped by the actual machine CPU allocation when a run overrides the preset. Direct local execution remains sequential by default. The native binary, iterations, seed schedule, result identities, attempt limits, and global two-job admission cap are unchanged.

Fatal orchestration errors abort and drain siblings before finalization. User/provider cancellation does the same. Lease loss fences result publication and leaves the job resumable. The task emits a compact performance summary with accumulated phase durations, actual machine, work counts, and elapsed time; operation durations overlap under concurrency.

A subsequent read-only Production query located a completed 96-set Frost DK request (500 iterations, 180-second encounter). Its original Small 1x Trigger run, `run_06g8rvffca83v76tvuq2o2gn01`, recorded 150,560 ms of billed execution and about 154.5 seconds from start to finish. This is the large captured workload used for follow-up verification; it is not conclusively identified as the user's stated 92-combination report.

Replaying its unchanged frozen plan through the full worker and an isolated local PostgreSQL schema took **29,239 ms sequentially and 14,994 ms with two processes**. All 96 persisted rows and rankings passed exact equality. Both runs recorded 96 attempts and 96 successes. The current planner also reproduces that frozen Production plan exactly. [Raw full-worker measurements](./top-gear-worker-benchmark.json).

Automated verification covers reference persistence before candidates, bounded concurrency, out-of-order completion, draining cancellation/fatal errors, lease fencing/resumption, parallel retry caps, and exact persisted native parity.

### Hosted verification

Trigger Production **20260911.1** deployed successfully on 2026-09-11. [Deployment](https://cloud.trigger.dev/projects/v3/proj_tbzzdkaotlbspettqxxh/deployments/mshu2wqo).

The same captured request and identical planner output were admitted as a new report through the normal policy/budget path. All 96 native results were recomputed, with no reuse from the prior job. The original report was retained. Every persisted work key and complete simulation result passed exact deep equality against the original Production job.

| Measurement | Small 1x, sequential baseline | Medium 2x, two processes |
| --- | ---: | ---: |
| Trigger billed execution | 150.560 s | 36.676 s |
| Run start to finish | 154.481 s | 38.941 s |
| Successful evaluations | 96 | 96 |
| Iterations per evaluation | 500 | 500 |
| Total cost, including invocation | $0.00510640 | $0.00625992 |

This measured workload ran **4.11× faster in billed execution time**, with approximately **23% higher total run cost**. This is one hosted before/after observation on the same input, not a guarantee for every spec, workload, or machine host. [Verification report](https://munigan.app/reports/fCp9MhybzeWKQG79NNKi3S9DPVcMOINlOdF6EsV4YH4), [Trigger run](https://cloud.trigger.dev/orgs/munigan-d137/projects/wow-droptmizer-kTSz/env/prod/runs/run_06g9130m67obqkbhvf62j4hq01), [raw hosted measurements](./top-gear-production-benchmark.json).

Release checks: 424 unit/UI tests, 19 PostgreSQL integration tests, the native persisted-parity test, TypeScript, changed-file formatting, and Trigger packaging passed. Project lint passed with `.worktrees/**` excluded; the plain `pnpm lint` command also traversed an unrelated nested checkout's generated files and failed there. The worker was deployed independently; no website deployment or Git commit/push was performed.

## Evidence and limits

At baseline, the Production task dashboard showed version `20260910.1`, queue `wotlk-simulation`, concurrency 2, Small 1x, and region `us-east-1`. Several visible runs took over a minute, including durations of 1m 5.5s, 1m 51.2s, and 2m 34.4s. No specific run was conclusively matched to the user's 92-combination report. Dashboard compute duration is billed execution time, not a measurement of CPU utilization.

- [Production task dashboard](https://cloud.trigger.dev/orgs/munigan-d137/projects/wow-droptmizer-kTSz/env/prod/tasks/standard/top-gear)
- [Trigger machine specifications](https://trigger.dev/docs/machines)

Local experiments used the real `evaluate()` adapter and built poli93 binary, Original WotLK Frost DK settings, 500 iterations per set, a 180-second encounter, and an Apple M1 Max. They ran the first 92 entries of a stored local 96-entry plan. Those historical entries predate the current deduplication rules: replanning that full source now yields 24 entries. The benchmark deliberately retained 92 evaluations to compare scheduling throughput; it is not an exact replay of the user's Production request or 92 distinct current gear identities.

| Native processes running concurrently | Elapsed seconds | Speed versus initial sequential run |
| --- | ---: | ---: |
| 1 | 27.437 | 1.00× |
| 2 | 14.303 | 1.92× |
| 4 | 7.724 | 3.55× |
| 1, repeated after parallel runs | 28.007 | 0.98× |

All returned `SimulationResult` objects passed exact deep equality against the sequential baseline, including DPS, standard deviation, character stats, and input hashes. Inputs, seeds, iterations, and result ordering were held constant. The benchmark included input preparation, file I/O, process startup, native computation, parsing, and cleanup. It excluded worker SQL operations, Trigger startup/queue time, and report polling. Two- and four-process configurations were each measured once, so these are directional local results, not hosted capacity guarantees.

Raw evidence: [top-gear-performance-benchmark.json](./top-gear-performance-benchmark.json).

## Where time goes today

1. The job claims a lease and creates its plan.
2. For each set, it awaits an admission transaction, one native evaluation, and result persistence before starting the next set.
3. Every native call creates a temporary directory, writes JSON, starts `wowsimcli json-sim`, reads/parses output, and removes the directory.
4. The wrapper loads/scopes the item database, computes character stats, and invokes `core.RunRaidSim`. That entry point loops over iterations sequentially.
5. Finalization creates the report; the browser normally polls every two seconds.

Relevant code: `src/server/jobs/work.ts:231`, `src/server/simulator/cli.ts:23`, `tools/simulator/overlay/json_sim.go:25`, and pinned engine `.cache/wotlk/sim/core/sim.go:307`.

Queue concurrency 2 permits two jobs at once. It does not split one job across two CPUs. A larger machine alone cannot make the sequential simulator use multiple cores for combat iterations.

Single-set local probes took 299–302 ms at 500 iterations and 543–557 ms at 1,000. A stats-only native invocation took 47–54 ms. This demonstrates meaningful setup/character-computation overhead, but does not isolate which portion a persistent process would remove. About 92 × 49 ms = 4.5 seconds passes through the stats-only path sequentially in this local workload; that is not a promised recoverable saving.

`UseItemVersion()` lazily parses the embedded Original item profile on each new process and clones item/gem/enchant maps per call. `sync.Once` cannot retain that parsed profile across separate processes. Automatic Enhancement Shaman rotation additionally invokes a stats-only process per set to choose its rotation.

## Recommended changes, in order

### 1. Measure a Production baseline and test one full CPU

Instrument planning, work admission, native execution, result persistence, and finalization separately. Record the machine preset, planned count, actual iteration count, encounter duration, and spec. Read CPU throttling and memory metrics when available. Use the same frozen request and seed schedule for comparisons.

First compare Small 1x with Small 2x (1 vCPU, 1 GB) while retaining sequential evaluation. A CPU-bound task can approach twice the compute throughput when moving from half to one CPU, but SQL wait, startup, host CPU differences, and throttling determine actual wall time. No hosted speedup was measured here.

At current published compute rates, Small 2x costs almost twice as much per second; if execution time halves, compute cost is approximately unchanged. Compare cost per completed report alongside latency. [Trigger pricing](https://trigger.dev/pricing)

### 2. Add a small pool of native processes inside each job

Compare two concurrent processes on Medium 2x (2 vCPU, 4 GB), then four on Large 1x (4 vCPU, 8 GB). Keep one Trigger orchestration task per report. The local experiment demonstrates that independent native processes can improve throughput while preserving sampled results.

Keep the equipped reference first if needed for existing progress behavior, then distribute candidates through a bounded pool. Preserve original seeds, per-set iteration counts, reference flags, attempt caps, result identities, lease fencing, cancellation, and durable resumption. Abort and await all children before finalizing on cancellation or lease loss. Account for the product of jobs and processes when enforcing global capacity. Avoid holding a shared job-row database lock while simulations execute.

Do not start 92 processes simultaneously or assume host CPU count equals the container's CPU quota. Keep process limits explicit and matched to the chosen machine. This requires integration checks for cancellation, retries, concurrent result writes, and lease loss before deployment.

### 3. Reduce database round trips if Production timings justify it

The normal per-set path has six awaited SQL round trips: BEGIN, job-row SELECT, work INSERT, attempt UPDATE, COMMIT, and result UPDATE. That is approximately 552 round trips for 92 sets, excluding heartbeats and finalization.

As illustrative network arithmetic, 10 ms per round trip adds about 5.5 seconds to the sequential path; 50 ms adds about 27.6 seconds. These are scenarios, not measured Production database latency. Local SELECT latency was roughly 0.13 ms and cannot validate hosted latency.

Check database placement relative to the confirmed Trigger `us-east-1` region. Combine work creation and attempt admission into fewer SQL statements, or admit small chunks in a transaction and persist small result batches. Preserve attempt accounting, lease checks, partial progress, and bounded rework on crashes. Shared row locks and the current four-connection pool can limit naive parallel admission, so measure admission wait after adding process concurrency.

### 4. Reuse native processes to amortize initialization

A persistent JSON-lines protocol or explicit batch command could load the engine/item profile once per process and stream per-set results. Return only needed metrics/stats rather than the full raid result when profiling shows serialization matters. Keep a small process pool so item-version global state remains isolated.

The wrapper currently holds `itemVersionMutex` across the entire simulation; adding goroutines around the existing function would still serialize calls. Removing that mutex without redesigning the global item-profile state would introduce correctness risks.

The pinned poli93 source already includes a separate bulk simulator with concurrent execution and optional fast-mode filtering. It is useful reference code, but not a drop-in replacement: it generates its own combinations, truncates reported results, and can change sampling. Preserve this app's physical item copies, locks, gem/enchant rules, Original item profile, complete result coverage, and deterministic work accounting.

### 5. Consider adaptive sampling only after execution improvements

The checked-in default is 500 iterations per set; `unitsPerSet: 5000` is a budget-accounting value, not the actual iteration count. The exact Production request's frozen policy still needs inspection.

Reducing every set from 500 to 100 iterations increases sampling uncertainty by about √5, or 2.24×, under ordinary Monte Carlo assumptions. Near-equal items can swap ranking. A screening pass followed by higher precision for contenders may improve time-to-answer, but it changes today's uniform sampling/coverage contract and needs explicit statistical handling and honest report presentation. Avoid treating the first noisy top few sets as certainly best.

## Practical next experiment

Compare the same Production input with: existing Small 1x/sequential; Small 2x/sequential; Medium 2x/two processes. Preserve precision. Capture total latency, phase durations, memory, per-report cost, and identical outputs where engine/platform determinism permits. Then choose whether database batching or persistent processes is the next useful investment. The investigation supports these experiments; it does not yet establish a Production latency target.
