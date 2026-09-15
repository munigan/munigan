"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useProLaunch } from "@/features/pro-launch/ProLaunchProvider";

const freeSteps = [500, 1000, 1500, 2000, 2500, 3000];

export function RunIterations({
  iterations,
  range,
  onChange,
}: {
  iterations: number | null;
  range?: { min: number; max: number; step: number };
  onChange?: (iterations: number) => void;
}) {
  const editable = !!range && !!onChange;
  const steps = range
    ? Array.from(
        { length: (range.max - range.min) / range.step + 1 },
        (_, i) => range.min + i * range.step,
      )
    : freeSteps;
  const t = useTranslations("inventory.iterations");
  const locale = useLocale();
  const id = useId();
  const pro = useProLaunch();
  const [limitReached, setLimitReached] = useState(false);
  const selected = iterations ?? steps[0];
  const formatted = iterations?.toLocaleString(locale) ?? "—";
  const limitFormatted = range?.max.toLocaleString(locale) ?? formatted;

  return (
    <div className="run-iterations">
      <div className="run-iterations-content">
        <label className="run-iterations-heading" htmlFor={id}>
          {t("label")}
        </label>
        <Select
          id={id}
          aria-label={t("label")}
          value={selected}
          disabled={iterations === null}
          aria-describedby={`${id}-help ${id}-limit ${id}-feedback`}
          onValueChange={(value) => {
            if (editable) {
              onChange(Number(value));
              setLimitReached(false);
              return;
            }
            // Preview higher precision without changing the server's free allowance.
            setLimitReached(Number(value) > selected);
          }}
        >
          {steps.map((value) => (
            <SelectOption
              key={value}
              value={value}
              description={`${t(`accuracy.${Math.min(value, 3000)}`)} · ${editable ? t("localOption") : value <= selected ? t("free") : t("proSoon")}`}
            >
              {value.toLocaleString(locale)} ·{" "}
              {t(`quality.${Math.min(value, 3000)}`)}
            </SelectOption>
          ))}
        </Select>
        <p id={`${id}-help`} className="run-iterations-help">
          {t("help")}
        </p>

        <div id={`${id}-limit`} className="sr-only">
          <span>{t(editable ? "localLimit" : "freeLimit")}</span>
          <span>{t("value", { count: limitFormatted })}</span>
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
