"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useProLaunch } from "@/features/pro-launch/ProLaunchProvider";

const steps = [500, 1000, 1500, 2000, 2500, 3000];

export function RunIterations({ iterations }: { iterations: number | null }) {
  const t = useTranslations("inventory.iterations");
  const locale = useLocale();
  const id = useId();
  const pro = useProLaunch();
  const [limitReached, setLimitReached] = useState(false);
  const selected = iterations ?? steps[0];
  const formatted = iterations?.toLocaleString(locale) ?? "—";

  return (
    <div className="run-iterations">
      <div className="run-iterations-content">
        <label className="run-iterations-heading" htmlFor={id}>
          {t("label")}
        </label>
        <p id={`${id}-help`} className="run-iterations-help">
          {t("help")}
        </p>
        <Select
          id={id}
          aria-label={t("label")}
          value={selected}
          disabled={iterations === null}
          aria-describedby={`${id}-help ${id}-limit ${id}-feedback`}
          onValueChange={(value) => {
            // Preview higher precision without changing the server's free allowance.
            setLimitReached(Number(value) > selected);
          }}
        >
          {steps.map((value) => (
            <SelectOption
              key={value}
              value={value}
              description={t(`accuracy.${value}`)}
            >
              {t("option", {
                count: value.toLocaleString(locale),
                availability: value <= selected ? t("free") : t("proSoon"),
              })}
            </SelectOption>
          ))}
        </Select>
        <div id={`${id}-limit`} className="run-iterations-limit">
          <span>{t("freeLimit")}</span>
          <span>{t("value", { count: formatted })}</span>
        </div>
      </div>
      <div id={`${id}-feedback`} role="status" aria-atomic="true">
        {limitReached && (
          <div className="run-iterations-feedback">
            <p>{t("blocked", { count: formatted })}</p>
            <Button
              variant="ghost"
              onClick={(event) =>
                pro.open("iterations_limit", event.currentTarget)
              }
            >
              {t("seePro")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
