"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { NumberInput } from "@/components/ui/NumberInput";
import { tokenFamilyForClass } from "@/domain/purchases/catalog";
import type { ResourceId } from "@/domain/purchases/model";
import { removeResource, setResourceBalance } from "@/domain/purchases/state";
import type { TopGearRequest } from "@/domain/top-gear/model";
import type { PurchaseAnalysisState } from "./purchase-worker-contract";
import { PickerIcon } from "../custom-items/PickerIcon";
import { ResourceImage } from "./ResourceImage";
import { ResourceDialog } from "./ResourceDialog";
import {
  isResourceForFamily,
  optionForResource,
  resourceOptions,
} from "./resource-labels";
import "./purchases.css";

type Props = {
  request: TopGearRequest;
  analysis?: PurchaseAnalysisState;
  onChange: (request: TopGearRequest) => void;
  onReview: () => void;
};

type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function ResourceWallet({
  request,
  analysis,
  onChange,
  onReview,
}: Props) {
  const t = useTranslations("inventory.purchases") as unknown as Translator;
  const family = tokenFamilyForClass(request.snapshot.settings.player!.class);
  const familyLabel = t(`families.${family}`);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceId>();
  const opener = useRef<HTMLElement | null>(null);
  const preview = analysis?.status === "ready" ? analysis.preview : null;
  const includedCount = preview?.candidates.filter(
    (c) => c.included && c.available,
  ).length;
  const balances = request.purchases?.balances ?? {};
  const ids = resourceOptions
    .map((option) => option.id(family))
    .filter(
      (id, index, all) =>
        all.indexOf(id) === index &&
        Object.prototype.hasOwnProperty.call(balances, id) &&
        isResourceForFamily(id, family),
    );

  function show(resourceId?: ResourceId) {
    opener.current = document.activeElement as HTMLElement | null;
    setEditing(resourceId);
    setOpen(true);
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) queueMicrotask(() => opener.current?.focus());
  }

  return (
    <section
      className="resource-wallet"
      aria-labelledby="resource-wallet-title"
    >
      <div className="resource-wallet-header">
        <div>
          <h2 id="resource-wallet-title">{t("walletTitle")}</h2>
          <p>{t("walletDescription")}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => show()}>
          <PickerIcon name="plus" />
          {t("addResource")}
        </Button>
      </div>

      {ids.map((id) => {
        const option = optionForResource(id, family)!;
        const name = t(option.labelKey, { family: familyLabel });
        return (
          <div className="resource-wallet-row" key={id}>
            <ResourceImage request={request} resourceId={id} />
            <div className="resource-wallet-copy">
              <strong>{name}</strong>
              <span>{t(option.walletDescriptionKey)}</span>
            </div>
            <NumberInput
              label={t("walletQuantity", { name })}
              value={balances[id] ?? 0}
              onValueChange={(quantity) =>
                onChange(setResourceBalance(request, id, quantity))
              }
              min={0}
              max={1_000_000}
              step={1}
              minDigits={3}
            />
            <div className="resource-wallet-actions">
              <Button
                type="button"
                variant="secondary"
                aria-label={t("editResource", { name })}
                onClick={() => show(id)}
              >
                {t("edit")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="item-remove size-8 min-h-8 p-0 text-muted"
                aria-label={t("removeResource", { name })}
                onClick={() => onChange(removeResource(request, id))}
              >
                <PickerIcon name="trash" />
              </Button>
            </div>
          </div>
        );
      })}

      {ids.length > 0 && (
        <div className="resource-wallet-review">
          <strong role="status">
            {includedCount !== undefined
              ? t("walletIncludedCount", { count: includedCount })
              : t(
                  analysis?.status === "loading"
                    ? "walletCalculating"
                    : "walletCountUnavailable",
                )}
          </strong>
          <span>{t("reviewDescription")}</span>
          <Button type="button" variant="secondary" onClick={onReview}>
            {t("reviewPurchases")}
          </Button>
        </div>
      )}

      <ResourceDialog
        request={request}
        resourceId={editing}
        open={open}
        onOpenChange={changeOpen}
        onChange={onChange}
      />
    </section>
  );
}
