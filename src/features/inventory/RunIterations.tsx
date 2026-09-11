"use client";

import { useId, useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";

const steps = [500, 1000, 1500, 2000, 2500, 3000];

export function RunIterations({ iterations }: { iterations: number | null }) {
  const t = useTranslations("inventory.iterations");
  const locale = useLocale();
  const id = useId();
  const [limitReached, setLimitReached] = useState(false);
  const selected = iterations ?? steps[0];
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
            min={500}
            max={3000}
            step={500}
            value={selected}
            disabled={iterations === null}
            aria-valuetext={t("value", { count: formatted })}
            aria-describedby={`${id}-help ${id}-limit ${id}-feedback`}
            onChange={(event) => {
              setLimitReached(Number(event.currentTarget.value) > selected);
              // Free currently has one allowed value, chosen by the server.
              // A locked attempt must never become the selected run value.
              event.currentTarget.value = String(selected);
            }}
          />
          <div className="run-iterations-marks" aria-hidden="true">
            {steps.map((value, index) => (
              <span
                key={value}
                style={{ "--tick": `${index * 20}%` } as CSSProperties}
              />
            ))}
          </div>
          <div className="run-iterations-labels" aria-hidden="true">
            {steps.map((value, index) => (
              <span
                key={value}
                data-selected={value === iterations}
                style={{ "--tick": `${index * 20}%` } as CSSProperties}
              >
                {value.toLocaleString(locale)}
              </span>
            ))}
          </div>
        </div>
        <div id={`${id}-limit`} className="run-iterations-limit">
          <span>{t("freeLimit")}</span>
          <span>{t("value", { count: formatted })}</span>
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
