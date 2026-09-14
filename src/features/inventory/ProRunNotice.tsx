"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useProLaunch } from "@/features/pro-launch/ProLaunchProvider";

export function ProRunNotice({
  freeLimit,
  freeIterations,
  limitIsUpperBound,
  onReduceSelection,
}: {
  freeLimit: number;
  freeIterations: number;
  limitIsUpperBound: boolean;
  onReduceSelection(): void;
}) {
  const t = useTranslations("inventory");
  const pro = useProLaunch();
  return (
    <section className="run-action-panel">
      <div className="section-top">
        <span>
          {t(limitIsUpperBound ? "proLimit.upperBoundTitle" : "proLimit.title")}
        </span>
        <span>{t("proLimit.soon")}</span>
      </div>
      <h3>{t("proLimit.heading")}</h3>
      <p>{t("proLimit.body")}</p>
      <Button
        className="run-button"
        onClick={(event) => pro.open("gear_limit", event.currentTarget)}
      >
        {t("proLimit.addCredits")} <span aria-hidden="true">→</span>
      </Button>
      <p className="run-caption">{t("proLimit.noPayment")}</p>
      <Button variant="ghost" onClick={onReduceSelection}>
        {t("proLimit.reduce")} <span aria-hidden="true">→</span>
      </Button>
      <p>
        {t("proLimit.reduceHelp", {
          count: freeLimit,
          iterations: freeIterations,
        })}
      </p>
    </section>
  );
}
