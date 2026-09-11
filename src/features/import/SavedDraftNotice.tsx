"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, AlertContent, AlertAction } from "@/components/ui/Alert";
import { CharacterPortrait } from "@/features/inventory/CharacterPortrait";
import { loadSavedDraftSummary } from "./saved-draft-summary";
import "./saved-draft-notice.css";

export function SavedDraftNotice({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("import");
  const [summary] = useState(loadSavedDraftSummary);
  const stage = summary
    ? t(
        (
          {
            selection: "draftStageSelection",
            review: "draftStageReview",
            import: "draftStageImport",
          } as const
        )[summary.stage],
      )
    : "";
  return (
    <Alert
      aria-label={t("savedLabel")}
      className="saved-draft-notice mt-0 mb-8 flex-row flex-wrap items-center gap-6 rounded-panel border border-border bg-surface p-6 md:gap-6 max-sm:gap-3 max-sm:p-4"
    >
      {summary ? (
        <div className="saved-draft-identity">
          {summary.className && (
            <CharacterPortrait
              className={summary.className}
              talentsString={summary.talentsString}
            />
          )}
          <div className="saved-draft-copy">
            <div className="saved-draft-heading">
              <strong className="saved-draft-name">
                {summary.name ||
                  t(summary.className ? "savedCharacter" : "savedImport")}
              </strong>
              {summary.className && (
                <span className="saved-draft-meta">
                  {[summary.specName, summary.className, t("level")]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </div>
            <div className="saved-draft-summary">
              <span>{stage}</span>
              {summary.needsPreset && <span>{t("draftNeedsPreset")}</span>}
              {summary.counts && (
                <>
                  <span>
                    {t("draftEquippedCount", {
                      count: summary.counts.equipped,
                    })}
                  </span>
                  {summary.counts.bag !== null && (
                    <span>
                      {t("draftBagCount", { count: summary.counts.bag })}
                    </span>
                  )}
                  {summary.counts.custom > 0 && (
                    <span>
                      {t("draftCustomCount", { count: summary.counts.custom })}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <AlertContent icon="history">{t("savedNotice")}</AlertContent>
      )}
      <div className="saved-draft-actions">
        <AlertAction
          className="gap-3 text-[15px] leading-[18px]"
          onClick={onRestore}
        >
          {t("restoreDraft")}
          <span aria-hidden="true">→</span>
        </AlertAction>
        <AlertAction muted className="text-sm" onClick={onDiscard}>
          {t("discardDraft")}
        </AlertAction>
      </div>
    </Alert>
  );
}
