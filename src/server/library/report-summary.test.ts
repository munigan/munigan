import { describe, expect, it } from "vitest";
import type { TopGearReport } from "@/domain/top-gear/model";
import { reportFixture } from "../../../tests/support/report-fixture";
import { summarizeReport } from "./report-summary";

describe("summarizeReport", () => {
  it("summarizes the recommended result against equipped DPS using registry metadata", () => {
    const data = reportFixture();
    data.report.recommendedId = "highest";

    expect(summarizeReport(data.report as unknown as TopGearReport)).toEqual({
      characterName: "Report preview",
      classKey: "warrior",
      specKey: "warrior:FuryTalents",
      level: 80,
      dps: 10050,
      gainDps: 50,
    });
  });

  it("falls back to the highest result and tolerates a missing equipped result", () => {
    const data = reportFixture("partial");
    data.report.rows = data.report.rows.filter((row) => !row.isEquipped);
    data.report.equippedId = "missing";

    expect(
      summarizeReport(data.report as unknown as TopGearReport),
    ).toMatchObject({
      dps: 10050,
      gainDps: null,
    });
  });

  it("uses registry class metadata rather than deriving the class from the module key", () => {
    const data = reportFixture();
    data.report.snapshot.specId = "balance_druid:Phase1Talents";

    expect(
      summarizeReport(data.report as unknown as TopGearReport),
    ).toMatchObject({
      classKey: "druid",
      specKey: "balance_druid:Phase1Talents",
    });
  });

  it.each([
    [
      "empty results",
      (report: ReturnType<typeof reportFixture>["report"]) =>
        (report.rows = []),
    ],
    [
      "unknown spec",
      (report: ReturnType<typeof reportFixture>["report"]) =>
        (report.snapshot.specId = "unknown:spec"),
    ],
    [
      "non-finite DPS",
      (report: ReturnType<typeof reportFixture>["report"]) =>
        (report.rows[0].dps = Number.NaN),
    ],
    [
      "non-finite equipped gain",
      (report: ReturnType<typeof reportFixture>["report"]) => {
        report.rows[0].dps = Number.MAX_VALUE;
        report.rows[1].dps = -Number.MAX_VALUE;
      },
    ],
    [
      "oversized character name",
      (report: ReturnType<typeof reportFixture>["report"]) =>
        (report.snapshot.settings.player!.name = "x".repeat(81)),
    ],
  ])("rejects %s", (_name, mutate) => {
    const data = reportFixture();
    mutate(data.report);
    expect(() =>
      summarizeReport(data.report as unknown as TopGearReport),
    ).toThrow();
  });
});
