"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import { getCatalog } from "@/domain/equipment/catalog";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import { validateItem } from "@/domain/equipment/validate";
import { resourceIcon } from "./resource-icons";
import { useLocale, useTranslations } from "next-intl";
import { Select, SelectOption } from "@/components/ui/Select";
import {
  defaultPurchaseVariant,
  purchaseVariants,
} from "@/domain/purchases/variants";
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
import type { GearLabActions } from "../state/gear-lab-store";
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
  onSave: GearLabActions["saveResource"];
  onRemove?: GearLabActions["removeResource"];
  onRemoved?: () => void;
  finalFocus?: () => HTMLElement | null;
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
  onSave,
  onRemove,
  onRemoved,
  finalFocus,
}: Props) {
  const t = useTranslations("inventory.purchases") as unknown as Translator;
  const locale = useLocale();
  const family = tokenFamilyForClass(request.snapshot.settings.player!.class);
  const className = getSpec(request.snapshot.specId).className;
  const initialOption = optionForResource(resourceId ?? "frost", family);
  const initialTier = initialOption?.tier ?? 10;
  const initialId =
    (initialOption && resourceId) ??
    optionsForTier(initialTier, family)[0].resourceId;
  const variants = purchaseVariants(request.snapshot);
  const initialVariant =
    request.purchases?.gearVariant ??
    defaultPurchaseVariant(request.snapshot) ??
    variants[0];
  const [gearVariant, setGearVariant] = useState(initialVariant);
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
      setGearVariant(initialVariant);
      setTier(nextTier);
      setSelectedResource(nextId);
      setQuantity(request.purchases?.balances[nextId] ?? 1);
    }
    wasOpen.current = open;
  }, [family, open, request, resourceId, initialVariant]);

  const familyLabel = t(`families.${family}`);
  const localizedClass = t(`classes.${className}`);
  const options = optionsForTier(tier, family, itemVersionOf(request.snapshot));
  const selected =
    options.find((option) => option.resourceId === selectedResource) ??
    options[0];

  const equipment = getCatalog(itemVersionOf(request.snapshot));
  const rewardRecipes = getPurchaseCatalog(
    itemVersionOf(request.snapshot),
  ).recipes.filter(
    (recipe) =>
      recipe.classId === request.snapshot.settings.player!.class &&
      recipe.setVariant === gearVariant &&
      [recipe.cost, ...(recipe.alternativeCosts ?? [])].some(
        (cost) => cost[selectedResource],
      ) &&
      !validateItem(request.snapshot, {
        instanceId: "resource-preview",
        itemId: recipe.itemId,
        source: "purchase",
        gemIds: [],
        enchantId: 0,
      }).length,
  );
  const selectedName = t(selected.labelKey, { family: familyLabel });

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
    onSave({
      previousId: resourceId,
      id: selectedResource,
      quantity,
      gearVariant,
    });
    onOpenChange(false);
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent
          finalFocus={finalFocus}
          className="resource-dialog resource-dialog-illustrated max-w-[47.5rem] overflow-hidden p-0 sm:p-0 max-sm:w-full max-sm:max-h-dvh max-sm:rounded-none max-sm:border-0"
        >
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
              <label className="resource-specialization">
                <span>{t("gearSpecialization")}</span>
                <Select
                  aria-label={t("gearSpecialization")}
                  value={gearVariant}
                  onValueChange={(value) => setGearVariant(String(value))}
                >
                  {variants.map((variant) => (
                    <SelectOption key={variant} value={variant}>
                      {t(`variants.${variant}`)}
                    </SelectOption>
                  ))}
                </Select>
              </label>
              <fieldset className="resource-tier-fieldset">
                <legend>{t("tier")}</legend>
                <div className="resource-tier-buttons">
                  {([7, 8, 9, 10] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={tier === value}
                      onClick={() => {
                        selectTier(value);
                      }}
                    >
                      {t("tierValue", { tier: value })}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="resource-raid-summary">
                <span>
                  {t(
                    tier === 10
                      ? "raidICC"
                      : tier === 9
                        ? "raidTOC"
                        : tier === 8
                          ? "raidUlduar"
                          : "raidNaxx",
                  )}
                </span>
                <span>
                  {t("resourceOptionsCount", {
                    count: options.length,
                    family: familyLabel,
                  })}
                </span>
              </div>
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
                        aria-label={`${t(`qualities.${option.quality}`, { level: option.itemLevel })} ${t(option.labelKey, { family: familyLabel })} ${t(option.descriptionKey)}`}
                        checked={checked}
                        onChange={() => selectResource(option.resourceId)}
                      />
                      <Image
                        unoptimized
                        src={`https://wow.zamimg.com/images/wow/icons/large/${resourceIcon(option.resourceId)}.jpg`}
                        width={40}
                        height={40}
                        alt=""
                        className="resource-option-image"
                      />
                      <span className="resource-option-copy">
                        <span className="resource-option-name">
                          {t(option.labelKey, { family: familyLabel })}
                        </span>
                        <span>{t(option.descriptionKey)}</span>
                      </span>
                      <strong className="resource-option-quality">
                        {t(`qualities.${option.quality}`, {
                          level: option.itemLevel,
                        })}
                      </strong>
                    </label>
                  );
                })}
              </fieldset>

              <div className="resource-quantity-row">
                <div>
                  <strong>{t("quantity")}</strong>
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
                  minDigits={3}
                />
              </div>

              {rewardRecipes.length > 0 && (
                <div className="resource-equipment-preview">
                  <div className="resource-equipment-images">
                    {rewardRecipes.slice(0, 3).map((recipe) => {
                      const item = equipment.items.get(recipe.itemId);
                      return item?.icon ? (
                        <Image
                          unoptimized
                          key={recipe.id}
                          src={`https://wow.zamimg.com/images/wow/icons/large/${item.icon}.jpg`}
                          width={32}
                          height={32}
                          alt={item.name}
                          title={item.name}
                        />
                      ) : null;
                    })}
                  </div>
                  <div>
                    <span>
                      {equipment.items.get(rewardRecipes[0].itemId)?.setName}
                    </span>
                    <span>
                      {t("equipmentPreviewHelp", {
                        count: rewardRecipes.length,
                      })}
                    </span>
                  </div>
                </div>
              )}
              <div className="resource-prerequisite">
                <strong>{t(selected.prerequisiteTitleKey)}</strong>
                <span>{t(selected.prerequisiteKey)}</span>
              </div>
            </div>

            <footer className="resource-dialog-footer">
              <div className="resource-dialog-selection">
                <strong>
                  {quantity.toLocaleString(locale)} {selectedName}
                </strong>
                <span>{t("reviewDescription")}</span>
              </div>
              {resourceId && onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  className="resource-remove text-danger hover:bg-danger/10"
                  aria-label={t("removeResource", {
                    name: t(initialOption!.labelKey, { family: familyLabel }),
                  })}
                  onClick={() => {
                    onRemove(resourceId);
                    onRemoved?.();
                    onOpenChange(false);
                  }}
                >
                  {t("remove")}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="resource-cancel hover:bg-selected-surface"
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
