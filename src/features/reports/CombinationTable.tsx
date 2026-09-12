import { useLocale, useTranslations } from "next-intl";
import type {
  Snapshot,
  SetRow,
  Loadout,
  TopGearReport,
} from "@/domain/top-gear/model";
import { Button } from "@/components/ui/Button";
import { alignPairedSlots } from "@/domain/equipment/enumerate";
import { withEnhancements } from "@/domain/equipment/enhancements";
import { changedResultSlots } from "@/domain/top-gear/report";
import { GearStrip } from "./GearStrip";
import { number, DpsChange } from "./report-presentation";
import { CombinationStats } from "./CombinationStats";
import { combinationStats } from "./character-stats";
import { useMemo } from "react";
export function CombinationTable({
  snapshot,
  report,
  base,
  baseGems,
  baseEnchants,
  selected,
  cursor,
  setSelectedId,
}: {
  snapshot: Snapshot;
  report: Pick<
    TopGearReport,
    "rows" | "highestId" | "recommendedId" | "coverage"
  >;
  base: Loadout;
  baseGems: SetRow["gemOverrides"];
  baseEnchants: SetRow["enchantOverrides"];
  selected: SetRow;
  cursor: number;
  setSelectedId: (id: string) => void;
}) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const rowStats = useMemo(
    () =>
      new Map(
        report.rows.map((row) => [row.id, combinationStats(row, snapshot)]),
      ),
    [report.rows, snapshot],
  );
  return (
    <div className="combination-table" role="table" aria-label={t("ranked")}>
      <div className="combination-columns table-heading" role="row">
        <span role="columnheader">{t("set")}</span>
        <span role="columnheader">{t("gearChanges")}</span>
        <span role="columnheader">DPS</span>
        <span role="columnheader">{t("gainVsEquipped")}</span>
        <span role="columnheader" className="sr-only">
          {t("keyStats")}
        </span>
      </div>
      {report.rows.map((row, index) => {
        const loadout = alignPairedSlots(snapshot, row.loadout, base);
        const rowSnapshot = withEnhancements(
          snapshot,
          row.gemOverrides,
          row.enchantOverrides,
        );
        const changes = changedResultSlots(
          snapshot,
          base,
          loadout,
          baseGems,
          row.gemOverrides,
          baseEnchants,
          row.enchantOverrides,
        );
        return (
          <div
            key={row.id}
            role="row"
            aria-selected={row.id === selected.id}
            className={`combination-columns combination-row ${row.isEquipped ? "equipped-row" : ""} ${row.id === selected.id ? "selected" : ""}`}
            onClick={() => setSelectedId(row.id)}
          >
            <span className="set-number" role="cell">
              <Button
                variant="secondary"
                className="set-select h-11 w-7 min-w-0 border-0 bg-transparent p-0"
                aria-label={t(row.isEquipped ? "viewEquipped" : "viewSet", {
                  set: cursor + index + 1,
                  dps: number(row.dps, locale),
                })}
                aria-pressed={row.id === selected.id}
              >
                {String(cursor + index + 1).padStart(2, "0")}
              </Button>
            </span>
            <div className="set-changes" role="cell">
              <GearStrip
                snapshot={rowSnapshot}
                loadout={loadout}
                base={base}
                changes={changes}
                compact
                changesOnly
              />
            </div>
            <strong role="cell">
              {number(row.dps, locale)}
              <span className="report-row-badges">
                {row.isEquipped && (
                  <span className="badge equipped-badge">{t("equipped")}</span>
                )}
                {row.id === report.recommendedId ? (
                  <span
                    className="badge recommended-badge"
                    title={t("recommendedDescription")}
                  >
                    {t("recommended")}
                  </span>
                ) : row.id === report.highestId ? (
                  <span className="badge highest-badge">
                    {report.coverage.exhaustive
                      ? t("highestDps")
                      : t("bestFound")}
                  </span>
                ) : row.tiedToHighest ? (
                  <span
                    className="badge tied-badge"
                    aria-describedby="report-tie-explanation"
                  >
                    {t("tied")}
                  </span>
                ) : null}
                {!row.eligible && (
                  <span className="muted">{t("reference")}</span>
                )}
              </span>
            </strong>
            <DpsChange gain={row.gain} percent={row.percent} cell />
            <CombinationStats stats={rowStats.get(row.id) ?? []} />
          </div>
        );
      })}
    </div>
  );
}
