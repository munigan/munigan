import { useLocale, useTranslations } from "next-intl";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { AlertMessage } from "@/components/ui/Alert";
import type {
  Snapshot,
  SetRow,
  Loadout,
  TopGearReport,
  Slot,
} from "@/domain/top-gear/model";
import { Button } from "@/components/ui/Button";
import { number, DpsChange } from "./report-presentation";
import { GearStrip } from "./GearStrip";
export function ResultSummary({
  selected,
  report,
  selectedSnapshot,
  base,
  selectedChanges,
  requiredChanges,
  difference,
  onStats,
}: {
  selected: SetRow;
  report: Pick<TopGearReport, "highestId" | "recommendedId" | "coverage">;
  selectedSnapshot: Snapshot;
  base: Loadout;
  selectedChanges: Slot[];
  requiredChanges: number;
  difference: "equipped" | "highest";
  onStats: () => void;
}) {
  const t = useTranslations("reports");
  const diagnostics = useTranslations("diagnostics");
  const locale = useLocale();
  return (
    <div className="panel selected-set">
      <div className="section-top">
        <div>
          <p className="eyebrow">
            {t("viewing", {
              build:
                selected.id === report.recommendedId
                  ? t("recommendedBuild")
                  : selected.isEquipped
                    ? t("equippedGear")
                    : selected.id === report.highestId
                      ? t(
                          report.coverage.exhaustive
                            ? "highestDps"
                            : "bestFound",
                        )
                      : t("selectedCombination"),
            })}
            {!selected.eligible ? ` · ${t("reference")}` : ""}
          </p>
          <div className="dps-heading">
            <strong>{number(selected.dps, locale)} DPS</strong>
            <DpsChange gain={selected.gain} percent={selected.percent} />
            <span className="muted">{t("vsEquipped")}</span>
          </div>
        </div>
        <div className="text-actions">
          <Button variant="secondary" onClick={onStats}>
            {t("statsDetails")}
            <svg
              className="shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 20h16M7 16v-5m5 5V4m5 12V8" />
            </svg>
          </Button>
        </div>
      </div>
      <div className="report-preview-controls">
        <span className="required-changes">
          {t("requiredChanges", { count: requiredChanges })}
        </span>
      </div>
      <GearStrip
        snapshot={selectedSnapshot!}
        loadout={selected.loadout}
        base={base}
        changes={selectedChanges}
      />
      <div className="section-top muted small">
        <span className="gain">
          {t(
            difference === "highest"
              ? "highlightedHighest"
              : "highlightedEquipped",
            { count: selectedChanges.length },
          )}
        </span>
        <span>
          {[
            Object.keys(selected.gemOverrides ?? {}).length
              ? t("regemmed", {
                  count: Object.keys(selected.gemOverrides!).length,
                })
              : "",
            Object.keys(selected.enchantOverrides ?? {}).length
              ? t("enchanted", {
                  count: Object.keys(selected.enchantOverrides!).length,
                })
              : "",
          ]
            .filter(Boolean)
            .join(" · ") || t("originalEnhancements")}
        </span>
      </div>
      {[
        ...(selected.gemWarnings ?? []),
        ...(selected.enchantWarnings ?? []),
      ].map((warning) => (
        <AlertMessage
          tone="warning"
          key={localizeDiagnostic(warning, diagnostics)}
        >
          {localizeDiagnostic(warning, diagnostics)}
        </AlertMessage>
      ))}
    </div>
  );
}
