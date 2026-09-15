"use client";
import Image from "next/image";
import { resourceIcon } from "./resource-icons";
import { Select, SelectOption } from "@/components/ui/Select";
import { useState } from "react";
import type { GearLabActions } from "../state/gear-lab-store";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  DialogContent,
  DialogDescription,
  DialogDismiss,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/Dialog";
import type { TopGearRequest } from "@/domain/top-gear/model";
import type { ResourceAmounts, ResourceId } from "@/domain/purchases/model";
import {
  getPurchaseCatalog,
  tokenFamilyForClass,
} from "@/domain/purchases/catalog";

import { itemVersionOf } from "@/domain/top-gear/item-version";
import { getCatalog } from "@/domain/equipment/catalog";
import { ItemIcon, ItemName } from "../Item";
import type {
  PurchaseAnalysisState,
  PurchasePreview,
} from "./purchase-worker-contract";
import { optionForResource } from "./resource-labels";
import { orderPurchaseVariants } from "./presentation";
import "./purchases.css";
export function PurchasableItemsDialog({
  request,
  preview,
  analysisState,
  open,
  onOpenChange,
  actions,
}: {
  request: Pick<TopGearRequest, "snapshot" | "purchases">;
  preview: PurchasePreview | null;
  analysisState?: PurchaseAnalysisState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: GearLabActions;
}) {
  const t = useTranslations("inventory.purchases");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [slotFilter, setSlotFilter] = useState("all");
  const profile = itemVersionOf(request.snapshot);
  const catalog = getPurchaseCatalog(profile);
  const equipment = getCatalog(profile);
  const catalogChanged =
    !!request.purchases &&
    request.purchases.recipeRevision !== catalog.revision;
  const analysisStatus =
    analysisState?.status === "ready"
      ? analysisState.analysis.status
      : analysisState?.status;
  const pendingMessage = catalogChanged
    ? "catalogChanged"
    : analysisStatus === "error"
      ? "analysisError"
      : analysisStatus === "search-limit"
        ? "searchLimit"
        : "reviewPending";

  const family = tokenFamilyForClass(request.snapshot.settings.player!.class);
  const orderedCandidates = orderPurchaseVariants(
    preview?.candidates ?? [],
    (candidate) => catalog.byItemId.get(candidate.instance.itemId),
    request.snapshot.specId,
    request.snapshot.settings.player!.class,
  );
  const groups = [
    ...new Map(
      orderedCandidates.map((c) => {
        const r = catalog.byItemId.get(c.instance.itemId)!;
        return [
          `${r.tier}:${r.itemLevel}`,
          { tier: r.tier, level: r.itemLevel },
        ];
      }),
    ).values(),
  ].sort((a, b) => b.tier - a.tier || a.level - b.level);
  const visibleCandidates = orderedCandidates.filter(
    (c) =>
      (showUnavailable || c.available) &&
      (tierFilter === null ||
        catalog.byItemId.get(c.instance.itemId)?.tier === tierFilter) &&
      (slotFilter === "all" ||
        catalog.byItemId.get(c.instance.itemId)?.slot === slotFilter),
  );
  const firstGroup = groups.find((g) =>
    visibleCandidates.some((c) => {
      const r = catalog.byItemId.get(c.instance.itemId)!;
      return r.tier === g.tier && r.itemLevel === g.level;
    }),
  );
  const changeOpen = onOpenChange;
  const name = (id: number) => equipment.items.get(id)?.name ?? String(id);
  const resourceName = (id: ResourceId) => {
    const option = optionForResource(id, family);
    return option
      ? t(option.labelKey, { family: t(`families.${family}`) })
      : id;
  };
  const cost = (amounts: ResourceAmounts) =>
    Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => `${amount} ${resourceName(id as ResourceId)}`)
      .join(" + ");
  return (
    <DialogRoot open={open} onOpenChange={changeOpen}>
      {open && (
        <DialogContent className="resource-dialog purchase-review-dialog max-w-[55rem] overflow-hidden p-0 sm:p-0 max-sm:w-full max-sm:max-h-dvh max-sm:rounded-none max-sm:border-0">
          <div className="resource-dialog-viewport">
            <header className="resource-dialog-header">
              <div>
                <DialogTitle className="resource-dialog-title">
                  {t("reviewTitle")}
                </DialogTitle>
                <DialogDescription className="resource-dialog-description">
                  {t("reviewIntro")}
                </DialogDescription>
              </div>
              <DialogDismiss />
            </header>
            <div className="resource-dialog-body purchase-review-body">
              <div className="purchase-balances">
                <span>{t("yourBalance")}</span>
                {Object.entries(request.purchases?.balances ?? {})
                  .filter(([, amount]) => amount > 0)
                  .map(([id, amount]) => (
                    <span className="purchase-resource-amount" key={id}>
                      <Image
                        unoptimized
                        src={`https://wow.zamimg.com/images/wow/icons/large/${resourceIcon(id as ResourceId)}.jpg`}
                        width={28}
                        height={28}
                        alt=""
                      />
                      <strong>{amount}</strong>
                      {resourceName(id as ResourceId)}
                    </span>
                  ))}
              </div>
              <div className="purchase-review-toolbar">
                <div className="purchase-tier-filter">
                  <button
                    type="button"
                    aria-pressed={tierFilter === null}
                    onClick={() => setTierFilter(null)}
                  >
                    {t("allTiers")}
                  </button>
                  {[
                    ...new Set(
                      orderedCandidates
                        .filter((c) => showUnavailable || c.available)
                        .map(
                          (c) => catalog.byItemId.get(c.instance.itemId)!.tier,
                        ),
                    ),
                  ]
                    .sort((a, b) => b - a)
                    .map((tier) => (
                      <button
                        type="button"
                        key={tier}
                        aria-pressed={tierFilter === tier}
                        onClick={() => setTierFilter(tier)}
                      >
                        {t("tierValue", { tier })}
                      </button>
                    ))}
                </div>
                <Select
                  aria-label={t("filterSlot")}
                  value={slotFilter}
                  onValueChange={(value) => setSlotFilter(value ?? "all")}
                >
                  <SelectOption value="all">{t("allSlots")}</SelectOption>
                  {["head", "shoulder", "chest", "hands", "legs"].map(
                    (slot) => (
                      <SelectOption key={slot} value={slot}>
                        {t(`reviewSlots.${slot}`)}
                      </SelectOption>
                    ),
                  )}
                </Select>
                <label className="purchase-show-unavailable">
                  <input
                    type="checkbox"
                    checked={showUnavailable}
                    onChange={(event) =>
                      setShowUnavailable(event.target.checked)
                    }
                  />
                  {t("showUnavailable")}
                </label>
              </div>
              {preview && !showUnavailable && !visibleCandidates.length && (
                <p className="purchase-review-status" role="status">
                  {t("noAvailablePurchases")}
                </p>
              )}
              {!preview ? (
                <div
                  className="purchase-review-status"
                  role={catalogChanged ? "alert" : "status"}
                >
                  <p>{t(pendingMessage)}</p>
                  {catalogChanged && (
                    <Button
                      variant="secondary"
                      onClick={() => actions.revalidatePurchases()}
                    >
                      {t("revalidate")}
                    </Button>
                  )}
                </div>
              ) : (
                groups.map(({ tier, level }) => {
                  const candidates = visibleCandidates.filter(
                    (c) =>
                      (showUnavailable || c.available) &&
                      catalog.byItemId.get(c.instance.itemId)?.tier === tier &&
                      catalog.byItemId.get(c.instance.itemId)?.itemLevel ===
                        level,
                  );
                  if (!candidates.length) return null;
                  return (
                    <details
                      className="purchase-review-group"
                      key={`${tier}:${level}`}
                      open={
                        expanded[`${tier}:${level}`] ??
                        (firstGroup?.tier === tier &&
                          firstGroup?.level === level)
                      }
                      onToggle={(event) => {
                        const next = event.currentTarget.open;
                        setExpanded((previous) =>
                          previous[`${tier}:${level}`] === next
                            ? previous
                            : { ...previous, [`${tier}:${level}`]: next },
                        );
                      }}
                    >
                      <summary>
                        <strong>
                          {t("tierValue", {
                            tier,
                          })}{" "}
                          · {level}
                        </strong>
                        <span>
                          {t("availableIncludedCount", {
                            count: candidates.filter(
                              (c) =>
                                c.available &&
                                !request.purchases?.excludedItemIds[
                                  profile
                                ]?.includes(c.instance.itemId),
                            ).length,
                          })}
                        </span>
                      </summary>
                      {candidates.map((candidate) => {
                        const { itemId } = candidate.instance;
                        const recipe = catalog.byItemId.get(itemId)!;
                        const included =
                          !request.purchases?.excludedItemIds[
                            profile
                          ]?.includes(itemId);
                        return (
                          <article
                            className="purchase-review-item"
                            data-purchase-id={itemId}
                            key={itemId}
                          >
                            <div className="purchase-review-item-heading">
                              <input
                                type="checkbox"
                                checked={included}
                                onChange={() =>
                                  actions.setPurchaseIncluded(itemId, !included)
                                }
                                aria-label={t("includeItem", {
                                  name: name(itemId),
                                  level,
                                })}
                              />
                              <ItemIcon item={candidate.instance} />
                              <div className="purchase-review-name">
                                <ItemName item={candidate.instance} />
                                <p>
                                  {t(`reviewSlots.${recipe.slot}`)} · {level}
                                  {!candidate.available &&
                                    ` · ${t("unavailable")}`}
                                </p>
                              </div>
                              <div
                                className="purchase-review-cost"
                                aria-label={t("totalCost", {
                                  cost: cost(
                                    candidate.paths[0]?.spent ?? recipe.cost,
                                  ),
                                })}
                              >
                                {Object.entries(
                                  candidate.paths[0]?.spent ?? recipe.cost,
                                )
                                  .filter(([, amount]) => amount > 0)
                                  .map(([id, amount]) => (
                                    <span
                                      className="purchase-resource-amount"
                                      key={id}
                                      title={resourceName(id as ResourceId)}
                                    >
                                      <Image
                                        unoptimized
                                        src={`https://wow.zamimg.com/images/wow/icons/large/${resourceIcon(id as ResourceId)}.jpg`}
                                        width={24}
                                        height={24}
                                        alt={resourceName(id as ResourceId)}
                                      />
                                      <strong>{amount}</strong>
                                    </span>
                                  ))}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </details>
                  );
                })
              )}
              <details className="purchase-review-explanation">
                <summary>{t("purchaseRules")}</summary>
                <p className="purchase-review-help">{t("reviewHelp")}</p>
                <p className="purchase-review-help">{t("consumedHelp")}</p>
                <p className="purchase-review-help">{t("exclusionHelp")}</p>
              </details>
            </div>
            <footer className="resource-dialog-footer">
              <div className="purchase-review-footer-copy">
                <strong>
                  {preview
                    ? t("walletIncludedCount", {
                        count: orderedCandidates.filter(
                          (c) =>
                            c.available &&
                            !request.purchases?.excludedItemIds[
                              profile
                            ]?.includes(c.instance.itemId),
                        ).length,
                      })
                    : t("walletCountUnavailable")}
                </strong>
                <span>{t("sharedBalanceHint")}</span>
              </div>
              <Button variant="primary" onClick={() => changeOpen(false)}>
                {t("done")}
              </Button>
            </footer>
          </div>
        </DialogContent>
      )}
    </DialogRoot>
  );
}
