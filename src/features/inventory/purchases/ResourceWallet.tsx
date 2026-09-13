"use client";

import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { NumberInput } from "@/components/ui/NumberInput";
import { tokenFamilyForClass } from "@/domain/purchases/catalog";
import type { ResourceId } from "@/domain/purchases/model";
import { useGearLabSelector } from "../state/GearLabProvider";
import { useAnalysisView } from "../state/GearLabRuntime";
import {
  createWalletRequestSelector,
  createWalletPresentationSelector,
} from "../state/gear-lab-selectors";
import type { GearLabActions } from "../state/gear-lab-store";
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
  actions: GearLabActions;
  summary?: ReactNode;
  onReview: () => void;
};

type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function ResourceWalletView({
  request,
  analysis,
  actions,
  summary,
  onReview,
}: Props) {
  const t = useTranslations("inventory.purchases") as unknown as Translator;
  const family = tokenFamilyForClass(request.snapshot.settings.player!.class);
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

  const show = useCallback((resourceId?: ResourceId) => {
    opener.current = document.activeElement as HTMLElement | null;
    setEditing(resourceId);
    setOpen(true);
  }, []);

  const selectPresentation = useMemo(
    () => createWalletPresentationSelector(),
    [],
  );
  const presentation = selectPresentation(request);
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

      {ids.map((id) => (
        <ResourceWalletRow
          key={id}
          id={id}
          request={presentation}
          quantity={balances[id] ?? 0}
          actions={actions}
          show={show}
        />
      ))}

      {ids.length > 0 &&
        (summary ?? (
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
        ))}

      <ResourceDialog
        request={request}
        resourceId={editing}
        open={open}
        onOpenChange={changeOpen}
        onSave={actions.saveResource}
      />
    </section>
  );
}

const ResourceWalletRow = memo(function ResourceWalletRow({
  id,
  request,
  quantity,
  actions,
  show,
}: {
  id: ResourceId;
  request: TopGearRequest;
  quantity: number;
  actions: GearLabActions;
  show: (id?: ResourceId) => void;
}) {
  const t = useTranslations("inventory.purchases") as unknown as Translator;
  const family = tokenFamilyForClass(request.snapshot.settings.player!.class);
  const familyLabel = t(`families.${family}`);
  const option = optionForResource(id, family)!;
  const name = t(option.labelKey, { family: familyLabel });
  return (
    <div className="resource-wallet-row" key={id}>
      <span className="resource-wallet-image">
        <ResourceImage request={request} resourceId={id} />
      </span>
      <div className="resource-wallet-copy">
        <strong>{name}</strong>
        <span>{t(option.walletDescriptionKey)}</span>
      </div>
      <NumberInput
        label={t("walletQuantity", { name })}
        value={quantity}
        onValueChange={(quantity) => actions.setResourceQuantity(id, quantity)}
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
          onClick={() => actions.removeResource(id)}
        >
          <PickerIcon name="trash" />
        </Button>
      </div>
    </div>
  );
});
function WalletSummary({ onReview }: { onReview: () => void }) {
  const t = useTranslations("inventory.purchases");
  const { view } = useAnalysisView();
  const excluded = useGearLabSelector(
    (s) => s.draft?.purchases?.excludedItemIds,
  );
  const profile = useGearLabSelector(
    (s) => s.draft?.snapshot.itemVersion ?? "original",
  );
  const count = view.preview?.candidates.filter(
    (c) => c.available && !excluded?.[profile]?.includes(c.instance.itemId),
  ).length;
  return (
    <div className="resource-wallet-review">
      <strong role="status">
        {count !== undefined
          ? t("walletIncludedCount", { count })
          : t(
              view.state.status === "loading"
                ? "walletCalculating"
                : "walletCountUnavailable",
            )}
      </strong>
      <span>{t("reviewDescription")}</span>
      <Button type="button" variant="secondary" onClick={onReview}>
        {t("reviewPurchases")}
      </Button>
    </div>
  );
}
export const ResourceWallet = memo(function ResourceWallet({
  onReview,
}: {
  onReview: () => void;
}) {
  const selectRequest = useMemo(() => createWalletRequestSelector(), []);
  const request = useGearLabSelector(selectRequest)!;
  const actions = useGearLabSelector((s) => s.actions);
  return (
    <ResourceWalletView
      request={request}
      actions={actions}
      onReview={onReview}
      summary={<WalletSummary onReview={onReview} />}
    />
  );
});
