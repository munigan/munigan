"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useProLaunch } from "@/features/pro-launch/ProLaunchProvider";

export function ProRunNotice({ freeLimit }: { freeLimit: number }) {
  const t = useTranslations("inventory");
  const pro = useProLaunch();
  return (
    <section className="run-action-panel">
      <p className="pro-coming-soon">{t("compact.proSoon")}</p>
      <h3>{t("compact.proHeading")}</h3>
      <p>{t("compact.proBody")}</p>
      <Button
        className="run-button"
        onClick={(event) => pro.open("gear_limit", event.currentTarget)}
      >
        {t("proLimit.addCredits")} <span aria-hidden="true">→</span>
      </Button>
      <p className="run-caption">{t("proLimit.noPayment")}</p>
      <p className="run-caption">
        {t("compact.reduceHelp", { count: freeLimit })}
      </p>
    </section>
  );
}
