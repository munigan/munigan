import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pool, testSchema } from "@/server/db/client";
import { admitJob } from "@/server/jobs/admit";
import { executeTopGear, readReport } from "@/server/jobs/work";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import { evaluate } from "@/server/simulator/evaluate";
import { fixtureRequest } from "../support/fixtures";

process.env.CAPABILITY_KEY = "a".repeat(64);
beforeAll(async () => {
  await pool.query(`CREATE SCHEMA ${testSchema}`);
  await pool.query(await readFile("drizzle/0000_top_gear.sql", "utf8"));
});
afterAll(async () => {
  await pool.query(`DROP SCHEMA ${testSchema} CASCADE`);
  await pool.end();
});

it("produces identical persisted native results and rankings with one or two simulation processes", async () => {
  const request = fixtureRequest();
  for (const [index, gem] of [39996, 40112, 40022].entries()) {
    const instanceId = `bag-head-${index}`;
    request.snapshot.inventory.push({
      instanceId,
      itemId: 40528,
      enchantId: 3817,
      gemIds: [41285, gem],
      source: "bag",
    });
    request.selection.selectedInstanceIds.push(instanceId);
  }
  const reports = [];
  for (const concurrency of [1, 2]) {
    const ownerKey = randomUUID();
    const job = await admitJob({
      request: encodeRequest(request),
      ownerKey,
      idempotencyKey: randomUUID(),
    });
    await executeTopGear(job.jobId, new AbortController().signal, evaluate, {
      concurrency,
    });
    reports.push((await readReport(job.reportToken, ownerKey)).report);
  }
  expect(reports[0].coverage).toMatchObject({
    planned: 4,
    succeeded: 4,
    failed: 0,
  });
  expect(reports[1].status).toBe("complete");
  expect(reports[1].rows).toEqual(reports[0].rows);
  expect(reports[1].highestId).toBe(reports[0].highestId);
  expect(reports[1].equippedId).toBe(reports[0].equippedId);
});
