"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import "./number-input.css";
export function NumberInput({
  label,
  value,
  onValueChange,
  min = 0,
  max,
  step = 1,
  unit,
  size = "default",
}: {
  label: string;
  value: number;
  onValueChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  size?: "default" | "small";
}) {
  const t = useTranslations("common");
  const [draft, setDraft] = useState<string | null>(null);
  const valid = (n: number) =>
    Number.isFinite(n) &&
    n >= min &&
    (max === undefined || n <= max) &&
    Math.abs((n - min) / step - Math.round((n - min) / step)) < 1e-8;
  const change = (n: number) => {
    if (valid(n)) {
      setDraft(null);
      onValueChange(n);
    }
  };
  const bump = (direction: number) =>
    change(Math.min(max ?? Infinity, Math.max(min, value + direction * step)));
  return (
    <div className="app-number-input" data-size={size}>
      <button
        type="button"
        disabled={value <= min}
        aria-label={t("decrease", { label })}
        onClick={() => bump(-1)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 8h8" />
        </svg>
      </button>
      <span className="app-number-value">
        <input
          type="number"
          aria-label={label}
          value={draft ?? value}
          style={{
            width: `${Math.max(2, String(draft ?? value).length + 1)}ch`,
          }}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw !== "" && valid(Number(raw))) change(Number(raw));
            else setDraft(raw);
          }}
          onBlur={() => setDraft(null)}
        />
        {unit && <span aria-hidden="true">{unit}</span>}
      </span>
      <button
        type="button"
        disabled={max !== undefined && value >= max}
        aria-label={t("increase", { label })}
        onClick={() => bump(1)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 8h8M8 4v8" />
        </svg>
      </button>
    </div>
  );
}
