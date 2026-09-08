import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ItemVersion } from "@/domain/top-gear/item-version";
import {
  RaidSimRequest,
  RaidSimResult,
  ComputeStatsResult,
} from "@/generated/wotlk/api";

export async function runCli(
  input: RaidSimRequest,
  options: {
    binary: string;
    signal: AbortSignal;
    maxSeconds: number;
    statsOnly?: boolean;
    itemVersion?: ItemVersion;
  },
): Promise<{ raidResult: RaidSimResult; statsResult: ComputeStatsResult }> {
  options.signal.throwIfAborted();
  const directory = await mkdtemp(join(tmpdir(), "wotlk-"));
  try {
    const inputPath = join(directory, "input.json"),
      outputPath = join(directory, "output.json");
    await writeFile(inputPath, RaidSimRequest.toJsonString(input), {
      mode: 0o600,
    });
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        options.binary,
        [
          "json-sim",
          "--infile",
          inputPath,
          "--outfile",
          outputPath,
          ...(options.itemVersion
            ? ["--item-version", options.itemVersion]
            : []),
          ...(options.statsOnly ? ["--stats-only"] : []),
        ],
        {
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          detached: process.platform !== "win32",
        },
      );
      let bytes = 0,
        errorText = "",
        failure: Error | undefined,
        killTimer: NodeJS.Timeout | undefined;
      const kill = (signal: NodeJS.Signals) => {
        try {
          if (child.pid && process.platform !== "win32")
            process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch {}
      };
      const stop = (error: Error) => {
        if (failure) return;
        failure = error;
        kill("SIGTERM");
        killTimer = setTimeout(() => kill("SIGKILL"), 1000);
      };
      const abort = () => stop(new Error("Simulation canceled"));
      options.signal.addEventListener("abort", abort, { once: true });
      if (options.signal.aborted) abort();
      const timer = setTimeout(
        () => stop(new Error("Simulation timed out")),
        options.maxSeconds * 1000,
      );
      for (const stream of [child.stdout, child.stderr])
        stream.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1048576)
            stop(new Error("Simulator output limit exceeded"));
          else if (stream === child.stderr) errorText += chunk.toString();
        });
      const cleanup = () => {
        clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        options.signal.removeEventListener("abort", abort);
      };
      child.on("error", (error) => {
        cleanup();
        reject(error);
      });
      child.on("close", (code) => {
        cleanup();
        if (failure) reject(failure);
        else if (code !== 0)
          reject(
            new Error(
              `Simulator failed (${code}): ${errorText.slice(0, 1000)}`,
            ),
          );
        else resolve();
      });
    });
    if ((await stat(outputPath)).size > 32 * 1024 * 1024)
      throw new Error("Simulator result limit exceeded");
    const raw = await readFile(outputPath, "utf8");
    const data = JSON.parse(raw);
    const raidResult = RaidSimResult.fromJson(data.raidResult),
      statsResult = ComputeStatsResult.fromJson(data.statsResult);
    if (raidResult.errorResult || statsResult.errorResult)
      throw new Error("Simulator rejected this configuration");
    const finalStats =
      statsResult.raidStats?.parties[0]?.players[0]?.finalStats?.stats;
    if (!finalStats || finalStats.some((value) => !Number.isFinite(value)))
      throw new Error("Invalid simulator character stats");
    const metric = raidResult.raidMetrics?.parties[0]?.players[0]?.dps;
    if (
      !options.statsOnly &&
      (!metric ||
        !Number.isFinite(metric.avg) ||
        !Number.isFinite(metric.stdev) ||
        metric.stdev < 0)
    )
      throw new Error("Invalid simulator player metrics");
    return { raidResult, statsResult };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
