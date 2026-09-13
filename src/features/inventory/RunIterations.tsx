"use client";

import { useId, useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";

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
  const t = useTranslations("inventory.iterations");
  const locale = useLocale();
  const id = useId();
  const [limitReached, setLimitReached] = useState(false);
  const editable = !!range && !!onChange;
  const steps = range
    ? Array.from(
        { length: (range.max - range.min) / range.step + 1 },
        (_, index) => range.min + index * range.step,
      )
    : freeSteps;
  const selected = iterations ?? steps[0];
  const tick = (value: number) =>
    ({
      "--tick": `${((value - steps[0]) / (steps[steps.length - 1] - steps[0])) * 100}%`,
    }) as CSSProperties;
  const formatted = iterations?.toLocaleString(locale) ?? "—";

  return (
    <div className="run-iterations">
      <div className="run-iterations-content">
        <div className="run-iterations-heading">
          <label htmlFor={id}>{t("label")}</label>
          <strong>{formatted}</strong>
        </div>
        <p id={`${id}-help`} className="run-iterations-help">
          {t("help")}
        </p>
        <div className="run-iterations-scale">
          <input
            id={id}
            type="range"
            min={range?.min ?? 500}
            max={range?.max ?? 3000}
            step={range?.step ?? 500}
            value={selected}
            disabled={iterations === null}
            aria-valuetext={t("value", { count: formatted })}
            aria-describedby={`${id}-help ${id}-limit ${id}-feedback`}
            onChange={(event) => {
              if (editable) {
                onChange?.(Number(event.currentTarget.value));
                setLimitReached(false);
                return;
              }
              setLimitReached(Number(event.currentTarget.value) > selected);
              // Free currently has one allowed value, chosen by the server.
              // A locked attempt must never become the selected run value.
              event.currentTarget.value = String(selected);
            }}
          />
          <div className="run-iterations-marks" aria-hidden="true">
            {steps.map((value) => (
              <span key={value} style={tick(value)} />
            ))}
          </div>
          <div className="run-iterations-labels" aria-hidden="true">
            {(range
              ? steps.filter(
                  (value) => value === range.min || value % 1500 === 0,
                )
              : steps
            ).map((value) => (
              <span
                key={value}
                data-selected={value === iterations}
                style={tick(value)}
              >
                {value.toLocaleString(locale)}
              </span>
            ))}
          </div>
        </div>
        <div id={`${id}-limit`} className="run-iterations-limit">
          <span>{t(editable ? "localLimit" : "freeLimit")}</span>
          <span>
            {t("value", {
              count: editable ? range!.max.toLocaleString(locale) : formatted,
            })}
          </span>
        </div>
      </div>
      <div id={`${id}-feedback`} role="status" aria-atomic="true">
        {limitReached && (
          <p className="run-iterations-feedback">
            {t("blocked", { count: formatted })}
          </p>
        )}
      </div>
    </div>
  );
}
