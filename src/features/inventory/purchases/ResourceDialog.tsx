"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  DialogContent,
  DialogDescription,
  DialogDismiss,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/Dialog";
import { NumberInput } from "@/components/ui/NumberInput";
import { tokenFamilyForClass } from "@/domain/purchases/catalog";
import type { ResourceId } from "@/domain/purchases/model";
import { removeResource, setResourceBalance } from "@/domain/purchases/state";
import type { TopGearRequest } from "@/domain/top-gear/model";
import { getSpec } from "@/features/settings/registry";
import {
  optionForResource,
  optionsForTier,
  type ResourceTier,
} from "./resource-labels";
import "./purchases.css";

type Props = {
  request: TopGearRequest;
  resourceId?: ResourceId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (request: TopGearRequest) => void;
};

type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function ResourceDialog({
  request,
  resourceId,
  open,
  onOpenChange,
  onChange,
}: Props) {
  const t = useTranslations("inventory.purchases") as unknown as Translator;
  const family = tokenFamilyForClass(request.snapshot.settings.player!.class);
  const className = getSpec(request.snapshot.specId).className;
  const initialOption = optionForResource(resourceId ?? "frost", family);
  const initialTier = initialOption?.tier ?? 10;
  const initialId =
    (initialOption && resourceId) ??
    optionsForTier(initialTier, family)[0].resourceId;
  const [tier, setTier] = useState<ResourceTier>(initialTier);
  const [selectedResource, setSelectedResource] =
    useState<ResourceId>(initialId);
  const [quantity, setQuantity] = useState(
    request.purchases?.balances[initialId] ?? 1,
  );
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const nextOption = optionForResource(resourceId ?? "frost", family);
      const nextTier = nextOption?.tier ?? 10;
      const nextId =
        (nextOption && resourceId) ??
        optionsForTier(nextTier, family)[0].resourceId;
      setTier(nextTier);
      setSelectedResource(nextId);
      setQuantity(request.purchases?.balances[nextId] ?? 1);
    }
    wasOpen.current = open;
  }, [family, open, request, resourceId]);

  const familyLabel = t(`families.${family}`);
  const localizedClass = t(`classes.${className}`);
  const options = optionsForTier(tier, family);
  const selected =
    options.find((option) => option.resourceId === selectedResource) ??
    options[0];

  function selectTier(nextTier: ResourceTier) {
    const next = optionsForTier(nextTier, family)[0];
    setTier(nextTier);
    setSelectedResource(next.resourceId);
    setQuantity(request.purchases?.balances[next.resourceId] ?? 1);
  }

  function selectResource(nextId: ResourceId) {
    setSelectedResource(nextId);
    setQuantity(request.purchases?.balances[nextId] ?? 1);
  }

  function save() {
    const withSelected = setResourceBalance(
      request,
      selectedResource,
      quantity,
    );
    const next =
      resourceId && resourceId !== selectedResource
        ? removeResource(withSelected, resourceId)
        : withSelected;
    onChange(next);
    onOpenChange(false);
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="resource-dialog max-w-[45rem] overflow-hidden p-0 sm:p-0 max-sm:w-full max-sm:max-h-dvh max-sm:rounded-none max-sm:border-0">
          <div className="resource-dialog-viewport">
            <header className="resource-dialog-header">
              <div>
                <DialogTitle className="resource-dialog-title">
                  {t(resourceId ? "editTitle" : "addTitle")}
                </DialogTitle>
                <DialogDescription className="resource-dialog-description">
                  {t("dialogDescription")}
                </DialogDescription>
              </div>
              <DialogDismiss />
            </header>

            <div className="resource-dialog-body">
              <fieldset className="resource-tier-fieldset">
                <legend>{t("tier")}</legend>
                <div className="resource-tier-buttons">
                  {([9, 10] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={tier === value}
                      onClick={() => selectTier(value)}
                    >
                      {t("tierValue", { tier: value })}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="resource-options">
                <legend className="sr-only">{t("quality")}</legend>
                {options.map((option) => {
                  const checked = option.resourceId === selectedResource;
                  return (
                    <label
                      key={option.resourceId}
                      className="resource-option"
                      data-selected={checked}
                    >
                      <input
                        type="radio"
                        name="resource"
                        checked={checked}
                        onChange={() => selectResource(option.resourceId)}
                      />
                      <strong className="resource-option-quality">
                        {t(`qualities.${option.quality}`, {
                          level: option.itemLevel,
                        })}
                      </strong>
                      <span className="resource-option-copy">
                        <span className="resource-option-name">
                          {t(option.labelKey, { family: familyLabel })}
                        </span>
                        <span>{t(option.descriptionKey)}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="resource-quantity-row">
                <div>
                  <strong>{t(`quantityLabels.${selected.quality}`)}</strong>
                  <span>
                    {t("familyMatch", {
                      family: familyLabel,
                      class: localizedClass,
                    })}
                  </span>
                </div>
                <NumberInput
                  label={t("quantity")}
                  value={quantity}
                  onValueChange={setQuantity}
                  min={0}
                  max={1_000_000}
                  step={1}
                />
              </div>

              <div className="resource-prerequisite">
                <strong>{t(selected.prerequisiteTitleKey)}</strong>
                <span>{t(selected.prerequisiteKey)}</span>
              </div>
            </div>

            <footer className="resource-dialog-footer">
              <div className="resource-dialog-selection">
                <strong>{t("oneSelected")}</strong>
                <span>{t("availableHelp")}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="resource-cancel"
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="button" className="resource-save" onClick={save}>
                {t(resourceId ? "saveResource" : "addResource")}
              </Button>
            </footer>
          </div>
        </DialogContent>
      )}
    </DialogRoot>
  );
}
