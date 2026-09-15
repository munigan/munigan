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
import { useLocale } from "next-intl";
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
  }

  return (
    <section
      className="resource-wallet"
      data-populated={ids.length > 0}
      aria-labelledby="resource-wallet-title"
    >
      <div className="resource-wallet-header">
        {ids.length === 0 && (
          <div className="resource-wallet-empty-images" aria-hidden="true">
            <ResourceImage
              request={presentation}
              resourceId="frost"
              decorative
            />
            <ResourceImage
              request={presentation}
              resourceId="triumph"
              decorative
            />
          </div>
        )}
        <div className="resource-wallet-heading">
          <h2 id="resource-wallet-title">
            {t(ids.length ? "walletTitle" : "walletEmptyTitle")}
          </h2>
          {ids.length === 0 && <p>{t("walletEmptyDescription")}</p>}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => show()}
        >
          <PickerIcon name="plus" />
          {t("addResource")}
        </Button>
      </div>
      {ids.length > 0 && (
        <div className="resource-wallet-chips">
          {ids.map((id) => (
            <ResourceWalletRow
              key={id}
              id={id}
              request={presentation}
              quantity={balances[id] ?? 0}
              show={show}
            />
          ))}
        </div>
      )}

      {ids.length > 0 &&
        (summary ?? (
          <div className="resource-wallet-review">
            <div className="resource-wallet-summary-copy">
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
            </div>
            <Button
              type="button"
              variant="ghost"
              className="resource-wallet-review-link text-action px-3 py-0 min-h-8"
              onClick={onReview}
            >
              {t("reviewPurchases")}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d="m7 17 10-10M7 7h10v10" />
              </svg>
            </Button>
          </div>
        ))}

      <ResourceDialog
        request={request}
        resourceId={editing}
        open={open}
        onOpenChange={changeOpen}
        onSave={actions.saveResource}
        onRemove={actions.removeResource}
        onRemoved={() => {
          opener.current = null;
        }}
        finalFocus={() =>
          opener.current?.isConnected
            ? opener.current
            : document.querySelector<HTMLElement>(
                ".resource-wallet-header button",
              )
        }
      />
    </section>
  );
}

const ResourceWalletRow = memo(function ResourceWalletRow({
  id,
  request,
  quantity,
  show,
}: {
  id: ResourceId;
  request: TopGearRequest;
  quantity: number;
  show: (id?: ResourceId) => void;
}) {
  const t = useTranslations("inventory.purchases") as unknown as Translator;
  const locale = useLocale();
  const family = tokenFamilyForClass(request.snapshot.settings.player!.class);
  const option = optionForResource(id, family)!;
  const name = t(option.labelKey, { family: t(`families.${family}`) });
  return (
    <button
      type="button"
      className="resource-wallet-chip"
      aria-label={t("editResource", { name })}
      onClick={() => show(id)}
    >
      <span className="resource-wallet-image">
        <ResourceImage request={request} resourceId={id} decorative />
      </span>
      <span className="resource-wallet-copy">
        <strong title={name}>{name}</strong>
        <span>
          {t("walletChipDetail", {
            tier: option.tier,
            level:
              option.tier === 8 && request.snapshot.itemVersion === "classic"
                ? option.itemLevel + 6
                : option.itemLevel,
          })}
        </span>
      </span>
      <span className="resource-wallet-quantity">
        {quantity.toLocaleString(locale)}
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="m15 5 4 4M4 20l4-1L20 7l-4-4L4 15z" />
      </svg>
    </button>
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
      <div className="resource-wallet-summary-copy">
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
      </div>
      <Button
        type="button"
        variant="ghost"
        className="resource-wallet-review-link text-action px-3 py-0 min-h-8"
        onClick={onReview}
      >
        {t("reviewPurchases")}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="m7 17 10-10M7 7h10v10" />
        </svg>
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
