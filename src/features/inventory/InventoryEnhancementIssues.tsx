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
import { Pagination } from "@/components/ui/Pagination";
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
            <Pagination
              label={t("editor.reviewConflicts")}
              page={currentIndex + 1}
              hasPrevious={currentIndex > 0}
              hasNext={currentIndex < (analysis?.conflicts.length ?? 0) - 1}
              onPrevious={() => setIndex(currentIndex - 1)}
              onNext={() => setIndex(currentIndex + 1)}
              range={{
                start: currentIndex + 1,
                end: currentIndex + 1,
                total: analysis?.conflicts.length ?? 0,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
