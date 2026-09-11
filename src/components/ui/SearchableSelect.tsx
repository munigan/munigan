"use client";
import { useTranslations } from "next-intl";

import { useId, useMemo, type ReactNode } from "react";
import { Combobox } from "@base-ui/react/combobox";
import "./select.css";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

function Option({ option }: { option: SearchableSelectOption }) {
  const descriptionId = useId();
  return (
    <Combobox.Item
      value={option.value}
      disabled={option.disabled}
      className="app-select-option app-searchable-option"
      data-select-value={option.value}
      aria-label={option.label}
      aria-describedby={option.description ? descriptionId : undefined}
    >
      {option.icon && (
        <span className="app-searchable-icon" aria-hidden="true">
          {option.icon}
        </span>
      )}
      <span className="app-select-option-content">
        <span>{option.label}</span>
        {option.description && (
          <span id={descriptionId} className="app-select-description">
            {option.description}
          </span>
        )}
      </span>
      <Combobox.ItemIndicator className="app-select-check">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m5 12 4 4L19 6" />
        </svg>
      </Combobox.ItemIndicator>
    </Combobox.Item>
  );
}

/** A select-style trigger with search inside its popup; only listed values can be chosen. */
export function SearchableSelect({
  label,
  options,
  value,
  onValueChange,
  emptyMessage,
  triggerIcon,
  triggerDescription,
}: {
  label: string;
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  emptyMessage?: string;
  triggerIcon?: ReactNode;
  triggerDescription?: string;
}) {
  const t = useTranslations("common");
  const collection = useMemo(
    () =>
      Combobox.createItems(options, {
        getValue: (option) => option.value,
        getLabel: (option) => option.label,
      }),
    [options],
  );
  const { contains } = Combobox.useFilter();
  return (
    <Combobox.Root
      items={collection}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      filter={(option, query) =>
        contains(`${option.label} ${option.description ?? ""}`, query)
      }
      autoHighlight
    >
      <Combobox.Trigger
        aria-label={label}
        className="app-select-trigger"
        data-select-value={value}
      >
        {triggerIcon && (
          <span className="app-searchable-icon" aria-hidden="true">
            {triggerIcon}
          </span>
        )}
        <span className="app-searchable-value-content">
          <span className="app-select-value">
            <Combobox.Value />
          </span>
          {triggerDescription && (
            <span className="app-select-description">{triggerDescription}</span>
          )}
        </span>
        <Combobox.Icon className="app-select-chevron">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner
          className="app-select-positioner"
          align="start"
          sideOffset={6}
          collisionPadding={12}
        >
          <Combobox.Popup
            className="app-select-popup app-searchable-popup"
            aria-label={t("choose", { label: label.toLowerCase() })}
          >
            <div className="app-searchable-search">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 5 5" />
              </svg>
              <Combobox.Input
                className="app-searchable-input"
                aria-label={t("search", { label: label.toLowerCase() })}
                placeholder={t("searchPlaceholder")}
              />
            </div>
            <Combobox.Empty className="app-searchable-empty">
              {emptyMessage ?? t("noMatches")}
            </Combobox.Empty>
            <Combobox.List className="app-select-list app-searchable-list">
              {(option: SearchableSelectOption) => (
                <Option key={option.value} option={option} />
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
