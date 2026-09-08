import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { runCli } from "@/server/simulator/cli";
import { RaidSimRequest } from "@/generated/wotlk/api";
const binary =
  process.env.SIM_BINARY ?? `${process.cwd()}/dist/simulator/local/wowsimcli`;
it("runs actual native DPS with final stats", async () => {
  const input = RaidSimRequest.fromJsonString(
    await readFile("tests/fixtures/sim/warrior.request.json", "utf8"),
  );
  const result = await runCli(input, {
    binary,
    signal: new AbortController().signal,
    maxSeconds: 30,
  });
  expect(
    result.raidResult.raidMetrics!.parties[0].players[0].dps!.avg,
  ).toBeCloseTo(4727.139991190476, 7);
  expect(
    result.statsResult.raidStats!.parties[0].players[0].finalStats!.stats
      .length,
  ).toBeGreaterThan(30);
});
it("refuses an already canceled simulation", async () => {
  const input = RaidSimRequest.fromJsonString(
    await readFile("tests/fixtures/sim/warrior.request.json", "utf8"),
  );
  const abort = new AbortController();
  abort.abort();
  await expect(
    runCli(input, { binary, signal: abort.signal, maxSeconds: 30 }),
  ).rejects.toThrow(/abort|cancel/i);
});
it("matches the unmodified CLI command at the same seed", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "cli-parity-"));
  try {
    const output = join(dir, "original.json");
    await promisify(execFile)(binary, [
      "sim",
      "--infile",
      "tests/fixtures/sim/warrior.request.json",
      "--outfile",
      output,
    ]);
    const original = JSON.parse(await readFile(output, "utf8"));
    const input = RaidSimRequest.fromJsonString(
      await readFile("tests/fixtures/sim/warrior.request.json", "utf8"),
    );
    const wrapped = await runCli(input, {
      binary,
      signal: new AbortController().signal,
      maxSeconds: 30,
    });
    expect(wrapped.raidResult.raidMetrics!.parties[0].players[0].dps!.avg).toBe(
      original.raidMetrics.parties[0].players[0].dps.avg,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("terminates a live native simulation when canceled or timed out", async () => {
  const input = RaidSimRequest.fromJsonString(
    await readFile("tests/fixtures/sim/warrior.request.json", "utf8"),
  );
  input.simOptions!.iterations = 10000000;
  const abort = new AbortController();
  const pending = runCli(input, {
    binary,
    signal: abort.signal,
    maxSeconds: 30,
  });
  const timer = setTimeout(() => abort.abort(), 100);
  await expect(pending).rejects.toThrow(/cancel/);
  clearTimeout(timer);
  await expect(
    runCli(input, {
      binary,
      signal: new AbortController().signal,
      maxSeconds: 0.1,
    }),
  ).rejects.toThrow(/timed out/);
});
