import { localizeDiagnostic } from "@/i18n/diagnostics";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TopGearRequest } from "@/domain/top-gear/model";
import type { analyzeItemEnhancementSets } from "@/domain/equipment/enumerate";
import { getCatalog } from "@/domain/equipment/catalog";
import {
  setItemEnhancements,
  validateItemEnhancements,
} from "@/domain/equipment/item-enhancements";
import { Alert, AlertContent } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { enhancementDiagnosticText } from "./enhancements/enhancement-labels";
import type { EnhancementField } from "./ItemEnhancementPreview";

export type EnhancementSetAnalysis = ReturnType<
  typeof analyzeItemEnhancementSets
>;
export function InventoryEnhancementIssues({
  request,
  analysis,
  onChange,
  onEdit,
}: {
  request: TopGearRequest;
  analysis: EnhancementSetAnalysis | null;
  onChange: (request: TopGearRequest) => void;
  onEdit: (instanceId: string, field: EnhancementField) => void;
}) {
  const t = useTranslations("inventory");
  const d = useTranslations("diagnostics");
  const [expanded, setExpanded] = useState(false),
    [index, setIndex] = useState(0);
  const catalog = getCatalog(request.snapshot.itemVersion);
  const invalidItems = request.snapshot.inventory.filter((item) => {
    const override = request.snapshot.itemEnhancements?.[item.instanceId];
    return (
      override &&
      validateItemEnhancements(request.snapshot, item, override).length
    );
  });
  if (
    !analysis?.excludedCount &&
    analysis?.complete !== false &&
    !invalidItems.length
  )
    return null;
  const currentIndex = Math.min(
    index,
    Math.max(0, (analysis?.conflicts.length ?? 0) - 1),
  );
  const conflict = analysis?.conflicts[currentIndex];
  const issues = [
    ...new Map(
      [
        ...(conflict?.diagnostics ?? []),
        ...invalidItems.flatMap((item) =>
          validateItemEnhancements(
            request.snapshot,
            item,
            request.snapshot.itemEnhancements![item.instanceId],
          ),
        ),
      ].map((issue) => [issue.code + issue.message, issue]),
    ).values(),
  ];
  const affectedIds = new Set([
    ...invalidItems.map((i) => i.instanceId),
    ...(conflict?.instanceIds ?? []),
  ]);
  const affected = request.snapshot.inventory.filter((i) =>
    affectedIds.has(i.instanceId),
  );
  return (
    <div className="inventory-enhancement-issues">
      <Alert tone="warning" className="rounded-panel border bg-surface px-5">
        <AlertContent icon="warning">
          <strong>{t("editor.conflictsTitle")}</strong>
          <p>
            {analysis?.complete
              ? t("editor.conflictsSummary", {
                  valid: analysis.validCount,
                  excluded: analysis.excludedCount,
                })
              : t("editor.conflictsPartial")}
          </p>
          <p className="muted">{t("editor.conflictsHelp")}</p>
        </AlertContent>
        <Button
          variant="ghost"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {t("editor.reviewConflicts")}
        </Button>
      </Alert>
      {expanded && (
        <div className="enhancement-conflict-items">
          <strong>
            {t("editor.conflictExample", { index: currentIndex + 1 })}
          </strong>
          {issues.map((issue) => (
            <p key={issue.code + issue.message} className="muted">
              {["invalid-loadout", "equip-category"].includes(issue.code)
                ? localizeDiagnostic(issue, d)
                : enhancementDiagnosticText(issue, t)}
            </p>
          ))}
          {affected.map((item) => (
            <div key={item.instanceId} className="enhancement-conflict-item">
              <span>{catalog.items.get(item.itemId)?.name ?? item.itemId}</span>
              <Button
                variant="ghost"
                onClick={() =>
                  onEdit(
                    item.instanceId,
                    request.snapshot.itemEnhancements?.[item.instanceId]
                      ?.enchantId !== undefined
                      ? "enchant"
                      : 0,
                  )
                }
              >
                {t("editor.fixItem")}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  onChange(setItemEnhancements(request, item.instanceId, {}))
                }
              >
                {t("editor.resetItem")}
              </Button>
            </div>
          ))}
          {(analysis?.conflicts.length ?? 0) > 1 && (
            <div className="enhancement-conflict-pagination">
              <Button
                variant="ghost"
                disabled={currentIndex === 0}
                onClick={() => setIndex(currentIndex - 1)}
              >
                {t("editor.previousConflict")}
              </Button>
              <Button
                variant="ghost"
                disabled={
                  currentIndex === (analysis?.conflicts.length ?? 0) - 1
                }
                onClick={() => setIndex(currentIndex + 1)}
              >
                {t("editor.nextConflict")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
